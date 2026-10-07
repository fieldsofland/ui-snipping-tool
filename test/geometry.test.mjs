import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const { outputFiles } = await build({ entryPoints: ['src/geometry.ts'], bundle: true, write: false, format: 'esm' });
const { panelPosition } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
test('places panel below a component when space is available', () => {
  assert.deepEqual(panelPosition({left:100,top:100,bottom:200},1000,800,200),{left:100,top:210});
});
test('moves panel above a component near the bottom and clamps right edge', () => {
  assert.deepEqual(panelPosition({left:950,top:550,bottom:750},1000,800,200),{left:708,top:340});
});
test('keeps panel on screen for a component spanning the viewport', () => {
  assert.deepEqual(panelPosition({left:-100,top:-50,bottom:1000},1000,800,200),{left:12,top:12});
});
