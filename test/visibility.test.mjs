import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/visibility.ts'],bundle:true,write:false,format:'esm'});
const {isVisuallyClipped}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const visible={clipPath:'none',clip:'auto',width:'24px',height:'24px',position:'static',overflow:'visible',overflowX:'visible',overflowY:'visible'};
test('screen reader labels clipped by modern or legacy CSS are omitted',()=>{
  assert.equal(isVisuallyClipped({...visible,clipPath:'inset(50%)'}),true);
  assert.equal(isVisuallyClipped({...visible,clipPath:'inset(0% 50%)'}),true);
  assert.equal(isVisuallyClipped({...visible,clip:'rect(0px, 0px, 0px, 0px)'}),true);
  assert.equal(isVisuallyClipped({...visible,width:'1px',height:'1px',overflow:'hidden',position:'absolute'}),true);
});
test('visible icons, revealed labels, and partial clipping remain capturable',()=>{
  assert.equal(isVisuallyClipped(visible),false);
  assert.equal(isVisuallyClipped({...visible,clipPath:'inset(10% 20%)'}),false);
  assert.equal(isVisuallyClipped({...visible,width:'1px',height:'1px'}),false);
});
