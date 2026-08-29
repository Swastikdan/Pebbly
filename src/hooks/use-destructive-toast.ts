import { toastManager } from "@/components/ui/toast";

export const DESTRUCTIVE_TOAST_TIMEOUT = 5000;

interface DestructiveToastOptions {
  title: string;
  description?: string;
  onConfirm: () => void;
}

export function destructiveToast({
  title,
  description,
  onConfirm,
}: DestructiveToastOptions) {
  let cancelled = false;
  const deadline = Date.now() + DESTRUCTIVE_TOAST_TIMEOUT;
  const formatDescription = (seconds: number) =>
    `${description ? `${description} · ` : ""}Deleting in ${seconds}s`;

  const id = toastManager.add({
    title,
    description: formatDescription(Math.ceil(DESTRUCTIVE_TOAST_TIMEOUT / 1000)),
    type: "warning",
    timeout: DESTRUCTIVE_TOAST_TIMEOUT,
    actionProps: {
      children: "Undo",
      onClick: () => {
        cancelled = true;
        window.clearInterval(countdownTimer);
        window.clearTimeout(confirmTimer);
        toastManager.close(id);
      },
    },
  });

  const countdownTimer = window.setInterval(() => {
    const seconds = Math.max(1, Math.ceil((deadline - Date.now()) / 1000));
    toastManager.update(id, { description: formatDescription(seconds) });
  }, 250);

  const confirmTimer = window.setTimeout(() => {
    window.clearInterval(countdownTimer);
    if (!cancelled) onConfirm();
  }, DESTRUCTIVE_TOAST_TIMEOUT);

  return {
    cancel: () => {
      cancelled = true;
      window.clearInterval(countdownTimer);
      window.clearTimeout(confirmTimer);
      toastManager.close(id);
    },
  };
}
