import { LogOut, LogIn } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export function AppHeader() {
  const { user, session, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-2">
        <span className="text-sm font-bold text-foreground">🛸 Alien Buster</span>
        {session ? (
          <div className="flex items-center gap-2">
            <span className="max-w-[140px] truncate text-xs text-muted-foreground">
              {user?.email}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={async () => {
                await signOut();
                navigate("/");
              }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs"
            onClick={() => navigate("/login")}
          >
            <LogIn className="h-4 w-4" /> Sign in
          </Button>
        )}
      </div>
    </header>
  );
}
