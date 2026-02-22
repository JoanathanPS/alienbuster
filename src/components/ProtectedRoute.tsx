import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    // Keep AppShell alive; skeleton only the content region.
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
        <div className="space-y-4">
          <Skeleton className="h-7 w-48" />
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 lg:col-span-4">
              <Skeleton className="h-[360px] w-full rounded-3xl" />
            </div>
            <div className="col-span-12 lg:col-span-8">
              <Skeleton className="h-[520px] w-full rounded-3xl" />
            </div>
          </div>
        </div>
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
