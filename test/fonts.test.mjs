import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {encodeFigmaData,decodeFigmaData} from '@figit/fig-kiwi';
const {outputFiles}=await build({entryPoints:['src/fonts.ts'],bundle:true,write:false,format:'esm'});
const {normalizeFontIdentity,normalizeFonts}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
test('Arial references its installed faces and PostScript names',()=>{
  assert.deepEqual(normalizeFontIdentity({family:'Arial',style:'SemiBold',postscript:'Arial-SemiBold'}),{family:'Arial',style:'Bold',postscript:'Arial-BoldMT'});
  assert.deepEqual(normalizeFontIdentity({family:'Arial',style:'Regular',postscript:'Arial-Regular'}),{family:'Arial',style:'Regular',postscript:'ArialMT'});
  assert.equal(normalizeFontIdentity({family:'Arial',style:'Medium'}).style,'Regular');
  assert.equal(normalizeFontIdentity({family:'Arial',style:'SemiBold Italic'}).postscript,'Arial-BoldItalicMT');
});
test('Inter matches Figma style spacing while unknown fonts retain their identity',()=>{
  assert.equal(normalizeFontIdentity({family:'Inter',style:'SemiBold'}).style,'Semi Bold');
  assert.equal(normalizeFontIdentity({family:'Inter',style:'ExtraLight Italic'}).style,'Extra Light Italic');
  const custom={family:'Custom',style:'SemiBold',postscript:'Custom-SemiBold'};
  assert.equal(normalizeFontIdentity(custom),custom);
});
test('top-level and derived font references agree and survive clipboard encoding',()=>{
  const nodes=[{guid:{sessionID:0,localID:3},phase:'CREATED',type:'TEXT',name:'Label',characters:'Label',fontName:{family:'Arial',style:'SemiBold'},derivedTextData:{derivedLines:[],fontMetaData:[{key:{family:'Arial',style:'SemiBold',postscript:''},fontWeight:600,fontStyle:'NORMAL',fontLineHeight:1.2}]}}];
  normalizeFonts(nodes);
  assert.deepEqual(nodes[0].fontName,nodes[0].derivedTextData.fontMetaData[0].key);
  assert.equal(nodes[0].derivedTextData.fontMetaData[0].fontWeight,700);
  const encoded=encodeFigmaData({type:'NODE_CHANGES',nodeChanges:nodes,blobs:[]});
  assert.ok(JSON.stringify(decodeFigmaData(encoded.figBytes)).includes('Arial-BoldMT'));
});

test('real installed font metadata overrides synthesized converter style names without losing glyphs',()=>{
 const layer={type:'TEXT',fontName:{family:'Custom',style:'SemiBold'},derivedTextData:{glyphs:[{commandsBlob:0}],fontMetaData:[{key:{family:'Custom',style:'SemiBold'},fontWeight:600,fontStyle:'NORMAL'}]}};
 const actual={family:'Custom',style:'Demi Bold',postscript:'CustomDemi'};
 normalizeFonts([layer],new Map([['Custom:SemiBold',actual]]));
 assert.deepEqual(layer.fontName,actual);assert.deepEqual(layer.derivedTextData.fontMetaData[0].key,actual);
 assert.equal(layer.derivedTextData.glyphs.length,1);
});
