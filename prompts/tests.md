## Prompt 1

Read PLAN.md section 4. Add automated tests with Vitest + Supertest. Don't change app features.

Test 1 — Data isolation:
Given User A has saved a "Negroni" recipe, when User B logs in and requests GET /api/cocktails and GET /api/cocktails/<A's id>, then B's list is empty and the detail request returns 404.

Test 2 — Dashboard average rating:
Given a user with three recipes rated 3, 4, and 5, and another user with a recipe rated 1, when the first user calls GET /api/dashboard, then averageRating is 4.0 and totalRecipes is 3.

- Use a separate test database or clean up created rows after each test, so real data isn't touched.
- Add an npm script "test" that runs them, and tell me the exact command.

Create prompts/tests.md containing this exact prompt under "## Prompt 1".

## Prompt 2 (red/green)

Temporarily break data isolation: remove the user_id filter from the cocktail list query. Don't touch the tests.

---

Do it again, but this time STOP after removing the user_id filter from the cocktail list query. Do NOT run the tests and do NOT restore it — I will run the tests myself and tell you when to revert.

---

Revert that break now.

---

Temporarily break the dashboard: compute the average rating across ALL users' recipes instead of only the logged-in user's. STOP after the change — do NOT run the tests and do NOT restore it. I will run them myself.

---

Revert that break now.
