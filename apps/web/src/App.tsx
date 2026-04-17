import { useCallback, useEffect, useState } from "react";
import type { TexSessionSnapshot } from "@tex/editor";
import { useTheme } from "~/lib/theme";
import { useRecentFiles } from "~/lib/recent";
import { HomeView } from "~/views/HomeView";
import { SettingsView } from "~/views/SettingsView";
import { EditorView } from "~/views/EditorView";

type View = "home" | "editor" | "settings";

export interface Tab {
  sessionId: string;
  path: string;
  name: string;
  snapshot: TexSessionSnapshot;
}

const getDesktop = () => window.texDesktop ?? null;
const formatError = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong.");

export function App() {
  const desktop = getDesktop();
  const desktopReady = Boolean(desktop);

  const { theme, setTheme } = useTheme();
  const { files: recent, touch: touchRecent, remove: removeRecent } = useRecentFiles();

  const [view, setView] = useState<View>("home");
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const pushTab = useCallback(
    (snapshot: TexSessionSnapshot, path: string) => {
      setTabs((prev) => {
        const existing = prev.find((t) => t.sessionId === snapshot.sessionId);
        if (existing) {
          return prev.map((t) => (t.sessionId === snapshot.sessionId ? { ...t, snapshot, path } : t));
        }
        return [...prev, { sessionId: snapshot.sessionId, path, name: snapshot.fileName, snapshot }];
      });
      setActiveTabId(snapshot.sessionId);
      setView("editor");
      touchRecent(path, snapshot.fileName);
    },
    [touchRecent]
  );

  const handleCreate = useCallback(async () => {
    if (!desktop) return;
    try {
      const path = await desktop.pickCreateDocument("speech.docx");
      if (!path) return;
      const result = await desktop.createSessionAtPath(path);
      if (result.kind !== "opened") {
        setToast(`'${result.fileName}' is already attached elsewhere.`);
        return;
      }
      pushTab(result.snapshot, path);
    } catch (err) {
      setToast(formatError(err));
    }
  }, [desktop, pushTab]);

  const handleOpen = useCallback(async () => {
    if (!desktop) return;
    try {
      const path = await desktop.pickOpenDocument();
      if (!path) return;
      const result = await desktop.openSessionFromFile(path);
      if (result.kind !== "opened") {
        setToast(`'${result.fileName}' is already attached elsewhere.`);
        return;
      }
      pushTab(result.snapshot, path);
    } catch (err) {
      setToast(formatError(err));
    }
  }, [desktop, pushTab]);

  const handleOpenRecent = useCallback(
    async (path: string) => {
      if (!desktop) return;
      const existing = tabs.find((t) => t.path === path);
      if (existing) {
        setActiveTabId(existing.sessionId);
        setView("editor");
        return;
      }
      try {
        const result = await desktop.openSessionFromFile(path);
        if (result.kind !== "opened") {
          setToast(`'${result.fileName}' is already attached elsewhere.`);
          return;
        }
        pushTab(result.snapshot, path);
      } catch (err) {
        setToast(formatError(err));
        removeRecent(path);
      }
    },
    [desktop, pushTab, removeRecent, tabs]
  );

  const handleActivateTab = useCallback((id: string) => {
    setActiveTabId(id);
  }, []);

  const handleCloseTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        const next = prev.filter((t) => t.sessionId !== id);
        if (activeTabId === id) {
          const fallback = next[next.length - 1];
          setActiveTabId(fallback ? fallback.sessionId : null);
          if (!fallback) setView("home");
        }
        return next;
      });
    },
    [activeTabId]
  );

  const handleUpdateSnapshot = useCallback((id: string, next: TexSessionSnapshot) => {
    setTabs((prev) =>
      prev.map((t) => (t.sessionId === id ? { ...t, snapshot: next, name: next.fileName } : t))
    );
  }, []);

  const handleGoHome = useCallback(async () => {
    setView("home");
  }, []);

  return (
    <div className="h-full w-full">
      {view === "home" ? (
        <HomeView
          recent={recent}
          desktopReady={desktopReady}
          onOpen={handleOpen}
          onCreate={handleCreate}
          onOpenRecent={handleOpenRecent}
          onRemoveRecent={removeRecent}
          onOpenSettings={() => setView("settings")}
        />
      ) : view === "settings" ? (
        <SettingsView
          theme={theme}
          onThemeChange={setTheme}
          desktopReady={desktopReady}
          onBack={() => setView(tabs.length > 0 ? "editor" : "home")}
        />
      ) : (
        <EditorView
          tabs={tabs}
          activeTabId={activeTabId}
          desktopReady={desktopReady}
          onActivateTab={handleActivateTab}
          onCloseTab={handleCloseTab}
          onUpdateSnapshot={handleUpdateSnapshot}
          onCreate={handleCreate}
          onOpen={handleOpen}
          onGoHome={handleGoHome}
        />
      )}

      {toast ? (
        <div className="pointer-events-none fixed bottom-4 left-1/2 -translate-x-1/2">
          <div className="rounded-md border border-border bg-card px-3 py-2 text-sm shadow-lg">{toast}</div>
        </div>
      ) : null}
    </div>
  );
}
