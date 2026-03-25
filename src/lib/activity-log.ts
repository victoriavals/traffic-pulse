export interface ClassCounts {
  big_vehicle: number;
  car: number;
  pedestrian: number;
  two_wheeler: number;
}

export interface ActivityLogInput {
  type: "Gambar" | "Video" | "RTSP" | "EZVIZ";
  source: string;
  totalDeteksi: number;
  counts?: ClassCounts;
}

/**
 * Send activity log to backend API.
 * Falls back silently if backend is unavailable.
 */
export async function addActivityLog(
  log: ActivityLogInput,
  baseUrl: string,
): Promise<void> {
  try {
    await fetch(`${baseUrl}/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: log.type,
        source: log.source,
        total_deteksi: log.totalDeteksi,
        counts: log.counts
          ? {
              big_vehicle: log.counts.big_vehicle,
              car: log.counts.car,
              pedestrian: log.counts.pedestrian,
              two_wheeler: log.counts.two_wheeler,
              total: log.totalDeteksi,
            }
          : null,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Silently fail — backend may be unavailable
  }
}
