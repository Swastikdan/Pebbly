import { SignInButton, useUser } from "@clerk/react";
import { ListPlus, Plus } from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";

import { DefaultLoader } from "@/components/default-loader";
import { Button } from "@/components/ui/button";
import { CustomListCard } from "@/components/watchlist/custom-list-card";
import { useCustomLists } from "@/hooks/use-custom-lists";
import { destructiveToast } from "@/hooks/use-destructive-toast";
import { toast } from "@/lib/notifications";
import { useRepository } from "@/lib/repository/use-repository";
import { logError } from "@/lib/utils";

const CustomListDialog = lazy(() =>
  import("@/components/custom-list-dialog").then((m) => ({
    default: m.CustomListDialog,
  })),
);

export function MyListsTab() {
  const { isSignedIn, isLoaded } = useUser();
  const { lists: customLists, loading } = useCustomLists();
  const { deleteList: deleteCustomList, cloneList } = useRepository();
  const [showCreateList, setShowCreateList] = useState(false);
  const [editingList, setEditingList] = useState<{
    id: string;
    name: string;
    color?: string;
    description?: string;
    visibility?: "public" | "private";
    sortType?: "unordered" | "ordered";
  } | null>(null);

  const sortedLists = useMemo(
    () => [...customLists].sort((a, b) => a.sortOrder - b.sortOrder),
    [customLists],
  );

  // Clerk's isSignedIn is false until the session resolves; wait for it so
  // signed-in users don't flash the signed-out CTA on first paint.
  if (!isLoaded) {
    return <DefaultLoader />;
  }

  if (loading) {
    return <DefaultLoader />;
  }

  // Collections live on the server (they are the shareable/private objects
  // opened at /c/$id), so signed-out visitors get a sign-in CTA instead of
  // the creation UI, because a localStorage-only list could never be opened or
  // shared, which read as broken.
  if (!isSignedIn) {
    return (
      <div className="animate-fade-in-up flex min-h-[calc(100vh-400px)] flex-col items-center justify-center gap-6 py-16 text-center">
        <div className="text-muted-foreground border-border flex size-10 items-center justify-center rounded-md border">
          <ListPlus className="size-5" />
        </div>
        <div>
          <h3 className="mb-2 text-lg font-bold tracking-tight">
            Sign in to create collections
          </h3>
          <p className="text-muted-foreground/80 max-w-sm text-xs leading-relaxed">
            Collections are saved to your account, so you can keep them private
            or share them with anyone.
          </p>
        </div>
        <SignInButton mode="modal">
          <Button
            variant="secondary"
            size="sm"
            className="gap-2 px-5 text-xs font-semibold"
          >
            Sign In
          </Button>
        </SignInButton>
      </div>
    );
  }

  const deleteListWithUndo = (list: {
    _id: string;
    name: string;
    color?: string | null;
    description?: string | null;
    visibility?: string | null;
    sortType?: "unordered" | "ordered";
  }) => {
    destructiveToast({
      title: "Collection deleted",
      description: list.name,
      onConfirm: () => {
        deleteCustomList(list._id);
      },
    });
  };

  const duplicateList = (list: { _id: string; name: string }) => {
    cloneList(list._id)
      .then(() =>
        toast({
          title: "Collection duplicated",
          description: `"${list.name} (copy)" was added to your collections.`,
        }),
      )
      .catch((error) => logError("clone list", error));
  };

  return (
    <div className="space-y-6 pt-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            My Collections
          </h2>
          <p className="text-muted-foreground animate-fade-in mt-0.5 text-sm">
            {customLists.length} collection
            {customLists.length !== 1 ? "s" : ""} created
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowCreateList(true)}
          className="gap-1.5 text-xs"
        >
          <Plus size={14} />
          New Collection
        </Button>
      </div>

      {sortedLists.length === 0 ? (
        <div className="animate-fade-in-up flex min-h-[calc(100vh-400px)] flex-col items-center justify-center gap-6 py-16 text-center">
          <div className="text-muted-foreground border-border flex size-10 items-center justify-center rounded-md border">
            <ListPlus className="size-5" />
          </div>
          <div>
            <h3 className="mb-2 text-lg font-bold tracking-tight">
              Create your first collection
            </h3>
            <p className="text-muted-foreground/80 max-w-sm text-xs leading-relaxed">
              Organize movies and TV shows into custom lists, like "Sci-Fi
              Favorites" or "Shows to Binge with Friends".
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="hover:bg-secondary/80 gap-2 px-5 text-xs font-semibold"
            onClick={() => setShowCreateList(true)}
          >
            <Plus size={14} />
            Create Your First Collection
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {sortedLists.map((list) => (
            <CustomListCard
              key={list._id}
              list={list}
              onEdit={() =>
                setEditingList({
                  id: list._id,
                  name: list.name,
                  color: list.color,
                  description: list.description,
                  visibility:
                    (list.visibility as "public" | "private") ?? undefined,
                  sortType: list.sortType,
                })
              }
              onDuplicate={() => duplicateList(list)}
              onDelete={() => {
                deleteListWithUndo(list);
              }}
            />
          ))}
        </div>
      )}

      <Suspense fallback={null}>
        <CustomListDialog
          open={showCreateList}
          onOpenChange={setShowCreateList}
        />
      </Suspense>
      {editingList && (
        <Suspense fallback={null}>
          <CustomListDialog
            open={true}
            onOpenChange={(open) => {
              if (!open) setEditingList(null);
            }}
            listId={editingList.id}
            initialName={editingList.name}
            initialColor={editingList.color}
            initialDescription={editingList.description}
            initialVisibility={editingList.visibility}
            initialSortType={editingList.sortType}
          />
        </Suspense>
      )}
    </div>
  );
}
