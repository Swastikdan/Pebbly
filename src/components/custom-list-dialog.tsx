import { useMutation } from "convex/react";
import { Check, Palette } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

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

export function CustomListDialog({
	open,
	onOpenChange,
	initialName,
	initialColor,
	listId,
	autoAddMedia,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initialName?: string;
	initialColor?: string;
	listId?: string;
	autoAddMedia?: {
		tmdbId: number;
		mediaType: string;
		title?: string;
		image?: string;
		rating?: number;
		release_date?: string;
		overview?: string;
	};
}) {
	const [name, setName] = useState(initialName ?? "");
	const [color, setColor] = useState(initialColor ?? "");
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);

	const createList = useMutation(api.watchlist.createCustomList);
	const createListAndAdd = useMutation(
		api.watchlist.createCustomListAndAddItem,
	);
	const updateList = useMutation(api.watchlist.updateCustomList);

	const isEditing = !!listId;
	const listNameId = useId();

	useEffect(() => {
		if (open) {
			setName(initialName ?? "");
			setColor(initialColor ?? "");
			setError("");
			setSaving(false);
		}
	}, [open, initialName, initialColor]);

	const handleSubmit = async () => {
		const trimmed = name.trim();
		if (!trimmed) {
			setError("Give your list a name");
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
					listId: listId as Id<"lists">,
					name: trimmed,
					color: color || undefined,
				});
			} else if (autoAddMedia) {
				await createListAndAdd({
					name: trimmed,
					color: color || undefined,
					tmdbId: autoAddMedia.tmdbId,
					mediaType: autoAddMedia.mediaType,
					title: autoAddMedia.title,
					image: autoAddMedia.image,
					rating: autoAddMedia.rating,
					release_date: autoAddMedia.release_date,
					overview: autoAddMedia.overview,
				});
			} else {
				await createList({
					name: trimmed,
					color: color || undefined,
				});
			}
			setName("");
			setColor("");
			setError("");
			onOpenChange(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save list");
		} finally {
			setSaving(false);
		}
	};

	const selectedColorName =
		PRESET_COLORS.find((c) => c.hex === color)?.name ?? null;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[380px] overflow-hidden rounded-2xl p-0">
				<div className="px-6 pt-4 pb-6 space-y-5">
					<DialogHeader className="space-y-1">
						<DialogTitle className="text-base font-semibold tracking-tight">
							{isEditing ? "Edit List" : "New List"}
						</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground">
							{isEditing
								? "Update your list details."
								: autoAddMedia
									? `Create a list and add "${autoAddMedia.title ?? "this title"}" to it.`
									: "Organize your watchlist into collections."}
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-2">
						<Label
							htmlFor={listNameId}
							className="text-xs font-medium text-muted-foreground"
						>
							Name
						</Label>
						<Input
							id={listNameId}
							type="text"
							placeholder="e.g. Weekend Binge, Sci-Fi Picks..."
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
								"h-auto w-full rounded-xl border bg-secondary/30 px-4 py-3 text-sm",
								"placeholder:text-muted-foreground/40",
								"transition-all duration-200",
								"focus-visible:border-foreground/20 focus-visible:bg-secondary/50 focus-visible:ring-1 focus-visible:ring-foreground/10",
								error ? "border-destructive/50" : "border-border/50",
							)}
						/>
						{name.trim() && (
							<div className="flex items-center gap-2 pt-1">
								<span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
									Preview
								</span>
								<span className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1 text-xs font-medium">
									{color && (
										<span
											className="size-2 rounded-full"
											style={{ backgroundColor: color }}
										/>
									)}
									{name.trim()}
								</span>
							</div>
						)}
					</div>

					<div className="space-y-2.5">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
								<Palette size={12} />
								Color
							</div>
							{selectedColorName && (
								<span className="text-[10px] text-muted-foreground/60">
									{selectedColorName}
								</span>
							)}
						</div>
						<div className="flex flex-wrap gap-2">
							{PRESET_COLORS.map((c) => {
								const isSelected = color === c.hex;
								return (
									<Button
										key={c.hex}
										type="button"
										variant="ghost"
										size="icon"
										aria-pressed={isSelected}
										className={cn(
											"relative size-8 rounded-full p-0 transition-all duration-200 hover:bg-transparent",
											isSelected
												? "ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110"
												: "hover:scale-110 hover:ring-1 hover:ring-foreground/20 hover:ring-offset-1 hover:ring-offset-background",
										)}
										style={{ backgroundColor: c.hex }}
										onClick={() => setColor(color === c.hex ? "" : c.hex)}
										aria-label={c.name}
									>
										{isSelected && (
											<Check
												size={14}
												className="absolute inset-0 m-auto text-white drop-shadow-sm"
												strokeWidth={3}
											/>
										)}
									</Button>
								);
							})}
						</div>
					</div>

					{error && (
						<p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
							{error}
						</p>
					)}

					<div className="flex items-center justify-end gap-2 pt-1">
						<Button
							variant="ghost"
							size="sm"
							className="rounded-xl px-4 text-xs"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button
							size="sm"
							className="rounded-xl px-5 text-xs"
							onClick={handleSubmit}
							disabled={saving || !name.trim()}
						>
							{saving
								? "Saving..."
								: isEditing
									? "Save Changes"
									: autoAddMedia
										? "Create & Add"
										: "Create List"}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
