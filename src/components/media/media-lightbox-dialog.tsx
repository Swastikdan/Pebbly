import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

interface MediaLightboxDialogProps {
	isOpen: boolean;
	title: string;
	onClose: () => void;
	hasPrev: boolean;
	hasNext: boolean;
	onPrev: () => void;
	onNext: () => void;
	overlayClassName?: string;
	contentClassName?: string;
	children: React.ReactNode;
}

export function MediaLightboxDialog({
	isOpen,
	title,
	onClose,
	hasPrev,
	hasNext,
	onPrev,
	onNext,
	overlayClassName = "bg-white/40 backdrop-blur-lg dark:bg-black/70",
	contentClassName = "aspect-video w-full max-w-[95vw] sm:max-w-[85vw] rounded-2xl border-0 bg-transparent p-0 ring-0 overflow-hidden",
	children,
}: MediaLightboxDialogProps) {
	return (
		<Dialog
			open={isOpen}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent
				overlayClassName={overlayClassName}
				className={contentClassName}
			>
				<DialogHeader className="sr-only">
					<DialogTitle>{title}</DialogTitle>
				</DialogHeader>
				{children}
				{hasPrev && (
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label="Previous item"
						className="absolute left-4 top-1/2 z-50 -translate-y-1/2 rounded-lg bg-black/50 p-2 text-white ring-0 transition-colors hover:bg-black/70 hover:text-white focus-visible:ring-0"
						onClick={(e) => {
							e.stopPropagation();
							onPrev();
						}}
					>
						<ChevronLeft className="size-6" />
					</Button>
				)}
				{hasNext && (
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label="Next item"
						className="absolute right-4 top-1/2 z-50 -translate-y-1/2 rounded-lg bg-black/50 p-2 text-white ring-0 transition-colors hover:bg-black/70 hover:text-white focus-visible:ring-0"
						onClick={(e) => {
							e.stopPropagation();
							onNext();
						}}
					>
						<ChevronRight className="size-6" />
					</Button>
				)}
			</DialogContent>
		</Dialog>
	);
}
