// Chapter 1 — The Pioneer Galaxy: one star per modeled enrollment.
let D, A;
const Galaxy = {
  id: 'galaxy', name: 'Galaxy', root: 55, title: 'Every star is a pioneer.',
  sky: { a: '#2a1470', b: '#0b3c6a', amt: 1 }, bloom: { strength: 0.85, radius: 0.55, threshold: 0.2 },
  controls: { min: 4, max: 60, maxPolar: Math.PI * 0.47, rotateSpeed: 0.25 },
  hint: 'Drag to orbit, pinch to zoom, tap a star to read its record',
  mode: 0, cursor: 1, playing: false, focusTrack: -1, sel: -1,
  build() {
    const scene = this.scene = new THREE.Scene();
    const n = D.n, c = D.c;
    const pos = new Float32Array(n * 3), data = new Float32Array(n * 4), seed = new Float32Array(n);
    this.base = pos;
    const bands = [[0.55, 4.1], [4.0, 7.6], [7.5, 11.8]];
    for (let i = 0; i < n; i++) {
      const co = Math.min(2, c.cohort[i]), ed = c.eday[i], tr = c.track[i], st = c.stage[i];
      const f = (ed + hash(i, 1)) / SEASON_DAYS;
      const [r0, r1] = bands[co];
      let R = r0 + (r1 - r0) * Math.pow(f, 0.92) + gauss(i, 2) * 0.22;
      R = Math.max(0.25, R);
      const theta = tr * Math.PI / 2 + R * 0.6 + gauss(i, 3) * (0.26 + 0.05 * R / 6);
      const thick = 0.55 * Math.exp(-R / 2.2) + 0.1;
      pos[i * 3] = Math.cos(theta) * R; pos[i * 3 + 1] = gauss(i, 4) * thick; pos[i * 3 + 2] = Math.sin(theta) * R;
      data[i * 4] = st; data[i * 4 + 1] = co; data[i * 4 + 2] = tr; data[i * 4 + 3] = (co * SEASON_DAYS + ed + hash(i, 5) * 0.999) / (SEASON_DAYS * 3);
      seed[i] = hash(i, 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aData', new THREE.BufferAttribute(data, 4)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const col = a => a.map(h => new THREE.Color(h));
    this.u = {
      uTime: { value: 0 }, uCursor: { value: 1 }, uPx: { value: 1 }, uScale: { value: 1 },
      uMode: { value: 0 }, uModePrev: { value: 0 }, uModeMix: { value: 1 }, uFocusTrack: { value: -1 }, uFocusStage: { value: -1 },
      uStage: { value: col(STAGE_COLORS) }, uCoh: { value: col(COHORT_COLORS) }, uTrk: { value: col(TRACK_COLORS) },
    };
    const stars = this.stars = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute vec4 aData; attribute float aSeed;
        uniform float uTime,uCursor,uPx,uScale,uMode,uModePrev,uModeMix,uFocusTrack,uFocusStage;
        uniform vec3 uStage[8]; uniform vec3 uCoh[3]; uniform vec3 uTrk[4];
        varying vec3 vCol; varying float vA,vSpike;
        vec3 pal(float m,int s,int c,int t){ return m<.5?uStage[s]:(m<1.5?uCoh[c]:uTrk[t]); }
        void main(){
          int s=int(aData.x+.5), c=int(aData.y+.5), t=int(aData.z+.5);
          float born=uCursor-aData.w; float vis=step(0.,born);
          float R=length(position.xz);
          float ang=uTime*.045*(1.8/(.7+R*.2));
          float ca=cos(ang), sa=sin(ang);
          vec3 p=vec3(ca*position.x-sa*position.z, position.y, sa*position.x+ca*position.z);
          float flare=vis*exp(-born*70.);
          p.y+=flare*.6*(aSeed-.5);
          vec4 mv=modelViewMatrix*vec4(p,1.);
          float focus=1.;
          if(uFocusTrack>-.5 && abs(aData.z-uFocusTrack)>.1) focus=.08;
          if(uFocusStage>-.5 && abs(aData.x-uFocusStage)>.1) focus=min(focus,.08);
          float size=(.045+aData.x*.009)*(1.+flare*2.5);
          gl_PointSize=clamp(size*uScale/-mv.z,0.,64.*uPx)*vis;
          gl_Position=projectionMatrix*mv;
          vec3 col=mix(pal(uModePrev,s,c,t),pal(uMode,s,c,t),uModeMix);
          float dens=.35+.65*smoothstep(.3,4.5,R);
          vCol=(col*(.6+aData.x*.05)+flare*vec3(1.,.85,.6)*.6)*dens;
          vA=focus*(.72+.28*sin(uTime*(1.2+aSeed*2.5)+aSeed*60.));
          vSpike=step(6.5,aData.x)*focus;
        }`,
      fragmentShader: `
        varying vec3 vCol; varying float vA,vSpike;
        void main(){
          vec2 q=gl_PointCoord*2.-1.; float r2=dot(q,q); if(r2>1.) discard;
          float core=exp(-r2*16.), halo=exp(-r2*4.)*.32;
          float sp=vSpike*(max(0.,1.-abs(q.x)*10.)*(1.-abs(q.y))+max(0.,1.-abs(q.y)*10.)*(1.-abs(q.x)))*.55;
          float a=(core+halo+sp)*vA;
          gl_FragColor=vec4(vCol*a,a);
        }`,
    }));
    stars.frustumCulled = false; scene.add(stars);

    // Nebula haze along the arms (atmosphere only — it is not data)
    const H = 2600, hp = new Float32Array(H * 3), hc = new Float32Array(H * 3), hs = new Float32Array(H);
    for (let i = 0; i < H; i++) {
      const tr = i % 4, R = 0.8 + Math.pow(hash(i, 11), 0.8) * 11.5, th = tr * Math.PI / 2 + R * 0.6 + gauss(i, 12) * 0.32;
      hp.set([Math.cos(th) * R, gauss(i, 13) * 0.25, Math.sin(th) * R], i * 3);
      const cc = new THREE.Color(TRACK_COLORS[tr]).lerp(new THREE.Color('#5a46ff'), 0.45 + hash(i, 14) * 0.3);
      hc.set([cc.r, cc.g, cc.b], i * 3); hs[i] = 0.9 + hash(i, 15) * 2.4;
    }
    const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.BufferAttribute(hp, 3)); hg.setAttribute('color', new THREE.BufferAttribute(hc, 3)); hg.setAttribute('aSize', new THREE.BufferAttribute(hs, 1));
    this.haze = new THREE.Points(hg, new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
      vertexShader: `attribute float aSize; uniform float uTime,uScale,uPx,uCursor; varying vec3 vC; varying float vA;
        void main(){ float R=length(position.xz); float ang=uTime*.045*(1.8/(.7+R*.2)); float ca=cos(ang),sa=sin(ang);
          vec3 p=vec3(ca*position.x-sa*position.z,position.y,sa*position.x+ca*position.z);
          vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
          gl_PointSize=min(aSize*uScale/-mv.z, 380.*uPx); vC=color; vA=.032*smoothstep(R/12.5-.15,R/12.5+.05,uCursor+.08); }`,
      fragmentShader: `varying vec3 vC; varying float vA; void main(){ vec2 q=gl_PointCoord*2.-1.; float a=exp(-dot(q,q)*2.6)*vA; gl_FragColor=vec4(vC*a,a); }`,
    }));
    this.haze.frustumCulled = false; scene.add(this.haze);
    this.core = glowSprite('#ffe2b0', 4.5, 3.6, 0.55); scene.add(this.core);
    this.core2 = glowSprite('#7a6cff', 16, 2.6, 0.22); scene.add(this.core2);

    // selection reticle
    this.reticle = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, uniforms: { uTime: this.u.uTime },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(0.,0.,0.,1.); mv.xy+=position.xy*.55; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform float uTime; varying vec2 vUv; void main(){ vec2 q=vUv*2.-1.; float r=length(q); float a=atan(q.y,q.x);
        float ring=smoothstep(.04,0.,abs(r-.78))*(.55+.45*step(.5,fract(a*2./3.14159+uTime*.4)));
        float inner=smoothstep(.03,0.,abs(r-.42))*.5; gl_FragColor=vec4(vec3(1.,.8,.45)*(ring+inner),ring+inner); }`,
    }));
    this.reticle.visible = false; this.reticle.frustumCulled = false; scene.add(this.reticle);
  },
  starPos(i, out) {
    const x = this.base[i * 3], y = this.base[i * 3 + 1], z = this.base[i * 3 + 2], R = Math.hypot(x, z);
    const ang = this.u.uTime.value * 0.045 * (1.8 / (0.7 + R * 0.2)), ca = Math.cos(ang), sa = Math.sin(ang);
    return out.set(ca * x - sa * z, y, sa * x + ca * z);
  },
  enter(first) {
    const d = fitDistance(isNarrow() ? 12.8 : 11.2);
    const to = new THREE.Vector3(0, d * 0.52, d * 0.86), target = new THREE.Vector3(0, -0.4, 0);
    fly(to, target, first ? 4.2 : 2.6, new THREE.Vector3(0, d * 2.3, d * 0.3), new THREE.Vector3(0, 0, 0));
    if (!this.introduced) { this.introduced = true; if (!reduceMotion && params.get('skip') !== '1') { this.setCursor(0); setTimeout(() => this.play(), first ? 900 : 300); } }
    this.onResize();
  },
  onResize() { this.u.uPx.value = renderer.getPixelRatio(); this.u.uScale.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)); },
  exit() { this.playing = false; this.reticle.visible = false; this.sel = -1; },
  update(dt, t) {
    this.u.uTime.value = t;
    if (this.playing) {
      this.setCursor(Math.min(1, this.cursor + dt / 24), true);
      if (this.cursor >= 1) { this.playing = false; this.syncPlay(); }
    }
    if (this.u.uModeMix.value < 1) this.u.uModeMix.value = Math.min(1, this.u.uModeMix.value + dt * 1.6);
    if (this.sel >= 0) { this.starPos(this.sel, this.reticle.position); }
  },
  kIndex() { return clamp(Math.floor(this.cursor * SEASON_DAYS * 3 - 1e-6), 0, SEASON_DAYS * 3 - 1); },
  setCursor(v, fromPlay) {
    this.cursor = clamp(v, 0, 1); this.u.uCursor.value = this.cursor;
    const r = $('#gCursor'); if (r && !fromPlay) { r.value = Math.round(this.cursor * 1000); syncRange(r); } else if (r) { r.value = Math.round(this.cursor * 1000); syncRange(r); }
    const k = this.kIndex(), lit = this.cursor <= 0 ? 0 : A.cumulative[k];
    const when = $('#gWhen'), cnt = $('#gCount'), st = $('#gState');
    if (when) when.textContent = this.cursor <= 0 ? 'Before Sep 9, 2024' : dateFmt.format(seasonDate(k));
    if (cnt) cnt.textContent = fmt(lit);
    if (st) st.textContent = this.cursor <= 0 ? 'Season 1 opens' : k > A.todayK ? 'Modeled future joins' : k === A.todayK ? 'Today' : `Season ${Math.floor(k / SEASON_DAYS) + 1}, day ${k % SEASON_DAYS + 1}`;
  },
  play() { if (this.cursor >= 1) this.setCursor(0); this.playing = true; this.syncPlay(); Sound.blip(440, .3, .05, 'triangle'); },
  syncPlay() { const b = $('#gPlay'); if (b) { b.innerHTML = this.playing ? `${svgPause} Pause` : `${svgPlay} ${this.cursor >= 1 ? 'Replay the formation' : 'Play'}`; } },
  setMode(m) { this.u.uModePrev.value = this.mode; this.mode = m; this.u.uMode.value = m; this.u.uModeMix.value = 0; this.renderLegend(); },
  renderLegend() {
    const el = $('#gLegend'); if (!el) return;
    if (this.mode === 0) el.innerHTML = `<div class="legend-ramp" style="background:linear-gradient(90deg,${STAGE_COLORS.join(',')})"></div><div class="legend-ends"><span>S0 enrolled</span><span>S7 capstone</span></div><p class="note">Brighter, larger stars went further. Capstone stars carry a four-point flare.</p>`;
    else if (this.mode === 1) el.innerHTML = `<div class="legend">${[0, 1, 2].map(i => `<span><i style="background:${COHORT_COLORS[i]}"></i>${2024 + i} cohort, ${fmt(A.byCohort[i].n)}</span>`).join('')}</div><p class="note">The core is 2024. Each season added a wider ring.</p>`;
    else el.innerHTML = `<div class="legend">${D.meta.dict.track.map((t, i) => `<button class="seg-chip" data-t="${i}" style="display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 10px;border-radius:9px;border:1px solid ${this.focusTrack === i ? TRACK_COLORS[i] : 'var(--hair)'};font-size:12.5px;color:var(--star)"><i style="width:9px;height:9px;border-radius:50%;background:${TRACK_COLORS[i]}"></i>${esc(t)} ${pct(A.tracks[i] / A.n, 0)}</button>`).join('')}</div><p class="note">Each spiral arm is one build track. Tap a track to isolate its arm.</p>`;
    $$('.seg-chip', el).forEach(b => b.onclick = () => { const t = +b.dataset.t; this.focusTrack = this.focusTrack === t ? -1 : t; this.u.uFocusTrack.value = this.focusTrack; this.renderLegend(); Sound.blip(700, .1, .05); });
  },
  panel() {
    const today = A.todayK >= 0 ? `${fmt(A.asOf)} modeled joins as of today` : '';
    return `<p class="lede more">Each of the ${fmt(A.n)} lights is one modeled enrollment. The four spiral arms are the four build tracks, and the galaxy grows outward one season at a time. Press play to watch it form.</p>
      <div class="kpis">
        ${kpi(fmt(A.n), 'Stars lit so far', `${A.siteCount} sites, ${A.jurisdictions} jurisdictions`, 'gCount')}
        ${kpi(pct(A.dep / A.n), 'Shipped a live URL', `${fmt(A.dep)} modeled learners`)}
        ${kpi(pct(A.cap / A.n), 'Reached capstone', `${fmt(A.cap)} AI Pioneers`)}
        ${kpi(fmt(A.asOf), 'Joined by today', today ? 'Remaining 2026 dates are modeled' : '')}
      </div>
      <div class="timeline">
        <div class="when"><b id="gWhen">Nov 10, 2026</b><span id="gState"></span></div>
        <input type="range" id="gCursor" min="0" max="1000" value="1000" aria-label="Enrollment date">
        <div class="season-ticks"><span>2024</span><span>2025</span><span>2026</span></div>
      </div>
      <div class="row"><button class="btn" id="gPlay"></button></div>
      <div class="more controls"><div><div class="ctl-label">Color the stars by</div>${seg('Color mode', [[0, 'Highest stage'], [1, 'Cohort'], [2, 'Build track']], this.mode)}</div><div id="gLegend"></div></div>`;
  },
  bind(root) {
    const r = $('#gCursor', root);
    r.addEventListener('input', () => { this.playing = false; this.syncPlay(); this.setCursor(r.value / 1000); syncRange(r); });
    $('#gPlay', root).onclick = () => { if (this.playing) { this.playing = false; this.syncPlay(); } else this.play(); };
    bindSeg(root, '.seg', v => this.setMode(+v));
    this.setCursor(this.cursor); this.syncPlay(); this.renderLegend();
  },
  pick(x, y) {
    const n = D.n, v = new THREE.Vector3(), w = innerWidth, h = innerHeight; let best = -1, bd = (coarse ? 26 : 16) ** 2;
    const cur = this.cursor, data = this.stars.geometry.attributes.aData.array;
    for (let i = 0; i < n; i++) {
      if (data[i * 4 + 3] > cur) continue;
      if (this.focusTrack >= 0 && data[i * 4 + 2] !== this.focusTrack) continue;
      this.starPos(i, v).project(camera); if (v.z > 1) continue;
      const dx = (v.x * .5 + .5) * w - x, dy = (-v.y * .5 + .5) * h - y, d = dx * dx + dy * dy;
      // prefer brighter (higher-stage) stars when several are close
      const adj = d - data[i * 4] * 6; if (adj < bd) { bd = adj; best = i; }
    }
    if (best < 0) return false;
    this.sel = best; this.reticle.visible = true; this.inspectRecord(best); return true;
  },
  onDeselect() { this.sel = -1; this.reticle.visible = false; },
  inspectRecord(i) {
    const c = D.c, dict = D.meta.dict, s = c.stage[i], co = c.cohort[i];
    const pre = c.pre_total[i] / 10, post = c.post_total[i] / 10, dep = s >= 2;
    const joined = dateFmt.format(new Date(Date.UTC(2024 + co, 8, 9 + c.eday[i])));
    showInspect(`<header><div><h2>Modeled record ${fmt(i + 1)}</h2><div class="sub">${2024 + co} cohort, joined ${joined}</div></div>${closeBtn}</header>
      <span class="stage-chip"><i style="background:${STAGE_COLORS[s]}">S${s}</i>${esc(STAGE_LABELS[s])}</span>
      <dl class="facts">
        <dt>Build track</dt><dd>${esc(dict.track[c.track[i]])}</dd>
        <dt>Jurisdiction</dt><dd>${esc(STATE_NAMES[dict.state[c.state[i]]] || dict.state[c.state[i]])}</dd>
        <dt>Partner network</dt><dd>${esc(dict.network[c.network[i]])}</dd>
        <dt>Delivery</dt><dd>${esc(dict.delivery[c.delivery[i]])}</dd>
        <dt>Credential tier</dt><dd>${TIER_LABELS[TIER_OF[s]]}</dd>
        ${dep ? `<dt>App built</dt><dd>${esc(dict.app[c.app[i]])}</dd><dt>Hosted on</dt><dd>${esc(dict.hosting[c.host[i]])}</dd><dt>First deploy</dt><dd>Day ${c.days[i]}</dd><dt>30-day users</dt><dd>${fmt(c.users[i])}</dd><dt>Live at 90 days</dt><dd>${c.live90[i] === 1 ? 'Yes' : 'No'}</dd>` : '<dt>App built</dt><dd>Not deployed</dd>'}
        <dt>Sessions attended</dt><dd>${c.att[i]} of 24</dd>
      </dl>
      <div><div class="row" style="justify-content:space-between;font-size:13px"><span style="color:var(--dim)">Assessment</span><b class="num">${fx(pre)} → ${fx(post)} <span style="color:${post >= pre ? 'var(--ok)' : '#ff9d9d'}">${post >= pre ? '+' : ''}${fx(post - pre)}</span></b></div>
      <div class="scorebar"><div class="rail"></div><div class="gain" style="left:${Math.min(pre, post)}%;width:${Math.abs(post - pre)}%"></div><div class="m" style="left:${pre}%;background:var(--plasma)"></div><div class="m" style="left:${post}%;background:var(--ion)"></div></div></div>`);
  },
};
const svgPlay = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>';
const svgPause = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';
const svgReplay = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"/><path d="M4 4v4.5h4.5"/></svg>';
