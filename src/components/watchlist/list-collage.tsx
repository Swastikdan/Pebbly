import { ListPlus } from "lucide-react";
import { Image } from "@/components/ui/image";
import { IMAGE_PREFIX } from "@/constants";

const imgClass = "size-full object-cover transition-transform duration-500";

export function ListCollage({
	previews,
	color,
}: {
	previews: string[];
	color?: string;
}) {
	const fallbackBg = color
		? `linear-gradient(135deg, ${color}10 0%, ${color}25 100%)`
		: "linear-gradient(135deg, hsl(var(--secondary)) 0%, hsl(var(--muted)) 100%)";

	if (previews.length === 0) {
		return (
			<div
				className="flex size-full items-center justify-center rounded-xl border border-border/20 shadow-inner bg-card transition-colors duration-300"
				style={{ background: fallbackBg }}
			>
				<ListPlus
					size={28}
					className="text-muted-foreground/40 transition-transform duration-300"
				/>
			</div>
		);
	}

	if (previews.length === 1) {
		return (
			<div className="relative size-full overflow-hidden rounded-xl border border-border/20 shadow-sm bg-border/20">
				<Image
					src={`${IMAGE_PREFIX.LQ_BACKDROP}${previews[0]}`}
					alt="List preview"
					layout="fullWidth"
					className={`${imgClass} group-hover:scale-105`}
				/>
				<div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
			</div>
		);
	}

	if (previews.length === 2) {
		return (
			<div className="grid size-full grid-cols-2 gap-0.5 overflow-hidden rounded-xl border border-border/20 shadow-sm bg-border/20">
				{previews.slice(0, 2).map((preview, i) => (
					<div key={preview} className="overflow-hidden size-full">
						<Image
							src={`${IMAGE_PREFIX.LQ_BACKDROP}${preview}`}
							alt={`List preview ${i + 1}`}
							layout="fullWidth"
							className={`${imgClass} group-hover:scale-105`}
						/>
					</div>
				))}
			</div>
		);
	}

	if (previews.length === 3) {
		return (
			<div className="grid size-full grid-cols-3 gap-0.5 overflow-hidden rounded-xl border border-border/20 shadow-sm bg-border/20">
				<div className="col-span-2 h-full overflow-hidden">
					<Image
						src={`${IMAGE_PREFIX.LQ_BACKDROP}${previews[0]}`}
						alt="List preview 1"
						layout="fullWidth"
						className={`${imgClass} group-hover:scale-105`}
					/>
				</div>
				<div className="grid grid-rows-2 gap-0.5 h-full overflow-hidden">
					{previews.slice(1, 3).map((preview, i) => (
						<div key={preview} className="overflow-hidden size-full">
							<Image
								src={`${IMAGE_PREFIX.LQ_BACKDROP}${preview}`}
								alt={`List preview ${i + 2}`}
								layout="fullWidth"
								className={`${imgClass} group-hover:scale-105`}
							/>
						</div>
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="grid size-full grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-xl border border-border/20 shadow-sm bg-border/20">
			{previews.map((preview, i) => (
				<div key={preview} className="overflow-hidden size-full">
					<Image
						src={`${IMAGE_PREFIX.LQ_BACKDROP}${preview}`}
						alt={`List preview ${i + 1}`}
						layout="fullWidth"
						className={`${imgClass} group-hover:scale-105`}
					/>
				</div>
			))}
		</div>
	);
}
