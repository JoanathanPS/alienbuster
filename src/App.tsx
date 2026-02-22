import { useEffect, useState } from "react";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import { AuthProvider } from "@/hooks/useAuth";
import { BottomNav } from "@/components/BottomNav";
import { AppHeader } from "@/components/AppHeader";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { KnowledgeSidebar } from "@/components/KnowledgeSidebar";
import { CommandPalette } from "@/components/CommandPalette";
import { logAction } from "@/lib/actionLog";

import Index from "./pages/Index";
import Submit from "./pages/Submit";
import MyReports from "./pages/MyReports";
import Hotspots from "./pages/Hotspots";
import AdminReview from "./pages/AdminReview";
import HowItWorks from "./pages/HowItWorks";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import SatelliteCorrelation from "./pages/SatelliteCorrelation";
import ExpertReview from "./pages/ExpertReview";
import ResponseCenter from "./pages/ResponseCenter";
import Outbreaks from "./pages/Outbreaks";

import DatasetPage from "./pages/Dataset";
import FontPreview from "./pages/FontPreview";

const queryClient = new QueryClient();

function Scene({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}

function AppRoutes() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    const label =
      path === "/"
        ? "Dashboard"
        : path.startsWith("/satellite") || path.startsWith("/intel")
          ? "Satellite & Correlation"
          : path.startsWith("/expert")
            ? "Expert Review"
            : path.startsWith("/response")
              ? "Response Center"
              : path.startsWith("/outbreaks")
                ? "Outbreaks"
                : path;

    logAction({ title: "Navigate", detail: label, href: path });
  }, [location.pathname]);

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Scene><Index /></Scene>} />
        <Route path="/login" element={<Scene><Login /></Scene>} />
        <Route path="/how-it-works" element={<Scene><HowItWorks /></Scene>} />

        <Route path="/submit" element={<ProtectedRoute><Scene><Submit /></Scene></ProtectedRoute>} />
        <Route path="/my-reports" element={<ProtectedRoute><Scene><MyReports /></Scene></ProtectedRoute>} />
        <Route path="/hotspots" element={<ProtectedRoute><Scene><Hotspots /></Scene></ProtectedRoute>} />

        <Route path="/intel" element={<ProtectedRoute><Scene><SatelliteCorrelation /></Scene></ProtectedRoute>} />
        <Route path="/satellite" element={<ProtectedRoute><Scene><SatelliteCorrelation /></Scene></ProtectedRoute>} />

        <Route path="/expert" element={<ProtectedRoute><Scene><ExpertReview /></Scene></ProtectedRoute>} />
        <Route path="/expert-review" element={<ProtectedRoute><Scene><ExpertReview /></Scene></ProtectedRoute>} />

        <Route path="/response" element={<ProtectedRoute><Scene><ResponseCenter /></Scene></ProtectedRoute>} />
        <Route path="/outbreaks" element={<ProtectedRoute><Scene><Outbreaks /></Scene></ProtectedRoute>} />
        <Route path="/dataset" element={<ProtectedRoute><Scene><DatasetPage /></Scene></ProtectedRoute>} />
        <Route path="/font-preview" element={<Scene><FontPreview /></Scene>} />

        <Route path="/admin-review" element={<ProtectedRoute><Scene><AdminReview /></Scene></ProtectedRoute>} />
        <Route path="*" element={<Scene><NotFound /></Scene>} />
      </Routes>
    </AnimatePresence>
  );
}

const App = () => {
  const [cmdOpen, setCmdOpen] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <AuthProvider>
            <SidebarProvider defaultOpen>
              <AppSidebar />
              <SidebarInset className="flex min-h-svh flex-1 flex-col">
                <AppHeader onOpenCommandPalette={() => setCmdOpen(true)} />
                <div className="min-h-0 flex-1">
                  <AppRoutes />
                </div>
                <BottomNav className="md:hidden" />
              </SidebarInset>
              <KnowledgeSidebar />
              <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
            </SidebarProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
