import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import ts from 'typescript';
import { decodePackedOutcomes } from '../src/lib/outcomes.ts';
const meta=JSON.parse(await readFile(new URL('../public/data/outcomes.meta.json',import.meta.url),'utf8'));
const source=JSON.parse(await readFile(new URL('../public/data/outcomes.source.json',import.meta.url),'utf8'));
const bytes=gunzipSync(await readFile(new URL('../public/data/outcomes.pack.gz',import.meta.url)));
const dataset=decodePackedOutcomes(meta,bytes,source);
assert.equal(dataset.source.rows,34300);
const code=ts.transpileModule(await readFile(new URL('../src/lib/student-field-renderer.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {fieldPosition,projectField,defaultCamera}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
for(const scene of ['chronology','cohorts','ladder','learning']) for(const [width,height] of [[1170,600],[310,430],[280,430]]) {
 let outside=0;
 for(let index=0;index<dataset.source.rows;index++) {
  const year=Number(meta.dict.cohort[dataset.columns.cohort[index]]), day=dataset.columns.eday[index];
  const record={index,year,day,stage:dataset.columns.stage[index],date:Date.UTC(year,8,9+day),pre:dataset.columns.pre_total[index]/10,post:dataset.columns.post_total[index]/10};
  const world=fieldPosition(record,scene),point=projectField(world,defaultCamera(scene),width,height);
  assert.ok([world.x,world.y,world.z,point.x,point.y,point.depth].every(Number.isFinite));
  if(point.x<0||point.x>width||point.y<28||point.y>height-16) outside++;
 }
 assert.equal(outside,0,`${scene} at ${width}: ${outside} records outside the default frame`);
}
console.log('Verified all 34,300 source record coordinates are finite and visible in all four default 3D frames at desktop and phone widths.');
const terrainCode=ts.transpileModule((await readFile(new URL('../src/lib/outcome-terrain.ts',import.meta.url),'utf8')).replace("from './impact-exploration'", "from '"+new URL('../src/lib/impact-exploration.ts',import.meta.url).href+"'"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {buildOutcomeTerrain}=await import('data:text/javascript;base64,'+Buffer.from(terrainCode).toString('base64'));
for(const pair of ['prepost','attendance-gain','attendance-days']) for(const [filters,expected] of [[{},pair==='attendance-days'?28276:34300],[{cohort:'2025',track:'Agent Builder',jurisdiction:'CA',delivery:'Hybrid'},pair==='attendance-days'?28:35],[{cohort:'2027'},0]]) {
 const terrain=buildOutcomeTerrain(dataset,filters,pair);
 assert.equal(terrain.eligibleCount,expected,pair+' exact eligible denominator');
 assert.equal(terrain.raw.reduce((a,b)=>a+b,0),expected);
 assert.ok(Math.abs(terrain.smoothed.reduce((a,b)=>a+b,0)-expected)<.02,'Gaussian mass conservation');
 assert.ok(Array.from(terrain.heights).every(value=>Number.isFinite(value)&&value>=0&&value<=1));
 assert.equal(terrain.bins.reduce((total,bin)=>total+bin.count,0),expected);
 if(pair==='attendance-gain'&&expected>35){assert.ok(terrain.yAxis.min<=-21.9);assert.ok(terrain.yAxis.max>=66.8);}
 if(pair==='attendance-days'&&expected>35)assert.ok(terrain.yAxis.max>=80);
}
console.log('Verified full-population/combined-filter/sealed terrain denominators, exact source bins, Gaussian mass conservation, finite normalized heights and unclipped gain/deployment ranges.');
