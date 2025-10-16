import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

export const DefaultEmptyState = (props: {
	message?: string;
	description?: boolean;
	onReset?: () => void;
	isHome?: boolean;

	className?: string;
}) => {
	return (
		<Empty
			className={cn(
				"border border-dashed my-10 min-h-[calc(100vh-200px)] w-full",
				props.className,
			)}
		>
			<EmptyHeader className="max-w-xl">
				<EmptyTitle className="font-light">
					{props.message ?? "No movies or TV shows found"}
				</EmptyTitle>
				{(props.description ?? true) && (
					<EmptyDescription>
						Try searching for something else or reset filters.
					</EmptyDescription>
				)}
			</EmptyHeader>
			{props.onReset && (
				<EmptyContent>
					<Button
						onClick={props.onReset}
						variant="outline"
						size="lg"
						className="rounded-lg h-9"
					>
						{props.isHome ? "Go Home" : "Reset"}
					</Button>
				</EmptyContent>
			)}
		</Empty>
	);
};
