import { toastManager } from "@/components/ui/toast";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  title: string;
  description?: string;
  type?: "info" | "success" | "error" | "warning" | "loading";
  action?: ToastAction;
}

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
