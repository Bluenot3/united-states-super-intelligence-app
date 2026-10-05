// USSI Genesis — core: imports, constants, data decoding and aggregation.
// Every number on screen is computed here from the embedded packed records (no hard-coded metrics).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

window.__genesisModule = true;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const params = new URLSearchParams(location.search);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const isNarrow = () => innerWidth <= 900;
const nf = new Intl.NumberFormat('en-US');
const fmt = v => v == null ? '—' : nf.format(Math.round(v));
const pct = (v, d = 1) => v == null || !isFinite(v) ? '—' : (v * 100).toFixed(d) + '%';
const fx = (v, d = 1) => v == null || !isFinite(v) ? '—' : v.toFixed(d);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Deterministic per-record hash so layouts are identical on every device and reload.
function hash(i, k) { let h = (i * 374761393 + k * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function gauss(i, k) { const u = Math.max(1e-6, hash(i, k)), v = hash(i, k + 101); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185 * v); }

const STAGE_LABELS = ['Enrolled, no environment', 'Cloud environment provisioned', 'First live deploy', 'AI in production', 'Persistent data + auth', 'Public launch + custom domain', 'Iterated on user telemetry', 'Capstone + credential'];
const STAGE_SHORT = ['Enrolled', 'Cloud environment', 'First live deploy', 'AI in production', 'Data + auth', 'Public launch', 'Telemetry iteration', 'Capstone'];
const TIER_OF = [0, 0, 1, 1, 2, 2, 3, 4];
const TIER_LABELS = ['No credential', 'Deployer', 'Builder', 'Operator', 'AI Pioneer'];
const STAGE_COLORS = ['#5b3fd1', '#7a6bff', '#3d8bff', '#1fd0f0', '#2ff5b0', '#a8f25a', '#ffb347', '#ffd77a'];
const COHORT_COLORS = ['#ffc46b', '#78f0ff', '#b49bff'];
const TRACK_COLORS = ['#ff79b8', '#5ee0ff', '#ffcf5c', '#7dffb2'];
const CONSTRUCTS = [
  { key: 'Found', label: 'AI Foundations', color: '#78f0ff' },
  { key: 'Prompt', label: 'Prompt & Context Engineering', color: '#b49bff' },
  { key: 'DeployOps', label: 'Build & Deploy Operations', color: '#ffc46b' },
  { key: 'DataPriv', label: 'Data & Privacy', color: '#7dffb2' },
  { key: 'Ethics', label: 'AI Ethics & Governance', color: '#ff79b8' },
];
const APP_SHORT = ['Study assistant', 'Customer-service agent', 'Research summarizer', 'Scheduling agent', 'Language tutor', 'Neighborhood dashboard', 'Fitness tracker', 'Storytelling & comics', 'School explorer', 'Image generator', 'Budget tool', 'Short-form video', 'Music & audio', 'Resource finder', 'Safety & wellness', 'Local government explainer', 'Accessibility tool'];
const HOST_COLORS = ['#ffc46b', '#78f0ff', '#b49bff', '#ff79b8', '#7dffb2'];
const STATE_NAMES = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming' };
const TILE = { AK: [0, 0], ME: [11, 0], WI: [6, 1], VT: [10, 1], NH: [11, 1], WA: [1, 2], ID: [2, 2], MT: [3, 2], ND: [4, 2], MN: [5, 2], IL: [6, 2], MI: [7, 2], NY: [9, 2], MA: [10, 2], OR: [1, 3], NV: [2, 3], WY: [3, 3], SD: [4, 3], IA: [5, 3], IN: [6, 3], OH: [7, 3], PA: [8, 3], NJ: [9, 3], CT: [10, 3], RI: [11, 3], CA: [1, 4], UT: [2, 4], CO: [3, 4], NE: [4, 4], MO: [5, 4], KY: [6, 4], WV: [7, 4], VA: [8, 4], MD: [9, 4], DE: [10, 4], AZ: [2, 5], NM: [3, 5], KS: [4, 5], AR: [5, 5], TN: [6, 5], NC: [7, 5], SC: [8, 5], DC: [9, 5], OK: [4, 6], LA: [5, 6], MS: [6, 6], AL: [7, 6], GA: [8, 6], HI: [1, 7], TX: [4, 7], FL: [9, 7] };
const SEASON_DAYS = 63;
const seasonDate = k => { const c = Math.floor(k / SEASON_DAYS), d = k % SEASON_DAYS; return new Date(Date.UTC(2024 + c, 8, 9 + d)); };
const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

async function decodeData(log) {
  const meta = JSON.parse($('#meta-json').textContent);
  const source = JSON.parse($('#source-json').textContent);
  const b64 = $('#pack-b64').textContent.replace(/\s+/g, '');
  const raw = atob(b64), gz = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) gz[i] = raw.charCodeAt(i);
  log('Packed source', `${(gz.length / 1048576).toFixed(2)} MB gzip`);
  let fingerprint = 'unavailable';
  try {
    if (crypto?.subtle) {
      const h = new Uint8Array(await crypto.subtle.digest('SHA-256', gz));
      fingerprint = [...h].map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch { /* fingerprint is informative only */ }
  const verified = fingerprint === source.packedGzipSha256;
  log('SHA-256 fingerprint', fingerprint === 'unavailable' ? 'Not available in this browser' : verified ? `${fingerprint.slice(0, 12)}… verified` : `${fingerprint.slice(0, 12)}… mismatch`);
  let bytes;
  if (typeof DecompressionStream !== 'undefined') {
    const stream = new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'));
    bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  } else {
    const { gunzipSync } = await import('https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js');
    bytes = gunzipSync(gz);
  }
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const c = {};
  for (const [name, type, off] of meta.layout) c[name] = type === 'u8' ? new Uint8Array(buf, off, meta.n) : new Uint16Array(buf, off, meta.n);
  log('Records decoded', fmt(meta.n));
  return { meta, source, c, n: meta.n, verified, fingerprint };
}

function aggregate(D) {
  const { c, n, meta } = D;
  const A = {
    n, stages: Array(8).fill(0), byCohort: [0, 1, 2].map(() => ({ n: 0, stages: Array(8).fill(0), dep: 0, cap: 0, users: 0 })),
    dep: 0, launch: 0, cap: 0, users: 0, live90: 0, uptime: 0, deploys: 0, pre: 0, post: 0, preSq: 0, postSq: 0,
    days: Array(256).fill(0), apps: meta.dict.app.map(() => ({ n: 0, users: 0, live90: 0, uptime: 0, hosts: Array(5).fill(0), tracks: Array(4).fill(0), stages: Array(8).fill(0) })),
    hosts: Array(5).fill(0), networks: Array(5).fill(0), tracks: Array(4).fill(0),
    states: meta.dict.state.map(code => ({ code, n: 0, dep: 0, cap: 0, users: 0, gain: 0, sites: new Set(), first: 9, byCohort: [0, 0, 0], networks: Array(5).fill(0), tracks: Array(4).fill(0) })),
    sites: new Set(), daily: Array(SEASON_DAYS * 3).fill(0),
    cPre: CONSTRUCTS.map(() => new Float64Array(101)), cPost: CONSTRUCTS.map(() => new Float64Array(101)), cPreSum: Array(5).fill(0), cPostSum: Array(5).fill(0),
    cPre70: Array(5).fill(0), cPost70: Array(5).fill(0), att: 0,
  };
  const pre = CONSTRUCTS.map(k => c['pre_' + k.key]), post = CONSTRUCTS.map(k => c['post_' + k.key]);
  for (let i = 0; i < n; i++) {
    const co = c.cohort[i]; if (co > 2) continue; // 2027 stays sealed even if rows ever appear
    const s = c.stage[i], st = A.states[c.state[i]], p = c.pre_total[i] / 10, q = c.post_total[i] / 10;
    A.stages[s]++; A.byCohort[co].n++; A.byCohort[co].stages[s]++;
    A.pre += p; A.post += q; A.preSq += p * p; A.postSq += q * q; A.att += c.att[i];
    A.sites.add(c.site[i]); A.networks[c.network[i]]++; A.tracks[c.track[i]]++;
    A.daily[co * SEASON_DAYS + c.eday[i]]++;
    st.n++; st.gain += q - p; st.sites.add(c.site[i]); st.first = Math.min(st.first, co); st.byCohort[co]++; st.networks[c.network[i]]++; st.tracks[c.track[i]]++;
    for (let k = 0; k < 5; k++) {
      const a = pre[k][i] / 10, b = post[k][i] / 10;
      A.cPre[k][Math.round(a)]++; A.cPost[k][Math.round(b)]++; A.cPreSum[k] += a; A.cPostSum[k] += b;
      if (a >= 70) A.cPre70[k]++; if (b >= 70) A.cPost70[k]++;
    }
    if (s >= 2) {
      A.dep++; st.dep++; A.byCohort[co].dep++; A.days[c.days[i]]++;
      const u = c.users[i]; A.users += u; st.users += u; A.byCohort[co].users += u; A.deploys += c.deploys[i]; A.uptime += c.uptime[i] / 100;
      if (c.live90[i] === 1) A.live90++;
      A.hosts[c.host[i]]++;
      const ap = A.apps[c.app[i]]; ap.n++; ap.users += u; ap.uptime += c.uptime[i] / 100; ap.hosts[c.host[i]]++; ap.tracks[c.track[i]]++; ap.stages[s]++; if (c.live90[i] === 1) ap.live90++;
    }
    if (s >= 5) A.launch++;
    if (s === 7) { A.cap++; st.cap++; A.byCohort[co].cap++; }
  }
  const N = A.byCohort.reduce((a, b) => a + b.n, 0); A.n = N;
  A.atOrAbove = A.stages.map((_, s) => A.stages.slice(s).reduce((a, b) => a + b, 0));
  // Exact median of the deploy-day histogram
  const median = (h, tot) => { if (!tot) return null; const f = Math.floor((tot - 1) / 2), g = Math.floor(tot / 2); let seen = 0, left = 0; for (let d = 0; d < h.length; d++) { seen += h[d]; if (seen > f && seen - h[d] <= f) left = d; if (seen > g) return (left + d) / 2; } return null; };
  A.medianDays = median(A.days, A.dep);
  A.meanDays = A.days.reduce((s, v, d) => s + v * d, 0) / A.dep;
  A.preMean = A.pre / N; A.postMean = A.post / N; A.gain = A.postMean - A.preMean;
  const vPre = (A.preSq - N * A.preMean ** 2) / (N - 1), vPost = (A.postSq - N * A.postMean ** 2) / (N - 1);
  A.stdGain = A.gain / Math.sqrt((vPre + vPost) / 2);
  A.cPreMean = A.cPreSum.map(v => v / N); A.cPostMean = A.cPostSum.map(v => v / N);
  A.cumulative = []; let run = 0; for (const v of A.daily) { run += v; A.cumulative.push(run); }
  // Today's exact modeled total, from the attachment's date rule Date.UTC(year, 8, 9 + eday)
  const td = new Date(), now = Date.UTC(td.getFullYear(), td.getMonth(), td.getDate()); let asOf = 0, todayK = -1;
  for (let k = 0; k < A.daily.length; k++) if (seasonDate(k).getTime() <= now) { asOf += A.daily[k]; todayK = k; }
  A.asOf = asOf; A.todayK = todayK;
  A.states.forEach(s => { s.sites = s.sites.size; });
  A.siteCount = A.sites.size; A.jurisdictions = A.states.filter(s => s.n > 0).length;
  A.appOrder = A.apps.map((a, i) => i).sort((a, b) => A.apps[b].n - A.apps[a].n);
  return A;
}
