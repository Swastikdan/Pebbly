import { useMutation } from "convex/react";
import { Check, Palette } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { api } from "../../convex/_generated/api";

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
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initialName?: string;
	initialColor?: string;
	listId?: string;
}) {
	const [name, setName] = useState(initialName ?? "");
	const [color, setColor] = useState(initialColor ?? "");
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);

	const createList = useMutation(api.watchlist.createCustomList);
	const updateList = useMutation(api.watchlist.updateCustomList);

	const isEditing = !!listId;

	// Reset state when dialog opens
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
					listId: listId as any,
					name: trimmed,
					color: color || undefined,
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
				{/* Colored accent strip at top */}
				<div
					className="h-1.5 w-full transition-colors duration-300"
					style={{
						backgroundColor: color || "transparent",
					}}
				/>

				<div className="px-6 pt-4 pb-6 space-y-5">
					<DialogHeader className="space-y-1">
						<DialogTitle className="text-base font-semibold tracking-tight">
							{isEditing ? "Edit List" : "New List"}
						</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground">
							{isEditing
								? "Update your list details."
								: "Organize your watchlist into collections."}
						</DialogDescription>
					</DialogHeader>

					{/* Name input */}
					<div className="space-y-2">
						<label
							htmlFor="list-name-input"
							className="text-xs font-medium text-muted-foreground"
						>
							Name
						</label>
						<input
							id="list-name-input"
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
								"w-full rounded-xl border bg-secondary/30 px-4 py-3 text-sm",
								"placeholder:text-muted-foreground/40",
								"outline-none transition-all duration-200",
								"focus:border-foreground/20 focus:bg-secondary/50 focus:ring-1 focus:ring-foreground/10",
								error ? "border-destructive/50" : "border-border/50",
							)}
						/>
						{/* Live preview of the list chip */}
						{name.trim() && (
							<div className="flex items-center gap-2 pt-1">
								<span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
									Preview
								</span>
								<span
									className="inline-flex items-center rounded-xl px-4 py-1.5 text-sm font-medium"
									style={{
										backgroundColor: color
											? `color-mix(in oklch, ${color} 35%, var(--secondary))`
											: "var(--secondary)",
										color: color
											? `color-mix(in oklch, ${color} 70%, var(--foreground))`
											: undefined,
									}}
								>
									{name.trim()}
								</span>
							</div>
						)}
					</div>

					{/* Color picker */}
					<div className="space-y-2.5">
						<div className="flex items-center justify-between">
							<label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
								<Palette size={12} />
								Color
							</label>
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
									<button
										key={c.hex}
										type="button"
										className={cn(
											"relative size-8 rounded-full transition-all duration-200",
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
									</button>
								);
							})}
						</div>
					</div>

					{/* Error */}
					{error && (
						<p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
							{error}
						</p>
					)}

					{/* Actions */}
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
									: "Create List"}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
