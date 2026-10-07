// Request clipboard access during the click, before font/image preparation
// can outlast user activation or the user switches to Figma.
export function writePreparedHtml(prepare: () => Promise<string>): Promise<void> {
  const html = Promise.resolve().then(prepare).then(value => new Blob([value], { type: 'text/html' }));
  // The browser may reject access before consuming the promised payload.
  void html.catch(() => {});
  return navigator.clipboard.write([new ClipboardItem({ 'text/html': html })]);
}
