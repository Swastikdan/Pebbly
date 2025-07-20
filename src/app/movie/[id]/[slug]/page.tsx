import React, { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MoviePagedata from "@/components/movie-page-data";
import { isValidId } from "@/lib/utils";
import { env } from "@/env";
import { Spinner } from "@/components/ui/spinner";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}): Promise<Metadata> {
  const { id, slug } = await params;
  if (!isValidId(Number(id))) {
    notFound();
  }
  const title = decodeURIComponent(slug)
    .replace(/-/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());

  return {
    title: `${title} | Film Fanatic`,
    description: `Explore detailed information about this movie, including cast, crew, reviews, and more  about ${title}.`,
    openGraph: {
      type: "website",
      title: ` ${title} | Film Fanatic`,
      description: `Explore detailed information about this movie, including cast, crew, reviews, and more  about ${title}.`,
      images: [
        {
          url: `${env.NEXT_PUBLIC_APP_URL}/api/metaimage?id=${encodeURIComponent(id)}&type=movie`,
          width: 300,
          height: 450,
        },
      ],
    },
  };
}
export default async function page({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) {
  if (!isValidId(Number((await params).id))) {
    notFound();
  }
  return (
    <Suspense fallback={<Spinner />}>
      <MoviePagedata params={await params} />
    </Suspense>
  );
}
