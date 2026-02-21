import { Bug, LogIn, LogOut, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  const { user, session, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2 md:px-6">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Go to home"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Bug className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold">Alien Buster</span>
            <span className="block text-xs text-muted-foreground">Citizen + Satellite early warning</span>
          </span>
        </button>

        <div className="flex items-center gap-2">
          {session ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                className="hidden gap-2 sm:inline-flex"
                onClick={() => navigate("/submit")}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                New report
              </Button>
              <span className="hidden max-w-[220px] truncate text-xs text-muted-foreground sm:inline">
                {user?.email}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={async () => {
                  try {
                    await signOut();
                  } finally {
                    navigate("/");
                  }
                }}
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </Button>
            </>
          ) : (
            <Button variant="secondary" size="sm" className="gap-2" onClick={() => navigate("/login")}>
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Sign in
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
