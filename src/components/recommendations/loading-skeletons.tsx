import { MediaCardSkeleton } from "@/components/media-card";
import { MediaGrid } from "@/components/ui/media-grid";

interface LoadingSkeletonsProps {
	count?: number;
	showMessage?: boolean;
	message?: string;
}

export function LoadingSkeletons({
	count = 12,
	showMessage = true,
	message = "Analyzing your watchlist...",
}: LoadingSkeletonsProps = {}) {
	const skeletonKeys = Array.from({ length: count }, (_, i) => `skeleton-${i}`);
	return (
		<div className="space-y-6 animate-fade-in">
			{showMessage && (
				<div className="flex items-center gap-1.5 text-sm text-muted-foreground">
					<div className="size-4 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/60" />
					{message}
				</div>
			)}
			<MediaGrid stagger>
				{skeletonKeys.map((key) => (
					<MediaCardSkeleton key={key} card_type="horizontal" />
				))}
			</MediaGrid>
		</div>
	);
}
