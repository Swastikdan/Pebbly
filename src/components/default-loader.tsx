import { cn } from "@/lib/utils";

export function DefaultLoader(props: React.ComponentProps<"section">) {
	return (
		<section
			aria-label="Loading content"
			aria-live="polite"
			aria-busy="true"
			className={cn(
				"mx-auto min-h-[calc(100vh-100px)] w-full max-w-screen-xl px-4 py-8 md:px-6",
				props.className,
			)}
			{...props}
		>
			<div className="overflow-hidden rounded-2xl border border-white/10 bg-card shadow-[0_1px_0_rgb(255_255_255/0.06)_inset,0_16px_48px_rgb(0_0_0/0.18)]">
				<div className="h-40 shimmer md:h-52" />
				<div className="grid gap-5 p-5 sm:grid-cols-[8rem_1fr] md:p-7">
					<div className="hidden aspect-[2/3] rounded-xl shimmer shadow-lg sm:block" />
					<div className="space-y-4 py-1">
						<div className="h-7 w-2/3 rounded-md shimmer" />
						<div className="h-4 w-1/3 rounded-md shimmer" />
						<div className="space-y-2 pt-3">
							<div className="h-3.5 w-full rounded shimmer" />
							<div className="h-3.5 w-11/12 rounded shimmer" />
							<div className="h-3.5 w-3/4 rounded shimmer" />
						</div>
					</div>
				</div>
			</div>
			<span className="sr-only">Loading page</span>
		</section>
	);
}
