import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
/* --- Constants --- */
const VALID_ID_RANGE = {
  min: -2147483648, // 32-bit signed integer min
  max: 2147483647, // 32-bit signed integer max
} as const;

const ERROR_MESSAGES = {
  INVALID_ID: "Invalid ID",
  NO_DATA_FOUND: "No data found in response",
  API_ERROR: "API request failed",
} as const;

/* --- Types --- */
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

/* --- ID Validation --- */

/**
 * Validates if an ID is within the valid 32-bit signed integer range
 * @param id - The ID to validate
 * @throws {Error} When ID is outside valid range
 */
export function validateId(id: number): asserts id is number {
  if (!isValidId(id)) {
    throw new Error(
      `${ERROR_MESSAGES.INVALID_ID}: ${id} (must be between ${VALID_ID_RANGE.min} and ${VALID_ID_RANGE.max})`,
    );
  }
}

/**
 * Checks if an ID is within the valid range without throwing
 * @param id - The ID to check
 * @returns true if valid, false otherwise
 */
export function isValidId(id: number): boolean {
  return (
    Number.isInteger(id) && id >= VALID_ID_RANGE.min && id <= VALID_ID_RANGE.max
  );
}

/**
 * Safely parses and validates an ID from string or number
 * @param input - The input to parse as ID
 * @returns ValidationResult with parsed ID or error
 */
export function parseAndValidateId(
  input: string | number,
): ValidationResult<number> {
  const id = typeof input === "string" ? parseInt(input, 10) : input;

  if (isNaN(id)) {
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

/* --- Response Validation --- */

/**
 * Validates API response and extracts data
 * @param response - The API response to validate
 * @throws {Error} When response has error or no data
 * @returns The validated data
 */
export function validateResponse<T>(response: ApiResponse<T>): T {
  if (response.error) {
    throw new Error(`${ERROR_MESSAGES.API_ERROR}: ${response.error}`);
  }

  if (response.data === undefined || response.data === null) {
    throw new Error(ERROR_MESSAGES.NO_DATA_FOUND);
  }

  return response.data;
}

/**
 * Safely validates API response without throwing
 * @param response - The API response to validate
 * @returns ValidationResult with data or error
 */
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

/**
 * Validates that response data is an array and not empty
 * @param response - The API response to validate
 * @returns The validated array data
 */
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

/* --- Utility Functions --- */

/**
 * Creates a type guard for checking if value is a valid API response
 */
export function isApiResponse<T>(value: unknown): value is ApiResponse<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    ("data" in value || "error" in value)
  );
}

/**
 * Validates multiple IDs at once
 * @param ids - Array of IDs to validate
 * @returns Array of validation results
 */
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

// Formats a media title to a URL-safe slug and back.
// export const formatMediaTitle = {
//   encode(title: string): string {
//     // 1) normalize diacritics, 2) lowercase, 3) trim,
//     // 4) spaces -> hyphens, 5) drop non-word chars, 6) collapse hyphens, 7) trim hyphens
//     const slug = title
//       .toString()
//       .toLowerCase()
//       .normalize("NFD")
//       .replace(/[\u0300-\u036f]/g, "") // strip accents
//       .trim()
//       .replace(/\s+/g, "-")
//       .replace(/[^\w-]+/g, "")
//       .replace(/--+/g, "-")
//       .replace(/^-+/, "")
//       .replace(/-+$/, "");

//     // If the slug needs to be part of a query param, encodeURIComponent is correct:
//     // return encodeURIComponent(slug);
//     return slug;
//   },

//   decode(input: string): string {
//     // If the input came from a query param encoded with encodeURIComponent, decode first:
//     // const decoded = decodeURIComponent(input);

//     const decoded = input;
//     // Map hyphens back to spaces and capitalize words conservatively
//     const words = decoded.replace(/-/g, " ").split(" ").filter(Boolean);
//     const pretty = words
//       .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
//       .join(" ");

//     return pretty;
//   },
// };
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
