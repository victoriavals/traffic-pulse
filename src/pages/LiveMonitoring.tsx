import { useState, useRef, useCallback, useEffect } from "react";
import {
  Radio, Play, Square, Camera, SlidersHorizontal, Info,
  Truck, Car, PersonStanding, Bike, BarChart3, Loader2,
  AlertCircle, ChevronDown, ChevronUp, Copy, Wifi, WifiOff,
  Eye, EyeOff
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

interface WSMessage {
  type: "frame" | "info" | "error";
  frame?: string;
  fps?: number;
  frame_number?: number;
  counts?: Counts;
  message?: string;
}

interface SnapshotResponse {
  success: boolean;
  message: string;
  counts: Counts;
  stream_info: {
    resolution: string;
    fps: number;
    frames_processed: number;
    processing_time_seconds: number;
  };
  inference_config: Record<string, unknown>;
}

type ModelSize = "SMALL" | "MEDIUM";
type StreamMode = "snapshot" | "live";
type StreamStatus = "idle" | "connecting" | "streaming" | "reconnecting" | "stopped" | "error";

const EMPTY_COUNTS: Counts = { big_vehicle: 0, car: 0, pedestrian: 0, two_wheeler: 0, total: 0 };

/* ─── Helpers ─── */
const clampLine = (v: string): number => {
  const n = parseFloat(v);
  if (isNaN(n)) return 0;
  return Math.min(1, Math.max(0, parseFloat(n.toFixed(2))));
};

const statusConfig: Record<StreamStatus, { label: string; color: string; dot: string }> = {
  idle: { label: "Belum terhubung", color: "text-muted-foreground", dot: "bg-muted-foreground" },
  connecting: { label: "Menghubungkan...", color: "text-yellow-400", dot: "bg-yellow-400 animate-pulse" },
  streaming: { label: "Streaming", color: "text-traffic-green", dot: "bg-traffic-green animate-pulse" },
  reconnecting: { label: "Reconnecting...", color: "text-yellow-400", dot: "bg-yellow-400 animate-pulse" },
  stopped: { label: "Dihentikan", color: "text-muted-foreground", dot: "bg-muted-foreground" },
  error: { label: "Error", color: "text-destructive", dot: "bg-destructive" },
};


/* ─── Page ─── */
const LiveMonitoring = () => {
  const { baseUrl } = useApiSettings();

  // Mode
  const [mode, setMode] = useState<StreamMode>("live");

  // Config
  const [rtspUrl, setRtspUrl] = useState("");
  const [confidence, setConfidence] = useState(0.45);
  const [iou, setIou] = useState(0.5);
  const [modelSize, setModelSize] = useState<ModelSize>("SMALL");
  const [frameCount, setFrameCount] = useState(150);
  const [showVideo, setShowVideo] = useState(true);

  // Counting line
  const [lineStartX, setLineStartX] = useState(0.0);
  const [lineStartY, setLineStartY] = useState(0.15);
  const [lineEndX, setLineEndX] = useState(1.0);
  const [lineEndY, setLineEndY] = useState(0.65);
  const [lineOpen, setLineOpen] = useState(false);

  // Live stream state
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("idle");
  const [frameSrc, setFrameSrc] = useState<string | null>(null);
  const [liveFps, setLiveFps] = useState(0);
  const [frameNumber, setFrameNumber] = useState(0);
  const [liveCounts, setLiveCounts] = useState<Counts>(EMPTY_COUNTS);
  const [streamInfo, setStreamInfo] = useState<string>("");
  const wsRef = useRef<WebSocket | null>(null);

  // Snapshot state
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotResult, setSnapshotResult] = useState<SnapshotResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* ─── Cleanup on unmount ─── */
  useEffect(() => {
    return () => { wsRef.current?.close(); };
  }, []);

  /* ─── Reset when switching modes ─── */
  const switchMode = (m: StreamMode) => {
    if (streamStatus === "streaming") {
      stopStream();
    }
    setMode(m);
    setError(null);
    setSnapshotResult(null);
    setFrameSrc(null);
    setStreamStatus("idle");
    setLiveCounts(EMPTY_COUNTS);
  };

  /* ─── WebSocket Live Stream ─── */
  const startStream = useCallback(() => {
    if (!rtspUrl.trim()) {
      setError("Masukkan URL RTSP terlebih dahulu");
      return;
    }
    setError(null);
    setSnapshotResult(null);
    setStreamStatus("connecting");
    setLiveCounts(EMPTY_COUNTS);
    setFrameNumber(0);
    setLiveFps(0);

    const wsUrl = baseUrl.replace(/^http/, "ws") + "/rtsp/stream";
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
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
        send_frame: showVideo,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data: WSMessage = JSON.parse(event.data);
        if (data.type === "info") {
          const msg = data.message ?? "";
          // Reconnect progress messages from backend
          if (msg.toLowerCase().startsWith("reconnect")) {
            setStreamStatus("reconnecting");
          } else {
            setStreamStatus((prev) => prev === "connecting" || prev === "reconnecting" ? "streaming" : prev);
          }
          setStreamInfo(msg);
          setError(null); // clear previous error on successful info
        } else if (data.type === "frame") {
          if (data.frame) {
            setFrameSrc(`data:image/jpeg;base64,${data.frame}`);
          } else if (!showVideo) {
            setFrameSrc(null); // Clear old frame if toggled off
          }
          setLiveFps(data.fps ?? 0);
          setFrameNumber(data.frame_number ?? 0);
          setLiveCounts(data.counts ?? EMPTY_COUNTS);
          setStreamStatus("streaming");
          setError(null);
        } else if (data.type === "error") {
          // Don't clear frameSrc — keep last frame visible
          setError(data.message ?? "Stream error");
          setStreamStatus("error");
        }
      } catch {
        // ignore non-JSON
      }
    };

    ws.onerror = () => {
      setError("Gagal terhubung ke WebSocket — pastikan server berjalan");
      setStreamStatus("error");
    };

    ws.onclose = () => {
      setStreamStatus((prev) =>
        prev === "streaming" || prev === "reconnecting" ? "stopped" : prev
      );
    };
  }, [rtspUrl, baseUrl, confidence, iou, modelSize, lineStartX, lineStartY, lineEndX, lineEndY, showVideo]);

  const stopStream = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.send(JSON.stringify({ action: "stop" })); } catch { /* ignore */ }
      wsRef.current.close();
      wsRef.current = null;
    }
    setStreamStatus("stopped");

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

  /* ─── Snapshot ─── */
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
          line_config: { start_x: lineStartX, start_y: lineStartY, end_x: lineEndX, end_y: lineEndY },
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan";
      setError(msg);
    } finally {
      setSnapshotLoading(false);
    }
  }, [rtspUrl, baseUrl, confidence, iou, modelSize, frameCount, lineStartX, lineStartY, lineEndX, lineEndY]);

  const copySnapshot = useCallback(() => {
    if (!snapshotResult) return;
    navigator.clipboard.writeText(JSON.stringify(snapshotResult, null, 2));
    toast({ title: "Disalin!", description: "JSON response berhasil disalin ke clipboard." });
  }, [snapshotResult]);

  const isStreaming = streamStatus === "streaming";
  const isConnecting = streamStatus === "connecting";
  const isReconnecting = streamStatus === "reconnecting";
  const isBusy = isStreaming || isConnecting || isReconnecting || snapshotLoading;
  const displayCounts = isStreaming ? liveCounts : (snapshotResult?.counts ?? EMPTY_COUNTS);

  return (
    <div className="space-y-5">
      {/* ─── Header ─── */}
      <div className="opacity-0 animate-fade-in-up flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Live Monitoring</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Pantau lalu lintas secara real-time melalui stream RTSP
          </p>
        </div>
        {/* Status dot */}
        <div className="flex items-center gap-2 mt-1">
          <span className={`h-2.5 w-2.5 rounded-full ${statusConfig[streamStatus].dot}`} />
          <span className={`text-xs font-medium ${statusConfig[streamStatus].color}`}>
            {statusConfig[streamStatus].label}
          </span>
        </div>
      </div>

      {/* ─── Mode Selector ─── */}
      <div className="opacity-0 animate-fade-in-up glass-card rounded-xl p-1.5 flex gap-1" style={{ animationDelay: "50ms" }}>
        {(["live", "snapshot"] as StreamMode[]).map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            disabled={isConnecting || snapshotLoading}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200
              ${mode === m
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"}
              disabled:opacity-50`}
          >
            {m === "live" ? <Radio className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
            {m === "live" ? "Live Stream" : "Snapshot"}
          </button>
        ))}
      </div>

      {/* ─── Config Card ─── */}
      <div className="glass-card rounded-xl p-5 space-y-5 opacity-0 animate-fade-in-up" style={{ animationDelay: "100ms" }}>

        {/* RTSP URL */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            {isStreaming ? <Wifi className="h-3 w-3 text-traffic-green" /> : <WifiOff className="h-3 w-3" />}
            RTSP URL
          </label>
          <Input
            value={rtspUrl}
            onChange={(e) => setRtspUrl(e.target.value)}
            placeholder="rtsp://admin:password@192.168.1.72:554/H.264"
            className="font-mono text-sm"
            disabled={isBusy}
          />
          {streamInfo && isStreaming && (
            <p className="text-xs text-traffic-green font-mono">{streamInfo}</p>
          )}
        </div>

        {/* Sliders + Model */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Confidence</span>
              <span className="font-mono font-semibold">{confidence.toFixed(2)}</span>
            </div>
            <Slider value={[confidence]} onValueChange={([v]) => setConfidence(v)} min={0} max={1} step={0.05} disabled={isBusy} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">IoU</span>
              <span className="font-mono font-semibold">{iou.toFixed(2)}</span>
            </div>
            <Slider value={[iou]} onValueChange={([v]) => setIou(v)} min={0} max={1} step={0.05} disabled={isBusy} />
          </div>
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground">Model Size</span>
            <div className="flex gap-2">
              {(["SMALL", "MEDIUM"] as ModelSize[]).map((s) => (
                <button
                  key={s}
                  onClick={() => !isBusy && setModelSize(s)}
                  disabled={isBusy}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all
                    ${modelSize === s
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"}
                    disabled:opacity-50`}
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {modelSize === "SMALL" ? "19 MB · Lebih cepat" : "40 MB · Lebih akurat"}
            </p>
          </div>
        </div>

        {/* Snapshot-only: frame count */}
        {mode === "snapshot" && (
          <div className="border-t border-border/40 pt-4">
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              Jumlah Frame untuk di-capture
            </label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={1}
                max={1000}
                value={frameCount}
                onChange={(e) => setFrameCount(parseInt(e.target.value) || 150)}
                className="h-8 text-xs font-mono w-28"
                disabled={snapshotLoading}
              />
              <span className="text-xs text-muted-foreground">
                ≈ {(frameCount / 30).toFixed(0)}–{(frameCount / 25).toFixed(0)} detik pada 25–30 FPS
              </span>
            </div>
          </div>
        )}

        {/* Headless Mode (Video Toggle) */}
        {mode === "live" && (
          <div className="border-t border-border/40 pt-4 flex items-center justify-between">
            <div>
              <label className="text-xs font-medium text-muted-foreground block">Tampilkan Video Stream</label>
              <p className="text-[10px] text-muted-foreground mt-0.5">Matikan untuk menghemat bandwidth & performa</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowVideo(!showVideo)}
              disabled={isBusy}
              className={`h-8 w-14 px-0 ${showVideo ? "bg-primary/10 text-primary border-primary/30" : "text-muted-foreground"}`}
            >
              {showVideo ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
          </div>
        )}

        {/* Counting Line (collapsible) */}
        <div className="border-t border-border/40 pt-4">
          <button
            onClick={() => setLineOpen(!lineOpen)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Posisi Counting Line</span>
            <div className="group relative ml-1">
              <Info className="h-3 w-3 cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-popover text-popover-foreground text-[10px] rounded-md shadow-lg border opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                Kendaraan dihitung saat melewati garis ini (persentase 0.0–1.0)
              </div>
            </div>
            <span className="ml-auto text-muted-foreground/60">
              ({lineStartX},{lineStartY}) → ({lineEndX},{lineEndY})
            </span>
            {lineOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {lineOpen && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {[
                { label: "Start X", val: lineStartX, set: setLineStartX },
                { label: "Start Y", val: lineStartY, set: setLineStartY },
                { label: "End X", val: lineEndX, set: setLineEndX },
                { label: "End Y", val: lineEndY, set: setLineEndY },
              ].map(({ label, val, set }) => (
                <div key={label}>
                  <label className="text-[10px] text-muted-foreground">{label}</label>
                  <Input
                    type="number"
                    step={0.05}
                    min={0}
                    max={1}
                    value={val}
                    onChange={(e) => set(clampLine(e.target.value))}
                    className="h-8 text-xs font-mono"
                    disabled={isBusy}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── Action Buttons ─── */}
        <div className="border-t border-border/40 pt-4">
          {mode === "live" ? (
            <div className="flex gap-3">
              {!isStreaming && !isConnecting ? (
                <Button
                  onClick={startStream}
                  disabled={!rtspUrl.trim() || snapshotLoading}
                  className="gap-2 bg-traffic-green text-black hover:bg-traffic-green/90"
                >
                  <Play className="h-4 w-4" />
                  Mulai Live Stream
                </Button>
              ) : (
                <Button
                  onClick={stopStream}
                  variant="destructive"
                  className="gap-2"
                  disabled={isConnecting}
                >
                  <Square className="h-4 w-4" />
                  {isConnecting ? "Menghubungkan..." : "Stop Stream"}
                </Button>
              )}
              {isConnecting && <Loader2 className="h-5 w-5 animate-spin text-yellow-400 self-center" />}
            </div>
          ) : (
            <Button
              onClick={callSnapshot}
              disabled={!rtspUrl.trim() || snapshotLoading || isStreaming}
              className="gap-2"
            >
              {snapshotLoading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Sedang Capture...</>
                : <><Camera className="h-4 w-4" /> Ambil Snapshot</>
              }
            </Button>
          )}
        </div>
      </div>

      {/* ─── Error Banner ─── */}
      {error && (
        <div className="glass-card rounded-xl p-4 border border-destructive/40 bg-destructive/10 flex items-start gap-3 opacity-0 animate-fade-in-up">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">Koneksi Gagal</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* ─── Snapshot Loading ─── */}
      {snapshotLoading && (
        <div className="glass-card rounded-xl p-12 flex flex-col items-center justify-center gap-3 opacity-0 animate-fade-in-up">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
          <p className="text-sm font-medium">Mengambil snapshot dari stream...</p>
          <p className="text-xs text-muted-foreground">Capturing {frameCount} frame, mohon tunggu</p>
        </div>
      )}

      {/* ─── Live Stream View ─── */}
      {mode === "live" && (isStreaming || isConnecting || isReconnecting || (frameSrc && streamStatus !== "idle")) && !snapshotLoading && (
        <div className="grid gap-4 lg:grid-cols-[1fr_260px] opacity-0 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
          {/* Video Feed */}
          <div className="glass-card rounded-xl overflow-hidden relative bg-black/60 min-h-[200px]">
            {frameSrc ? (
              <>
                <img
                  src={frameSrc}
                  alt="Live feed"
                  className={`w-full object-contain transition-opacity duration-300 ${isReconnecting ? "opacity-50" : "opacity-100"
                    }`}
                />
                {/* Reconnecting overlay */}
                {isReconnecting && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
                    <Loader2 className="h-10 w-10 text-yellow-400 animate-spin mb-2" />
                    <p className="text-sm text-yellow-400 font-medium">{streamInfo || "Reconnecting..."}</p>
                  </div>
                )}
                {/* FPS overlay */}
                <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm rounded-lg px-2.5 py-1 text-xs font-mono text-white">
                  {liveFps.toFixed(1)} FPS
                </div>
                <div className={`absolute top-3 right-3 flex items-center gap-1.5 backdrop-blur-sm rounded-lg px-2.5 py-1 text-xs font-bold text-white ${isReconnecting ? "bg-yellow-500/90" : "bg-red-600/90"
                  }`}>
                  <span className={`h-2 w-2 rounded-full bg-white ${isReconnecting ? "" : "animate-pulse"}`} />
                  {isReconnecting ? "RECONNECTING" : "LIVE"}
                </div>
                <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm rounded-lg px-2.5 py-1 text-xs font-mono text-white">
                  Frame #{frameNumber}
                </div>
              </>
            ) : !showVideo && isStreaming ? (
              <div className="flex flex-col items-center justify-center py-24 text-muted-foreground relative">
                <EyeOff className="h-10 w-10 mb-3 opacity-50" />
                <p className="text-sm font-medium">Video Dinonaktifkan</p>
                <p className="text-xs mt-1 text-muted-foreground/80">Penghitungan berjalan di latar belakang (Mode Performa)</p>

                {/* Overlays that still show without video */}
                <div className="absolute top-3 left-3 bg-black/40 backdrop-blur-sm rounded-lg px-2.5 py-1 text-xs font-mono text-white/80">
                  {liveFps.toFixed(1)} FPS
                </div>
                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-red-600/90 backdrop-blur-sm rounded-lg px-2.5 py-1 text-xs font-bold text-white">
                  <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                  LIVE
                </div>
                <div className="absolute bottom-3 left-3 bg-black/40 backdrop-blur-sm rounded-lg px-2.5 py-1 text-xs font-mono text-white/80">
                  Frame #{frameNumber}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
                <Loader2 className="h-8 w-8 mb-3 animate-spin opacity-60" />
                <p className="text-sm">Menghubungkan ke stream...</p>
                <p className="text-xs mt-1 font-mono text-muted-foreground/60">{rtspUrl}</p>
              </div>
            )}
          </div>

          {/* Live Counters */}
          <div className="flex flex-col gap-3">
            <CounterCard icon={Truck} label="Big Vehicle" value={displayCounts.big_vehicle} colorVar="--traffic-blue" />
            <CounterCard icon={Car} label="Car" value={displayCounts.car} colorVar="--traffic-green" />
            <CounterCard icon={PersonStanding} label="Pedestrian" value={displayCounts.pedestrian} colorVar="--traffic-amber" />
            <CounterCard icon={Bike} label="Two Wheeler" value={displayCounts.two_wheeler} colorVar="--traffic-purple" />
            {/* Total */}
            <div className="glass-card rounded-xl p-4 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 mt-auto">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/15 p-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Kendaraan</p>
                  <p className="text-3xl font-bold tabular-nums">{displayCounts.total}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Snapshot Results ─── */}
      {mode === "snapshot" && !snapshotLoading && snapshotResult && (
        <div className="space-y-4 opacity-0 animate-fade-in-up">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <SummaryCard icon={Truck} label="Big Vehicle" value={snapshotResult.counts.big_vehicle} colorVar="--traffic-blue" />
            <SummaryCard icon={Car} label="Car" value={snapshotResult.counts.car} colorVar="--traffic-green" />
            <SummaryCard icon={PersonStanding} label="Pedestrian" value={snapshotResult.counts.pedestrian} colorVar="--traffic-amber" />
            <SummaryCard icon={Bike} label="Two Wheeler" value={snapshotResult.counts.two_wheeler} colorVar="--traffic-purple" />
            <div className="glass-card rounded-xl p-4 flex items-center gap-3 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 col-span-2 lg:col-span-1">
              <div className="rounded-lg bg-primary/15 p-2">
                <BarChart3 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-xl font-bold">{snapshotResult.counts.total}</p>
              </div>
            </div>
          </div>

          {/* Stream + inference info */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Info Capture</p>
              <div className="space-y-2 text-xs">
                <InfoRow label="Resolusi" value={snapshotResult.stream_info.resolution} />
                <InfoRow label="FPS" value={String(snapshotResult.stream_info.fps)} />
                <InfoRow label="Frames Diproses" value={String(snapshotResult.stream_info.frames_processed)} />
                <InfoRow label="Waktu Proses" value={`${snapshotResult.stream_info.processing_time_seconds.toFixed(1)}s`} />
              </div>
            </div>
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Konfigurasi Inference</p>
              <div className="space-y-2 text-xs">
                {Object.entries(snapshotResult.inference_config).map(([k, v]) => (
                  <InfoRow key={k} label={k} value={String(typeof v === "object" ? JSON.stringify(v) : v)} />
                ))}
              </div>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={copySnapshot} className="gap-2">
            <Copy className="h-3.5 w-3.5" /> Copy JSON
          </Button>
        </div>
      )}

      {/* ─── Empty State ─── */}
      {!isBusy && !frameSrc && !snapshotResult && !error && (
        <div
          className="glass-card rounded-xl p-16 flex flex-col items-center justify-center text-center opacity-0 animate-fade-in-up"
          style={{ animationDelay: "200ms" }}
        >
          <div className={`rounded-2xl p-4 mb-4 ${mode === "live" ? "bg-traffic-green/10" : "bg-primary/10"}`}>
            {mode === "live"
              ? <Radio className="h-8 w-8 text-traffic-green" />
              : <Camera className="h-8 w-8 text-primary" />
            }
          </div>
          <h3 className="font-semibold mb-2">
            {mode === "live" ? "Belum Ada Stream Aktif" : "Belum Ada Snapshot"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            {mode === "live"
              ? "Masukkan URL RTSP di atas dan klik \"Mulai Live Stream\". Stream akan berjalan terus hingga Anda klik \"Stop Stream\"."
              : `Masukkan URL RTSP dan klik "Ambil Snapshot". API akan capture ${frameCount} frame lalu return hasil counting.`
            }
          </p>
        </div>
      )}
    </div>
  );
};

/* ─── Sub-components ─── */

interface CardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  colorVar: string;
}

const CounterCard = ({ icon: Icon, label, value, colorVar }: CardProps) => (
  <div className="glass-card rounded-xl p-3 flex items-center gap-3">
    <div className="rounded-lg p-2 shrink-0" style={{ background: `hsl(var(${colorVar}) / 0.15)` }}>
      <Icon className="h-4 w-4" style={{ color: `hsl(var(${colorVar}))` }} />
    </div>
    <div className="min-w-0">
      <p className="text-[10px] text-muted-foreground truncate">{label}</p>
      <p className="text-2xl font-bold tabular-nums leading-tight">{value}</p>
    </div>
  </div>
);

const SummaryCard = ({ icon: Icon, label, value, colorVar }: CardProps) => (
  <div className="glass-card rounded-xl p-4 flex items-center gap-3">
    <div className="rounded-xl p-2.5 shrink-0" style={{ background: `hsl(var(${colorVar}) / 0.15)` }}>
      <Icon className="h-5 w-5" style={{ color: `hsl(var(${colorVar}))` }} />
    </div>
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </div>
  </div>
);

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between items-start gap-2">
    <span className="text-muted-foreground shrink-0">{label}</span>
    <span className="font-medium font-mono text-right break-all">{value}</span>
  </div>
);

export default LiveMonitoring;
