import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from "react";
import {
  Upload, Film, X, SlidersHorizontal, BarChart3, Truck, Car,
  PersonStanding, Bike, Loader2, Download, AlertCircle, Info,
  Copy, Play, Cpu, Monitor, Maximize, Clock, Layers, Timer
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { useApiSettings } from "@/contexts/ApiContext";
import { addActivityLog } from "@/lib/activity-log";
import { toast } from "@/hooks/use-toast";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell
} from "recharts";

/* ─── Types ─── */
interface VideoDetectResponse {
  success: boolean;
  message: string;
  counts: { big_vehicle: number; car: number; pedestrian: number; two_wheeler: number; total: number };
  video_info: { resolution: string; fps: number; total_frames: number; duration_seconds: number; processing_time_seconds: number };
  inference_config: { model: string; device: string; image_size: number; line_start: number[]; line_end: number[] };
}

type ModelSize = "SMALL" | "MEDIUM";
type ResultMode = "json" | "video" | null;

const CLASS_COLORS = [
  "hsl(var(--traffic-blue))",
  "hsl(var(--traffic-green))",
  "hsl(var(--traffic-amber))",
  "hsl(var(--traffic-purple))",
];

const VIDEO_TYPES = ["video/mp4", "video/x-msvideo", "video/quicktime", "video/x-matroska"];

/* ─── Page ─── */
const ProsesVideo = () => {
  const { baseUrl } = useApiSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Config
  const [confidence, setConfidence] = useState(0.45);
  const [iou, setIou] = useState(0.5);
  const [modelSize, setModelSize] = useState<ModelSize>("SMALL");

  // Counting line
  const [lineStartX, setLineStartX] = useState(0.0);
  const [lineStartY, setLineStartY] = useState(0.15);
  const [lineEndX, setLineEndX] = useState(1.0);
  const [lineEndY, setLineEndY] = useState(0.65);

  // Results
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMode, setResultMode] = useState<ResultMode>(null);
  const [jsonResult, setJsonResult] = useState<VideoDetectResponse | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [headerInfo, setHeaderInfo] = useState<{ totalCount: string; framesProcessed: string; processingTime: string } | null>(null);

  /* ─── File handling ─── */
  const handleFile = useCallback((f: File) => {
    if (!VIDEO_TYPES.includes(f.type) && !f.name.match(/\.(mp4|avi|mov|mkv)$/i)) return;
    setFile(f);
    setError(null);
    setResultMode(null);
    setJsonResult(null);
    setVideoUrl(null);
    setHeaderInfo(null);
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const resetFile = useCallback(() => {
    setFile(null);
    setJsonResult(null);
    setVideoUrl(null);
    setResultMode(null);
    setError(null);
    setHeaderInfo(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  /* ─── API calls ─── */
  const callApi = useCallback(async (endpoint: "detect" | "annotate") => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResultMode(endpoint === "detect" ? "json" : "video");

    const formData = new FormData();
    formData.append("file", file);

    const params = new URLSearchParams({
      confidence: confidence.toString(),
      iou: iou.toString(),
      model_size: modelSize,
      line_start_x: lineStartX.toString(),
      line_start_y: lineStartY.toString(),
      line_end_x: lineEndX.toString(),
      line_end_y: lineEndY.toString(),
    });

    try {
      const res = await fetch(`${baseUrl}/video/${endpoint}?${params}`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `HTTP ${res.status}`);
      }

      if (endpoint === "detect") {
        const data: VideoDetectResponse = await res.json();
        setJsonResult(data);
        addActivityLog({ type: "Video", source: file.name, totalDeteksi: data.counts.total });
        localStorage.setItem("last-detection-counts", JSON.stringify({
          bigVehicle: data.counts.big_vehicle,
          car: data.counts.car,
          pedestrian: data.counts.pedestrian,
          twoWheeler: data.counts.two_wheeler,
        }));
      } else {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        setHeaderInfo({
          totalCount: res.headers.get("X-Total-Count") || "-",
          framesProcessed: res.headers.get("X-Frames-Processed") || "-",
          processingTime: res.headers.get("X-Processing-Time") || "-",
        });
        addActivityLog({ type: "Video", source: file.name, totalDeteksi: parseInt(res.headers.get("X-Total-Count") || "0") });
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan");
      setResultMode(null);
    } finally {
      setLoading(false);
    }
  }, [file, baseUrl, confidence, iou, modelSize, lineStartX, lineStartY, lineEndX, lineEndY]);

  const copyJson = useCallback(() => {
    if (jsonResult) {
      navigator.clipboard.writeText(JSON.stringify(jsonResult, null, 2));
      toast({ title: "Disalin!", description: "JSON response berhasil disalin ke clipboard." });
    }
  }, [jsonResult]);

  const downloadVideo = useCallback(() => {
    if (videoUrl) {
      const a = document.createElement("a");
      a.href = videoUrl;
      a.download = `annotated_${file?.name || "video"}.mp4`;
      a.click();
    }
  }, [videoUrl, file]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const clampLine = (v: string) => {
    const n = parseFloat(v);
    if (isNaN(n)) return 0;
    return Math.min(1, Math.max(0, parseFloat(n.toFixed(2))));
  };

  /* ─── Chart data ─── */
  const chartData = jsonResult ? [
    { name: "Big Vehicle", value: jsonResult.counts.big_vehicle },
    { name: "Car", value: jsonResult.counts.car },
    { name: "Pedestrian", value: jsonResult.counts.pedestrian },
    { name: "Two Wheeler", value: jsonResult.counts.two_wheeler },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="opacity-0 animate-fade-in-up">
        <h1 className="text-2xl font-bold">Proses Video</h1>
        <p className="text-muted-foreground text-sm mt-1">Upload video untuk mendeteksi dan menghitung kendaraan</p>
      </div>

      {/* ═══ Upload Zone ═══ */}
      <div className="opacity-0 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
        <input ref={fileInputRef} type="file" accept=".mp4,.avi,.mov,.mkv,video/*" className="hidden" onChange={handleInputChange} />

        {!file ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            className={`glass-card rounded-xl w-full p-12 flex flex-col items-center justify-center text-center border-2 border-dashed transition-all duration-300 cursor-pointer ${isDragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-border/60 hover:border-primary/40"}`}
          >
            <div className="rounded-2xl bg-secondary/10 p-4 mb-4">
              <Upload className="h-8 w-8 text-secondary" />
            </div>
            <h3 className="font-semibold mb-1">Seret video ke sini atau klik untuk memilih</h3>
            <p className="text-xs text-muted-foreground">Format: MP4, AVI, MOV, MKV</p>
          </button>
        ) : (
          <div className="glass-card rounded-xl p-4 flex items-center gap-4">
            <div className="rounded-xl bg-secondary/10 p-3">
              <Film className="h-6 w-6 text-secondary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
            </div>
            <button onClick={resetFile} className="rounded-lg bg-background/80 p-1.5 text-muted-foreground hover:text-destructive transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {file && (
          <div className="flex items-start gap-2 mt-3 text-xs text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
            <span>Proses video bisa memakan waktu beberapa menit tergantung durasi dan resolusi</span>
          </div>
        )}
      </div>

      {/* ═══ Configuration ═══ */}
      <div className="glass-card rounded-xl p-5 opacity-0 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
        <div className="flex items-center gap-2 mb-4">
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">Konfigurasi</span>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Column A: Detection */}
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Confidence Threshold</span>
                <span className="font-mono font-medium">{confidence.toFixed(2)}</span>
              </div>
              <Slider value={[confidence]} onValueChange={([v]) => setConfidence(v)} min={0} max={1} step={0.05} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">IoU Threshold</span>
                <span className="font-mono font-medium">{iou.toFixed(2)}</span>
              </div>
              <Slider value={[iou]} onValueChange={([v]) => setIou(v)} min={0} max={1} step={0.05} />
            </div>
            <div className="space-y-2">
              <span className="text-xs text-muted-foreground">Model Size</span>
              <div className="flex gap-2">
                {(["SMALL", "MEDIUM"] as ModelSize[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setModelSize(s)}
                    className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all ${modelSize === s ? "bg-primary text-primary-foreground shadow-md" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
                  >
                    {s === "SMALL" ? "SMALL (Cepat)" : "MEDIUM (Akurat)"}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">SMALL: YOLOv11s, 19 MB — MEDIUM: YOLOv11m, 40 MB</p>
            </div>
          </div>

          {/* Column B: Counting Line */}
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
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground">Start X</label>
                <Input type="number" step={0.05} min={0} max={1} value={lineStartX} onChange={(e) => setLineStartX(clampLine(e.target.value))} className="h-8 text-xs font-mono" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Start Y</label>
                <Input type="number" step={0.05} min={0} max={1} value={lineStartY} onChange={(e) => setLineStartY(clampLine(e.target.value))} className="h-8 text-xs font-mono" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">End X</label>
                <Input type="number" step={0.05} min={0} max={1} value={lineEndX} onChange={(e) => setLineEndX(clampLine(e.target.value))} className="h-8 text-xs font-mono" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">End Y</label>
                <Input type="number" step={0.05} min={0} max={1} value={lineEndY} onChange={(e) => setLineEndY(clampLine(e.target.value))} className="h-8 text-xs font-mono" />
              </div>
            </div>

            {/* SVG Visualization */}
            <div className="rounded-lg bg-muted/30 border border-border/40 overflow-hidden">
              <svg viewBox="0 0 160 90" className="w-full" style={{ aspectRatio: "16/9" }}>
                <rect width="160" height="90" fill="none" />
                {/* Grid lines */}
                <line x1="40" y1="0" x2="40" y2="90" stroke="currentColor" strokeOpacity={0.08} />
                <line x1="80" y1="0" x2="80" y2="90" stroke="currentColor" strokeOpacity={0.08} />
                <line x1="120" y1="0" x2="120" y2="90" stroke="currentColor" strokeOpacity={0.08} />
                <line x1="0" y1="30" x2="160" y2="30" stroke="currentColor" strokeOpacity={0.08} />
                <line x1="0" y1="60" x2="160" y2="60" stroke="currentColor" strokeOpacity={0.08} />
                {/* Counting line */}
                <line
                  x1={lineStartX * 160} y1={lineStartY * 90}
                  x2={lineEndX * 160} y2={lineEndY * 90}
                  stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round"
                />
                <circle cx={lineStartX * 160} cy={lineStartY * 90} r="3" fill="hsl(var(--traffic-green))" />
                <circle cx={lineEndX * 160} cy={lineEndY * 90} r="3" fill="hsl(var(--destructive))" />
                <text x={lineStartX * 160 + 5} y={lineStartY * 90 - 4} fill="hsl(var(--traffic-green))" fontSize="6" fontFamily="monospace">S</text>
                <text x={lineEndX * 160 + 5} y={lineEndY * 90 - 4} fill="hsl(var(--destructive))" fontSize="6" fontFamily="monospace">E</text>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Action Buttons ═══ */}
      <div className="flex gap-3 opacity-0 animate-fade-in-up" style={{ animationDelay: "300ms" }}>
        <Button onClick={() => callApi("detect")} disabled={!file || loading} className="flex-1 gap-2" size="lg">
          {loading && resultMode === "json" ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
          Hitung Kendaraan
        </Button>
        <Button onClick={() => callApi("annotate")} disabled={!file || loading} variant="outline" className="flex-1 gap-2" size="lg">
          {loading && resultMode === "video" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Generate Video Anotasi
        </Button>
      </div>

      {/* ═══ Error ═══ */}
      {error && (
        <div className="glass-card rounded-xl p-4 border-destructive/50 bg-destructive/10 flex items-start gap-3 opacity-0 animate-fade-in-up">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">Gagal menghubungi API</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* ═══ Loading ═══ */}
      {loading && (
        <div className="glass-card rounded-xl p-12 flex flex-col items-center justify-center gap-3 opacity-0 animate-fade-in-up">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
          <p className="text-sm font-medium">Memproses video... mohon tunggu</p>
          <p className="text-xs text-muted-foreground">Biasanya 1-3 menit untuk video berdurasi 1-2 menit</p>
        </div>
      )}

      {/* ═══ JSON Results ═══ */}
      {!loading && resultMode === "json" && jsonResult && (
        <div className="space-y-5 opacity-0 animate-fade-in-up">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard icon={Truck} label="Big Vehicle" value={jsonResult.counts.big_vehicle} colorVar="var(--traffic-blue)" />
            <SummaryCard icon={Car} label="Car" value={jsonResult.counts.car} colorVar="var(--traffic-green)" />
            <SummaryCard icon={PersonStanding} label="Pedestrian" value={jsonResult.counts.pedestrian} colorVar="var(--traffic-amber)" />
            <SummaryCard icon={Bike} label="Two Wheeler" value={jsonResult.counts.two_wheeler} colorVar="var(--traffic-purple)" />
          </div>
          <div className="glass-card rounded-xl p-4 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Total Kendaraan</p>
              <p className="text-2xl font-bold">{jsonResult.counts.total}</p>
            </div>
          </div>

          {/* Bar chart */}
          <div className="glass-card rounded-xl p-5">
            <p className="text-sm font-medium mb-4">Distribusi Kendaraan</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barSize={40}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <RechartsTooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={CLASS_COLORS[i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Video info + Inference config */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">Info Video</p>
              <div className="space-y-2 text-xs">
                <InfoRow icon={Maximize} label="Resolusi" value={jsonResult.video_info.resolution} />
                <InfoRow icon={Layers} label="FPS" value={jsonResult.video_info.fps.toString()} />
                <InfoRow icon={Film} label="Total Frames" value={jsonResult.video_info.total_frames.toLocaleString()} />
                <InfoRow icon={Clock} label="Durasi" value={`${jsonResult.video_info.duration_seconds.toFixed(1)}s`} />
                <InfoRow icon={Timer} label="Waktu Proses" value={`${jsonResult.video_info.processing_time_seconds.toFixed(1)}s`} />
              </div>
            </div>
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs font-medium text-muted-foreground mb-3">Konfigurasi Inference</p>
              <div className="space-y-2 text-xs">
                <InfoRow icon={Cpu} label="Model" value={jsonResult.inference_config?.model ?? "N/A"} />
                <InfoRow icon={Monitor} label="Device" value={jsonResult.inference_config?.device ?? "N/A"} />
                <InfoRow icon={Maximize} label="Image Size" value={jsonResult.inference_config?.image_size ? `${jsonResult.inference_config.image_size}px` : "N/A"} />
                <InfoRow icon={BarChart3} label="Line Start" value={Array.isArray(jsonResult.inference_config?.line_start) ? `(${jsonResult.inference_config.line_start.join(", ")})` : "N/A"} />
                <InfoRow icon={BarChart3} label="Line End" value={Array.isArray(jsonResult.inference_config?.line_end) ? `(${jsonResult.inference_config.line_end.join(", ")})` : "N/A"} />
              </div>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={copyJson} className="gap-2">
            <Copy className="h-3.5 w-3.5" /> Copy JSON
          </Button>
        </div>
      )}

      {/* ═══ Video Results ═══ */}
      {!loading && resultMode === "video" && videoUrl && (
        <div className="space-y-4 opacity-0 animate-fade-in-up">
          <div className="glass-card rounded-xl overflow-hidden">
            <video src={videoUrl} controls className="w-full" />
          </div>

          {headerInfo && (
            <div className="grid grid-cols-3 gap-3">
              <div className="glass-card rounded-xl p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Total Kendaraan</p>
                <p className="text-lg font-bold">{headerInfo.totalCount}</p>
              </div>
              <div className="glass-card rounded-xl p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Frame Diproses</p>
                <p className="text-lg font-bold">{headerInfo.framesProcessed}</p>
              </div>
              <div className="glass-card rounded-xl p-3 text-center">
                <p className="text-[10px] text-muted-foreground">Waktu Proses</p>
                <p className="text-lg font-bold">{headerInfo.processingTime}</p>
              </div>
            </div>
          )}

          <Button variant="outline" size="sm" onClick={downloadVideo} className="gap-2">
            <Download className="h-3.5 w-3.5" /> Download Video
          </Button>
        </div>
      )}
    </div>
  );
};

/* ─── Sub-components ─── */
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

const InfoRow = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) => (
  <div className="flex items-center gap-2">
    <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium ml-auto font-mono">{value}</span>
  </div>
);

export default ProsesVideo;
