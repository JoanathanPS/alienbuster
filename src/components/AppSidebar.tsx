import { Home, FileText, MapPin, Info, Shield, Moon, Sun, Radar, Siren, Layers } from "lucide-react";
import { useLocation } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import { isExpertEmail } from "@/lib/expertAccess";
import { useTheme } from "@/hooks/useTheme";
import { NavLink } from "@/components/NavLink";
import { Badge } from "@/components/ui/badge";
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
  { path: "/outbreaks", label: "Outbreaks", icon: Layers },
  { path: "/intel", label: "Intel", icon: Radar, badge: "NEW" },
  { path: "/response", label: "Response", icon: Siren },
  { path: "/how-it-works", label: "How it works", icon: Info },
] as const;

export function AppSidebar() {
  const location = useLocation();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const isExpert = isExpertEmail(user?.email);

  const navItems = isExpert
    ? [...baseNavItems, { path: "/expert", label: "Expert review", icon: Shield, badge: "EXPERT" }]
    : baseNavItems;

  return (
    <Sidebar
      collapsible="icon"
      variant="floating"
      aria-label="Primary"
      className="border-r border-white/10 bg-sidebar/25 backdrop-blur-2xl"
    >
      <SidebarHeader>
        <div className="flex items-center justify-between px-2 py-2">
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">AlienBuster</div>
            <div className="text-xs text-muted-foreground">Monitoring console</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item: any) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <NavLink to={item.path} className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <Icon />
                          <span>{item.label}</span>
                        </span>
                        {item.badge ? (
                          <Badge variant="outline" className="hidden text-[10px] md:inline-flex">
                            {item.badge}
                          </Badge>
                        ) : null}
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
