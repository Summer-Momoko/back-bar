import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

process.env.NODE_ENV = "test";
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
process.env.SESSION_SECRET ??= "back-bar-vitest-session-secret";

const [{ app }, { pool }] = await Promise.all([
  import("../server/index.js"),
  import("../db/index.js"),
]);

type TestUser = {
  username: string;
  displayName: string;
  password: string;
  agent: ReturnType<typeof request.agent>;
};

const testUsers: Array<Omit<TestUser, "agent">> = [];
let ginIngredientId: number;

async function createUser(label: string): Promise<TestUser> {
  const token = randomUUID().replaceAll("-", "").slice(0, 16);
  const username = `bb_test_${token}_${label}`.toLowerCase();
  const displayName = `Back Bar Test ${token} ${label}`;
  const password = "back-bar-vitest-password";
  const user = { username, displayName, password, agent: request.agent(app) };
  testUsers.push({ username, displayName, password });

  const response = await user.agent
    .post("/api/auth/signup")
    .send({ displayName, username, password });
  expect(response.status, response.text).toBe(201);
  return user;
}

async function createRecipe(user: TestUser, name: string, rating: number): Promise<number> {
  const response = await user.agent.post("/api/cocktails").send({
    name,
    baseSpirit: "gin",
    glass: "Rocks",
    method: "Stir with ice and strain.",
    rating,
    notes: "",
    ingredients: [{ ingredientId: ginIngredientId, amount: "1 oz" }],
  });
  expect(response.status, response.text).toBe(201);
  return response.body.cocktail.id as number;
}

afterEach(async () => {
  try {
    if (testUsers.length === 0) return;

    const usernames = testUsers.map(({ username }) => username);
    const displayNames = testUsers.map(({ displayName }) => displayName);
    const result = await pool.query<{ id: number }>(
      `select id
       from users
       where username = any($1::varchar[])
         and display_name = any($2::varchar[])`,
      [usernames, displayNames],
    );
    const userIds = result.rows.map(({ id }) => String(id));
    if (userIds.length > 0) {
      await pool.query(
        "delete from sessions where sess->>'userId' = any($1::text[])",
        [userIds],
      );
      await pool.query("delete from users where id = any($1::int[])", [
        userIds.map(Number),
      ]);
    }
  } finally {
    testUsers.length = 0;
  }
});

beforeAll(async () => {
  const result = await pool.query<{ id: number }>(
    "select id from ingredients where lower(name) = 'gin' limit 1",
  );
  if (!result.rows[0]) {
    throw new Error("Gin is missing from the ingredient catalog; run npm run db:seed before tests.");
  }
  ginIngredientId = result.rows[0].id;
});

afterAll(async () => {
  await pool.end();
});

describe("authenticated API data isolation", () => {
  it("does not expose one user's recipes to another user", async () => {
    const userA = await createUser("a");
    const userB = await createUser("b");
    const recipeId = await createRecipe(userA, "Negroni", 4);

    await userB.agent.post("/api/auth/logout").expect(204);
    await userB.agent
      .post("/api/auth/login")
      .send({ username: userB.username, password: userB.password })
      .expect(200);

    const list = await userB.agent.get("/api/cocktails").expect(200);
    expect(list.body.cocktails).toEqual([]);

    await userB.agent.get(`/api/cocktails/${recipeId}`).expect(404);
  });

  it("calculates dashboard totals and average rating from the logged-in user's recipes", async () => {
    const userA = await createUser("a");
    const userB = await createUser("b");

    await createRecipe(userA, "Rating Test Three", 3);
    await createRecipe(userA, "Rating Test Four", 4);
    await createRecipe(userA, "Rating Test Five", 5);
    await createRecipe(userB, "Other User Rating One", 1);

    const response = await userA.agent.get("/api/dashboard").expect(200);
    expect(response.body.stats.averageRating).toBe(4);
    expect(response.body.stats.totalRecipes).toBe(3);
  });
});
