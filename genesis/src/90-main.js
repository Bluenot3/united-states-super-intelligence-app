// USSI Genesis — boot, input, main loop.
[Galaxy, Spire, Grid, Terrain, Cosmos, Vault].forEach(c => Chapters.register(c));

const logEl = $('#log'), meterEl = $('#meter');
let logCount = 0;
function bootLog(k, v) { const d = document.createElement('div'); d.innerHTML = `<span>${esc(k)}</span><b>${esc(v)}</b>`; logEl.appendChild(d); logCount++; meterEl.style.width = Math.min(100, logCount / 9 * 100) + '%'; }
const sleep = ms => new Promise(r => setTimeout(r, reduceMotion ? 0 : ms));

async function boot() {
  try {
    D = await decodeData(bootLog);
    await sleep(120);
    A = aggregate(D);
    bootLog('Cohorts', `2024: ${fmt(A.byCohort[0].n)}, 2025: ${fmt(A.byCohort[1].n)}, 2026: ${fmt(A.byCohort[2].n)}`); await sleep(140);
    bootLog('Shipped a live URL', `${pct(A.dep / A.n)} (${fmt(A.dep)})`); await sleep(140);
    bootLog('Reached capstone', `${pct(A.cap / A.n)} (${fmt(A.cap)})`); await sleep(140);
    bootLog('Sites and jurisdictions', `${A.siteCount} sites, ${A.jurisdictions} jurisdictions`); await sleep(140);
    bootLog('2027 cohort', 'Sealed, 0 rows'); await sleep(140);
    // Pre-build the first chapter while the log finishes
    Chapters.buildDock();
    const start = Math.max(0, Chapters.list.findIndex(c => '#' + c.id === location.hash));
    resize();
    renderer.compile(new THREE.Scene(), camera);
    bootLog('Rendering engine', `WebGL ${renderer.capabilities.isWebGL2 ? '2' : '1'} ready`);
    meterEl.style.width = '100%';
    $('#go').hidden = false; $('#enterBtn').focus({ preventScroll: true });
    const enter = withSound => {
      if (withSound) Sound.toggle(true);
      $('#boot').classList.add('gone'); setTimeout(() => $('#boot').remove(), 1000);
      Chapters.go(start, true);
    };
    $('#enterBtn').onclick = () => enter(false);
    $('#enterSoundBtn').onclick = () => enter(true);
    if (params.get('autostart') === '1') enter(false);
    loop.last = performance.now(); requestAnimationFrame(loop);
  } catch (err) {
    console.error(err);
    const e = document.createElement('p'); e.className = 'err';
    e.textContent = `The observatory could not start: ${err?.message || err}. Use a current version of Chrome, Safari, Edge or Firefox with WebGL turned on.`;
    $('.boot-inner').appendChild(e);
  }
}

// ---------- input ----------
let down = null;
canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; });
canvas.addEventListener('pointerup', e => {
  if (!down || e.pointerId !== down.id) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t; down = null;
  if (moved < 8 && dt < 500 && Chapters.current && !Chapters.busy) {
    const hit = Chapters.current.pick?.(e.clientX, e.clientY);
    if (!hit && !inspectEl.hidden) closeInspect();
  }
});
let resumeTimer = 0;
controls.addEventListener('start', () => { hideHint(); controls.autoRotate = false; clearTimeout(resumeTimer); });
controls.addEventListener('end', () => {
  clearTimeout(resumeTimer);
  resumeTimer = setTimeout(() => { const ct = Chapters.current?.controls; if (ct && !reduceMotion && (ct.autoRotate ?? true) && !(Chapters.current === Cosmos && Cosmos.follow >= 0)) controls.autoRotate = true; }, 7000);
});
addEventListener('keydown', e => {
  if ($('#drawerRoot').children.length || e.target.matches?.('input,select,textarea')) return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown') Chapters.go((Chapters.index + 1) % Chapters.list.length);
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') Chapters.go((Chapters.index - 1 + Chapters.list.length) % Chapters.list.length);
  else if (/^[1-6]$/.test(e.key)) Chapters.go(+e.key - 1);
  else if (e.key === 'Escape') closeInspect();
});
addEventListener('resize', () => { resize(); });
addEventListener('hashchange', () => { const i = Chapters.list.findIndex(c => '#' + c.id === location.hash); if (i >= 0 && Chapters.current) Chapters.go(i); });
visualViewport?.addEventListener('resize', () => resize());
$('#truthBtn').onclick = () => openTruth(D, A);
$('#soundBtn').onclick = () => Sound.toggle();
$('#fsBtn').onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { $('#fsBtn').hidden = true; } };
if (!document.documentElement.requestFullscreen) $('#fsBtn').hidden = true;
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); }, false);
canvas.addEventListener('webglcontextrestored', () => { resize(); }, false);

// ---------- loop ----------
const clock0 = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  if (document.hidden) { loop.last = now; return; }
  const dtMs = Math.min(fixedQuality ? 1000 : 100, now - (loop.last || now)); loop.last = now;
  const dt = dtMs / 1000, t = (now - clock0) / 1000;
  runTweens(dt); runFlight(dt);
  const ch = Chapters.current;
  if (ch) {
    if (!flight.active) controls.update();
    ch.update?.(dt, t);
    sky.dome.material.uniforms.uTime.value = t; sky.stars.material.uniforms.uTime.value = t;
    applyView(dt);
    finalPass.uniforms.uTime.value = t;
    composer.render(dt);
    labels.update();
  }
  adapt(dtMs);
}
boot();
