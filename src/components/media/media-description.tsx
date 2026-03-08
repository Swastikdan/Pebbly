import { useState } from "react";
import { Button } from "@/components/ui/button";

export const MediaDescription = ({ description }: { description: string }) => {
	const [isFullTextVisible, setIsFullTextVisible] = useState(false);
	const toggleText = () => setIsFullTextVisible(!isFullTextVisible);

	return (
		<div className="py-3">
			<h3 className="text-lg font-semibold md:text-xl">Overview</h3>
			<div className="py-1.5 text-sm leading-relaxed text-foreground/90 sm:text-[15px]">
				<span className="hidden md:flex">{description}</span>
				<span className="flex flex-col md:hidden">
					{isFullTextVisible ? (
						<span>{description}</span>
					) : (
						<span>{description.substring(0, 100)}...</span>
					)}
					<Button
						className="text-foreground w-fit justify-end text-xs md:hidden"
						size="sm"
						variant="link"
						onClick={toggleText}
					>
						{isFullTextVisible ? "Read Less" : "Read More"}
					</Button>
				</span>
			</div>
		</div>
	);
};
