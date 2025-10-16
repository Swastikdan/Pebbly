import { createFileRoute } from "@tanstack/react-router";
import { useId } from "react";
import { DefaultEmptyState } from "@/components/default-empty-state";
import { DefaultLoader } from "@/components/default-loader";
import { MediaCard } from "@/components/media-card";
import { Button } from "@/components/ui/button";
import { Download, Upload } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/spinner";
import { useWatchlist } from "@/hooks/usewatchlist";
import { useWatchlistImportExport } from "@/hooks/usewatchlistimportexport";

export const Route = createFileRoute("/watchlist")({
	head: () => ({
		meta: [
			{ title: "Watchlist | Film Fanatic" },
			{
				name: "description",
				content: "Your saved movies and TV shows.",
			},
		],
	}),
	component: WatchlistPage,
});

function WatchlistPage() {
	const importInputId = useId();
	const { watchlist: watchlistData, loading: watchlistLoading } =
		useWatchlist();
	const {
		importLoading,
		exportLoading,
		error,
		watchlist,
		fileInputRef,
		exportWatchlist,
		importWatchlist,
		handleImportClick,
		handleKeyDown,
	} = useWatchlistImportExport();

	return (
		<section className="flex min-h-screen w-full justify-center">
			<div className="w-full max-w-screen-xl p-5">
				<div className="mb-6">
					<h1 className="text-start text-4xl font-bold">Watchlist</h1>
					<p className="mt-2 text-start text-lg">
						Your saved movies and TV shows
					</p>
				</div>

				{error && (
					<div
						className={`mb-4 rounded-md p-3 text-sm ${
							error.invalidItems
								? "bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200"
								: "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200"
						}`}
						role="alert"
					>
						{error.message}
					</div>
				)}

				<div className="mb-6 flex justify-end">
					<div className="flex gap-4">
						{(watchlist?.length ?? 0) > 0 && (
							<Button
								className="gap-2 rounded-[calc(var(--radius-md)+3px)]"
								disabled={exportLoading || importLoading}
								variant="secondary"
								onClick={exportWatchlist}
								aria-label="Export watchlist to JSON file"
							>
								{exportLoading ? (
									<Spinner color="current" />
								) : (
									<Download size={20} />
								)}
								Export
							</Button>
						)}
						<Button
							className="gap-2 rounded-[calc(var(--radius-md)+3px)]"
							disabled={importLoading || exportLoading}
							variant="secondary"
							onClick={handleImportClick}
							onKeyDown={handleKeyDown}
							aria-label="Import watchlist from JSON file"
						>
							<input
								ref={fileInputRef}
								accept=".json,application/json"
								className="hidden"
								disabled={importLoading || exportLoading}
								id={importInputId}
								type="file"
								onChange={importWatchlist}
							/>
							{importLoading ? (
								<Spinner color="current" />
							) : (
								<Upload size={20} />
							)}
							Import
						</Button>
					</div>
				</div>

				{watchlistLoading ? (
					<DefaultLoader className="min-h-[clac(100vh-112px)] grid h-full  place-content-center items-center justify-center" />
				) : error ? (
					<DefaultEmptyState message={error.message} description={false} />
				) : watchlistData?.length === 0 ? (
					<DefaultEmptyState
						message="No items in your watchlist"
						description={false}
					/>
				) : (
					<div className="grid w-full grid-cols-2 gap-3 xs:gap-4 py-10 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
						{watchlistData.map(
							(item) =>
								item && (
									<MediaCard
										card_type="horizontal"
										key={item.external_id}
										id={parseInt(item.external_id, 10)}
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
				)}
			</div>
		</section>
	);
}
