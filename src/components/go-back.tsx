import { useNavigate, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "@/components/ui/icons";

export const GoBack = (props: {
	title?: string;
	link?: string;
	className?: string;
}) => {
	const navigate = useNavigate();
	const router = useRouter();
	const { title, link, className } = props;

	function goBack() {
		if (link) {
			navigate({
				to: link,
			});
		} else {
			router.history.back();
		}
	}

	return (
		<Button className={className} variant="secondary" onClick={() => goBack()}>
			<span className="flex w-full items-center gap-1">
				<ArrowLeft size={24} />
				<span className="hidden sm:inline">{title ?? "Go Back"}</span>
			</span>
		</Button>
	);
};
