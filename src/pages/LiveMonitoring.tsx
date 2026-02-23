import { useState, useRef, useCallback, useEffect } from "react";
import {
  Radio, Play, Square, Camera, SlidersHorizontal, Info,
  Truck, Car, PersonStanding, Bike, BarChart3, Loader2,
  AlertCircle, ChevronDown, ChevronUp, Copy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { useApiSettings } from "@/contexts/ApiContext";
import { addActivityLog } from "@/lib/activity-log";
import { toast } from "@/hooks/use-toast";

/* ─── Types ─── */
interface Counts {
  big_vehicle: number;
  car: number;
  pedestrian: number;
  two_wheeler: number;
  total: number;
}

interface WSFrameData {
  type: "frame";
  frame: string; // base64 JPEG
  fps: number;
  frame_number: number;
  counts: Counts;
}

interface SnapshotResponse {
  success: boolean;
  message: string;
  counts: Counts;
  video_info: { resolution: string; fps: number; total_frames: number; duration_seconds: number; processing_time_seconds: number };
  inference_config: { model: string; device: string; image_size: number; line_start: number[]; line_end: number[] };
}

type ModelSize = "SMALL" | "MEDIUM";

/* ─── Page ─── */
const LiveMonitoring = () => {
  const { baseUrl } = useApiSettings();

  // Config
  const [rtspUrl, setRtspUrl] = useState("");
  const [confidence, setConfidence] = useState(0.45);
  const [iou, setIou] = useState(0.5);
  const [modelSize, setModelSize] = useState<ModelSize>("SMALL");
  const [frameCount, setFrameCount] = useState(150);

  // Counting line
  const [lineStartX, setLineStartX] = useState(0.0);
  const [lineStartY, setLineStartY] = useState(0.15);
  const [lineEndX, setLineEndX] = useState(1.0);
  const [lineEndY, setLineEndY] = useState(0.65);
  const [lineOpen, setLineOpen] = useState(false);

  // Stream state
  const [streaming, setStreaming] = useState(false);
  const [frameSrc, setFrameSrc] = useState<string | null>(null);
  const [liveFps, setLiveFps] = useState(0);
  const [frameNumber, setFrameNumber] = useState(0);
  const [liveCounts, setLiveCounts] = useState<Counts>({ big_vehicle: 0, car: 0, pedestrian: 0, two_wheeler: 0, total: 0 });
  const wsRef = useRef<WebSocket | null>(null);

  // Snapshot state
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotResult, setSnapshotResult] = useState<SnapshotResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* ─── Cleanup WS on unmount ─── */
  useEffect(() => {
    return () => {
      wsRef.current?.close();
    };
  }, []);

  /* ─── WebSocket stream ─── */
  const startStream = useCallback(() => {
    if (!rtspUrl.trim()) {
      setError("Masukkan URL RTSP terlebih dahulu");
      return;
    }
    setError(null);
    setSnapshotResult(null);

    const wsUrl = baseUrl.replace(/^http/, "ws") + "/rtsp/stream";
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStreaming(true);
      ws.send(JSON.stringify({
        url: rtspUrl,
        confidence,
        iou,
        model_size: modelSize,
        line_config: {
          start_x: lineStartX,
          start_y: lineStartY,
          end_x: lineEndX,
          end_y: lineEndY,
        },
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data: WSFrameData = JSON.parse(event.data);
        if (data.type === "frame") {
          setFrameSrc(`data:image/jpeg;base64,${data.frame}`);
          setLiveFps(data.fps);
          setFrameNumber(data.frame_number);
          setLiveCounts(data.counts);
        }
      } catch {
        // ignore non-JSON messages
      }
    };

    ws.onerror = () => {
      setError("WebSocket connection error");
      setStreaming(false);
    };

    ws.onclose = () => {
      setStreaming(false);
    };
  }, [rtspUrl, baseUrl, confidence, iou, modelSize, lineStartX, lineStartY, lineEndX, lineEndY]);

  const stopStream = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setStreaming(false);
    // Log activity
    if (liveCounts.total > 0) {
      addActivityLog({ type: "RTSP", source: rtspUrl, totalDeteksi: liveCounts.total });
      localStorage.setItem("last-detection-counts", JSON.stringify({
        bigVehicle: liveCounts.big_vehicle,
        car: liveCounts.car,
        pedestrian: liveCounts.pedestrian,
        twoWheeler: liveCounts.two_wheeler,
      }));
    }
  }, [rtspUrl, liveCounts]);

  /* ─── Snapshot API ─── */
  const callSnapshot = useCallback(async () => {
    if (!rtspUrl.trim()) {
      setError("Masukkan URL RTSP terlebih dahulu");
      return;
    }
    setSnapshotLoading(true);
    setError(null);
    setSnapshotResult(null);

    try {
      const res = await fetch(`${baseUrl}/rtsp/detect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: rtspUrl,
          confidence,
          iou,
          model_size: modelSize,
          frame_count: frameCount,
          line_config: {
            start_x: lineStartX,
            start_y: lineStartY,
            end_x: lineEndX,
            end_y: lineEndY,
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `HTTP ${res.status}`);
      }

      const data: SnapshotResponse = await res.json();
      setSnapshotResult(data);
      addActivityLog({ type: "RTSP", source: rtspUrl, totalDeteksi: data.counts.total });
      localStorage.setItem("last-detection-counts", JSON.stringify({
        bigVehicle: data.counts.big_vehicle,
        car: data.counts.car,
        pedestrian: data.counts.pedestrian,
        twoWheeler: data.counts.two_wheeler,
      }));
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan");
    } finally {
      setSnapshotLoading(false);
    }
  }, [rtspUrl, baseUrl, confidence, iou, modelSize, frameCount, lineStartX, lineStartY, lineEndX, lineEndY]);

  const copySnapshot = useCallback(() => {
    if (snapshotResult) {
      navigator.clipboard.writeText(JSON.stringify(snapshotResult, null, 2));
      toast({ title: "Disalin!", description: "JSON response berhasil disalin ke clipboard." });
    }
  }, [snapshotResult]);

  const clampLine = (v: string) => {
    const n = parseFloat(v);
    if (isNaN(n)) return 0;
    return Math.min(1, Math.max(0, parseFloat(n.toFixed(2))));
  };

  const displayCounts = streaming ? liveCounts : (snapshotResult?.counts || { big_vehicle: 0, car: 0, pedestrian: 0, two_wheeler: 0, total: 0 });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="opacity-0 animate-fade-in-up">
        <h1 className="text-2xl font-bold">Live Monitoring</h1>
        <p className="text-muted-foreground text-sm mt-1">Pantau lalu lintas secara real-time melalui stream RTSP</p>
      </div>

      {/* ═══ Config Card ═══ */}
      <div className="glass-card rounded-xl p-5 space-y-4 opacity-0 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
        {/* RTSP URL */}
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">RTSP URL</label>
          <Input
            value={rtspUrl}
            onChange={(e) => setRtspUrl(e.target.value)}
            placeholder="rtsp://admin:password@192.168.1.72:554/H.264"
            className="font-mono text-sm"
            disabled={streaming}
          />
        </div>

        {/* Sliders + Model in row */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Confidence</span>
              <span className="font-mono font-medium">{confidence.toFixed(2)}</span>
            </div>
            <Slider value={[confidence]} onValueChange={([v]) => setConfidence(v)} min={0} max={1} step={0.05} disabled={streaming} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">IoU</span>
              <span className="font-mono font-medium">{iou.toFixed(2)}</span>
            </div>
            <Slider value={[iou]} onValueChange={([v]) => setIou(v)} min={0} max={1} step={0.05} disabled={streaming} />
          </div>
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground">Model Size</span>
            <div className="flex gap-2">
              {(["SMALL", "MEDIUM"] as ModelSize[]).map((s) => (
                <button
                  key={s}
                  onClick={() => !streaming && setModelSize(s)}
                  disabled={streaming}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all ${modelSize === s ? "bg-primary text-primary-foreground shadow-md" : "bg-muted/50 text-muted-foreground hover:bg-muted"} disabled:opacity-50`}
                >
                  {s === "SMALL" ? "SMALL" : "MEDIUM"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Counting Line (collapsible) */}
        <div className="border-t border-border/40 pt-3">
          <button onClick={() => setLineOpen(!lineOpen)} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Counting Line</span>
            <div className="group relative ml-1">
              <Info className="h-3 w-3 cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-popover text-popover-foreground text-[10px] rounded-md shadow-lg border opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                Kendaraan dihitung saat melewati garis ini
              </div>
            </div>
            <span className="ml-auto">{lineOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}</span>
          </button>
          {lineOpen && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground">Start X</label>
                <Input type="number" step={0.05} min={0} max={1} value={lineStartX} onChange={(e) => setLineStartX(clampLine(e.target.value))} className="h-8 text-xs font-mono" disabled={streaming} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Start Y</label>
                <Input type="number" step={0.05} min={0} max={1} value={lineStartY} onChange={(e) => setLineStartY(clampLine(e.target.value))} className="h-8 text-xs font-mono" disabled={streaming} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">End X</label>
                <Input type="number" step={0.05} min={0} max={1} value={lineEndX} onChange={(e) => setLineEndX(clampLine(e.target.value))} className="h-8 text-xs font-mono" disabled={streaming} />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">End Y</label>
                <Input type="number" step={0.05} min={0} max={1} value={lineEndY} onChange={(e) => setLineEndY(clampLine(e.target.value))} className="h-8 text-xs font-mono" disabled={streaming} />
              </div>
            </div>
          )}
        </div>

        {/* Frame count (snapshot only) */}
        {!streaming && (
          <div className="border-t border-border/40 pt-3">
            <label className="text-xs text-muted-foreground mb-1.5 block">Jumlah frame untuk di-capture (Snapshot)</label>
            <Input type="number" min={1} max={1000} value={frameCount} onChange={(e) => setFrameCount(parseInt(e.target.value) || 150)} className="h-8 text-xs font-mono w-32" />
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 pt-1">
          <Button onClick={callSnapshot} disabled={!rtspUrl.trim() || snapshotLoading || streaming} className="gap-2">
            {snapshotLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            Snapshot (JSON)
          </Button>
          {!streaming ? (
            <Button onClick={startStream} disabled={!rtspUrl.trim() || snapshotLoading} variant="secondary" className="gap-2">
              <Play className="h-4 w-4" /> Mulai Live Stream
            </Button>
          ) : (
            <Button onClick={stopStream} variant="destructive" className="gap-2">
              <Square className="h-4 w-4" /> Stop
            </Button>
          )}
        </div>
      </div>

      {/* ═══ Error ═══ */}
      {error && (
        <div className="glass-card rounded-xl p-4 border-destructive/50 bg-destructive/10 flex items-start gap-3 opacity-0 animate-fade-in-up">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">Error</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* ═══ Snapshot Loading ═══ */}
      {snapshotLoading && (
        <div className="glass-card rounded-xl p-12 flex flex-col items-center justify-center gap-3 opacity-0 animate-fade-in-up">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
          <p className="text-sm font-medium">Mengambil snapshot dari stream...</p>
          <p className="text-xs text-muted-foreground">Capturing {frameCount} frame, mohon tunggu</p>
        </div>
      )}

      {/* ═══ Live Stream + Counter ═══ */}
      {(streaming || frameSrc) && !snapshotLoading && (
        <div className="grid gap-4 lg:grid-cols-[1fr_280px] opacity-0 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
          {/* Video Feed */}
          <div className="glass-card rounded-xl overflow-hidden relative bg-black/50">
            {frameSrc ? (
              <>
                <img src={frameSrc} alt="Live feed" className="w-full object-contain" />
                {/* Overlays */}
                {streaming && (
                  <>
                    <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1 text-xs font-mono text-white">
                      {liveFps.toFixed(1)} FPS
                    </div>
                    <div className="absolute top-3 right-3 bg-red-600/90 backdrop-blur-sm rounded-lg px-2.5 py-1 text-xs font-bold text-white flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                      LIVE
                    </div>
                    <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1 text-xs font-mono text-white">
                      Frame #{frameNumber}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
                <Radio className="h-8 w-8 mb-3 opacity-40" />
                <p className="text-sm">Menghubungkan ke stream...</p>
              </div>
            )}
          </div>

          {/* Live Counter */}
          <div className="space-y-3">
            <CounterCard icon={Truck} label="Big Vehicle" value={displayCounts.big_vehicle} colorVar="var(--traffic-blue)" />
            <CounterCard icon={Car} label="Car" value={displayCounts.car} colorVar="var(--traffic-green)" />
            <CounterCard icon={PersonStanding} label="Pedestrian" value={displayCounts.pedestrian} colorVar="var(--traffic-amber)" />
            <CounterCard icon={Bike} label="Two Wheeler" value={displayCounts.two_wheeler} colorVar="var(--traffic-purple)" />
            <div className="glass-card rounded-xl p-4 bg-gradient-to-r from-emerald-500/10 to-teal-500/10">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold tabular-nums">{displayCounts.total}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Snapshot Results ═══ */}
      {!streaming && !snapshotLoading && snapshotResult && (
        <div className="space-y-4 opacity-0 animate-fade-in-up">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <SummaryCard icon={Truck} label="Big Vehicle" value={snapshotResult.counts.big_vehicle} colorVar="var(--traffic-blue)" />
            <SummaryCard icon={Car} label="Car" value={snapshotResult.counts.car} colorVar="var(--traffic-green)" />
            <SummaryCard icon={PersonStanding} label="Pedestrian" value={snapshotResult.counts.pedestrian} colorVar="var(--traffic-amber)" />
            <SummaryCard icon={Bike} label="Two Wheeler" value={snapshotResult.counts.two_wheeler} colorVar="var(--traffic-purple)" />
            <div className="glass-card rounded-xl p-4 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 flex items-center gap-3 col-span-2 lg:col-span-1">
              <BarChart3 className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-xl font-bold">{snapshotResult.counts.total}</p>
              </div>
            </div>
          </div>

          {/* Video info + inference config */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">Info Capture</p>
              <div className="space-y-2 text-xs">
                <InfoRow label="Resolusi" value={snapshotResult.video_info.resolution} />
                <InfoRow label="FPS" value={snapshotResult.video_info.fps.toString()} />
                <InfoRow label="Total Frames" value={snapshotResult.video_info.total_frames.toLocaleString()} />
                <InfoRow label="Durasi" value={`${snapshotResult.video_info.duration_seconds.toFixed(1)}s`} />
                <InfoRow label="Waktu Proses" value={`${snapshotResult.video_info.processing_time_seconds.toFixed(1)}s`} />
              </div>
            </div>
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">Konfigurasi Inference</p>
              <div className="space-y-2 text-xs">
                <InfoRow label="Model" value={snapshotResult.inference_config.model} />
                <InfoRow label="Device" value={snapshotResult.inference_config.device} />
                <InfoRow label="Image Size" value={`${snapshotResult.inference_config.image_size}px`} />
                <InfoRow label="Line Start" value={`(${snapshotResult.inference_config.line_start.join(", ")})`} />
                <InfoRow label="Line End" value={`(${snapshotResult.inference_config.line_end.join(", ")})`} />
              </div>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={copySnapshot} className="gap-2">
            <Copy className="h-3.5 w-3.5" /> Copy JSON
          </Button>
        </div>
      )}

      {/* ═══ Empty state ═══ */}
      {!streaming && !frameSrc && !snapshotLoading && !snapshotResult && !error && (
        <div className="glass-card rounded-xl p-16 flex flex-col items-center justify-center text-center opacity-0 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
          <div className="rounded-2xl bg-destructive/10 p-4 mb-4">
            <Radio className="h-8 w-8 text-destructive" />
          </div>
          <h3 className="font-semibold mb-1">Belum Ada Stream Aktif</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Masukkan URL RTSP dan klik "Mulai Live Stream" atau "Snapshot" untuk memulai.
          </p>
        </div>
      )}
    </div>
  );
};

/* ─── Sub-components ─── */
const CounterCard = ({ icon: Icon, label, value, colorVar }: { icon: React.ElementType; label: string; value: number; colorVar: string }) => (
  <div className="glass-card rounded-xl p-3 flex items-center gap-3">
    <div className="rounded-lg p-2" style={{ background: `hsl(${colorVar} / 0.15)` }}>
      <Icon className="h-4 w-4" style={{ color: `hsl(${colorVar})` }} />
    </div>
    <div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-lg font-bold tabular-nums">{value}</p>
    </div>
  </div>
);

const SummaryCard = ({ icon: Icon, label, value, colorVar }: { icon: React.ElementType; label: string; value: number; colorVar: string }) => (
  <div className="glass-card rounded-xl p-4 flex items-center gap-3">
    <div className="rounded-xl p-2.5" style={{ background: `hsl(${colorVar} / 0.15)` }}>
      <Icon className="h-5 w-5" style={{ color: `hsl(${colorVar})` }} />
    </div>
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  </div>
);

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium font-mono">{value}</span>
  </div>
);

export default LiveMonitoring;
