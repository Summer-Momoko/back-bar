## Prompt 1

Write three documentation pieces. Do NOT change any app code.

## 1. schema.md (repo root)
Generate it from the ACTUAL schema in the code (db/schema.ts), not from PLAN.md:
- Every table, its columns, each column's type, primary keys, foreign keys, unique constraints, and cascade rules.
- How the tables relate, in plain English (one-to-many / many-to-many, and through which junction table).
- A Mermaid erDiagram.
- A final section "Compared with PLAN.md section 3" listing honestly every difference between what was planned and what was built (extra tables such as sessions, extra or renamed columns, constraints added, anything planned but missing). If something matches, say so.

## 2. README.md (replace the current one)
- What Back Bar does (2–3 sentences)
- Live URL: https://back-bar.replit.app
- Features list (the 7 spine features + My Bar / What can I make, One bottle away, Random pick, add a new ingredient)
- Tech stack and tools: Replit Agent, React + Express (TypeScript), Replit PostgreSQL + Drizzle ORM, bcrypt + express-session, Recharts, Vitest + Supertest, GitHub feature branches + PRs
- How to run locally: required environment variables (DATABASE_URL, SESSION_SECRET, and any others the code actually reads), install, seed, dev server, and `npm test` — use the real script names from package.json
- Links to PLAN.md, schema.md, and the prompts/ folder

## 3. Append to the END of PLAN.md — do not edit anything above it
Append exactly this section:

---

## Plan vs. Reality

| Planned feature | Shipped / Changed / Cut | Status | Learning | What changed and why (one line) |
|---|---|---|---|---|
| 1. Sign up and login | Shipped | Done | The Replit preview pane couldn't keep a login session, so the agent never saw any signed-in page — I had to be the one who looked. | Worked as planned; deployment config needed its own unplanned PR before the app could go live. |
| 2. Data model | Changed | Done | A shared ingredient list needs a hierarchy: "Gin" and "London dry gin" are separate rows, so a substitute counts as missing. | Built as designed, but my plan's "any user can add a new ingredient" line was silently dropped until the stranger test exposed it. |
| 3. Create / read / update / delete | Shipped | Done | "It builds" is not "it works" — I caught the Delete button cut off at the page edge only by clicking through it myself. | Same PR included a layout-only bug fix prompt. |
| 4. Validation | Shipped | Done | Validating on the server too means the API can't save a broken recipe even if the form is bypassed. | As planned. |
| 5. Stars | Shipped | Done | One junction table (user_id, cocktail_id) for everyone is simpler than per-user lists. | As planned. |
| 6. Search, filter, sort | Shipped | Done | Searching by ingredient ("campari" → Negroni) turned out to be the most useful part. | As planned. |
| 7. Dashboard | Shipped | Done | Putting the stats in their own function made them testable. | Added a "starred recipes" stat that wasn't in the plan. |
| 8. My Bar + What can I make | Shipped | Done | The matching is only as good as the ingredient data behind it. | As planned. |
| 9. One bottle away | Shipped | Done | It was the first thing I planned to cut, but it was quick because it reused the My Bar matching logic. | Not cut. |
| 10. Random pick | Shipped | Done | Small features with a clear rule are cheap to build and test. | As planned. |
| Tests (data isolation, dashboard average) | Shipped | Done | The agent broke, ran, and restored the code on its own, so I had no failing screenshot; I re-prompted it to stop after the break. | Red/green done by hand on the second try. |
| Add a missing ingredient (PLAN.md §3, not a numbered feature) | Missed, then shipped | Done | Requirements buried in the schema section, not in the numbered feature list, got skipped. | Built after the stranger test showed "What can I make?" gave wrong answers without it. |
| Dark mode (backup cut option) | Cut | Backlogged | — | Not needed, since feature 9 wasn't cut. |

Create prompts/docs.md containing this exact prompt under "## Prompt 1".
