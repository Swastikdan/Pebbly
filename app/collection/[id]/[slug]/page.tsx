import type { Metadata } from "next";

import React, { Suspense } from "react";
import { notFound } from "next/navigation";
import { Spinner } from "@heroui/spinner";

import { formatMediaTitle, isValidId } from "@/lib/utils";
import { MovieCollectionsPage } from "@/components/movie-collentions-page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}): Promise<Metadata> {
  const { id, slug } = await params;

  if (!isValidId(Number(id))) {
    notFound();
  }
  const title = formatMediaTitle.decode(slug);

  return {
    title: `${title} | Film Fanatic`,
    description: `Browse ${title} on Film Fanatic.`,
  };
}
export default async function CollectionsPage({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) {
  const { id, slug } = await params;

  if (!isValidId(Number(id))) {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <div className="grid h-full min-h-screen place-content-center items-center justify-center">
          <Spinner color="current" />
        </div>
      }
    >
      <MovieCollectionsPage params={{ id, slug }} />
    </Suspense>
  );
}
