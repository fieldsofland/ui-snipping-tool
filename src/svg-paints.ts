import Color from 'colorjs.io';
import type { ConvertResult } from '@figit/dom-to-figma';

type RGBA = { r:number; g:number; b:number; a:number };
type Transform = { m00:number; m01:number; m02:number; m10:number; m11:number; m12:number };
type Paint = { type:string; color?:RGBA; stops?:{color:RGBA;position:number}[]; transform?:Transform; opacity:number; visible:boolean; blendMode:string };
const clamp = (value:number) => Math.max(0,Math.min(1,value));
export function parsePaintColor(value:string): RGBA | null {
  if (!value || value === 'none' || value.startsWith('url(')) return null;
  try { const parsed = new Color(value).to('srgb');return {r:clamp(parsed.coords[0] ?? 0),g:clamp(parsed.coords[1] ?? 0),b:clamp(parsed.coords[2] ?? 0),a:clamp(Number(parsed.alpha))}; } catch { return null; }
}
export function solidPaint(value:string, opacity=1):Paint[] {
  const color = parsePaintColor(value);
  if (!color) return [];
  return [{type:'SOLID',color:{...color,a:1},opacity:color.a * clamp(opacity),visible:true,blendMode:'NORMAL'}];
}
export function linearPaint(start:{x:number;y:number},end:{x:number;y:number},stops:{color:RGBA;position:number}[],opacity=1):Paint | null {
  const dx=end.x-start.x,dy=end.y-start.y,span=dx*dx+dy*dy;
  if (span<1e-10 || !stops.length) return null;
  return {type:'GRADIENT_LINEAR',stops,opacity:clamp(opacity),visible:true,blendMode:'NORMAL',transform:{m00:dx/span,m01:dy/span,m02:-(dx*start.x+dy*start.y)/span,m10:-dy/span,m11:dx/span,m12:.5+(dy*start.x-dx*start.y)/span}};
}
const numeric = (value:string, fallback=1) => {const result=Number.parseFloat(value);return Number.isFinite(result)?result:fallback;};
const coordinate = (value:string|null, fallback:number) => value === null ? fallback : value.endsWith('%') ? numeric(value,0)/100 : numeric(value,0);
function svgGradient(element:SVGElement,value:string,opacity:number):Paint|null {
  const match=/url\(["']?([^"')]+)["']?\)/.exec(value);
  if(!match)return null;
  const fragment=match[1].lastIndexOf('#');if(fragment<0)return null;
  const id=decodeURIComponent(match[1].slice(fragment+1));
  const svg=element.ownerSVGElement;
  const gradient=svg ? [...svg.querySelectorAll('linearGradient')].find(node=>node.id===id) : null;
  if(!gradient)return null;
  // The initial implementation supports the object-bounding-box gradients used
  // by area charts. Keep other SVG coordinate systems out of this approximation.
  if(gradient.getAttribute('gradientUnits')==='userSpaceOnUse' || gradient.hasAttribute('gradientTransform'))return null;
  const stops=[...gradient.querySelectorAll('stop')].map(stop=>{
    const style=getComputedStyle(stop),color=parsePaintColor(style.stopColor);
    return color ? {color:{...color,a:color.a*clamp(numeric(style.stopOpacity))},position:clamp(coordinate(stop.getAttribute('offset'),0))} : null;
  }).filter((stop):stop is {color:RGBA;position:number}=>!!stop);
  // SVG clamps decreasing offsets to the preceding stop rather than reordering.
  for(let i=1;i<stops.length;i++)stops[i].position=Math.max(stops[i-1].position,stops[i].position);
  return linearPaint({x:coordinate(gradient.getAttribute('x1'),0),y:coordinate(gradient.getAttribute('y1'),0)},{x:coordinate(gradient.getAttribute('x2'),1),y:coordinate(gradient.getAttribute('y2'),0)},stops,opacity);
}
export function normalizeSvgPaints(result:ConvertResult,root:Element) {
  if(!result.trace)return;
  const nodes=new Map(result.document.nodeChanges.map(node=>[`${node.guid.sessionID}:${node.guid.localID}`,node]));
  for(const entry of result.trace.entries){
    if(!['vector','text'].includes(entry.kind))continue;
    const node=nodes.get(`${entry.guid.sessionID}:${entry.guid.localID}`);
    const element=entry.domPath===':scope'?root:root.querySelector(entry.domPath.split('::text[')[0]);
    if(!node||!['VECTOR','TEXT'].includes(node.type)||!(element instanceof SVGElement))continue;
    const style=getComputedStyle(element);
    const fillOpacity=numeric(style.fillOpacity),strokeOpacity=numeric(style.strokeOpacity);
    if(node.type==='TEXT'){node.fillPaints=solidPaint(style.fill,fillOpacity) as typeof node.fillPaints;continue;}
    if(node.type!=='VECTOR')continue;
    const gradient=svgGradient(element,style.fill,fillOpacity);
    node.fillPaints=(gradient?[gradient]:solidPaint(style.fill,fillOpacity)) as typeof node.fillPaints;
    const strokeGradient=svgGradient(element,style.stroke,strokeOpacity);
    node.strokePaints=(strokeGradient?[strokeGradient]:solidPaint(style.stroke,strokeOpacity)) as typeof node.strokePaints;
    // Shape opacity remains separate, and parent opacity remains on the parent.
  }
}
