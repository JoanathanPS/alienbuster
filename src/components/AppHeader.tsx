import { Bug, Command, LogIn, LogOut, Plus, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";

export function AppHeader({ onOpenCommandPalette }: { onOpenCommandPalette?: () => void }) {
  const { user, session, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out successfully");
      navigate("/");
    } catch (e: any) {
      toast.error(e?.message || "Failed to sign out");
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center px-4 md:px-6">
        <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4">

          {/* Left: Brand */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex items-center gap-3 text-left transition hover:opacity-85 focus-visible:outline-none"
              aria-label="Go to home"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-primary ab-glow-leaf">
                <Bug className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold leading-5 tracking-tight text-foreground">AlienBuster</div>
                <div className="hidden md:block truncate text-[12px] text-muted-foreground leading-4 font-medium">Early Warning System</div>
              </div>
            </button>
          </div>

          {/* Center: Search */}
          <div className="flex justify-center">
            <div className="w-full max-w-[520px]">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search reports, outbreaks, species, locations…"
                  className="h-10 rounded-xl border-border bg-card/60 pl-9 text-sm focus-visible:ring-1 focus-visible:ring-primary/50"
                  onFocus={() => onOpenCommandPalette?.()}
                  readOnly
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => onOpenCommandPalette?.()}
                aria-label="Open search command palette"
              >
                <Search className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="hidden h-9 gap-2 border-border bg-card/60 px-3 font-medium text-muted-foreground hover:bg-card hover:text-foreground md:inline-flex"
              onClick={() => onOpenCommandPalette?.()}
            >
              <Command className="h-3.5 w-3.5" />
              <span className="text-xs">Command</span>
              <kbd className="ml-1 hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground lg:inline-block">
                Ctrl K
              </kbd>
            </Button>

            <Button
              size="sm"
              className="h-9 gap-2 bg-primary px-3 text-primary-foreground hover:bg-primary/90"
              onClick={() => navigate("/submit")}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Report</span>
            </Button>

            <div className="mx-1 hidden h-5 w-px bg-border md:block" />

            {session || user ? (
              <div className="flex items-center gap-2">
                <span className="hidden max-w-[130px] truncate text-xs font-medium text-muted-foreground lg:inline-block">
                  {user?.email}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={handleSignOut}
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden md:inline">Sign out</span>
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 border-border px-3 text-xs font-medium"
                onClick={() => navigate("/login")}
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Sign in</span>
              </Button>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}
