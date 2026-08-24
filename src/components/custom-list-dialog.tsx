import { Check, Copy, Globe, List, ListOrdered, Lock } from "lucide-react";
import { useEffect, useId, useState } from "react";

import type { MediaType } from "@/lib/media-types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRepository } from "@/lib/repository/use-repository";
import { cn, formatMediaTitle } from "@/lib/utils";

const PRESET_COLORS = [
  { hex: "#ef4444", name: "Red" },
  { hex: "#f97316", name: "Orange" },
  { hex: "#eab308", name: "Gold" },
  { hex: "#22c55e", name: "Green" },
  { hex: "#06b6d4", name: "Cyan" },
  { hex: "#3b82f6", name: "Blue" },
  { hex: "#8b5cf6", name: "Violet" },
  { hex: "#ec4899", name: "Pink" },
  { hex: "#f43f5e", name: "Rose" },
  { hex: "#14b8a6", name: "Teal" },
];

function SegmentedButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Globe;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border py-1.5 text-[10.5px] transition-[color,background-color,border-color,box-shadow]",
        active
          ? "bg-card text-foreground border-border font-semibold shadow-sm dark:shadow-none"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border-transparent bg-transparent",
      )}
      aria-pressed={active}
    >
      <Icon size={11} />
      {label}
    </button>
  );
}

export function CustomListDialog({
  open,
  onOpenChange,
  initialName,
  initialColor,
  initialDescription,
  initialVisibility,
  initialSortType,
  listId,
  autoAddMedia,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  initialColor?: string;
  initialDescription?: string;
  initialVisibility?: "public" | "private";
  initialSortType?: "unordered" | "ordered";
  listId?: string;
  autoAddMedia?: {
    tmdbId: number;
    mediaType: MediaType;
    title?: string;
    image?: string;
    backdrop?: string;
    rating?: number;
    release_date?: string;
    overview?: string;
  };
}) {
  const [name, setName] = useState(initialName ?? "");
  const [description, setDescription] = useState(initialDescription ?? "");
  const [color, setColor] = useState(initialColor ?? "");
  const [visibility, setVisibility] = useState<"private" | "public">(
    initialVisibility ?? "private",
  );
  const [sortType, setSortType] = useState<"unordered" | "ordered">(
    initialSortType ?? "unordered",
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const {
    createList,
    createListAndAddItem: createListAndAdd,
    updateList,
  } = useRepository();

  const isEditing = !!listId;
  const listNameId = useId();
  const listDescId = useId();

  useEffect(() => {
    if (open) {
      setName(initialName ?? "");
      setDescription(initialDescription ?? "");
      setColor(initialColor ?? "");
      setVisibility(initialVisibility ?? "private");
      setSortType(initialSortType ?? "unordered");
      setError("");
      setSaving(false);
    }
  }, [
    open,
    initialName,
    initialColor,
    initialDescription,
    initialVisibility,
    initialSortType,
  ]);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give your collection a name");
      return;
    }
    if (trimmed.length > 50) {
      setError("Name must be 50 characters or less");
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        await updateList({
          listId: listId as string,
          name: trimmed,
          color: color || undefined,
          description: description.trim() || undefined,
          visibility,
          sortType,
        });
      } else if (autoAddMedia) {
        await createListAndAdd({
          name: trimmed,
          color: color || undefined,
          description: description.trim() || undefined,
          visibility,
          sortType,
          tmdbId: autoAddMedia.tmdbId,
          mediaType: autoAddMedia.mediaType,
          title: autoAddMedia.title,
          image: autoAddMedia.image,
          backdrop: autoAddMedia.backdrop,
          rating: autoAddMedia.rating,
          release_date: autoAddMedia.release_date,
          overview: autoAddMedia.overview,
        });
      } else {
        await createList({
          name: trimmed,
          color: color || undefined,
          description: description.trim() || undefined,
          visibility,
          sortType,
        });
      }
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save collection",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = () => {
    const slug = formatMediaTitle.encode(name.trim());
    navigator.clipboard
      .writeText(`${window.location.origin}/c/${listId}/${slug}`)
      .then(() => {})
      .catch(() => {});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="overflow-hidden rounded-xl p-0 sm:max-w-lg">
        <div className="space-y-5 px-6 py-5">
          <DialogHeader className="relative">
            <DialogTitle className="font-heading pr-6 text-left text-lg font-semibold tracking-tight">
              {isEditing ? "Edit Collection" : "New Collection"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-1.5">
            <div className="text-muted-foreground flex items-center justify-between text-xs font-medium">
              <Label htmlFor={listNameId}>Name</Label>
              <span>{name.length}/50</span>
            </div>
            <Input
              id={listNameId}
              type="text"
              placeholder='e.g. "Sci-Fi Favorites"'
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              maxLength={50}
              autoFocus
              className={cn(
                "bg-card h-10 w-full rounded-xl border px-3.5 text-xs transition-[color,background-color,border-color,box-shadow] duration-150",
                "placeholder:text-muted-foreground/60",
                "focus-visible:border-ring/60 focus-visible:bg-card focus-visible:ring-ring/30 focus-visible:ring-1",
                error ? "border-destructive/50" : "border-border",
              )}
            />
          </div>

          <div className="space-y-1.5">
            <div className="text-muted-foreground flex items-center justify-between text-xs font-medium">
              <Label htmlFor={listDescId}>Description</Label>
              <span>{description.length}/150</span>
            </div>
            <textarea
              id={listDescId}
              placeholder="What ties these titles together? (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value.substring(0, 150))}
              maxLength={150}
              className={cn(
                "bg-card min-h-[64px] w-full resize-none rounded-xl border p-3 text-xs transition-[color,background-color,border-color,box-shadow] duration-200 outline-none",
                "placeholder:text-muted-foreground/60",
                "focus-visible:border-ring/60 focus-visible:bg-card focus-visible:ring-ring/30 focus-visible:ring-1",
                "border-border",
              )}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs font-medium">
              Color
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_COLORS.map((c) => {
                const isSelected = color === c.hex;
                return (
                  <button
                    key={c.hex}
                    type="button"
                    className={cn(
                      "relative size-6 cursor-pointer rounded-full border border-black/10 transition-transform duration-150 hover:scale-110 dark:border-white/10",
                      isSelected &&
                        "ring-foreground ring-offset-background scale-110 ring-2 ring-offset-2",
                    )}
                    style={{ backgroundColor: c.hex }}
                    onClick={() => setColor(color === c.hex ? "" : c.hex)}
                    aria-label={c.name}
                    title={c.name}
                  >
                    {isSelected && (
                      <Check
                        size={12}
                        className="absolute inset-0 m-auto text-white drop-shadow-sm"
                        strokeWidth={3}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col space-y-2">
              <Label className="text-muted-foreground text-xs font-medium">
                Visibility
              </Label>
              <div className="bg-muted/70 border-border/50 flex rounded-xl border p-1">
                <SegmentedButton
                  active={visibility === "private"}
                  onClick={() => setVisibility("private")}
                  icon={Lock}
                  label="Private"
                />
                <SegmentedButton
                  active={visibility === "public"}
                  onClick={() => setVisibility("public")}
                  icon={Globe}
                  label="Public"
                />
              </div>
              <p className="text-muted-foreground/80 min-h-[28px] text-[10px] leading-snug">
                {visibility === "private"
                  ? "Only you can see this collection."
                  : "Anyone with the link can view it."}
              </p>
              {isEditing && visibility === "public" && (
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="bg-secondary/70 text-secondary-foreground hover:bg-secondary flex cursor-pointer items-center gap-1.5 self-start rounded-lg px-2 py-1 text-[10px] font-semibold transition-colors"
                >
                  <Copy size={10} />
                  Copy public link
                </button>
              )}
            </div>

            <div className="flex flex-col space-y-2">
              <Label className="text-muted-foreground text-xs font-medium">
                Ordering
              </Label>
              <div className="bg-muted/70 border-border/50 flex rounded-xl border p-1">
                <SegmentedButton
                  active={sortType === "unordered"}
                  onClick={() => setSortType("unordered")}
                  icon={List}
                  label="Unordered"
                />
                <SegmentedButton
                  active={sortType === "ordered"}
                  onClick={() => setSortType("ordered")}
                  icon={ListOrdered}
                  label="Ranked"
                />
              </div>
              <p className="text-muted-foreground/80 min-h-[28px] text-[10px] leading-snug">
                {sortType === "unordered"
                  ? "A simple list of titles."
                  : "Titles are numbered #1, #2, … and can be reordered."}
              </p>
            </div>
          </div>

          {error && (
            <p className="bg-destructive/10 text-destructive rounded-xl px-3 py-2 text-xs">
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="h-10 cursor-pointer text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || !name.trim()}
              className="h-10 cursor-pointer text-xs font-bold"
            >
              {saving
                ? "Saving..."
                : isEditing
                  ? "Save Changes"
                  : "Create Collection"}
            </Button>
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
