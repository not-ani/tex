import { EditorState, Selection, TextSelection } from "prosemirror-state";

const clampDocPosition = (doc: EditorState["doc"], position: number) =>
  Math.max(0, Math.min(position, doc.content.size));

export const selectionForNextDoc = (doc: EditorState["doc"], previousSelection: Selection) => {
  const anchor = clampDocPosition(doc, previousSelection.anchor);
  const head = clampDocPosition(doc, previousSelection.head);

  if (previousSelection.empty) {
    return Selection.near(doc.resolve(anchor), 1);
  }

  try {
    return TextSelection.between(doc.resolve(anchor), doc.resolve(head), 1);
  } catch {
    return Selection.near(doc.resolve(anchor), 1);
  }
};
