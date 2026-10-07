import type {Layer, Source} from './normalize';
const key=(node:Layer)=>`${node.guid.sessionID}:${node.guid.localID}`;
const near=(a:number,b:number)=>Math.abs(a-b)<=1;
const uniform=(values:number[])=>values.every(value=>value>=-.01&&near(value,values[0]));

// Geometry is the final check; CSS provides hints and identifies overlays.
export function inferAutoLayout(parent:Layer, children:Layer[], source:Source, sources:Map<string,Source>):boolean {
  if (!parent.size || source.normalFlowChildren===undefined || parent.stackMode && parent.stackMode!=='NONE') return false;
  if(source.alignItems==='baseline')return false;
  const overlays=children.filter(child=>['absolute','fixed'].includes(sources.get(key(child))?.position ?? ''));
  const flow=children.filter(child=>!overlays.includes(child));
  if(flow.length<2||flow.some(child=>!child.size||!child.transform||child.transform.m00!==1||child.transform.m11!==1||child.transform.m01!==0||child.transform.m10!==0))return false;
  if(source.normalFlowChildren===false && overlays.length===0)return false;
  const boxes=flow.map(child=>({x:child.transform!.m02,y:child.transform!.m12,w:child.size!.x,h:child.size!.y}));
  if(boxes.some(b=>b.x<-.01||b.y<-.01||b.x+b.w>parent.size!.x+3||b.y+b.h>parent.size!.y+3))return false;
  const aligned=(horizontal:boolean)=>{
    const starts=boxes.map(b=>horizontal?b.y:b.x),ends=boxes.map(b=>horizontal?b.y+b.h:b.x+b.w),centers=starts.map((s,i)=>(s+ends[i])/2);
    if(centers.every(c=>Math.abs(c-centers[0])<=3))return 'CENTER';
    if(starts.every(s=>near(s,starts[0])))return 'MIN';
    if(ends.every(e=>near(e,ends[0])))return 'MAX';
    return null;
  };
  for(const horizontal of [true,false]){
    if(horizontal&&source.display.includes('flex')&&source.flexDirection==='column')continue;
    const gaps=boxes.slice(1).map((b,i)=>horizontal?b.x-boxes[i].x-boxes[i].w:b.y-boxes[i].y-boxes[i].h);
    const align=aligned(horizontal);
    if(!align||!uniform(gaps))continue;
    const minX=Math.min(...boxes.map(b=>b.x)),minY=Math.min(...boxes.map(b=>b.y));
    const maxX=Math.max(...boxes.map(b=>b.x+b.w)),maxY=Math.max(...boxes.map(b=>b.y+b.h));
    const distributed=source.justifyContent==='space-between';
    const padding:Source['padding']=distributed?source.padding:[minY,parent.size.x-maxX,parent.size.y-maxY,minX];
    const [top,right,bottom,left]=padding;
    if(padding.some(p=>p<-.01))continue;
    if(distributed){
      const leading=horizontal?left:top,trailing=horizontal?parent.size.x-right:parent.size.y-bottom;
      if(!near(horizontal?boxes[0].x:boxes[0].y,leading)||!near(horizontal?boxes.at(-1)!.x+boxes.at(-1)!.w:boxes.at(-1)!.y+boxes.at(-1)!.h,trailing))continue;
    }
    const crossStart=horizontal?top:left,crossEnd=horizontal?parent.size.y-bottom:parent.size.x-right;
    // Reject candidates whose alignment would shift child bounds.
    if(boxes.some(b=>{
      const start=horizontal?b.y:b.x,size=horizontal?b.h:b.w;
      const expected=align==='MIN'?crossStart:align==='MAX'?crossEnd-size:(crossStart+crossEnd-size)/2;
      return Math.abs(start-expected)>3;
    }))continue;
    Object.assign(parent,{stackMode:horizontal?'HORIZONTAL':'VERTICAL',stackSpacing:Math.max(0,gaps[0]),stackPrimaryAlignItems:distributed?'SPACE_BETWEEN':'MIN',stackCounterAlignItems:align,
      stackPrimarySizing:horizontal&&source.intrinsicWidth||!horizontal&&source.intrinsicHeight?'RESIZE_TO_FIT':'FIXED',stackCounterSizing:'FIXED',
      stackVerticalPadding:Math.max(0,top),stackPaddingRight:Math.max(0,right),stackPaddingBottom:Math.max(0,bottom),stackHorizontalPadding:Math.max(0,left)});
    for(const child of flow){
      child.stackPositioning='AUTO';child.stackChildAlignSelf='AUTO';
      const b=boxes[flow.indexOf(child)];
      if(!horizontal&&near(b.x,left)&&near(b.w,parent.size.x-left-right))child.stackChildAlignSelf='STRETCH';
      const childSource=sources.get(key(child));
      if(childSource?.flexGrow&&childSource.flexGrow>0)child.stackChildPrimaryGrow=childSource.flexGrow;
    }
    for(const child of overlays)child.stackPositioning='ABSOLUTE';
    return true;
  }
  // Wrapped chip rows: require actual wrapping intent and reproduce row bounds.
  if(source.flexWrap!=='wrap')return false;
  const rows:typeof boxes[]=[];
  for(const box of boxes){const row=rows.at(-1);if(row&&near(row[0].y,box.y))row.push(box);else rows.push([box]);}
  if(rows.length<2||rows.some(row=>!near(row[0].x,rows[0][0].x)||row.some(b=>!near(b.h,row[0].h))))return false;
  const gaps=rows.flatMap(row=>row.slice(1).map((b,i)=>b.x-row[i].x-row[i].w));
  const rowGaps=rows.slice(1).map((row,i)=>row[0].y-rows[i][0].y-rows[i][0].h);
  if(!gaps.length||!uniform(gaps)||!uniform(rowGaps))return false;
  const left=rows[0][0].x,top=rows[0][0].y,right=source.padding[1];
  const inner=parent.size.x-left-right;
  for(let i=1;i<rows.length;i++){
    const previous=rows[i-1],used=previous.at(-1)!.x+previous.at(-1)!.w-left;
    if(used+gaps[0]+rows[i][0].w<=inner+1)return false;
  }
  Object.assign(parent,{stackMode:'HORIZONTAL',stackWrap:'WRAP',stackSpacing:gaps[0],stackCounterSpacing:rowGaps[0],stackPrimaryAlignItems:'MIN',stackCounterAlignItems:'MIN',stackPrimarySizing:'FIXED',stackCounterSizing:source.intrinsicHeight?'RESIZE_TO_FIT':'FIXED',stackHorizontalPadding:left,stackVerticalPadding:top,stackPaddingRight:right,stackPaddingBottom:Math.max(0,parent.size.y-rows.at(-1)![0].y-rows.at(-1)![0].h)});
  for(const child of flow){child.stackPositioning='AUTO';child.stackChildAlignSelf='AUTO';}
  for(const child of overlays)child.stackPositioning='ABSOLUTE';
  return true;
}
