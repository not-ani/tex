import { FilePlus2, FileText, FolderOpen, Settings as SettingsIcon, Trash2 } from "lucide-react";
import type { RecentFile } from "~/lib/recent";

interface Props {
  recent: RecentFile[];
  onOpen: () => void;
  onCreate: () => void;
  onOpenRecent: (path: string) => void;
  onRemoveRecent: (path: string) => void;
  onOpenSettings: () => void;
  desktopReady: boolean;
}

const relativeTime = (ts: number) => {
  const diff = Date.now() - ts;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
};

const shortenPath = (path: string) => {
  const parts = path.split(/[/\\]/);
  if (parts.length <= 3) return path;
  return `…/${parts.slice(-3).join("/")}`;
};

export function HomeView({
  recent,
  onOpen,
  onCreate,
  onOpenRecent,
  onRemoveRecent,
  onOpenSettings,
  desktopReady
}: Props) {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between px-8 py-5">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-xl tracking-tight">Tex</span>
          <span className="text-xs text-muted-foreground">Writing workspace</span>
        </div>
        <button
          onClick={onOpenSettings}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
          aria-label="Settings"
        >
          <SettingsIcon className="size-4" />
        </button>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-8 pb-16">
        <div className="pt-12 pb-8">
          <h1 className="font-serif text-4xl tracking-tight">Good to see you.</h1>
          <p className="mt-2 text-sm text-muted-foreground">Pick up where you left off, or start something new.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onCreate}
            disabled={!desktopReady}
            className="group flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-5 text-left transition hover:border-foreground/30 hover:bg-accent disabled:opacity-40"
          >
            <FilePlus2 className="size-5 text-muted-foreground transition group-hover:text-foreground" />
            <div>
              <div className="text-sm font-medium">New document</div>
              <div className="text-xs text-muted-foreground">Start a blank draft</div>
            </div>
          </button>
          <button
            onClick={onOpen}
            disabled={!desktopReady}
            className="group flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-5 text-left transition hover:border-foreground/30 hover:bg-accent disabled:opacity-40"
          >
            <FolderOpen className="size-5 text-muted-foreground transition group-hover:text-foreground" />
            <div>
              <div className="text-sm font-medium">Open document</div>
              <div className="text-xs text-muted-foreground">Browse for a .docx file</div>
            </div>
          </button>
        </div>

        <div className="mt-12">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-xs font-medium tracking-wide uppercase text-muted-foreground">Recent</h2>
            {recent.length > 0 ? (
              <span className="text-xs text-muted-foreground">{recent.length}</span>
            ) : null}
          </div>

          {recent.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              Nothing opened yet.
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {recent.map((file) => (
                <li key={file.path} className="group flex items-center gap-3 bg-card px-4 py-3 transition hover:bg-accent">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <button onClick={() => onOpenRecent(file.path)} className="flex-1 text-left">
                    <div className="truncate text-sm font-medium">{file.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{shortenPath(file.path)}</div>
                  </button>
                  <span className="text-xs text-muted-foreground tabular-nums">{relativeTime(file.lastOpenedAt)}</span>
                  <button
                    onClick={() => onRemoveRecent(file.path)}
                    className="flex size-7 items-center justify-center rounded text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-background hover:text-foreground"
                    aria-label="Remove from recent"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!desktopReady ? (
          <p className="mt-8 text-center text-xs text-muted-foreground">
            Running outside Electron — file actions are unavailable.
          </p>
        ) : null}
      </main>
    </div>
  );
}
