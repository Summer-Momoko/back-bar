## Prompt 1

Read PLAN.md. Auth, CRUD, and validation are done. Build ONLY feature 5: Stars. Don't change anything else.

Requirements:
- A star toggle (outline star / filled sage star) on each recipe in the list and on the detail page. Clicking it adds or removes a row in the stars table (user_id, cocktail_id). One stars table for all users.
- A "Starred" view (a tab or link next to "My recipes") that shows only the logged-in user's starred recipes. Empty state: "Star a recipe to keep it here."
- A user can only star their own recipes; starring someone else's cocktail id returns 404.
- Deleting a recipe also removes its stars.

Create prompts/stars.md containing this exact prompt under "## Prompt 1".

When done, explain in 2 sentences why stars is a junction table.
