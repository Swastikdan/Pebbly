import { DefaultLoader } from "@/components/default-loader";

import { useWatchlist } from "@/store/usewatchlist";
import { MediaCard } from "@/components/media-card";

export const WatchListContainer = () => {
	const { watchlist, loading } = useWatchlist();

	return (
		<div className="flex min-h-96 w-full items-center justify-center">
			{loading ? (
				<DefaultLoader />
			) : watchlist && watchlist.length > 0 ? (
				<div className="grid w-full grid-cols-2 gap-3 xs:gap-4 py-10 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
					{watchlist.map(
						(item) =>
							item && (
								<MediaCard
									card_type="horizontal"
									key={item.external_id}
									id={Number(item.external_id)}
									image={item.image ?? ""}
									is_on_watchlist_page={true}
									media_type={item.type}
									poster_path={item.image ?? ""}
									rating={item.rating ?? 0}
									release_date={item.release_date ?? null}
									title={item.title}
								/>
							),
					)}
				</div>
			) : (
				<p className="w-full pb-20 text-center font-bold font-heading text-lg md:text-xl lg:text-2xl">
					No items in your watchlist
				</p>
			)}
		</div>
	);
};
