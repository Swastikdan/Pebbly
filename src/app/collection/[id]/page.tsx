import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { isValidId } from "@/lib/utils";
import MediaCollection from "@/components/media/media-collection";

export const metadata: Metadata = {
  title: "Movie Collection | Film Fanatic",
  description: "Browse a vast collection of movies on Film Fanatic.",
};
export default async function CollectionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isValidId(Number(id))) {
    notFound();
  }
  return <MediaCollection id={id} />;
}
