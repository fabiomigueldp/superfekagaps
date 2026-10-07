import { writeFileSync } from 'node:fs';
import { STAGES } from '../src/adventure/campaign';
import { CAMPAIGN_NATURAL_GUIDES } from './lib/campaignNaturalGuides';
import { beforeNaturalGuides } from './lib/naturalGuideBaseline';
import { traceNaturalApproach, approachCoins } from './lib/naturalCoinApproach';
const report=[];
for(const p of CAMPAIGN_NATURAL_GUIDES){
 const after=STAGES.find(s=>s.id===p.stage)!,before=beforeNaturalGuides(after),ids=new Set(approachCoins(after,p).map(c=>c.id));
 const variants=p.jump?[false,true].flatMap(run=>[-8,0,8].flatMap(shift=>[3,6,9,12,15,60].map(hold=>({...p.reference,run,shift,hold})))):[false,true].flatMap(run=>[0,30,60].map(offset=>({...p.reference,run,phaseFrames:(p.reference.phaseFrames??0)+offset})));
 const cases=variants.map(variant=>{
  const a=traceNaturalApproach(before,p,variant),b=traceNaturalApproach(after,p,variant);
  return {variant,before:{safe:a.reached&&!a.dead&&!a.damaged,collected:a.collected.filter(id=>ids.has(id)).length},after:{safe:b.reached&&!b.dead&&!b.damaged,collected:b.collected.filter(id=>ids.has(id)).length}};
 });
 const stats=(which:'before'|'after')=>{const safe=cases.filter(c=>c[which].safe);return{safe:safe.length,total:cases.length,mean:safe.reduce((n,c)=>n+c[which].collected,0)/Math.max(1,safe.length),min:Math.min(...safe.map(c=>c[which].collected)),max:Math.max(...safe.map(c=>c[which].collected))}};
 const row={stage:p.stage,firstCoin:p.firstCoin,name:p.name,count:p.count,intent:p.intent,before:stats('before'),after:stats('after'),cases};report.push(row);
 console.log(`${p.stage}:${p.firstCoin} safety ${row.before.safe}/${cases.length}→${row.after.safe}/${cases.length}; mean ${row.before.mean.toFixed(2)}→${row.after.mean.toFixed(2)}/${p.count}; new range ${row.after.min}–${row.after.max}`);
}
writeFileSync('/tmp/feka-natural-guide-audit.json',JSON.stringify(report,null,2));
