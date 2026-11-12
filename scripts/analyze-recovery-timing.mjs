// Offline, deterministic paired bootstrap/permutation. Contains timings only, no identities.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const file = process.argv[2] || 'backend/target/recovery-timing.csv';
const rows = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).slice(1).map(l => l.split(','));
const a = rows.map(r => Number(r[2]) / 1e6), b = rows.map(r => Number(r[3]) / 1e6);
assert.ok(a.length >= 100 && [...a, ...b].every(x => x > 0 && Number.isFinite(x)));
const quantile = (x, p) => [...x].sort((a,b) => a-b)[Math.ceil(x.length*p)-1];
const median = x => quantile(x, .5);
let state = 42026;
const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
const differences = a.map((v,i) => v-b[i]);
const observed = median(differences), bootstrap = [], ratios = [];
let extreme = 0;
for (let k = 0; k < 10000; k++) {
  const indices = a.map(() => Math.floor(random()*a.length));
  bootstrap.push(median(indices.map(i => differences[i])));
  ratios.push(median(indices.map(i => a[i])) / median(indices.map(i => b[i])));
  const permuted = differences.map(x => random() < .5 ? x : -x);
  if (Math.abs(median(permuted)) >= Math.abs(observed)) extreme++;
}
let dominance = 0;
for (const x of a) for (const y of b) dominance += Math.sign(x-y);
console.log(JSON.stringify({pairs:a.length,warmupPairs:20,seed:42026,iterations:10000,
  existing:{medianMs:median(a),p95Ms:quantile(a,.95)},unknown:{medianMs:median(b),p95Ms:quantile(b,.95)},
  pairedMedianDifferenceMs:observed,pairedBootstrap95Ms:[quantile(bootstrap,.025),quantile(bootstrap,.975)],
  medianRatio:median(a)/median(b),pairedBootstrapRatio95:[quantile(ratios,.025),quantile(ratios,.975)],
  pairedPermutationP:(extreme+1)/10001,cliffsDelta:dominance/(a.length*b.length),
  conclusion:'Diagnostic only; significant separation is NOT timing equivalence. Local service+commit, not WAN latency.'},null,2));
