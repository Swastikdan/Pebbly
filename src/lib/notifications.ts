import type { ToastOptions } from "@/domain/notifications";
import { toastManager } from "@/components/ui/toast";

const TOAST_DURATION = 5000;

export function toast(options: ToastOptions) {
  const { action, type = "info", ...rest } = options;
  const id = toastManager.add({
    ...rest,
    type,
    timeout: TOAST_DURATION,
    ...(action
      ? {
          actionProps: {
            children: action.label,
            onClick: () => {
              action.onClick();
              toastManager.close(id);
            },
          },
        }
      : {}),
  });
  return { dismiss: () => toastManager.close(id) };
}

export type { ToastOptions } from "@/domain/notifications";
