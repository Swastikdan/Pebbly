import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

const VALID_ID_RANGE = {
  min: -2147483648,
  max: 2147483647,
};
const INVALID_ID_ERROR = "Invalid ID :";
const NO_DATA_FOUND_ERROR = "No data found in response";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function validateId(id: number): void {
  if (id < VALID_ID_RANGE.min || id > VALID_ID_RANGE.max) {
    throw new Error(`${INVALID_ID_ERROR} ${id}`);
  }
}

export function isValidId(id: number): boolean {
  if (id < VALID_ID_RANGE.min || id > VALID_ID_RANGE.max) {
    return false;
  }
  return true;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export function validateResponse<T>(response: ApiResponse<T>): T {
  // Check for an explicit error message first
  if (response.error) {
    // Simplified check as 'error' property is optional
    throw new Error(response.error);
  }

  // Check if data exists and is not null/undefined
  if (response.data === undefined || response.data === null) {
    throw new Error(NO_DATA_FOUND_ERROR);
  }

  // If no error and data exists, return the data
  return response.data;
}
