import { Home, FileText, MapPin, Info, Moon, Sun, Shield } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";

const baseNavItems = [
  { path: "/", label: "Home", icon: Home },
  { path: "/my-reports", label: "Reports", icon: FileText },
  { path: "/hotspots", label: "Hotspots", icon: MapPin },
  { path: "/how-it-works", label: "Info", icon: Info },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { isAdmin } = useAuth();

  const navItems = isAdmin
    ? [...baseNavItems, { path: "/admin-review", label: "Review", icon: Shield }]
    : baseNavItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-center justify-around py-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-xs transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
        <button
          onClick={toggleTheme}
          className="flex flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          <span>Theme</span>
        </button>
      </div>
    </nav>
  );
}
