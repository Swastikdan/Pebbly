import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MoviePagedata from "@/components/movie-page-data";
import { isValidId } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}): Promise<Metadata> {
  if (!isValidId(Number((await params).id))) {
    notFound();
  }
  const title = decodeURIComponent((await params).slug)
    .replace(/-/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());

  return {
    title: `${title} | Film Fanatic`,
    description: `Explore detailed information about this movie, including cast, crew, reviews, and more  about ${title}.`,
    openGraph: {
      type: "website",
      title: ` ${title} | Film Fanatic`,
      description: `Explore detailed information about this movie, including cast, crew, reviews, and more  about ${title}.`,
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
  return <MoviePagedata params={await params} />;
}
