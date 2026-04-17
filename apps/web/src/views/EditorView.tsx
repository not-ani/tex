import {
  clearToNormal,
  isCiteActive,
  isHeadingActive,
  isMarkActive,
  setHeadingLevel,
  toggleCiteStyle,
  toggleHighlight,
  toggleItalic,
  toggleStrong,
  toggleUnderlineStyle,
  type TexSessionSnapshot
} from "@tex/editor";
import {
  Bold,
  FilePlus2,
  FolderOpen,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Highlighter,
  Home as HomeIcon,
  Italic,
  Pilcrow,
  Plus,
  Quote,
  Save,
  Underline,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { EditorView as PmEditorView } from "prosemirror-view";
import { TexDocumentEditor } from "~/features/editor/components/TexDocumentEditor";
import { useTexSession } from "~/features/editor/useTexSession";
import type { Tab } from "~/App";

interface Props {
  tabs: Tab[];
  activeTabId: string | null;
  onActivateTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onUpdateSnapshot: (id: string, next: TexSessionSnapshot) => void;
  onCreate: () => void;
  onOpen: () => void;
  onGoHome: () => Promise<void>;
  desktopReady: boolean;
}

const statusLabel = (status: "idle" | "syncing" | "saving", dirty: boolean) => {
  if (status === "saving") return "Saving";
  if (status === "syncing") return "Syncing";
  return dirty ? "Unsaved" : "Saved";
};

export function EditorView({
  tabs,
  activeTabId,
  onActivateTab,
  onCloseTab,
  onUpdateSnapshot,
  onCreate,
  onOpen,
  onGoHome,
  desktopReady
}: Props) {
  const activeTab = tabs.find((t) => t.sessionId === activeTabId) ?? null;
  const [pmView, setPmView] = useState<PmEditorView | null>(null);
  const [stickyHighlight, setStickyHighlight] = useState(false);
  const [activeBlockIndex, setActiveBlockIndex] = useState<number | null>(null);
  const [scrollTargetIndex, setScrollTargetIndex] = useState<number | null>(null);

  const snapshot = activeTab?.snapshot ?? null;

  // Route snapshot updates by sessionId so in-flight flushes after a tab switch
  // still land on the correct tab.
  const session = useTexSession(snapshot, (next) => {
    onUpdateSnapshot(next.sessionId, next);
  });

  // When switching tabs, flush any pending edits on the outgoing tab first,
  // then reset autosave state for the incoming tab.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await session.flushNow();
      if (cancelled) return;
      session.resetTo(snapshot);
      setActiveBlockIndex(null);
      setScrollTargetIndex(null);
      setPmView(null);
    })();
    return () => { cancelled = true; };
  }, [activeTabId]); // eslint-disable-line react-hooks/exhaustive-deps

  const headings = useMemo(() => {
    if (!snapshot) return [] as { index: number; level: number; text: string }[];
    const out: { index: number; level: number; text: string }[] = [];
    snapshot.blocks.forEach((block, idx) => {
      if (block.kind === "heading") {
        const text = block.text.trim();
        out.push({ index: idx, level: block.level ?? 1, text: text || "Untitled heading" });
      }
    });
    return out;
  }, [snapshot]);

  const run = (fn: (view: PmEditorView) => void) => {
    if (!pmView) return;
    fn(pmView);
    pmView.focus();
  };

  const canFormat = Boolean(pmView);
  const isBusy = session.status !== "idle";
  const dirty = snapshot?.dirty ?? false;

  const fmtBtn = (active: boolean) =>
    `flex size-8 items-center justify-center rounded-md transition disabled:opacity-40 ${
      active
        ? "bg-foreground text-background"
        : "text-muted-foreground hover:bg-accent hover:text-foreground"
    }`;

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border bg-sidebar px-2 pt-2">
        <button
          onClick={() => { void onGoHome(); }}
          className="mr-1 flex size-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
          aria-label="Home"
        >
          <HomeIcon className="size-4" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          {tabs.map((tab) => {
            const active = tab.sessionId === activeTabId;
            return (
              <div
                key={tab.sessionId}
                className={`group flex min-w-0 max-w-56 shrink-0 items-center gap-2 rounded-t-md border-b-2 px-3 py-1.5 text-sm transition ${
                  active
                    ? "border-foreground bg-background text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                }`}
              >
                <button onClick={() => onActivateTab(tab.sessionId)} className="min-w-0 flex-1 truncate text-left">
                  {tab.name}
                  {tab.snapshot.dirty ? <span className="ml-1 text-muted-foreground">•</span> : null}
                </button>
                <button
                  onClick={() => onCloseTab(tab.sessionId)}
                  className="flex size-4 items-center justify-center rounded-sm text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-foreground/10 hover:text-foreground"
                  aria-label="Close tab"
                >
                  <X className="size-3" />
                </button>
              </div>
            );
          })}
          <button
            onClick={onCreate}
            disabled={!desktopReady || isBusy}
            className="ml-1 flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-40"
            aria-label="New document"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>

      {/* Function bar */}
      <div className="flex items-center gap-4 border-b border-border bg-background px-3 py-1.5">
        <div className="flex items-center gap-0.5">
          <button
            onClick={onCreate}
            disabled={!desktopReady || isBusy}
            className={fmtBtn(false)}
            aria-label="New"
            title="New"
          >
            <FilePlus2 className="size-4" />
          </button>
          <button
            onClick={onOpen}
            disabled={!desktopReady || isBusy}
            className={fmtBtn(false)}
            aria-label="Open"
            title="Open"
          >
            <FolderOpen className="size-4" />
          </button>
          <button
            onClick={() => { void session.save(); }}
            disabled={!snapshot || session.status === "saving"}
            className={fmtBtn(false)}
            aria-label="Save"
            title="Save"
          >
            <Save className="size-4" />
          </button>
        </div>

        <div className="h-5 w-px bg-border" />

        <div className="flex items-center gap-0.5">
          <button disabled={!canFormat} onClick={() => run(toggleStrong)} className={fmtBtn(Boolean(pmView && isMarkActive(pmView, "strong")))} title="Bold">
            <Bold className="size-4" />
          </button>
          <button disabled={!canFormat} onClick={() => run(toggleItalic)} className={fmtBtn(Boolean(pmView && isMarkActive(pmView, "em")))} title="Italic">
            <Italic className="size-4" />
          </button>
          <button disabled={!canFormat} onClick={() => run(toggleUnderlineStyle)} className={fmtBtn(Boolean(pmView && isMarkActive(pmView, "underline")))} title="Underline">
            <Underline className="size-4" />
          </button>
          <button disabled={!canFormat} onClick={() => run(toggleHighlight)} className={fmtBtn(Boolean(pmView && isMarkActive(pmView, "highlight")))} title="Highlight">
            <Highlighter className="size-4" />
          </button>
          <button disabled={!canFormat} onClick={() => run(toggleCiteStyle)} className={fmtBtn(Boolean(pmView && isCiteActive(pmView)))} title="Cite">
            <Quote className="size-4" />
          </button>
        </div>

        <div className="h-5 w-px bg-border" />

        <div className="flex items-center gap-0.5">
          <button disabled={!canFormat} onClick={() => run((v) => setHeadingLevel(v, 1))} className={fmtBtn(Boolean(pmView && isHeadingActive(pmView, 1)))} title="Heading 1">
            <Heading1 className="size-4" />
          </button>
          <button disabled={!canFormat} onClick={() => run((v) => setHeadingLevel(v, 2))} className={fmtBtn(Boolean(pmView && isHeadingActive(pmView, 2)))} title="Heading 2">
            <Heading2 className="size-4" />
          </button>
          <button disabled={!canFormat} onClick={() => run((v) => setHeadingLevel(v, 3))} className={fmtBtn(Boolean(pmView && isHeadingActive(pmView, 3)))} title="Heading 3">
            <Heading3 className="size-4" />
          </button>
          <button disabled={!canFormat} onClick={() => run((v) => setHeadingLevel(v, 4))} className={fmtBtn(Boolean(pmView && isHeadingActive(pmView, 4)))} title="Heading 4">
            <Heading4 className="size-4" />
          </button>
          <button disabled={!canFormat} onClick={() => run(clearToNormal)} className={fmtBtn(false)} title="Paragraph">
            <Pilcrow className="size-4" />
          </button>
        </div>

        <div className="h-5 w-px bg-border" />

        <button
          onClick={() => setStickyHighlight((v) => !v)}
          disabled={!snapshot}
          className={`rounded-md px-2.5 py-1 text-xs transition disabled:opacity-40 ${
            stickyHighlight
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          Sticky highlight
        </button>

        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          {session.error ? (
            <span className="text-destructive">{session.error}</span>
          ) : (
            <>
              {snapshot ? <span className="truncate max-w-xs">{snapshot.fileName}</span> : null}
              <span>{snapshot ? statusLabel(session.status, dirty) : ""}</span>
            </>
          )}
        </div>
      </div>

      {/* Body: ribbon + editor */}
      <div className="flex min-h-0 flex-1">
        {/* Ribbon / outline */}
        <aside className="w-56 shrink-0 overflow-y-auto border-r border-border bg-sidebar px-3 py-4">
          <div className="mb-2 px-2 text-xs font-medium tracking-wide uppercase text-muted-foreground">Outline</div>
          {headings.length === 0 ? (
            <div className="px-2 text-xs text-muted-foreground">
              Headings will appear here as you add them.
            </div>
          ) : (
            <ul className="space-y-0.5">
              {headings.map((h) => (
                <li key={h.index}>
                  <button
                    onClick={() => setScrollTargetIndex(h.index)}
                    className={`block w-full truncate rounded-md px-2 py-1 text-left text-sm transition hover:bg-accent hover:text-foreground ${
                      activeBlockIndex === h.index ? "bg-accent text-foreground" : "text-muted-foreground"
                    }`}
                    style={{ paddingLeft: `${0.5 + (h.level - 1) * 0.75}rem` }}
                    title={h.text}
                  >
                    {h.text}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Editor surface */}
        <section className="min-h-0 min-w-0 flex-1">
          {snapshot ? (
            <TexDocumentEditor
              document={snapshot}
              saving={session.status === "saving"}
              stickyHighlightMode={stickyHighlight}
              scrollToBlockIndex={scrollTargetIndex}
              onDocumentChange={session.applyDocumentChange}
              onActiveBlockIndexChange={setActiveBlockIndex}
              onSave={() => { void session.save(); }}
              onViewReady={setPmView}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="max-w-sm text-center">
                <h2 className="font-serif text-2xl tracking-tight">No document open</h2>
                <p className="mt-2 text-sm text-muted-foreground">Create a new draft or open one from disk.</p>
                <div className="mt-5 flex justify-center gap-2">
                  <button
                    onClick={onCreate}
                    disabled={!desktopReady}
                    className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-sm text-background transition hover:bg-foreground/90 disabled:opacity-40"
                  >
                    <FilePlus2 className="size-4" />
                    New
                  </button>
                  <button
                    onClick={onOpen}
                    disabled={!desktopReady}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm transition hover:bg-accent disabled:opacity-40"
                  >
                    <FolderOpen className="size-4" />
                    Open
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
