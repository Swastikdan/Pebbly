import { useLocation, useNavigate } from "@tanstack/react-router";
import { memo, useCallback, useMemo, useState } from "react";
import { SearchIcon, XCircleIcon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface SearchBarProps {
	className?: string;
	query?: string;
	placeholder?: string;
	isLoading?: boolean;
	isClearable?: boolean;
	onChange?: (value: string) => void;
	onClear?: () => void;
	onSubmit?: (value: string) => void;
	debounceDelay?: number;
	autoFocus?: boolean;
	disabled?: boolean;
	updateUrlOnChange?: boolean;
}

const SearchBar = memo(
	({
		className,
		query,
		placeholder,
		isLoading = false,
		isClearable = true,
		onChange,
		onClear,
		onSubmit,
		debounceDelay = 500,
		autoFocus = false,
		disabled = false,
		updateUrlOnChange = false,
	}: SearchBarProps) => {
		const navigate = useNavigate();
		const location = useLocation();
		const [value, setValue] = useState(query ?? "");
		const [debounceTimeout, setDebounceTimeout] =
			useState<NodeJS.Timeout | null>(null);

		const handleChange = useCallback(
			(e: React.ChangeEvent<HTMLInputElement>) => {
				const newValue = e.target.value;
				setValue(newValue);

				if (debounceTimeout) {
					clearTimeout(debounceTimeout);
				}

				const timeout = setTimeout(() => {
					// Call onChange callback if provided
					if (onChange) {
						onChange(newValue);
					}

					// Update URL on change if flag is enabled
					if (updateUrlOnChange) {
						if (newValue.trim()) {
							// If there's a value, set it in the URL
							navigate({
								to: "/search",
								search: { query: newValue.trim() },
								replace: true,
							});
						} else {
							// If empty, clear the search params entirely
							navigate({
								to: "/search",
								search: {},
								replace: true,
							});
						}
					}
				}, debounceDelay);

				setDebounceTimeout(timeout);
			},
			[onChange, debounceDelay, debounceTimeout, updateUrlOnChange, navigate],
		);

		const handleClear = useCallback(() => {
			setValue("");

			// Clear debounce timeout
			if (debounceTimeout) {
				clearTimeout(debounceTimeout);
			}

			if (onClear) {
				onClear();
			}

			if (onChange) {
				onChange("");
			}
			if (location.pathname !== "/") {
				navigate({
					to: "/search",
					search: {},
					replace: true,
				});
			}
		}, [onClear, onChange, debounceTimeout, navigate, location]);

		const handleSubmit = useCallback(
			(e: React.FormEvent<HTMLFormElement>) => {
				e.preventDefault();

				// Clear any pending debounced updates
				if (debounceTimeout) {
					clearTimeout(debounceTimeout);
				}

				if (!value.trim()) {
					// If submitting empty value, clear search params
					navigate({
						to: "/search",
						search: {},
						replace: true,
					});
					return;
				}

				if (onSubmit) {
					onSubmit(value.trim());
				}

				// Update URL on submit if not already updating on change
				if (!updateUrlOnChange) {
					navigate({
						to: "/search",
						search: { query: value.trim() },
						replace: true,
					});
				}
			},
			[onSubmit, value, navigate, updateUrlOnChange, debounceTimeout],
		);

		const handleKeyDown = useCallback(
			(e: React.KeyboardEvent<HTMLInputElement>) => {
				if (e.key === "Escape" && isClearable) {
					handleClear();
				}
			},
			[handleClear, isClearable],
		);

		const showClearButton = useMemo(() => {
			return isClearable && value.length > 0 && !disabled;
		}, [isClearable, value, disabled]);

		const icon = useMemo(() => {
			return isLoading ? (
				<Spinner className="size-6" />
			) : (
				<SearchIcon size={20} aria-hidden="true" />
			);
		}, [isLoading]);

		return (
			<form
				onSubmit={handleSubmit}
				className={cn("flex w-full", className)}
				aria-label="Search Form"
			>
				<div className="relative w-full">
					<Label htmlFor="search" className="sr-only">
						Search
					</Label>
					<Input
						type="text"
						name="query"
						autoComplete="off"
						placeholder={placeholder ?? "👀 What movie, show? Let's find it!"}
						value={value}
						onChange={handleChange}
						onKeyDown={handleKeyDown}
						disabled={disabled || isLoading}
						autoFocus={autoFocus}
						className={cn(
							"peer h-12 w-full rounded-xl bg-transparent ps-12 pr-10  sm:h-11 text-[16px] md:text-[16px] border-2 border-secondary dark:border-border shadow-none",
							disabled && "cursor-not-allowed opacity-50",
						)}
						aria-label="Search Input"
						aria-busy={isLoading}
					/>
					<div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-4 peer-disabled:opacity-50">
						{icon}
					</div>
					{showClearButton && (
						<button
							type="button"
							onClick={handleClear}
							className="absolute inset-y-0 end-0 z-20 flex cursor-pointer items-center pr-4 transition-all duration-150 hover:opacity-70 active:scale-90"
							aria-label="Clear Search"
						>
							<XCircleIcon size={20} aria-hidden="true" />
						</button>
					)}
				</div>
			</form>
		);
	},
);

SearchBar.displayName = "SearchBar";

const SearchBarSkeleton = memo(function SearchBarSkeleton() {
	return <Skeleton className="h-12 w-full rounded-xl" />;
});

SearchBarSkeleton.displayName = "SearchBarSkeleton";

export { SearchBar, SearchBarSkeleton };
