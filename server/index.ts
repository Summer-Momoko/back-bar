import bcrypt from "bcryptjs";
import connectPgSimple from "connect-pg-simple";
import express, { type NextFunction, type Request, type Response } from "express";
import session from "express-session";
import { eq } from "drizzle-orm";
import { createServer as createHttpServer } from "node:http";
import { join, resolve } from "node:path";
import { createServer as createViteServer } from "vite";
import { db, pool } from "../db/index.js";
import { users } from "../db/schema.js";

const app = express();
const port = Number(process.env.PORT ?? 5000);
const httpServer = createHttpServer(app);
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) throw new Error("SESSION_SECRET is required to start the app.");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required to start the app.");

app.set("trust proxy", 1);
app.use(express.json({ limit: "20kb" }));

const PgSessionStore = connectPgSimple(session);
app.use(
  session({
    store: new PgSessionStore({
      pool,
      tableName: "sessions",
      createTableIfMissing: false,
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    res.status(401).json({ error: "Please log in to continue." });
    return;
  }
  next();
}

function normalizedUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const username = value.trim().toLowerCase();
  return username.length >= 3 && username.length <= 64 ? username : null;
}

app.post("/api/auth/signup", async (req, res, next) => {
  const displayName =
    typeof req.body?.displayName === "string" ? req.body.displayName.trim() : "";
  const username = normalizedUsername(req.body?.username);
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!displayName || displayName.length > 80) {
    res.status(400).json({ error: "Enter a display name (up to 80 characters)." });
    return;
  }
  if (!username) {
    res.status(400).json({ error: "Choose a username between 3 and 64 characters." });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Your password must be at least 8 characters." });
    return;
  }
  if (password.length > 200) {
    res.status(400).json({ error: "Your password is too long." });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db
      .insert(users)
      .values({ displayName, username, passwordHash })
      .returning({ id: users.id, displayName: users.displayName });

    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((error) => (error ? reject(error) : resolve()));
    });
    req.session.userId = user.id;
    await new Promise<void>((resolve, reject) => {
      req.session.save((error) => (error ? reject(error) : resolve()));
    });
    res.status(201).json({ user });
  } catch (error) {
    const databaseError = error as { code?: string; cause?: { code?: string } };
    if (databaseError.code === "23505" || databaseError.cause?.code === "23505") {
      res.status(409).json({ error: "That username is already taken. Try another one." });
      return;
    }
    next(error);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  const username = normalizedUsername(req.body?.username);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!username || !password) {
    res.status(400).json({ error: "Enter your username and password." });
    return;
  }

  try {
    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: "That username and password don't match." });
      return;
    }

    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((error) => (error ? reject(error) : resolve()));
    });
    req.session.userId = user.id;
    await new Promise<void>((resolve, reject) => {
      req.session.save((error) => (error ? reject(error) : resolve()));
    });
    res.json({ user: { id: user.id, displayName: user.displayName } });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", requireUser, async (req, res, next) => {
  try {
    const [user] = await db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(eq(users.id, req.session.userId!))
      .limit(1);
    if (!user) {
      req.session.destroy(() => undefined);
      res.status(401).json({ error: "Please log in to continue." });
      return;
    }
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", requireUser, (req, res, next) => {
  req.session.destroy((error) => {
    if (error) {
      next(error);
      return;
    }
    res.clearCookie("connect.sid", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    res.status(204).end();
  });
});

app.use("/api", requireUser, (_req, res) => {
  res.status(404).json({ error: "Not found." });
});

let closeVite: (() => Promise<void>) | undefined;
if (process.env.NODE_ENV === "production") {
  const clientDist = resolve(process.cwd(), "dist/client");
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path === "/api" || req.path.startsWith("/api/")) {
      next();
      return;
    }
    res.sendFile(join(clientDist, "index.html"));
  });
} else {
  const vite = await createViteServer({
    configFile: "./vite.config.ts",
    server: {
      middlewareMode: true,
      allowedHosts: true,
      ws: { server: httpServer },
    },
  });
  closeVite = () => vite.close();
  app.use(vite.middlewares);
}

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Request failed:", error);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

const server = httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Back Bar running on port ${port}.`);
});

async function shutdown() {
  server.close();
  await closeVite?.();
  await pool.end();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
