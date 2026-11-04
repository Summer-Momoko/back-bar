import { db, pool } from "../db/index.js";
import { ingredients } from "../db/schema.js";

const catalog: Array<{ name: string; category: string }> = [
  { name: "Gin", category: "spirit" },
  { name: "London dry gin", category: "spirit" },
  { name: "Old Tom gin", category: "spirit" },
  { name: "Vodka", category: "spirit" },
  { name: "Bourbon", category: "spirit" },
  { name: "Rye whiskey", category: "spirit" },
  { name: "Scotch whisky", category: "spirit" },
  { name: "Irish whiskey", category: "spirit" },
  { name: "White rum", category: "spirit" },
  { name: "Dark rum", category: "spirit" },
  { name: "Aged rum", category: "spirit" },
  { name: "Tequila blanco", category: "spirit" },
  { name: "Tequila reposado", category: "spirit" },
  { name: "Mezcal", category: "spirit" },
  { name: "Brandy", category: "spirit" },
  { name: "Cognac", category: "spirit" },
  { name: "Dry vermouth", category: "liqueur" },
  { name: "Sweet vermouth", category: "liqueur" },
  { name: "Campari", category: "liqueur" },
  { name: "Aperol", category: "liqueur" },
  { name: "Coffee liqueur", category: "liqueur" },
  { name: "Triple sec", category: "liqueur" },
  { name: "Cointreau", category: "liqueur" },
  { name: "Maraschino liqueur", category: "liqueur" },
  { name: "Amaretto", category: "liqueur" },
  { name: "Elderflower liqueur", category: "liqueur" },
  { name: "Orange liqueur", category: "liqueur" },
  { name: "Espresso", category: "other" },
  { name: "Cold brew coffee", category: "other" },
  { name: "Simple syrup", category: "syrup" },
  { name: "Rich simple syrup", category: "syrup" },
  { name: "Honey syrup", category: "syrup" },
  { name: "Agave syrup", category: "syrup" },
  { name: "Grenadine", category: "syrup" },
  { name: "Lemon juice", category: "juice" },
  { name: "Lime juice", category: "juice" },
  { name: "Orange juice", category: "juice" },
  { name: "Grapefruit juice", category: "juice" },
  { name: "Pineapple juice", category: "juice" },
  { name: "Cranberry juice", category: "juice" },
  { name: "Egg white", category: "other" },
  { name: "Angostura bitters", category: "bitters" },
  { name: "Orange bitters", category: "bitters" },
  { name: "Peychaud's bitters", category: "bitters" },
  { name: "Celery bitters", category: "bitters" },
  { name: "Orange peel", category: "garnish" },
  { name: "Lemon twist", category: "garnish" },
  { name: "Lime wheel", category: "garnish" },
  { name: "Olive", category: "garnish" },
  { name: "Cocktail cherry", category: "garnish" },
  { name: "Coffee beans", category: "garnish" },
  { name: "Mint", category: "garnish" },
  { name: "Club soda", category: "other" },
  { name: "Tonic water", category: "other" },
  { name: "Ginger beer", category: "other" },
  { name: "Cola", category: "other" },
  { name: "Coconut cream", category: "other" },
  { name: "Salt", category: "other" },
  { name: "Black pepper", category: "other" },
];

async function seed() {
  await db.insert(ingredients).values(catalog).onConflictDoNothing({ target: ingredients.name });
  console.log(`Ingredient catalog ready (${catalog.length} common ingredients).`);
}

seed()
  .catch((error) => {
    console.error("Ingredient seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
