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

export type Notifier = (options: ToastOptions) => void;
