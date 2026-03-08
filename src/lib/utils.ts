/** Shared utility functions: class merging, ID validation, API response handling, slug formatting, and storage helpers. */
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

import type { ProgressStatus, ReactionStatus } from "@/types";

interface ApiResponse<T> {
	data?: T;
	error?: string;
}

type ValidationResult<T> =
	| {
			success: true;
			data: T;
	  }
	| {
			success: false;
			error: string;
	  };

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/** In-memory Storage fallback for SSR environments where window.localStorage is unavailable. */
export function createMemoryStorage(): Storage {
	let store: Record<string, string> = {};
	return {
		getItem: (name) => (name in store ? store[name] : null),
		setItem: (name, value) => {
			store[name] = String(value);
		},
		removeItem: (name) => {
			delete store[name];
		},
		clear: () => {
			store = {};
		},
		key: (index) => Object.keys(store)[index] ?? null,
		get length() {
			return Object.keys(store).length;
		},
	} as Storage;
}

/** Maps a legacy combined status string to the split progress/reaction model.
 *  Also normalises old progressStatus values (want-to-watch, finished, caught-up)
 *  to the new names (watch-later, done, watching). */
export function mapLegacyStatusToSplit(status?: string): {
	progressStatus: ProgressStatus | null;
	reaction: ReactionStatus | null;
} {
	switch (status) {
		// Legacy combined statuses
		case "plan-to-watch":
			return { progressStatus: "watch-later", reaction: null };
		case "completed":
			return { progressStatus: "done", reaction: null };
		case "liked":
			return { progressStatus: "done", reaction: "liked" };
		// Old progressStatus values → new names
		case "want-to-watch":
			return { progressStatus: "watch-later", reaction: null };
		case "finished":
			return { progressStatus: "done", reaction: null };
		case "caught-up":
			return { progressStatus: "watching", reaction: null };
		// Already-valid values
		case "watching":
			return { progressStatus: "watching", reaction: null };
		case "dropped":
			return { progressStatus: "dropped", reaction: null };
		case "watch-later":
			return { progressStatus: "watch-later", reaction: null };
		case "done":
			return { progressStatus: "done", reaction: null };
		default:
			return { progressStatus: null, reaction: null };
	}
}

/** Normalise a stored progressStatus string to the current ProgressStatus type. */
export function normalizeProgressStatus(status?: string | null): ProgressStatus | null {
	if (!status) return null;
	const mapped = mapLegacyStatusToSplit(status);
	return mapped.progressStatus;
}

const VALID_ID_RANGE = {
	min: -2147483648,
	max: 2147483647,
} as const;

const ERROR_MESSAGES = {
	INVALID_ID: "Invalid ID",
	NO_DATA_FOUND: "No data found in response",
	API_ERROR: "API request failed",
} as const;

export function isValidId(id: number): boolean {
	return (
		Number.isInteger(id) && id >= VALID_ID_RANGE.min && id <= VALID_ID_RANGE.max
	);
}

export function validateId(id: number): asserts id is number {
	if (!isValidId(id)) {
		throw new Error(
			`${ERROR_MESSAGES.INVALID_ID}: ${id} (must be between ${VALID_ID_RANGE.min} and ${VALID_ID_RANGE.max})`,
		);
	}
}

export function parseAndValidateId(
	input: string | number,
): ValidationResult<number> {
	// Strictly reject strings that aren't purely numeric (parseInt would silently ignore trailing garbage)
	if (typeof input === "string" && !/^\d+$/.test(input)) {
		return {
			success: false,
			error: `${ERROR_MESSAGES.INVALID_ID}: "${input}" is not a valid number`,
		};
	}

	const id = typeof input === "string" ? parseInt(input, 10) : input;

	if (Number.isNaN(id)) {
		return {
			success: false,
			error: `${ERROR_MESSAGES.INVALID_ID}: "${input}" is not a valid number`,
		};
	}

	if (!isValidId(id)) {
		return {
			success: false,
			error: `${ERROR_MESSAGES.INVALID_ID}: ${id} is out of range`,
		};
	}

	return { success: true, data: id };
}

export function validateResponse<T>(response: ApiResponse<T>): T {
	if (response.error) {
		throw new Error(`${ERROR_MESSAGES.API_ERROR}: ${response.error}`);
	}

	if (response.data === undefined || response.data === null) {
		throw new Error(ERROR_MESSAGES.NO_DATA_FOUND);
	}

	return response.data;
}

export function safeValidateResponse<T>(
	response: ApiResponse<T>,
): ValidationResult<T> {
	try {
		const data = validateResponse(response);

		return { success: true, data };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);

		return { success: false, error: errorMessage };
	}
}

export function validateArrayResponse<T>(response: ApiResponse<T[]>): T[] {
	const data = validateResponse(response);

	if (!Array.isArray(data)) {
		throw new Error(`Expected array data, got ${typeof data}`);
	}

	if (data.length === 0) {
		throw new Error("Response contains empty array");
	}

	return data;
}

export function isApiResponse<T>(value: unknown): value is ApiResponse<T> {
	return (
		typeof value === "object" &&
		value !== null &&
		("data" in value || "error" in value)
	);
}

export function validateIds(ids: number[]): ValidationResult<number[]> {
	const invalidIds: number[] = [];

	for (const id of ids) {
		if (!isValidId(id)) {
			invalidIds.push(id);
		}
	}

	if (invalidIds.length > 0) {
		return {
			success: false,
			error: `${ERROR_MESSAGES.INVALID_ID}s: ${invalidIds.join(", ")}`,
		};
	}

	return { success: true, data: ids };
}

export const formatMediaTitle = {
	encode(title: string): string {
		if (!title || typeof title !== "string") return "";

		let result = title
			.toLowerCase()
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "") // strip accents
			.trim();

		result = result
			.replace(/\s+/g, "-") // spaces to hyphens
			.replace(/[^\w-]/g, "") // remove non-word chars except hyphens
			.replace(/-{2,}/g, "-") // collapse multiple hyphens
			.replace(/^-+|-+$/g, ""); // trim leading/trailing hyphens

		return result;
	},

	decode(input: string): string {
		if (!input || typeof input !== "string") return "";

		return input
			.replace(/-/g, " ")
			.replace(/\b\w/g, (char) => char.toUpperCase());
	},
};
