import { useUser } from "@clerk/clerk-react";
import { useMutation, useQuery } from "convex/react";
import { Plus } from "lucide-react";
import { useState } from "react";
import {
	DropdownMenuCheckboxItem,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { api } from "../../convex/_generated/api";
import { CustomListDialog } from "./custom-list-dialog";

const QUERY_SKIP = "skip" as const;

export function CustomListPicker({
	tmdbId,
	mediaType,
}: {
	tmdbId: number;
	mediaType: string;
}) {
	const { isSignedIn } = useUser();
	const lists = useQuery(
		api.watchlist.getCustomLists,
		isSignedIn ? {} : QUERY_SKIP,
	);
	const itemLists = useQuery(
		api.watchlist.getItemLists,
		isSignedIn ? { tmdbId, mediaType } : QUERY_SKIP,
	);
	const toggleListItem = useMutation(api.watchlist.toggleListItem);
	const [showCreateDialog, setShowCreateDialog] = useState(false);

	// If queries haven't loaded yet or errored, still show the create option
	const safeList = lists ?? [];
	const safeItemLists = itemLists ?? [];

	return (
		<>
			<DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
				Lists
			</DropdownMenuLabel>
			<DropdownMenuGroup>
				{safeList.map((list) => {
					const isInList = safeItemLists.includes(list._id);
					return (
						<DropdownMenuCheckboxItem
							key={list._id}
							checked={isInList}
							className="rounded-lg"
							onSelect={(e) => e.preventDefault()}
							onCheckedChange={() => {
								toggleListItem({
									listId: list._id,
									tmdbId,
									mediaType,
								});
							}}
						>
							{list.color && (
								<span
									className="size-2 rounded-full shrink-0"
									style={{ backgroundColor: list.color }}
								/>
							)}
							{list.name}
						</DropdownMenuCheckboxItem>
					);
				})}
				<DropdownMenuItem
					className="rounded-lg"
					onSelect={(e) => {
						e.preventDefault();
						setShowCreateDialog(true);
					}}
				>
					<Plus size={16} />
					Create new list
				</DropdownMenuItem>
			</DropdownMenuGroup>

			<CustomListDialog
				open={showCreateDialog}
				onOpenChange={setShowCreateDialog}
			/>
		</>
	);
}
