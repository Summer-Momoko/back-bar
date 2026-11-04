import { FormEvent, useEffect, useState } from "react";
import {
  Cocktail,
  CocktailInput,
  CocktailSummary,
  Ingredient,
  createCocktail,
  deleteCocktail,
  getCocktail,
  getCocktails,
  getIngredients,
  updateCocktail,
} from "../recipeApi.js";
import "./recipes.css";

type RecipeRoute =
  | { page: "list" }
  | { page: "new" }
  | { page: "detail"; id: number }
  | { page: "edit"; id: number };

type RecipeAppProps = {
  displayName: string;
  onLogout: () => Promise<void> | void;
};

function routeFromPath(pathname: string): RecipeRoute {
  if (pathname === "/cocktails/new") return { page: "new" };
  const match = pathname.match(/^\/cocktails\/(\d+)(\/edit)?\/?$/);
  if (match) {
    const id = Number(match[1]);
    return match[2] ? { page: "edit", id } : { page: "detail", id };
  }
  return { page: "list" };
}

function recipePath(route: RecipeRoute): string {
  if (route.page === "list") return "/";
  if (route.page === "new") return "/cocktails/new";
  return `/cocktails/${route.id}${route.page === "edit" ? "/edit" : ""}`;
}

export function RecipeApp({ displayName, onLogout }: RecipeAppProps) {
  const [route, setRoute] = useState<RecipeRoute>(() => routeFromPath(window.location.pathname));
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    const onPopState = () => setRoute(routeFromPath(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function navigate(nextRoute: RecipeRoute) {
    const path = recipePath(nextRoute);
    if (window.location.pathname !== path) window.history.pushState({}, "", path);
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function handleLink(event: React.MouseEvent<HTMLAnchorElement>, nextRoute: RecipeRoute) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(nextRoute);
  }

  async function logout() {
    setLogoutError("");
    try {
      await onLogout();
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "Could not log out. Try again.");
    }
  }

  return (
    <div className="recipe-app">
      <header className="recipe-topbar">
        <a
          className="recipe-brand"
          href="/"
          aria-label="Back Bar home"
          onClick={(event) => handleLink(event, { page: "list" })}
        >
          back bar<span>.</span>
        </a>
        <div className="recipe-account">
          <span>{displayName}&apos;s Bar</span>
          <button className="recipe-quiet-button" type="button" onClick={logout}>Log out</button>
        </div>
      </header>
      {logoutError && <p className="recipe-toast" role="alert">{logoutError}</p>}
      <main className="recipe-main">
        {route.page === "list" && <RecipeList navigate={navigate} handleLink={handleLink} />}
        {route.page === "detail" && (
          <RecipeDetail id={route.id} navigate={navigate} handleLink={handleLink} />
        )}
        {route.page === "new" && <RecipeEditor mode="create" navigate={navigate} />}
        {route.page === "edit" && <RecipeEditor mode="edit" id={route.id} navigate={navigate} />}
      </main>
    </div>
  );
}

function RecipeList({
  navigate,
  handleLink,
}: {
  navigate: (route: RecipeRoute) => void;
  handleLink: (event: React.MouseEvent<HTMLAnchorElement>, route: RecipeRoute) => void;
}) {
  const [recipes, setRecipes] = useState<CocktailSummary[] | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      setRecipes(await getCocktails());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your recipes could not be loaded.");
    }
  }

  useEffect(() => { void load(); }, []);

  return (
    <section className="recipe-list-page" aria-labelledby="list-heading">
      <div className="recipe-page-heading">
        <div>
          <p className="recipe-eyebrow">YOUR PERSONAL RECIPE BOX</p>
          <h1 id="list-heading">My recipes</h1>
        </div>
        <a
          className="recipe-primary-link"
          href="/cocktails/new"
          onClick={(event) => handleLink(event, { page: "new" })}
        >
            Add recipe <span aria-hidden="true">+</span>
        </a>
      </div>
      {error ? (
        <div className="recipe-message recipe-error" role="alert">
          <p>{error}</p>
          <button type="button" className="recipe-text-action" onClick={() => void load()}>Try again</button>
        </div>
      ) : recipes === null ? (
        <div className="recipe-skeleton" aria-label="Loading recipes" aria-live="polite">
          <span /><span /><span />
        </div>
      ) : recipes.length === 0 ? (
        <div className="recipe-empty">
          <span className="recipe-empty-mark" aria-hidden="true">+</span>
          <h2>A good place to start.</h2>
          <p>Save a drink you’ve enjoyed, and keep the recipe close for next time.</p>
          <button className="recipe-primary-button" type="button" onClick={() => navigate({ page: "new" })}>
             Add recipe
          </button>
        </div>
      ) : (
        <div className="recipe-table" role="list" aria-label="Your cocktail recipes">
          {recipes.map((recipe) => (
            <a
              className="recipe-row"
              href={`/cocktails/${recipe.id}`}
              key={recipe.id}
              role="listitem"
              onClick={(event) => handleLink(event, { page: "detail", id: recipe.id })}
            >
              <span className="recipe-row-main">
                <span className="recipe-row-name">{recipe.name}</span>
                <span className="recipe-row-subtitle">{recipe.baseSpirit || "—"}</span>
              </span>
              <span className="recipe-row-rating">{recipe.rating} / 5</span>
              <span className="recipe-row-ingredients">
                {recipe.ingredients.map((item) => item.name).join(", ") || "No ingredients yet"}
              </span>
              <span className="recipe-row-arrow" aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

function RecipeDetail({
  id,
  navigate,
  handleLink,
}: {
  id: number;
  navigate: (route: RecipeRoute) => void;
  handleLink: (event: React.MouseEvent<HTMLAnchorElement>, route: RecipeRoute) => void;
}) {
  const [cocktail, setCocktail] = useState<Cocktail | null>(null);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function load() {
    setError("");
    setCocktail(null);
    try {
      setCocktail(await getCocktail(id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This recipe could not be loaded.");
    }
  }

  useEffect(() => { void load(); }, [id]);

  async function removeRecipe() {
    if (!cocktail || !window.confirm(`Are you sure you want to delete “${cocktail.name}”?`)) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteCocktail(id);
      navigate({ page: "list" });
    } catch (caught) {
      setDeleteError(caught instanceof Error ? caught.message : "This recipe could not be deleted.");
    } finally {
      setDeleting(false);
    }
  }

  if (error) {
    return (
      <div className="recipe-message recipe-error" role="alert">
        <a className="recipe-back-link" href="/" onClick={(event) => handleLink(event, { page: "list" })}>← My recipes</a>
        <p>{error}</p>
        <button type="button" className="recipe-text-action" onClick={() => void load()}>Try again</button>
      </div>
    );
  }
  if (!cocktail) {
    return <div className="recipe-skeleton recipe-detail-skeleton" aria-label="Loading recipe" aria-live="polite"><span /><span /><span /></div>;
  }

  return (
    <article className="recipe-detail-page">
      <a className="recipe-back-link" href="/" onClick={(event) => handleLink(event, { page: "list" })}>← My recipes</a>
      <div className="recipe-detail-heading">
        <div>
          <p className="recipe-eyebrow">{cocktail.baseSpirit || "COCKTAIL RECIPE"}</p>
          <h1>{cocktail.name}</h1>
        </div>
        <div className="recipe-detail-actions">
          <a
            className="recipe-outline-link"
            href={`/cocktails/${id}/edit`}
            onClick={(event) => handleLink(event, { page: "edit", id })}
          >
            Edit recipe
          </a>
          <button className="recipe-delete-button" type="button" disabled={deleting} onClick={() => void removeRecipe()}>
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
      {deleteError && <p className="recipe-inline-error" role="alert">{deleteError}</p>}
      <div className="recipe-detail-meta">
        <div><span>Glass</span><strong>{cocktail.glass || "Not specified"}</strong></div>
        <div><span>Method</span><strong className="recipe-method">{cocktail.method || "Not specified"}</strong></div>
        <div><span>Rating</span><strong>{cocktail.rating ? `${cocktail.rating} / 5` : "Not rated"}</strong></div>
      </div>
      <p className="recipe-created">Saved {new Date(cocktail.createdAt).toLocaleDateString()}</p>
      <section className="recipe-detail-section">
        <h2>Ingredients</h2>
        {cocktail.ingredients.length ? (
          <ul className="recipe-ingredient-list">
            {cocktail.ingredients.map((ingredient) => (
              <li key={ingredient.ingredientId}>
                <span>{ingredient.name}</span><span>{ingredient.amount}</span>
              </li>
            ))}
          </ul>
        ) : <p className="recipe-muted">No ingredients added.</p>}
      </section>
      <section className="recipe-detail-section recipe-notes-section">
        <h2>Notes</h2>
        <p className="recipe-notes">{cocktail.notes || "—"}</p>
      </section>
    </article>
  );
}

type IngredientRow = { ingredientId: number | null; amount: string; query: string };

const emptyForm = {
  name: "",
  baseSpirit: "",
  glass: "",
  method: "",
  rating: 3,
  notes: "",
};

const baseSpirits = ["gin", "whiskey", "rum", "tequila", "vodka", "brandy", "other"];

function RecipeEditor({
  mode,
  id,
  navigate,
}: {
  mode: "create" | "edit";
  id?: number;
  navigate: (route: RecipeRoute) => void;
}) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [fields, setFields] = useState(emptyForm);
  const [rows, setRows] = useState<IngredientRow[]>([{ ingredientId: null, amount: "", query: "" }]);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [ingredientsError, setIngredientsError] = useState("");

  useEffect(() => {
    let alive = true;
    getIngredients().then((items) => {
      if (alive) setIngredients(items);
    }).catch((caught: unknown) => {
      if (alive) setIngredientsError(caught instanceof Error ? caught.message : "Ingredients could not be loaded.");
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (mode !== "edit" || id === undefined) return;
    let alive = true;
    getCocktail(id).then((cocktail) => {
      if (!alive) return;
      setFields({
        name: cocktail.name,
        baseSpirit: cocktail.baseSpirit,
        glass: cocktail.glass,
        method: cocktail.method,
        rating: cocktail.rating,
        notes: cocktail.notes,
      });
      setRows(cocktail.ingredients.length
        ? cocktail.ingredients.map((item) => ({
            ingredientId: item.ingredientId,
            amount: item.amount,
            query: item.name,
          }))
        : [{ ingredientId: null, amount: "", query: "" }]);
    }).catch((caught: unknown) => {
      if (alive) setLoadError(caught instanceof Error ? caught.message : "This recipe could not be loaded.");
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [mode, id]);

  function updateRow(index: number, patch: Partial<IngredientRow>) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  }

  function addRow() {
    setRows((current) => [...current, { ingredientId: null, amount: "", query: "" }]);
  }

  function removeRow(index: number) {
    setRows((current) => current.length === 1
      ? [{ ingredientId: null, amount: "", query: "" }]
      : current.filter((_, rowIndex) => rowIndex !== index));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const input: CocktailInput = {
      ...fields,
      rating: Number(fields.rating) || 0,
      ingredients: rows
        .filter((row): row is IngredientRow & { ingredientId: number } => row.ingredientId !== null)
        .map(({ ingredientId, amount }) => ({ ingredientId, amount: amount.trim() })),
    };
    setSaving(true);
    try {
      if (mode === "create") {
        const createdId = await createCocktail(input);
        navigate({ page: "detail", id: createdId });
      } else if (id !== undefined) {
        await updateCocktail(id, input);
        navigate({ page: "detail", id });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your recipe could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="recipe-skeleton recipe-form-skeleton" aria-label="Loading recipe" aria-live="polite"><span /><span /><span /><span /></div>;
  }
  if (loadError) {
    return (
      <div className="recipe-message recipe-error" role="alert">
        <button className="recipe-back-link recipe-back-button" type="button" onClick={() => navigate({ page: "list" })}>← My recipes</button>
        <p>{loadError}</p>
      </div>
    );
  }

  return (
    <section className="recipe-editor-page">
      <button className="recipe-back-link recipe-back-button" type="button" onClick={() => navigate(
        mode === "edit" && id !== undefined ? { page: "detail", id } : { page: "list" },
      )}>← {mode === "edit" ? "Recipe" : "My recipes"}</button>
      <div className="recipe-editor-heading">
        <p className="recipe-eyebrow">{mode === "edit" ? "MAKE IT YOUR OWN" : "SAVE A FAVORITE"}</p>
        <h1>{mode === "edit" ? "Edit recipe" : "Add a recipe"}</h1>
        <p>{mode === "edit" ? "Adjust the details for your home bar." : "Keep the details that make it worth making again."}</p>
      </div>
      <form className="recipe-form" onSubmit={(event) => void submit(event)}>
        <div className="recipe-form-grid">
          <label className="recipe-field recipe-field-wide">
            <span>Recipe name</span>
            <input
              autoFocus
              maxLength={160}
              onChange={(event) => setFields((current) => ({ ...current, name: event.target.value }))}
              placeholder="e.g. The Last Word"
              required
              value={fields.name}
            />
          </label>
          <label className="recipe-field">
            <span>Base spirit</span>
            <select required value={fields.baseSpirit} onChange={(event) => setFields((current) => ({ ...current, baseSpirit: event.target.value }))}>
              <option value="">Choose a spirit</option>
              {baseSpirits.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="recipe-field">
            <span>Glass</span>
            <input
              maxLength={100}
              onChange={(event) => setFields((current) => ({ ...current, glass: event.target.value }))}
              placeholder="e.g. Coupe"
              required
              value={fields.glass}
            />
          </label>
          <label className="recipe-field recipe-field-wide">
            <span>Method</span>
            <textarea
              maxLength={5000}
              onChange={(event) => setFields((current) => ({ ...current, method: event.target.value }))}
              placeholder="Describe how to make it"
              required
              rows={5}
              value={fields.method}
            />
          </label>
          <label className="recipe-field">
            <span>Rating</span>
            <select required value={fields.rating} onChange={(event) => setFields((current) => ({ ...current, rating: Number(event.target.value) }))}>
              {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} / 5</option>)}
            </select>
          </label>
        </div>
        <div className="recipe-form-section">
          <div className="recipe-section-heading">
            <div><h2>Ingredients</h2><p>Add each ingredient and its amount.</p></div>
            <button className="recipe-text-action" type="button" onClick={addRow}>Add ingredient <span aria-hidden="true">+</span></button>
          </div>
          {ingredientsError && <p className="recipe-inline-error" role="alert">{ingredientsError}</p>}
          {rows.map((row, index) => (
            <IngredientPicker
              key={index}
              index={index}
              row={row}
              ingredients={ingredients.filter((item) =>
                !rows.some((other, otherIndex) => otherIndex !== index && other.ingredientId === item.id),
              )}
              onChange={(patch) => updateRow(index, patch)}
              onRemove={() => removeRow(index)}
              canRemove={rows.length > 1 || Boolean(row.ingredientId || row.amount || row.query)}
            />
          ))}
        </div>
        <label className="recipe-field recipe-notes-field">
          <span>Notes <small>Optional</small></span>
          <textarea
            maxLength={5000}
            onChange={(event) => setFields((current) => ({ ...current, notes: event.target.value }))}
            placeholder="A small detail you want to remember…"
            rows={4}
            value={fields.notes}
          />
        </label>
        {error && <p className="recipe-inline-error" role="alert">{error}</p>}
        <div className="recipe-form-actions">
          <button className="recipe-primary-button" disabled={saving} type="submit">
            {saving ? "Saving…" : mode === "edit" ? "Save changes" : "Save recipe"}
          </button>
          <button className="recipe-cancel-button" type="button" onClick={() => navigate(
            mode === "edit" && id !== undefined ? { page: "detail", id } : { page: "list" },
          )}>Cancel</button>
        </div>
      </form>
    </section>
  );
}

function IngredientPicker({
  index,
  row,
  ingredients,
  onChange,
  onRemove,
  canRemove,
}: {
  index: number;
  row: IngredientRow;
  ingredients: Ingredient[];
  onChange: (patch: Partial<IngredientRow>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [open, setOpen] = useState(false);
  const filtered = ingredients.filter((item) =>
    item.name.toLowerCase().includes(row.query.trim().toLowerCase()),
  );
  const listId = `ingredient-options-${index}`;

  return (
    <div className="recipe-ingredient-editor">
      <div className="recipe-picker-wrap">
        <label className="recipe-field">
          <span className="sr-only">Ingredient {index + 1}</span>
          <input
            aria-autocomplete="list"
            aria-controls={listId}
            aria-expanded={open}
            autoComplete="off"
            onBlur={() => window.setTimeout(() => setOpen(false), 120)}
            onChange={(event) => {
              onChange({ query: event.target.value, ingredientId: null });
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false);
              if (event.key === "Enter" && open && filtered.length) {
                event.preventDefault();
                onChange({ ingredientId: filtered[0].id, query: filtered[0].name });
                setOpen(false);
              }
            }}
            placeholder="Search ingredients"
            role="combobox"
            required
            value={row.query}
          />
        </label>
        {open && (
          <ul className="recipe-ingredient-options" id={listId} role="listbox" aria-label="Ingredient options">
            {filtered.length ? filtered.slice(0, 8).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={row.ingredientId === item.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange({ ingredientId: item.id, query: item.name });
                    setOpen(false);
                  }}
                >
                  <span>{item.name}</span><small>{item.category}</small>
                </button>
              </li>
            )) : <li className="recipe-no-options">No matching ingredients</li>}
          </ul>
        )}
      </div>
      <label className="recipe-field recipe-amount-field">
        <span className="sr-only">Amount for ingredient {index + 1}</span>
        <input
          maxLength={80}
          onChange={(event) => onChange({ amount: event.target.value })}
          placeholder="Amount"
          required
          value={row.amount}
        />
      </label>
      <button
        aria-label={`Remove ingredient ${index + 1}`}
        className="recipe-remove-row"
        disabled={!canRemove}
        onClick={onRemove}
        type="button"
      >Remove</button>
    </div>
  );
}

export default RecipeApp;
