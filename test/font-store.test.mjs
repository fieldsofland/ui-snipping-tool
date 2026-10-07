import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/font-store.ts'],bundle:true,write:false,format:'esm'});
const {matchFont,styleWeight}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const fonts=[400,700].flatMap(weight=>[false,true].map(italic=>({family:'Arial',weight,italic,style:`${weight} ${italic}`})));
test('installed Arial faces follow browser CSS weight and italic matching',()=>{
 assert.equal(matchFont(fonts,'Arial',600,false).weight,700);
 assert.equal(matchFont(fonts,'Arial',500,false).weight,400);
 assert.equal(matchFont(fonts,'Arial',300,false).weight,400);
 assert.equal(matchFont(fonts,'Arial',800,true).weight,700);
 assert.equal(matchFont(fonts,'Arial',800,true).italic,true);
 assert.equal(matchFont(fonts,'Unknown',400,false),undefined);
});
test('installed style names resolve their actual weight',()=>{
 for(const [style,weight] of [['Regular',400],['Semi Bold',600],['Extra Bold Italic',800],['Extra Light',200],['Bold',700],['Medium',500]]) assert.equal(styleWeight(style),weight);
});
