export const startMarginDrag = (
  side: "left" | "right",
  event: MouseEvent,
  editorPage: HTMLDivElement,
  setDraggingMargin: (value: boolean) => void
) => {
  event.preventDefault();
  setDraggingMargin(true);

  const onMove = (moveEvent: MouseEvent) => {
    const rect = editorPage.getBoundingClientRect();
    const margin =
      side === "left"
        ? Math.max(16, moveEvent.clientX - rect.left)
        : Math.max(16, rect.right - moveEvent.clientX);
    const clamped = Math.min(margin, rect.width * 0.35);
    editorPage.style.setProperty("--editor-margin", `${clamped}px`);
  };

  const onUp = () => {
    setDraggingMargin(false);
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };

  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
};
