import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Settings, ChevronRight } from "lucide-react";
import { useApiSettings } from "@/contexts/ApiContext";
import { ApiSettingsModal } from "./ApiSettingsModal";

const routeNames: Record<string, string> = {
  "/": "Dashboard",
  "/deteksi-gambar": "Deteksi Gambar",
  "/proses-video": "Proses Video",
  "/live-monitoring": "Live Monitoring",
};

export function TopBar() {
  const location = useLocation();
  const { baseUrl, isConnected, setIsConnected, setDeviceInfo } = useApiSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const currentRoute = routeNames[location.pathname] || "Halaman";

  // Health check
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const data = await res.json();
          setIsConnected(true);
          setDeviceInfo(data.device || data.gpu || "");
        } else {
          setIsConnected(false);
        }
      } catch {
        setIsConnected(false);
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [baseUrl, setIsConnected, setDeviceInfo]);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 backdrop-blur-md px-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Traffic Detection</span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium text-foreground">{currentRoute}</span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* API status */}
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`h-2 w-2 rounded-full ${isConnected ? "bg-primary pulse-live" : "bg-destructive"}`}
            />
            <span className="text-muted-foreground">
              {isConnected ? "API Terhubung" : "API Terputus"}
            </span>
          </div>

          {/* Settings */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      <ApiSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
