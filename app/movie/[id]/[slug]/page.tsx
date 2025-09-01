import type { Metadata } from "next";

import React, { Suspense } from "react";
import { notFound } from "next/navigation";
import { Spinner } from "@heroui/spinner";

import { formatMediaTitle, isValidId } from "@/lib/utils";
import { env } from "@/env";
import { MoviePagedata } from "@/components/movie-page-data";

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
    <Suspense
      fallback={
        <div className="grid h-full min-h-screen place-content-center items-center justify-center">
          <Spinner color="current" />
        </div>
      }
    >
      <MoviePagedata params={await params} />
    </Suspense>
  );
}
