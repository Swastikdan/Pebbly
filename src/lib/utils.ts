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

/**
 * Creates an LRU-aware localStorage wrapper that evicts the oldest store
 * when total usage approaches the ~5MB quota (threshold: 4MB).
 */
const STORAGE_SIZE_LIMIT = 4 * 1024 * 1024; // 4MB — room for misc overhead

function getStorageSize(storage: Storage): number {
	let size = 0;
	for (let i = 0; i < storage.length; i++) {
		const key = storage.key(i);
		if (!key) continue;
		size += key.length * 2; // key characters as UTF-16
		const val = storage.getItem(key);
		if (val) size += val.length * 2;
	}
	return size;
}

const LRU_KEY = "__lru_timestamps";

function getLruTimestamps(storage: Storage): Record<string, number> {
	try {
		const raw = storage.getItem(LRU_KEY);
		return raw ? JSON.parse(raw) : {};
	} catch {
		return {};
	}
}

function saveLruTimestamps(
	storage: Storage,
	timestamps: Record<string, number>,
) {
	try {
		storage.setItem(LRU_KEY, JSON.stringify(timestamps));
	} catch {
		// If we can't even save timestamps, just skip LRU tracking
	}
}

export function createLRUStorage(): Storage {
	if (typeof window === "undefined" || !window.localStorage) {
		return createMemoryStorage();
	}

	const base = window.localStorage;

	function evictIfNeeded() {
		let size = getStorageSize(base);
		if (size < STORAGE_SIZE_LIMIT) return;

		const timestamps = getLruTimestamps(base);
		const entries = Object.entries(timestamps)
			.filter(([key]) => key !== LRU_KEY)
			.sort(([, a], [, b]) => a - b); // oldest first

		for (const [key] of entries) {
			if (size < STORAGE_SIZE_LIMIT * 0.6) break; // evict down to ~60%
			try {
				const val = base.getItem(key);
				base.removeItem(key);
				delete timestamps[key];
				if (val) size -= (key.length + val.length) * 2;
			} catch {
				// best-effort
			}
		}

		saveLruTimestamps(base, timestamps);
	}

	return {
		getItem(name: string): string | null {
			return base.getItem(name);
		},
		setItem(name: string, value: string) {
			base.setItem(name, value);
			const timestamps = getLruTimestamps(base);
			timestamps[name] = Date.now();
			saveLruTimestamps(base, timestamps);
			evictIfNeeded();
		},
		removeItem(name: string) {
			base.removeItem(name);
			const timestamps = getLruTimestamps(base);
			delete timestamps[name];
			saveLruTimestamps(base, timestamps);
		},
		clear() {
			base.clear();
		},
		key(index: number): string | null {
			return base.key(index);
		},
		get length() {
			return base.length;
		},
	} as Storage;
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
