import { Bookmark, ListPlus } from "lucide-react";
import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";

import { GoBack } from "@/components/go-back";
import { ShareButton } from "@/components/share-button";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { MyListsTab } from "@/components/watchlist/my-lists-tab";
import { SilentErrorBoundary } from "@/components/watchlist/silent-error-boundary";
import { WatchlistTab } from "@/components/watchlist/watchlist-tab";

export const Route = createLazyFileRoute("/watchlist")({
  component: WatchlistPage,
});

type PageTab = "watchlist" | "my-lists";

function WatchlistPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/watchlist" });

  const activeTab: PageTab =
    search.tab === "collections" || search.tab === "my-lists"
      ? "my-lists"
      : "watchlist";

  const handleTabChange = (v: string) => {
    navigate({
      search: {
        tab: v === "my-lists" ? "collections" : "watchlist",
      },
    });
  };

  return (
    <section className="flex min-h-screen w-full justify-center">
      <div className="w-full max-w-7xl p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <GoBack title="Back" />
          <ShareButton title="My Watchlist" />
        </div>

        <div className="mb-4">
          <div className="flex items-center gap-4">
            <Tabs
              value={activeTab}
              onValueChange={handleTabChange}
              className="w-full"
            >
              <div className="flex items-center justify-start sm:justify-start">
                <TabsList className="w-full max-w-sm sm:w-fit">
                  <TabsTab value="watchlist">
                    <Bookmark size={15} />
                    Watchlist
                  </TabsTab>
                  <TabsTab value="my-lists">
                    <ListPlus size={15} />
                    My Collections
                  </TabsTab>
                </TabsList>
              </div>

              <TabsPanel value="watchlist" className="mt-0">
                <WatchlistTab />
              </TabsPanel>

              <TabsPanel value="my-lists" className="mt-0">
                <SilentErrorBoundary>
                  <MyListsTab />
                </SilentErrorBoundary>
              </TabsPanel>
            </Tabs>
          </div>
        </div>
      </div>
    </section>
  );
}
