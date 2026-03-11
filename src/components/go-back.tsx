import { useNavigate, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "@/components/ui/icons";

export const GoBack = (props: {
	title?: string;
	link?: string;
	className?: string;
	hideLabelOnMobile?: boolean;
}) => {
	const navigate = useNavigate();
	const router = useRouter();
	const { title, link, className, hideLabelOnMobile = false } = props;

	function goBack() {
		if (link) {
			// Use replace here so the fallback destination does not create a back-button loop.
			navigate({ to: link, replace: true });
		} else {
			router.history.back();
		}
	}

	return (
		<Button className={className} variant="secondary" onClick={goBack}>
			<span className="flex w-full items-center gap-1">
				<ArrowLeft size={20} />
				<span className={hideLabelOnMobile ? "hidden sm:inline" : "inline"}>
					{title ?? "Go Back"}
				</span>
			</span>
		</Button>
	);
};
