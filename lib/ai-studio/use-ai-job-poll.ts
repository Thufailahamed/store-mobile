import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { getAiJobBackend, type AiJob, type AiJobStatus } from "../api/backend";

const TERMINAL: ReadonlySet<AiJobStatus> = new Set(["succeeded", "failed", "cancelled"]);
const POLL_INTERVAL_MS = 2000;

export function useAiJobPoll(jobId: string | null): { job: AiJob | null; error: string | null; isPolling: boolean } {
  const [job, setJob] = useState<AiJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isActiveRef = useRef(AppState.currentState === "active");

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => { isActiveRef.current = s === "active"; });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (cancelled) return;
      if (!isActiveRef.current) {
        timer = setTimeout(tick, POLL_INTERVAL_MS);
        return;
      }
      const res = await getAiJobBackend(jobId);
      if (cancelled) return;
      if (res.ok) {
        setJob(res.data.job);
        if (TERMINAL.has(res.data.job.status)) return;
      } else {
        setError(res.error ?? "fetch failed");
      }
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    };

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId]);

  return { job, error, isPolling: job ? !TERMINAL.has(job.status) : false };
}
