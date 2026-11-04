import { FormEvent, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ApiRequestError,
  Cocktail,
  CocktailFieldErrors,
  CocktailInput,
  CocktailSort,
  CocktailSummary,
  DashboardStats,
  MakeableCocktailSummary,
  IngredientRowFieldErrors,
  Ingredient,
  MyBarData,
  MyBarIngredient,
  createCocktail,
  deleteCocktail,
  getCocktail,
  getCocktails,
  getDashboardStats,
  getIngredients,
  getMyBar,
  setCocktailStar,
  setBarItem,
  updateCocktail,
} from "../recipeApi.js";
import "./recipes.css";

type RecipeRoute =
  | { page: "list"; starred?: boolean }
  | { page: "dashboard" }
  | { page: "myBar" }
  | { page: "new" }
  | { page: "detail"; id: number }
  | { page: "edit"; id: number };

type RecipeAppProps = {
  displayName: string;
  onLogout: () => Promise<void> | void;
};

function routeFromPath(pathname: string): RecipeRoute {
  if (pathname === "/starred" || pathname === "/starred/") return { page: "list", starred: true };
  if (pathname === "/dashboard" || pathname === "/dashboard/") return { page: "dashboard" };
  if (pathname === "/my-bar" || pathname === "/my-bar/") return { page: "myBar" };
  if (pathname === "/cocktails/new") return { page: "new" };
  const match = pathname.match(/^\/cocktails\/(\d+)(\/edit)?\/?$/);
  if (match) {
    const id = Number(match[1]);
    return match[2] ? { page: "edit", id } : { page: "detail", id };
  }
  return { page: "list" };
}

function recipePath(route: RecipeRoute): string {
  if (route.page === "list") return route.starred ? "/starred" : "/";
  if (route.page === "dashboard") return "/dashboard";
  if (route.page === "myBar") return "/my-bar";
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
        <nav className="recipe-header-nav" aria-label="Main navigation">
          <a
            aria-current={route.page === "dashboard" ? "page" : undefined}
            className={route.page === "dashboard" ? "is-active" : ""}
            href="/dashboard"
            onClick={(event) => handleLink(event, { page: "dashboard" })}
          >
            Dashboard
          </a>
          <a
            aria-current={route.page === "myBar" ? "page" : undefined}
            className={route.page === "myBar" ? "is-active" : ""}
            href="/my-bar"
            onClick={(event) => handleLink(event, { page: "myBar" })}
          >
            My Bar
          </a>
        </nav>
        <div className="recipe-account">
          <span>{displayName}&apos;s Bar</span>
          <button className="recipe-quiet-button" type="button" onClick={logout}>Log out</button>
        </div>
      </header>
      {logoutError && <p className="recipe-toast" role="alert">{logoutError}</p>}
      <main className="recipe-main">
        {route.page === "list" && (
          <RecipeList
            starredOnly={Boolean(route.starred)}
            navigate={navigate}
            handleLink={handleLink}
          />
        )}
        {route.page === "dashboard" && <DashboardPage />}
        {route.page === "myBar" && <MyBarPage navigate={navigate} handleLink={handleLink} />}
        {route.page === "detail" && (
          <RecipeDetail id={route.id} navigate={navigate} handleLink={handleLink} />
        )}
        {route.page === "new" && <RecipeEditor mode="create" navigate={navigate} />}
        {route.page === "edit" && <RecipeEditor mode="edit" id={route.id} navigate={navigate} />}
      </main>
    </div>
  );
}

function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setError("");
    setStats(null);
    getDashboardStats()
      .then((result) => { if (active) setStats(result); })
      .catch((caught: unknown) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : "The dashboard could not be loaded.");
        }
      });
    return () => { active = false; };
  }, [reloadKey]);

  const statCards = stats ? [
    { label: "Total recipes", value: String(stats.totalRecipes) },
    { label: "Average rating", value: stats.averageRating === null ? "—" : stats.averageRating.toFixed(1) },
    { label: "Starred recipes", value: String(stats.starredRecipes) },
    { label: "Can make now", value: String(stats.canMakeNow), accent: true },
  ] : [];

  return (
    <section className="recipe-dashboard-page" aria-labelledby="dashboard-heading">
      <div className="recipe-page-heading">
        <div>
          <p className="recipe-eyebrow">YOUR BAR AT A GLANCE</p>
          <h1 id="dashboard-heading">Dashboard</h1>
        </div>
      </div>
      {error ? (
        <div className="recipe-message recipe-error" role="alert">
          <p>{error}</p>
          <button
            className="recipe-text-action"
            type="button"
            onClick={() => setReloadKey((current) => current + 1)}
          >
            Try again
          </button>
        </div>
      ) : stats === null ? (
        <div className="recipe-skeleton dashboard-skeleton" aria-label="Loading dashboard" aria-live="polite">
          <span /><span /><span /><span />
        </div>
      ) : (
        <>
          <div className="dashboard-stat-grid">
            {statCards.map((card) => (
              <article className={`dashboard-stat-card${card.accent ? " is-accent" : ""}`} key={card.label}>
                <p>{card.label}</p>
                <strong>{card.value}</strong>
              </article>
            ))}
          </div>
          <section className="dashboard-chart-section" aria-labelledby="dashboard-chart-heading">
            <div className="dashboard-chart-heading">
              <h2 id="dashboard-chart-heading">Recipes by base spirit</h2>
            </div>
            <div className="dashboard-chart-frame">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.recipesByBaseSpirit} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="#ededea" vertical={false} />
                  <XAxis
                    axisLine={false}
                    dataKey="baseSpirit"
                    tick={{ fill: "#8a8a85", fontSize: 11 }}
                    tickFormatter={(value: string) => value.charAt(0).toUpperCase() + value.slice(1)}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tick={{ fill: "#8a8a85", fontSize: 11 }}
                    tickLine={false}
                    width={30}
                  />
                  <Tooltip
                    cursor={{ fill: "#f7f8f6" }}
                    contentStyle={{
                      border: "1px solid #ededea",
                      borderRadius: 4,
                      boxShadow: "none",
                      fontFamily: "Inter, sans-serif",
                      fontSize: 12,
                    }}
                    formatter={(value) => [`${value ?? 0} recipes`, "Recipes"]}
                    labelFormatter={(label) => {
                      const spirit = String(label ?? "");
                      return spirit.charAt(0).toUpperCase() + spirit.slice(1);
                    }}
                  />
                  <Bar dataKey="count" fill="#5f7361" maxBarSize={50} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}
    </section>
  );
}

const barCategoryOrder = ["spirit", "liqueur", "juice", "syrup", "bitters", "garnish", "other"] as const;

const barCategoryLabels: Record<(typeof barCategoryOrder)[number], string> = {
  spirit: "Spirit",
  liqueur: "Liqueur",
  juice: "Juice",
  syrup: "Syrup",
  bitters: "Bitters",
  garnish: "Garnish",
  other: "Other",
};

function MyBarPage({
  navigate,
  handleLink,
}: {
  navigate: (route: RecipeRoute) => void;
  handleLink: (event: React.MouseEvent<HTMLAnchorElement>, route: RecipeRoute) => void;
}) {
  const [barData, setBarData] = useState<MyBarData | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setError("");
    setBarData(null);
    getMyBar()
      .then((result) => { if (active) setBarData(result); })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Your bar could not be loaded.");
      });
    return () => { active = false; };
  }, [reloadKey]);

  async function toggleIngredient(ingredient: MyBarIngredient) {
    const inBar = !ingredient.inBar;
    setError("");
    setSaving(true);
    setBarData((current) => current && ({
      ...current,
      ingredients: current.ingredients.map((item) =>
        item.id === ingredient.id ? { ...item, inBar } : item,
      ),
    }));
    try {
      const result = await setBarItem(ingredient.id, inBar);
      setBarData((current) => current && ({
        ...current,
        makeableCocktails: result.makeableCocktails,
      }));
    } catch (caught) {
      setBarData((current) => current && ({
        ...current,
        ingredients: current.ingredients.map((item) =>
          item.id === ingredient.id ? { ...item, inBar: ingredient.inBar } : item,
        ),
      }));
      setError(caught instanceof Error ? caught.message : "Your bar could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  const filteredIngredients = (barData?.ingredients ?? []).filter((ingredient) =>
    ingredient.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const ingredientGroups = barCategoryOrder
    .map((category) => ({
      category,
      ingredients: filteredIngredients.filter((ingredient) => ingredient.category === category),
    }))
    .filter((group) => group.ingredients.length > 0);

  return (
    <section className="my-bar-page" aria-labelledby="my-bar-heading">
      <div className="recipe-page-heading">
        <div>
          <p className="recipe-eyebrow">YOUR HOME BAR</p>
          <h1 id="my-bar-heading">My Bar</h1>
        </div>
      </div>
      <label className="my-bar-search">
        <span className="sr-only">Search ingredients</span>
        <input
          type="search"
          placeholder="Search ingredients"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      {error && (
        <div className="recipe-message recipe-error" role="alert">
          <p>{error}</p>
          {barData === null && (
            <button
              className="recipe-text-action"
              type="button"
              onClick={() => setReloadKey((current) => current + 1)}
            >
              Try again
            </button>
          )}
        </div>
      )}
      {barData === null ? (
        <div className="recipe-skeleton my-bar-skeleton" aria-label="Loading ingredients" aria-live="polite">
          <span /><span /><span />
        </div>
      ) : (
        <>
          <div className="my-bar-categories">
            {ingredientGroups.map((group) => (
              <section className="my-bar-category" key={group.category} aria-labelledby={`bar-${group.category}-heading`}>
                <h2 id={`bar-${group.category}-heading`}>{barCategoryLabels[group.category]}</h2>
                <ul className="my-bar-ingredient-list">
                  {group.ingredients.map((ingredient) => (
                    <li key={ingredient.id}>
                      <label>
                        <input
                          checked={ingredient.inBar}
                          disabled={saving}
                          onChange={() => void toggleIngredient(ingredient)}
                          type="checkbox"
                        />
                        <span>{ingredient.name}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {filteredIngredients.length === 0 && (
              <p className="my-bar-no-results" role="status">No ingredients match that search.</p>
            )}
          </div>
          <section className="my-bar-makeable" aria-labelledby="makeable-heading">
            <div className="my-bar-makeable-heading">
              <div>
                <p className="recipe-eyebrow">USING WHAT YOU HAVE</p>
                <h2 id="makeable-heading">What can I make?</h2>
              </div>
              <p className="my-bar-makeable-count" aria-live="polite">
                You can make {barData.makeableCocktails.length} {barData.makeableCocktails.length === 1 ? "drink" : "drinks"}.
              </p>
            </div>
            {barData.makeableCocktails.length > 0 ? (
              <ul className="my-bar-recipe-list">
                {barData.makeableCocktails.map((cocktail: MakeableCocktailSummary) => (
                  <li key={cocktail.id}>
                    <a
                      href={`/cocktails/${cocktail.id}`}
                      onClick={(event) => handleLink(event, { page: "detail", id: cocktail.id })}
                    >
                      <span>
                        <strong>{cocktail.name}</strong>
                        <small>{cocktail.baseSpirit}</small>
                      </span>
                      <span className="my-bar-recipe-arrow" aria-hidden="true">↗</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="my-bar-empty">Add ingredients to your bar to see which recipes you can make.</p>
            )}
          </section>
        </>
      )}
    </section>
  );
}

function StarToggleButton({
  name,
  isStarred,
  disabled,
  className = "",
  onToggle,
}: {
  name: string;
  isStarred: boolean;
  disabled?: boolean;
  className?: string;
  onToggle: () => void;
}) {
  return (
    <button
      aria-label={`${isStarred ? "Remove" : "Add"} ${name} ${isStarred ? "from" : "to"} Starred`}
      aria-pressed={isStarred}
      className={`recipe-star-toggle${isStarred ? " is-starred" : ""}${className ? ` ${className}` : ""}`}
      disabled={disabled}
      onClick={onToggle}
      type="button"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="m12 3.6 2.55 5.17 5.7.83-4.12 4.02.97 5.68L12 16.62l-5.1 2.68.97-5.68-4.12-4.02 5.7-.83L12 3.6Z" />
      </svg>
    </button>
  );
}

function RecipeList({
  navigate,
  handleLink,
  starredOnly,
}: {
  navigate: (route: RecipeRoute) => void;
  handleLink: (event: React.MouseEvent<HTMLAnchorElement>, route: RecipeRoute) => void;
  starredOnly: boolean;
}) {
  const [recipes, setRecipes] = useState<CocktailSummary[] | null>(null);
  const [error, setError] = useState("");
  const [starError, setStarError] = useState("");
  const [pendingStarIds, setPendingStarIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [baseSpirit, setBaseSpirit] = useState("all");
  const [sort, setSort] = useState<CocktailSort>("newest");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setError("");
    setRecipes(null);
    getCocktails({ starredOnly, search, baseSpirit, sort })
      .then((items) => { if (active) setRecipes(items); })
      .catch((caught: unknown) => {
        if (active) {
          setError(caught instanceof Error
            ? caught.message
            : starredOnly ? "Your starred recipes could not be loaded." : "Your recipes could not be loaded.");
        }
      });
    return () => { active = false; };
  }, [starredOnly, search, baseSpirit, sort, reloadKey]);

  async function toggleStar(recipe: CocktailSummary) {
    const isStarred = !recipe.isStarred;
    setStarError("");
    setPendingStarIds((current) => new Set(current).add(recipe.id));
    try {
      await setCocktailStar(recipe.id, isStarred);
      setRecipes((current) => {
        if (!current) return current;
        if (starredOnly && !isStarred) return current.filter((item) => item.id !== recipe.id);
        return current.map((item) => item.id === recipe.id ? { ...item, isStarred } : item);
      });
    } catch (caught) {
      setStarError(caught instanceof Error ? caught.message : "This recipe could not be updated.");
    } finally {
      setPendingStarIds((current) => {
        const next = new Set(current);
        next.delete(recipe.id);
        return next;
      });
    }
  }

  const hasActiveFilters = Boolean(search.trim()) || baseSpirit !== "all";

  return (
    <section className="recipe-list-page" aria-labelledby="list-heading">
      <div className="recipe-page-heading">
        <div>
          <p className="recipe-eyebrow">YOUR PERSONAL RECIPE BOX</p>
          <div className="recipe-title-tabs">
            <h1 id="list-heading">{starredOnly ? "Starred" : "My recipes"}</h1>
            <nav className="recipe-view-tabs" aria-label="Recipe views">
              <a
                aria-current={!starredOnly ? "page" : undefined}
                className={!starredOnly ? "recipe-view-tab is-active" : "recipe-view-tab"}
                href="/"
                onClick={(event) => handleLink(event, { page: "list" })}
              >
                My recipes
              </a>
              <a
                aria-current={starredOnly ? "page" : undefined}
                className={starredOnly ? "recipe-view-tab is-active" : "recipe-view-tab"}
                href="/starred"
                onClick={(event) => handleLink(event, { page: "list", starred: true })}
              >
                Starred
              </a>
            </nav>
          </div>
        </div>
        <a
          className="recipe-primary-link"
          href="/cocktails/new"
          onClick={(event) => handleLink(event, { page: "new" })}
        >
            Add recipe <span aria-hidden="true">+</span>
        </a>
      </div>
      <div className="recipe-filters">
        <label className="recipe-search-control">
          <span className="sr-only">Search by recipe or ingredient</span>
          <input
            type="search"
            placeholder="Search recipes or ingredients"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="recipe-filter-control">
          <span className="sr-only">Filter by base spirit</span>
          <select value={baseSpirit} onChange={(event) => setBaseSpirit(event.target.value)}>
            <option value="all">All</option>
            {baseSpirits.map((spirit) => <option key={spirit} value={spirit}>{spirit}</option>)}
          </select>
        </label>
        <label className="recipe-filter-control">
          <span className="sr-only">Sort recipes</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as CocktailSort)}>
            <option value="newest">Newest first</option>
            <option value="rating">Highest rated</option>
            <option value="name">A–Z</option>
          </select>
        </label>
      </div>
      {error ? (
        <div className="recipe-message recipe-error" role="alert">
          <p>{error}</p>
          <button type="button" className="recipe-text-action" onClick={() => setReloadKey((current) => current + 1)}>Try again</button>
        </div>
      ) : recipes === null ? (
        <div className="recipe-skeleton" aria-label="Loading recipes" aria-live="polite">
          <span /><span /><span />
        </div>
      ) : (
        <>
          <p className="recipe-result-count" aria-live="polite">
            {recipes.length} {recipes.length === 1 ? "recipe" : "recipes"}
          </p>
          {recipes.length === 0 ? (
            hasActiveFilters ? (
              <p className="recipe-no-results" role="status">No recipes match. Try a different search.</p>
            ) : starredOnly ? (
              <div className="recipe-empty">
                <span className="recipe-empty-mark" aria-hidden="true">☆</span>
                <h2>Nothing starred yet.</h2>
                <p>Star a recipe to keep it here.</p>
              </div>
            ) : (
              <div className="recipe-empty">
                <span className="recipe-empty-mark" aria-hidden="true">+</span>
                <h2>A good place to start.</h2>
                <p>Save a drink you’ve enjoyed, and keep the recipe close for next time.</p>
                <button className="recipe-primary-button" type="button" onClick={() => navigate({ page: "new" })}>
                  Add recipe
                </button>
              </div>
            )
          ) : (
            <div className="recipe-table" role="list" aria-label={starredOnly ? "Your starred recipes" : "Your cocktail recipes"}>
              {recipes.map((recipe) => (
                <div className="recipe-row" key={recipe.id} role="listitem">
                  <a
                    className="recipe-row-link"
                    href={`/cocktails/${recipe.id}`}
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
                  <StarToggleButton
                    className="recipe-row-star"
                    disabled={pendingStarIds.has(recipe.id)}
                    isStarred={recipe.isStarred}
                    name={recipe.name}
                    onToggle={() => void toggleStar(recipe)}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {starError && <p className="recipe-inline-error" role="alert">{starError}</p>}
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
  const [starSaving, setStarSaving] = useState(false);
  const [starError, setStarError] = useState("");

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

  async function toggleStar() {
    if (!cocktail || starSaving) return;
    const isStarred = !cocktail.isStarred;
    setStarSaving(true);
    setStarError("");
    try {
      await setCocktailStar(id, isStarred);
      setCocktail((current) => current ? { ...current, isStarred } : current);
    } catch (caught) {
      setStarError(caught instanceof Error ? caught.message : "This recipe could not be updated.");
    } finally {
      setStarSaving(false);
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
          <StarToggleButton
            className="recipe-detail-star"
            disabled={starSaving}
            isStarred={cocktail.isStarred}
            name={cocktail.name}
            onToggle={() => void toggleStar()}
          />
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
      {starError && <p className="recipe-inline-error" role="alert">{starError}</p>}
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

type RecipeFormFields = {
  name: string;
  baseSpirit: string;
  glass: string;
  method: string;
  rating: number | "";
  notes: string;
};

const emptyForm: RecipeFormFields = {
  name: "",
  baseSpirit: "",
  glass: "",
  method: "",
  rating: "",
  notes: "",
};

const baseSpirits = ["gin", "whiskey", "rum", "tequila", "vodka", "brandy", "other"];

function validateRecipe(
  fields: RecipeFormFields,
  rows: IngredientRow[],
  ingredients: Ingredient[],
): CocktailFieldErrors {
  const errors: CocktailFieldErrors = {};
  const rowErrors: IngredientRowFieldErrors[] = Array.from({ length: rows.length }, () => ({}));
  const ingredientIds = new Set<number>();

  if (!fields.name.trim()) errors.name = "Give your drink a name";
  else if (fields.name.trim().length > 160) errors.name = "Use 160 characters or fewer";
  if (!baseSpirits.includes(fields.baseSpirit)) errors.baseSpirit = "Pick a base spirit";
  if (!fields.glass.trim()) errors.glass = "Choose a glass";
  else if (fields.glass.trim().length > 100) errors.glass = "Use 100 characters or fewer";
  if (!fields.method.trim()) errors.method = "Add a method";
  if (!Number.isInteger(Number(fields.rating)) || Number(fields.rating) < 1 || Number(fields.rating) > 5) {
    errors.rating = "Choose a rating from 1 to 5";
  }
  if (fields.notes.length > 5000) errors.notes = "Use 5,000 characters or fewer";

  let selectedCount = 0;
  rows.forEach((row, index) => {
    const ingredientId = row.ingredientId;
    const hasIngredient = ingredientId !== null && ingredientId > 0;
    const hasAmount = row.amount.trim().length > 0;
    const hasQuery = row.query.trim().length > 0;
    if (!hasIngredient && !hasAmount && !hasQuery) return;

    if (ingredientId === null || ingredientId <= 0) {
      rowErrors[index].ingredientId = "Choose an ingredient";
      return;
    }

    selectedCount += 1;
    if (!ingredients.some((ingredient) => ingredient.id === ingredientId)) {
      rowErrors[index].ingredientId = "Choose an ingredient from the list";
    }
    if (ingredientIds.has(ingredientId)) {
      rowErrors[index].ingredientId = "This ingredient is already listed";
    }
    ingredientIds.add(ingredientId);
    if (!hasAmount) rowErrors[index].amount = "Enter an amount";
    else if (row.amount.trim().length > 100) rowErrors[index].amount = "Use 100 characters or fewer";
  });

  if (!selectedCount) errors.ingredients = "Add at least one ingredient";
  else if (selectedCount > 50) errors.ingredients = "Add no more than 50 ingredients";
  if (rowErrors.some((rowError) => rowError.ingredientId || rowError.amount)) {
    errors.ingredientRows = rowErrors;
  }
  return errors;
}

function hasRecipeErrors(errors: CocktailFieldErrors): boolean {
  return Boolean(
    errors.name ||
    errors.baseSpirit ||
    errors.glass ||
    errors.method ||
    errors.rating ||
    errors.notes ||
    errors.ingredients ||
    errors.ingredientRows?.some((rowError) => rowError?.ingredientId || rowError?.amount),
  );
}

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
  const [fieldErrors, setFieldErrors] = useState<CocktailFieldErrors>({});
  const [hasSubmitted, setHasSubmitted] = useState(false);

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

  function updateField<K extends keyof RecipeFormFields>(field: K, value: RecipeFormFields[K]) {
    const nextFields = { ...fields, [field]: value } as RecipeFormFields;
    setFields(nextFields);
    setError("");
    if (hasSubmitted) setFieldErrors(validateRecipe(nextFields, rows, ingredients));
  }

  function updateRow(index: number, patch: Partial<IngredientRow>) {
    const nextRows = rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row);
    setRows(nextRows);
    if (hasSubmitted) setFieldErrors(validateRecipe(fields, nextRows, ingredients));
  }

  function addRow() {
    const nextRows = [...rows, { ingredientId: null, amount: "", query: "" }];
    setRows(nextRows);
    if (hasSubmitted) setFieldErrors(validateRecipe(fields, nextRows, ingredients));
  }

  function removeRow(index: number) {
    const nextRows = rows.length === 1
      ? [{ ingredientId: null, amount: "", query: "" }]
      : rows.filter((_, rowIndex) => rowIndex !== index);
    setRows(nextRows);
    if (hasSubmitted) setFieldErrors(validateRecipe(fields, nextRows, ingredients));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setHasSubmitted(true);
    const clientErrors = validateRecipe(fields, rows, ingredients);
    setFieldErrors(clientErrors);
    if (hasRecipeErrors(clientErrors)) return;

    const input: CocktailInput = {
      ...fields,
      rating: Number(fields.rating),
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
      if (caught instanceof ApiRequestError && caught.fieldErrors) {
        setFieldErrors(caught.fieldErrors);
      } else {
        setError(caught instanceof Error ? caught.message : "Your recipe could not be saved.");
      }
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
      <form className="recipe-form" noValidate onSubmit={(event) => void submit(event)}>
        <div className="recipe-form-grid">
          <label className="recipe-field recipe-field-wide">
            <span>Recipe name</span>
            <input
              aria-describedby={fieldErrors.name ? "recipe-name-error" : undefined}
              aria-invalid={Boolean(fieldErrors.name)}
              autoFocus
              maxLength={160}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="e.g. The Last Word"
              required
              value={fields.name}
            />
            {fieldErrors.name && <small className="recipe-validation-message" id="recipe-name-error">{fieldErrors.name}</small>}
          </label>
          <label className="recipe-field">
            <span>Base spirit</span>
            <select
              aria-describedby={fieldErrors.baseSpirit ? "recipe-base-spirit-error" : undefined}
              aria-invalid={Boolean(fieldErrors.baseSpirit)}
              required
              value={fields.baseSpirit}
              onChange={(event) => updateField("baseSpirit", event.target.value)}
            >
              <option value="">Choose a spirit</option>
              {baseSpirits.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            {fieldErrors.baseSpirit && <small className="recipe-validation-message" id="recipe-base-spirit-error">{fieldErrors.baseSpirit}</small>}
          </label>
          <label className="recipe-field">
            <span>Glass</span>
            <input
              aria-describedby={fieldErrors.glass ? "recipe-glass-error" : undefined}
              aria-invalid={Boolean(fieldErrors.glass)}
              maxLength={100}
              onChange={(event) => updateField("glass", event.target.value)}
              placeholder="e.g. Coupe"
              required
              value={fields.glass}
            />
            {fieldErrors.glass && <small className="recipe-validation-message" id="recipe-glass-error">{fieldErrors.glass}</small>}
          </label>
          <label className="recipe-field recipe-field-wide">
            <span>Method</span>
            <textarea
              aria-describedby={fieldErrors.method ? "recipe-method-error" : undefined}
              aria-invalid={Boolean(fieldErrors.method)}
              maxLength={5000}
              onChange={(event) => updateField("method", event.target.value)}
              placeholder="Describe how to make it"
              required
              rows={5}
              value={fields.method}
            />
            {fieldErrors.method && <small className="recipe-validation-message" id="recipe-method-error">{fieldErrors.method}</small>}
          </label>
          <label className="recipe-field">
            <span>Rating</span>
            <select
              aria-describedby={fieldErrors.rating ? "recipe-rating-error" : undefined}
              aria-invalid={Boolean(fieldErrors.rating)}
              required
              value={fields.rating}
              onChange={(event) => updateField("rating", event.target.value === "" ? "" : Number(event.target.value))}
            >
              <option value="">Choose a rating</option>
              {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} / 5</option>)}
            </select>
            {fieldErrors.rating && <small className="recipe-validation-message" id="recipe-rating-error">{fieldErrors.rating}</small>}
          </label>
        </div>
        <div className="recipe-form-section">
          <div className="recipe-section-heading">
            <div><h2>Ingredients</h2><p>Add each ingredient and its amount.</p></div>
            <button className="recipe-text-action" type="button" onClick={addRow}>Add ingredient <span aria-hidden="true">+</span></button>
          </div>
          {ingredientsError && <p className="recipe-inline-error" role="alert">{ingredientsError}</p>}
          {fieldErrors.ingredients && <p className="recipe-validation-message" id="recipe-ingredients-error">{fieldErrors.ingredients}</p>}
          {rows.map((row, index) => (
            <IngredientPicker
              key={index}
              fieldErrors={fieldErrors.ingredientRows?.[index]}
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
            aria-describedby={fieldErrors.notes ? "recipe-notes-error" : undefined}
            aria-invalid={Boolean(fieldErrors.notes)}
            maxLength={5000}
            onChange={(event) => updateField("notes", event.target.value)}
            placeholder="A small detail you want to remember…"
            rows={4}
            value={fields.notes}
          />
          {fieldErrors.notes && <small className="recipe-validation-message" id="recipe-notes-error">{fieldErrors.notes}</small>}
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
  fieldErrors,
  onChange,
  onRemove,
  canRemove,
}: {
  index: number;
  row: IngredientRow;
  ingredients: Ingredient[];
  fieldErrors?: IngredientRowFieldErrors;
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
            aria-describedby={fieldErrors?.ingredientId ? `ingredient-error-${index}` : undefined}
            aria-expanded={open}
            aria-invalid={Boolean(fieldErrors?.ingredientId)}
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
          {fieldErrors?.ingredientId && (
            <small className="recipe-validation-message" id={`ingredient-error-${index}`}>{fieldErrors.ingredientId}</small>
          )}
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
          aria-describedby={fieldErrors?.amount ? `amount-error-${index}` : undefined}
          aria-invalid={Boolean(fieldErrors?.amount)}
          maxLength={100}
          onChange={(event) => onChange({ amount: event.target.value })}
          placeholder="Amount"
          required
          value={row.amount}
        />
        {fieldErrors?.amount && (
          <small className="recipe-validation-message" id={`amount-error-${index}`}>{fieldErrors.amount}</small>
        )}
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
