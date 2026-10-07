import { createFigmaConverter, createFontsourceLoader } from '@figit/dom-to-figma';
import { composeClipboardHtml, encodeFigmaData } from '@figit/fig-kiwi';
import { writePreparedHtml } from './clipboard';
import { normalizeFonts, converterStyle, type FontIdentity } from './fonts';
import { normalizeSvgPaints } from './svg-paints';
import { normalizeCapture } from './normalize';
import { panelPosition } from './geometry';
import { isVisuallyClipped } from './visibility';

const state = globalThis as typeof globalThis & { __componentGrabber?: boolean };
if (!state.__componentGrabber) {
  state.__componentGrabber = true;
  const host = document.createElement('div');
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none';
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `<style>
    :host { color-scheme:light; } * { box-sizing:border-box; }
    .outline { position:fixed;border:2px solid #7856ff;background:#7856ff0a;border-radius:3px;pointer-events:none; }
    .panel { position:fixed;width:280px;padding:14px;background:#fff;color:#24232b;border:1px solid #e5e2ed;border-radius:14px;box-shadow:0 8px 32px #18132d26;pointer-events:auto;font:13px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
    .row { display:flex;align-items:center;justify-content:space-between;gap:8px; } .name { font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; } .meta { color:#77717f;font-size:12px;margin:4px 0 12px; }
    button { font:inherit;cursor:pointer;border:0;border-radius:8px; } .copy { width:100%;padding:10px;background:#7653ef;color:white;font-weight:600; } button:disabled { cursor:default;opacity:.55; } .small { background:#f3f1f7;color:#575060;padding:5px 8px; } .close { background:transparent;color:#77717f;padding:2px 6px;font-size:18px; } button:focus-visible { outline:2px solid #7653ef;outline-offset:3px; }
    .status { margin-top:9px;color:#6c6576;font-size:12px;overflow-wrap:anywhere; } .hint { position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:10px 16px;background:#25212e;color:white;border-radius:10px;font:13px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;box-shadow:0 4px 20px #0002; } [hidden] { display:none!important; }
  </style><div class="outline" hidden></div><section class="panel" aria-label="Copy component to Figma" hidden><div class="row"><span class="name"></span><button class="close" aria-label="Close picker">×</button></div><div class="meta"></div><div class="row" style="margin-bottom:12px"><button class="small parent">Select parent ↑</button><span style="color:#8b8493;font-size:11px">Esc to exit</span></div><button class="copy">Copy to Figma</button><button class="small fonts" style="margin-top:10px;width:100%">Use installed fonts…</button><div class="status" role="status" aria-live="polite">Paste into Figma with ⌘V or Ctrl+V</div></section><div class="hint" hidden>Click a component to select it · Esc to exit</div>`;
  const get = <T extends HTMLElement>(selector: string) => shadow.querySelector<T>(selector)!;
  const outline = get('.outline'), panel = get('.panel'), hint = get('.hint');
  const copy = get<HTMLButtonElement>('.copy'), parent = get<HTMLButtonElement>('.parent');
  let active = false, selected: Element | null = null, hovered: Element | null = null, busy = false;
  let converter: ReturnType<typeof createFigmaConverter> | undefined;
  function label(element: Element) { return element.tagName.toLowerCase() + (element.id ? `#${element.id}` : element.classList.length ? `.${element.classList[0]}` : ''); }
  function draw() {
    const target = selected || hovered;
    outline.hidden = !active || !target || !target.isConnected;
    panel.hidden = !active || !selected;
    hint.hidden = !active || !!selected;
    if (!active || !target) return;
    if (!target.isConnected) { selected = hovered = null; draw(); return; }
    const rect = target.getBoundingClientRect();
    Object.assign(outline.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    if (selected) {
      get('.name').textContent = label(selected);
      get('.meta').textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)} px`;
      parent.disabled = busy || !selected.parentElement || selected.parentElement === document.documentElement;
      const position = panelPosition(rect, innerWidth, innerHeight, panel.offsetHeight);
      panel.style.left = `${position.left}px`; panel.style.top = `${position.top}px`;
    }
  }
  function stop() { active = false; selected = hovered = null; host.remove(); draw(); }
  function select(element: Element) { selected = element; get('.status').textContent = 'Paste into Figma with ⌘V or Ctrl+V'; copy.textContent = 'Copy to Figma'; draw(); }
  const isOwn = (event: Event) => event.composedPath().includes(host);
  document.addEventListener('pointermove', event => {
    if (!active || busy || isOwn(event)) return;
    hovered = event.composedPath().find(node => node instanceof Element) as Element || null;
    if (!selected) draw();
  }, true);
  document.addEventListener('pointerdown', event => {
    if (!active || isOwn(event)) return;
    event.preventDefault(); event.stopImmediatePropagation();
  }, true);
  document.addEventListener('click', event => {
    if (!active || isOwn(event)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (busy) return;
    const target = event.composedPath().find(node => node instanceof Element);
    if (target instanceof Element) select(target);
  }, true);
  document.addEventListener('keydown', event => {
    if (!active) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); stop(); }
    if (event.key === 'ArrowUp' && selected && !busy && !parent.disabled) { event.preventDefault(); event.stopImmediatePropagation(); select(selected.parentElement!); }
  }, true);
  document.addEventListener('scroll', () => active && draw(), true);
  window.addEventListener('resize', () => active && draw());
  get('.close').addEventListener('click', stop);
  parent.addEventListener('click', () => selected?.parentElement && select(selected.parentElement));
  get('.fonts').addEventListener('click', () => {
    const root = selected || document.body;
    const families = [...new Set([root, ...root.querySelectorAll('*')].map(element => getComputedStyle(element).fontFamily.split(',')[0].replace(/["']/g, '').trim()))].slice(0,16);
    chrome.runtime.sendMessage({ type: 'component-grabber:font-setup', families });
  });
  const fontIdentities = new Map<string, FontIdentity>();
  const fallbackFonts = createFontsourceLoader();
  let localFaces = 0;
  copy.addEventListener('click', async () => {
    if (!selected || busy) return;
    const element = selected;
    busy = true; copy.disabled = true; copy.textContent = 'Copying…';
    get('.status').textContent = 'Preparing editable Figma layers…'; draw();
    try {
      if (!navigator.clipboard?.write) throw new Error('Clipboard access requires an HTTPS page or localhost.');
      await writePreparedHtml(async () => {
      localFaces = 0;
      fontIdentities.clear();
      converter ??= createFigmaConverter({ trace: true,
        classify: (element, defaultKind) => isVisuallyClipped(getComputedStyle(element)) ? 'skip' : defaultKind,
        fontLoader: async request => {
        const local = await chrome.runtime.sendMessage({ type:'component-grabber:font', ...request });
        if (local?.bytes) {
          localFaces++;
          fontIdentities.set(`${request.family}:${converterStyle(local.weight, local.italic)}`, { family:local.family, style:local.style, postscript:local.postscript });
          return { bytes:new Uint8Array(local.bytes).buffer, resolvedFamily:local.family, resolvedWeight:local.weight, resolvedItalic:local.italic };
        }
        return fallbackFonts(request);
      } });
      converter.clearCache();
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) throw new Error('Select a visible component with a nonzero size.');
      // Exclude the picker even when capturing the body.
      host.remove();
      const result = await converter.convert({ element, width: rect.width, height: rect.height, name: label(element) });
      normalizeSvgPaints(result, element);
      const normalized = normalizeCapture(result, element);
      normalizeFonts(normalized.nodeChanges, fontIdentities);
      const encoded = encodeFigmaData(normalized);
      return composeClipboardHtml(encoded.base64);
      });
      copy.textContent = 'Copied';
      get('.status').textContent = localFaces ? 'Ready. Copied using your saved fonts.' : 'Ready. Paste into your Figma canvas.';
    } catch (error) {
      copy.textContent = 'Try again';
      get('.status').textContent = error instanceof Error ? error.message : 'Could not copy this component.';
    } finally {
      busy = false; copy.disabled = false;
      if (active) document.documentElement.append(host);
      draw();
    }
  });
  chrome.runtime.onMessage.addListener(message => {
    if (message.type !== 'component-grabber:toggle' || busy) return;
    if (active) stop(); else { active = true; document.documentElement.append(host); draw(); }
  });
}
