import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

import type { ProgressStatus } from "@/types";

const VALID_PROGRESS_STATUSES: ReadonlySet<string> = new Set([
	"watch-later",
	"watching",
	"done",
	"dropped",
]);

export function normalizeProgressStatus(
	status?: string | null,
): ProgressStatus | null {
	if (!status) return null;
	return VALID_PROGRESS_STATUSES.has(status)
		? (status as ProgressStatus)
		: null;
}

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

export const formatMediaTitle = {
	encode(title: string): string {
		if (!title || typeof title !== "string") return "";

		let result = title
			.toLowerCase()
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.trim();

		result = result
			.replace(/\s+/g, "-")
			.replace(/[^\w-]/g, "")
			.replace(/-{2,}/g, "-")
			.replace(/^-+|-+$/g, "");

		return result;
	},

	decode(input: string): string {
		if (!input || typeof input !== "string") return "";

		return input
			.replace(/-/g, " ")
			.replace(/\b\w/g, (char) => char.toUpperCase());
	},
};
