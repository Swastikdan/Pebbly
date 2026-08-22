import { create } from "zustand";

export interface ToastAction {
	label: string;
	onClick: () => void;
}

export interface Toast {
	id: string;
	title: string;
	description?: string;
	action?: ToastAction;
	leaving?: boolean;
}

interface ToastState {
	toasts: Toast[];
	push: (toast: Omit<Toast, "id">) => string;
	dismiss: (id: string) => void;
	remove: (id: string) => void;
}

let toastCounter = 0;

function nextId() {
	toastCounter += 1;
	return `toast-${Date.now()}-${toastCounter}`;
}

export const useToastStore = create<ToastState>((set) => ({
	toasts: [],
	push: (toast) => {
		const id = nextId();
		set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
		return id;
	},
	dismiss: (id) => {
		set((state) => ({
			toasts: state.toasts.map((t) =>
				t.id === id ? { ...t, leaving: true } : t,
			),
		}));
		window.setTimeout(() => {
			useToastStore.getState().remove(id);
		}, 180);
	},
	remove: (id) => {
		set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
	},
}));

export function toast(toast: Omit<Toast, "id">) {
	const id = useToastStore.getState().push(toast);
	return {
		dismiss: () => useToastStore.getState().dismiss(id),
	};
}
