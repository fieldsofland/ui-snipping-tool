import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/clipboard.ts'],bundle:true,write:false,format:'esm'});
const {writePreparedHtml}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
test('requests clipboard before cold preparation and waits for both payload and write',async t=>{
  const events=[];
  globalThis.ClipboardItem=class {constructor(data){this.data=data;}};
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{write:async ([item])=>{
    events.push('write');const blob=await item.data['text/html'];assert.equal(blob.type,'text/html');assert.equal(await blob.text(),'<b>Figma</b>');events.push('done');
  }}}});
  await writePreparedHtml(async()=>{events.push('prepare');await Promise.resolve();return '<b>Figma</b>';});
  assert.deepEqual(events,['write','prepare','done']);
});
test('preparation failure rejects the write rather than reporting copied',async()=>{
  globalThis.ClipboardItem=class {constructor(data){this.data=data;}};
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{write:async ([item])=>{await item.data['text/html'];}}}});
  await assert.rejects(writePreparedHtml(async()=>{throw new Error('Font fetch failed');}),/Font fetch failed/);
});
