import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {encodeFigmaData,decodeFigmaData} from '@figit/fig-kiwi';

// Expose the pinned converter's actual parser only in this test bundle.
const {outputFiles}=await build({entryPoints:['@figit/dom-to-figma'],bundle:true,write:false,format:'esm',plugins:[{
  name:'test-shadow-parser',setup(builder){
    builder.onLoad({filter:/dom-to-figma\/dist\/figma\.mjs$/},async ({path})=>({
      contents:await readFile(path,'utf8')+'\nexport {cssBoxShadowToFigmaEffects};',loader:'js'
    }));
  }
}]});
const {cssBoxShadowToFigmaEffects}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
test('outer and inset box shadows retain offsets, blur, spread, and color alpha',()=>{
  const effects=cssBoxShadowToFigmaEffects('rgba(0, 0, 0, 0.25) 2px 8px 12px 3px, inset rgb(255 255 255 / 40%) -1px -2px 4px -1px');
  assert.equal(effects.length,2);
  assert.equal(effects[0].type,'DROP_SHADOW');
  assert.deepEqual(effects[0].offset,{x:2,y:8});
  assert.equal(effects[0].radius,12);assert.equal(effects[0].spread,3);assert.equal(effects[0].color.a,.25);
  assert.equal(effects[1].type,'INNER_SHADOW');
  assert.deepEqual(effects[1].offset,{x:-1,y:-2});
  assert.equal(effects[1].radius,4);assert.equal(effects[1].spread,-1);assert.equal(effects[1].color.a,.4);
  const encoded=encodeFigmaData({type:'NODE_CHANGES',nodeChanges:[{guid:{sessionID:0,localID:3},phase:'CREATED',type:'FRAME',name:'Shadow card',effects}],blobs:[]});
  const decoded=decodeFigmaData(encoded.figBytes);
  assert.deepEqual(decoded.message.nodeChanges[0].effects.map(e=>e.type),['DROP_SHADOW','INNER_SHADOW']);
});
test('no box shadow produces no effects',()=>assert.deepEqual(cssBoxShadowToFigmaEffects('none'),[]));
