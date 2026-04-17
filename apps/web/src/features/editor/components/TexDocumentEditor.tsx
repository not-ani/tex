import {
  getStoredMarksWithoutStickyHighlight,
  pmDocToTexBlocks,
  scrollToBlock,
  STICKY_HIGHLIGHT_CLEAR_META,
  type TexDocumentPayload,
  type TexSessionSnapshot
} from "@tex/editor";
import { useEffect, useEffectEvent, useRef, useState, type CSSProperties } from "react";
import type { EditorView } from "prosemirror-view";
import { blocksEqualIgnoringIds } from "../lib/compare";
import { bindEditorInteractions } from "../lib/interactions";
import { startMarginDrag } from "../lib/margin-drag";
import { persistEditorZoom, applyZoomToPage, getInitialEditorZoom, KEYBOARD_ZOOM_STEP_VALUE, type ZoomFocusPoint } from "../lib/zoom";
import { createDocumentEditorView, refreshDocumentEditorView } from "../lib/view-state";

type TexDocumentEditorProps = {
  document: TexSessionSnapshot;
  saving: boolean;
  stickyHighlightMode: boolean;
  scrollToBlockIndex?: number | null;
  onDocumentChange: (next: TexDocumentPayload) => void;
  onActiveBlockIndexChange: (blockIndex: number | null) => void;
  onSave: () => void | Promise<void>;
  onViewReady?: (view: EditorView | null) => void;
  onRevision?: () => void;
};

export function TexDocumentEditor({
  document,
  stickyHighlightMode,
  scrollToBlockIndex = null,
  onDocumentChange,
  onActiveBlockIndexChange,
  onSave,
  onViewReady,
  onRevision
}: TexDocumentEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const documentRef = useRef(document);
  const loadedSessionKeyRef = useRef(`${document.sessionId}:${document.version}`);
  const [draggingMargin, setDraggingMargin] = useState(false);
  const [zoom, setZoom] = useState(() => getInitialEditorZoom());

  documentRef.current = document;

  const handleRevision = useEffectEvent(() => {
    onRevision?.();
  });

  const handleDocumentChange = useEffectEvent((nextDocument: TexDocumentPayload) => {
    onDocumentChange(nextDocument);
  });

  const handleActiveBlockIndexChange = useEffectEvent((blockIndex: number | null) => {
    onActiveBlockIndexChange(blockIndex);
  });

  const handleSave = useEffectEvent(() => onSave());

  const handleViewReady = useEffectEvent((view: EditorView | null) => {
    onViewReady?.(view);
  });

  const runFunctionKey = useEffectEvent((_key: string) => false);
  const isStickyHighlightEnabled = useEffectEvent(() => stickyHighlightMode);
  const getZoom = useEffectEvent(() => zoom);

  const applyZoom = useEffectEvent((nextZoom: number, focusPoint?: ZoomFocusPoint) => {
    applyZoomToPage(pageRef.current, zoom, setZoom, nextZoom, focusPoint);
  });

  const stepZoom = useEffectEvent((direction: 1 | -1, focusPoint?: ZoomFocusPoint) => {
    applyZoom(zoom + KEYBOARD_ZOOM_STEP_VALUE * direction, focusPoint);
  });

  useEffect(() => {
    persistEditorZoom(zoom);
  }, [zoom]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const view = createDocumentEditorView({
      host,
      getDocumentSnapshot: () => documentRef.current,
      stickyHighlightMode: isStickyHighlightEnabled,
      onSave: handleSave,
      onDocumentChange: handleDocumentChange,
      onActiveBlockIndexChange: handleActiveBlockIndexChange,
      onRevision: handleRevision,
      runFunctionKey
    });

    viewRef.current = view;
    handleViewReady(view);

    return () => {
      viewRef.current = null;
      handleViewReady(null);
      view.destroy();
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    const page = pageRef.current;
    if (!host || !page) {
      return;
    }

    return bindEditorInteractions({
      host,
      editorPage: page,
      getZoom,
      applyZoom,
      stepZoom,
      runFunctionKey
    });
  }, []);

  useEffect(() => {
    const current = viewRef.current;
    if (!current) {
      return;
    }

    const nextSessionKey = `${document.sessionId}:${document.version}`;
    if (nextSessionKey === loadedSessionKeyRef.current) {
      return;
    }

    const currentBlocks = pmDocToTexBlocks(current.state.doc);
    if (blocksEqualIgnoringIds(currentBlocks, document.blocks)) {
      loadedSessionKeyRef.current = nextSessionKey;
      return;
    }

    const loadedSessionId = loadedSessionKeyRef.current.split(":")[0] ?? "";
    refreshDocumentEditorView(current, document, handleRevision, handleActiveBlockIndexChange, {
      preserveSelection: loadedSessionId === document.sessionId
    });
    loadedSessionKeyRef.current = nextSessionKey;
  }, [document, handleActiveBlockIndexChange, handleRevision]);

  useEffect(() => {
    const current = viewRef.current;
    if (!current || stickyHighlightMode) {
      return;
    }

    const clearedStoredMarks = getStoredMarksWithoutStickyHighlight(current.state);
    if (clearedStoredMarks) {
      current.dispatch(
        current.state.tr
          .setStoredMarks(clearedStoredMarks)
          .setMeta(STICKY_HIGHLIGHT_CLEAR_META, true)
      );
    }
  }, [stickyHighlightMode]);

  useEffect(() => {
    const current = viewRef.current;
    if (!current || scrollToBlockIndex == null) {
      return;
    }

    scrollToBlock(current, scrollToBlockIndex);
  }, [scrollToBlockIndex]);

  return (
    <div
      className="tex-editor-page"
      ref={pageRef}
      style={{ "--editor-zoom": String(zoom) } as CSSProperties}
    >
      <div
        className={`tex-editor-margin-handle tex-editor-margin-handle--left${draggingMargin ? " dragging" : ""}`}
        onMouseDown={(event) => {
          const page = pageRef.current;
          if (!page) {
            return;
          }

          startMarginDrag("left", event.nativeEvent, page, setDraggingMargin);
        }}
      />
      <div
        className={`tex-editor-margin-handle tex-editor-margin-handle--right${draggingMargin ? " dragging" : ""}`}
        onMouseDown={(event) => {
          const page = pageRef.current;
          if (!page) {
            return;
          }

          startMarginDrag("right", event.nativeEvent, page, setDraggingMargin);
        }}
      />
      <div className="tex-editor-surface" ref={hostRef} />
    </div>
  );
}
