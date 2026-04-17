import type { TexSessionSnapshot } from "@tex/editor";

const runsEqual = (
  left: TexSessionSnapshot["blocks"][number]["runs"][number],
  right: TexSessionSnapshot["blocks"][number]["runs"][number]
) =>
  left.text === right.text &&
  left.bold === right.bold &&
  left.italic === right.italic &&
  left.underline === right.underline &&
  left.smallCaps === right.smallCaps &&
  left.highlightColor === right.highlightColor &&
  left.styleId === right.styleId &&
  left.styleName === right.styleName &&
  left.isF8Cite === right.isF8Cite;

export const blocksEqualIgnoringIds = (
  left: TexSessionSnapshot["blocks"],
  right: TexSessionSnapshot["blocks"]
) => {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((leftBlock, index) => {
    const rightBlock = right[index];
    if (!rightBlock) {
      return false;
    }

    if (
      leftBlock.kind !== rightBlock.kind ||
      leftBlock.text !== rightBlock.text ||
      leftBlock.level !== rightBlock.level ||
      leftBlock.styleId !== rightBlock.styleId ||
      leftBlock.styleName !== rightBlock.styleName ||
      leftBlock.isF8Cite !== rightBlock.isF8Cite ||
      leftBlock.runs.length !== rightBlock.runs.length
    ) {
      return false;
    }

    return leftBlock.runs.every((leftRun, runIndex) => {
      const rightRun = rightBlock.runs[runIndex];
      return !!rightRun && runsEqual(leftRun, rightRun);
    });
  });
};
