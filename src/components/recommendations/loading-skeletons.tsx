import { MediaCardSkeleton } from "@/components/media-card";
import { HORIZONTAL_MEDIA_GRID_CLASS } from "@/constants";

export function LoadingSkeletons() {
	return (
		<div className="space-y-6 animate-fade-in">
			<div className="flex items-center gap-1.5 text-sm text-muted-foreground">
				<div className="size-4 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/60" />
				Analyzing your watchlist...
			</div>
			<div className={`stagger-grid ${HORIZONTAL_MEDIA_GRID_CLASS}`}>
				{Array.from({ length: 8 }).map((_, i) => (
					<MediaCardSkeleton key={i} card_type="horizontal" />
				))}
			</div>
		</div>
	);
}
