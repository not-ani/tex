export * from "./types/document";
export { texEditorSchema } from "./prosemirror/base-schema";
export { pmDocToTexBlocks, texBlocksToPmDoc } from "./prosemirror/convert";
export {
  createStickyHighlightMark,
  getStoredMarksWithoutStickyHighlight,
  getStickyHighlightSelectionAction,
  isStickyHighlightMark,
  STICKY_HIGHLIGHT_AUTO_APPLY_META,
  STICKY_HIGHLIGHT_CLEAR_META,
  STICKY_HIGHLIGHT_COLOR,
  STICKY_HIGHLIGHT_TRIGGER_META
} from "./prosemirror/sticky-highlight";
export { createEditorState, scrollToBlock } from "./prosemirror/state";
export {
  clearToNormal,
  isCiteActive,
  isHeadingActive,
  isMarkActive,
  setHeadingLevel,
  toggleCiteStyle,
  toggleHighlight,
  toggleItalic,
  toggleStrong,
  toggleUnderlineStyle
} from "./prosemirror/formatting";
