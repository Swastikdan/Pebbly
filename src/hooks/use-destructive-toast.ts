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
