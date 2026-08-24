import { createLazyFileRoute } from "@tanstack/react-router";

import { SearchPage } from "@/components/search/search-page";

export const Route = createLazyFileRoute("/search")({
  component: SearchPage,
});
