import { useUser } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { ShareBold } from "@/components/ui/icons";

export const ShareButton = (props: {
	title?: string;
	hideLabelOnMobile?: boolean;
}) => {
	const { hideLabelOnMobile } = props;
	const { isSignedIn } = useUser();
	const shouldHideLabelOnMobile = hideLabelOnMobile && !!isSignedIn;

	async function handleShare() {
		if (navigator.share) {
			await navigator.share({
				title: props.title,
				url: window.location.href,
			});
		} else {
			const textToCopy = `${props.title} ${window.location.href}`;

			try {
				await navigator.clipboard.writeText(textToCopy);
				alert("Link copied to clipboard");
			} catch {
				const textArea = document.createElement("textarea");

				textArea.value = textToCopy;
				document.body.appendChild(textArea);
				textArea.select();
				document.execCommand("copy");
				document.body.removeChild(textArea);
				alert("Link copied to clipboard");
			}
		}
	}

	return (
		<Button variant="secondary" onClick={() => void handleShare()}>
			<span className="flex w-full items-center gap-1">
				<ShareBold size={24} />
					<span className={shouldHideLabelOnMobile ? "hidden sm:inline" : "inline"}>
					Share
				</span>
			</span>
		</Button>
	);
};
