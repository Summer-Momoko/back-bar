# Back Bar

Back Bar is a personal cocktail recipe box for saving, rating, and finding drinks. Track what is in your home bar to see which of your recipes you can make now, what is one ingredient away, or get a random makeable pick.

**Live app:** <https://back-bar.replit.app>

## Features

- Create an account, log in, and keep your recipes and bar private.
- Use a shared catalog of cocktail ingredients.
- Create, view, edit, and delete recipes.
- Validate recipe details in the form and on the server.
- Star recipes and view your Starred list.
- Search recipes by drink or ingredient; filter by spirit and sort results.
- View personal recipe and rating statistics on the Dashboard.
- Track ingredients in My Bar and see what you can make.
- Find recipes that are one ingredient away.
- Get a random recipe you can make with “Surprise me.”
- Add new ingredients to the shared catalog from a recipe or My Bar.

## Tech stack and tools

- Replit Agent
- React, Vite, and Express with TypeScript
- Replit PostgreSQL and Drizzle ORM
- bcryptjs and express-session with PostgreSQL-backed sessions
- Recharts
- Vitest and Supertest
- GitHub feature branches and pull requests

## Run locally

Use Node.js and npm. Set the environment variables before running the app:

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string for the app and Drizzle. |
| `SESSION_SECRET` | Yes | Signs the login session cookie. |
| `PORT` | No | Server port; defaults to `5000`. |
| `NODE_ENV` | No | Controls production cookie settings and server behavior. |
| `TEST_DATABASE_URL` | No | Separate PostgreSQL database for tests; when set, the integration tests use it instead of `DATABASE_URL`. |

Install dependencies, create the schema, and seed the shared ingredient catalog:

```sh
npm install
npm run db:push
npm run db:seed
```

Start the development server:

```sh
npm run dev
```

Run the automated API tests:

```sh
npm test
```

Set `TEST_DATABASE_URL` to a separate test database when running tests so test data stays isolated from your development database.

## Project documents

- [Project plan](PLAN.md)
- [Database schema reference](schema.md)
- [Feature prompts](prompts/)
