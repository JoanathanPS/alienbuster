import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { BottomNav } from "@/components/BottomNav";
import { AppHeader } from "@/components/AppHeader";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import Index from "./pages/Index";
import Submit from "./pages/Submit";
import MyReports from "./pages/MyReports";
import Hotspots from "./pages/Hotspots";
import AdminReview from "./pages/AdminReview";
import HowItWorks from "./pages/HowItWorks";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <AuthProvider>
          <SidebarProvider defaultOpen>
            <AppSidebar />
            <SidebarInset className="flex min-h-svh flex-1 flex-col">
              <AppHeader />
              <div className="min-h-0 flex-1">
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/how-it-works" element={<HowItWorks />} />
                  <Route path="/submit" element={<ProtectedRoute><Submit /></ProtectedRoute>} />
                  <Route path="/my-reports" element={<ProtectedRoute><MyReports /></ProtectedRoute>} />
                  <Route path="/hotspots" element={<ProtectedRoute><Hotspots /></ProtectedRoute>} />
                  <Route path="/admin-review" element={<ProtectedRoute><AdminReview /></ProtectedRoute>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </div>
              <BottomNav className="md:hidden" />
            </SidebarInset>
          </SidebarProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
