import { toastManager } from "@/components/ui/toast";
import { logError } from "@/lib/utils";

export const DESTRUCTIVE_TOAST_TIMEOUT = 5_000;

const TICK_MS = 100;

export interface DestructiveToastOptions {
  title: string;
  description?: string;
  timeout?: number;
  undoLabel?: string;
  /** Callback invoked when the user clicks the Undo button */
  onUndo?: () => void | Promise<void>;
  /** Callback invoked when the countdown finishes without being undone (for delayed deletes) */
  onConfirm?: () => void | Promise<void>;
}

function runSafely(
  fn: (() => void | Promise<void>) | undefined,
  label: string,
) {
  if (!fn) return;
  try {
    const result = fn();
    if (result && typeof (result as Promise<void>).catch === "function") {
      (result as Promise<void>).catch((err) => logError(label, err));
    }
  } catch (err) {
    logError(label, err);
  }
}

/**
 * Shows an undo toast with a countdown. The countdown is owned here (the toast
 * itself never auto-dismisses) so the countdown always runs to the end, even
 * while the toast is hovered, and the toast is always closed afterwards.
 */
export function destructiveToast(options: DestructiveToastOptions) {
  const {
    title,
    description,
    timeout = DESTRUCTIVE_TOAST_TIMEOUT,
    undoLabel = "Undo",
    onUndo,
    onConfirm,
  } = options;

  let finished = false;
  const deadline = Date.now() + timeout;
  let currentSeconds = Math.max(1, Math.ceil(timeout / 1000));

  let id: string;
  let countdownTimer: ReturnType<typeof setInterval> | undefined;

  const stop = () => {
    finished = true;
    if (countdownTimer) clearInterval(countdownTimer);
  };

  const handleUndo = () => {
    if (finished) return;
    stop();
    toastManager.close(id);
    runSafely(onUndo, "undo destructive action");
  };

  const buildData = () => ({
    secondsLeft: currentSeconds,
    duration: timeout,
  });

  const sync = () => {
    toastManager.update(id, {
      data: buildData(),
      actionProps: { children: undoLabel, onClick: handleUndo },
    });
  };

  id = toastManager.add({
    title,
    description,
    type: "destructive",
    // 0 = never auto-dismiss; this hook closes the toast itself.
    timeout: 0,
    data: buildData(),
    actionProps: {
      children: undoLabel,
      onClick: handleUndo,
    },
  });

  countdownTimer = setInterval(() => {
    if (finished) return;
    const remaining = deadline - Date.now();

    if (remaining <= 0) {
      stop();
      toastManager.close(id);
      runSafely(onConfirm, "confirm destructive action");
      return;
    }

    const seconds = Math.max(1, Math.ceil(remaining / 1000));
    if (seconds !== currentSeconds) {
      currentSeconds = seconds;
      sync();
    }
  }, TICK_MS);

  return {
    id,
    cancel: () => {
      stop();
      toastManager.close(id);
    },
  };
}
