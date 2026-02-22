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

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/40 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center px-4 md:px-6">
        <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4">
          
          {/* Left: Brand */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex items-center gap-3 text-left transition hover:opacity-80 focus-visible:outline-none"
              aria-label="Go to home"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-primary ab-glow-leaf">
                <Bug className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold leading-5 tracking-tight">AlienBuster</div>
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
                  placeholder="Search reports, outbreaks, locations…"
                  className="h-10 rounded-xl border-white/10 bg-white/5 pl-9 text-sm focus-visible:ring-1 focus-visible:ring-primary/50"
                  onFocus={() => onOpenCommandPalette?.()}
                  readOnly
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => onOpenCommandPalette?.()}
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
              className="hidden h-10 gap-2 border-white/10 bg-white/5 px-3 font-medium text-muted-foreground hover:bg-white/10 hover:text-foreground md:inline-flex"
              onClick={() => onOpenCommandPalette?.()}
            >
              <Command className="h-4 w-4" />
              <span className="text-xs">Command</span>
              <kbd className="ml-1 hidden rounded border border-white/10 bg-black/20 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground lg:inline-block">
                Ctrl K
              </kbd>
            </Button>

            {session ? (
              <>
                <Button
                  size="sm"
                  className="hidden h-10 gap-2 bg-primary/90 px-4 text-primary-foreground hover:bg-primary sm:inline-flex"
                  onClick={() => navigate("/submit")}
                >
                  <Plus className="h-4 w-4" />
                  New Report
                </Button>
                
                <div className="mx-1 hidden h-6 w-px bg-white/10 md:block" />

                <div className="flex items-center gap-2">
                  <span className="hidden max-w-[140px] truncate text-xs font-medium text-muted-foreground lg:inline-block">
                    {user?.email}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-10 gap-2 px-2 text-muted-foreground hover:bg-white/5 hover:text-foreground"
                    onClick={async () => {
                      try {
                        await signOut();
                        toast.success("Signed out");
                        navigate("/login");
                      } catch (e) {
                        console.error("Logout failed", e);
                        navigate("/login");
                      }
                    }}
                    aria-label="Logout"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden lg:inline">Sign out</span>
                  </Button>
                </div>
              </>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                className="h-10 gap-2 px-4 font-medium"
                onClick={() => navigate("/login")}
              >
                <LogIn className="h-4 w-4" />
                Sign in
              </Button>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}
