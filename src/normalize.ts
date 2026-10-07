import type { ConvertResult } from '@figit/dom-to-figma';
import { inferAutoLayout } from './layout';

type Guid = { sessionID: number; localID: number };
export type Layer = {
  guid: Guid; type: string; name: string; parentIndex?: { guid: Guid; position: string };
  size?: { x: number; y: number }; transform?: { m00: number; m01: number; m02: number; m10: number; m11: number; m12: number };
  fillPaints?: { visible?: boolean; opacity?: number }[]; strokePaints?: { visible?: boolean; opacity?: number }[];
  effects?: { visible?: boolean }[]; opacity?: number; visible?: boolean; locked?: boolean; blendMode?: string;
  frameMaskDisabled?: boolean; mask?: boolean; minSize?: object; maxSize?: object;
  cornerRadius?: number; horizontalConstraint?: string; verticalConstraint?: string;
  characters?: string; textAutoResize?: string; stackMode?: string; stackSpacing?: number;
  stackPrimarySizing?: string; stackCounterSizing?: string; stackPrimaryAlignItems?: string; stackCounterAlignItems?: string;
  stackChildAlignSelf?: string; stackChildPrimaryGrow?: number; stackPositioning?: string;
  stackHorizontalPadding?: number; stackVerticalPadding?: number; stackPaddingRight?: number; stackPaddingBottom?: number;
  stackWrap?: string; stackCounterSpacing?: number;
  textAlignVertical?: string;
};
export type Source = {
  tag: string; id: string; classes: string[]; role: string | null; display: string;
  alignItems: string; flexDirection: string; gap: number; textAlign: string;
  padding: [number, number, number, number]; multiline: boolean; semanticBoundary?: boolean; sizingBoundary?: boolean; clippingBoundary?: boolean;
  normalFlowChildren?: boolean;
  position?: string; flexGrow?: number; flexWrap?: string; rowGap?: number; justifyContent?: string;
  intrinsicWidth?: boolean; intrinsicHeight?: boolean;
  controlContent?: boolean;
  bounds?: {x:number; y:number; w:number; h:number};
};
const key = (guid: Guid) => `${guid.sessionID}:${guid.localID}`;

export function layerName(source: Source, textOnly: boolean): string {
  if (source.classes.some(value => /(?:badge|counter|pill)/i.test(value))) return 'badge';
  if (source.tag === 'button' || source.role === 'button') return 'button';
  const semantic = [source.id, ...source.classes].find(value => /^(?:[a-z]+[-_])*(?:card|pricing|price|features|feature-list|header|footer|content|actions|navigation|nav|hero|description|title|subtitle|label|eyebrow)(?:[-_][a-z]+)*$/i.test(value));
  if (semantic) return semantic.toLowerCase().replaceAll('_', '-') + (semantic.endsWith('-container') ? '' : '-container');
  const roles: Record<string, string> = { ul: 'list-container', ol: 'list-container', nav: 'navigation-container', header: 'header-container', footer: 'footer-container', article: 'article-container', section: 'section-container' };
  return roles[source.tag] || (textOnly ? 'text-container' : 'content-container');
}

/** Cleanup operates on decoded layers, before creating the clipboard binary. */
export function normalizeLayers(layers: Layer[], rootGuid: Guid, sources: Map<string, Source>): Layer[] {
  const children = (guid: Guid) => layers.filter(node => node.parentIndex && key(node.parentIndex.guid) === key(guid));
  const wrapper = layers.find(node => key(node.guid) === key(rootGuid));
  const roots = children(rootGuid);
  // Remove only the converter's known export wrapper, never a real DOM frame.
  if (wrapper?.parentIndex && roots.length === 1) {
    const root = roots[0];
    root.parentIndex = { ...wrapper.parentIndex };
    if (root.transform) { root.transform.m02 = 0; root.transform.m12 = 0; }
    layers = layers.filter(node => node !== wrapper);
  }
  const controlAncestor = (node: Layer) => {
    let ancestor: Layer | undefined = node;
    let inControl = false;
    const visited = new Set<string>();
    while (ancestor && !visited.has(key(ancestor.guid))) {
      visited.add(key(ancestor.guid));
      const ancestorSource = sources.get(key(ancestor.guid));
      if (ancestorSource?.tag === 'button' || ancestorSource?.role === 'button') { inControl = true; break; }
      ancestor = ancestor.parentIndex ? layers.find(layer => key(layer.guid) === key(ancestor!.parentIndex!.guid)) : undefined;
    }
    return inControl;
  };
  for (const node of layers) {
    const source = sources.get(key(node.guid));
    if (!source) continue;
    if (node.type === 'TEXT') {
      if (!source.multiline && (source.controlContent || controlAncestor(node))) node.textAlignVertical = 'CENTER';
      node.textAutoResize = source.multiline ? 'HEIGHT' : 'WIDTH_AND_HEIGHT';
      if (!source.multiline) {
        node.stackChildAlignSelf = 'AUTO';
        node.stackChildPrimaryGrow = 0;
      }
      if (/^h[1-6]$/.test(source.tag)) node.name = 'title';
      else if (source.tag === 'p') node.name = 'description';
      else if (source.classes.includes('eyebrow')) node.name = 'subheading';
      continue;
    }
    if (node.type !== 'FRAME') continue;
    const direct = children(node.guid);
    let inferred = inferAutoLayout(node, direct, source, sources);
    const inControl = controlAncestor(node);
    if (!inferred && inControl && direct.length >= 2) {
      // Trace ranges for mixed inline text can describe a different line box.
      // A control-scoped second candidate uses the captured layer bounds.
      const controlSources = new Map(sources);
      for (const child of direct) {
        const childSource = sources.get(key(child.guid));
        if (childSource) controlSources.set(key(child.guid), { ...childSource, bounds: undefined });
      }
      inferred = inferAutoLayout(node, direct, { ...source, bounds: undefined, controlContent: true,
        normalFlowChildren: direct.every(child => !['absolute', 'fixed'].includes(sources.get(key(child.guid))?.position ?? '')) }, controlSources);
    }
    const textOnly = direct.length > 0 && direct.every(child => child.type === 'TEXT');
    node.name = layerName(source, textOnly);
    const normalFlow = direct.every(child => child.stackPositioning !== 'ABSOLUTE');
    const baselineRow = source.display.includes('flex') && source.flexDirection === 'row' && source.alignItems === 'baseline' && textOnly && normalFlow;
    const simpleButton = (source.tag === 'button' || source.role === 'button') && textOnly && normalFlow;
    const badge = source.tag === 'span' && textOnly && direct.length === 1 && !source.multiline && (normalFlow || source.normalFlowChildren === true) && (source.padding.some(value => value > 0) || source.classes.some(value => /(?:badge|counter|pill)/i.test(value)));
    // Inline spans often arrive as positioned frames despite forming a simple
    // icon/label/count row. Infer only a single, evenly spaced centered row.
    const measuredRow = source.normalFlowChildren === true && !(source.display.includes('flex') && source.flexDirection === 'column') && direct.length >= 2 && direct.every(child => child.size && child.transform && child.transform.m00 === 1 && child.transform.m11 === 1 && child.transform.m01 === 0 && child.transform.m10 === 0);
    const centers = measuredRow ? direct.map(child => child.transform!.m12 + child.size!.y / 2) : [];
    const gaps = measuredRow ? direct.slice(1).map((child, index) => child.transform!.m02 - direct[index].transform!.m02 - direct[index].size!.x) : [];
    const inlineRow = measuredRow && Math.max(...centers) - Math.min(...centers) <= 3 && gaps.every(gap => gap >= 0 && gap <= 32 && Math.abs(gap - gaps[0]) <= .5);
    if (!inferred && (baselineRow || simpleButton || badge || inlineRow)) {
      node.stackMode = 'HORIZONTAL';
      node.stackPrimarySizing = inlineRow || badge ? 'RESIZE_TO_FIT' : 'FIXED';
      node.stackCounterSizing = inlineRow || badge ? 'FIXED' : 'RESIZE_TO_FIT';
      node.stackPrimaryAlignItems = baselineRow ? 'MIN' : source.textAlign === 'left' ? 'MIN' : source.textAlign === 'right' ? 'MAX' : 'CENTER';
      node.stackCounterAlignItems = baselineRow ? 'BASELINE' : 'CENTER';
      node.stackSpacing = inlineRow ? gaps[0] : source.gap;
      [node.stackVerticalPadding, node.stackPaddingRight, node.stackPaddingBottom, node.stackHorizontalPadding] = source.padding;
      if (inlineRow) {
        node.stackHorizontalPadding = direct[0].transform!.m02;
        node.stackPaddingRight = Math.max(0, (node.size?.x ?? 0) - direct.at(-1)!.transform!.m02 - direct.at(-1)!.size!.x);
        const top = Math.min(...direct.map(child => child.transform!.m12));
        const bottom = Math.max(...direct.map(child => child.transform!.m12 + child.size!.y));
        node.stackVerticalPadding = Math.max(0, top);
        node.stackPaddingBottom = Math.max(0, (node.size?.y ?? bottom) - bottom);
      }
      for (const child of direct) {
        child.stackPositioning = 'AUTO';
        child.stackChildAlignSelf = 'AUTO';
        child.stackChildPrimaryGrow = 0;
        if (badge && child.type === 'TEXT') child.textAlignVertical = 'CENTER';
      }
      if (badge) { node.stackVerticalPadding = 0; node.stackPaddingBottom = 0; }
    }
  }
  return reduceWrappers(layers, sources);
}

/** Remove only single-child frames that contribute neither appearance nor geometry. */
export function reduceWrappers(layers: Layer[], sources: Map<string, Source>): Layer[] {
  const near = (a: number, b: number) => Math.abs(a - b) <= .01;
  const identity = (node: Layer) => !node.transform || (near(node.transform.m00, 1) && near(node.transform.m11, 1) && near(node.transform.m01, 0) && near(node.transform.m10, 0));
  const paints = (items: Layer['fillPaints']) => items?.some(paint => paint.visible !== false && paint.opacity !== 0);
  const byId = new Map(layers.map(node => [key(node.guid), node]));
  const childMap = new Map<string, Layer[]>();
  for (const node of layers) if (node.parentIndex) {
    const id = key(node.parentIndex.guid);
    const list = childMap.get(id) || [];
    list.push(node); childMap.set(id, list);
  }
  const removed = new Set<Layer>();
  // Bottom-up keeps long wrapper chains linear and transfers layout contracts outward.
  for (const wrapper of [...layers].reverse()) {
    const source = sources.get(key(wrapper.guid));
    if (wrapper.type !== 'FRAME' || !wrapper.parentIndex || !source || source.semanticBoundary || source.sizingBoundary || source.clippingBoundary) continue;
    if (source.role && !['presentation', 'none'].includes(source.role)) continue;
    if (['button', 'a', 'nav', 'header', 'footer', 'article', 'section', 'form'].includes(source.tag)) continue;
    if (wrapper.visible === false || wrapper.locked || wrapper.mask || wrapper.frameMaskDisabled !== true) continue;
    if ((wrapper.opacity ?? 1) !== 1 || (wrapper.blendMode && !['NORMAL', 'PASS_THROUGH'].includes(wrapper.blendMode))) continue;
    if (paints(wrapper.fillPaints) || paints(wrapper.strokePaints) || wrapper.effects?.some(effect => effect.visible !== false)) continue;
    if (wrapper.minSize || wrapper.maxSize || wrapper.cornerRadius || !identity(wrapper)) continue;
    if (source.padding.some(value => value !== 0) || [wrapper.stackHorizontalPadding, wrapper.stackVerticalPadding, wrapper.stackPaddingRight, wrapper.stackPaddingBottom].some(value => (value ?? 0) !== 0)) continue;
    const direct = childMap.get(key(wrapper.guid)) || [];
    if (direct.length !== 1) continue;
    const child = direct[0];
    // Keep text wrappers: they may supply a useful wrapping or alignment width.
    if (child.type !== 'FRAME' || !wrapper.size || !child.size || !identity(child)) continue;
    if (!near(wrapper.size.x, child.size.x) || !near(wrapper.size.y, child.size.y)) continue;
    if (!near(child.transform?.m02 ?? 0, 0) || !near(child.transform?.m12 ?? 0, 0)) continue;
    const parent = byId.get(key(wrapper.parentIndex.guid));
    // Baseline parents depend on the direct child's text-bearing layout.
    if (parent?.stackCounterAlignItems === 'BASELINE') continue;
    child.parentIndex = { ...wrapper.parentIndex };
    if (child.transform && wrapper.transform) child.transform = { ...wrapper.transform };
    for (const property of ['stackChildAlignSelf', 'stackChildPrimaryGrow', 'stackPositioning', 'horizontalConstraint', 'verticalConstraint'] as const) {
      if (wrapper[property] === undefined) delete child[property];
      else Object.assign(child, { [property]: wrapper[property] });
    }
    // Carry width/height sizing across differently oriented Auto Layout frames.
    if (wrapper.stackMode && wrapper.stackMode !== 'NONE' && child.stackMode && child.stackMode !== 'NONE') {
      const sameAxis = wrapper.stackMode === child.stackMode;
      child.stackPrimarySizing = sameAxis ? wrapper.stackPrimarySizing : wrapper.stackCounterSizing;
      child.stackCounterSizing = sameAxis ? wrapper.stackCounterSizing : wrapper.stackPrimarySizing;
    }
    const siblings = childMap.get(key(wrapper.parentIndex.guid));
    if (siblings) siblings.splice(siblings.indexOf(wrapper), 1, child);
    removed.add(wrapper);
  }
  return layers.filter(node => !removed.has(node));
}

export function normalizeCapture(result: ConvertResult, root: Element) {
  if (!result.trace) throw new Error('Layer cleanup requires converter trace mode.');
  const sources = new Map<string, Source>();
  for (const entry of result.trace.entries) {
    const [path, textSuffix] = entry.domPath.split('::text[');
    const element = path === ':scope' ? root : root.querySelector(path);
    if (!element) continue;
    const style = getComputedStyle(element);
    const range = document.createRange();
    const textIndex = textSuffix === undefined ? undefined : Number.parseInt(textSuffix);
    const textNode = textIndex === undefined ? undefined : element.childNodes[textIndex];
    if (textNode) range.selectNodeContents(textNode); else range.selectNodeContents(element);
    const rects = Array.from(range.getClientRects()).filter(rect => rect.width > 0 && rect.height > 0);
    // Text fragments at different vertical positions indicate actual browser wrapping.
    const multiline = rects.some(rect => Math.abs(rect.top - (rects[0]?.top ?? rect.top)) > rect.height * .5);
    const number = (value: string) => Number.parseFloat(value) || 0;
    const bounds = textNode ? range.getBoundingClientRect() : element.getBoundingClientRect();
    sources.set(key(entry.guid), {
      tag: element.tagName.toLowerCase(), id: element.id, classes: [...element.classList], role: element.getAttribute('role'),
      display: style.display, alignItems: style.alignItems, flexDirection: style.flexDirection,
      gap: number(style.columnGap), textAlign: style.textAlign,
      padding: [number(style.paddingTop) + number(style.borderTopWidth), number(style.paddingRight) + number(style.borderRightWidth), number(style.paddingBottom) + number(style.borderBottomWidth), number(style.paddingLeft) + number(style.borderLeftWidth)],
      multiline,
      normalFlowChildren: [...element.children].every(child => { const childStyle = getComputedStyle(child); return !['absolute', 'fixed'].includes(childStyle.position) && childStyle.transform === 'none'; }),
      position: style.position, flexGrow: number(style.flexGrow), flexWrap: style.flexWrap, rowGap: number(style.rowGap), justifyContent: style.justifyContent,
      controlContent: !!element.closest('button, [role="button"], a.Button'),
      bounds: { x:bounds.left, y:bounds.top, w:bounds.width, h:bounds.height },
      intrinsicWidth: ['inline', 'inline-block', 'inline-flex', 'inline-grid'].includes(style.display) && !(element as HTMLElement).style?.width,
      intrinsicHeight: !(element as HTMLElement).style?.height && !(element as HTMLElement).style?.minHeight,
      sizingBoundary: !['0px', 'auto', ''].includes(style.minWidth) || !['0px', 'auto', ''].includes(style.minHeight) || !['none', ''].includes(style.maxWidth) || !['none', ''].includes(style.maxHeight),
      clippingBoundary: [style.overflowX, style.overflowY].some(value => value !== 'visible') || style.clipPath !== 'none',
      semanticBoundary: element.hasAttribute('aria-label') || [element.id, ...element.classList].some(value => /(?:^|[-_])(card|button|dialog|modal|navigation|hero)(?:$|[-_])/i.test(value)),
    });
  }
  result.document.nodeChanges = normalizeLayers(result.document.nodeChanges as Layer[], result.trace.rootGuid, sources) as typeof result.document.nodeChanges;
  return result.document;
}
