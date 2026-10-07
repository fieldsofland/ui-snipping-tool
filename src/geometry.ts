export function panelPosition(rect: { left: number; bottom: number; top: number }, width: number, height: number, panelHeight: number) {
  return { left: Math.max(12, Math.min(rect.left, width - 292)), top: Math.max(12, Math.min(rect.bottom + 10 + panelHeight <= height - 12 ? rect.bottom + 10 : rect.top - panelHeight - 10, height - panelHeight - 12)) };
}
