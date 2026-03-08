import { ScrollContainer } from "@/components/scroll-container";
import { Badge } from "@/components/ui/badge";

export const GenreContainer = (props: {
	genres: Array<{ id: number; name: string }>;
}) => {
	return (
		<ScrollContainer>
			<div className="flex gap-1.5 py-1">
				{props.genres.map((genre) => (
					<Badge
						key={genre.id}
						aria-label={`Genre: ${genre.name}`}
						className="text-xs rounded-lg px-3 py-1 font-medium"
						role="listitem"
						variant="secondary"
					>
						{genre?.name}
					</Badge>
				))}
			</div>
		</ScrollContainer>
	);
};
