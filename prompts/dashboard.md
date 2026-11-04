## Prompt 1

Read PLAN.md. Build ONLY feature 7: Dashboard. Don't change anything else.

Requirements:
- A "Dashboard" page in the header nav.
- Summary stats computed on the server from the logged-in user's data only, via GET /api/dashboard:
  - Total recipes
  - Average rating (one decimal, e.g. 4.2; show "—" if no recipes)
  - Starred recipes count
  - "Can make now": number of recipes whose ingredients are all in the user's bar_items (0 for now if the bar is empty)
- A bar chart (Recharts) of recipe count by base spirit, sage bars, minimal axes.
- Put the stats calculation in its own function (e.g. getDashboardStats(userId)) so it can be tested later.
- Design per PLAN.md section 6: stat cards in a row, chart below.

Create prompts/dashboard.md containing this exact prompt under "## Prompt 1".
