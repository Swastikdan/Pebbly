import { Spinner } from "@/components/ui/spinner";

export function DefaultLoader() {
	return (
		<div className="grid h-full min-h-screen place-content-center items-center justify-center">
			<Spinner size="md" className="bg-black dark:bg-white" />
		</div>
	);
}
