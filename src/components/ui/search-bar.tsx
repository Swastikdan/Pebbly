/** Debounced search input with URL-based query state management and search history. */
import { useLocation, useNavigate } from "@tanstack/react-router";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { SearchIcon, XCircleIcon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const SEARCH_HISTORY_KEY = "search-history";
const MAX_HISTORY_ITEMS = 8;

function getSearchHistory(): string[] {
	if (typeof window === "undefined") return [];
	try {
		return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) ?? "[]");
	} catch {
		return [];
	}
}

function addToSearchHistory(query: string) {
	if (!query.trim()) return;
	const history = getSearchHistory().filter(
		(item) => item.toLowerCase() !== query.trim().toLowerCase(),
	);
	history.unshift(query.trim());
	localStorage.setItem(
		SEARCH_HISTORY_KEY,
		JSON.stringify(history.slice(0, MAX_HISTORY_ITEMS)),
	);
}

function removeFromSearchHistory(query: string) {
	const history = getSearchHistory().filter((item) => item !== query);
	localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
}

function clearSearchHistory() {
	localStorage.removeItem(SEARCH_HISTORY_KEY);
}

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

		/** Keep local value in sync when query prop changes (e.g. search history click) */
		useEffect(() => {
			setValue(query ?? "");
		}, [query]);

		const handleChange = useCallback(
			(e: React.ChangeEvent<HTMLInputElement>) => {
				const newValue = e.target.value;
				setValue(newValue);

				if (debounceTimeout) {
					clearTimeout(debounceTimeout);
				}

				const timeout = setTimeout(() => {
					if (onChange) {
						onChange(newValue);
					}

					if (updateUrlOnChange) {
						if (newValue.trim()) {
							addToSearchHistory(newValue.trim());
							navigate({
								to: "/search",
								search: { query: newValue.trim() },
								replace: true,
							});
						} else {
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
					navigate({
						to: "/search",
						search: {},
						replace: true,
					});
					return;
				}

				// Save to search history
				addToSearchHistory(value.trim());

				if (onSubmit) {
					onSubmit(value.trim());
				}

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
						placeholder={placeholder ?? "Search movies, shows, and more..."}
						value={value}
						onChange={handleChange}
						onKeyDown={handleKeyDown}
						disabled={disabled || isLoading}
						autoFocus={autoFocus}
						className={cn(
							"peer h-11 w-full rounded-xl bg-background/95 ps-11 pr-10 text-[16px] md:text-[15px] border border-border transition-all duration-200 placeholder:text-muted-foreground/70 focus:bg-background focus:border-ring/40 focus:ring-2 focus:ring-ring/15 dark:bg-input/35 dark:focus:bg-background shadow-none",
							disabled && "cursor-not-allowed opacity-50",
						)}
						aria-label="Search Input"
						aria-busy={isLoading}
					/>
					<div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3.5 text-muted-foreground/60 peer-disabled:opacity-50">
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
	return <Skeleton className="h-11 w-full rounded-xl" />;
});

SearchBarSkeleton.displayName = "SearchBarSkeleton";

export {
	SearchBar,
	SearchBarSkeleton,
	getSearchHistory,
	removeFromSearchHistory,
	clearSearchHistory,
};
