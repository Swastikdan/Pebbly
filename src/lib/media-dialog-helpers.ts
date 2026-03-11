export type MediaDialogSearch = Record<string, unknown>;
export type MediaDialogKey = "video" | "backdrop" | "poster";

type DialogNavigate = (options: unknown) => void;

export function getImageDialogKey(imagePath?: string) {
	return imagePath?.split("/").pop()?.replace(/\.[^/.]+$/, "");
}

export function updateDialogSearch(
	navigate: DialogNavigate,
	key: MediaDialogKey,
	value?: string,
) {
	navigate({
		search: (prev: MediaDialogSearch) => ({
			...prev,
			[key]: value,
		}),
		resetScroll: false,
		replace: true,
	} as never);
}
