import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {encodeFigmaData,decodeFigmaData} from '@figit/fig-kiwi';
const {outputFiles}=await build({entryPoints:['src/layout.ts'],bundle:true,write:false,format:'esm'});
const {inferAutoLayout}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const node=(id,x,y,w,h)=>({guid:{sessionID:0,localID:id},type:'FRAME',name:'Item',size:{x:w,y:h},transform:{m00:1,m11:1,m01:0,m10:0,m02:x,m12:y},stackMode:'NONE'});
const source=(extra={})=>({normalFlowChildren:true,display:'block',flexDirection:'row',padding:[8,8,8,8],...extra});
test('card stacks infer padding, gaps, Fill width, and Hug height',()=>{
 const p=node(3,0,0,200,100),a=node(4,12,10,176,20),b=node(5,12,38,176,52);
 assert.equal(inferAutoLayout(p,[a,b],source({intrinsicHeight:true}),new Map()),true);
 assert.equal(p.stackMode,'VERTICAL');assert.equal(p.stackSpacing,8);assert.equal(p.stackVerticalPadding,10);assert.equal(p.stackHorizontalPadding,12);
 assert.equal(p.stackPrimarySizing,'RESIZE_TO_FIT');assert.equal(a.stackChildAlignSelf,'STRETCH');
});
test('navigation row with distributed space preserves SPACE_BETWEEN',()=>{
 const p=node(3,0,0,200,36),a=node(4,8,8,40,20),b=node(5,152,8,40,20);
 inferAutoLayout(p,[a,b],source({justifyContent:'space-between'}),new Map());
 assert.equal(p.stackPrimaryAlignItems,'SPACE_BETWEEN');assert.equal(p.stackPrimarySizing,'FIXED');
});
test('normal-flow list retains floating overlay coordinates',()=>{
 const p=node(3,0,0,200,100),a=node(4,8,8,184,30),b=node(5,8,46,184,46),overlay=node(6,170,0,20,20);
 assert.equal(inferAutoLayout(p,[a,b,overlay],source({normalFlowChildren:false}),new Map([['0:6',{position:'absolute'}]])),true);
 assert.equal(overlay.stackPositioning,'ABSOLUTE');assert.equal(overlay.transform.m02,170);assert.equal(a.stackPositioning,'AUTO');
});
test('wrapping chips infer horizontal and vertical gaps and survive encoding',()=>{
 const p=node(3,0,0,130,64),a=node(4,8,8,50,20),b=node(5,64,8,50,20),c=node(6,8,36,50,20);
 assert.equal(inferAutoLayout(p,[a,b,c],source({flexWrap:'wrap',intrinsicHeight:true}),new Map()),true);
 assert.equal(p.stackWrap,'WRAP');assert.equal(p.stackSpacing,6);assert.equal(p.stackCounterSpacing,8);
 const {figBytes}=encodeFigmaData({type:'NODE_CHANGES',nodeChanges:[{...p,phase:'CREATED'}],blobs:[]});
 assert.equal(decodeFigmaData(figBytes).message.nodeChanges[0].stackWrap,'WRAP');
});
test('overlap, rotation, inconsistent gaps, and multi-column grids are not forced into layout',()=>{
 for(const boxes of [[[8,8],[18,8]],[[8,8],[70,8],[140,8]],[[8,8],[70,8],[8,40],[70,40]]]){
  const p=node(3,0,0,200,100),children=boxes.map(([x,y],i)=>node(i+4,x,y,40,20));
  assert.equal(inferAutoLayout(p,children,source(),new Map()),false);
 }
 const p=node(3,0,0,100,40),a=node(4,8,8,20,20),b=node(5,40,8,20,20);b.transform.m01=.5;
 assert.equal(inferAutoLayout(p,[a,b],source(),new Map()),false);
});
test('existing Auto Layout and multiline text widths remain intact',()=>{
 const p=node(3,0,0,200,100),a={...node(4,8,8,184,30),type:'TEXT',textAutoResize:'HEIGHT'},b=node(5,8,46,184,46);
 inferAutoLayout(p,[a,b],source(),new Map());assert.equal(a.size.x,184);assert.equal(a.textAutoResize,'HEIGHT');
 const spacing=p.stackSpacing;assert.equal(inferAutoLayout(p,[a,b],source(),new Map()),false);assert.equal(p.stackSpacing,spacing);
});
test('button layout uses browser text bounds instead of fallback font glyph sizes',()=>{
 const p=node(3,0,0,52,19.5),label=node(4,0,2.5,34,24),count=node(5,30,.5,22,18);
 assert.equal(inferAutoLayout(p,[label,count],source({controlContent:true,bounds:{x:100,y:200,w:52,h:19.5}}),new Map([
 ['0:4',{bounds:{x:100,y:202.5,w:26,h:14}}],['0:5',{bounds:{x:130,y:200.5,w:22,h:18}}]
 ])),true);
 assert.equal(p.stackMode,'HORIZONTAL');assert.equal(p.stackSpacing,4);assert.equal(p.stackCounterAlignItems,'CENTER');
});
