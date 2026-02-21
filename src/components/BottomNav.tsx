import { Home, FileText, MapPin, Info, Moon, Sun, Shield } from "lucide-react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { NavLink } from "@/components/NavLink";

const baseNavItems = [
  { path: "/", label: "Home", icon: Home },
  { path: "/my-reports", label: "Reports", icon: FileText },
  { path: "/hotspots", label: "Hotspots", icon: MapPin },
  { path: "/how-it-works", label: "Info", icon: Info },
];

export function BottomNav({ className }: { className?: string }) {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { isAdmin } = useAuth();

  const navItems = isAdmin
    ? [...baseNavItems, { path: "/admin-review", label: "Review", icon: Shield }]
    : baseNavItems;

  return (
    <nav
      className={cn(
        "sticky bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md",
        className
      )}
      aria-label="Bottom navigation"
    >
      <div className="mx-auto flex max-w-3xl items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
        <button
          type="button"
          onClick={toggleTheme}
          className="flex flex-1 flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
          <span className="truncate">Theme</span>
        </button>
      </div>
    </nav>
  );
}
