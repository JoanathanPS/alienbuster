import { Toaster as HotToaster, toast as hotToast } from "react-hot-toast";

import { useTheme } from "@/hooks/useTheme";

const Toaster = () => {
  const { theme } = useTheme();

  return (
    <HotToaster
      position="top-right"
      toastOptions={{
        duration: 3500,
        style: {
          background: "hsla(210, 30%, 10%, 0.55)",
          color: "hsl(210, 22%, 95%)",
          border: "1px solid hsla(0, 0%, 100%, 0.10)",
          backdropFilter: "blur(16px)",
          borderRadius: "18px",
          boxShadow: "0 26px 80px -55px rgba(0,0,0,0.9)",
        },
        className: theme === "light" ? "ab-toast-light" : "ab-toast-dark",
      }}
    />
  );
};

// Backwards compatible API: some screens call toast.message(...)
const toast = Object.assign(hotToast, {
  message: hotToast,
});

export { Toaster, toast };
