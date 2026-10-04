import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toastManager } from "@/components/ui/toast";
import {
  DESTRUCTIVE_TOAST_TIMEOUT,
  destructiveToast,
} from "@/hooks/use-destructive-toast";

describe("destructiveToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(toastManager, "add").mockReturnValue("toast-test-id");
    vi.spyOn(toastManager, "update").mockImplementation(() => {});
    vi.spyOn(toastManager, "close").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("creates a destructive toast with an Undo button and a 5s countdown", () => {
    destructiveToast({
      title: "Removed from watchlist",
      description: "Inception",
    });

    expect(DESTRUCTIVE_TOAST_TIMEOUT).toBe(5_000);
    expect(toastManager.add).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Removed from watchlist",
        description: "Inception",
        type: "destructive",
        // the hook owns the countdown, the toast must not auto-dismiss itself
        timeout: 0,
        data: expect.objectContaining({
          secondsLeft: 5,
          duration: DESTRUCTIVE_TOAST_TIMEOUT,
        }),
        actionProps: expect.objectContaining({ children: "Undo" }),
      }),
    );
  });

  it("updates the countdown timer every second", () => {
    destructiveToast({
      title: "Removed from watchlist",
    });

    vi.advanceTimersByTime(1100);

    expect(toastManager.update).toHaveBeenCalledWith(
      "toast-test-id",
      expect.objectContaining({
        data: expect.objectContaining({ secondsLeft: 4 }),
      }),
    );
  });

  it("closes the toast and confirms when the countdown ends", () => {
    const onConfirm = vi.fn();
    destructiveToast({ title: "Collection deleted", onConfirm });

    vi.advanceTimersByTime(DESTRUCTIVE_TOAST_TIMEOUT + 200);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(toastManager.close).toHaveBeenCalledWith("toast-test-id");
  });

  it("keeps counting down regardless of hover and always closes the toast", () => {
    const onConfirm = vi.fn();
    destructiveToast({ title: "Collection deleted", onConfirm });

    // No hover handlers are exposed, so nothing can pause the countdown.
    const addOptions = vi.mocked(toastManager.add).mock.calls[0][0];
    const data = addOptions.data as { rootProps?: unknown } | undefined;
    expect(data?.rootProps).toBeUndefined();

    vi.advanceTimersByTime(DESTRUCTIVE_TOAST_TIMEOUT - 200);
    expect(onConfirm).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(toastManager.close).toHaveBeenCalledWith("toast-test-id");
  });

  it("calls onUndo and closes the toast when Undo is clicked", () => {
    const onUndo = vi.fn();
    destructiveToast({
      title: "Removed from watchlist",
      onUndo,
    });

    const addCall = vi.mocked(toastManager.add).mock.calls[0][0];
    addCall.actionProps?.onClick?.({} as React.MouseEvent<HTMLButtonElement>);

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(toastManager.close).toHaveBeenCalledWith("toast-test-id");
  });

  it("calls onConfirm if timeout expires without Undo", () => {
    const onConfirm = vi.fn();
    const onUndo = vi.fn();

    destructiveToast({
      title: "Collection deleted",
      onUndo,
      onConfirm,
    });

    vi.advanceTimersByTime(DESTRUCTIVE_TOAST_TIMEOUT);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onUndo).not.toHaveBeenCalled();
  });

  it("does not call onConfirm if Undo was clicked before timeout", () => {
    const onConfirm = vi.fn();
    const onUndo = vi.fn();

    destructiveToast({
      title: "Collection deleted",
      onUndo,
      onConfirm,
    });

    const addCall = vi.mocked(toastManager.add).mock.calls[0][0];
    addCall.actionProps?.onClick?.({} as React.MouseEvent<HTMLButtonElement>);

    vi.advanceTimersByTime(DESTRUCTIVE_TOAST_TIMEOUT);

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
