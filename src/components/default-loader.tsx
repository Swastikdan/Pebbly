import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function DefaultLoader(props: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"grid h-full min-h-[calc(100vh-200px)] place-content-center items-center justify-center animate-fade-in",
				props.className,
			)}
			{...props}
		>
			<Spinner size="md" className="bg-foreground/60" />
		</div>
	);
}
