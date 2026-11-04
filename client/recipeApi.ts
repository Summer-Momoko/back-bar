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

async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "Something went wrong. Please try again.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function getCocktails(): Promise<CocktailSummary[]> {
  const result = await apiRequest<{ cocktails: CocktailSummary[] }>("/api/cocktails");
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
