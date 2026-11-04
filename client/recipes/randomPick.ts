export function pickRandomMakeable<T extends { id: number }>(
  recipes: readonly T[],
  previousId: number | null,
  random: () => number = Math.random,
): T | null {
  if (recipes.length === 0) return null;

  const previousIsAvailable = previousId !== null && recipes.some((recipe) => recipe.id === previousId);
  const candidates = recipes.length > 1 && previousIsAvailable
    ? recipes.filter((recipe) => recipe.id !== previousId)
    : recipes;
  const randomValue = random();
  const index = Number.isFinite(randomValue)
    ? Math.max(0, Math.min(candidates.length - 1, Math.floor(randomValue * candidates.length)))
    : 0;
  return candidates[index] ?? null;
}
