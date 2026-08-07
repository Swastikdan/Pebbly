import { useLocation, useNavigate } from "@tanstack/react-router";
import {
	memo,
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { SearchIcon, XCircleIcon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { addToSearchHistory } from "@/lib/search-history";
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
		const searchId = useId();
		const navigate = useNavigate();
		const location = useLocation();
		const [value, setValue] = useState(query ?? "");
		const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

		useEffect(() => {
			if (document.activeElement?.id === searchId && query) {
				return;
			}
			setValue(query ?? "");
		}, [query, searchId]);

		const handleChange = useCallback(
			(e: React.ChangeEvent<HTMLInputElement>) => {
				const newValue = e.target.value;
				setValue(newValue);

				if (debounceTimeoutRef.current) {
					clearTimeout(debounceTimeoutRef.current);
				}

				debounceTimeoutRef.current = setTimeout(() => {
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
			},
			[onChange, debounceDelay, updateUrlOnChange, navigate],
		);

		const handleClear = useCallback(() => {
			setValue("");

			if (debounceTimeoutRef.current) {
				clearTimeout(debounceTimeoutRef.current);
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
		}, [onClear, onChange, navigate, location]);

		const handleSubmit = useCallback(
			(e: React.FormEvent<HTMLFormElement>) => {
				e.preventDefault();

				if (debounceTimeoutRef.current) {
					clearTimeout(debounceTimeoutRef.current);
				}

				if (!value.trim()) {
					navigate({
						to: "/search",
						search: {},
						replace: true,
					});
					return;
				}

				addToSearchHistory(value.trim());

				if (onSubmit) {
					onSubmit(value.trim());
				}

				navigate({
					to: "/search",
					search: { query: value.trim() },
					replace: true,
				});
			},
			[onSubmit, value, navigate],
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
					<Label htmlFor={searchId} className="sr-only">
						Search
					</Label>
					<Input
						type="text"
						id={searchId}
						name="query"
						autoComplete="off"
						placeholder={placeholder ?? "Search movies, shows, and more..."}
						value={value}
						onChange={handleChange}
						onKeyDown={handleKeyDown}
						disabled={disabled}
						autoFocus={autoFocus}
						className={cn(
							"peer h-11 w-full rounded-xl bg-background/95 ps-11 pr-11 text-[16px] md:text-[15px] border border-border transition-[color,background-color,border-color,box-shadow] duration-150 placeholder:text-muted-foreground/70 focus:bg-background focus:border-ring/40 focus:ring-2 focus:ring-ring/15 dark:bg-input/35 dark:focus:bg-background shadow-none",
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
							className="absolute inset-y-0 end-0 z-20 flex w-11 cursor-pointer items-center justify-center transition-[color,background-color,box-shadow] duration-150 hover:opacity-70 active:scale-90"
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

export { SearchBar, SearchBarSkeleton };
