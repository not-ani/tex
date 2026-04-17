import { Mark, Node as PMNode } from "prosemirror-model";
import type { TexBlock, TexTextRun } from "../types/document";
import { texEditorSchema } from "./base-schema";

const sameFormatting = (left: TexTextRun, right: TexTextRun) =>
  left.bold === right.bold &&
  left.italic === right.italic &&
  left.underline === right.underline &&
  left.smallCaps === right.smallCaps &&
  left.highlightColor === right.highlightColor &&
  left.styleId === right.styleId &&
  left.styleName === right.styleName &&
  left.isF8Cite === right.isF8Cite;

const buildMarks = (run: TexTextRun) => {
  const schema = texEditorSchema;
  const result: Mark[] = [];

  if (run.bold) {
    result.push(schema.marks.strong.create());
  }
  if (run.italic) {
    result.push(schema.marks.em.create());
  }
  if (run.underline) {
    result.push(schema.marks.underline.create());
  }
  if (run.isF8Cite) {
    result.push(
      schema.marks.cite.create({
        styleId: run.styleId ?? "Cite",
        styleName: run.styleName ?? "Cite"
      })
    );
  }
  if (run.highlightColor) {
    result.push(schema.marks.highlight.create({ color: run.highlightColor }));
  }

  return result;
};

const appendTextNode = (children: PMNode[], text: string, marksForRun: Mark[]) => {
  if (!text) {
    return;
  }

  children.push(texEditorSchema.text(text, marksForRun));
};

const runToChildren = (run: TexTextRun) => {
  const children: PMNode[] = [];
  const parts = run.text.split("\n");
  const marksForRun = buildMarks(run);

  parts.forEach((part, index) => {
    appendTextNode(children, part, marksForRun);
    if (index < parts.length - 1) {
      children.push(texEditorSchema.nodes.hard_break.create());
    }
  });

  return children;
};

export const texBlocksToPmDoc = (blocks: TexBlock[]) => {
  const normalizedBlocks =
    blocks.length > 0
      ? blocks
      : [
          {
            id: "empty-1",
            kind: "paragraph",
            text: "",
            runs: [],
            level: null,
            styleId: "Normal",
            styleName: "Normal",
            isF8Cite: false
          } satisfies TexBlock
        ];

  return texEditorSchema.nodes.doc.create(
    null,
    normalizedBlocks.map((block) => {
      const content = block.runs.flatMap(runToChildren);

      if (block.kind === "heading") {
        return texEditorSchema.nodes.heading.create(
          {
            level: block.level ?? 1,
            styleId: block.styleId ?? `Heading${block.level ?? 1}`,
            styleName: block.styleName ?? `Heading ${block.level ?? 1}`,
            isF8Cite: block.isF8Cite
          },
          content
        );
      }

      return texEditorSchema.nodes.paragraph.create(
        {
          styleId: block.styleId ?? "Normal",
          styleName: block.styleName ?? "Normal",
          isF8Cite: block.isF8Cite
        },
        content
      );
    })
  );
};

const blockRunFromMarks = (text: string, marksForNode: readonly Mark[]): TexTextRun => {
  const highlightMark = marksForNode.find((mark) => mark.type.name === "highlight");
  const citeMark = marksForNode.find((mark) => mark.type.name === "cite");

  return {
    text,
    bold: marksForNode.some((mark) => mark.type.name === "strong"),
    italic: marksForNode.some((mark) => mark.type.name === "em"),
    underline: marksForNode.some((mark) => mark.type.name === "underline"),
    smallCaps: false,
    highlightColor: typeof highlightMark?.attrs.color === "string" ? highlightMark.attrs.color : null,
    styleId: typeof citeMark?.attrs.styleId === "string" ? citeMark.attrs.styleId : null,
    styleName: typeof citeMark?.attrs.styleName === "string" ? citeMark.attrs.styleName : null,
    isF8Cite: Boolean(citeMark)
  };
};

const pushRun = (runs: TexTextRun[], nextRun: TexTextRun) => {
  if (!nextRun.text) {
    return;
  }

  const previous = runs[runs.length - 1];
  if (previous && sameFormatting(previous, nextRun)) {
    previous.text += nextRun.text;
    return;
  }

  runs.push(nextRun);
};

export const pmDocToTexBlocks = (doc: PMNode): TexBlock[] => {
  const blocks: TexBlock[] = [];

  doc.forEach((blockNode, offset, index) => {
    const runs: TexTextRun[] = [];

    blockNode.forEach((child) => {
      if (child.isText) {
        pushRun(runs, blockRunFromMarks(child.text ?? "", child.marks));
        return;
      }

      if (child.type.name === "hard_break") {
        if (runs.length === 0) {
          runs.push({
            text: "\n",
            bold: false,
            italic: false,
            underline: false,
            smallCaps: false,
            highlightColor: null,
            styleId: null,
            styleName: null,
            isF8Cite: false
          });
          return;
        }

        runs[runs.length - 1]!.text += "\n";
      }
    });

    const text = runs.map((run) => run.text).join("");
    const isHeading = blockNode.type.name === "heading";
    const level = isHeading ? Number(blockNode.attrs.level ?? 1) : null;

    blocks.push({
      id: `pm-${index}-${offset}`,
      kind: isHeading ? "heading" : "paragraph",
      text,
      runs,
      level,
      styleId:
        typeof blockNode.attrs.styleId === "string" && blockNode.attrs.styleId.length > 0
          ? blockNode.attrs.styleId
          : isHeading
            ? `Heading${level ?? 1}`
            : "Normal",
      styleName:
        typeof blockNode.attrs.styleName === "string" && blockNode.attrs.styleName.length > 0
          ? blockNode.attrs.styleName
          : isHeading
            ? `Heading ${level ?? 1}`
            : "Normal",
      isF8Cite: Boolean(blockNode.attrs.isF8Cite)
    });
  });

  return blocks;
};
