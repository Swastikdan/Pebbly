import { Check, Globe, List, ListOrdered, Lock, Palette } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	useCreateCustomList,
	useCreateCustomListAndAddItem,
	useUpdateCustomList,
} from "@/hooks/useCustomLists";
import { cn } from "@/lib/utils";

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
	initialVisibility,
	initialListType,
	listId,
	autoAddMedia,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initialName?: string;
	initialColor?: string;
	initialVisibility?: string;
	initialListType?: string;
	listId?: string;
	autoAddMedia?: {
		tmdbId: number;
		mediaType: string;
		title?: string;
		image?: string;
		backdrop?: string;
		rating?: number;
		release_date?: string;
		overview?: string;
	};
}) {
	const [name, setName] = useState(initialName ?? "");
	const [description, setDescription] = useState("");
	const [color, setColor] = useState(initialColor ?? "");
	const [visibility, setVisibility] = useState<"private" | "public">("private");
	const [listType, setListType] = useState<"unordered" | "ordered">(
		"unordered",
	);
	const [showColorPicker, setShowColorPicker] = useState(false);
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);

	const createList = useCreateCustomList();
	const createListAndAdd = useCreateCustomListAndAddItem();
	const updateList = useUpdateCustomList();

	const isEditing = !!listId;
	const listNameId = useId();
	const listDescId = useId();

	useEffect(() => {
		if (open) {
			setName(initialName ?? "");
			setDescription("");
			setColor(initialColor ?? "");
			setVisibility((initialVisibility as "private" | "public") ?? "private");
			setListType((initialListType as "unordered" | "ordered") ?? "unordered");
			setShowColorPicker(false);
			setError("");
			setSaving(false);
		}
	}, [open, initialName, initialColor, initialVisibility, initialListType]);

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
					visibility,
					listType,
				});
			} else if (autoAddMedia) {
				await createListAndAdd({
					name: trimmed,
					color: color || undefined,
					visibility,
					listType,
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
					visibility,
					listType,
				});
			}
			setName("");
			setDescription("");
			setColor("");
			setError("");
			onOpenChange(false);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to save collection",
			);
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[420px] overflow-hidden rounded-3xl p-0">
				<div className="px-6 py-5 space-y-4">
					<DialogHeader className="relative">
						<DialogTitle className="text-lg font-semibold tracking-tight text-left pr-6">
							{isEditing ? "Edit Collection" : "Create New Collection"}
						</DialogTitle>
					</DialogHeader>

					{/* Collection Name Field */}
					<div className="space-y-1.5">
						<div className="flex justify-between items-center text-xs text-muted-foreground font-medium">
							<Label htmlFor={listNameId}>Collection Name</Label>
							<span>{name.length}/50</span>
						</div>
						<div className="relative flex items-center">
							<Input
								id={listNameId}
								type="text"
								placeholder="Enter a name for your collection"
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
									"h-11 w-full rounded-xl border bg-muted/40 pl-4 pr-16 text-xs transition-all duration-200",
									"placeholder:text-muted-foreground/40",
									"focus-visible:border-border/80 focus-visible:bg-muted/65 focus-visible:ring-1 focus-visible:ring-foreground/10",
									error ? "border-destructive/50" : "border-border/50",
								)}
							/>
							{/* Inline Lock & Color Icons */}
							<div className="absolute right-3 flex items-center gap-1.5">
								<div className="text-muted-foreground/60 p-1 rounded-lg">
									{visibility === "private" ? (
										<Lock size={14} />
									) : (
										<Globe size={14} />
									)}
								</div>
								<button
									type="button"
									onClick={() => setShowColorPicker(!showColorPicker)}
									className={cn(
										"size-5 rounded-full flex items-center justify-center cursor-pointer transition-all border border-border/40",
										color
											? "scale-105"
											: "bg-gradient-to-tr from-violet-500 to-cyan-400 hover:scale-105",
									)}
									style={color ? { backgroundColor: color } : undefined}
									title="Choose color"
								>
									{!color && <Palette size={10} className="text-white" />}
								</button>
							</div>
						</div>
					</div>

					{/* Color Picker Drawer */}
					{showColorPicker && (
						<div className="p-3 bg-muted/50 rounded-2xl border border-border/40 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
							<div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">
								Select Color
							</div>
							<div className="flex flex-wrap gap-2">
								{PRESET_COLORS.map((c) => {
									const isSelected = color === c.hex;
									return (
										<button
											key={c.hex}
											type="button"
											className={cn(
												"relative size-6 rounded-full transition-all duration-200 hover:scale-110 cursor-pointer border border-border/20",
												isSelected &&
													"ring-2 ring-foreground ring-offset-2 ring-offset-background",
											)}
											style={{ backgroundColor: c.hex }}
											onClick={() => setColor(color === c.hex ? "" : c.hex)}
											aria-label={c.name}
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
					)}

					{/* Description Field */}
					<div className="space-y-1.5">
						<div className="flex justify-between items-center text-xs text-muted-foreground font-medium">
							<Label htmlFor={listDescId}>Description</Label>
							<span>{description.length}/150</span>
						</div>
						<textarea
							id={listDescId}
							placeholder="Add a description (optional)"
							value={description}
							onChange={(e) => setDescription(e.target.value.substring(0, 150))}
							maxLength={150}
							className={cn(
								"min-h-[70px] w-full rounded-xl border bg-muted/40 p-3 text-xs resize-none outline-none transition-all duration-200",
								"placeholder:text-muted-foreground/40",
								"focus-visible:border-border/80 focus-visible:bg-muted/65 focus-visible:ring-1 focus-visible:ring-foreground/10",
								"border-border/50",
							)}
						/>
					</div>

					{/* Visibility & List Type Section */}
					<div className="grid grid-cols-2 gap-4">
						{/* Visibility Selection */}
						<div className="flex flex-col space-y-2">
							<Label className="text-xs text-muted-foreground font-medium">
								Visibility
							</Label>
							<div className="flex p-1 rounded-xl bg-muted/70 border border-border/50">
								<button
									type="button"
									onClick={() => setVisibility("private")}
									className={cn(
										"flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10.5px] rounded-lg cursor-pointer transition-all border",
										visibility === "private"
											? "bg-background text-foreground border-border/40 shadow-xs dark:shadow-none font-semibold"
											: "bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40",
									)}
								>
									<Lock size={11} />
									Private
								</button>
								<button
									type="button"
									onClick={() => setVisibility("public")}
									className={cn(
										"flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10.5px] rounded-lg cursor-pointer transition-all border",
										visibility === "public"
											? "bg-background text-foreground border-border/40 shadow-xs dark:shadow-none font-semibold"
											: "bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40",
									)}
								>
									<Globe size={11} />
									Public
								</button>
							</div>
							<div className="text-[10px] text-muted-foreground/80 leading-snug min-h-[30px]">
								{visibility === "private"
									? "Only you can see this watchlist"
									: "Anyone with link can view"}
							</div>
						</div>

						{/* List Type Selection */}
						<div className="flex flex-col space-y-2">
							<Label className="text-xs text-muted-foreground font-medium">
								List Type
							</Label>
							<div className="flex p-1 rounded-xl bg-muted/70 border border-border/50">
								<button
									type="button"
									onClick={() => setListType("unordered")}
									className={cn(
										"flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10.5px] rounded-lg cursor-pointer transition-all border",
										listType === "unordered"
											? "bg-background text-foreground border-border/40 shadow-xs dark:shadow-none font-semibold"
											: "bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40",
									)}
								>
									<List size={11} />
									Unordered
								</button>
								<button
									type="button"
									onClick={() => setListType("ordered")}
									className={cn(
										"flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10.5px] rounded-lg cursor-pointer transition-all border",
										listType === "ordered"
											? "bg-background text-foreground border-border/40 shadow-xs dark:shadow-none font-semibold"
											: "bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40",
									)}
								>
									<ListOrdered size={11} />
									Ordered
								</button>
							</div>
							<div className="text-[10px] text-muted-foreground/80 leading-snug min-h-[30px]">
								{listType === "unordered"
									? "Items are in a simple list"
									: "Items are numbered/ranked"}
							</div>
						</div>
					</div>

					{error && (
						<p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
							{error}
						</p>
					)}

					<Button
						onClick={handleSubmit}
						disabled={saving || !name.trim()}
						className="w-full h-11 rounded-xl text-xs font-bold transition-all cursor-pointer mt-1"
					>
						{saving
							? "Saving..."
							: isEditing
								? "Save Changes"
								: "Create Collection"}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
