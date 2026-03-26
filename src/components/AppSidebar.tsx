import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Image, Film, Radio, TrafficCone, ChevronLeft, ChevronRight, SlidersHorizontal, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { useDetectionConfig, type ModelSize } from "@/contexts/DetectionConfigContext";

const menuItems = [
  { title: "Dashboard", path: "/", icon: LayoutDashboard },
  { title: "Deteksi Gambar", path: "/deteksi-gambar", icon: Image },
  { title: "Proses Video", path: "/proses-video", icon: Film },
  { title: "Live Monitoring", path: "/live-monitoring", icon: Radio },
];

const clampLine = (v: string): number => {
  const n = parseFloat(v);
  if (isNaN(n)) return 0;
  return Math.min(1, Math.max(0, parseFloat(n.toFixed(2))));
};

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const config = useDetectionConfig();
  const [configOpen, setConfigOpen] = useState(true);

  const isDashboard = location.pathname === "/";
  const isImagePage = location.pathname === "/deteksi-gambar";
  const showLineConfig = !isDashboard && !isImagePage;
  const configDisabled = isDashboard;

  return (
    <>
      {/* Mobile overlay */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out overflow-hidden",
          collapsed ? "w-16" : "w-[250px]"
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4 shrink-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg gradient-primary">
            <TrafficCone className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="text-sm font-bold text-foreground truncate">
              Traffic Detection PSM
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="space-y-1 p-3 shrink-0">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary/15 text-primary shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.title}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* ─── Konfigurasi Panel ─── */}
        {!collapsed && (
          <div className="flex-1 overflow-y-auto border-t border-sidebar-border">
            <button
              onClick={() => setConfigOpen(!configOpen)}
              className="w-full flex items-center gap-2 px-4 py-3 hover:bg-sidebar-accent/50 transition-colors"
            >
              <SlidersHorizontal className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-medium">Konfigurasi</span>
              <Info className="h-3.5 w-3.5 text-muted-foreground ml-auto cursor-help" />
            </button>

            {configOpen && (
              <div className={cn("px-4 pb-4 space-y-5", configDisabled && "opacity-40 pointer-events-none")}>
                {/* Confidence */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Confidence Threshold</span>
                    <span className="font-mono font-medium text-primary">{config.confidence.toFixed(2)}</span>
                  </div>
                  <Slider
                    value={[config.confidence]}
                    onValueChange={([v]) => config.setConfidence(v)}
                    min={0}
                    max={1}
                    step={0.05}
                  />
                </div>

                {/* IoU */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">IoU Threshold</span>
                    <span className="font-mono font-medium text-secondary">{config.iou.toFixed(2)}</span>
                  </div>
                  <Slider
                    value={[config.iou]}
                    onValueChange={([v]) => config.setIou(v)}
                    min={0}
                    max={1}
                    step={0.05}
                  />
                </div>

                {/* Model Size */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    {(["SMALL", "MEDIUM"] as ModelSize[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => config.setModelSize(s)}
                        className={cn(
                          "flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all",
                          config.modelSize === s
                            ? "bg-primary text-primary-foreground shadow-md"
                            : "bg-muted/50 text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {s === "SMALL" ? "SMALL\n(Cepat)" : "MEDIUM\n(Akurat)"}
                      </button>
                    ))}
                  </div>
                  <div className="text-[10px] text-muted-foreground space-y-0.5">
                    <p>Model Size</p>
                    <p>*SMALL: YOLOv11s, 19 MB</p>
                    <p>*MEDIUM: YOLOv11m, 40 MB</p>
                  </div>
                </div>

                {/* Counting Line Position — only for video/live pages */}
                {showLineConfig && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Posisi Garis Penghitung (0.0 - 1.0)</span>
                      <div className="group relative">
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-popover text-popover-foreground text-[10px] rounded-md shadow-lg border opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                          Kendaraan dihitung saat melewati garis ini
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground">Start X</label>
                        <Input
                          type="number"
                          step={0.05}
                          min={0}
                          max={1}
                          value={config.lineStartX}
                          onChange={(e) => config.setLineStartX(clampLine(e.target.value))}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">End X</label>
                        <Input
                          type="number"
                          step={0.05}
                          min={0}
                          max={1}
                          value={config.lineEndX}
                          onChange={(e) => config.setLineEndX(clampLine(e.target.value))}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Start Y</label>
                        <Input
                          type="number"
                          step={0.05}
                          min={0}
                          max={1}
                          value={config.lineStartY}
                          onChange={(e) => config.setLineStartY(clampLine(e.target.value))}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">End Y</label>
                        <Input
                          type="number"
                          step={0.05}
                          min={0}
                          max={1}
                          value={config.lineEndY}
                          onChange={(e) => config.setLineEndY(clampLine(e.target.value))}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-sidebar-border p-3 shrink-0">
          {!collapsed && (
            <div className="text-xs text-muted-foreground text-center space-y-0.5">
              <p>© 2026 PSM</p>
              <p>v1.0.0</p>
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </aside>

      {/* Spacer */}
      <div className={cn("shrink-0 transition-all duration-300", collapsed ? "w-16" : "w-[250px]")} />
    </>
  );
}
