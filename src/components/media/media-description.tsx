import { useState } from "react";
import { Button } from "@/components/ui/button";

export const MediaDescription = ({ description }: { description: string }) => {
	const [isFullTextVisible, setIsFullTextVisible] = useState(false);
	const toggleText = () => setIsFullTextVisible(!isFullTextVisible);

	return (
		<div className="py-3">
			<span className="text-xl font-semibold md:text-2xl">Overview</span>
			<div className="py-1 text-sm sm:text-base">
				<span className="hidden md:flex">{description}</span>
				<span className="flex flex-col md:hidden">
					{isFullTextVisible ? (
						<span>{description}</span>
					) : (
						<span>{description.substring(0, 100)}</span>
					)}
					<Button
						className="text-foreground  w-fit justify-end md:hidden"
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
