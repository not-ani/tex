import {
  createEditorState,
  pmDocToTexBlocks,
  texBlocksToPmDoc,
  texEditorSchema,
  type TexDocumentPayload,
  type TexSessionSnapshot
} from "@tex/editor";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { selectionForNextDoc } from "./selection";

type CreateDocumentEditorViewOptions = {
  host: HTMLDivElement;
  getDocumentSnapshot: () => TexSessionSnapshot;
  stickyHighlightMode: () => boolean;
  onSave: () => void | Promise<void>;
  onDocumentChange: (next: TexDocumentPayload) => void;
  onActiveBlockIndexChange: (blockIndex: number | null) => void;
  onRevision: () => void;
  runFunctionKey: (key: string) => boolean;
};

export const activeBlockIndexFromSelection = (state: EditorState) => state.selection.$from.index(0);

export const publishActiveBlockIndex = (
  state: EditorState,
  onActiveBlockIndexChange: (blockIndex: number | null) => void
) => {
  onActiveBlockIndexChange(activeBlockIndexFromSelection(state));
};

export const createDocumentEditorView = ({
  host,
  getDocumentSnapshot,
  stickyHighlightMode,
  onSave,
  onDocumentChange,
  onActiveBlockIndexChange,
  onRevision,
  runFunctionKey
}: CreateDocumentEditorViewOptions) => {
  const currentDocument = getDocumentSnapshot();
  const spellcheckLanguage = navigator.language || "en-US";
  const view = new EditorView(host, {
    state: createEditorState(currentDocument, onSave, runFunctionKey, stickyHighlightMode),
    attributes: {
      spellcheck: "true",
      lang: spellcheckLanguage,
      autocorrect: "on",
      autocapitalize: "sentences"
    },
    dispatchTransaction(transaction) {
      const nextState = view.state.apply(transaction);
      view.updateState(nextState);
      onRevision();
      publishActiveBlockIndex(nextState, onActiveBlockIndexChange);

      if (!transaction.docChanged) {
        return;
      }

      const snapshot = getDocumentSnapshot();
      onDocumentChange({
        filePath: snapshot.filePath,
        fileName: snapshot.fileName,
        paragraphCount: nextState.doc.childCount,
        blocks: pmDocToTexBlocks(nextState.doc)
      });
    }
  });

  view.dom.spellcheck = true;
  view.dom.setAttribute("lang", spellcheckLanguage);
  view.dom.setAttribute("autocorrect", "on");
  view.dom.setAttribute("autocapitalize", "sentences");
  publishActiveBlockIndex(view.state, onActiveBlockIndexChange);
  return view;
};

export const refreshDocumentEditorView = (
  view: EditorView,
  nextDocument: TexSessionSnapshot,
  onRevision: () => void,
  onActiveBlockIndexChange: (blockIndex: number | null) => void,
  options?: { preserveSelection: boolean }
) => {
  const previousSelection = view.state.selection;
  const nextDoc = texBlocksToPmDoc(nextDocument.blocks);
  let nextState = EditorState.create({
    schema: texEditorSchema,
    doc: nextDoc,
    plugins: view.state.plugins
  });

  if (options?.preserveSelection) {
    nextState = nextState.apply(
      nextState.tr.setSelection(selectionForNextDoc(nextState.doc, previousSelection))
    );
  }

  view.updateState(nextState);
  onRevision();
  publishActiveBlockIndex(nextState, onActiveBlockIndexChange);
};
