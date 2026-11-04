## Prompt 1

Read PLAN.md. Feature 1 (auth), the schema, and deployment config are done. Build ONLY feature 3: create / read / update / delete recipes. Do not build validation messages, stars, search, dashboard, or My Bar yet.

Requirements:
- The home page after login becomes "My recipes": a list of the logged-in user's cocktails (name, base spirit, rating, ingredient names). Empty state with an "Add recipe" button.
- Detail page /cocktails/:id showing all fields and the ingredient list with amounts.
- Add and Edit form with: name, base spirit (dropdown: gin, whiskey, rum, tequila, vodka, brandy, other), glass, method (multi-line), rating (1–5), notes, and a dynamic list of ingredient rows. Each row = searchable dropdown from the ingredients table + free-text amount (e.g. "1 oz", "2 dashes"), with "+ Add ingredient" and a remove button per row. Saving writes cocktail_ingredients rows; editing replaces them.
- Delete button on the detail page with an "Are you sure?" confirmation dialog.
- Ownership: every cocktail query must filter by the logged-in user's id. Requesting another user's cocktail id returns 404.
- Keep the design from PLAN.md section 6, with consistent page padding.

Also create prompts/crud.md containing this exact prompt under "## Prompt 1".

When done, explain in 3 sentences how ingredients are saved and how ownership is enforced.
