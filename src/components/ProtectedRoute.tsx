import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    // Remember where the user tried to go so we can redirect after auth.
    try {
      sessionStorage.setItem("post-login-redirect", location.pathname + location.search);
    } catch {
      // ignore
    }

    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
