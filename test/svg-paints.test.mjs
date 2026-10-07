import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {encodeFigmaData,decodeFigmaData} from '@figit/fig-kiwi';
const {outputFiles}=await build({entryPoints:['src/svg-paints.ts'],bundle:true,write:false,format:'esm'});
const {solidPaint,linearPaint,parsePaintColor}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
test('SVG stroke multiplies color alpha and stroke opacity without baking element opacity',()=>{
 assert.ok(Math.abs(solidPaint('rgb(255 255 255 / 10%)',.5)[0].opacity-.05)<1e-8);
 assert.equal(solidPaint('white',.25)[0].opacity,.25);
 assert.equal(solidPaint('transparent')[0].opacity,0);
 assert.deepEqual(solidPaint('none'),[]);
});
test('modern resolved CSS token color preserves alpha',()=>{
 const color=parsePaintColor('oklch(1 0 0 / 5%)');assert.ok(Math.abs(color.a-.05)<1e-8);assert.ok(color.r>.99);
});
test('vertical SVG area gradient keeps stop alpha, offsets, and correct direction',()=>{
 const paint=linearPaint({x:0,y:0},{x:0,y:1},[{color:{r:1,g:1,b:1,a:.8},position:.05},{color:{r:1,g:1,b:1,a:.1},position:.95}]);
 assert.equal(paint.type,'GRADIENT_LINEAR');assert.equal(paint.stops[0].color.a,.8);assert.equal(paint.stops[1].color.a,.1);
 assert.equal(paint.transform.m01,1);assert.ok(Math.abs(paint.transform.m02)<1e-8);
 const encoded=encodeFigmaData({type:'NODE_CHANGES',nodeChanges:[{guid:{sessionID:0,localID:3},phase:'CREATED',type:'VECTOR',name:'Area',fillPaints:[paint],strokePaints:solidPaint('white',.05)}],blobs:[]});
 const decoded=JSON.stringify(decodeFigmaData(encoded.figBytes));assert.ok(decoded.includes('GRADIENT_LINEAR'));
});
test('degenerate gradients do not produce infinite transforms',()=>{
 assert.equal(linearPaint({x:0,y:0},{x:0,y:0},[{color:{r:1,g:1,b:1,a:1},position:0}]),null);
});
