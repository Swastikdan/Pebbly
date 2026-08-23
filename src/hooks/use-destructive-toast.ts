import { toastManager } from "@/components/ui/toast";

export const DESTRUCTIVE_TOAST_TIMEOUT = 5000;

interface DestructiveToastOptions {
  title: string;
  description?: string;
  /**
   * The destructive mutation. Deferred until the countdown expires so the
   * user can undo; runs only if the toast times out untouched.
   */
  onConfirm: () => void;
}

/**
 * Countdown toast for destructive tasks: the mutation is deferred until the
 * timer fires, and "Undo" cancels it outright — no revert needed.
 */
export function destructiveToast({
  title,
  description,
  onConfirm,
}: DestructiveToastOptions) {
  let cancelled = false;

  const id = toastManager.add({
    title,
    description,
    type: "warning",
    timeout: DESTRUCTIVE_TOAST_TIMEOUT,
    actionProps: {
      children: "Undo",
      onClick: () => {
        cancelled = true;
        toastManager.close(id);
      },
    },
  });

  window.setTimeout(() => {
    if (!cancelled) onConfirm();
  }, DESTRUCTIVE_TOAST_TIMEOUT);

  return { cancel: () => toastManager.close(id) };
}
