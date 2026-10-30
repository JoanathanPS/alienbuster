import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // If user is not authenticated and Supabase is active, prompt to sign in
  const isSupabaseConfigured = Boolean(
    import.meta.env.VITE_SUPABASE_URL &&
    !import.meta.env.VITE_SUPABASE_URL.includes("placeholder-project")
  );

  if (!user && isSupabaseConfigured) {
    try {
      sessionStorage.setItem("post-login-redirect", location.pathname);
    } catch {
      // ignore
    }
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
