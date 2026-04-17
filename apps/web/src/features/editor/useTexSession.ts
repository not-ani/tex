import { useEffectEvent, useRef, useState } from "react";
import type { TexDocumentPayload, TexSessionSnapshot } from "@tex/editor";

const AUTOSAVE_DELAY_MS = 180;

const formatError = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong.");

export type SyncStatus = "idle" | "syncing" | "saving";

/**
 * Autosave + save lifecycle for a single Tex session. The caller owns the
 * TexSessionSnapshot; this hook coalesces edits and sends them to the desktop
 * bridge in the background.
 */
export function useTexSession(
  snapshot: TexSessionSnapshot | null,
  onSnapshot: (next: TexSessionSnapshot) => void
) {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const snapshotRef = useRef<TexSessionSnapshot | null>(snapshot);
  const ackedRef = useRef<TexSessionSnapshot | null>(snapshot);
  const pendingRef = useRef<TexDocumentPayload | null>(null);
  const timerRef = useRef<number | null>(null);
  const flushPromiseRef = useRef<Promise<void> | null>(null);

  snapshotRef.current = snapshot;

  const clearTimer = useEffectEvent(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  });

  const resetTo = useEffectEvent((next: TexSessionSnapshot | null) => {
    clearTimer();
    pendingRef.current = null;
    ackedRef.current = next;
    snapshotRef.current = next;
    setError(null);
    setStatus("idle");
  });

  const flush = useEffectEvent(async () => {
    const desktop = window.texDesktop;
    if (!desktop) return;
    if (flushPromiseRef.current) return flushPromiseRef.current;

    const promise = (async () => {
      while (true) {
        const base = ackedRef.current;
        const pending = pendingRef.current;
        if (!base || !pending) {
          setStatus("idle");
          return;
        }
        pendingRef.current = null;
        setStatus("syncing");
        try {
          const nextAck = await desktop.updateSession({
            sessionId: base.sessionId,
            baseVersion: base.version,
            document: pending
          });
          ackedRef.current = nextAck;
          const current = snapshotRef.current;
          if (current && current.sessionId === nextAck.sessionId) {
            if (pendingRef.current) {
              const optimistic: TexSessionSnapshot = {
                ...nextAck,
                blocks: current.blocks,
                paragraphCount: current.paragraphCount,
                dirty: true
              };
              snapshotRef.current = optimistic;
              onSnapshot(optimistic);
            } else {
              snapshotRef.current = nextAck;
              onSnapshot(nextAck);
            }
          }
        } catch (err) {
          setError(formatError(err));
          setStatus("idle");
          return;
        }
      }
    })().finally(() => {
      flushPromiseRef.current = null;
    });

    flushPromiseRef.current = promise;
    return promise;
  });

  const scheduleFlush = useEffectEvent(() => {
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void flush();
    }, AUTOSAVE_DELAY_MS);
  });

  const applyDocumentChange = useEffectEvent((next: TexDocumentPayload) => {
    const current = snapshotRef.current;
    if (!current) return;
    const nextSnapshot: TexSessionSnapshot = { ...current, ...next, dirty: true };
    snapshotRef.current = nextSnapshot;
    pendingRef.current = next;
    setError(null);
    onSnapshot(nextSnapshot);
    scheduleFlush();
  });

  const save = useEffectEvent(async () => {
    const desktop = window.texDesktop;
    if (!desktop || !snapshotRef.current || status === "saving") return;
    try {
      clearTimer();
      await flush();
      const base = ackedRef.current;
      if (!base) return;
      setStatus("saving");
      const saved = await desktop.saveSession(base.sessionId);
      ackedRef.current = saved;
      snapshotRef.current = saved;
      onSnapshot(saved);
      setError(null);
      setStatus("idle");
    } catch (err) {
      setError(formatError(err));
      setStatus("idle");
    }
  });

  const flushNow = useEffectEvent(async () => {
    clearTimer();
    await flush();
  });

  return {
    status,
    error,
    setError,
    resetTo,
    applyDocumentChange,
    save,
    flushNow
  };
}
