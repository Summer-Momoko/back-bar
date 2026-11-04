import {
  check,
  index,
  integer,
  json,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  displayName: varchar("display_name", { length: 80 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cocktails = pgTable(
  "cocktails",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    baseSpirit: varchar("base_spirit", { length: 32 }).notNull(),
    glass: varchar("glass", { length: 100 }).notNull(),
    method: text("method").notNull(),
    rating: integer("rating").notNull(),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "cocktails_base_spirit_check",
      sql`${table.baseSpirit} in ('gin', 'whiskey', 'rum', 'tequila', 'vodka', 'brandy', 'other')`,
    ),
    check("cocktails_rating_check", sql`${table.rating} between 1 and 5`),
    index("cocktails_user_id_idx").on(table.userId),
  ],
);

export const ingredients = pgTable("ingredients", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull().unique(),
  category: varchar("category", { length: 24 }).notNull(),
});

export const cocktailIngredients = pgTable(
  "cocktail_ingredients",
  {
    id: serial("id").primaryKey(),
    cocktailId: integer("cocktail_id").notNull().references(() => cocktails.id, { onDelete: "cascade" }),
    ingredientId: integer("ingredient_id").notNull().references(() => ingredients.id),
    amount: varchar("amount", { length: 100 }).notNull(),
  },
  (table) => [
    unique("cocktail_ingredients_cocktail_ingredient_unique").on(table.cocktailId, table.ingredientId),
    index("cocktail_ingredients_ingredient_id_idx").on(table.ingredientId),
  ],
);

export const barItems = pgTable(
  "bar_items",
  {
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    ingredientId: integer("ingredient_id").notNull().references(() => ingredients.id),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.ingredientId] }),
    index("bar_items_ingredient_id_idx").on(table.ingredientId),
  ],
);

export const stars = pgTable(
  "stars",
  {
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    cocktailId: integer("cocktail_id").notNull().references(() => cocktails.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.cocktailId] })],
);

// connect-pg-simple stores sessions in this table; declaring it here keeps
// schema creation in Drizzle rather than having the server create tables at runtime.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid", { length: 255 }).primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire", { precision: 6, withTimezone: false }).notNull(),
  },
  (table) => [index("sessions_expire_idx").on(table.expire)],
);
