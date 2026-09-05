export type MediaDialogSearch = Record<string, unknown>;
export type MediaDialogKey = "video" | "backdrop" | "poster" | "trailer";

export type SearchUpdater = (
  prev: Record<string, unknown>,
) => Record<string, unknown>;

export interface SearchNavigateOptions {
  search: SearchUpdater;
  resetScroll?: boolean;
  replace?: boolean;
}

export type NavigateFunction = (
  options: SearchNavigateOptions,
) => Promise<void>;

export function createSearchNavigateOptions(
  search: SearchUpdater,
  options?: { resetScroll?: boolean; replace?: boolean },
): SearchNavigateOptions {
  return {
    search,
    resetScroll: options?.resetScroll ?? false,
    replace: options?.replace ?? true,
  };
}

export function createDialogSearchUpdater(
  key: MediaDialogKey,
  value?: string,
): SearchUpdater {
  return (prev) => {
    const next = { ...prev };
    if (value === undefined) {
      delete next[key];
    } else {
      next[key] = value;
    }
    return next;
  };
}

/**
 * Executes a search param update for polymorphic components (components mounted
 * across multiple routes). In TanStack Router, generic `useNavigate()` types
 * search updater parameters as `never` because the route is dynamic.
 */
export function navigateSearch(
  navigate: unknown,
  search: SearchUpdater,
  options?: { resetScroll?: boolean; replace?: boolean },
): Promise<void> {
  if (typeof navigate !== "function") {
    return Promise.resolve();
  }
  return Promise.resolve(
    (navigate as NavigateFunction)(
      createSearchNavigateOptions(search, options),
    ),
  );
}

export function getImageDialogKey(imagePath?: string) {
  return imagePath
    ?.split("/")
    .pop()
    ?.replace(/\.[^/.]+$/, "");
}

export function updateDialogSearch(
  navigate: unknown,
  key: MediaDialogKey,
  value?: string,
) {
  return navigateSearch(navigate, createDialogSearchUpdater(key, value));
}
