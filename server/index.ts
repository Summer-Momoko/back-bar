import bcrypt from "bcryptjs";
import connectPgSimple from "connect-pg-simple";
import express, { type NextFunction, type Request, type Response } from "express";
import session from "express-session";
import { and, asc, desc, eq, exists, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { createServer as createHttpServer } from "node:http";
import { join, resolve } from "node:path";
import { createServer as createViteServer } from "vite";
import { db, pool } from "../db/index.js";
import { barItems, cocktailIngredients, cocktails, ingredients, stars, users } from "../db/schema.js";

export const app = express();
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

type CocktailFieldErrors = {
  name?: string;
  baseSpirit?: string;
  glass?: string;
  method?: string;
  rating?: string;
  notes?: string;
  ingredients?: string;
  ingredientRows?: Array<{ ingredientId?: string; amount?: string }>;
};

function parseCocktailInput(body: unknown): { input: CocktailInput | null; fieldErrors: CocktailFieldErrors } {
  const fieldErrors: CocktailFieldErrors = {};
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const baseSpirit = typeof input.baseSpirit === "string" ? input.baseSpirit : "";
  const glass = typeof input.glass === "string" ? input.glass.trim() : "";
  const method = typeof input.method === "string" ? input.method.trim() : "";
  const notes = typeof input.notes === "string" ? input.notes.trim() : "";
  const rating = Number(input.rating);
  if (!name) fieldErrors.name = "Give your drink a name";
  else if (name.length > 160) fieldErrors.name = "Use 160 characters or fewer";
  if (!BASE_SPIRITS.has(baseSpirit)) fieldErrors.baseSpirit = "Pick a base spirit";
  if (!glass) fieldErrors.glass = "Choose a glass";
  else if (glass.length > 100) fieldErrors.glass = "Use 100 characters or fewer";
  if (!method) fieldErrors.method = "Add a method";
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    fieldErrors.rating = "Choose a rating from 1 to 5";
  }
  if (notes.length > 5000) fieldErrors.notes = "Use 5,000 characters or fewer";

  const rows: Array<{ ingredientId: number; amount: string }> = [];
  const rawRows = Array.isArray(input.ingredients) ? input.ingredients : [];
  const rowErrors: Array<{ ingredientId?: string; amount?: string }> =
    Array.from({ length: Math.min(rawRows.length, 50) }, () => ({}));
  const seenIngredientIds = new Set<number>();
  let selectedCount = 0;
  if (!Array.isArray(input.ingredients)) fieldErrors.ingredients = "Add at least one ingredient";
  if (rawRows.length > 50) fieldErrors.ingredients = "Add no more than 50 ingredients";

  for (const [index, row] of rawRows.slice(0, 50).entries()) {
    const ingredient = row && typeof row === "object" ? row as Record<string, unknown> : {};
    const ingredientId = Number(ingredient.ingredientId);
    const amount = typeof ingredient.amount === "string" ? ingredient.amount.trim() : "";
    const hasIngredient = Number.isInteger(ingredientId) && ingredientId > 0;
    const hasAmount = amount.length > 0;
    const rowError: { ingredientId?: string; amount?: string } = {};

    if (!hasIngredient && !hasAmount) continue;
    if (!hasIngredient) {
      rowError.ingredientId = "Choose an ingredient";
    } else {
      selectedCount += 1;
      if (seenIngredientIds.has(ingredientId)) {
        rowError.ingredientId = "This ingredient is already listed";
      }
      seenIngredientIds.add(ingredientId);
      if (!hasAmount) rowError.amount = "Enter an amount";
      else if (amount.length > 100) rowError.amount = "Use 100 characters or fewer";
      if (hasAmount && amount.length <= 100 && !rowError.ingredientId) {
        rows.push({ ingredientId, amount });
      }
    }
    rowErrors[index] = rowError;
  }

  if (selectedCount === 0) fieldErrors.ingredients ??= "Add at least one ingredient";
  if (rowErrors.some((rowError) => rowError && (rowError.ingredientId || rowError.amount))) {
    fieldErrors.ingredientRows = rowErrors;
  }

  const hasErrors = Object.values(fieldErrors).some((error) => error !== undefined);
  if (hasErrors) return { input: null, fieldErrors };
  return {
    input: { name, baseSpirit, glass, method, rating, notes, ingredients: rows },
    fieldErrors,
  };
}

function parseCocktailId(value: string | string[] | undefined): number | null {
  if (typeof value !== "string") return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function missingIngredientIds(rows: CocktailInput["ingredients"]): Promise<Set<number>> {
  const ids = rows.map((row) => row.ingredientId);
  const found = await db.select({ id: ingredients.id }).from(ingredients).where(inArray(ingredients.id, ids));
  const available = new Set(found.map((row) => row.id));
  return new Set(ids.filter((id) => !available.has(id)));
}

export type MakeableCocktail = {
  id: number;
  name: string;
  baseSpirit: string;
  rating: number;
  ingredients: Array<{ ingredientId: number; name: string }>;
};

export async function getMakeableCocktails(userId: number): Promise<MakeableCocktail[]> {
  const allIngredientsInBar = sql`
    not exists (
      select 1
      from ${cocktailIngredients} as ci
      where ci.cocktail_id = ${cocktails.id}
        and not exists (
          select 1
          from ${barItems} as bi
          where bi.user_id = ${userId}
            and bi.ingredient_id = ci.ingredient_id
        )
    )
  `;
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
    .innerJoin(cocktailIngredients, eq(cocktailIngredients.cocktailId, cocktails.id))
    .innerJoin(ingredients, eq(ingredients.id, cocktailIngredients.ingredientId))
    .where(and(eq(cocktails.userId, userId), allIngredientsInBar))
    .orderBy(asc(cocktails.name), asc(cocktails.id), asc(cocktailIngredients.id));

  const makeable = new Map<number, MakeableCocktail>();
  for (const row of rows) {
    let cocktail = makeable.get(row.id);
    if (!cocktail) {
      cocktail = {
        id: row.id,
        name: row.name,
        baseSpirit: row.baseSpirit,
        rating: row.rating,
        ingredients: [],
      };
      makeable.set(row.id, cocktail);
    }
    cocktail.ingredients.push({ ingredientId: row.ingredientId, name: row.ingredientName });
  }
  return [...makeable.values()];
}

export type OneAwayCocktail = {
  id: number;
  name: string;
  baseSpirit: string;
  missingIngredientId: number;
  missingIngredientName: string;
};

export async function getOneAwayCocktails(userId: number): Promise<OneAwayCocktail[]> {
  const selectedIngredientMissing = sql`
    not exists (
      select 1
      from ${barItems} as selected_bar_item
      where selected_bar_item.user_id = ${userId}
        and selected_bar_item.ingredient_id = ${cocktailIngredients.ingredientId}
    )
  `;
  const exactlyOneMissing = sql`
    (
      select count(*)
      from ${cocktailIngredients} as all_recipe_ingredients
      where all_recipe_ingredients.cocktail_id = ${cocktails.id}
        and not exists (
          select 1
          from ${barItems} as recipe_bar_item
          where recipe_bar_item.user_id = ${userId}
            and recipe_bar_item.ingredient_id = all_recipe_ingredients.ingredient_id
        )
    ) = 1
  `;
  const rows = await db
    .select({
      id: cocktails.id,
      name: cocktails.name,
      baseSpirit: cocktails.baseSpirit,
      missingIngredientId: cocktailIngredients.ingredientId,
      missingIngredientName: ingredients.name,
    })
    .from(cocktails)
    .innerJoin(cocktailIngredients, eq(cocktailIngredients.cocktailId, cocktails.id))
    .innerJoin(ingredients, eq(ingredients.id, cocktailIngredients.ingredientId))
    .where(and(
      eq(cocktails.userId, userId),
      selectedIngredientMissing,
      exactlyOneMissing,
    ))
    .orderBy(asc(cocktails.name), asc(cocktails.id));
  return rows;
}

export type DashboardStats = {
  totalRecipes: number;
  averageRating: number | null;
  starredRecipes: number;
  canMakeNow: number;
  recipesByBaseSpirit: Array<{ baseSpirit: string; count: number }>;
};

export async function getDashboardStats(userId: number): Promise<DashboardStats> {
  const [summaryRows, starredRows, spiritRows, makeableCocktails] = await Promise.all([
    db
      .select({
        totalRecipes: sql<number>`count(*)::int`,
        averageRating: sql<number | string | null>`avg(${cocktails.rating})`,
      })
      .from(cocktails)
      .where(eq(cocktails.userId, userId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(stars)
      .innerJoin(
        cocktails,
        and(eq(cocktails.id, stars.cocktailId), eq(cocktails.userId, userId)),
      )
      .where(eq(stars.userId, userId)),
    db
      .select({
        baseSpirit: cocktails.baseSpirit,
        count: sql<number>`count(*)::int`,
      })
      .from(cocktails)
      .where(eq(cocktails.userId, userId))
      .groupBy(cocktails.baseSpirit),
    getMakeableCocktails(userId),
  ]);

  const summary = summaryRows[0];
  const totalRecipes = Number(summary?.totalRecipes ?? 0);
  const averageRating = summary?.averageRating == null
    ? null
    : Number(Number(summary.averageRating).toFixed(1));
  const spiritCounts = new Map(spiritRows.map((row) => [row.baseSpirit, Number(row.count)]));
  const recipesByBaseSpirit = [...BASE_SPIRITS].map((baseSpirit) => ({
    baseSpirit,
    count: spiritCounts.get(baseSpirit) ?? 0,
  }));

  return {
    totalRecipes,
    averageRating,
    starredRecipes: Number(starredRows[0]?.count ?? 0),
    canMakeNow: makeableCocktails.length,
    recipesByBaseSpirit,
  };
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

app.get("/api/dashboard", requireUser, async (req, res, next) => {
  try {
    const stats = await getDashboardStats(req.session.userId!);
    res.json({ stats });
  } catch (error) {
    next(error);
  }
});

app.get("/api/my-bar", requireUser, async (req, res, next) => {
  try {
    const userId = req.session.userId!;
    const [ingredientRows, makeableCocktails, oneAwayCocktails] = await Promise.all([
      db
        .select({
          id: ingredients.id,
          name: ingredients.name,
          category: ingredients.category,
          barIngredientId: barItems.ingredientId,
        })
        .from(ingredients)
        .leftJoin(
          barItems,
          and(eq(barItems.ingredientId, ingredients.id), eq(barItems.userId, userId)),
        )
        .orderBy(asc(ingredients.name)),
      getMakeableCocktails(userId),
      getOneAwayCocktails(userId),
    ]);

    res.json({
      ingredients: ingredientRows.map(({ barIngredientId, ...ingredient }) => ({
        ...ingredient,
        inBar: barIngredientId !== null,
      })),
      makeableCocktails,
      oneAwayCocktails,
    });
  } catch (error) {
    next(error);
  }
});

app.put("/api/my-bar/:ingredientId", requireUser, async (req, res, next) => {
  const ingredientId = parseCocktailId(req.params.ingredientId);
  if (ingredientId === null) {
    res.status(404).json({ error: "Ingredient not found." });
    return;
  }
  if (typeof req.body?.inBar !== "boolean") {
    res.status(400).json({ error: "Choose whether this ingredient is in your bar." });
    return;
  }

  const userId = req.session.userId!;
  try {
    const [ingredient] = await db
      .select({ id: ingredients.id })
      .from(ingredients)
      .where(eq(ingredients.id, ingredientId))
      .limit(1);
    if (!ingredient) {
      res.status(404).json({ error: "Ingredient not found." });
      return;
    }

    if (req.body.inBar) {
      await db.insert(barItems).values({ userId, ingredientId }).onConflictDoNothing();
    } else {
      await db
        .delete(barItems)
        .where(and(eq(barItems.userId, userId), eq(barItems.ingredientId, ingredientId)));
    }

    const [makeableCocktails, oneAwayCocktails] = await Promise.all([
      getMakeableCocktails(userId),
      getOneAwayCocktails(userId),
    ]);
    res.json({ inBar: req.body.inBar, makeableCocktails, oneAwayCocktails });
  } catch (error) {
    next(error);
  }
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
    const userId = req.session.userId!;
    const starredOnly = req.query.starred === "true";
    const rawSearch = req.query.search;
    const rawBaseSpirit = req.query.baseSpirit;
    const rawSort = req.query.sort;
    if (rawSearch !== undefined && typeof rawSearch !== "string") {
      res.status(400).json({ error: "Search must be a single text value." });
      return;
    }
    if (rawBaseSpirit !== undefined && typeof rawBaseSpirit !== "string") {
      res.status(400).json({ error: "Choose one base spirit." });
      return;
    }
    const baseSpirit = typeof rawBaseSpirit === "string" && rawBaseSpirit !== "all" ? rawBaseSpirit : "";
    if (baseSpirit && !BASE_SPIRITS.has(baseSpirit)) {
      res.status(400).json({ error: "Choose a valid base spirit." });
      return;
    }
    const sort = rawSort === undefined ? "newest" : rawSort;
    if (typeof sort !== "string" || !["newest", "rating", "name"].includes(sort)) {
      res.status(400).json({ error: "Choose a valid recipe sort order." });
      return;
    }

    const conditions: SQL[] = [eq(cocktails.userId, userId)];
    if (starredOnly) conditions.push(eq(stars.userId, userId));
    if (baseSpirit) conditions.push(eq(cocktails.baseSpirit, baseSpirit));
    const search = typeof rawSearch === "string" ? rawSearch.trim() : "";
    if (search) {
      const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
      const matchingIngredient = db
        .select({ id: cocktailIngredients.id })
        .from(cocktailIngredients)
        .innerJoin(ingredients, eq(ingredients.id, cocktailIngredients.ingredientId))
        .where(and(
          eq(cocktailIngredients.cocktailId, cocktails.id),
          ilike(ingredients.name, pattern),
        ));
      const matchingRecipe = or(
        ilike(cocktails.name, pattern),
        exists(matchingIngredient),
      );
      if (matchingRecipe) conditions.push(matchingRecipe);
    }

    const sortOrder = sort === "rating"
      ? [desc(cocktails.rating), desc(cocktails.createdAt), asc(cocktails.id)]
      : sort === "name"
        ? [asc(sql`lower(${cocktails.name})`), asc(cocktails.id)]
        : [desc(cocktails.createdAt), asc(cocktails.id)];
    const rows = await db
      .select({
        id: cocktails.id,
        name: cocktails.name,
        baseSpirit: cocktails.baseSpirit,
        rating: cocktails.rating,
        starredCocktailId: stars.cocktailId,
        ingredientId: cocktailIngredients.ingredientId,
        ingredientName: ingredients.name,
      })
      .from(cocktails)
      .leftJoin(stars, and(eq(stars.cocktailId, cocktails.id), eq(stars.userId, userId)))
      .leftJoin(cocktailIngredients, eq(cocktailIngredients.cocktailId, cocktails.id))
      .leftJoin(ingredients, eq(ingredients.id, cocktailIngredients.ingredientId))
      .where(and(...conditions))
      .orderBy(...sortOrder);

    const summaries = new Map<
      number,
      {
        id: number;
        name: string;
        baseSpirit: string;
        rating: number;
          isStarred: boolean;
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
          isStarred: row.starredCocktailId !== null,
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
        starredCocktailId: stars.cocktailId,
      })
      .from(cocktails)
      .leftJoin(
        stars,
        and(eq(stars.cocktailId, cocktails.id), eq(stars.userId, req.session.userId!)),
      )
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
    const { starredCocktailId, ...recipe } = cocktail;
    res.json({ cocktail: { ...recipe, isStarred: starredCocktailId !== null, ingredients: rows } });
  } catch (error) {
    next(error);
  }
});

app.put("/api/cocktails/:id/star", requireUser, async (req, res, next) => {
  const id = parseCocktailId(req.params.id);
  if (id === null) {
    res.status(404).json({ error: "Recipe not found." });
    return;
  }
  if (typeof req.body?.isStarred !== "boolean") {
    res.status(400).json({ error: "Choose whether to star this recipe." });
    return;
  }

  const userId = req.session.userId!;
  try {
    const [ownedCocktail] = await db
      .select({ id: cocktails.id })
      .from(cocktails)
      .where(and(eq(cocktails.id, id), eq(cocktails.userId, userId)))
      .limit(1);
    if (!ownedCocktail) {
      res.status(404).json({ error: "Recipe not found." });
      return;
    }

    if (req.body.isStarred) {
      await db.insert(stars).values({ userId, cocktailId: id }).onConflictDoNothing();
    } else {
      await db
        .delete(stars)
        .where(and(eq(stars.userId, userId), eq(stars.cocktailId, id)));
    }
    res.json({ isStarred: req.body.isStarred });
  } catch (error) {
    next(error);
  }
});

app.post("/api/cocktails", requireUser, async (req, res, next) => {
  const validation = parseCocktailInput(req.body);
  if (!validation.input) {
    res.status(400).json({
      error: "Please correct the highlighted fields.",
      fieldErrors: validation.fieldErrors,
    });
    return;
  }
  const missingIds = await missingIngredientIds(validation.input.ingredients);
  if (missingIds.size) {
    res.status(400).json({
      error: "Please correct the highlighted fields.",
      fieldErrors: { ingredients: "Choose ingredients from the list" },
    });
    return;
  }
  const input = validation.input;
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

  const validation = parseCocktailInput(req.body);
  if (!validation.input) {
    res.status(400).json({
      error: "Please correct the highlighted fields.",
      fieldErrors: validation.fieldErrors,
    });
    return;
  }
  const missingIds = await missingIngredientIds(validation.input.ingredients);
  if (missingIds.size) {
    res.status(400).json({
      error: "Please correct the highlighted fields.",
      fieldErrors: { ingredients: "Choose ingredients from the list" },
    });
    return;
  }
  const input = validation.input;
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
if (process.env.NODE_ENV !== "test") {
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
}

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Request failed:", error);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

const server = process.env.NODE_ENV === "test"
  ? undefined
  : httpServer.listen(port, "0.0.0.0", () => {
    console.log(`Back Bar running on port ${port}.`);
  });

async function shutdown() {
  server?.close();
  await closeVite?.();
  await pool.end();
}
if (server) {
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
