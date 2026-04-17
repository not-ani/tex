import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "tex:recent-files";
const MAX_ENTRIES = 12;

export interface RecentFile {
  path: string;
  name: string;
  lastOpenedAt: number;
}

const read = (): RecentFile[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((e) => e?.path && e?.name) : [];
  } catch {
    return [];
  }
};

const write = (entries: RecentFile[]) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
};

export function useRecentFiles() {
  const [files, setFiles] = useState<RecentFile[]>(() => read());

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setFiles(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const touch = useCallback((path: string, name: string) => {
    setFiles((prev) => {
      const next = [
        { path, name, lastOpenedAt: Date.now() },
        ...prev.filter((e) => e.path !== path)
      ].slice(0, MAX_ENTRIES);
      write(next);
      return next;
    });
  }, []);

  const remove = useCallback((path: string) => {
    setFiles((prev) => {
      const next = prev.filter((e) => e.path !== path);
      write(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    write([]);
    setFiles([]);
  }, []);

  return { files, touch, remove, clear };
}
