import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Settings, ChevronRight, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { useApiSettings } from "@/contexts/ApiContext";
import { ApiSettingsModal } from "./ApiSettingsModal";

const routeNames: Record<string, string> = {
  "/": "Dashboard",
  "/deteksi-gambar": "Deteksi Gambar",
  "/proses-video": "Proses Video",
  "/live-monitoring": "Live Monitoring",
};

/* ─── Theme cycle order: system → light → dark → system … ─── */
const CYCLE: Array<"system" | "light" | "dark"> = ["system", "light", "dark"];

function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const handleClick = () => {
    const current = (theme as typeof CYCLE[number]) ?? "system";
    const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
    setTheme(next);
  };

  /* Placeholder ukuran sama agar layout tidak shift sebelum mounted */
  if (!mounted) {
    return <span className="h-7 w-7 rounded-lg" />;
  }

  const isDark = resolvedTheme === "dark";
  const isSystem = theme === "system";

  return (
    <button
      onClick={handleClick}
      className="relative rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      aria-label={`Tema saat ini: ${theme}. Klik untuk ganti.`}
      title={`Tema: ${theme === "system" ? "Sistem" : theme === "dark" ? "Gelap" : "Terang"}`}
    >
      {/* Sun icon — tampil di dark mode, fade keluar di light */}
      <Sun
        className="h-4 w-4 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          opacity: isDark ? 1 : 0,
          transform: `translate(-50%, -50%) rotate(${isDark ? 0 : 90}deg) scale(${isDark ? 1 : 0.5})`,
          transition: "opacity 250ms ease, transform 250ms ease",
        }}
      />
      {/* Moon icon — tampil di light mode, fade keluar di dark */}
      <Moon
        className="h-4 w-4 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          opacity: !isDark ? 1 : 0,
          transform: `translate(-50%, -50%) rotate(${!isDark ? 0 : -90}deg) scale(${!isDark ? 1 : 0.5})`,
          transition: "opacity 250ms ease, transform 250ms ease",
        }}
      />
      {/* Spacer agar button punya ukuran */}
      <span className="h-4 w-4 block opacity-0" aria-hidden />
      {/* Dot indikator "system" mode */}
      {isSystem && (
        <span
          className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary border-2 border-background"
          title="Mengikuti preferensi sistem"
        />
      )}
    </button>
  );
}

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

          {/* Theme toggle */}
          <ThemeToggle />

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
