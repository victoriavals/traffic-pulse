import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Truck, Car, PersonStanding, Bike, BarChart3, Camera, Film, Radio, Server, Trash2, ExternalLink } from "lucide-react";
import { useApiSettings } from "@/contexts/ApiContext";
import { getActivityLogs, clearActivityLogs, type ActivityLog } from "@/lib/activity-log";
import { Button } from "@/components/ui/button";

/* ─── Section wrapper with staggered animation ─── */
const Section = ({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) => (
  <div
    className={`opacity-0 animate-fade-in-up ${className}`}
    style={{ animationDelay: `${delay}ms` }}
  >
    {children}
  </div>
);

/* ─── Stat Card ─── */
interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  colorVar: string;
  className?: string;
  gradient?: boolean;
}

const StatCard = ({ icon: Icon, label, value, colorVar, className = "", gradient }: StatCardProps) => (
  <div
    className={`glass-card rounded-xl p-5 transition-all duration-300 hover:scale-[1.03] hover:shadow-xl group ${gradient ? "gradient-total" : ""} ${className}`}
  >
    <div className="flex items-center gap-3">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110"
        style={{ backgroundColor: `hsl(${colorVar} / 0.15)` }}
      >
        <Icon className="h-5 w-5" style={{ color: `hsl(${colorVar})` }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
        <p className="text-2xl font-bold mt-0.5">{value}</p>
      </div>
    </div>
  </div>
);

/* ─── Quick Action Card ─── */
const QuickAction = ({ icon: Icon, title, description, to }: { icon: React.ElementType; title: string; description: string; to: string }) => {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(to)}
      className="glass-card rounded-xl p-5 text-left transition-all duration-300 hover:scale-[1.03] hover:shadow-xl hover:border-primary/30 group w-full"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-all duration-300 group-hover:bg-primary/20 group-hover:scale-110">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-sm">{title}</h3>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
        <ExternalLink className="h-4 w-4 text-muted-foreground ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  );
};

/* ─── Main Dashboard ─── */
const Dashboard = () => {
  const { baseUrl, isConnected } = useApiSettings();
  const [systemInfo, setSystemInfo] = useState<{ model?: string; device?: string; version?: string; endpoints?: string[] } | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  // Fetch system info
  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const res = await fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const data = await res.json();
          setSystemInfo(data);
        }
      } catch {
        setSystemInfo(null);
      }
    };
    fetchInfo();
  }, [baseUrl]);

  // Load logs
  useEffect(() => {
    setLogs(getActivityLogs());
  }, []);

  const handleClearLogs = useCallback(() => {
    clearActivityLogs();
    setLogs([]);
  }, []);

  // Last detection counts (will be populated from detection pages later)
  const lastDetection = (() => {
    try {
      const raw = localStorage.getItem("last-detection-counts");
      if (raw) return JSON.parse(raw);
    } catch { /* empty */ }
    return { bigVehicle: 0, car: 0, pedestrian: 0, twoWheeler: 0 };
  })();

  const total = lastDetection.bigVehicle + lastDetection.car + lastDetection.pedestrian + lastDetection.twoWheeler;

  return (
    <div className="space-y-8">
      {/* Header */}
      <Section>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Ringkasan sistem deteksi kendaraan</p>
      </Section>

      {/* Section 1: Stat Cards */}
      <Section delay={100}>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-6">
          <StatCard icon={Truck} label="Big Vehicle" value={lastDetection.bigVehicle} colorVar="var(--traffic-blue)" />
          <StatCard icon={Car} label="Mobil (Car)" value={lastDetection.car} colorVar="var(--traffic-green)" />
          <StatCard icon={PersonStanding} label="Pejalan Kaki" value={lastDetection.pedestrian} colorVar="var(--traffic-amber)" />
          <StatCard icon={Bike} label="Kendaraan Roda Dua" value={lastDetection.twoWheeler} colorVar="var(--traffic-purple)" />
          <StatCard
            icon={BarChart3}
            label="Total Kendaraan"
            value={total}
            colorVar="var(--primary)"
            className="col-span-2 gradient-total"
            gradient
          />
        </div>
      </Section>

      {/* Section 2: Quick Actions */}
      <Section delay={200}>
        <h2 className="text-lg font-semibold mb-3">Aksi Cepat</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <QuickAction icon={Camera} title="Deteksi Gambar" description="Upload foto untuk analisis cepat" to="/deteksi-gambar" />
          <QuickAction icon={Film} title="Proses Video" description="Upload video untuk counting kendaraan" to="/proses-video" />
          <QuickAction icon={Radio} title="Live Monitoring" description="Pantau CCTV secara real-time" to="/live-monitoring" />
        </div>
      </Section>

      {/* Section 3: System Info */}
      <Section delay={300}>
        <h2 className="text-lg font-semibold mb-3">Informasi Sistem</h2>
        <div className="glass-card rounded-xl p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoItem label="Model Aktif" value={systemInfo?.model || "—"} />
            <InfoItem label="Device (GPU)" value={systemInfo?.device || "—"} />
            <InfoItem label="API Version" value={systemInfo?.version || "—"} />
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Status</p>
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${isConnected ? "bg-primary pulse-live" : "bg-destructive"}`} />
                <span className="text-sm font-medium">{isConnected ? "Online" : "Offline"}</span>
              </div>
            </div>
          </div>
          {systemInfo?.endpoints && systemInfo.endpoints.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/40">
              <p className="text-xs font-medium text-muted-foreground mb-2">Endpoint Tersedia</p>
              <div className="flex flex-wrap gap-2">
                {systemInfo.endpoints.map((ep: string) => (
                  <span key={ep} className="inline-flex items-center gap-1 rounded-lg bg-muted/60 px-2.5 py-1 text-xs font-mono text-muted-foreground">
                    <Server className="h-3 w-3" />
                    {ep}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* Section 4: Activity Log */}
      <Section delay={400}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Log Aktivitas Terbaru</h2>
          {logs.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClearLogs} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4 mr-1.5" />
              Bersihkan Log
            </Button>
          )}
        </div>
        <div className="glass-card rounded-xl overflow-hidden">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Belum ada aktivitas. Mulai deteksi untuk melihat log di sini.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 text-left">
                    <th className="px-4 py-3 font-medium text-muted-foreground">Waktu</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Tipe</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">File / Source</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground text-right">Total Deteksi</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-border/20 last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td className="px-4 py-3">
                        <TypeBadge type={log.type} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs truncate max-w-[200px]">{log.source}</td>
                      <td className="px-4 py-3 text-right font-semibold">{log.totalDeteksi}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
};

/* ─── Small helpers ─── */
const InfoItem = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
    <p className="text-sm font-semibold">{value}</p>
  </div>
);

const typeColors: Record<string, string> = {
  Gambar: "bg-traffic-blue/15 text-traffic-blue",
  Video: "bg-traffic-purple/15 text-traffic-purple",
  RTSP: "bg-traffic-amber/15 text-traffic-amber",
};

const TypeBadge = ({ type }: { type: string }) => (
  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${typeColors[type] || "bg-muted text-muted-foreground"}`}>
    {type}
  </span>
);

export default Dashboard;
