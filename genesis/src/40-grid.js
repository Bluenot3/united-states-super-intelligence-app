// Chapter 3 — The Grid: a tile map of the U.S. with a tower of light per jurisdiction.
const TILE_S = 1.12, TOWER_MAX = 5.2;
function rampColor(t) {
  const stops = ['#5b46c9', '#3d9bff', '#2fd8f2', '#3dfcbf', '#ffcf5c', '#fff3d6'].map(h => new THREE.Color(h));
  t = clamp(t, 0, 1) * (stops.length - 1); const i = Math.min(stops.length - 2, Math.floor(t));
  return stops[i].clone().lerp(stops[i + 1], t - i);
}
const Grid = {
  id: 'grid', name: 'The grid', root: 49, title: 'Forty jurisdictions, one network.',
  sky: { a: '#101a52', b: '#05304a', amt: .65 }, bloom: { strength: 0.6, radius: 0.45, threshold: 0.3 },
  controls: { min: 5, max: 40, maxPolar: Math.PI * 0.46, rotateSpeed: 0.22 },
  hint: 'Drag to orbit, tap a tower to read its jurisdiction',
  season: 2, colorMode: 'season',
  tilePos(code) { const [cx, ry] = TILE[code]; return new THREE.Vector3((cx - 5.5) * TILE_S, 0, (ry - 3.6) * TILE_S); },
  heightFor(st, season) { let v = 0; for (let k = 0; k <= season; k++) v += st.byCohort[k]; return v; },
  build() {
    const scene = this.scene = new THREE.Scene();
    this.u = { uTime: { value: 0 } };
    this.maxN = Math.max(...A.states.map(s => s.n));
    this.band = 500 / this.maxN * TOWER_MAX;
    const byCode = {}; A.states.forEach((s, i) => byCode[s.code] = s);
    this.byCode = byCode;
    const rates = A.states.filter(s => s.n).map(s => s.dep / s.n), caps = A.states.filter(s => s.n).map(s => s.cap / s.n);
    this.rateRange = [Math.min(...rates), Math.max(...rates)]; this.capRange = [Math.min(...caps), Math.max(...caps)];
    // ground grid
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { uTime: this.u.uTime, uS: { value: TILE_S } },
      vertexShader: `varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform float uTime,uS; varying vec2 vP;
        void main(){ vec2 g=abs(fract(vP/uS+.5)-.5); float line=smoothstep(.025,0.,min(g.x,g.y)); vec2 G=abs(fract(vP/(uS*4.)+.5)-.5); float major=smoothstep(.01,0.,min(G.x,G.y));
          float r=length(vP); float fade=smoothstep(34.,3.,r); float wave=smoothstep(.6,0.,abs(r-mod(uTime*4.,40.)))*.5;
          float v=(line*.12+major*.18+wave*line*1.5)*fade; vec3 c=mix(vec3(.2,.45,1.),vec3(.5,.9,1.),wave);
          gl_FragColor=vec4(c*v+vec3(.02,.03,.08)*fade*.6,v+.25*fade); }`,
    }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.03; scene.add(ground);

    const towerVS = `varying vec3 vL,vN; varying vec3 vV; void main(){ vL=position; vN=normal; vec4 mv=modelViewMatrix*vec4(position,1.); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`;
    const towerFS = `uniform vec3 uColor; uniform float uH,uBand,uTime,uHot,uSeed; varying vec3 vL,vN; varying vec3 vV;
      void main(){
        float top=step(.5,vN.y), side=1.-top-step(.5,-vN.y);
        float y=vL.y*uH;
        float ex=abs(vL.x)/.42, ez=abs(vL.z)/.42;
        float edge = top>.5 ? smoothstep(.86,1.,max(ex,ez)) : smoothstep(.9,1.,abs(vN.x)>.5?ez:ex);
        edge=max(edge, side*smoothstep(.06,0.,abs(y-uH))*1.);
        float lines=side*smoothstep(.035,0.,abs(fract(y/uBand)-.5)-.45)*step(.05,y);
        float grad=pow(clamp(y/max(uH,.001),0.,1.),1.4);
        float scan=side*smoothstep(.08,0.,abs(y-mod(uTime*1.3+uSeed*7.,uH+3.)));
        vec3 c=uColor*(.08+.55*grad)*side + uColor*lines*.7 + mix(uColor,vec3(1.),.35)*edge*.85 + uColor*scan*1.4;
        c+= top*(uColor*(.35+.5*edge)+uColor*.25*smoothstep(.5,0.,max(ex,ez)-.2));
        c*=1.+uHot*.9;
        gl_FragColor=vec4(c,1.);
      }`;
    this.towers = []; this.plates = [];
    const boxG = new THREE.BoxGeometry(0.84, 1, 0.84); boxG.translate(0, 0.5, 0);
    const plateG = new THREE.BoxGeometry(0.98, 0.05, 0.98);
    Object.keys(TILE).forEach((code, idx) => {
      const p = this.tilePos(code), st = byCode[code];
      const plate = new THREE.Mesh(plateG, new THREE.ShaderMaterial({
        uniforms: { uOn: { value: st && st.n ? 1 : 0 } }, vertexShader: towerVS.replace('varying vec3 vV;', 'varying vec3 vV;'),
        fragmentShader: `uniform float uOn; varying vec3 vL,vN; varying vec3 vV; void main(){ float e=smoothstep(.42,.49,max(abs(vL.x),abs(vL.z))); vec3 c=mix(vec3(.03,.04,.1),vec3(.06,.09,.2),uOn)+e*mix(vec3(.12,.16,.35),vec3(.3,.5,1.),uOn)*.9; gl_FragColor=vec4(c,1.); }`,
      }));
      plate.position.copy(p); plate.position.y = 0.0; plate.userData.code = code; scene.add(plate); this.plates.push(plate);
      if (!st || !st.n) return;
      const u = { uColor: { value: new THREE.Color() }, uH: { value: 0.01 }, uBand: { value: this.band }, uTime: this.u.uTime, uHot: { value: 0 }, uSeed: { value: hash(idx, 31) } };
      const m = new THREE.Mesh(boxG, new THREE.ShaderMaterial({ uniforms: u, vertexShader: towerVS, fragmentShader: towerFS }));
      m.position.copy(p); m.position.y = 0.025; m.scale.y = 0.01; m.userData.code = code;
      scene.add(m); this.towers.push({ code, st, mesh: m, u, anim: { h: 0.01 }, hot: false });
    });
    // DC origin beacon + arcs to every jurisdiction in the order they joined
    const dc = this.tilePos('DC');
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.08, 14, 16, 1, true), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: this.u.uTime },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform float uTime; varying vec2 vUv; void main(){ float f=pow(1.-vUv.y,1.6); float b=.6+.4*sin(vUv.y*40.-uTime*6.); vec3 c=vec3(1.,.82,.5)*f*b*1.4; gl_FragColor=vec4(c,1.); }`,
    }));
    beam.position.set(dc.x, 7, dc.z); scene.add(beam);
    this.pulses = [0, 1, 2].map(k => {
      const r = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 96), new THREE.MeshBasicMaterial({ color: '#ffc46b', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      r.rotation.x = -Math.PI / 2; r.position.set(dc.x, 0.06, dc.z); r.userData.k = k; scene.add(r); return r;
    });
    this.arcs = [];
    const arcFS = `uniform float uTime,uShow,uPhase; uniform vec3 uColor; varying vec2 vUv;
      void main(){ float s=vUv.x; if(s>uShow) discard; float p=fract(s*1.2-uTime*.45+uPhase); float head=pow(p,10.)*2.2; float v=.16+head; gl_FragColor=vec4(uColor*v,v); }`;
    this.towers.forEach((t, i) => {
      if (t.code === 'DC') return;
      const to = this.tilePos(t.code), dist = dc.distanceTo(to);
      const mid = dc.clone().lerp(to, 0.5); mid.y = 0.8 + dist * 0.42;
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(dc.x, 0.08, dc.z), mid, new THREE.Vector3(to.x, 0.08, to.z));
      const u = { uTime: this.u.uTime, uShow: { value: 0 }, uPhase: { value: hash(i, 41) }, uColor: { value: new THREE.Color(COHORT_COLORS[t.st.first]) } };
      const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.016, 6, false), new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: u,
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`, fragmentShader: arcFS,
      }));
      scene.add(m); this.arcs.push({ t, u, mesh: m });
    });
    this.applyColors(true);
  },
  colorFor(t) {
    if (this.colorMode === 'season') return new THREE.Color(COHORT_COLORS[t.st.first]);
    if (this.colorMode === 'deploy') { const [a, b] = this.rateRange; return rampColor((t.st.dep / t.st.n - a) / (b - a)); }
    const [a, b] = this.capRange; return rampColor((t.st.cap / t.st.n - a) / (b - a));
  },
  applyColors(instant) {
    this.towers.forEach(t => { const c = this.colorFor(t); if (instant) t.u.uColor.value.copy(c); else t.target = c; });
    this.renderLegend();
  },
  setSeason(s, quiet) {
    this.season = s;
    this.towers.forEach((t, i) => tween(t.anim, 'h', Math.max(0.01, this.heightFor(t.st, s) / this.maxN * TOWER_MAX), 1.4 + (i % 7) * 0.05));
    this.arcs.forEach(a => tween(a.u.uShow, 'value', a.t.st.first <= s ? 1 : 0, a.t.st.first <= s ? 1.6 : 0.5));
    if (!quiet) Sound.blip(392 + s * 98, .4, .05, 'triangle');
    this.renderKpis();
  },
  async playExpansion() {
    if (this.playing) return; this.playing = true;
    const box = $('#grSeason');
    for (let s = 0; s <= 2; s++) {
      if (Chapters.current !== this) break;
      this.setSeason(s); if (box) $$('button', box).forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.v === s)));
      await new Promise(r => setTimeout(r, reduceMotion ? 50 : 2300));
    }
    this.playing = false;
  },
  enter(first) {
    const d = fitDistance(6.3), tgt = new THREE.Vector3(0, 0.9, 0.3);
    fly(new THREE.Vector3(d * 0.1, d * 0.6, d * 0.8), tgt, 2.6, new THREE.Vector3(0, d * 1.9, d * 0.15), new THREE.Vector3(0, 0, 0));
    this.towers.forEach(t => { t.anim.h = 0.01; }); this.arcs.forEach(a => a.u.uShow.value = 0);
    if (reduceMotion) this.setSeason(2, true); else { this.season = 0; setTimeout(() => this.playExpansion(), 900); }
    this.makeLabels();
  },
  makeLabels() {
    const narrow = isNarrow();
    const sorted = [...this.towers].sort((a, b) => b.st.n - a.st.n);
    sorted.forEach((t, rank) => {
      if (rank > (narrow ? 11 : 21)) return;
      t.label = labels.add(`${t.code}${!narrow && rank < 5 ? ` <small class="num">${fmt(t.st.n)}</small>` : ''}`, p => p.set(t.mesh.position.x, t.anim.h + 0.1, t.mesh.position.z), { cls: 'state' });
    });
    const dc = this.tilePos('DC');
    labels.add('<b>Greater Washington</b><small class="line">Program origin</small>', new THREE.Vector3(dc.x + 0.2, 3.4, dc.z), { cls: 'tag', anchor: 'left' });
  },
  renderKpis() {
    const el = $('#grKpis'); if (!el) return;
    const s = this.season, n = A.byCohort.slice(0, s + 1).reduce((a, b) => a + b.n, 0);
    const active = this.towers.filter(t => t.st.first <= s).length;
    const top = [...this.towers].sort((a, b) => this.heightFor(b.st, s) - this.heightFor(a.st, s))[0];
    el.innerHTML = `${kpi(String(active), 'Jurisdictions active', `through the ${2024 + s} season`)}${kpi(fmt(n), 'Enrollment records', `cumulative through ${2024 + s}`)}${kpi(top.code, `Largest: ${esc(STATE_NAMES[top.code])}`, `${fmt(this.heightFor(top.st, s))} learners`)}${kpi(pct(A.networks[0] / A.n), 'Through Boys & Girls Clubs', `${fmt(A.networks[0])} learners, all seasons`)}`;
  },
  renderLegend() {
    const el = $('#grLegend'); if (!el) return;
    if (this.colorMode === 'season') el.innerHTML = `<div class="legend">${[0, 1, 2].map(i => `<span><i style="background:${COHORT_COLORS[i]}"></i>Joined ${2024 + i}</span>`).join('')}</div>`;
    else { const [a, b] = this.colorMode === 'deploy' ? this.rateRange : this.capRange; el.innerHTML = `<div class="legend-ramp" style="background:linear-gradient(90deg,#5b46c9,#3d9bff,#2fd8f2,#3dfcbf,#ffcf5c,#fff3d6)"></div><div class="legend-ends"><span>${pct(a)}</span><span>${this.colorMode === 'deploy' ? 'Shipped a live URL' : 'Reached capstone'}</span><span>${pct(b)}</span></div>`; }
  },
  panel() {
    const nets = D.meta.dict.network.map((name, i) => [name, A.networks[i]]);
    return `<p class="lede more">Each tower is one jurisdiction on a tile map of the United States. Tower height is enrollment records, and each glowing band is 500 learners. Arcs trace the expansion out of Greater Washington, colored by the season each jurisdiction joined.</p>
      <div class="kpis" id="grKpis"></div>
      <div class="controls"><div><div class="ctl-label">Through season</div><div id="grSeason">${seg('Season', [[0, '2024'], [1, '2025'], [2, '2026']], this.season)}</div></div>
      <div class="row"><button class="btn ghost" id="grPlay">${svgPlay} Play the expansion</button></div></div>
      <div class="more controls"><div><div class="ctl-label">Color towers by</div><div id="grColor">${seg('Color', [['season', 'Season joined'], ['deploy', 'Live URL rate'], ['capstone', 'Capstone rate']], this.colorMode)}</div></div><div id="grLegend"></div>
      <div><div class="ctl-label">Learners by partner network</div>${barRows(nets, A.n, ['#ffc46b', '#78f0ff', '#b49bff', '#ff79b8', '#7dffb2'])}</div>
      <p class="note">Site codes are synthetic and never map to real clubs or addresses.</p></div>`;
  },
  bind(root) {
    this.renderKpis(); this.renderLegend();
    bindSeg(root, '#grSeason', v => this.setSeason(+v));
    bindSeg(root, '#grColor', v => { this.colorMode = v; this.applyColors(false); });
    $('#grPlay', root).onclick = () => this.playExpansion();
  },
  update(dt, t) {
    this.u.uTime.value = t;
    this.towers.forEach(tw => {
      tw.mesh.scale.y = tw.anim.h; tw.u.uH.value = tw.anim.h;
      tw.u.uHot.value += ((tw.hot ? 1 : 0) - tw.u.uHot.value) * Math.min(1, dt * 6);
      if (tw.target) { tw.u.uColor.value.lerp(tw.target, Math.min(1, dt * 4)); }
    });
    this.pulses.forEach(p => { const k = ((t * 0.45 + p.userData.k / 3) % 1); p.scale.setScalar(0.3 + k * 4.5); p.material.opacity = (1 - k) * 0.55; });
  },
  pick(x, y) {
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), camera);
    const hit = ray.intersectObjects([...this.towers.map(t => t.mesh), ...this.plates], false)[0];
    if (!hit) return false; this.inspectState(hit.object.userData.code); return true;
  },
  inspectState(code) {
    this.towers.forEach(t => t.hot = t.code === code);
    const st = this.byCode[code];
    if (!st || !st.n) { showInspect(`<header><div><h2>${esc(STATE_NAMES[code])}</h2><div class="sub">No modeled records</div></div>${closeBtn}</header><p class="note">This jurisdiction has no learners in the 2024 to 2026 reference model.</p>`); return; }
    const topNet = st.networks.indexOf(Math.max(...st.networks));
    showInspect(`<header><div><h2>${esc(STATE_NAMES[code])}</h2><div class="sub">Joined the network in ${2024 + st.first}</div></div>${closeBtn}</header>
      <dl class="facts"><dt>Enrollment records</dt><dd>${fmt(st.n)}</dd><dt>Modeled sites</dt><dd>${st.sites}</dd><dt>Shipped a live URL</dt><dd>${pct(st.dep / st.n)}</dd><dt>Reached capstone</dt><dd>${pct(st.cap / st.n)}</dd><dt>Mean assessment gain</dt><dd>+${fx(st.gain / st.n)} pts</dd><dt>Summed 30-day app users</dt><dd>${fmt(st.users)}</dd><dt>Largest partner network</dt><dd>${esc(D.meta.dict.network[topNet])}</dd></dl>
      <div><div class="ctl-label">Learners by cohort</div>${barRows([0, 1, 2].map(k => [`${2024 + k}`, st.byCohort[k], fmt(st.byCohort[k])]), st.n, COHORT_COLORS)}</div>`);
  },
  onDeselect() { this.towers.forEach(t => t.hot = false); },
  exit() { this.onDeselect(); this.playing = false; },
};
