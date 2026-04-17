const EDITOR_ZOOM_STORAGE_KEY = "editor-zoom";
const DEFAULT_EDITOR_ZOOM = 1;
const MIN_EDITOR_ZOOM = 0.5;
const MAX_EDITOR_ZOOM = 2;
const KEYBOARD_ZOOM_STEP = 0.1;
const ZOOM_EPSILON = 0.001;

export type ZoomFocusPoint = {
  clientX: number;
  clientY: number;
};

export type WebKitGestureEvent = Event & {
  scale: number;
  clientX: number;
  clientY: number;
};

export const clampEditorZoom = (value: number) =>
  Math.min(MAX_EDITOR_ZOOM, Math.max(MIN_EDITOR_ZOOM, Number.isFinite(value) ? value : DEFAULT_EDITOR_ZOOM));

export const roundEditorZoom = (value: number) => Math.round(clampEditorZoom(value) * 100) / 100;

export const getInitialEditorZoom = () => {
  if (typeof window === "undefined") {
    return DEFAULT_EDITOR_ZOOM;
  }

  const storedValue = Number.parseFloat(window.localStorage.getItem(EDITOR_ZOOM_STORAGE_KEY) ?? "");
  return clampEditorZoom(storedValue);
};

export const persistEditorZoom = (zoom: number) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(EDITOR_ZOOM_STORAGE_KEY, String(roundEditorZoom(zoom)));
};

export const getZoomCommand = (event: KeyboardEvent): "in" | "out" | "reset" | null => {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) {
    return null;
  }

  if (event.code === "NumpadAdd") {
    return "in";
  }

  if (event.code === "NumpadSubtract") {
    return "out";
  }

  switch (event.key) {
    case "+":
    case "=":
      return "in";
    case "-":
    case "_":
      return "out";
    case "0":
      return "reset";
    default:
      return null;
  }
};

export const isWebKitGestureEvent = (event: Event): event is WebKitGestureEvent =>
  "scale" in event && "clientX" in event && "clientY" in event;

export const applyZoomToPage = (
  page: HTMLDivElement | null,
  currentZoom: number,
  setZoom: (nextZoom: number) => void,
  nextZoom: number,
  focusPoint?: ZoomFocusPoint
) => {
  const clampedZoom = roundEditorZoom(nextZoom);

  if (!page || Math.abs(clampedZoom - currentZoom) < ZOOM_EPSILON) {
    setZoom(clampedZoom);
    return;
  }

  const rect = page.getBoundingClientRect();
  const anchor = focusPoint ?? {
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2
  };
  const relativeX = anchor.clientX - rect.left;
  const relativeY = anchor.clientY - rect.top;
  const contentX = (page.scrollLeft + relativeX) / currentZoom;
  const contentY = (page.scrollTop + relativeY) / currentZoom;

  setZoom(clampedZoom);

  queueMicrotask(() => {
    page.scrollLeft = contentX * clampedZoom - relativeX;
    page.scrollTop = contentY * clampedZoom - relativeY;
  });
};

export const DEFAULT_EDITOR_ZOOM_VALUE = DEFAULT_EDITOR_ZOOM;
export const KEYBOARD_ZOOM_STEP_VALUE = KEYBOARD_ZOOM_STEP;
