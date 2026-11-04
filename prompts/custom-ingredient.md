## Prompt 1

Read PLAN.md section 3: "any user can add a new one" (ingredient). This was never built. Fix only this:

- In the recipe form's searchable ingredient dropdown, when the typed text matches no ingredient, show an option '+ Add "<typed text>" as a new ingredient'. Selecting it asks for a category (spirit, liqueur, juice, syrup, bitters, garnish, other), creates the ingredient, and selects it in that row.
- Add the same "+ Add new ingredient" option to the search box on the My Bar page, so a new ingredient can be added and ticked.
- Server: trim the name, reject empty names, and treat names case-insensitively — if "Cardamom" already exists, reuse it instead of creating a duplicate.
- New ingredients go into the shared ingredients catalog (ingredient names are not private data).
- Don't change anything else.

Create prompts/custom-ingredient.md containing this exact prompt under "## Prompt 1".
