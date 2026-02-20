import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from "react";
import {
  Upload, X, SlidersHorizontal, Search, Image as ImageIcon,
  Copy, Download, Loader2, AlertCircle, ChevronDown, ChevronUp,
  Truck, Car, PersonStanding, Bike, BarChart3, Cpu, Monitor, Maximize
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useApiSettings } from "@/contexts/ApiContext";
import { addActivityLog } from "@/lib/activity-log";
import { toast } from "@/hooks/use-toast";

/* ─── Types ─── */
interface Detection {
  class_name: string;
  confidence: number;
  bbox: { x1: number; y1: number; x2: number; y2: number };
}

interface DetectResponse {
  success: boolean;
  message: string;
  detections: Detection[];
  summary: { big_vehicle: number; car: number; pedestrian: number; two_wheeler: number; total: number };
  inference_config: { model: string; device: string; image_size: number };
}

type ModelSize = "SMALL" | "MEDIUM";
type ResultMode = "json" | "annotate" | null;

/* ─── Page ─── */
const DeteksiGambar = () => {
  const { baseUrl } = useApiSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File state
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Config
  const [confidence, setConfidence] = useState(0.45);
  const [iou, setIou] = useState(0.5);
  const [modelSize, setModelSize] = useState<ModelSize>("SMALL");
  const [configOpen, setConfigOpen] = useState(true);

  // Results
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMode, setResultMode] = useState<ResultMode>(null);
  const [jsonResult, setJsonResult] = useState<DetectResponse | null>(null);
  const [annotatedUrl, setAnnotatedUrl] = useState<string | null>(null);
  const [detectionsCount, setDetectionsCount] = useState<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  /* ─── File handling ─── */
  const handleFile = useCallback((f: File) => {
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
    setError(null);
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")) handleFile(f);
  }, [handleFile]);

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const resetFile = useCallback(() => {
    setFile(null);
    setPreview(null);
    setJsonResult(null);
    setAnnotatedUrl(null);
    setResultMode(null);
    setError(null);
    setDetectionsCount(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  /* ─── API calls ─── */
  const callApi = useCallback(async (endpoint: "detect" | "annotate") => {
    if (!file) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    const params = new URLSearchParams({
      confidence: confidence.toString(),
      iou: iou.toString(),
      model_size: modelSize,
    });

    try {
      const res = await fetch(`${baseUrl}/image/${endpoint}?${params}`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `HTTP ${res.status}`);
      }

      if (endpoint === "detect") {
        const data: DetectResponse = await res.json();
        setJsonResult(data);
        setResultMode("json");
        // Save to activity log & last detection counts
        addActivityLog({ type: "Gambar", source: file.name, totalDeteksi: data.summary.total });
        localStorage.setItem("last-detection-counts", JSON.stringify({
          bigVehicle: data.summary.big_vehicle,
          car: data.summary.car,
          pedestrian: data.summary.pedestrian,
          twoWheeler: data.summary.two_wheeler,
        }));
      } else {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setAnnotatedUrl(url);
        setResultMode("annotate");
        const count = res.headers.get("X-Detections-Count");
        setDetectionsCount(count ? parseInt(count) : null);
        addActivityLog({ type: "Gambar", source: file.name, totalDeteksi: count ? parseInt(count) : 0 });
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }, [file, baseUrl, confidence, iou, modelSize]);

  const copyJson = useCallback(() => {
    if (jsonResult) {
      navigator.clipboard.writeText(JSON.stringify(jsonResult, null, 2));
      toast({ title: "Disalin!", description: "JSON response berhasil disalin ke clipboard." });
    }
  }, [jsonResult]);

  const downloadAnnotated = useCallback(() => {
    if (annotatedUrl) {
      const a = document.createElement("a");
      a.href = annotatedUrl;
      a.download = `annotated_${file?.name || "image"}.jpg`;
      a.click();
    }
  }, [annotatedUrl, file]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="opacity-0 animate-fade-in-up">
        <h1 className="text-2xl font-bold">Deteksi Gambar</h1>
        <p className="text-muted-foreground text-sm mt-1">Upload gambar untuk mendeteksi dan menghitung kendaraan</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 opacity-0 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
        {/* ═══ LEFT COLUMN ═══ */}
        <div className="space-y-4">
          {/* Drop zone */}
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/bmp,image/tiff" className="hidden" onChange={handleInputChange} />

          {!preview ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              className={`glass-card rounded-xl w-full p-12 flex flex-col items-center justify-center text-center border-2 border-dashed transition-all duration-300 cursor-pointer ${isDragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-border/60 hover:border-primary/40"}`}
            >
              <div className="rounded-2xl bg-primary/10 p-4 mb-4">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">Seret gambar ke sini atau klik untuk memilih</h3>
              <p className="text-xs text-muted-foreground">Format: JPEG, PNG, BMP, TIFF</p>
            </button>
          ) : (
            <div className="glass-card rounded-xl p-4 relative group">
              <button onClick={resetFile} className="absolute top-2 right-2 z-10 rounded-lg bg-background/80 p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                <X className="h-4 w-4" />
              </button>
              <img src={preview} alt="Preview" className="w-full rounded-lg object-contain max-h-64" />
              <p className="text-xs text-muted-foreground mt-2 truncate">{file?.name}</p>
            </div>
          )}

          {/* Config panel */}
          <div className="glass-card rounded-xl overflow-hidden">
            <button onClick={() => setConfigOpen(!configOpen)} className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Konfigurasi</span>
              </div>
              {configOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {configOpen && (
              <div className="px-4 pb-4 space-y-5">
                {/* Confidence */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Confidence Threshold</span>
                    <span className="font-mono font-medium">{confidence.toFixed(2)}</span>
                  </div>
                  <Slider value={[confidence]} onValueChange={([v]) => setConfidence(v)} min={0} max={1} step={0.05} />
                </div>
                {/* IoU */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">IoU Threshold</span>
                    <span className="font-mono font-medium">{iou.toFixed(2)}</span>
                  </div>
                  <Slider value={[iou]} onValueChange={([v]) => setIou(v)} min={0} max={1} step={0.05} />
                </div>
                {/* Model size */}
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
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button onClick={() => callApi("detect")} disabled={!file || loading} className="flex-1 gap-2">
              {loading && resultMode !== "annotate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Deteksi (JSON)
            </Button>
            <Button onClick={() => callApi("annotate")} disabled={!file || loading} variant="outline" className="flex-1 gap-2">
              {loading && resultMode === "annotate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
              Deteksi + Anotasi
            </Button>
          </div>
        </div>

        {/* ═══ RIGHT COLUMN ═══ */}
        <div className="space-y-4">
          {/* Error */}
          {error && (
            <div className="glass-card rounded-xl p-4 border-destructive/50 bg-destructive/10 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">Gagal menghubungi API</p>
                <p className="text-xs text-muted-foreground mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="glass-card rounded-xl p-12 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Memproses gambar...</p>
            </div>
          )}

          {/* JSON Results */}
          {!loading && resultMode === "json" && jsonResult && (
            <div className="space-y-4 opacity-0 animate-fade-in-up">
              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-3">
                <SummaryCard icon={Truck} label="Big Vehicle" value={jsonResult.summary.big_vehicle} colorVar="var(--traffic-blue)" />
                <SummaryCard icon={Car} label="Car" value={jsonResult.summary.car} colorVar="var(--traffic-green)" />
                <SummaryCard icon={PersonStanding} label="Pedestrian" value={jsonResult.summary.pedestrian} colorVar="var(--traffic-amber)" />
                <SummaryCard icon={Bike} label="Two Wheeler" value={jsonResult.summary.two_wheeler} colorVar="var(--traffic-purple)" />
              </div>
              <div className="glass-card rounded-xl p-4 gradient-total flex items-center gap-3">
                <BarChart3 className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Total Kendaraan</p>
                  <p className="text-2xl font-bold">{jsonResult.summary.total}</p>
                </div>
              </div>

              {/* Detections table */}
              {jsonResult.detections.length > 0 && (
                <div className="glass-card rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-border/40">
                    <p className="text-sm font-medium">Detail Deteksi ({jsonResult.detections.length})</p>
                  </div>
                  <div className="overflow-x-auto max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-card/90 backdrop-blur">
                        <tr className="border-b border-border/40 text-left">
                          <th className="px-4 py-2 font-medium text-muted-foreground">Class</th>
                          <th className="px-4 py-2 font-medium text-muted-foreground">Confidence</th>
                          <th className="px-4 py-2 font-medium text-muted-foreground">Bounding Box</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jsonResult.detections.map((d, i) => (
                          <tr key={i} className="border-b border-border/20 last:border-0 hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-2 font-medium">{d.class_name}</td>
                            <td className="px-4 py-2">
                              <span className="font-mono">{(d.confidence * 100).toFixed(1)}%</span>
                            </td>
                            <td className="px-4 py-2 font-mono text-muted-foreground">
                              ({Math.round(d.bbox.x1)}, {Math.round(d.bbox.y1)}, {Math.round(d.bbox.x2)}, {Math.round(d.bbox.y2)})
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Inference config */}
              <div className="glass-card rounded-xl p-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">Konfigurasi Inference</p>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-3.5 w-3.5 text-primary" />
                    <div>
                      <p className="text-muted-foreground">Model</p>
                      <p className="font-medium">{jsonResult.inference_config.model}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Monitor className="h-3.5 w-3.5 text-primary" />
                    <div>
                      <p className="text-muted-foreground">Device</p>
                      <p className="font-medium">{jsonResult.inference_config.device}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Maximize className="h-3.5 w-3.5 text-primary" />
                    <div>
                      <p className="text-muted-foreground">Image Size</p>
                      <p className="font-medium">{jsonResult.inference_config.image_size}px</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Copy button */}
              <Button variant="outline" size="sm" onClick={copyJson} className="gap-2">
                <Copy className="h-3.5 w-3.5" /> Copy JSON
              </Button>
            </div>
          )}

          {/* Annotate Results */}
          {!loading && resultMode === "annotate" && annotatedUrl && (
            <div className="space-y-4 opacity-0 animate-fade-in-up">
              {detectionsCount !== null && (
                <div className="glass-card rounded-xl p-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span className="text-sm"><span className="font-bold">{detectionsCount}</span> objek terdeteksi</span>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="glass-card rounded-xl p-3">
                  <p className="text-xs text-muted-foreground mb-2">Original</p>
                  {preview && <img src={preview} alt="Original" className="w-full rounded-lg object-contain max-h-72" />}
                </div>
                <div className="glass-card rounded-xl p-3">
                  <p className="text-xs text-muted-foreground mb-2">Annotated</p>
                  <img src={annotatedUrl} alt="Annotated" className="w-full rounded-lg object-contain max-h-72" />
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={downloadAnnotated} className="gap-2">
                <Download className="h-3.5 w-3.5" /> Download Gambar
              </Button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !resultMode && !error && (
            <div className="glass-card rounded-xl p-12 flex flex-col items-center justify-center text-center">
              <div className="rounded-2xl bg-muted/50 p-4 mb-4">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1 text-muted-foreground">Belum Ada Hasil</h3>
              <p className="text-xs text-muted-foreground max-w-xs">Upload gambar dan tekan tombol deteksi untuk melihat hasil di sini.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─── Small summary card ─── */
const SummaryCard = ({ icon: Icon, label, value, colorVar }: { icon: React.ElementType; label: string; value: number; colorVar: string }) => (
  <div className="glass-card rounded-xl p-3 flex items-center gap-3 transition-transform duration-200 hover:scale-[1.02]">
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `hsl(${colorVar} / 0.15)` }}>
      <Icon className="h-4 w-4" style={{ color: `hsl(${colorVar})` }} />
    </div>
    <div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  </div>
);

export default DeteksiGambar;
