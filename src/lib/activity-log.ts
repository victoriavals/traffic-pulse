export interface ActivityLog {
  id: string;
  timestamp: string;
  type: "Gambar" | "Video" | "RTSP" | "EZVIZ";
  source: string;
  totalDeteksi: number;
}

const STORAGE_KEY = "traffic-detection-logs";

export function getActivityLogs(): ActivityLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ActivityLog[];
  } catch {
    return [];
  }
}

export function addActivityLog(log: Omit<ActivityLog, "id" | "timestamp">) {
  const logs = getActivityLogs();
  const newLog: ActivityLog = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...log,
  };
  const updated = [newLog, ...logs].slice(0, 10);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function clearActivityLogs() {
  localStorage.removeItem(STORAGE_KEY);
}
