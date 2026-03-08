import { REACTION_OPTIONS } from "@/constants/watchlist";
import { cn } from "@/lib/utils";
import type { ReactionStatus } from "@/types";

export function ReactionSelector({
	value,
	onChange,
}: {
	value: ReactionStatus | null;
	onChange: (reaction: ReactionStatus | null) => void;
}) {
	return (
		<div className="flex items-center gap-1">
			{REACTION_OPTIONS.map((option) => {
				const isSelected = value === option.value;
				return (
					<button
						key={option.value}
						type="button"
						aria-label={option.label}
						aria-pressed={isSelected}
						className={cn(
							"flex size-8 items-center justify-center rounded-lg text-base transition-all hover:bg-accent",
							isSelected && "bg-accent ring-1 ring-foreground/20",
						)}
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							onChange(isSelected ? null : option.value);
						}}
					>
						<option.icon size={16} />
					</button>
				);
			})}
		</div>
	);
}
