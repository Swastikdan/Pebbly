import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function DefaultLoader(props: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"grid h-full min-h-screen place-content-center items-center justify-center",
				props.className,
			)}
			{...props}
		>
			<Spinner size="md" className="bg-black dark:bg-white" />
		</div>
	);
}
