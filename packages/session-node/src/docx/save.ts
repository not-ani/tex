import Path from "node:path";
import { promises as Fs } from "node:fs";
import JSZip from "jszip";
import type { TexBlock, TexDocumentPayload, TexTextRun } from "@tex/editor";
import { createBlankDocxBuffer } from "./template";
import { openTexDocument } from "./open";

const xmlEscapeText = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const xmlEscapeAttr = (value: string) =>
  xmlEscapeText(value).replaceAll('"', "&quot;").replaceAll("'", "&apos;");

const canonicalParagraphStyleId = (block: TexBlock) => {
  if (block.kind === "heading") {
    const level = Math.max(1, Math.min(9, block.level ?? 1));
    return `Heading${level}`;
  }

  return block.styleId ?? "";
};

const textNodesXml = (text: string) => {
  let output = "";
  let buffer = "";

  const flushText = () => {
    if (!buffer) {
      return;
    }

    output += `<w:t xml:space="preserve">${xmlEscapeText(buffer)}</w:t>`;
    buffer = "";
  };

  for (const character of text) {
    if (character === "\n") {
      flushText();
      output += "<w:br/>";
      continue;
    }

    if (character === "\t") {
      flushText();
      output += "<w:tab/>";
      continue;
    }

    buffer += character;
  }

  flushText();
  return output;
};

const runXml = (run: TexTextRun) => {
  let props = "";
  const runStyleId = (run.styleId && run.styleId.length > 0 ? run.styleId : null) ?? (run.isF8Cite ? "Cite" : null);

  if (runStyleId) {
    props += `<w:rStyle w:val="${xmlEscapeAttr(runStyleId)}"/>`;
  }
  if (run.bold) {
    props += "<w:b/>";
  }
  if (run.italic) {
    props += "<w:i/>";
  }
  if (run.underline) {
    props += '<w:u w:val="single"/>';
  }
  if (run.smallCaps) {
    props += "<w:smallCaps/>";
  }
  if (run.highlightColor) {
    props += `<w:highlight w:val="${xmlEscapeAttr(run.highlightColor)}"/>`;
  }

  const body = textNodesXml(run.text);
  if (!body) {
    return "";
  }

  return props ? `<w:r><w:rPr>${props}</w:rPr>${body}</w:r>` : `<w:r>${body}</w:r>`;
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

const blockXml = (block: TexBlock) => {
  const level = block.kind === "heading" ? Math.max(1, Math.min(9, block.level ?? 1)) : null;
  const styleId = canonicalParagraphStyleId(block);

  let paragraphProps = "";
  if (styleId) {
    paragraphProps += `<w:pStyle w:val="${xmlEscapeAttr(styleId)}"/>`;
  }
  if (level) {
    paragraphProps += `<w:outlineLvl w:val="${level - 1}"/>`;
  }

  let runSegments = block.runs.map(runXml);
  if (runSegments.every((segment) => !segment)) {
    if (!block.text) {
      runSegments = ["<w:r/>"];
    } else {
      runSegments = [runXml(emptyTextRun(block.text))];
    }
  }

  return paragraphProps
    ? `<w:p><w:pPr>${paragraphProps}</w:pPr>${runSegments.join("")}</w:p>`
    : `<w:p>${runSegments.join("")}</w:p>`;
};

const updateDocumentBody = (documentXml: string, blocks: TexBlock[]) => {
  const bodyMatch = /<w:body[^>]*>/i.exec(documentXml);
  if (!bodyMatch?.index && bodyMatch?.index !== 0) {
    throw new Error("Could not resolve DOCX body open tag.");
  }

  const bodyOpenEnd = bodyMatch.index + bodyMatch[0].length;
  const bodyCloseStart = documentXml.lastIndexOf("</w:body>");
  if (bodyCloseStart < 0) {
    throw new Error("Could not resolve DOCX body close tag.");
  }

  const bodyInner = documentXml.slice(bodyOpenEnd, bodyCloseStart);
  const sectionPropsMatch = bodyInner.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/i);
  const sectionProps = sectionPropsMatch?.[0] ?? "<w:sectPr/>";

  return `${documentXml.slice(0, bodyOpenEnd)}
${blocks.map(blockXml).join("")}${sectionProps}${documentXml.slice(bodyCloseStart)}`;
};

export const saveTexDocument = async (
  filePath: string,
  blocks: readonly TexBlock[]
): Promise<TexDocumentPayload> => {
  const absolutePath = Path.resolve(filePath);

  const hasFile = await Fs.access(absolutePath)
    .then(() => true)
    .catch(() => false);

  if (!hasFile) {
    await Fs.writeFile(absolutePath, await createBlankDocxBuffer());
  }

  const zipBuffer = await Fs.readFile(absolutePath).catch((error: Error) => {
    throw new Error(`Could not open '${absolutePath}': ${error.message}`);
  });
  const zip = await JSZip.loadAsync(zipBuffer).catch((error: Error) => {
    throw new Error(`Could not read '${absolutePath}': ${error.message}`);
  });
  const documentFile = zip.file("word/document.xml");
  const documentXml = documentFile ? await documentFile.async("string") : null;

  if (!documentXml) {
    throw new Error(`Missing word/document.xml in '${absolutePath}'. Is this a valid docx file?`);
  }

  zip.file("word/document.xml", updateDocumentBody(documentXml, [...blocks]));
  await Fs.writeFile(absolutePath, await zip.generateAsync({ type: "nodebuffer" }));
  return openTexDocument(absolutePath);
};
