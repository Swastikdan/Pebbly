import { describe, expect, it, vi } from "vitest";

import {
  createDialogSearchUpdater,
  createSearchNavigateOptions,
  getImageDialogKey,
  navigateSearch,
  updateDialogSearch,
} from "./media-dialog-helpers";

describe("media-dialog-helpers", () => {
  describe("createSearchNavigateOptions", () => {
    it("creates default search navigate options", () => {
      const searchFn = (prev: Record<string, unknown>) => ({
        ...prev,
        foo: "bar",
      });
      const options = createSearchNavigateOptions(searchFn);

      expect(options.resetScroll).toBe(false);
      expect(options.replace).toBe(true);
      expect(options.search({})).toEqual({ foo: "bar" });
    });

    it("respects custom options", () => {
      const searchFn = (prev: Record<string, unknown>) => prev;
      const options = createSearchNavigateOptions(searchFn, {
        resetScroll: true,
        replace: false,
      });

      expect(options.resetScroll).toBe(true);
      expect(options.replace).toBe(false);
    });
  });

  describe("createDialogSearchUpdater", () => {
    it("adds or updates a dialog key", () => {
      const updater = createDialogSearchUpdater("video", "123");
      const result = updater({ other: "test" });
      expect(result).toEqual({ other: "test", video: "123" });
    });

    it("deletes the dialog key when value is undefined", () => {
      const updater = createDialogSearchUpdater("video", undefined);
      const result = updater({ video: "123", other: "test" });
      expect(result).toEqual({ other: "test" });
    });
  });

  describe("getImageDialogKey", () => {
    it("extracts filename without extension", () => {
      expect(getImageDialogKey("/path/to/image.jpg")).toBe("image");
      expect(getImageDialogKey("backdrop123.webp")).toBe("backdrop123");
    });

    it("handles undefined", () => {
      expect(getImageDialogKey(undefined)).toBeUndefined();
    });
  });

  describe("navigateSearch", () => {
    it("invokes navigate with search options if navigate is a function", async () => {
      const mockNavigate = vi.fn().mockReturnValue(Promise.resolve());
      const updater = (prev: Record<string, unknown>) => ({ ...prev, a: 1 });

      await navigateSearch(mockNavigate, updater);

      expect(mockNavigate).toHaveBeenCalledTimes(1);
      const callArg = mockNavigate.mock.calls[0][0];
      expect(callArg.replace).toBe(true);
      expect(callArg.resetScroll).toBe(false);
      expect(callArg.search({})).toEqual({ a: 1 });
    });

    it("gracefully ignores non-function navigate parameter", async () => {
      const updater = (prev: Record<string, unknown>) => prev;
      await expect(navigateSearch(null, updater)).resolves.toBeUndefined();
      await expect(navigateSearch(undefined, updater)).resolves.toBeUndefined();
    });
  });

  describe("updateDialogSearch", () => {
    it("updates dialog key through navigate", async () => {
      const mockNavigate = vi.fn().mockReturnValue(Promise.resolve());
      await updateDialogSearch(mockNavigate, "backdrop", "xyz");

      expect(mockNavigate).toHaveBeenCalledTimes(1);
      const callArg = mockNavigate.mock.calls[0][0];
      expect(callArg.search({})).toEqual({ backdrop: "xyz" });
    });
  });
});
