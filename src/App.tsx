import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ApiProvider } from "@/contexts/ApiContext";
import DashboardLayout from "@/components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import DeteksiGambar from "./pages/DeteksiGambar";
import ProsesVideo from "./pages/ProsesVideo";
import LiveMonitoring from "./pages/LiveMonitoring";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ApiProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/deteksi-gambar" element={<DeteksiGambar />} />
              <Route path="/proses-video" element={<ProsesVideo />} />
              <Route path="/live-monitoring" element={<LiveMonitoring />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ApiProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
