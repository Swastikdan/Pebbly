import { useUser } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import {
	DropdownMenuCheckboxItem,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { queryKeys } from "@/lib/query/keys";
import { useRepository } from "@/lib/repository/use-repository";
import { getCustomLists, getItemLists } from "@/server/fns/lists";
import { unwrap } from "@/server/schema/common";
import { CustomListDialog } from "./custom-list-dialog";

export function CustomListPicker({
	tmdbId,
	mediaType,
}: {
	tmdbId: number;
	mediaType: "movie" | "tv";
}) {
	const { isSignedIn, user } = useUser();
	const repository = useRepository();
	const listsQuery = useQuery({
		queryKey: queryKeys.lists.all(user?.id),
		queryFn: () => unwrap(getCustomLists()),
		enabled: !!isSignedIn,
	});
	const itemListsQuery = useQuery({
		queryKey: queryKeys.lists.itemLists(tmdbId, mediaType, user?.id),
		queryFn: () => unwrap(getItemLists({ data: { tmdbId, mediaType } })),
		enabled: !!isSignedIn,
	});
	const [showCreateDialog, setShowCreateDialog] = useState(false);

	const safeList = listsQuery.data ?? [];
	const safeItemLists = itemListsQuery.data ?? [];

	return (
		<>
			<DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
				Collections
			</DropdownMenuLabel>
			<DropdownMenuGroup>
				{" "}
				{safeList
					.filter((list) => list.listType !== "pebbly-picks")
					.map((list) => {
						const isInList = safeItemLists.includes(list.id);
						return (
							<DropdownMenuCheckboxItem
								key={list.id}
								checked={isInList}
								className="rounded-lg"
								onSelect={(e) => e.preventDefault()}
								onCheckedChange={() => {
									void repository
										.toggleListItem({
											listId: list.id,
											tmdbId,
											mediaType,
										})
										.catch((error) =>
											console.error("Failed to toggle list item", error),
										);
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
					Create new collection
				</DropdownMenuItem>
			</DropdownMenuGroup>

			<CustomListDialog
				open={showCreateDialog}
				onOpenChange={setShowCreateDialog}
			/>
		</>
	);
}
