import { useState, useRef, useCallback, useEffect, type DragEvent, type ChangeEvent } from "react";
import {
  Upload, Film, X, BarChart3, Truck, Car,
  PersonStanding, Bike, Loader2, Download, AlertCircle, Info,
  Copy, Play, Cpu, Monitor, Maximize, Clock, Layers, Timer,
  Link, CheckCircle2, XCircle, RefreshCw, CalendarClock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApiSettings } from "@/contexts/ApiContext";
import { useDetectionConfig } from "@/contexts/DetectionConfigContext";
import { addActivityLog } from "@/lib/activity-log";
import { toast } from "@/hooks/use-toast";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell
} from "recharts";

/* ─── Types ─── */
interface Counts {
  big_vehicle: number;
  car: number;
  pedestrian: number;
  two_wheeler: number;
  total: number;
}

interface VideoDetectResponse {
  success: boolean;
  message: string;
  counts: Counts;
  video_info: { resolution: string; fps: number; total_frames: number; duration_seconds: number; processing_time_seconds: number; sample_every_n_seconds?: number };
  inference_config: { model: string; device: string; image_size: number; line_start: number[]; line_end: number[] };
}

interface VideoJobStatus {
  job_id: string;
  status: "pending" | "downloading" | "processing" | "done" | "error";
  progress: number;
  message: string;
  counts: Counts | null;
  video_info: VideoDetectResponse["video_info"] | null;
  inference_config: VideoDetectResponse["inference_config"] | null;
  error: string | null;
}

type InputMode = "upload" | "url";
type ResultMode = "json" | "video" | null;

const CLASS_COLORS = [
  "hsl(var(--traffic-blue))",
  "hsl(var(--traffic-green))",
  "hsl(var(--traffic-amber))",
  "hsl(var(--traffic-purple))",
];

const VIDEO_TYPES = ["video/mp4", "video/x-msvideo", "video/quicktime", "video/x-matroska"];

/**
 * localStorage key used to persist an active URL-based video job across
 * browser sessions and tab navigations.
 *
 * The value is a JSON-serialised {@link PersistedJob}.  It is written when a
 * job is submitted, cleared when the job reaches a terminal state (done /
 * error / cancelled), and read on component mount to auto-resume polling.
 */
const ACTIVE_JOB_KEY = "traffic_active_job";

/**
 * Minimal job snapshot persisted to localStorage.
 *
 * Only the fields needed to reconnect to an in-progress backend job are
 * stored here.  Full job state (counts, video_info, …) is fetched live from
 * the backend when polling resumes.
 */
interface PersistedJob {
  /** Backend job ID returned by POST /video/jobs. */
  jobId: string;
  /** Original public video URL submitted by the user. */
  videoUrl: string;
  /** ISO-8601 recording start timestamp (may be empty if not set). */
  recordingStart: string;
}


const JOB_STATUS_CONFIG: Record<VideoJobStatus["status"], { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "Menunggu...", color: "text-muted-foreground", icon: Loader2 },
  downloading: { label: "Mengunduh Video", color: "text-blue-400", icon: Loader2 },
  processing: { label: "Memproses Frame", color: "text-yellow-400", icon: Loader2 },
  done: { label: "Selesai!", color: "text-traffic-green", icon: CheckCircle2 },
  error: { label: "Error", color: "text-destructive", icon: XCircle },
};

/* ─── Page ─── */
const ProsesVideo = () => {
  const { baseUrl } = useApiSettings();
  const { confidence, iou, modelSize, lineStartX, lineStartY, lineEndX, lineEndY } = useDetectionConfig();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Input mode
  const [inputMode, setInputMode] = useState<InputMode>("upload");

  // File upload state
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // URL job state
  const [videoUrl, setVideoUrl] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<VideoJobStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingResumeRef = useRef<string | null>(null);

  // Upload results
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMode, setResultMode] = useState<ResultMode>(null);
  const [jsonResult, setJsonResult] = useState<VideoDetectResponse | null>(null);
  const [annotatedVideoUrl, setAnnotatedVideoUrl] = useState<string | null>(null);
  const [headerInfo, setHeaderInfo] = useState<{ totalCount: string; framesProcessed: string; processingTime: string } | null>(null);

  // Recording timestamp (for hourly chart)
  const [recordingStart, setRecordingStart] = useState("");

  // Frame preview state
  const [frameImage, setFrameImage] = useState<HTMLImageElement | null>(null);
  const [frameLoading, setFrameLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* ─── Polling cleanup on unmount ─────────────────────────────────────────
   * Clears the setInterval polling loop when the user navigates away.
   * The backend job continues running; localStorage retains the jobId so
   * the next mount can resume polling automatically.                       */
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  /* ─── Restore persisted job on mount ─────────────────────────────────────
   * On component mount, checks localStorage for an active job from a
   * previous session.  If found:
   *   1. Restores jobId, videoUrl, recordingStart, and inputMode.
   *   2. Sets pendingResumeRef so the auto-resume effect can start polling
   *      once startPolling has been defined (hooks called later in render).
   *   3. Shows a toast notification to inform the user.
   *
   * Corrupt JSON is caught and the key is removed so the component mounts
   * cleanly with a blank slate.                                             */
  useEffect(() => {
    const raw = localStorage.getItem(ACTIVE_JOB_KEY);
    if (!raw) return;
    try {
      const p = JSON.parse(raw) as PersistedJob;
      pendingResumeRef.current = p.jobId;
      setJobId(p.jobId);
      setVideoUrl(p.videoUrl);
      setRecordingStart(p.recordingStart);
      setInputMode("url");
      toast({ title: "Melanjutkan pemrosesan", description: "Job video sebelumnya ditemukan dan dilanjutkan." });
    } catch {
      localStorage.removeItem(ACTIVE_JOB_KEY);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Warn before leaving page during file upload ─────────────────────────
   * File uploads are synchronous HTTP POST requests — there is no job ID to
   * reconnect to after a page reload.  The browser native "Leave site?"
   * dialog is the only guardrail available for this mode.
   * The handler is added only while loading=true and removed immediately
   * after the upload completes or fails.                                    */
  useEffect(() => {
    if (!loading) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [loading]);

  /* ─── Save to hourly chart ─── */
  const saveVideoDetection = useCallback(async (counts: Counts, durationSeconds: number) => {
    if (!recordingStart || durationSeconds <= 0) return;
    try {
      await fetch(`${baseUrl}/stats/video-detection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recording_start: recordingStart,
          duration_seconds: durationSeconds,
          big_vehicle: counts.big_vehicle,
          car: counts.car,
          pedestrian: counts.pedestrian,
          two_wheeler: counts.two_wheeler,
        }),
      });
    } catch { /* ignore — chart save is non-critical */ }
  }, [recordingStart, baseUrl]);

  /* ─── Extract first frame from uploaded file (client-side) ─── */
  useEffect(() => {
    if (!file) { setFrameImage(null); return; }

    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;

    video.onloadeddata = () => {
      // Seek to first frame
      video.currentTime = 0.01;
    };

    video.onseeked = () => {
      const cvs = document.createElement("canvas");
      cvs.width = video.videoWidth;
      cvs.height = video.videoHeight;
      const ctx = cvs.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const img = new Image();
        img.onload = () => setFrameImage(img);
        img.src = cvs.toDataURL("image/jpeg", 0.85);
      }
      URL.revokeObjectURL(url);
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      setFrameImage(null);
    };

    video.src = url;

    return () => { URL.revokeObjectURL(url); };
  }, [file]);

  /* ─── Draw counting line overlay on canvas ─── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (frameImage) {
      // Size canvas to image aspect ratio
      canvas.width = frameImage.naturalWidth;
      canvas.height = frameImage.naturalHeight;

      // Draw frame
      ctx.drawImage(frameImage, 0, 0);

      // Semi-transparent darkening for better line visibility
      ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const w = canvas.width;
      const h = canvas.height;
      const sx = lineStartX * w;
      const sy = lineStartY * h;
      const ex = lineEndX * w;
      const ey = lineEndY * h;

      // Draw counting line (glow effect)
      ctx.shadowColor = "#10b981";
      ctx.shadowBlur = 12;
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = Math.max(3, w * 0.003);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Start point (green)
      const dotR = Math.max(6, w * 0.006);
      ctx.fillStyle = "#10b981";
      ctx.beginPath();
      ctx.arc(sx, sy, dotR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.max(12, w * 0.014)}px monospace`;
      ctx.fillText("S", sx + dotR + 4, sy + 5);

      // End point (red)
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(ex, ey, dotR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText("E", ex + dotR + 4, ey + 5);

    } else {
      // Fallback: dark background with grid and line (similar to old SVG)
      canvas.width = 320;
      canvas.height = 180;
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, 320, 180);

      // Grid lines
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      for (let x = 80; x < 320; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 180); ctx.stroke(); }
      for (let y = 60; y < 180; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(320, y); ctx.stroke(); }

      // Counting line
      const sx = lineStartX * 320, sy = lineStartY * 180;
      const ex = lineEndX * 320, ey = lineEndY * 180;
      ctx.shadowColor = "#10b981";
      ctx.shadowBlur = 8;
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = "#10b981";
      ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ef4444";
      ctx.beginPath(); ctx.arc(ex, ey, 4, 0, Math.PI * 2); ctx.fill();

      ctx.font = "bold 10px monospace";
      ctx.fillStyle = "#10b981";
      ctx.fillText("S", sx + 7, sy - 4);
      ctx.fillStyle = "#ef4444";
      ctx.fillText("E", ex + 7, ey - 4);
    }
  }, [frameImage, lineStartX, lineStartY, lineEndX, lineEndY]);

  /* ─── Job polling ─── */
  const startPolling = useCallback((id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    const poll = async () => {
      try {
        const res = await fetch(`${baseUrl}/video/jobs/${id}`);

        // Job not found — server restarted and job was interrupted
        if (res.status === 404) {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          localStorage.removeItem(ACTIVE_JOB_KEY);
          window.dispatchEvent(new Event("job-storage-change"));
          setJobId(null);
          setJobStatus(null);
          setError("Job tidak ditemukan. Server kemungkinan direstart saat memproses. Silakan kirim ulang video.");
          return;
        }

        if (!res.ok) return; // transient error — retry on next interval
        const data: VideoJobStatus = await res.json();
        setJobStatus(data);

        if (data.status === "done" || data.status === "error") {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          localStorage.removeItem(ACTIVE_JOB_KEY);
          window.dispatchEvent(new Event("job-storage-change"));

          if (data.status === "done" && data.counts) {
            addActivityLog({
              type: "Video",
              source: videoUrl,
              totalDeteksi: data.counts.total,
              counts: {
                big_vehicle: data.counts.big_vehicle,
                car: data.counts.car,
                pedestrian: data.counts.pedestrian,
                two_wheeler: data.counts.two_wheeler,
              },
            }, baseUrl);
            if (data.video_info) {
              saveVideoDetection(data.counts, data.video_info.duration_seconds);
            }
          }
        }
      } catch { /* ignore transient errors */ }
    };

    poll(); // immediate first poll
    pollRef.current = setInterval(poll, 5000);
  }, [baseUrl, videoUrl, saveVideoDetection]);

  /* ─── Auto-resume polling once state settles after restore ─── */
  useEffect(() => {
    if (pendingResumeRef.current && jobId === pendingResumeRef.current) {
      const id = pendingResumeRef.current;
      pendingResumeRef.current = null;
      startPolling(id);
    }
  }, [jobId, startPolling]);

  /* ─── URL Job submit ─── */
  const submitUrlJob = useCallback(async () => {
    if (!videoUrl.trim()) {
      setError("Masukkan URL video publik terlebih dahulu");
      return;
    }
    setError(null);
    setJobStatus(null);
    setJsonResult(null);

    try {
      const res = await fetch(`${baseUrl}/video/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: videoUrl.trim(),
          confidence,
          iou,
          model_size: modelSize,
          line_start_x: lineStartX,
          line_start_y: lineStartY,
          line_end_x: lineEndX,
          line_end_y: lineEndY,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `HTTP ${res.status}`);
      }

      const data: VideoJobStatus = await res.json();
      setJobId(data.job_id);
      setJobStatus(data);
      localStorage.setItem(ACTIVE_JOB_KEY, JSON.stringify({ jobId: data.job_id, videoUrl, recordingStart } satisfies PersistedJob));
      window.dispatchEvent(new Event("job-storage-change"));
      startPolling(data.job_id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal membuat job");
    }
  }, [videoUrl, confidence, iou, modelSize, lineStartX, lineStartY, lineEndX, lineEndY, baseUrl, startPolling]);

  /* ─── URL Job cancel/reset ─── */
  const cancelUrlJob = useCallback(async () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (jobId) {
      try { await fetch(`${baseUrl}/video/jobs/${jobId}`, { method: "DELETE" }); } catch { /* ignore */ }
    }
    localStorage.removeItem(ACTIVE_JOB_KEY);
    window.dispatchEvent(new Event("job-storage-change"));
    setJobId(null);
    setJobStatus(null);
    setError(null);
  }, [jobId, baseUrl]);

  /* ─── URL preview fetch ─── */
  const fetchUrlPreview = useCallback(async () => {
    if (!videoUrl.trim()) return;
    setFrameLoading(true);
    setFrameImage(null);

    try {
      const res = await fetch(`${baseUrl}/video/preview-frame?url=${encodeURIComponent(videoUrl.trim())}`, {
        method: "POST",
      });
      if (!res.ok) {
        let detail = `Gagal mengambil preview (HTTP ${res.status})`;
        try {
          const body = await res.json();
          if (body?.detail) detail = body.detail;
        } catch { /* ignore parse error */ }
        toast({ title: "Preview gagal", description: detail, variant: "destructive" });
        setFrameLoading(false);
        return;
      }

      const blob = await res.blob();
      const imgUrl = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        setFrameImage(img);
        setFrameLoading(false);
      };
      img.onerror = () => {
        URL.revokeObjectURL(imgUrl);
        setFrameLoading(false);
      };
      img.src = imgUrl;
    } catch (err) {
      toast({ title: "Preview gagal", description: String(err), variant: "destructive" });
      setFrameLoading(false);
    }
  }, [videoUrl, baseUrl]);

  /* ─── Local datetime helper (avoids UTC offset from toISOString) ─── */
  const toLocalDT = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  /* ─── File upload ─── */
  const handleFile = useCallback((f: File) => {
    if (!VIDEO_TYPES.includes(f.type) && !f.name.match(/\.(mp4|avi|mov|mkv)$/i)) return;
    setFile(f);
    setError(null);
    setResultMode(null);
    setJsonResult(null);
    setAnnotatedVideoUrl(null);
    setHeaderInfo(null);
    // Auto-fill recording time from file metadata (only if not already set)
    setRecordingStart((prev) => {
      if (prev) return prev;
      const d = new Date(f.lastModified);
      return toLocalDT(d);
    });
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
    setAnnotatedVideoUrl(null);
    setResultMode(null);
    setError(null);
    setHeaderInfo(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  /* ─── File upload API ─── */
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
        addActivityLog({
          type: "Video",
          source: file.name,
          totalDeteksi: data.counts.total,
          counts: {
            big_vehicle: data.counts.big_vehicle,
            car: data.counts.car,
            pedestrian: data.counts.pedestrian,
            two_wheeler: data.counts.two_wheeler,
          },
        }, baseUrl);
        saveVideoDetection(data.counts, data.video_info.duration_seconds);
      } else {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setAnnotatedVideoUrl(url);
        setHeaderInfo({
          totalCount: res.headers.get("X-Total-Count") || "-",
          framesProcessed: res.headers.get("X-Frames-Processed") || "-",
          processingTime: res.headers.get("X-Processing-Time") || "-",
        });
        addActivityLog({ type: "Video", source: file.name, totalDeteksi: parseInt(res.headers.get("X-Total-Count") || "0") }, baseUrl);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
      setResultMode(null);
    } finally {
      setLoading(false);
    }
  }, [file, baseUrl, confidence, iou, modelSize, lineStartX, lineStartY, lineEndX, lineEndY, saveVideoDetection]);

  const copyJson = useCallback(() => {
    const data = jsonResult ?? (jobStatus?.status === "done" ? jobStatus : null);
    if (data) {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      toast({ title: "Disalin!", description: "JSON response berhasil disalin ke clipboard." });
    }
  }, [jsonResult, jobStatus]);

  const downloadVideo = useCallback(() => {
    if (annotatedVideoUrl) {
      const a = document.createElement("a");
      a.href = annotatedVideoUrl;
      a.download = `annotated_${file?.name || "video"}.mp4`;
      a.click();
    }
  }, [annotatedVideoUrl, file]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  /* ─── Derived state ─── */
  const isJobActive = jobStatus !== null && (jobStatus.status === "pending" || jobStatus.status === "downloading" || jobStatus.status === "processing");
  const isJobDone = jobStatus?.status === "done";
  const isJobError = jobStatus?.status === "error";

  const displayCounts: Counts | null = isJobDone
    ? jobStatus?.counts ?? null
    : jsonResult?.counts ?? null;

  const displayVideoInfo = isJobDone
    ? jobStatus?.video_info ?? null
    : jsonResult?.video_info ?? null;

  const displayInferenceConfig = isJobDone
    ? jobStatus?.inference_config ?? null
    : jsonResult?.inference_config ?? null;

  const showJsonResult = isJobDone || (!loading && resultMode === "json" && jsonResult !== null);

  const chartData = displayCounts ? [
    { name: "Big Vehicle", value: displayCounts.big_vehicle },
    { name: "Car", value: displayCounts.car },
    { name: "Pedestrian", value: displayCounts.pedestrian },
    { name: "Two Wheeler", value: displayCounts.two_wheeler },
  ] : [];

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="opacity-0 animate-fade-in-up">
        <h1 className="text-2xl font-bold">Proses Video</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload video atau gunakan URL publik untuk mendeteksi dan menghitung kendaraan
        </p>
      </div>

      {/* ─── Input Mode Tabs ─── */}
      <div className="opacity-0 animate-fade-in-up glass-card rounded-xl p-1.5 flex gap-1" style={{ animationDelay: "50ms" }}>
        {([
          { mode: "upload" as InputMode, label: "Upload File", icon: Upload },
          { mode: "url" as InputMode, label: "Via URL (Video Besar)", icon: Link },
        ]).map(({ mode, label, icon: Icon }) => (
          <button
            key={mode}
            onClick={() => {
              setInputMode(mode);
              setError(null);
            }}
            disabled={loading || isJobActive}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200
              ${inputMode === mode
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"}
              disabled:opacity-50`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ═══ Upload File Mode ═══ */}
      {inputMode === "upload" && (
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
              <span>Proses video bisa memakan waktu beberapa menit. Untuk video &gt;500 MB, gunakan tab <strong>Via URL</strong>.</span>
            </div>
          )}
        </div>
      )}

      {/* ═══ URL Mode ═══ */}
      {inputMode === "url" && (
        <div className="opacity-0 animate-fade-in-up glass-card rounded-xl p-5 space-y-5" style={{ animationDelay: "100ms" }}>
          <div className="flex items-center gap-2">
            <Link className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">URL Video Publik</span>
          </div>

          {/* URL Input */}
          <div className="space-y-2">
            <Input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://drive.google.com/file/d/FILE_ID/view?usp=sharing"
              className="font-mono text-sm"
              disabled={isJobActive}
            />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              ✅ Google Drive sharing link &nbsp;·&nbsp; ✅ Dropbox link &nbsp;·&nbsp; ✅ Direct MP4 URL publik
            </p>
          </div>

          {/* Info */}
          <div className="flex items-start gap-2 text-xs text-muted-foreground mt-1">
            <Info className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
            <span>Video diproses pada FPS asli untuk akurasi maksimal. Gunakan background job agar tidak timeout.</span>
          </div>

          {/* Preview Frame button */}
          {!frameImage && !isJobActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={fetchUrlPreview}
              disabled={!videoUrl.trim() || frameLoading}
              className="gap-2"
            >
              {frameLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Film className="h-3.5 w-3.5" />}
              Preview Frame
            </Button>
          )}

          {/* Job Progress */}
          {jobStatus && (
            <div className="space-y-3 border-t border-border/40 pt-4">
              {/* Status row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {(() => {
                    const cfg = JOB_STATUS_CONFIG[jobStatus.status];
                    const Icon = cfg.icon;
                    return (
                      <>
                        <Icon className={`h-4 w-4 ${cfg.color} ${isJobActive ? "animate-spin" : ""}`} />
                        <span className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</span>
                      </>
                    );
                  })()}
                </div>
                <span className="text-xs font-mono text-muted-foreground">{jobStatus.progress.toFixed(0)}%</span>
              </div>

              {/* Progress bar */}
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${isJobDone ? "bg-traffic-green" : isJobError ? "bg-destructive" : "bg-primary"
                    }`}
                  style={{ width: `${jobStatus.progress}%` }}
                />
              </div>

              {/* Message */}
              <p className="text-xs text-muted-foreground font-mono">{jobStatus.message}</p>

              {/* Error detail */}
              {isJobError && jobStatus.error && (
                <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{jobStatus.error}</p>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            {!isJobActive ? (
              <Button
                onClick={submitUrlJob}
                disabled={!videoUrl.trim() || isJobActive}
                className="gap-2 bg-traffic-green text-black hover:bg-traffic-green/90"
              >
                <Play className="h-4 w-4" />
                {isJobDone ? "Proses Ulang" : "Mulai Proses"}
              </Button>
            ) : (
              <Button onClick={cancelUrlJob} variant="destructive" className="gap-2">
                <X className="h-4 w-4" />
                Batalkan
              </Button>
            )}
            {(isJobDone || isJobError) && (
              <Button variant="outline" size="sm" onClick={cancelUrlJob} className="gap-2">
                <RefreshCw className="h-3.5 w-3.5" />
                Reset
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ═══ Waktu Rekaman ═══ */}
      <div className="glass-card rounded-xl p-4 opacity-0 animate-fade-in-up" style={{ animationDelay: "180ms" }}>
        <div className="flex items-center gap-2 mb-3">
          <CalendarClock className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">Waktu Rekaman Video</span>
          <span className="text-[10px] text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5 ml-1">Opsional — untuk grafik jam</span>
        </div>
        <div className="flex gap-2">
          <input
            type="datetime-local"
            step="1"
            value={recordingStart}
            onChange={(e) => setRecordingStart(e.target.value)}
            className="flex-1 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              now.setSeconds(0, 0);
              setRecordingStart(toLocalDT(now));
            }}
            className="shrink-0 rounded-lg border border-border/60 bg-muted/50 hover:bg-muted px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            title="Isi dengan waktu sekarang"
          >
            Sekarang
          </button>
        </div>
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {[
            { label: "-5m", min: -5 },
            { label: "-15m", min: -15 },
            { label: "-30m", min: -30 },
            { label: "-1j", min: -60 },
            { label: "-2j", min: -120 },
          ].map(({ label, min }) => (
            <button
              key={min}
              type="button"
              title={`Geser ${Math.abs(min) >= 60 ? Math.abs(min)/60 + " jam" : Math.abs(min) + " menit"} ke belakang`}
              onClick={() => {
                const base = recordingStart ? new Date(recordingStart) : new Date();
                base.setMinutes(base.getMinutes() + min);
                base.setSeconds(0, 0);
                setRecordingStart(toLocalDT(base));
              }}
              className="text-[10px] rounded px-1.5 py-0.5 border border-border/50 bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              {label}
            </button>
          ))}
          {recordingStart && (
            <button
              type="button"
              onClick={() => setRecordingStart("")}
              className="text-[10px] rounded px-1.5 py-0.5 border border-border/50 bg-muted/30 hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors ml-auto"
            >
              Hapus
            </button>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          Masukkan kapan rekaman dimulai. Hasil deteksi akan didistribusikan ke grafik Deteksi Kendaraan per jam di Dashboard.
        </p>
      </div>

      {/* ═══ Frame Preview ═══ */}
      <div className="glass-card rounded-xl p-5 opacity-0 animate-fade-in-up" style={{ animationDelay: "200ms" }}>
        <div className="rounded-lg bg-muted/30 border border-border/40 overflow-hidden relative">
          <canvas ref={canvasRef} className="w-full" style={{ display: "block" }} />
          {frameLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60">
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
            </div>
          )}
          {!frameImage && !frameLoading && (
            <p className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground pointer-events-none">
              {inputMode === "upload" ? "Upload video untuk melihat preview" : "Masukkan URL lalu klik Preview Frame"}
            </p>
          )}
        </div>
      </div>

      {/* ═══ Upload Action Buttons (only for upload mode) ═══ */}
      {inputMode === "upload" && (
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
      )}

      {/* ═══ Error Banner ═══ */}
      {error && (
        <div className="glass-card rounded-xl p-4 border-destructive/50 bg-destructive/10 flex items-start gap-3 opacity-0 animate-fade-in-up">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">Gagal</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* ═══ Upload Loading Spinner ═══ */}
      {loading && (
        <div className="glass-card rounded-xl p-12 flex flex-col items-center justify-center gap-3 opacity-0 animate-fade-in-up">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
          <p className="text-sm font-medium">Memproses video... mohon tunggu</p>
          <p className="text-xs text-muted-foreground">Biasanya 1-3 menit untuk video berdurasi 1-2 menit</p>
        </div>
      )}

      {/* ═══ JSON Results (both upload & URL mode) ═══ */}
      {showJsonResult && displayCounts && (
        <div className="space-y-5 opacity-0 animate-fade-in-up">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard icon={Truck} label="Big Vehicle" value={displayCounts.big_vehicle} colorVar="var(--traffic-blue)" />
            <SummaryCard icon={Car} label="Car" value={displayCounts.car} colorVar="var(--traffic-green)" />
            <SummaryCard icon={PersonStanding} label="Pedestrian" value={displayCounts.pedestrian} colorVar="var(--traffic-amber)" />
            <SummaryCard icon={Bike} label="Two Wheeler" value={displayCounts.two_wheeler} colorVar="var(--traffic-purple)" />
          </div>
          <div className="glass-card rounded-xl p-4 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Total Kendaraan</p>
              <p className="text-2xl font-bold">{displayCounts.total}</p>
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
                    {chartData.map((_, i) => (<Cell key={i} fill={CLASS_COLORS[i]} />))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Video info + Inference config */}
          {displayVideoInfo && displayInferenceConfig && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="glass-card rounded-xl p-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">Info Video</p>
                <div className="space-y-2 text-xs">
                  <InfoRow icon={Maximize} label="Resolusi" value={displayVideoInfo.resolution} />
                  <InfoRow icon={Layers} label="FPS" value={displayVideoInfo.fps.toString()} />
                  <InfoRow icon={Film} label="Total Frames" value={displayVideoInfo.total_frames.toLocaleString()} />
                  <InfoRow icon={Clock} label="Durasi" value={`${displayVideoInfo.duration_seconds.toFixed(1)}s`} />
                  <InfoRow icon={Timer} label="Waktu Proses" value={`${displayVideoInfo.processing_time_seconds.toFixed(1)}s`} />
                </div>
              </div>
              <div className="glass-card rounded-xl p-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">Konfigurasi Inference</p>
                <div className="space-y-2 text-xs">
                  <InfoRow icon={Cpu} label="Model" value={displayInferenceConfig?.model ?? "N/A"} />
                  <InfoRow icon={Monitor} label="Device" value={displayInferenceConfig?.device ?? "N/A"} />
                  <InfoRow icon={Maximize} label="Image Size" value={displayInferenceConfig?.image_size ? `${displayInferenceConfig.image_size}px` : "N/A"} />
                  <InfoRow icon={BarChart3} label="Line Start" value={Array.isArray(displayInferenceConfig?.line_start) ? `(${displayInferenceConfig.line_start.join(", ")})` : "N/A"} />
                  <InfoRow icon={BarChart3} label="Line End" value={Array.isArray(displayInferenceConfig?.line_end) ? `(${displayInferenceConfig.line_end.join(", ")})` : "N/A"} />
                </div>
              </div>
            </div>
          )}

          <Button variant="outline" size="sm" onClick={copyJson} className="gap-2">
            <Copy className="h-3.5 w-3.5" /> Copy JSON
          </Button>
        </div>
      )}

      {/* ═══ Annotated Video Results (upload mode only) ═══ */}
      {!loading && resultMode === "video" && annotatedVideoUrl && (
        <div className="space-y-4 opacity-0 animate-fade-in-up">
          <div className="glass-card rounded-xl overflow-hidden">
            <video src={annotatedVideoUrl} controls className="w-full" />
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
