import { Home, FileText, MapPin, Info, Shield, Moon, Sun } from "lucide-react";
import { useLocation } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";

const baseNavItems = [
  { path: "/", label: "Home", icon: Home },
  { path: "/my-reports", label: "My Reports", icon: FileText },
  { path: "/hotspots", label: "Hotspots", icon: MapPin },
  { path: "/how-it-works", label: "How it works", icon: Info },
] as const;

export function AppSidebar() {
  const location = useLocation();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // IMPORTANT: Hard gate expert UI to the allowlisted email only.
  const isExpert = user?.email === "expert@example.com";

  const navItems = isExpert
    ? [...baseNavItems, { path: "/expert-review", label: "Expert review", icon: Shield }]
    : baseNavItems;

  return (
    <Sidebar
      collapsible="offcanvas"
      variant="sidebar"
      aria-label="Primary"
    >
      <SidebarHeader>
        <div className="flex items-center justify-between px-2 py-2">
          <div className="leading-tight">
            <div className="text-sm font-semibold">Alien Buster</div>
            <div className="text-xs text-muted-foreground">Early warning system</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <NavLink to={item.path}>
                        <Icon />
                        <span>{item.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={toggleTheme}>
              {theme === "dark" ? <Sun /> : <Moon />}
              <span>Theme</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
