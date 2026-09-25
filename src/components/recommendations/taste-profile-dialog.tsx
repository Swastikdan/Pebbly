import {
  Compass,
  Flame,
  Minus,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import type {
  AdventureLevel,
  PreferredMediaType,
} from "@/server/schema/taste-profile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { GENRE_LIST } from "@/constants";
import { useTasteProfile } from "@/hooks/use-taste-profile";
import { toast } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { DEFAULT_TASTE_PROFILE } from "@/server/schema/taste-profile";

const COMMON_THEMES = [
  "Gore & Body Horror",
  "Jump Scares",
  "Sad Endings",
  "Musical Numbers",
  "Grimdark & Bleak",
  "Reality TV Tropes",
  "Cringe Comedy",
  "Zombie Apocalypse",
  "Cheesy Romance",
  "Torture & Cruelty",
];

const ADVENTURE_OPTIONS: Array<{
  value: AdventureLevel;
  title: string;
  icon: typeof Sparkles;
  description: string;
}> = [
  {
    value: "familiar",
    title: "Familiar",
    icon: Compass,
    description: "Acclaimed favorites, established hits, and safe picks.",
  },
  {
    value: "balanced",
    title: "Balanced",
    icon: Sparkles,
    description: "Harmonious balance of popular titles and fresh discoveries.",
  },
  {
    value: "adventurous",
    title: "Adventurous",
    icon: Flame,
    description:
      "Bold deep cuts, hidden gems, cult classics, and surprise blends.",
  },
];

const UNIQUE_GENRES = Array.from(
  new Set(GENRE_LIST.map((g) => g.name).filter(Boolean)),
).sort();

export function TasteProfileDialog({
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { tasteProfile, isSaving, saveProfile, resetProfile } =
    useTasteProfile();

  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;

  const [adventureLevel, setAdventureLevel] = useState<AdventureLevel>(
    tasteProfile.adventureLevel,
  );
  const [preferredMediaType, setPreferredMediaType] =
    useState<PreferredMediaType>(tasteProfile.preferredMediaType);
  const [preferredGenres, setPreferredGenres] = useState<string[]>(
    tasteProfile.preferredGenres,
  );
  const [dislikedGenres, setDislikedGenres] = useState<string[]>(
    tasteProfile.dislikedGenres,
  );
  const [dislikedThemes, setDislikedThemes] = useState<string[]>(
    tasteProfile.dislikedThemes,
  );
  const [avoidTitles, setAvoidTitles] = useState<string[]>(
    tasteProfile.avoidTitles,
  );

  const [customThemeInput, setCustomThemeInput] = useState("");
  const [avoidTitleInput, setAvoidTitleInput] = useState("");

  useEffect(() => {
    if (isOpen) {
      setAdventureLevel(tasteProfile.adventureLevel);
      setPreferredMediaType(tasteProfile.preferredMediaType);
      setPreferredGenres(tasteProfile.preferredGenres);
      setDislikedGenres(tasteProfile.dislikedGenres);
      setDislikedThemes(tasteProfile.dislikedThemes);
      setAvoidTitles(tasteProfile.avoidTitles);
    }
  }, [isOpen, tasteProfile]);

  const togglePreferredGenre = (name: string) => {
    setPreferredGenres((prev) => {
      if (prev.includes(name)) return prev.filter((g) => g !== name);
      // Remove from disliked if adding to preferred
      setDislikedGenres((d) => d.filter((g) => g !== name));
      return [...prev, name];
    });
  };

  const toggleDislikedGenre = (name: string) => {
    setDislikedGenres((prev) => {
      if (prev.includes(name)) return prev.filter((g) => g !== name);
      // Remove from preferred if adding to disliked
      setPreferredGenres((p) => p.filter((g) => g !== name));
      return [...prev, name];
    });
  };

  const toggleTheme = (theme: string) => {
    setDislikedThemes((prev) =>
      prev.includes(theme) ? prev.filter((t) => t !== theme) : [...prev, theme],
    );
  };

  const handleAddCustomTheme = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customThemeInput.trim();
    if (!clean) return;
    if (!dislikedThemes.includes(clean)) {
      setDislikedThemes((prev) => [...prev, clean]);
    }
    setCustomThemeInput("");
  };

  const handleAddAvoidTitle = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = avoidTitleInput.trim();
    if (!clean) return;
    if (!avoidTitles.includes(clean)) {
      setAvoidTitles((prev) => [...prev, clean]);
    }
    setAvoidTitleInput("");
  };

  const handleRemoveAvoidTitle = (title: string) => {
    setAvoidTitles((prev) => prev.filter((t) => t !== title));
  };

  const handleSave = async () => {
    await saveProfile({
      adventureLevel,
      preferredMediaType,
      preferredGenres,
      dislikedGenres,
      dislikedThemes,
      avoidTitles,
    });
    toast({
      title: "Taste profile saved",
      description:
        "Your persistent taste preferences will shape future recommendations.",
    });
    setOpen(false);
  };

  const handleReset = async () => {
    await resetProfile();
    setAdventureLevel(DEFAULT_TASTE_PROFILE.adventureLevel);
    setPreferredMediaType(DEFAULT_TASTE_PROFILE.preferredMediaType);
    setPreferredGenres(DEFAULT_TASTE_PROFILE.preferredGenres);
    setDislikedGenres(DEFAULT_TASTE_PROFILE.dislikedGenres);
    setDislikedThemes(DEFAULT_TASTE_PROFILE.dislikedThemes);
    setAvoidTitles(DEFAULT_TASTE_PROFILE.avoidTitles);
    toast({
      title: "Taste profile reset",
      description:
        "Taste controls restored to defaults. Your watch history is untouched.",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger render={trigger as React.ReactElement} />
      ) : (
        <DialogTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 text-xs font-medium"
            >
              <SlidersHorizontal aria-hidden="true" size={13} />
              <span>Taste Controls</span>
            </Button>
          }
        />
      )}

      <DialogPopup className="max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6 sm:p-7">
        <DialogHeader className="mb-5 space-y-1.5 text-start">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 text-primary flex size-7 items-center justify-center rounded-md">
              <Sparkles aria-hidden="true" size={14} />
            </div>
            <DialogTitle className="font-heading text-lg font-bold sm:text-xl">
              AI Taste Profile
            </DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground text-xs leading-relaxed sm:text-sm">
            Fine-tune how Pebbly builds recommendations for you. Set your
            adventure level, choose preferred genres, and exclude disliked
            themes or franchises.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 1. Adventure Level */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-foreground text-xs font-semibold sm:text-sm">
                Adventure Level
              </h3>
              <span className="text-muted-foreground text-[11px] capitalize">
                {adventureLevel}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {ADVENTURE_OPTIONS.map((opt) => {
                const isSelected = adventureLevel === opt.value;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAdventureLevel(opt.value)}
                    className={cn(
                      "flex flex-col items-start gap-1.5 rounded-lg border p-3 text-start transition-all",
                      isSelected
                        ? "border-primary bg-primary/5 text-foreground ring-primary/40 shadow-xs ring-1"
                        : "border-border hover:bg-muted/50 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon
                        aria-hidden="true"
                        size={14}
                        className={
                          isSelected ? "text-primary" : "text-muted-foreground"
                        }
                      />
                      <span className="text-foreground text-xs font-bold">
                        {opt.title}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-[11px] leading-snug">
                      {opt.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Media Type Preference */}
          <div className="space-y-2.5">
            <h3 className="text-foreground text-xs font-semibold sm:text-sm">
              Default Format
            </h3>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "all", label: "Movies & TV Shows" },
                { value: "movie", label: "Movies Only" },
                { value: "tv", label: "TV Series Only" },
              ].map((fmt) => (
                <button
                  key={fmt.value}
                  type="button"
                  onClick={() =>
                    setPreferredMediaType(fmt.value as PreferredMediaType)
                  }
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                    preferredMediaType === fmt.value
                      ? "border-primary bg-primary text-primary-foreground font-semibold"
                      : "border-border hover:bg-muted text-muted-foreground",
                  )}
                >
                  {fmt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Preferred Genres */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-foreground text-xs font-semibold sm:text-sm">
                Preferred Genres
              </h3>
              <span className="text-muted-foreground text-[11px]">
                {preferredGenres.length} selected
              </span>
            </div>
            <p className="text-muted-foreground text-[11px]">
              Genres you want recommendations to prioritize.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {UNIQUE_GENRES.map((genre) => {
                const isSelected = preferredGenres.includes(genre);
                return (
                  <Badge
                    key={genre}
                    variant={isSelected ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer text-xs transition-colors",
                      isSelected
                        ? "border-transparent bg-emerald-600 text-white hover:bg-emerald-700"
                        : "hover:bg-muted",
                    )}
                    onClick={() => togglePreferredGenre(genre)}
                  >
                    {isSelected && <Plus className="mr-1 size-3" />}
                    {genre}
                  </Badge>
                );
              })}
            </div>
          </div>

          {/* 4. Disliked Genres */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-foreground text-xs font-semibold sm:text-sm">
                Disliked Genres
              </h3>
              <span className="text-muted-foreground text-[11px]">
                {dislikedGenres.length} avoided
              </span>
            </div>
            <p className="text-muted-foreground text-[11px]">
              Genres you prefer not to see suggested.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {UNIQUE_GENRES.map((genre) => {
                const isSelected = dislikedGenres.includes(genre);
                return (
                  <Badge
                    key={genre}
                    variant={isSelected ? "destructive" : "outline"}
                    className={cn(
                      "cursor-pointer text-xs transition-colors",
                      isSelected
                        ? "bg-destructive text-destructive-foreground"
                        : "hover:bg-muted",
                    )}
                    onClick={() => toggleDislikedGenre(genre)}
                  >
                    {isSelected && <Minus className="mr-1 size-3" />}
                    {genre}
                  </Badge>
                );
              })}
            </div>
          </div>

          {/* 5. Disliked Themes */}
          <div className="space-y-2.5">
            <h3 className="text-foreground text-xs font-semibold sm:text-sm">
              Themes to Avoid
            </h3>
            <p className="text-muted-foreground text-[11px]">
              Select recurring tropes or content themes you would rather skip.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_THEMES.map((theme) => {
                const isSelected = dislikedThemes.includes(theme);
                return (
                  <Badge
                    key={theme}
                    variant={isSelected ? "secondary" : "outline"}
                    className={cn(
                      "cursor-pointer text-xs transition-colors",
                      isSelected
                        ? "border-destructive/60 bg-destructive/15 text-destructive font-medium"
                        : "hover:bg-muted",
                    )}
                    onClick={() => toggleTheme(theme)}
                  >
                    {theme}
                  </Badge>
                );
              })}
            </div>

            <form onSubmit={handleAddCustomTheme} className="mt-2 flex gap-2">
              <Input
                type="text"
                placeholder="Add custom theme (e.g., multiverse, body swap)..."
                value={customThemeInput}
                onChange={(e) => setCustomThemeInput(e.target.value)}
                className="h-8 text-xs"
              />
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                className="h-8 shrink-0 text-xs"
                disabled={!customThemeInput.trim()}
              >
                Add
              </Button>
            </form>
          </div>

          {/* 6. Avoid Titles & Franchises */}
          <div className="space-y-2.5">
            <h3 className="text-foreground text-xs font-semibold sm:text-sm">
              Titles & Franchises to Avoid
            </h3>
            <p className="text-muted-foreground text-[11px]">
              Exclude specific titles, universes, or franchises from ever
              appearing.
            </p>

            {avoidTitles.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {avoidTitles.map((title) => (
                  <span
                    key={title}
                    className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs"
                  >
                    <span>{title}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAvoidTitle(title)}
                      className="hover:text-destructive text-muted-foreground transition-colors"
                      aria-label={`Remove ${title} from avoided list`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <form onSubmit={handleAddAvoidTitle} className="flex gap-2">
              <Input
                type="text"
                placeholder="Avoid title or series (e.g., Star Wars, Fast & Furious)..."
                value={avoidTitleInput}
                onChange={(e) => setAvoidTitleInput(e.target.value)}
                className="h-8 text-xs"
              />
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                className="h-8 shrink-0 text-xs"
                disabled={!avoidTitleInput.trim()}
              >
                Add
              </Button>
            </form>
          </div>
        </div>

        {/* Footer actions */}
        <div className="border-border mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-muted-foreground hover:text-foreground gap-1.5 text-xs"
            disabled={isSaving}
          >
            <RotateCcw size={12} />
            Reset to Defaults
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              className="text-xs"
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleSave}
              loading={isSaving}
              className="text-xs font-semibold"
            >
              Save Profile
            </Button>
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
