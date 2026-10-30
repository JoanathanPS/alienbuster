import { Home, FileText, MapPin, Layers, Moon, Sun, Shield, Radar } from "lucide-react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { isExpertEmail } from "@/lib/expertAccess";
import { NavLink } from "@/components/NavLink";

const baseNavItems = [
  { path: "/", label: "Home", icon: Home },
  { path: "/hotspots", label: "Hotspots", icon: MapPin },
  { path: "/outbreaks", label: "Outbreaks", icon: Layers },
  { path: "/intel", label: "Intel", icon: Radar },
  { path: "/my-reports", label: "Reports", icon: FileText },
];

export function BottomNav({ className }: { className?: string }) {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();

  const isExpert = isExpertEmail(user?.email);

  const navItems = isExpert
    ? [...baseNavItems, { path: "/expert", label: "Review", icon: Shield }]
    : baseNavItems;

  return (
    <nav
      className={cn(
        "sticky bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md",
        className
      )}
      aria-label="Bottom navigation"
    >
      <div className="mx-auto flex max-w-3xl items-center justify-around px-2 py-1.5">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}

        <button
          type="button"
          onClick={toggleTheme}
          className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none"
          aria-label="Toggle light or dark theme"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Moon className="h-4 w-4" aria-hidden="true" />
          )}
          <span className="truncate">Theme</span>
        </button>
      </div>
    </nav>
  );
}
