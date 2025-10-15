import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

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
		// Early return for empty/invalid input
		if (!title || typeof title !== "string") return "";

		// Single pass optimization - combine operations
		let result = title
			.toLowerCase()
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "") // strip accents
			.trim();

		// More efficient regex replacements
		result = result
			.replace(/\s+/g, "-") // spaces to hyphens
			.replace(/[^\w-]/g, "") // remove non-word chars except hyphens
			.replace(/-{2,}/g, "-") // collapse multiple hyphens
			.replace(/^-+|-+$/g, ""); // trim leading/trailing hyphens

		return result;
	},

	decode(input: string): string {
		if (!input || typeof input !== "string") return "";

		// Direct transformation without intermediate arrays when possible
		return input
			.replace(/-/g, " ")
			.replace(/\b\w/g, (char) => char.toUpperCase());
	},
};
