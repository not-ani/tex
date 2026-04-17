import { Mark, Node as PMNode, Schema, type DOMOutputSpec } from "prosemirror-model";

const getBlockAttrs = (element: string | HTMLElement) => {
  const block = element as HTMLElement;
  return {
    styleId: block.dataset.styleId ?? "Normal",
    styleName: block.dataset.styleName ?? block.dataset.styleId ?? "Normal",
    isF8Cite: block.dataset.f8Cite === "true"
  };
};

const nodes = {
  doc: {
    content: "block+"
  },
  paragraph: {
    group: "block",
    content: "inline*",
    attrs: {
      styleId: { default: "Normal" },
      styleName: { default: "Normal" },
      isF8Cite: { default: false }
    },
    parseDOM: [
      {
        tag: "p",
        getAttrs: getBlockAttrs
      }
    ],
    toDOM(node: PMNode): DOMOutputSpec {
      return [
        "p",
        {
          "data-style-id": node.attrs.styleId ?? "",
          "data-style-name": node.attrs.styleName ?? "",
          "data-f8-cite": node.attrs.isF8Cite ? "true" : "false"
        },
        0
      ] as const;
    }
  },
  heading: {
    group: "block",
    content: "inline*",
    defining: true,
    attrs: {
      level: { default: 1 },
      styleId: { default: null },
      styleName: { default: null },
      isF8Cite: { default: false }
    },
    parseDOM: [1, 2, 3, 4].map((level) => ({
      tag: `h${level}`,
      getAttrs: (element: string | HTMLElement) => ({
        level,
        ...getBlockAttrs(element)
      })
    })),
    toDOM(node: PMNode): DOMOutputSpec {
      const level = Math.max(1, Math.min(4, Number(node.attrs.level) || 1));
      return [
        `h${level}`,
        {
          "data-style-id": node.attrs.styleId ?? "",
          "data-style-name": node.attrs.styleName ?? "",
          "data-f8-cite": node.attrs.isF8Cite ? "true" : "false"
        },
        0
      ] as const;
    }
  },
  text: {
    group: "inline"
  },
  hard_break: {
    group: "inline",
    inline: true,
    selectable: false,
    parseDOM: [{ tag: "br" }],
    toDOM(): DOMOutputSpec {
      return ["br"] as const;
    }
  }
};

const marks = {
  strong: {
    parseDOM: [{ tag: "strong" }, { tag: "b" }],
    toDOM(): DOMOutputSpec {
      return ["strong", 0] as const;
    }
  },
  em: {
    parseDOM: [{ tag: "em" }, { tag: "i" }],
    toDOM(): DOMOutputSpec {
      return ["em", 0] as const;
    }
  },
  underline: {
    parseDOM: [{ tag: "u" }],
    toDOM(): DOMOutputSpec {
      return ["u", 0] as const;
    }
  },
  cite: {
    attrs: {
      styleId: { default: "Cite" },
      styleName: { default: "Cite" }
    },
    parseDOM: [
      {
        tag: 'span[data-tex-cite="true"]',
        getAttrs: (element: string | HTMLElement) => ({
          styleId: (element as HTMLElement).dataset.styleId ?? "Cite",
          styleName: (element as HTMLElement).dataset.styleName ?? "Cite"
        })
      }
    ],
    toDOM(mark: Mark): DOMOutputSpec {
      return [
        "span",
        {
          "data-tex-cite": "true",
          "data-style-id": mark.attrs.styleId ?? "Cite",
          "data-style-name": mark.attrs.styleName ?? "Cite"
        },
        0
      ] as const;
    }
  },
  highlight: {
    attrs: {
      color: { default: "blue" }
    },
    parseDOM: [
      {
        tag: "mark",
        getAttrs: (element: string | HTMLElement) => ({
          color: (element as HTMLElement).dataset.color ?? "blue"
        })
      }
    ],
    toDOM(mark: Mark): DOMOutputSpec {
      return ["mark", { "data-color": mark.attrs.color ?? "blue" }, 0] as const;
    }
  }
};

export const texEditorSchema = new Schema({ nodes, marks });
