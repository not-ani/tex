import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

const parser = new DOMParser();
const serializer = new XMLSerializer();

const ELEMENT_NODE = 1;

export const localNameOf = (node: Node) =>
  (node as { localName?: string }).localName ?? node.nodeName.split(":").at(-1) ?? "";

export const isElementNode = (node: Node): node is Element => node.nodeType === ELEMENT_NODE;

export const childElements = (node: Node) =>
  Array.from(node.childNodes).filter((child): child is Element => isElementNode(child));

export const descendantElements = (node: Node): Element[] => {
  const result: Element[] = [];

  const visit = (current: Node) => {
    for (const child of Array.from(current.childNodes)) {
      if (!isElementNode(child)) {
        continue;
      }

      result.push(child);
      visit(child);
    }
  };

  visit(node);
  return result;
};

export const findFirstChild = (node: Node, name: string) =>
  childElements(node).find((child) => localNameOf(child) === name) ?? null;

export const findFirstDescendant = (node: Node, name: string) =>
  descendantElements(node).find((child) => localNameOf(child) === name) ?? null;

export const attributeValue = (element: Element, localName: string) => {
  for (const attribute of Array.from(element.attributes)) {
    if (attribute.localName === localName || attribute.name.endsWith(`:${localName}`)) {
      return attribute.value;
    }
  }
  return null;
};

export const parseXml = (value: string) => parser.parseFromString(value, "text/xml");

export const serializeXml = (node: Node) => serializer.serializeToString(node);
