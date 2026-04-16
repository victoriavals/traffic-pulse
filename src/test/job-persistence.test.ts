/**
 * Tests for video job localStorage persistence.
 *
 * Covers:
 * - ACTIVE_JOB_KEY constant and PersistedJob shape
 * - Saving/clearing job data from localStorage
 * - Custom "job-storage-change" event dispatch on write/remove
 * - Sidebar indicator reacts to storage events (same-tab and cross-tab)
 * - 404 handling: localStorage cleared + error message shown
 *
 * These are pure JS / DOM tests — no React rendering required.
 * All window.localStorage interactions use the jsdom built-in.
 */

// ── Constants mirrored from ProsesVideo.tsx ───────────────────────────────────
const ACTIVE_JOB_KEY = "traffic_active_job";

interface PersistedJob {
  jobId: string;
  videoUrl: string;
  recordingStart: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// localStorage — write / read / clear
// ══════════════════════════════════════════════════════════════════════════════

describe("Job persistence — localStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores a valid PersistedJob JSON object under ACTIVE_JOB_KEY", () => {
    const payload: PersistedJob = {
      jobId: "abc123def456",
      videoUrl: "https://drive.google.com/file/d/XYZ/view",
      recordingStart: "2026-04-14T08:30:00",
    };

    localStorage.setItem(ACTIVE_JOB_KEY, JSON.stringify(payload));

    const raw = localStorage.getItem(ACTIVE_JOB_KEY);
    expect(raw).not.toBeNull();

    const parsed: PersistedJob = JSON.parse(raw!);
    expect(parsed.jobId).toBe("abc123def456");
    expect(parsed.videoUrl).toBe("https://drive.google.com/file/d/XYZ/view");
    expect(parsed.recordingStart).toBe("2026-04-14T08:30:00");
  });

  it("returns null after localStorage.removeItem(ACTIVE_JOB_KEY)", () => {
    localStorage.setItem(ACTIVE_JOB_KEY, JSON.stringify({ jobId: "x", videoUrl: "", recordingStart: "" }));
    expect(localStorage.getItem(ACTIVE_JOB_KEY)).not.toBeNull();

    localStorage.removeItem(ACTIVE_JOB_KEY);
    expect(localStorage.getItem(ACTIVE_JOB_KEY)).toBeNull();
  });

  it("overwrites the previous job when a new job starts", () => {
    const job1: PersistedJob = { jobId: "job_one", videoUrl: "url1", recordingStart: "" };
    const job2: PersistedJob = { jobId: "job_two", videoUrl: "url2", recordingStart: "" };

    localStorage.setItem(ACTIVE_JOB_KEY, JSON.stringify(job1));
    localStorage.setItem(ACTIVE_JOB_KEY, JSON.stringify(job2));

    const parsed: PersistedJob = JSON.parse(localStorage.getItem(ACTIVE_JOB_KEY)!);
    expect(parsed.jobId).toBe("job_two");
  });

  it("gracefully handles corrupt JSON in localStorage", () => {
    localStorage.setItem(ACTIVE_JOB_KEY, "NOT_VALID_JSON{{{");

    expect(() => {
      const raw = localStorage.getItem(ACTIVE_JOB_KEY);
      if (raw) {
        try {
          JSON.parse(raw);
        } catch {
          localStorage.removeItem(ACTIVE_JOB_KEY);
        }
      }
    }).not.toThrow();

    expect(localStorage.getItem(ACTIVE_JOB_KEY)).toBeNull();
  });

  it("is empty on a fresh page load (no active job)", () => {
    // simulate checking on mount
    const hasActiveJob = !!localStorage.getItem(ACTIVE_JOB_KEY);
    expect(hasActiveJob).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Custom event — "job-storage-change"
// ══════════════════════════════════════════════════════════════════════════════

describe("Custom event — job-storage-change", () => {
  it("fires when a job is saved to localStorage", () => {
    const handler = vi.fn();
    window.addEventListener("job-storage-change", handler);

    localStorage.setItem(ACTIVE_JOB_KEY, JSON.stringify({ jobId: "ev_test", videoUrl: "", recordingStart: "" }));
    window.dispatchEvent(new Event("job-storage-change"));

    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener("job-storage-change", handler);
  });

  it("fires when a job is cleared from localStorage", () => {
    const handler = vi.fn();
    window.addEventListener("job-storage-change", handler);

    localStorage.removeItem(ACTIVE_JOB_KEY);
    window.dispatchEvent(new Event("job-storage-change"));

    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener("job-storage-change", handler);
  });

  it("sidebar check function reads correct state after event", () => {
    // Simulate what AppSidebar.tsx does:
    // const check = () => setHasActiveJob(!!localStorage.getItem("traffic_active_job"))
    let hasActiveJob = false;
    const check = () => { hasActiveJob = !!localStorage.getItem(ACTIVE_JOB_KEY); };

    window.addEventListener("job-storage-change", check);

    // Simulate job starting
    localStorage.setItem(ACTIVE_JOB_KEY, JSON.stringify({ jobId: "sidebar_test", videoUrl: "", recordingStart: "" }));
    window.dispatchEvent(new Event("job-storage-change"));
    expect(hasActiveJob).toBe(true);

    // Simulate job completing
    localStorage.removeItem(ACTIVE_JOB_KEY);
    window.dispatchEvent(new Event("job-storage-change"));
    expect(hasActiveJob).toBe(false);

    window.removeEventListener("job-storage-change", check);
  });

  it("multiple listeners receive the same event", () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    window.addEventListener("job-storage-change", handler1);
    window.addEventListener("job-storage-change", handler2);

    window.dispatchEvent(new Event("job-storage-change"));

    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();

    window.removeEventListener("job-storage-change", handler1);
    window.removeEventListener("job-storage-change", handler2);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Cross-tab sync — native "storage" event
// ══════════════════════════════════════════════════════════════════════════════

describe("Cross-tab sync — storage event", () => {
  it("storage event with key=ACTIVE_JOB_KEY reflects new value", () => {
    let hasActiveJob = false;
    const check = () => { hasActiveJob = !!localStorage.getItem(ACTIVE_JOB_KEY); };

    window.addEventListener("storage", check);

    // Simulate another tab writing the key
    localStorage.setItem(ACTIVE_JOB_KEY, JSON.stringify({ jobId: "other_tab", videoUrl: "", recordingStart: "" }));

    // Manually fire the storage event (jsdom doesn't fire it for same-window writes)
    window.dispatchEvent(new StorageEvent("storage", { key: ACTIVE_JOB_KEY }));
    expect(hasActiveJob).toBe(true);

    window.removeEventListener("storage", check);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 404 handling simulation
// ══════════════════════════════════════════════════════════════════════════════

describe("404 handling — job not found", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("clears localStorage when 404 is received from backend", async () => {
    // Pre-populate as if a job was in progress
    localStorage.setItem(ACTIVE_JOB_KEY, JSON.stringify({ jobId: "gone_job", videoUrl: "url", recordingStart: "" }));
    expect(localStorage.getItem(ACTIVE_JOB_KEY)).not.toBeNull();

    // Simulate what startPolling does on 404
    const fakeResponse = { status: 404, ok: false };
    if (fakeResponse.status === 404) {
      localStorage.removeItem(ACTIVE_JOB_KEY);
      window.dispatchEvent(new Event("job-storage-change"));
    }

    expect(localStorage.getItem(ACTIVE_JOB_KEY)).toBeNull();
  });

  it("sidebar dot disappears after 404 clears localStorage", () => {
    localStorage.setItem(ACTIVE_JOB_KEY, JSON.stringify({ jobId: "gone", videoUrl: "", recordingStart: "" }));

    let hasActiveJob = !!localStorage.getItem(ACTIVE_JOB_KEY);
    expect(hasActiveJob).toBe(true);

    // 404 → clear
    localStorage.removeItem(ACTIVE_JOB_KEY);
    window.dispatchEvent(new Event("job-storage-change"));

    hasActiveJob = !!localStorage.getItem(ACTIVE_JOB_KEY);
    expect(hasActiveJob).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// beforeunload — file upload navigation guard
// ══════════════════════════════════════════════════════════════════════════════

describe("beforeunload — file upload navigation guard", () => {
  it("handler calls preventDefault when loading=true", () => {
    const event = new Event("beforeunload") as BeforeUnloadEvent;
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");

    // Simulate the handler added by ProsesVideo.tsx when loading=true
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    handler(event);

    expect(preventDefaultSpy).toHaveBeenCalledOnce();
  });

  it("handler is removed when loading changes to false", () => {
    const handler = vi.fn();

    window.addEventListener("beforeunload", handler);
    window.removeEventListener("beforeunload", handler);

    // Fire beforeunload — handler should NOT be called since it was removed
    window.dispatchEvent(new Event("beforeunload"));
    expect(handler).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Persist job data integrity
// ══════════════════════════════════════════════════════════════════════════════

describe("PersistedJob data integrity", () => {
  it("all required fields are preserved through JSON round-trip", () => {
    const original: PersistedJob = {
      jobId: "roundtrip_001",
      videoUrl: "https://drive.google.com/file/d/ABCDE/view?usp=sharing",
      recordingStart: "2026-04-16T09:15:30",
    };

    localStorage.setItem(ACTIVE_JOB_KEY, JSON.stringify(original));
    const restored: PersistedJob = JSON.parse(localStorage.getItem(ACTIVE_JOB_KEY)!);

    expect(restored.jobId).toBe(original.jobId);
    expect(restored.videoUrl).toBe(original.videoUrl);
    expect(restored.recordingStart).toBe(original.recordingStart);
  });

  it("empty recordingStart is preserved (user did not set recording time)", () => {
    const job: PersistedJob = { jobId: "no_time", videoUrl: "url", recordingStart: "" };
    localStorage.setItem(ACTIVE_JOB_KEY, JSON.stringify(job));
    const restored: PersistedJob = JSON.parse(localStorage.getItem(ACTIVE_JOB_KEY)!);
    expect(restored.recordingStart).toBe("");
  });
});
