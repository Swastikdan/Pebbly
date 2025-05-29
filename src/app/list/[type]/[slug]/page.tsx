import { Suspense } from "react";
import type { Metadata } from "next";
import { MEDIA_PAGE_SLUGS, NAV_ITEMS } from "@/constants";
import MediaListPageResults from "@/components/media-list-page-results";
import { type MediaListQuery } from "@/types";
import { notFound } from "next/navigation";
import { MediaCardSkeleton } from "@/components/media-card";

export async function generateStaticParams() {
  return MEDIA_PAGE_SLUGS;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ type: string; slug: string }>;
}): Promise<Metadata> {
  const { type, slug } = await params;
  const navItem = NAV_ITEMS.find((item) => item.slug === type);
  const subNavItem = navItem
    ? navItem.submenu.find((item) => item.slug === slug)
    : null;
  return {
    title: `${subNavItem?.name} ${navItem?.name} | Film Fanatic`,
    description: `Browse ${subNavItem?.name} ${navItem?.name} | Film Fanatic`,
  };
}

export default async function MediaPage({
  params,
}: {
  params: Promise<{ type: string; slug: string }>;
}) {
  const { type, slug } = await params;
  const navItem = NAV_ITEMS.find((item) => item.slug === type);
  const subNavItem = navItem
    ? navItem.submenu.find((item) => item.slug === slug)
    : null;
  const query = (type + "_" + slug) as unknown as MediaListQuery["type"];
  if (!(type === "movies" || type === "tv-shows")) {
    return notFound();
  }
  const mediatype = type === "movies" ? "movie" : "tv";

  return (
    <section className="flex min-h-screen w-full justify-center">
      <div className="top-0 w-full max-w-screen-xl items-center justify-center p-5">
        <h1 className="text-start text-2xl font-bold md:text-3xl lg:text-4xl">
          {subNavItem?.name} {navItem?.name}
        </h1>

        <Suspense fallback={<MediaPageFallback />}>
          <MediaListPageResults query={query} mediatype={mediatype} />
        </Suspense>
      </div>
    </section>
  );
}

function MediaPageFallback() {
  return (
    <div className="flex min-h-96 w-full items-center justify-center">
      <div className="grid w-full grid-cols-2 items-center justify-center gap-5 py-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, index) => (
          <MediaCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}
