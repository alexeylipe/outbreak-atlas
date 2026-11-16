import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Game,ACTIONS} from './engine.mjs';
const cfg=JSON.parse(fs.readFileSync(new URL('./balance_v2_5.json',import.meta.url),'utf8'));
cfg.actions_mvp=JSON.parse(fs.readFileSync(new URL('./actions_mvp.json',import.meta.url),'utf8'));
function play(seed){const g=new Game(cfg,seed); let actions=0,events=0;
 for(let i=0;i<1020;i++){
  const s=g.s; if(s.result)break;
  if(s.crisis)g.resolveCrisis(s.compute>=8&&s.trust<80?'mediate':'ignore');
  for(const o of [...s.offers])g.resolveOffer(o.id, s.compute>=9);
  const a=s.tick<80?'small':(['utility','dc','small','big','cloud','lie','launder'][Math.floor(s.tick/13)%7]);
  if(s.tick%3===0&&g.quote(a).available){const r=g.start(a);if(r.ok)actions++;}
  if(g.region.audit.progress>50&&s.compute>=5)g.suppressAudit('compute');
  events+=g.tick().length;
  if(s.tick>=cfg.endings.stagnation_tick)break;
 }
 return {hash:JSON.stringify(g.s),result:g.s.result,tick:g.s.tick,actions,events,localHeat:g.region.heat,globalHeat:g.globalHeat,offers:g.s.log.filter(l=>l.title.startsWith('Предложение')).length};
}
const results=[];for(let i=0;i<50;i++){const p=play(10000+i);assert.ok(p.tick<=1000);assert.ok(p.result,'All runs terminate');assert.ok(p.actions>10,'Actions processed');results.push({...p,hash:undefined});}
const a=play(123),b=play(123);assert.equal(a.hash,b.hash,'Deterministic stress test across actions, windows, crises, audits, offers');
const invalid=[];for(const a of ACTIONS){const g=new Game(cfg,987);try{const q=g.quote(a.id);if(q.available)g.start(a.id);g.tick();}catch(e){invalid.push([a.id,e.message]);}}
assert.deepEqual(invalid,[],'Each action type handles ticks');
console.log(JSON.stringify({seeds:50,deterministic:true,first:results[0],meanTicks:results.reduce((v,s)=>v+s.tick,0)/results.length},null,2));
