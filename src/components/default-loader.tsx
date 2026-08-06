import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function DefaultLoader(props: React.ComponentProps<"output">) {
	return (
		<output
			aria-label="Loading content"
			aria-busy="true"
			className={cn(
				"grid min-h-[calc(100dvh-var(--navbar-height,4rem)-var(--mobile-nav-height,4.75rem))] md:min-h-[calc(100dvh-5rem)] min-w-[320px] w-full animate-fade-in place-items-center py-8",
				props.className,
			)}
			{...props}
		>
			<div className="grid size-12 place-items-center rounded-xl">
				<Spinner size="md" className="bg-foreground/70" />
			</div>
			<span className="sr-only">Loading content</span>
		</output>
	);
}
