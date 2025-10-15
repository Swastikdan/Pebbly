import { createFileRoute, notFound } from "@tanstack/react-router";
import { z } from "zod";
import { MediaListPageResults } from "@/components/media-list-page-results";
import { MEDIA_PAGE_SLUGS, SITE_CONFIG } from "@/constants";
import type { MediaListQuery } from "@/types";

const NAV_ITEMS = SITE_CONFIG.navItems;

const listPageSearchSchema = z.object({
  page: z.number().optional(),
});

export const Route = createFileRoute("/list/$type/$slug")({
  validateSearch: listPageSearchSchema,
  loader: async ({ params }) => {
    const { type, slug } = params;

    const isValidSlug = MEDIA_PAGE_SLUGS.some(
      (item) => item.type === type && item.slug === slug,
    );

    if (!isValidSlug) {
      throw notFound();
    }

    const navItem = NAV_ITEMS.find((item) => item.slug === type);
    const subNavItem = navItem?.submenu.find((item) => item.slug === slug);

    if (!navItem || !subNavItem) {
      throw notFound();
    }

    const mediatype = type === "movies" ? "movie" : "tv";
    const query = `${type}_${slug}` as MediaListQuery["type"];

    return { navItem, subNavItem, mediatype, query };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: `${loaderData?.subNavItem?.name} ${loaderData?.navItem?.name} | Film Fanatic`,
      },
      {
        name: "description",
        content: `Browse ${loaderData?.subNavItem?.name} ${loaderData?.navItem?.name} | Film Fanatic`,
      },
    ],
  }),
  component: MediaListPage,
});

function MediaListPage() {
  const loaderData = Route.useLoaderData();
  return (
    <section className="flex min-h-screen w-full justify-center">
      <div className="top-0 w-full max-w-screen-xl items-center justify-center p-5">
        <h1 className="text-start font-bold text-2xl md:text-3xl lg:text-4xl">
          {loaderData.subNavItem.name} {loaderData.navItem.name}
        </h1>

        <MediaListPageResults
          mediatype={loaderData.mediatype as "movie" | "tv"}
          query={loaderData.query}
        />
      </div>
    </section>
  );
}
