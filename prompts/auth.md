## Prompt 1

Read PLAN.md in the repo root — it is the blueprint for this app, "Back Bar".

Build ONLY feature 1 (Sign up and login) and the database setup it needs. Do not build any other features yet.

Requirements:
- Stack: React + Express (TypeScript), Replit PostgreSQL with Drizzle ORM.
- Create the full schema from PLAN.md section 3 now (users, cocktails, ingredients, cocktail_ingredients, bar_items, stars), so later features don't change it. Seed the ingredients table with ~50 common cocktail ingredients, including: gin, London dry gin, dry vermouth, sweet vermouth, Campari, bourbon, rye whiskey, vodka, coffee liqueur, espresso, simple syrup, lemon juice, lime juice, egg white, Angostura bitters, orange bitters, orange peel, lemon twist, olive, coffee beans.
- Sign up page: display name, username, password (min 8 chars). Hash passwords with bcrypt. Username must be unique; show a friendly error if taken.
- Login and logout. Use a session cookie (express-session stored in Postgres).
- After login, the header shows "{display_name}'s Bar". Logged-out users only see the login/sign-up pages.
- Every API route except sign up/login must require a logged-in user.
- Design per PLAN.md section 6: white background, #1A1A1A text, sage accent #5F7361, Inter font, minimal.
- Do not use Replit Auth.

Also create the file prompts/auth.md containing this exact prompt, under a heading "## Prompt 1".

When done, tell me which files you created and how the session/auth works in 3-4 sentences.
