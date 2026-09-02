import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";

import { SearchIcon, XCircleIcon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
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
  /** When provided, shows a clickable ⌘K hint on the right that opens the command palette. */
  onCommandOpen?: () => void;
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
    onCommandOpen,
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
            const trimmedValue = newValue.trim();
            if (trimmedValue.length >= 2) {
              addToSearchHistory(trimmedValue);
              navigate({
                to: "/search",
                search: { query: trimmedValue },
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

        const trimmedValue = value.trim();
        if (trimmedValue.length < 2) {
          if (!trimmedValue) {
            navigate({
              to: "/search",
              search: {},
              replace: true,
            });
          }
          return;
        }

        addToSearchHistory(trimmedValue);

        if (onSubmit) {
          onSubmit(trimmedValue);
        }

        navigate({
          to: "/search",
          search: { query: trimmedValue },
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
              "peer bg-card border-border placeholder:text-muted-foreground/70 focus:bg-card focus:border-ring/40 focus:ring-ring/15 dark:bg-input/35 dark:focus:bg-background h-11 w-full rounded-lg border px-0 ps-11 pe-11 text-[16px] shadow-none transition-[color,background-color,border-color,box-shadow] duration-150 focus:ring-2 md:text-[15px]",
              disabled && "cursor-not-allowed opacity-50",
            )}
            aria-label="Search Input"
            aria-busy={isLoading}
          />
          <div className="text-muted-foreground/60 pointer-events-none absolute inset-y-0 inset-s-0 flex items-center ps-3.5 peer-disabled:opacity-50">
            {icon}
          </div>
          {showClearButton && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute inset-y-0 inset-e-0 z-20 flex w-11 cursor-pointer items-center justify-center transition-[color,background-color,box-shadow] duration-150 hover:opacity-70 active:scale-90"
              aria-label="Clear Search"
            >
              <XCircleIcon size={20} aria-hidden="true" />
            </button>
          )}
          {!showClearButton && onCommandOpen && !disabled && !isLoading && (
            <button
              type="button"
              onClick={onCommandOpen}
              className="text-muted-foreground/60 hover:text-muted-foreground absolute inset-y-0 inset-e-0 z-10 flex cursor-pointer items-center justify-center pe-3 transition-opacity"
              aria-label="Open command menu (Command K)"
            >
              <Kbd>⌘K</Kbd>
            </button>
          )}
        </div>
      </form>
    );
  },
);

SearchBar.displayName = "SearchBar";

const SearchBarSkeleton = memo(function SearchBarSkeleton() {
  return <Skeleton className="h-11 w-full rounded-lg" />;
});

SearchBarSkeleton.displayName = "SearchBarSkeleton";

export { SearchBar, SearchBarSkeleton };
