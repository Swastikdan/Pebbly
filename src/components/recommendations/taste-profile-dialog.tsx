import { useEffect, useState } from "react";

import type {
  AdventureLevel,
  PreferredMediaType,
} from "@/server/schema/taste-profile";
import { Button } from "@/components/ui/button";
import { Dialog, DialogPopup, DialogTrigger } from "@/components/ui/dialog";
import {
  Ban,
  Compass,
  Film,
  Flame,
  Heart,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  ThumbsDown,
  X,
} from "@/components/ui/hugeicons";
import { Input } from "@/components/ui/input";
import { ModalFooter, ModalHeader } from "@/components/ui/modal-parts";
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

const FORMAT_LABELS: Record<PreferredMediaType, string> = {
  all: "Movies & TV Shows",
  movie: "Movies Only",
  tv: "TV Series Only",
};

type Tone = "positive" | "negative";

const CHIP_BASE =
  "inline-flex items-center justify-center rounded-full border px-3.5 py-2 text-sm font-medium leading-none transition-colors select-none";

const CHIP_TONES: Record<Tone, { selected: string }> = {
  positive: {
    selected:
      "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-600/85 dark:border-emerald-500 dark:bg-emerald-500/20 dark:text-emerald-300 dark:hover:bg-emerald-500/30",
  },
  negative: {
    selected:
      "border-red-600 bg-red-600 text-white hover:bg-red-600/85 dark:border-red-500 dark:bg-red-500/20 dark:text-red-300 dark:hover:bg-red-500/30",
  },
};

const CHIP_IDLE =
  "border-border bg-background text-foreground/80 hover:bg-muted hover:text-foreground";

function summarize(items: string[], empty: string) {
  if (items.length === 0) return empty;
  const shown = items.slice(0, 3).join(", ");
  return items.length > 3 ? `${shown} +${items.length - 3}` : shown;
}

function ChipGrid({
  items,
  selected,
  tone,
  onToggle,
}: {
  items: string[];
  selected: string[];
  tone: Tone;
  onToggle: (item: string) => void;
}) {
  const { selected: selectedClass } = CHIP_TONES[tone];
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const isSelected = selected.includes(item);
        return (
          <button
            key={item}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onToggle(item)}
            className={cn(CHIP_BASE, isSelected ? selectedClass : CHIP_IDLE)}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}

function ProfileSection({
  id,
  description,
  openId,
  children,
}: {
  id: string;
  icon?: unknown;
  title?: string;
  description?: string;
  summary?: string;
  tone?: Tone;
  count?: number;
  openId: string | null;
  onToggle?: (id: string | null) => void;
  children: React.ReactNode;
}) {
  if (openId !== id) return null;
  return (
    <section role="tabpanel" id={`taste-panel-${id}`}>
      {description && (
        <p className="text-muted-foreground mb-3 text-xs">{description}</p>
      )}
      {children}
    </section>
  );
}

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

  const [openSection, setOpenSection] = useState<string | null>("basics");
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
      setOpenSection("basics");
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

      <DialogPopup className="flex h-[min(540px,90vh)] w-full max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <ModalHeader
          icon={Sparkles}
          title="AI Taste Profile"
          subtitle="Fine-tune how Pebbly builds recommendations for you."
        />

        <div
          role="tablist"
          aria-label="Taste profile sections"
          className="no-scrollbar flex shrink-0 gap-1 overflow-x-auto px-5 pt-4 pb-1"
        >
          {[
            { id: "basics", label: "Style", icon: Compass, count: 0 },
            {
              id: "preferred",
              label: "Preferred",
              icon: Heart,
              count: preferredGenres.length,
            },
            {
              id: "disliked",
              label: "Disliked",
              icon: ThumbsDown,
              count: dislikedGenres.length,
            },
            {
              id: "themes",
              label: "Themes",
              icon: Ban,
              count: dislikedThemes.length,
            },
            {
              id: "titles",
              label: "Titles",
              icon: Film,
              count: avoidTitles.length,
            },
          ].map((tab) => {
            const active = openSection === tab.id;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`taste-panel-${tab.id}`}
                onClick={() => setOpenSection(tab.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <TabIcon aria-hidden="true" size={14} />
                {tab.label}
                {tab.count > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[11px] leading-5 font-semibold",
                      active ? "bg-primary-foreground/20" : "bg-muted",
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          <div className="space-y-3">
            {/* 1. Basics: Adventure + Format */}
            <ProfileSection
              id="basics"
              icon={Compass}
              title="Discovery Style"
              summary={`${adventureLevel} · ${FORMAT_LABELS[preferredMediaType]}`}
              openId={openSection}
              onToggle={setOpenSection}
            >
              <h3 className="text-foreground mb-2 text-sm font-semibold">
                Adventure Level
              </h3>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {ADVENTURE_OPTIONS.map((opt) => {
                  const isSelected = adventureLevel === opt.value;
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setAdventureLevel(opt.value)}
                      aria-pressed={isSelected}
                      className={cn(
                        "flex flex-col items-start gap-1.5 rounded-xl border p-3 text-start transition-all",
                        isSelected
                          ? "border-primary bg-primary/5 ring-primary/40 ring-1"
                          : "border-border hover:bg-muted/50",
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <Icon
                          aria-hidden="true"
                          size={15}
                          className={
                            isSelected
                              ? "text-primary"
                              : "text-muted-foreground"
                          }
                        />
                        <span className="text-foreground text-sm font-semibold">
                          {opt.title}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-xs leading-snug">
                        {opt.description}
                      </p>
                    </button>
                  );
                })}
              </div>
              <h3 className="text-foreground mt-6 mb-2 text-sm font-semibold">
                Default Format
              </h3>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(FORMAT_LABELS) as PreferredMediaType[]).map(
                  (value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={preferredMediaType === value}
                      onClick={() => setPreferredMediaType(value)}
                      className={cn(
                        "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                        preferredMediaType === value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:bg-muted text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {FORMAT_LABELS[value]}
                    </button>
                  ),
                )}
              </div>
            </ProfileSection>

            {/* 2. Preferred Genres */}
            <ProfileSection
              id="preferred"
              icon={Heart}
              title="Preferred Genres"
              description="Genres you want recommendations to prioritize."
              summary={summarize(preferredGenres, "None selected")}
              tone="positive"
              count={preferredGenres.length}
              openId={openSection}
              onToggle={setOpenSection}
            >
              <ChipGrid
                items={UNIQUE_GENRES}
                selected={preferredGenres}
                tone="positive"
                onToggle={togglePreferredGenre}
              />
            </ProfileSection>

            {/* 3. Disliked Genres */}
            <ProfileSection
              id="disliked"
              icon={ThumbsDown}
              title="Disliked Genres"
              description="Genres you prefer not to see suggested."
              summary={summarize(dislikedGenres, "None avoided")}
              tone="negative"
              count={dislikedGenres.length}
              openId={openSection}
              onToggle={setOpenSection}
            >
              <ChipGrid
                items={UNIQUE_GENRES}
                selected={dislikedGenres}
                tone="negative"
                onToggle={toggleDislikedGenre}
              />
            </ProfileSection>

            {/* 4. Themes to Avoid */}
            <ProfileSection
              id="themes"
              icon={Ban}
              title="Themes to Avoid"
              description="Recurring tropes or content themes you would rather skip."
              summary={summarize(dislikedThemes, "None avoided")}
              tone="negative"
              count={dislikedThemes.length}
              openId={openSection}
              onToggle={setOpenSection}
            >
              <ChipGrid
                items={[
                  ...COMMON_THEMES,
                  ...dislikedThemes.filter((t) => !COMMON_THEMES.includes(t)),
                ]}
                selected={dislikedThemes}
                tone="negative"
                onToggle={toggleTheme}
              />
              <form onSubmit={handleAddCustomTheme} className="mt-3 flex gap-2">
                <Input
                  type="text"
                  placeholder="Add custom theme (e.g., multiverse, body swap)..."
                  value={customThemeInput}
                  onChange={(e) => setCustomThemeInput(e.target.value)}
                  className="h-9 text-sm"
                />
                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  className="h-9 shrink-0 text-sm"
                  disabled={!customThemeInput.trim()}
                >
                  Add
                </Button>
              </form>
            </ProfileSection>

            {/* 5. Avoid Titles & Franchises */}
            <ProfileSection
              id="titles"
              icon={Film}
              title="Titles & Franchises to Avoid"
              description="Exclude specific titles, universes, or franchises from ever appearing."
              summary={summarize(avoidTitles, "None avoided")}
              tone="negative"
              count={avoidTitles.length}
              openId={openSection}
              onToggle={setOpenSection}
            >
              {avoidTitles.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {avoidTitles.map((title) => (
                    <span
                      key={title}
                      className={cn(
                        CHIP_BASE,
                        CHIP_TONES.negative.selected,
                        "gap-1.5",
                      )}
                    >
                      <span>{title}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAvoidTitle(title)}
                        className="opacity-70 transition-opacity hover:opacity-100"
                        aria-label={`Remove ${title} from avoided list`}
                      >
                        <X size={13} />
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
                  className="h-9 text-sm"
                />
                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  className="h-9 shrink-0 text-sm"
                  disabled={!avoidTitleInput.trim()}
                >
                  Add
                </Button>
              </form>
            </ProfileSection>
          </div>
        </div>

        {/* Footer actions */}
        <ModalFooter className="justify-between gap-3">
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
        </ModalFooter>
      </DialogPopup>
    </Dialog>
  );
}
