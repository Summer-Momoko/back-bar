import bcrypt from "bcryptjs";
import connectPgSimple from "connect-pg-simple";
import express, { type NextFunction, type Request, type Response } from "express";
import session from "express-session";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { createServer as createHttpServer } from "node:http";
import { join, resolve } from "node:path";
import { createServer as createViteServer } from "vite";
import { db, pool } from "../db/index.js";
import { cocktailIngredients, cocktails, ingredients, users } from "../db/schema.js";

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

const BASE_SPIRITS = new Set(["gin", "whiskey", "rum", "tequila", "vodka", "brandy", "other"]);

type CocktailInput = {
  name: string;
  baseSpirit: string;
  glass: string;
  method: string;
  rating: number;
  notes: string;
  ingredients: Array<{ ingredientId: number; amount: string }>;
};

function parseCocktailInput(body: unknown): CocktailInput | null {
  if (!body || typeof body !== "object") return null;
  const input = body as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const baseSpirit = typeof input.baseSpirit === "string" ? input.baseSpirit : "";
  const glass = typeof input.glass === "string" ? input.glass.trim() : "";
  const method = typeof input.method === "string" ? input.method.trim() : "";
  const notes = typeof input.notes === "string" ? input.notes.trim() : "";
  const rating = Number(input.rating);
  if (
    !name ||
    name.length > 160 ||
    !BASE_SPIRITS.has(baseSpirit) ||
    !glass ||
    glass.length > 100 ||
    !method ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5 ||
    notes.length > 5000 ||
    !Array.isArray(input.ingredients) ||
    input.ingredients.length < 1 ||
    input.ingredients.length > 50
  ) {
    return null;
  }

  const rows: Array<{ ingredientId: number; amount: string }> = [];
  for (const row of input.ingredients) {
    if (!row || typeof row !== "object") return null;
    const ingredient = row as Record<string, unknown>;
    const ingredientId = Number(ingredient.ingredientId);
    const amount = typeof ingredient.amount === "string" ? ingredient.amount.trim() : "";
    if (!Number.isInteger(ingredientId) || ingredientId < 1 || !amount || amount.length > 100) {
      return null;
    }
    rows.push({ ingredientId, amount });
  }
  if (new Set(rows.map((row) => row.ingredientId)).size !== rows.length) return null;

  return { name, baseSpirit, glass, method, rating, notes, ingredients: rows };
}

function parseCocktailId(value: string | string[] | undefined): number | null {
  if (typeof value !== "string") return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function ingredientsExist(rows: CocktailInput["ingredients"]): Promise<boolean> {
  const ids = rows.map((row) => row.ingredientId);
  const found = await db.select({ id: ingredients.id }).from(ingredients).where(inArray(ingredients.id, ids));
  return found.length === ids.length;
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

app.get("/api/ingredients", requireUser, async (_req, res, next) => {
  try {
    const rows = await db
      .select({ id: ingredients.id, name: ingredients.name, category: ingredients.category })
      .from(ingredients)
      .orderBy(asc(ingredients.name));
    res.json({ ingredients: rows });
  } catch (error) {
    next(error);
  }
});

app.get("/api/cocktails", requireUser, async (req, res, next) => {
  try {
    const rows = await db
      .select({
        id: cocktails.id,
        name: cocktails.name,
        baseSpirit: cocktails.baseSpirit,
        rating: cocktails.rating,
        ingredientId: cocktailIngredients.ingredientId,
        ingredientName: ingredients.name,
      })
      .from(cocktails)
      .leftJoin(cocktailIngredients, eq(cocktailIngredients.cocktailId, cocktails.id))
      .leftJoin(ingredients, eq(ingredients.id, cocktailIngredients.ingredientId))
      .where(eq(cocktails.userId, req.session.userId!))
      .orderBy(desc(cocktails.createdAt), asc(cocktails.id));

    const summaries = new Map<
      number,
      {
        id: number;
        name: string;
        baseSpirit: string;
        rating: number;
        ingredients: Array<{ ingredientId: number; name: string }>;
      }
    >();
    for (const row of rows) {
      let summary = summaries.get(row.id);
      if (!summary) {
        summary = {
          id: row.id,
          name: row.name,
          baseSpirit: row.baseSpirit,
          rating: row.rating,
          ingredients: [],
        };
        summaries.set(row.id, summary);
      }
      if (row.ingredientId !== null && row.ingredientName !== null) {
        summary.ingredients.push({ ingredientId: row.ingredientId, name: row.ingredientName });
      }
    }
    res.json({ cocktails: [...summaries.values()] });
  } catch (error) {
    next(error);
  }
});

app.get("/api/cocktails/:id", requireUser, async (req, res, next) => {
  const id = parseCocktailId(req.params.id);
  if (id === null) {
    res.status(404).json({ error: "Recipe not found." });
    return;
  }
  try {
    const [cocktail] = await db
      .select({
        id: cocktails.id,
        name: cocktails.name,
        baseSpirit: cocktails.baseSpirit,
        glass: cocktails.glass,
        method: cocktails.method,
        rating: cocktails.rating,
        notes: cocktails.notes,
        createdAt: cocktails.createdAt,
      })
      .from(cocktails)
      .where(and(eq(cocktails.id, id), eq(cocktails.userId, req.session.userId!)))
      .limit(1);
    if (!cocktail) {
      res.status(404).json({ error: "Recipe not found." });
      return;
    }

    const rows = await db
      .select({
        ingredientId: cocktailIngredients.ingredientId,
        name: ingredients.name,
        amount: cocktailIngredients.amount,
      })
      .from(cocktailIngredients)
      .innerJoin(ingredients, eq(ingredients.id, cocktailIngredients.ingredientId))
      .where(eq(cocktailIngredients.cocktailId, id))
      .orderBy(asc(cocktailIngredients.id));
    res.json({ cocktail: { ...cocktail, ingredients: rows } });
  } catch (error) {
    next(error);
  }
});

app.post("/api/cocktails", requireUser, async (req, res, next) => {
  const input = parseCocktailInput(req.body);
  if (!input || !(await ingredientsExist(input.ingredients))) {
    res.status(400).json({ error: "Invalid recipe." });
    return;
  }
  try {
    const id = await db.transaction(async (tx) => {
      const [cocktail] = await tx
        .insert(cocktails)
        .values({
          userId: req.session.userId!,
          name: input.name,
          baseSpirit: input.baseSpirit,
          glass: input.glass,
          method: input.method,
          rating: input.rating,
          notes: input.notes,
        })
        .returning({ id: cocktails.id });
      await tx.insert(cocktailIngredients).values(
        input.ingredients.map((row) => ({
          cocktailId: cocktail.id,
          ingredientId: row.ingredientId,
          amount: row.amount,
        })),
      );
      return cocktail.id;
    });
    res.status(201).json({ cocktail: { id } });
  } catch (error) {
    next(error);
  }
});

app.put("/api/cocktails/:id", requireUser, async (req, res, next) => {
  const id = parseCocktailId(req.params.id);
  if (id === null) {
    res.status(404).json({ error: "Recipe not found." });
    return;
  }
  try {
    const [ownedCocktail] = await db
      .select({ id: cocktails.id })
      .from(cocktails)
      .where(and(eq(cocktails.id, id), eq(cocktails.userId, req.session.userId!)))
      .limit(1);
    if (!ownedCocktail) {
      res.status(404).json({ error: "Recipe not found." });
      return;
    }
  } catch (error) {
    next(error);
    return;
  }

  const input = parseCocktailInput(req.body);
  if (!input || !(await ingredientsExist(input.ingredients))) {
    res.status(400).json({ error: "Invalid recipe." });
    return;
  }
  try {
    const updated = await db.transaction(async (tx) => {
      const [cocktail] = await tx
        .update(cocktails)
        .set({
          name: input.name,
          baseSpirit: input.baseSpirit,
          glass: input.glass,
          method: input.method,
          rating: input.rating,
          notes: input.notes,
        })
        .where(and(eq(cocktails.id, id), eq(cocktails.userId, req.session.userId!)))
        .returning({ id: cocktails.id });
      if (!cocktail) return false;

      await tx.delete(cocktailIngredients).where(eq(cocktailIngredients.cocktailId, id));
      await tx.insert(cocktailIngredients).values(
        input.ingredients.map((row) => ({
          cocktailId: id,
          ingredientId: row.ingredientId,
          amount: row.amount,
        })),
      );
      return true;
    });
    if (!updated) {
      res.status(404).json({ error: "Recipe not found." });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/cocktails/:id", requireUser, async (req, res, next) => {
  const id = parseCocktailId(req.params.id);
  if (id === null) {
    res.status(404).json({ error: "Recipe not found." });
    return;
  }
  try {
    const [deleted] = await db
      .delete(cocktails)
      .where(and(eq(cocktails.id, id), eq(cocktails.userId, req.session.userId!)))
      .returning({ id: cocktails.id });
    if (!deleted) {
      res.status(404).json({ error: "Recipe not found." });
      return;
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
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
