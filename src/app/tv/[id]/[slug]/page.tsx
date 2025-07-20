import React from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isValidId } from "@/lib/utils";
import TvPageData from "@/components/tv-page-data";

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
    description: `Explore detailed information about this show, including cast, crew, reviews, and more  about ${title}.`,
    openGraph: {
      type: "website",
      title: ` ${title} | Film Fanatic`,
      description: `Explore detailed information about this show, including cast, crew, reviews, and more  about ${title}.`,
    },
  };
}

export default async function TvSeriesDataPage({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) {
  if (!isValidId(Number((await params).id))) {
    notFound();
  }
  return <TvPageData params={await params} />;
}
