import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function DefaultLoader(props: React.ComponentProps<"output">) {
	return (
		<output
			aria-label="Loading content"
			aria-busy="true"
			className={cn(
				"grid min-h-[calc(100vh-100px)] w-full animate-fade-in place-items-center",
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
