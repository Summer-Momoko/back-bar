# Back Bar

## Run locally in Replit

The app uses React, Express, TypeScript, Drizzle ORM, and the Replit PostgreSQL database. Configure `DATABASE_URL` and `SESSION_SECRET` in Replit Secrets before starting.

Run `npm run db:push` to create the Drizzle schema, then `npm run db:seed` to add the initial shared ingredient catalog. Start the app with `npm run dev`; it serves the React app and API together on port 5000. The configured Replit workflow runs the schema push and seed before starting the server.

The schema is in `db/schema.ts`. Sign-up and login are public; `/api/auth/me`, logout, and all other API paths require an authenticated session.
