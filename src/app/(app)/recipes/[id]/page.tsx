import RecipeDetail from "./RecipeDetail";

// Deliberately a thin shell with no server-side data fetching: the route then
// renders from the service worker's cached payload when offline, and
// RecipeDetail fills it in from the local cookbook cache.
export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RecipeDetail recipeId={id} />;
}
