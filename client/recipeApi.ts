export type Ingredient = {
  id: number;
  name: string;
  category: string;
};

export type CocktailIngredient = {
  ingredientId: number;
  name: string;
  amount: string;
};

export type CocktailSummary = {
  id: number;
  name: string;
  baseSpirit: string;
  rating: number;
  isStarred: boolean;
  ingredients: Array<{ ingredientId: number; name: string }>;
};

export type Cocktail = {
  id: number;
  name: string;
  baseSpirit: string;
  glass: string;
  method: string;
  rating: number;
  notes: string;
  createdAt: string;
  isStarred: boolean;
  ingredients: CocktailIngredient[];
};

export type CocktailInput = {
  name: string;
  baseSpirit: string;
  glass: string;
  method: string;
  rating: number;
  notes: string;
  ingredients: Array<{ ingredientId: number; amount: string }>;
};

export type IngredientRowFieldErrors = {
  ingredientId?: string;
  amount?: string;
};

export type CocktailFieldErrors = {
  name?: string;
  baseSpirit?: string;
  glass?: string;
  method?: string;
  rating?: string;
  notes?: string;
  ingredients?: string;
  ingredientRows?: IngredientRowFieldErrors[];
};

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly fieldErrors?: CocktailFieldErrors,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      fieldErrors?: CocktailFieldErrors;
    };
    throw new ApiRequestError(
      payload.error ?? "Something went wrong. Please try again.",
      payload.fieldErrors,
      response.status,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function getCocktails(starredOnly = false): Promise<CocktailSummary[]> {
  const path = starredOnly ? "/api/cocktails?starred=true" : "/api/cocktails";
  const result = await apiRequest<{ cocktails: CocktailSummary[] }>(path);
  return result.cocktails;
}

export async function getCocktail(id: number): Promise<Cocktail> {
  const result = await apiRequest<{ cocktail: Cocktail }>(`/api/cocktails/${id}`);
  return result.cocktail;
}

export async function getIngredients(): Promise<Ingredient[]> {
  const result = await apiRequest<{ ingredients: Ingredient[] }>("/api/ingredients");
  return result.ingredients;
}

export async function createCocktail(input: CocktailInput): Promise<number> {
  const result = await apiRequest<{ cocktail: { id: number } }>("/api/cocktails", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return result.cocktail.id;
}

export async function updateCocktail(id: number, input: CocktailInput): Promise<void> {
  await apiRequest(`/api/cocktails/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function deleteCocktail(id: number): Promise<void> {
  await apiRequest(`/api/cocktails/${id}`, { method: "DELETE" });
}

export async function setCocktailStar(id: number, isStarred: boolean): Promise<void> {
  await apiRequest(`/api/cocktails/${id}/star`, {
    method: "PUT",
    body: JSON.stringify({ isStarred }),
  });
}
