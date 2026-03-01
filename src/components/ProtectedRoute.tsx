/**
 * ProtectedRoute — auth check removed for local dev.
 * Always renders children directly.
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
