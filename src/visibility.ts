type HidingStyle = Pick<CSSStyleDeclaration, 'clipPath' | 'clip' | 'width' | 'height' | 'position' | 'overflow' | 'overflowX' | 'overflowY'>;

// Inspect rendered styles rather than class names: focus/responsive variants
// can make an sr-only element visible without removing its class.
export function isVisuallyClipped(style: HidingStyle): boolean {
  const inset = style.clipPath.match(/^inset\(([^)]+)\)$/);
  if (inset) {
    const values = inset[1].trim().split(/\s+/);
    if (values.every(value => /^\d+(?:\.\d+)?%$/.test(value))) {
      const numbers = values.map(parseFloat);
      const [top, right = top, bottom = top, left = right] = numbers;
      if (top + bottom >= 100 || left + right >= 100) return true;
    }
  }
  if (/^rect\(0(?:px)?[ ,]+0(?:px)?[ ,]+0(?:px)?[ ,]+0(?:px)?\)$/.test(style.clip)) return true;
  const tiny = parseFloat(style.width) <= 1 && parseFloat(style.height) <= 1;
  const clipped = style.overflow === 'hidden' || (style.overflowX === 'hidden' && style.overflowY === 'hidden');
  return tiny && clipped && style.position === 'absolute';
}
