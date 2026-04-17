import Path from "node:path";
import { promises as Fs } from "node:fs";
import JSZip from "jszip";
import type { TexBlock, TexDocumentPayload, TexTextRun } from "@tex/editor";
import {
  attributeValue,
  childElements,
  descendantElements,
  findFirstChild,
  localNameOf,
  parseXml
} from "./xml";

const normalizeForSearch = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const parseTrailingLevel = (value: string) => {
  const match = /(\d+)\s*$/.exec(value);
  const matchedLevel = match?.[1];
  if (!matchedLevel) {
    return null;
  }

  const level = Number.parseInt(matchedLevel, 10);
  return Number.isFinite(level) && level >= 1 && level <= 9 ? level : null;
};

const containsYearToken = (normalized: string) =>
  normalized
    .split(/\s+/)
    .some((token) => {
      const year = Number.parseInt(token, 10);
      return Number.isFinite(year) && year >= 1900 && year <= 2099;
    });

const isProbableAuthorLine = (text: string) => {
  const normalized = normalizeForSearch(text);
  if (!normalized) {
    return false;
  }

  const wordCount = normalized.split(/\s+/).length;
  if (wordCount < 3 || wordCount > 90 || !containsYearToken(normalized)) {
    return false;
  }

  const commaCount = text.split(",").length - 1;
  const hasSourceMarker =
    normalized.includes("journal") ||
    normalized.includes("university") ||
    normalized.includes("postdoctoral") ||
    normalized.includes("vol ") ||
    normalized.includes("edition") ||
    normalized.includes("press") ||
    normalized.includes("retrieved") ||
    normalized.includes("archive");
  const looksLikeUrlLine = normalized.includes("http") || normalized.includes("doi");

  return (commaCount >= 2 || hasSourceMarker || looksLikeUrlLine) && wordCount >= 5;
};

const isF8CiteStyle = (styleLabel: string) => {
  const normalized = normalizeForSearch(styleLabel);
  return (
    normalized === "cite" ||
    normalized.startsWith("cite ") ||
    normalized.endsWith(" cite") ||
    normalized.includes(" cite ") ||
    normalized.includes("f8 cite") ||
    normalized.includes("f8cite")
  );
};

const readStyleMap = (stylesXml: string | null) => {
  const map = new Map<string, string>();
  if (!stylesXml) {
    return map;
  }

  try {
    const document = parseXml(stylesXml);
    for (const style of descendantElements(document).filter((node) => localNameOf(node) === "style")) {
      const styleId = attributeValue(style, "styleId");
      if (!styleId) {
        continue;
      }

      const nameNode = childElements(style).find((node) => localNameOf(node) === "name") ?? null;
      map.set(styleId, attributeValue(nameNode ?? style, "val") ?? styleId);
    }
  } catch {
    return map;
  }

  return map;
};

const paragraphStyleId = (paragraph: Element) => {
  const props = childElements(paragraph).find((node) => localNameOf(node) === "pPr");
  const styleNode = props ? childElements(props).find((node) => localNameOf(node) === "pStyle") : null;
  return styleNode ? attributeValue(styleNode, "val") : null;
};

const paragraphStyleName = (paragraph: Element, styleMap: Map<string, string>) => {
  const styleId = paragraphStyleId(paragraph);
  if (!styleId) {
    return null;
  }
  return styleMap.get(styleId) ?? styleId;
};

const runStyleId = (run: Element) => {
  const props = childElements(run).find((node) => localNameOf(node) === "rPr");
  const styleNode = props ? childElements(props).find((node) => localNameOf(node) === "rStyle") : null;
  return styleNode ? attributeValue(styleNode, "val") : null;
};

const runStyleName = (run: Element, styleMap: Map<string, string>) => {
  const styleId = runStyleId(run);
  return styleId ? (styleMap.get(styleId) ?? styleId) : null;
};

const runHasProperty = (run: Element, propertyTag: string) => {
  const props = childElements(run).find((node) => localNameOf(node) === "rPr");
  return Boolean(props && childElements(props).some((node) => localNameOf(node) === propertyTag));
};

const runHasActiveUnderline = (run: Element) => {
  const props = childElements(run).find((node) => localNameOf(node) === "rPr");
  const underline = props ? childElements(props).find((node) => localNameOf(node) === "u") : null;
  if (!underline) {
    return false;
  }

  const value = attributeValue(underline, "val");
  if (!value) {
    return true;
  }

  return !["none", "false", "0"].includes(value.toLowerCase());
};

const runHighlightClass = (run: Element) => {
  const props = childElements(run).find((node) => localNameOf(node) === "rPr");
  const highlight = props ? childElements(props).find((node) => localNameOf(node) === "highlight") : null;
  const value = highlight ? attributeValue(highlight, "val")?.trim().toLowerCase() : null;

  switch (value) {
    case "yellow":
    case "darkyellow":
      return "yellow";
    case "green":
    case "darkgreen":
      return "green";
    case "cyan":
    case "darkcyan":
    case "turquoise":
      return "cyan";
    case "magenta":
    case "darkmagenta":
    case "pink":
      return "magenta";
    case "blue":
    case "darkblue":
      return "blue";
    case "gray":
    case "grey":
    case "lightgray":
    case "darkgray":
    case "gray25":
    case "gray50":
      return "gray";
    default:
      return null;
  }
};

const extractParagraphText = (paragraph: Element) => {
  let value = "";

  for (const node of descendantElements(paragraph)) {
    const tag = localNameOf(node);
    if (tag === "t") {
      value += node.textContent ?? "";
    } else if (tag === "tab") {
      value += "\t";
    } else if (tag === "br" || tag === "cr") {
      value += "\n";
    }
  }

  return value;
};

const detectHeadingLevel = (paragraph: Element, styleMap: Map<string, string>) => {
  const props = childElements(paragraph).find((node) => localNameOf(node) === "pPr");
  if (!props) {
    return null;
  }

  const outlineLevel = childElements(props).find((node) => localNameOf(node) === "outlineLvl");
  const outlineValue = outlineLevel ? attributeValue(outlineLevel, "val") : null;
  if (outlineValue) {
    const level = Number.parseInt(outlineValue, 10) + 1;
    if (Number.isFinite(level) && level >= 1 && level <= 9) {
      return level;
    }
  }

  const styleNode = childElements(props).find((node) => localNameOf(node) === "pStyle");
  const styleId = styleNode ? attributeValue(styleNode, "val") : null;
  if (!styleId) {
    return null;
  }

  return parseTrailingLevel(styleId) ?? parseTrailingLevel(styleMap.get(styleId) ?? "");
};

const emptyTextRun = (text: string): TexTextRun => ({
  text,
  bold: false,
  italic: false,
  underline: false,
  smallCaps: false,
  highlightColor: null,
  styleId: null,
  styleName: null,
  isF8Cite: false
});

const paragraphRuns = (paragraph: Element, styleMap: Map<string, string>) => {
  const runs: TexTextRun[] = [];

  const pushRun = (run: Element) => {
    const text = extractParagraphText(run);
    if (!text) {
      return;
    }

    const styleId = runStyleId(run);
    const styleName = runStyleName(run, styleMap);
    const isRunCite =
      (styleId ? isF8CiteStyle(styleId) : false) || (styleName ? isF8CiteStyle(styleName) : false);

    runs.push({
      text,
      bold: runHasProperty(run, "b"),
      italic: runHasProperty(run, "i"),
      underline: runHasActiveUnderline(run),
      smallCaps: runHasProperty(run, "smallCaps") || runHasProperty(run, "caps"),
      highlightColor: runHighlightClass(run),
      styleId,
      styleName,
      isF8Cite: isRunCite
    });
  };

  for (const child of childElements(paragraph)) {
    const tag = localNameOf(child);
    if (tag === "r") {
      pushRun(child);
      continue;
    }

    if (tag === "hyperlink") {
      for (const run of childElements(child).filter((node) => localNameOf(node) === "r")) {
        pushRun(run);
      }
    }
  }

  if (runs.length === 0) {
    const text = extractParagraphText(paragraph);
    if (text) {
      runs.push(emptyTextRun(text));
    }
  }

  return runs;
};

const buildTexBlock = (paragraph: Element, order: number, styleMap: Map<string, string>): TexBlock => {
  const text = extractParagraphText(paragraph);
  const styleId = paragraphStyleId(paragraph);
  const styleName = paragraphStyleName(paragraph, styleMap) ?? styleId;
  const paragraphIsF8Cite = styleName ? isF8CiteStyle(styleName) : false;
  const runs = paragraphRuns(paragraph, styleMap);
  const isF8Cite = paragraphIsF8Cite || runs.some((run) => run.isF8Cite);

  let level = detectHeadingLevel(paragraph, styleMap);
  if (level && (isProbableAuthorLine(text) || isF8Cite)) {
    level = null;
  }

  return {
    id: `p-${order}`,
    kind: level ? "heading" : "paragraph",
    text,
    runs,
    level,
    styleId,
    styleName,
    isF8Cite
  };
};

const getZipText = async (zip: JSZip, partName: string) => {
  const file = zip.file(partName);
  return file ? file.async("string") : null;
};

export const openTexDocument = async (filePath: string): Promise<TexDocumentPayload> => {
  const absolutePath = Path.resolve(filePath);
  const payload = await Fs.readFile(absolutePath).catch((error: Error & { code?: string }) => {
    throw new Error(`Could not open '${absolutePath}': ${error.message}`);
  });
  const zip = await JSZip.loadAsync(payload).catch((error: Error) => {
    throw new Error(`Could not read '${absolutePath}': ${error.message}`);
  });

  const documentXml = await getZipText(zip, "word/document.xml");
  if (!documentXml) {
    throw new Error(`Missing word/document.xml in '${absolutePath}'. Is this a valid docx file?`);
  }

  const styleMap = readStyleMap(await getZipText(zip, "word/styles.xml"));
  let document: Document;
  try {
    document = parseXml(documentXml);
  } catch (error) {
    throw new Error(`Could not parse XML in '${absolutePath}': ${(error as Error).message}`);
  }

  const blocks = descendantElements(document)
    .filter((node) => localNameOf(node) === "p")
    .map((paragraph, index) => buildTexBlock(paragraph, index + 1, styleMap));

  return {
    filePath: absolutePath,
    fileName: Path.basename(absolutePath) || "Untitled.docx",
    paragraphCount: blocks.length,
    blocks
  };
};
