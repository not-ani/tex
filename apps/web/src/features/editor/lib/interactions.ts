import { DEFAULT_EDITOR_ZOOM_VALUE, getZoomCommand, isWebKitGestureEvent, type ZoomFocusPoint } from "./zoom";
import { isEditableTarget } from "./shortcuts";

type EditorInteractionOptions = {
  host: HTMLDivElement;
  editorPage: HTMLDivElement;
  getZoom: () => number;
  applyZoom: (nextZoom: number, focusPoint?: ZoomFocusPoint) => void;
  stepZoom: (direction: 1 | -1, focusPoint?: ZoomFocusPoint) => void;
  runFunctionKey: (key: string) => boolean;
};

export const bindEditorInteractions = ({
  host,
  editorPage,
  getZoom,
  applyZoom,
  stepZoom,
  runFunctionKey
}: EditorInteractionOptions) => {
  let gestureStartZoom = getZoom();
  let gestureFocusPoint: ZoomFocusPoint | undefined;

  const onWindowKeyDown = (event: KeyboardEvent) => {
    const zoomCommand = getZoomCommand(event);
    if (zoomCommand) {
      if (isEditableTarget(event.target) && event.target instanceof Node && !host.contains(event.target)) {
        return;
      }

      event.preventDefault();
      if (zoomCommand === "in") {
        stepZoom(1);
      } else if (zoomCommand === "out") {
        stepZoom(-1);
      } else {
        applyZoom(DEFAULT_EDITOR_ZOOM_VALUE);
      }
      return;
    }

    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    if (event.target instanceof Node && host.contains(event.target)) {
      return;
    }

    if (!/^F([2-9]|1[0-2])$/.test(event.key)) {
      return;
    }

    if (runFunctionKey(event.key)) {
      event.preventDefault();
    }
  };

  const onZoomWheel = (event: WheelEvent) => {
    if (!event.ctrlKey) {
      return;
    }

    if (!(event.target instanceof Node) || !editorPage.contains(event.target)) {
      return;
    }

    event.preventDefault();

    const multiplier = Math.exp(-event.deltaY * 0.0025);
    applyZoom(getZoom() * multiplier, { clientX: event.clientX, clientY: event.clientY });
  };

  const onGestureStart = (event: Event) => {
    if (!isWebKitGestureEvent(event)) {
      return;
    }

    event.preventDefault();
    gestureStartZoom = getZoom();
    gestureFocusPoint = { clientX: event.clientX, clientY: event.clientY };
  };

  const onGestureChange = (event: Event) => {
    if (!isWebKitGestureEvent(event)) {
      return;
    }

    event.preventDefault();
    applyZoom(gestureStartZoom * event.scale, gestureFocusPoint);
  };

  window.addEventListener("keydown", onWindowKeyDown, { capture: true });
  editorPage.addEventListener("wheel", onZoomWheel, { passive: false });
  editorPage.addEventListener("gesturestart", onGestureStart, { passive: false });
  editorPage.addEventListener("gesturechange", onGestureChange, { passive: false });

  return () => {
    window.removeEventListener("keydown", onWindowKeyDown, { capture: true });
    editorPage.removeEventListener("wheel", onZoomWheel);
    editorPage.removeEventListener("gesturestart", onGestureStart);
    editorPage.removeEventListener("gesturechange", onGestureChange);
  };
};
