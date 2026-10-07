import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { encodeFigmaData, decodeFigmaData } from '@figit/fig-kiwi';
const { outputFiles } = await build({ entryPoints:['src/normalize.ts'],bundle:true,write:false,format:'esm' });
const { normalizeLayers, layerName, reduceWrappers } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const guid = localID => ({sessionID:0,localID});
const layer = (id,parent,type='FRAME') => ({guid:guid(id),type,name:'Container',parentIndex:{guid:guid(parent),position:'0'},size:{x:320,y:40},transform:{m00:1,m01:0,m02:20,m10:0,m11:1,m12:20},stackMode:'NONE'});
const source = overrides => ({tag:'div',id:'',classes:[],role:null,display:'block',alignItems:'normal',flexDirection:'row',gap:0,textAlign:'center',padding:[0,0,0,0],multiline:false,...overrides});
test('removes export wrapper, preserving real root and its descendants',()=>{
  const layers=[layer(2,1),layer(3,2),layer(4,3,'TEXT')];
  const result=normalizeLayers(layers,guid(2),new Map());
  assert.deepEqual(result.map(n=>n.guid.localID),[3,4]);
  assert.equal(result[0].parentIndex.guid.localID,1);
  assert.equal(result[0].transform.m02,0);
  assert.equal(result[1].parentIndex.guid.localID,3);
});
test('single-line text hugs while multiline preserves width and grows in height',()=>{
  const one=layer(4,3,'TEXT'), multi=layer(5,3,'TEXT');one.stackChildAlignSelf='STRETCH';
  normalizeLayers([one,multi],guid(2),new Map([['0:4',source({})],['0:5',source({multiline:true})]]));
  assert.equal(one.textAutoResize,'WIDTH_AND_HEIGHT');assert.equal(one.stackChildAlignSelf,'AUTO');
  assert.equal(multi.textAutoResize,'HEIGHT');assert.equal(multi.size.x,320);
});
test('baseline flex text row keeps CSS gap and becomes native Auto Layout',()=>{
  const row=layer(3,2), a=layer(4,3,'TEXT'), b=layer(5,3,'TEXT');
  normalizeLayers([row,a,b],guid(2),new Map([['0:3',source({display:'flex',alignItems:'baseline',gap:8,classes:['price']})]]));
  assert.equal(row.stackMode,'HORIZONTAL');assert.equal(row.stackCounterAlignItems,'BASELINE');assert.equal(row.stackSpacing,8);assert.equal(row.name,'price-container');
});
test('simple button centers its label with CSS padding and hug height',()=>{
  const button=layer(3,2),text=layer(4,3,'TEXT');
  normalizeLayers([button,text],guid(2),new Map([['0:3',source({tag:'button',padding:[14,14,14,14]})]]));
  assert.equal(button.stackMode,'HORIZONTAL');assert.equal(button.stackPrimaryAlignItems,'CENTER');assert.equal(button.stackCounterSizing,'RESIZE_TO_FIT');assert.equal(button.stackHorizontalPadding,14);
  assert.equal(text.stackPositioning,'AUTO');
});
test('preserves deliberate absolute positioning and complex buttons',()=>{
  const button=layer(3,2),icon=layer(4,3,'VECTOR'),text=layer(5,3,'TEXT');
  normalizeLayers([button,icon,text],guid(2),new Map([['0:3',source({tag:'button'})]]));
  assert.equal(button.stackMode,'NONE');
});
test('uses useful semantic names and text-only fallback',()=>{
  assert.equal(layerName(source({}),true),'text-container');
  assert.equal(layerName(source({classes:['css-12abcd','card']}),false),'card-container');
  assert.equal(layerName(source({tag:'ul'}),true),'list-container');
});
test('normalized native properties survive actual clipboard encoding',()=>{
  const nodes=[layer(2,1),layer(3,2),layer(4,3,'TEXT')];nodes[2].characters='Label';
  const result=normalizeLayers(nodes,guid(2),new Map([['0:3',source({tag:'button'})],['0:4',source({})]]));
  const encoded=encodeFigmaData({type:'NODE_CHANGES',nodeChanges:result,blobs:[]});
  const decoded=decodeFigmaData(encoded.figBytes);
  assert.ok(encoded.figBytes.length>0);
  assert.ok(JSON.stringify(decoded).includes('WIDTH_AND_HEIGHT'));
  assert.ok(JSON.stringify(decoded).includes('HORIZONTAL'));
});
test('does not convert a baseline row with deliberately absolute text',()=>{
  const row=layer(3,2),a=layer(4,3,'TEXT');a.stackPositioning='ABSOLUTE';
  normalizeLayers([row,a],guid(2),new Map([['0:3',source({display:'flex',alignItems:'baseline'})]]));
  assert.equal(row.stackMode,'NONE');assert.equal(a.stackPositioning,'ABSOLUTE');
});

const emptyWrapper = (id, parent) => ({ ...layer(id, parent), frameMaskDisabled:true, fillPaints:[],strokePaints:[],effects:[],opacity:1,transform:{m00:1,m01:0,m02:0,m10:0,m11:1,m12:0},stackMode:'VERTICAL',stackPrimarySizing:'RESIZE_TO_FIT',stackCounterSizing:'FIXED' });
test('reduces eight empty nested frames to their actual component',()=>{
  const nodes=Array.from({length:8},(_,i)=>emptyWrapper(i+2,i+1));
  const card=emptyWrapper(10,9);card.fillPaints=[{opacity:1}];nodes.push(card);
  const sources=new Map(nodes.map(n=>[`0:${n.guid.localID}`,source({})]));
  const result=reduceWrappers(nodes,sources);
  assert.equal(result.length,1);assert.equal(result[0].guid.localID,10);assert.equal(result[0].parentIndex.guid.localID,1);
});
test('retains visual, clipping, padding, semantic, and sizing boundaries',()=>{
  for(const patch of [{fillPaints:[{opacity:1}]},{strokePaints:[{opacity:1}]},{effects:[{visible:true}]},{opacity:.5},{frameMaskDisabled:false},{stackHorizontalPadding:8},{minSize:{x:100}},{size:{x:400,y:40}},{transform:{m00:1.1,m01:0,m02:0,m10:0,m11:1,m12:0}}]){
    const wrapper={...emptyWrapper(2,1),...patch},child=emptyWrapper(3,2);
    assert.equal(reduceWrappers([wrapper,child],new Map([['0:2',source({})]])).length,2,JSON.stringify(patch));
  }
  for(const boundary of [source({role:'button'}),source({semanticBoundary:true}),source({sizingBoundary:true}),source({clippingBoundary:true}),source({tag:'article'})]){
    assert.equal(reduceWrappers([emptyWrapper(2,1),emptyWrapper(3,2)],new Map([['0:2',boundary]])).length,2);
  }
});
test('preserves parent position, sibling order, fill sizing, and child contents',()=>{
  const parent=layer(1,0),wrapper=emptyWrapper(2,1),child=emptyWrapper(3,2),text=layer(4,3,'TEXT'),sibling=layer(5,1);
  wrapper.parentIndex.position='2';wrapper.transform.m02=100;wrapper.transform.m12=80;wrapper.stackChildAlignSelf='STRETCH';wrapper.stackChildPrimaryGrow=1;
  child.stackMode='HORIZONTAL';
  const result=reduceWrappers([parent,wrapper,child,text,sibling],new Map([['0:2',source({})]]));
  assert.equal(result.length,4);assert.equal(child.parentIndex.position,'2');assert.equal(child.parentIndex.guid.localID,1);
  assert.equal(child.transform.m02,100);assert.equal(child.transform.m12,80);assert.equal(child.stackChildAlignSelf,'STRETCH');assert.equal(child.stackChildPrimaryGrow,1);
  assert.equal(child.stackPrimarySizing,'FIXED');assert.equal(child.stackCounterSizing,'RESIZE_TO_FIT');assert.equal(text.parentIndex.guid.localID,3);
});
test('retains multi-child grouping and single text alignment wrappers',()=>{
  assert.equal(reduceWrappers([emptyWrapper(2,1),emptyWrapper(3,2),emptyWrapper(4,2)],new Map([['0:2',source({})]])).length,3);
  assert.equal(reduceWrappers([emptyWrapper(2,1),layer(3,2,'TEXT')],new Map([['0:2',source({})]])).length,2);
});
test('inline icon label and count rows become centered Auto Layout with measured gaps',()=>{
  const row=layer(3,2),icon=layer(4,3),label=layer(5,3,'TEXT');
  row.size={x:70,y:20};icon.size={x:16,y:16};label.size={x:50,y:20};
  icon.transform.m02=0;icon.transform.m12=2;label.transform.m02=20;label.transform.m12=0;
  icon.stackPositioning=label.stackPositioning='ABSOLUTE';
  normalizeLayers([row,icon,label],guid(2),new Map([['0:3',source({display:'inline',normalFlowChildren:true})]]));
  assert.equal(row.stackMode,'HORIZONTAL');assert.equal(row.stackSpacing,4);
  assert.equal(row.stackCounterSizing,'FIXED');assert.equal(icon.stackPositioning,'AUTO');
});
test('padded counter span becomes Auto Layout while retaining its source dimensions',()=>{
  const badge=layer(3,2),text=layer(4,3,'TEXT');text.stackPositioning='ABSOLUTE';
  normalizeLayers([badge,text],guid(2),new Map([['0:3',source({tag:'span',classes:['Counter'],padding:[2,7,2,7],normalFlowChildren:true})]]));
  assert.equal(badge.name,'badge');assert.equal(badge.stackMode,'HORIZONTAL');assert.equal(badge.stackCounterSizing,'FIXED');assert.equal(badge.stackHorizontalPadding,7);
});
test('overlapping and deliberately positioned content remains a regular frame',()=>{
  for(const explicit of [true,false]){
    const row=layer(3,2),a=layer(4,3),b=layer(5,3);a.size=b.size={x:20,y:20};a.transform.m02=0;b.transform.m02=explicit?24:10;
    normalizeLayers([row,a,b],guid(2),new Map([['0:3',source({normalFlowChildren:!explicit})]]));
    assert.equal(row.stackMode,'NONE');
  }
});
test('GitHub single-row grid contents and inline label/count line boxes become centered Auto Layout',()=>{
  const grid=layer(3,2),icon=layer(4,3),labelRow=layer(5,3),text=layer(6,5,'TEXT'),count=layer(7,5);
  grid.size={x:71.71,y:19.5};icon.size={x:16,y:16};labelRow.size={x:51.71,y:19.5};
  icon.transform.m02=0;icon.transform.m12=1.75;labelRow.transform.m02=20;labelRow.transform.m12=0;
  text.size={x:25.71,y:19.5};text.transform.m02=0;text.transform.m12=2.5;
  count.size={x:22,y:18};count.transform.m02=29.71;count.transform.m12=.5;
  normalizeLayers([grid,icon,labelRow,text,count],guid(2),new Map([
    ['0:3',source({display:'grid',normalFlowChildren:true})],
    ['0:5',source({display:'inline',normalFlowChildren:true})]
  ]));
  assert.equal(grid.stackMode,'HORIZONTAL');assert.equal(labelRow.stackMode,'HORIZONTAL');
  assert.equal(grid.stackCounterAlignItems,'CENTER');assert.equal(labelRow.stackCounterAlignItems,'CENTER');
  assert.ok(Math.abs(labelRow.stackSpacing-4)<1e-8);
});
test('single-column grids become vertical rather than horizontal Auto Layout',()=>{
  const grid=layer(3,2),a=layer(4,3),b=layer(5,3);
  a.size=b.size={x:16,y:16};a.transform.m12=0;b.transform.m12=24;
  normalizeLayers([grid,a,b],guid(2),new Map([['0:3',source({display:'grid',normalFlowChildren:true})]]));
  assert.equal(grid.stackMode,'VERTICAL');
});
test('badge centers its text independently of undersized CSS line height',()=>{
 const badge=layer(3,2),text=layer(4,3,'TEXT');badge.size={x:22,y:18};
 normalizeLayers([badge,text],guid(2),new Map([['0:3',source({tag:'span',classes:['Counter'],padding:[3,7,3,7]})]]));
 assert.equal(text.textAlignVertical,'CENTER');assert.equal(badge.stackVerticalPadding,0);assert.equal(badge.stackPaddingBottom,0);
});
test('button ancestry supplies layout fallback when inline trace bounds are unsuitable',()=>{
 const button=layer(3,2),row=layer(4,3),text=layer(5,4,'TEXT'),badge=layer(6,4);
 row.size={x:52,y:19.5};text.size={x:26,y:14};text.transform.m02=0;text.transform.m12=2.5;badge.size={x:22,y:18};badge.transform.m02=30;badge.transform.m12=.5;
 normalizeLayers([button,row,text,badge],guid(2),new Map([
 ['0:3',source({tag:'button'})],['0:4',source({normalFlowChildren:false,alignItems:'baseline'})]
 ]));
 assert.equal(row.stackMode,'HORIZONTAL');assert.equal(row.stackCounterAlignItems,'CENTER');assert.equal(row.stackSpacing,4);
});
test('single-line button text centers glyphs within its captured line box',()=>{
 const button=layer(3,2),text=layer(4,3,'TEXT');
 normalizeLayers([button,text],guid(2),new Map([['0:3',source({tag:'button'})],['0:4',source({tag:'span'})]]));
 assert.equal(text.textAlignVertical,'CENTER');assert.equal(text.textAutoResize,'WIDTH_AND_HEIGHT');
});
test('control cached glyphs lose excess line-box leading without removing glyph data',()=>{
 const button=layer(3,2),text=layer(4,3,'TEXT');text.size={x:26,y:14};text.lineHeight={units:'PIXELS',value:19.5};
 text.derivedTextData={glyphs:[{position:{x:0,y:13}}],baselines:[{position:{x:0,y:13}}]};
 normalizeLayers([button,text],guid(2),new Map([['0:3',source({tag:'button'})],['0:4',source({tag:'span'})]]));
 assert.equal(text.derivedTextData.glyphs[0].position.y,10.25);assert.equal(text.derivedTextData.baselines[0].position.y,10.25);
 assert.equal(text.lineHeight.value,19.5);assert.equal(text.derivedTextData.glyphs.length,1);
});
