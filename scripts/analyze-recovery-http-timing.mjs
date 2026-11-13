// Run after PasswordRecoveryTimingIntegrationTest. No account identifiers are stored in the CSV.
import fs from 'node:fs';
const file = process.argv[2] || 'backend/target/recovery-http-timing.csv';
const rows = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).slice(1).map(line => {
  const [pair, first, present, absent] = line.split(',');
  if (!/^\d+$/.test(pair) || !['true','false'].includes(first)) throw Error('Invalid timing row');
  return [Number(present) / 1e6, Number(absent) / 1e6];
});
if (rows.length < 200 || rows.some(([a,b]) => !Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0))
  throw Error('At least 200 valid randomized HTTP pairs required');
const median = values => {
  const sorted = values.toSorted((a,b) => a-b), n = sorted.length;
  return (sorted[(n-1)>>1] + sorted[n>>1]) / 2;
};
const auc = sample => {
  const present = sample.map(x=>x[0]), absent = sample.map(x=>x[1]).toSorted((a,b)=>a-b);
  let wins = 0;
  for (const value of present) {
    let lo=0, hi=absent.length;
    while(lo<hi){const m=(lo+hi)>>1;if(absent[m]<value)lo=m+1;else hi=m}
    wins += lo;
  }
  return wins / (present.length * absent.length);
};
let seed=42026;
const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
const replicates=2000, diffs=[], aucs=[];
for(let i=0;i<replicates;i++) {
  const sample=Array.from({length:rows.length},()=>rows[Math.floor(random()*rows.length)]);
  diffs.push(median(sample.map(([a,b])=>a-b)));
  aucs.push(auc(sample));
}
diffs.sort((a,b)=>a-b); aucs.sort((a,b)=>a-b);
const ci = a => [a[49],a[1950]].map(v=>Math.round(v*1000)/1000);
const paired = rows.map(([a,b])=>a-b);
const result = {
  pairs:rows.length, existingMedianMs:median(rows.map(x=>x[0])),
  unknownMedianMs:median(rows.map(x=>x[1])),
  pairedMedianDifferenceMs:median(paired), pairedMedianCi95Ms:ci(diffs),
  singleRequestAuc:auc(rows), singleRequestAucCi95:ci(aucs),
  existingSlowerFraction:paired.filter(x=>x>0).length/rows.length,
  criterion:'95% paired-median CI within +/-2 ms and single-request AUC CI within [0.40,0.60]',
  accepted:ci(diffs)[0]>=-2 && ci(diffs)[1]<=2 && ci(aucs)[0]>=0.40 && ci(aucs)[1]<=0.60
};
console.log(JSON.stringify(result,null,2));
if(!result.accepted)process.exitCode=1;
