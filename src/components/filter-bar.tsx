import { SlidersHorizontal, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface FilterDefinition {
	id: string;
	label: string;
	options: Array<{ value: string; label: ReactNode; icon?: ReactNode }>;
	value: string;
}

export interface FilterBarProps {
	filters: FilterDefinition[];
	onFilterChange: (filterId: string, value: string) => void;
	onReset?: () => void;
	activeCount?: number;
	isOpen?: boolean;
	onToggleOpen?: () => void;
}

export function FilterBar({
	filters,
	onFilterChange,
	onReset,
	activeCount = 0,
	isOpen = false,
	onToggleOpen,
}: FilterBarProps) {
	return (
		<div className="flex items-center gap-2">
			{onToggleOpen && (
				<Button
					onClick={onToggleOpen}
					aria-expanded={isOpen}
					variant={isOpen || activeCount > 0 ? "default" : "ghost"}
					size="sm"
					className={cn(
						"h-9 w-[132px] justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold ring-1 ring-border/40",
						isOpen || activeCount > 0
							? "bg-foreground text-background hover:bg-foreground/90"
							: "bg-secondary/40 text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
					)}
				>
					<SlidersHorizontal size={13} />
					<span className="relative inline-flex w-[72px] justify-center">
						<span
							className={cn(
								"absolute inset-0 transition-opacity",
								isOpen ? "opacity-100" : "opacity-0",
							)}
						>
							Hide
						</span>
						<span
							className={cn(
								"absolute inset-0 transition-opacity",
								isOpen ? "opacity-0" : "opacity-100",
							)}
						>
							Filters
						</span>
						<span className="invisible">Filters</span>
					</span>
					{activeCount > 0 && (
						<span className="text-[10px] opacity-70">{activeCount}</span>
					)}
				</Button>
			)}

			<div
				className={cn(
					"flex-1 items-center gap-2 scrollbar-hidden overflow-x-auto",
					!onToggleOpen || isOpen ? "flex" : "hidden",
				)}
			>
				{filters.map((filter) => (
					<Select
						key={filter.id}
						value={filter.value}
						onValueChange={(val) => onFilterChange(filter.id, val)}
					>
						<SelectTrigger className="w-auto min-w-[100px] gap-1.5 rounded-xl border-none bg-secondary/50 px-3 text-xs data-[size=default]:h-8">
							<SelectValue placeholder={filter.label} />
						</SelectTrigger>
						<SelectContent className="rounded-xl">
							{filter.options.map((opt) => (
								<SelectItem key={opt.value} value={opt.value}>
									{opt.icon ? (
										<span className="flex items-center gap-2">
											{opt.icon} {opt.label}
										</span>
									) : (
										opt.label
									)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				))}

				{activeCount > 0 && onReset && (
					<Button
						type="button"
						variant="ghost"
						onClick={onReset}
						className="h-auto items-center gap-1 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-transparent hover:text-foreground"
					>
						<X size={12} />
						Reset
					</Button>
				)}
			</div>
		</div>
	);
}
