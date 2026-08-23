import { createFileRoute, notFound } from "@tanstack/react-router";

import { CollectionPage } from "@/components/watchlist/collection-page";
import { queryKeys } from "@/lib/query/keys";
import { getCollectionPage } from "@/server/fns/lists";
import { ApiError } from "@/server/schema/common";

export const Route = createFileRoute("/c/$id/{-$slug}")({
  // Resolves owner vs public per request: owners get their editable view,
  // everyone else only ever sees public lists (private ones 404 without
  // revealing existence).
  loader: async ({ params, context }) => {
    const payload = await context.queryClient
      .ensureQueryData({
        queryKey: queryKeys.lists.collectionPage(params.id),
        queryFn: async () => {
          const res = await getCollectionPage({ data: { listId: params.id } });
          if (!res.ok) throw new ApiError(res.code, res.message);
          return res.data;
        },
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.code === "NOT_FOUND") {
          throw notFound();
        }
        throw error;
      });

    return {
      listId: params.id,
      title: payload.list.name,
      description: payload.list.description ?? undefined,
    };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.title
          ? `${loaderData.title} | Pebbly`
          : "Collection | Pebbly",
      },
      {
        name: "description",
        content:
          loaderData?.description ||
          "A curated movie & TV collection on Pebbly.",
      },
    ],
  }),
  component: CollectionPageRoute,
});

function CollectionPageRoute() {
  const { listId } = Route.useLoaderData();
  return (
    <section className="flex min-h-screen w-full justify-center">
      <div className="w-full max-w-screen-xl p-5">
        <CollectionPage listId={listId} />
      </div>
    </section>
  );
}
