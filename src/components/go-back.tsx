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
			<span className="w-full flex items-center gap-1">
				<ArrowLeft size={24} />
				{title ?? "Go Back"}
			</span>
		</Button>
	);
};
