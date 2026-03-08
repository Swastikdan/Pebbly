import { SignInButton } from "@clerk/clerk-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { RefreshCw, Sparkles } from "lucide-react";
import { GoBack } from "@/components/go-back";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
	useRecommendationAccess,
	useRecommendations,
} from "@/hooks/useRecommendations";
import { cn } from "@/lib/utils";
import type { AIRecommendation } from "@/types";

export const Route = createFileRoute("/recommendations")({
	head: () => ({
		meta: [
			{ title: "AI Recommendations | Film Fanatic" },
			{
				name: "description",
				content: "AI-powered movie and TV show recommendations based on your watchlist.",
			},
		],
	}),
	component: RecommendationsPage,
});

function RecommendationsPage() {
	const { hasAccess, loading: accessLoading, reason, isSignedIn } =
		useRecommendationAccess();

	if (!isSignedIn) {
		return (
			<PageShell>
				<div className="flex flex-col items-center justify-center gap-4 py-20">
					<Sparkles className="size-12 text-muted-foreground" />
					<h2 className="text-lg font-semibold">Sign in to get AI recommendations</h2>
					<p className="text-sm text-muted-foreground max-w-md text-center">
						Get personalized movie and TV show suggestions based on your watchlist, viewing progress, and reactions.
					</p>
					<SignInButton mode="modal">
						<Button variant="secondary" size="lg">
							Sign In
						</Button>
					</SignInButton>
				</div>
			</PageShell>
		);
	}

	if (accessLoading) {
		return (
			<PageShell>
				<LoadingSkeletons />
			</PageShell>
		);
	}

	if (!hasAccess) {
		return (
			<PageShell>
				<div className="flex flex-col items-center justify-center gap-4 py-20">
					<Sparkles className="size-12 text-muted-foreground" />
					<h2 className="text-lg font-semibold">Feature Not Available</h2>
					<p className="text-sm text-muted-foreground max-w-md text-center">
						{reason === "insufficient_role"
							? "Your account does not have access to AI recommendations."
							: reason === "feature_disabled"
								? "AI recommendations are not enabled for your account."
								: "Unable to access AI recommendations."}
					</p>
				</div>
			</PageShell>
		);
	}

	return (
		<PageShell>
			<RecommendationsContent />
		</PageShell>
	);
}

function PageShell({ children }: { children: React.ReactNode }) {
	return (
		<section className="flex min-h-screen w-full justify-center">
			<div className="w-full max-w-screen-xl p-5">
				<div className="mb-6 flex items-center justify-between gap-3">
					<GoBack title="Back" hideLabelOnMobile />
				</div>
				<h1 className="mb-6 text-2xl font-bold">AI Recommendations</h1>
				{children}
			</div>
		</section>
	);
}

function RecommendationsContent() {
	const {
		recommendations,
		inputStats,
		generatedAt,
		model,
		isGenerating,
		error,
		generate,
	} = useRecommendations();

	const errorMessages: Record<string, string> = {
		empty_watchlist: "Add some movies or TV shows to your watchlist first to get recommendations.",
		api_unavailable: "The AI service is temporarily unavailable. Please try again later.",
		invalid_response: "The AI returned an unexpected response. Please try again.",
		rate_limited: "Please wait a few minutes before generating new recommendations.",
	};

	return (
		<div className="space-y-6">
			{/* Transparency stats */}
			{inputStats && (
				<div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
					<span>
						Based on: {inputStats.movieCount} movie{inputStats.movieCount !== 1 ? "s" : ""},{" "}
						{inputStats.tvCount} TV show{inputStats.tvCount !== 1 ? "s" : ""},{" "}
						{inputStats.episodesWatched} episode{inputStats.episodesWatched !== 1 ? "s" : ""} watched
					</span>
					{model && (
						<span className="text-xs text-muted-foreground/70">
							Model: {model}
						</span>
					)}
					{generatedAt && (
						<span className="text-xs text-muted-foreground/70">
							Generated: {new Date(generatedAt).toLocaleDateString(undefined, {
								month: "short",
								day: "numeric",
								hour: "2-digit",
								minute: "2-digit",
							})}
						</span>
					)}
				</div>
			)}

			{/* Generate / Refresh button */}
			<Button
				onClick={generate}
				disabled={isGenerating}
				variant="secondary"
				className="gap-2"
			>
				{isGenerating ? (
					<RefreshCw className="size-4 animate-spin" />
				) : recommendations ? (
					<RefreshCw className="size-4" />
				) : (
					<Sparkles className="size-4" />
				)}
				{isGenerating
					? "Generating..."
					: recommendations
						? "Refresh Recommendations"
						: "Generate Recommendations"}
			</Button>

			{/* Error */}
			{error && (
				<div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
					{errorMessages[error] ?? error}
				</div>
			)}

			{/* Loading */}
			{isGenerating && !recommendations && <LoadingSkeletons />}

			{/* Results */}
			{recommendations && recommendations.length > 0 && (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{recommendations.map((rec, i) => (
						<RecommendationCard key={`${rec.title}-${i}`} recommendation={rec} />
					))}
				</div>
			)}

			{/* Empty state (has generated but 0 results) */}
			{recommendations && recommendations.length === 0 && !isGenerating && (
				<div className="flex flex-col items-center justify-center gap-4 py-20">
					<p className="text-muted-foreground">
						No recommendations could be generated. Try adding more items to your watchlist.
					</p>
				</div>
			)}
		</div>
	);
}

function RecommendationCard({
	recommendation,
}: { recommendation: AIRecommendation }) {
	const { title, tmdbId, mediaType, relevanceScore, reasoning } =
		recommendation;

	const scoreColor =
		relevanceScore >= 80
			? "bg-green-500/15 text-green-700 dark:text-green-400"
			: relevanceScore >= 60
				? "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400"
				: "bg-secondary text-muted-foreground";

	const titleContent = (
		<span className="font-semibold leading-tight">{title}</span>
	);

	return (
		<div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 transition-colors hover:border-foreground/20">
			<div className="flex items-start justify-between gap-2">
				<div className="flex-1 min-w-0">
					{tmdbId ? (
						<Link
							// @ts-expect-error - dynamic route
							to={`/${mediaType}/${tmdbId}`}
							className="hover:underline"
						>
							{titleContent}
						</Link>
					) : (
						titleContent
					)}
				</div>
				<Badge
					className={cn("shrink-0 tabular-nums", scoreColor)}
				>
					{relevanceScore}%
				</Badge>
			</div>

			<div className="flex items-center gap-2">
				<Badge variant="secondary" className="text-xs uppercase">
					{mediaType}
				</Badge>
			</div>

			<p className="text-sm text-muted-foreground leading-relaxed">
				{reasoning}
			</p>
		</div>
	);
}

function LoadingSkeletons() {
	return (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-6">
			{Array.from({ length: 6 }).map((_, i) => (
				<div
					key={i}
					className="flex flex-col gap-3 rounded-2xl border bg-card p-4"
				>
					<div className="flex items-start justify-between gap-2">
						<Skeleton className="h-5 w-3/4" />
						<Skeleton className="h-5 w-12 rounded-full" />
					</div>
					<Skeleton className="h-5 w-16 rounded-full" />
					<Skeleton className="h-12 w-full" />
				</div>
			))}
		</div>
	);
}
