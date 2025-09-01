import type { Metadata } from "next";

import { notFound } from "next/navigation";

import { GoBack } from "@/components/go-back";
import { ShareButton } from "@/components/share-button";
import { MediaCreditSection } from "@/components/media-credit-section";
import { formatMediaTitle } from "@/lib/utils";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}): Promise<Metadata> {
  const title = formatMediaTitle.decode((await params).slug);

  return {
    title: `${title} - Cast & Crew`,
    description: `Explore the cast and crew of ${title}`,
  };
}

export default async function CastCrewPage({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) {
  const { id, slug } = await params;

  if (!id) {
    return notFound();
  }
  const title = formatMediaTitle.decode((await params).slug);

  return (
    <section className="mx-auto block max-w-screen-xl items-center px-4">
      <div className="space-y-3 py-5">
        <div className="flex items-center justify-between">
          <GoBack link={`/movie/${id}/${slug}`} title="Back to main" />
          <ShareButton />
        </div>
        <h1 className="text-[19px] font-bold sm:text-xl md:text-2xl lg:px-0 lg:text-3xl">
          {title}
        </h1>
      </div>
      <MediaCreditSection id={Number(id)} type="movie" />
    </section>
  );
}
