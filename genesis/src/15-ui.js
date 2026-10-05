// USSI Genesis — HUD, chapter manager, inspector, data-truth drawer, tweens and camera flights.
const tweens = new Set();
function tween(obj, key, to, dur, ease = easeInOut) {
  return new Promise(res => {
    for (const t of tweens) if (t.obj === obj && t.key === key) { tweens.delete(t); t.res(); }
    if (dur <= 0 || reduceMotion && dur < 2) { obj[key] = to; res(); return; }
    tweens.add({ obj, key, from: obj[key], to, dur, t: 0, ease, res });
  });
}
function runTweens(dt) {
  for (const tw of tweens) {
    tw.t += dt; const k = clamp(tw.t / tw.dur, 0, 1);
    tw.obj[tw.key] = tw.from + (tw.to - tw.from) * tw.ease(k);
    if (k >= 1) { tweens.delete(tw); tw.res(); }
  }
}

const flight = { active: false, t: 0, dur: 1, p0: new THREE.Vector3(), p1: new THREE.Vector3(), t0: new THREE.Vector3(), t1: new THREE.Vector3() };
function fly(toPos, toTarget, dur = 2.2, fromPos = null, fromTarget = null) {
  flight.p0.copy(fromPos || camera.position); flight.t0.copy(fromTarget || controls.target);
  flight.p1.copy(toPos); flight.t1.copy(toTarget);
  flight.t = 0; flight.dur = reduceMotion ? 0.001 : dur; flight.active = true; controls.enabled = false;
}
function runFlight(dt) {
  if (!flight.active) return;
  flight.t += dt; const k = clamp(flight.t / flight.dur, 0, 1), e = easeInOut(k);
  // arc the path slightly upward for a crane-shot feel
  camera.position.lerpVectors(flight.p0, flight.p1, e); camera.position.y += Math.sin(Math.PI * e) * flight.p0.distanceTo(flight.p1) * 0.12;
  controls.target.lerpVectors(flight.t0, flight.t1, e); camera.lookAt(controls.target);
  if (k >= 1) { flight.active = false; controls.enabled = true; controls.update(); }
}

const ICONS = {
  galaxy: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M16 16c0-2 2.5-3 4-1.5s1 5-2.5 6.5-8-1-8.5-5.5S12.5 6 18 6.5s9 5.5 8 11"/><path d="M16 16c0 2-2.5 3-4 1.5" opacity=".6"/><circle cx="16" cy="16" r="1.4" fill="currentColor"/></svg>',
  spire: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><ellipse cx="16" cy="25" rx="10" ry="2.6"/><ellipse cx="16" cy="17.5" rx="7" ry="1.9"/><ellipse cx="16" cy="10.5" rx="4.6" ry="1.3"/><path d="M16 27V4"/></svg>',
  grid: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M5 22l11 5 11-5-11-5z"/><path d="M11 21.5V12l3 1.4v9.5M17 23V8l3 1.3v12.4M23 20.5v-5l2.5 1.1v3.4" /></svg>',
  terrain: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 24l7-10 4 5 5-9 10 14z"/><path d="M8 24c3-2 6-2 9 0s6 2 9 0" opacity=".6"/></svg>',
  cosmos: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="16" cy="16" r="6"/><ellipse cx="16" cy="16" rx="13" ry="4.2" transform="rotate(-20 16 16)"/><circle cx="26" cy="9" r="1.4" fill="currentColor"/></svg>',
  vault: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M16 3l8 13-8 13-8-13z"/><path d="M8 16h16M16 3v26" opacity=".55"/></svg>',
};

const Chapters = {
  list: [], current: null, index: -1, busy: false, scene: null,
  register(ch) { this.list.push(ch); },
  buildDock() {
    const dl = $('#dockList');
    dl.innerHTML = this.list.map((c, i) => `<button class="ch" data-i="${i}" aria-label="${esc(c.name)}">${ICONS[c.id]}<span>${esc(c.name)}</span></button>`).join('');
    $$('#dockList .ch').forEach(b => b.addEventListener('click', () => this.go(+b.dataset.i)));
    $('#prevBtn').onclick = () => this.go((this.index - 1 + this.list.length) % this.list.length);
    $('#nextBtn').onclick = () => this.go((this.index + 1) % this.list.length);
  },
  async go(i, first = false) {
    if (this.busy || i === this.index) return;
    this.busy = true;
    const next = this.list[i];
    closeInspect(true);
    Sound.whoosh(); Sound.root(next.root || 55);
    if (!first) {
      if (reduceMotion) await tween(finalPass.uniforms.uFlash, 'value', 0.25, 0.15, x => x);
      else await tween(finalPass.uniforms.uWarp, 'value', 1, 0.5, t => t * t);
    }
    if (this.current) { this.current.exit?.(); labels.clear(); }
    this.index = i; this.current = next;
    if (!next.built) { next.build(); next.built = true; }
    renderPass.scene = next.scene; next.scene.add(sky.group);
    const sk = next.sky || {}; sky.dome.material.uniforms.uTintA.value.set(sk.a || '#1a1060'); sky.dome.material.uniforms.uTintB.value.set(sk.b || '#06345a'); sky.dome.material.uniforms.uAmt.value = sk.amt ?? 1;
    sky.group.visible = next.skyVisible !== false;
    const bl = next.bloom || {}; bloom.strength = bl.strength ?? 0.9; bloom.radius = bl.radius ?? 0.6; bloom.threshold = bl.threshold ?? 0.12;
    dprLimit = next.maxDpr || 99; resize();
    const ct = next.controls || {};
    controls.minDistance = ct.min ?? 2; controls.maxDistance = ct.max ?? 80;
    controls.minPolarAngle = ct.minPolar ?? 0.05; controls.maxPolarAngle = ct.maxPolar ?? Math.PI * 0.49;
    controls.autoRotate = !reduceMotion && (ct.autoRotate ?? true); controls.autoRotateSpeed = ct.rotateSpeed ?? 0.35;
    this.renderPanel();
    $$('#dockList .ch').forEach((b, j) => b.toggleAttribute('aria-current', false) || (j === i && b.setAttribute('aria-current', 'step')));
    $('#vault').hidden = next.id !== 'vault';
    $('#hint').textContent = next.hint || 'Drag to orbit, pinch or scroll to zoom';
    $('#hint').style.opacity = hintSeen || !next.hint ? '0' : '1';
    try { history.replaceState(null, '', '#' + next.id); } catch { }
    requestAnimationFrame(measureOcclusion);
    next.enter(first);
    if (!first) {
      if (reduceMotion) await tween(finalPass.uniforms.uFlash, 'value', 0, 0.3, x => x);
      else { finalPass.uniforms.uFlash.value = 0.35; tween(finalPass.uniforms.uFlash, 'value', 0, 0.9); await tween(finalPass.uniforms.uWarp, 'value', 0, 0.85, easeOut); }
    }
    this.busy = false;
  },
  renderPanel() {
    const ch = this.current, i = this.index;
    $('#panelBody').innerHTML = `<div class="chap-meta"><i>${String(i + 1).padStart(2, '0')}</i><span>Chapter ${i + 1} of ${this.list.length}</span></div><h1>${ch.title}</h1>${ch.panel()}`;
    ch.bind?.($('#panelBody'));
    $$('#panelBody input[type=range]').forEach(syncRange);
    requestAnimationFrame(measureOcclusion);
  },
};
function syncRange(r) { const p = (r.value - r.min) / (r.max - r.min) * 100; r.style.setProperty('--p', p + '%'); }
function seg(name, options, active) {
  return `<div class="seg" role="group" aria-label="${esc(name)}">${options.map(([v, label, dis]) => `<button data-v="${esc(v)}" aria-pressed="${String(v) === String(active)}" ${dis ? 'disabled' : ''}>${esc(label)}</button>`).join('')}</div>`;
}
function bindSeg(root, sel, fn) {
  const box = $(sel, root); if (!box) return;
  box.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    $$('button', box).forEach(x => x.setAttribute('aria-pressed', String(x === b))); Sound.blip(660, .12, .05); fn(b.dataset.v);
  });
}
function kpi(value, label, small = '', id = '') { return `<div class="kpi"><strong class="num" ${id ? `id="${id}"` : ''}>${value}</strong><span>${label}</span>${small ? `<small>${small}</small>` : ''}</div>`; }
function barRows(rows, total, colors) {
  return `<div class="bars">${rows.map((r, i) => `<div class="bar"><span>${esc(r[0])}</span><b>${r[2] ?? pct(r[1] / total)}</b><div class="track"><i style="width:${(r[1] / Math.max(...rows.map(x => x[1])) * 100).toFixed(1)}%;background:${colors[i % colors.length]}"></i></div></div>`).join('')}</div>`;
}

// ---------- panel collapse (phones) ----------
const panelEl = $('#panel');
$('#handle').addEventListener('click', () => {
  const c = panelEl.dataset.collapsed !== 'false';
  panelEl.dataset.collapsed = String(!c); $('#handle').setAttribute('aria-expanded', String(c));
  $('#handle').setAttribute('aria-label', c ? 'Collapse chapter details' : 'Expand chapter details');
  setTimeout(measureOcclusion, 480);
});
new ResizeObserver(() => measureOcclusion()).observe(panelEl);

// ---------- inspector ----------
const inspectEl = $('#inspect');
function showInspect(html) {
  inspectEl.innerHTML = `${html}<p class="synthetic">Synthetic, modeled values. They describe no real student, site or app.</p>`;
  inspectEl.hidden = false; inspectEl.style.animation = 'none'; void inspectEl.offsetWidth; inspectEl.style.animation = '';
  if (isNarrow()) panelEl.hidden = true;
  $('.close', inspectEl)?.addEventListener('click', () => closeInspect());
  requestAnimationFrame(measureOcclusion);
  Sound.blip(990, .2, .06);
}
function closeInspect(silent) {
  if (inspectEl.hidden) return;
  inspectEl.hidden = true; panelEl.hidden = false;
  Chapters.current?.onDeselect?.();
  requestAnimationFrame(measureOcclusion);
  if (!silent) Sound.blip(520, .12, .04);
}
const closeBtn = '<button class="close" aria-label="Close details"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>';

// ---------- data-truth drawer ----------
function openTruth(D, A) {
  const s = D.source, root = $('#drawerRoot');
  root.innerHTML = `<div class="scrim" id="scrim"></div><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="truthTitle" tabindex="-1">
    <div class="row" style="justify-content:space-between;align-items:flex-start"><h2 id="truthTitle">How to read this data</h2>${closeBtn}</div>
    <div class="disclosure">${esc(s.disclosure)}</div>
    <div><h3>What you are looking at</h3><p>${fmt(A.n)} modeled learner records from the AI Pioneer reference dataset, cohorts 2024 to 2026. Every figure in this observatory is computed live in your browser from the packed records. Nothing is typed in by hand.</p></div>
    <div><h3>Definitions</h3><table><tbody>
      <tr><td>Shipped a live URL</td><td>Highest stage S2 or above, divided by all learners in view</td></tr>
      <tr><td>Public launch</td><td>Stage S5 or above, divided by all learners in view</td></tr>
      <tr><td>Capstone (AI Pioneer tier)</td><td>Stage S7, divided by all learners in view</td></tr>
      <tr><td>Days to first deploy</td><td>Median among S2+ learners only</td></tr>
      <tr><td>30-day app audience</td><td>Sum of each app's 30-day users. People are not deduplicated across apps</td></tr>
      <tr><td>Live at 90 days</td><td>S2+ apps live at 90 days, divided by S2+ apps</td></tr>
      <tr><td>Assessment gain</td><td>Mean post-total minus pre-total on a 0–100 scale. No comparison group, so it is descriptive, not causal</td></tr>
      <tr><td>Enrollment dates</td><td>Reconstructed as Date.UTC(cohort year, 8, 9 + enrollment day): September 9 to November 10 each season</td></tr>
    </tbody></table></div>
    <div><h3>Limitations</h3><ul>${s.limitations.map(l => `<li>${esc(l)}</li>`).join('')}<li>Layouts inside each scene (star scatter, orbit phase, terrain smoothing) are visual placement. They never change a count.</li></ul></div>
    <div><h3>Provenance</h3><table><tbody>
      <tr><td>Dataset version</td><td><code>${esc(s.version)}</code></td></tr>
      <tr><td>Generator and seed</td><td>${esc(s.generator)}, seed ${esc(s.seed)}</td></tr>
      <tr><td>Packed gzip SHA-256</td><td><code>${esc(s.packedGzipSha256)}</code><br>${D.verified ? '<span style="color:var(--ok)">Matched in this browser</span>' : 'Could not be checked in this browser'}</td></tr>
      <tr><td>2027 cohort</td><td>Sealed until ${dateFmt.format(new Date(s.sealedUntil))} (12:00 AM Eastern). No rows are published</td></tr>
    </tbody></table></div>
    <div class="links"><a class="btn ghost" href="${esc(s.sourceUrl)}" target="_blank" rel="noopener">Dataset on Hugging Face</a><a class="btn ghost" href="https://www.zenai.world/ailiteracyyouth" target="_blank" rel="noopener">AI Pioneer Program</a><a class="btn ghost" href="https://arsenal.world" target="_blank" rel="noopener">ZEN Arsenal</a></div>
  </aside>`;
  const close = () => { root.innerHTML = ''; $('#truthBtn').focus(); };
  $('#scrim').onclick = close; $('.drawer .close').onclick = close; $('.drawer').focus();
  root.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

let hintSeen = false;
function hideHint() { if (hintSeen) return; hintSeen = true; $('#hint').style.opacity = '0'; }
