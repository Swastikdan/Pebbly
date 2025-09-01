import type { Metadata } from "next";

import { notFound } from "next/navigation";
import React from "react";

import { GoBack } from "@/components/go-back";
import { SeasonContainer } from "@/components/media/season-container";
import { ShareButton } from "@/components/share-button";
import { formatMediaTitle } from "@/lib/utils";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}): Promise<Metadata> {
  const title = formatMediaTitle.decode((await params).slug);

  return {
    title: `${title} - Seasons`,
    description: `All seasons of ${title}`,
  };
}

export default async function TvSeasonsPage({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) {
  const { id, slug } = await params;

  if (!id) {
    return notFound();
  }
  const title = formatMediaTitle.decode(slug);

  return (
    <section className="mx-auto block min-h-[90vh] max-w-screen-xl items-center px-4">
      <div className="space-y-3 py-5">
        <div className="flex items-center justify-between">
          <GoBack link={`/tv/${id}/${slug}`} title="Back to main" />
          <ShareButton />
        </div>
        <h1 className="text-[19px] font-bold sm:text-xl md:text-2xl lg:px-0 lg:text-3xl">
          {title}
        </h1>
      </div>
      <SeasonContainer id={id} tv_id_param={parseInt(id)} urltitle={slug} />
    </section>
  );
}
