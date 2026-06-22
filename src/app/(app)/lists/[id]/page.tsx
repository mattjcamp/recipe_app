import ListDetail from "../ListDetail";

export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ListDetail listId={id} backHref="/family/lists" />;
}
