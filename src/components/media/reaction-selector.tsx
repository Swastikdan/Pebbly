import { Button } from "@/components/ui/button";
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
					<Button
						key={option.value}
						type="button"
						variant="ghost"
						size="icon"
						aria-label={option.label}
						aria-pressed={isSelected}
						className={cn(
							"size-8 rounded-lg p-0 text-base transition-all hover:bg-accent",
							isSelected && "bg-accent ring-1 ring-foreground/20",
						)}
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							onChange(isSelected ? null : option.value);
						}}
					>
						<option.icon size={16} />
					</Button>
				);
			})}
		</div>
	);
}
