import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Truck, Car, PersonStanding, Bike, BarChart3, Camera, Film, Radio, Server, Trash2, ExternalLink } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
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

/* ─── Chart Toggle Button ─── */
const ChartToggle = ({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1 text-xs font-medium rounded-full transition-all duration-200 ${
      active
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
    }`}
  >
    {label}
  </button>
);

/* ─── Donut chart colors ─── */
const DONUT_COLORS = [
  "hsl(217, 91%, 60%)",   // blue - big vehicle
  "hsl(160, 84%, 39%)",   // green - car
  "hsl(38, 92%, 50%)",    // amber - pedestrian
  "hsl(258, 90%, 66%)",   // purple - two-wheeler
];

const CLASS_LABELS = ["Big Vehicle", "Mobil (Car)", "Pejalan Kaki", "Kendaraan Roda Dua"];

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

/* ─── Build hourly chart data from activity logs ─── */
function buildHourlyData(logs: ActivityLog[]) {
  const hourMap: Record<string, { bigVehicle: number; car: number; pedestrian: number; twoWheeler: number }> = {};

  // Initialize hours 08:00 - 17:00
  for (let h = 8; h <= 17; h++) {
    const key = `${h.toString().padStart(2, "0")}:00`;
    hourMap[key] = { bigVehicle: 0, car: 0, pedestrian: 0, twoWheeler: 0 };
  }

  // Aggregate logs by hour
  logs.forEach((log) => {
    const date = new Date(log.timestamp);
    const hour = date.getHours();
    const key = `${hour.toString().padStart(2, "0")}:00`;
    if (hourMap[key]) {
      // Distribute detection counts roughly
      const counts = log.totalDeteksi || 0;
      hourMap[key].car += Math.round(counts * 0.4);
      hourMap[key].twoWheeler += Math.round(counts * 0.3);
      hourMap[key].pedestrian += Math.round(counts * 0.2);
      hourMap[key].bigVehicle += Math.round(counts * 0.1);
    }
  });

  return Object.entries(hourMap).map(([hour, counts]) => ({
    hour,
    ...counts,
  }));
}

/* ─── Custom Tooltip for Charts ─── */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card rounded-lg p-3 text-xs border border-border/60">
      <p className="font-medium mb-1.5">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-semibold">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

/* ─── Custom Legend for Donut ─── */
const DonutLegend = ({ data }: { data: { name: string; value: number; percentage: string }[] }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <div className="space-y-2 mt-2">
      {data.map((entry, i) => (
        <div key={entry.name} className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: DONUT_COLORS[i] }} />
            <span className="text-muted-foreground truncate">{entry.name}</span>
          </div>
          <div className="flex items-center gap-2 ml-2">
            <span className="font-semibold">{entry.value}</span>
            <span className="text-muted-foreground w-10 text-right">{entry.percentage}</span>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between text-xs pt-2 border-t border-border/40">
        <span className="text-muted-foreground">Total</span>
        <span className="font-semibold">{total}</span>
      </div>
    </div>
  );
};

/* ─── Main Dashboard ─── */
const Dashboard = () => {
  const { baseUrl, isConnected } = useApiSettings();
  const [systemInfo, setSystemInfo] = useState<{ model?: string; device?: string; version?: string; endpoints?: string[] } | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [chartMode, setChartMode] = useState<"bar" | "line" | "daily">("bar");

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

  // Last detection counts
  const lastDetection = (() => {
    try {
      const raw = localStorage.getItem("last-detection-counts");
      if (raw) return JSON.parse(raw);
    } catch { /* empty */ }
    return { bigVehicle: 0, car: 0, pedestrian: 0, twoWheeler: 0 };
  })();

  const total = lastDetection.bigVehicle + lastDetection.car + lastDetection.pedestrian + lastDetection.twoWheeler;

  // Chart data
  const hourlyData = useMemo(() => buildHourlyData(logs), [logs]);

  const donutData = useMemo(() => {
    const items = [
      { name: "Big Vehicle", value: lastDetection.bigVehicle },
      { name: "Mobil (Car)", value: lastDetection.car },
      { name: "Pejalan Kaki", value: lastDetection.pedestrian },
      { name: "Kendaraan Roda Dua", value: lastDetection.twoWheeler },
    ];
    const t = items.reduce((s, d) => s + d.value, 0);
    return items.map((d) => ({
      ...d,
      percentage: t > 0 ? `${Math.round((d.value / t) * 100)}%` : "0%",
    }));
  }, [lastDetection]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <Section>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Ringkasan sistem deteksi kendaraan</p>
      </Section>

      {/* Section 1: Stat Cards — Total first, then 4 classes */}
      <Section delay={100}>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
          <StatCard
            icon={BarChart3}
            label="Total Kendaraan"
            value={total}
            colorVar="var(--traffic-green)"
            className="gradient-total"
            gradient
          />
          <StatCard icon={Truck} label="Big Vehicle" value={lastDetection.bigVehicle} colorVar="var(--traffic-blue)" />
          <StatCard icon={Car} label="Car" value={lastDetection.car} colorVar="var(--traffic-green)" />
          <StatCard icon={PersonStanding} label="Pedestrian" value={lastDetection.pedestrian} colorVar="var(--traffic-amber)" />
          <StatCard icon={Bike} label="Bike" value={lastDetection.twoWheeler} colorVar="var(--traffic-purple)" />
        </div>
      </Section>

      {/* Section 2: Charts — Bar/Line chart + Donut */}
      <Section delay={200}>
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          {/* Bar / Line Chart */}
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Grafik Deteksi Kendaraan</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Data deteksi per jam hari ini</p>
              </div>
              <div className="flex items-center gap-1 bg-muted/40 rounded-full p-0.5">
                <ChartToggle active={chartMode === "bar"} label="Bar" onClick={() => setChartMode("bar")} />
                <ChartToggle active={chartMode === "line"} label="Line" onClick={() => setChartMode("line")} />
                <ChartToggle active={chartMode === "daily"} label="Harian" onClick={() => setChartMode("daily")} />
              </div>
            </div>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                {chartMode === "line" ? (
                  <LineChart data={hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 16%, 22%)" />
                    <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "hsl(215, 14%, 55%)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(215, 14%, 55%)" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="bigVehicle" name="Big Vehicle" stroke="hsl(217, 91%, 60%)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="car" name="Mobil (Car)" stroke="hsl(160, 84%, 39%)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="pedestrian" name="Pejalan Kaki" stroke="hsl(38, 92%, 50%)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="twoWheeler" name="Kendaraan Roda Dua" stroke="hsl(258, 90%, 66%)" strokeWidth={2} dot={false} />
                  </LineChart>
                ) : (
                  <BarChart data={hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 16%, 22%)" />
                    <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "hsl(215, 14%, 55%)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(215, 14%, 55%)" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="bigVehicle" name="Big Vehicle" fill="hsl(217, 91%, 60%)" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="car" name="Mobil (Car)" fill="hsl(160, 84%, 39%)" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="pedestrian" name="Pejalan Kaki" fill="hsl(38, 92%, 50%)" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="twoWheeler" name="Kendaraan Roda Dua" fill="hsl(258, 90%, 66%)" radius={[2, 2, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Donut / Distribution Chart */}
          <div className="glass-card rounded-xl p-5">
            <h2 className="text-lg font-semibold">Distribusi Kendaraan</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Proporsi per tipe deteksi</p>
            <div className="h-[180px] mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {donutData.map((_, i) => (
                      <Cell key={i} fill={DONUT_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="glass-card rounded-lg p-2 text-xs border border-border/60">
                          <span className="font-medium">{d.name}: </span>
                          <span className="font-semibold">{d.value}</span>
                          <span className="text-muted-foreground ml-1">({d.percentage})</span>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <DonutLegend data={donutData} />
          </div>
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

      {/* Section 4: Quick Actions */}
      <Section delay={400}>
        <h2 className="text-lg font-semibold mb-3">Quick Action</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <QuickAction icon={Camera} title="Deteksi Gambar" description="Upload foto untuk analisis cepat" to="/deteksi-gambar" />
          <QuickAction icon={Film} title="Proses Video" description="Upload video untuk counting kendaraan" to="/proses-video" />
          <QuickAction icon={Radio} title="Live Monitoring" description="Upload foto untuk analisis cepat" to="/live-monitoring" />
        </div>
      </Section>

      {/* Section 5: Activity Log */}
      <Section delay={500}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Log Aktivitas Terbaru</h2>
          {logs.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClearLogs} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4 mr-1.5" />
              Clean Logs
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
                    <th className="px-4 py-3 font-medium text-muted-foreground">File/Source</th>
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
