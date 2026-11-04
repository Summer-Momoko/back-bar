## Prompt 1

Read PLAN.md. Auth and recipe CRUD are done. Build ONLY feature 4: Validation. Don't change anything else.

Requirements:
- On the Add and Edit recipe forms, these are required: name, base spirit, method, and at least one ingredient row with an ingredient selected.
- Rating must be 1–5. An ingredient row with an amount but no ingredient selected is invalid.
- Validate on the client: show a friendly message under each invalid field (e.g. "Give your drink a name", "Pick a base spirit", "Add at least one ingredient") and don't submit. Messages disappear as soon as the field is fixed.
- Also validate on the server (same rules) and return 400 with field-level messages, so the API can't save a broken recipe even if the form is bypassed. The form should display those server messages too.
- Keep the PLAN.md design: messages in a muted red, small text, no pop-up alerts.

Create prompts/validation.md containing this exact prompt under "## Prompt 1".

When done, tell me in 2 sentences how client and server validation differ.
