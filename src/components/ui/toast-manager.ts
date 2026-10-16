import { Toast } from "@base-ui/react/toast";

// Singleton toast manager. Lives in its own module (no components) so that
// `vite-plugin-react` Fast Refresh doesn't flag `toast.tsx` for mixing
// component and non-component exports.
export const toastManager: ReturnType<typeof Toast.createToastManager> =
  Toast.createToastManager();
