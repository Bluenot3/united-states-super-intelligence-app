// Chapter 4 — Cognitive Terrain: five mountain ranges, one per assessment construct.
// Height at score x = number of learners with that score (Gaussian-smoothed histogram, shared scale).
const CONSTRUCT_SHORT = ['Foundations', 'Prompting', 'Build & deploy', 'Data & privacy', 'Ethics'];
const TER_W = 16, TER_D = 11, TER_H = 3.6, RIDGE_W = 0.46;
const Terrain = {
  id: 'terrain', name: 'Terrain', root: 65.4, title: 'The landscape of understanding.',
  sky: { a: '#16124a', b: '#0a3550', amt: .7 }, bloom: { strength: 0.6, radius: 0.5, threshold: 0.32 },
  controls: { min: 5, max: 38, maxPolar: Math.PI * 0.44, autoRotate: false },
  hint: 'Drag to orbit, tap a range to read its scores',
  morph: 0, auto: true, phase: 0,
  build() {
    const scene = this.scene = new THREE.Scene();
    const sm = h => { const out = new Float64Array(101), s = 1.8; for (let i = 0; i < 101; i++) { let a = 0, w = 0; for (let j = -6; j <= 6; j++) { const k = i + j; if (k < 0 || k > 100) continue; const g = Math.exp(-j * j / (2 * s * s)); a += h[k] * g; w += g; } out[i] = a / w; } return out; };
    const series = [...A.cPre.map(sm), ...A.cPost.map(sm)];
    const peak = Math.max(...series.map(s => Math.max(...s)));
    this.series = series.map(s => Array.from(s, v => v / peak));
    const tex = new Uint8Array(101 * 10 * 4);
    this.series.forEach((s, row) => s.forEach((v, i) => { tex[(row * 101 + i) * 4] = Math.round(v * 255); tex[(row * 101 + i) * 4 + 3] = 255; }));
    const dt = new THREE.DataTexture(tex, 101, 10, THREE.RGBAFormat); dt.magFilter = dt.minFilter = THREE.LinearFilter; dt.needsUpdate = true;
    this.u = {
      uHist: { value: dt }, uMorph: { value: 0 }, uH: { value: TER_H }, uW: { value: RIDGE_W }, uTime: { value: 0 },
      uSun: { value: new THREE.Vector3(-0.5, 0.75, 0.45) }, uCols: { value: CONSTRUCTS.map(k => new THREE.Color(k.color)) },
      uMean: { value: A.cPreMean.map(v => v / 100) }, uHot: { value: -1 },
    };
    const geo = new THREE.PlaneGeometry(TER_W, TER_D, coarse ? 220 : 300, coarse ? 150 : 200); geo.rotateX(-Math.PI / 2);
    const common = `
      uniform sampler2D uHist; uniform float uMorph,uH,uW,uTime,uHot; uniform vec3 uCols[5]; uniform float uMean[5];
      float hk(int k,float u){ float x=(clamp(u,0.,1.)*100.+.5)/101.; float a=texture2D(uHist,vec2(x,(float(k)+.5)/10.)).r; float b=texture2D(uHist,vec2(x,(float(k)+5.5)/10.)).r; return mix(a,b,uMorph); }
      float ridge(float z,int k){ float zk=-4.+float(k)*2.; return exp(-pow(z-zk,2.)/(2.*uW*uW)); }
      float H(vec2 p){ float u=(p.x+${(TER_W / 2).toFixed(1)})/${TER_W.toFixed(1)}; float h=0.; for(int k=0;k<5;k++) h+=hk(k,u)*ridge(p.y,k); float edge=smoothstep(0.,.03,u)*smoothstep(1.,.97,u); return h*uH*edge; }`;
    this.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: this.u, extensions: { derivatives: true },
      vertexShader: `${common}
        varying vec3 vN,vCol,vWP; varying float vH; varying vec2 vP;
        void main(){
          vec2 p=position.xz; float h=H(p); float e=.05;
          vec3 n=normalize(vec3(H(p-vec2(e,0.))-H(p+vec2(e,0.)), 2.*e, H(p-vec2(0.,e))-H(p+vec2(0.,e))));
          vec3 col=vec3(0.); float ws=0.; for(int k=0;k<5;k++){ float g=ridge(p.y,k)+.0001; col+=uCols[k]*g*(1.+step(-.5,uHot)*(float(k)==uHot?1.2:-.55)); ws+=g; }
          vCol=col/ws; vN=n; vH=h/uH; vP=p;
          vec4 wp=modelMatrix*vec4(p.x,h,p.y,1.); vWP=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp;
        }`,
      fragmentShader: `${common}
        uniform vec3 uSun; varying vec3 vN,vCol,vWP; varying float vH; varying vec2 vP;
        void main(){
          vec3 n=normalize(vN); float u=(vP.x+${(TER_W / 2).toFixed(1)})/${TER_W.toFixed(1)};
          float dif=max(dot(n,normalize(uSun)),0.); float amb=.18+.22*n.y;
          vec3 base=mix(vec3(.015,.02,.06),vCol*.26,smoothstep(0.,.3,vH));
          vec3 c=base*(amb+dif*1.25);
          c+=vCol*pow(vH,3.)*.75;
          float hc=vH*14.; float w=fwidth(hc); float dl=.5-abs(fract(hc)-.5); float cl=1.-smoothstep(0.,w*1.3,dl); c+=vCol*cl*.55*smoothstep(.02,.1,vH);
          float s10=abs(fract(u*10.+.5)-.5)/10.; float s25=abs(fract(u*4.+.5)-.5)/4.; float fw=fwidth(u);
          c+=vec3(.35,.5,1.)*((1.-smoothstep(0.,fw*1.2,s10))*.07+(1.-smoothstep(0.,fw*1.6,s25))*.22);
          for(int k=0;k<5;k++){ float g=ridge(vP.y,k); float m=1.-smoothstep(0.,fw*2.5,abs(u-uMean[k])); c+=mix(uCols[k],vec3(1.),.4)*m*g*2.2; }
          vec3 V=normalize(cameraPosition-vWP); float fr=pow(1.-max(dot(n,V),0.),3.); c+=vCol*fr*.35*smoothstep(.02,.2,vH);
          float edge=smoothstep(${(TER_W / 2 + .2).toFixed(2)},${(TER_W / 2 - 1.2).toFixed(2)},abs(vP.x))*smoothstep(${(TER_D / 2 + .1).toFixed(2)},${(TER_D / 2 - 1.).toFixed(2)},abs(vP.y));
          gl_FragColor=vec4(mix(vec3(.018,.024,.075),c,edge),1.);
        }`,
    }));
    scene.add(this.mesh);
    // Drifting motes above the terrain (atmosphere only)
    const M = coarse ? 700 : 1400, mp = new Float32Array(M * 3), ms = new Float32Array(M);
    for (let i = 0; i < M; i++) { mp.set([(hash(i, 51) - .5) * TER_W, hash(i, 52) * 5, (hash(i, 53) - .5) * TER_D], i * 3); ms[i] = hash(i, 54); }
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(mp, 3)); mg.setAttribute('aSeed', new THREE.BufferAttribute(ms, 1));
    this.motes = new THREE.Points(mg, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: this.u.uTime, uPx: { value: 1 } },
      vertexShader: `attribute float aSeed; uniform float uTime,uPx; varying float vA; void main(){ vec3 p=position; p.y=mod(p.y+uTime*(.12+aSeed*.2),5.); p.x+=sin(uTime*.3+aSeed*20.)*.2;
        vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv; gl_PointSize=(1.5+aSeed*2.)*uPx; vA=sin(p.y/5.*3.1416)*.55; }`,
      fragmentShader: `varying float vA; void main(){ vec2 q=gl_PointCoord*2.-1.; float a=exp(-dot(q,q)*3.)*vA; gl_FragColor=vec4(vec3(.7,.85,1.)*a,a); }`,
    }));
    this.motes.frustumCulled = false; scene.add(this.motes);
    // Hit plane for taps (displacement lives in the shader)
    this.hit = new THREE.Mesh(new THREE.PlaneGeometry(TER_W, TER_D), new THREE.MeshBasicMaterial({ visible: false })); this.hit.rotation.x = -Math.PI / 2; this.hit.position.y = 0.6; scene.add(this.hit);
  },
  ridgeHeightAt(k, u) { const i = clamp(Math.round(u * 100), 0, 100); return lerp(this.series[k][i], this.series[k + 5][i], this.morph) * TER_H; },
  meanAt(k) { return lerp(A.cPreMean[k], A.cPostMean[k], this.morph); },
  enter() {
    const d = fitDistance(7.2), tgt = new THREE.Vector3(0, 0.7, 0.2);
    fly(new THREE.Vector3(-d * 0.12, d * 0.58, d * 0.8), tgt, 2.6, new THREE.Vector3(-d * 1.2, d * 0.2, d * 0.2), new THREE.Vector3(0, 0, 0));
    this.motes.material.uniforms.uPx.value = renderer.getPixelRatio();
    this.auto = !reduceMotion; this.phase = 0; this.setMorph(reduceMotion ? 1 : 0);
    const narrow = isNarrow();
    this.lbls = CONSTRUCTS.map((k, i) => labels.add('', p => { const u = this.meanAt(i) / 100; p.set(u * TER_W - TER_W / 2, this.ridgeHeightAt(i, u) + 0.25, -4 + i * 2); }, { cls: 'tag', onTap: () => this.inspectConstruct(i), aria: `${k.label} details` }));
    [0, 25, 50, 75, 100].forEach(s => labels.add(`<small class="num">${s}</small>`, new THREE.Vector3(s / 100 * TER_W - TER_W / 2, 0.02, TER_D / 2 - 0.15), { cls: 'state', anchor: 'top' }));
    labels.add(narrow ? '<small>Score</small>' : '<small>Assessment score, 0 to 100</small>', new THREE.Vector3(TER_W / 2 + 0.3, 0.02, TER_D / 2 - 0.15), { cls: 'state', anchor: 'left' });
    this.refreshLabels();
  },
  refreshLabels() {
    if (!this.lbls) return; const narrow = isNarrow();
    this.lbls.forEach((L, i) => { const m = this.meanAt(i); L.el.innerHTML = `<b>${esc(narrow ? CONSTRUCT_SHORT[i] : CONSTRUCTS[i].label)}</b> <span class="num" style="color:${CONSTRUCTS[i].color}">${fx(m)}</span>`; });
    const lab = $('#trWhen'); if (lab) lab.textContent = this.morph < 0.02 ? 'Before the program' : this.morph > 0.98 ? 'After the program' : `Transition ${Math.round(this.morph * 100)}%`;
    const mm = $('#trMean'); if (mm) mm.textContent = fx(lerp(A.preMean, A.postMean, this.morph));
  },
  setMorph(v) {
    this.morph = clamp(v, 0, 1); this.u.uMorph.value = this.morph;
    this.u.uMean.value = CONSTRUCTS.map((_, k) => this.meanAt(k) / 100);
    const r = $('#trMorph'); if (r) { r.value = Math.round(this.morph * 1000); syncRange(r); }
    this.refreshLabels();
  },
  update(dt, t) {
    this.u.uTime.value = t;
    if (this.auto) {
      this.phase = (this.phase + dt) % 11; const p = this.phase;
      const v = p < 1.6 ? 0 : p < 5 ? easeInOut((p - 1.6) / 3.4) : p < 7.6 ? 1 : p < 11 ? 1 - easeInOut((p - 7.6) / 3.4) : 0;
      this.setMorph(v);
    }
  },
  panel() {
    return `<p class="lede more">Five mountain ranges, one for each assessment construct. Left to right is the score from 0 to 100, and height is how many learners scored there. Watch the ranges travel right as before scores become after scores. The bright line on each range marks its mean.</p>
      <div class="kpis">${kpi(fx(A.preMean), 'Mean score before', 'Composite, 0 to 100')}${kpi(fx(A.postMean), 'Mean score after', `${fmt(A.n)} learners`)}${kpi('+' + fx(A.gain), 'Mean gain, points', 'Within-learner change')}${kpi(fx(A.stdGain, 2), 'Standardized gain', 'Pooled SD, no comparison group')}</div>
      <div class="timeline"><div class="when"><b id="trWhen">Before the program</b><span>Composite mean <b class="num" id="trMean">${fx(A.preMean)}</b></span></div>
        <input type="range" id="trMorph" min="0" max="1000" value="0" aria-label="Before to after">
        <div class="season-ticks"><span>Before</span><span>After</span></div></div>
      <div class="row"><button class="btn ghost" id="trAuto">${this.auto ? svgPause + ' Hold' : svgPlay + ' Animate'}</button></div>
      <div class="more"><div class="ctl-label">Gain by construct</div>${barRows(CONSTRUCTS.map((k, i) => [k.label, A.cPostMean[i] - A.cPreMean[i], `+${fx(A.cPostMean[i] - A.cPreMean[i])}`]), 1, CONSTRUCTS.map(k => k.color))}
      <p class="note" style="margin-top:10px">Pre and post scores come from the same modeled learners with no comparison group. The change is descriptive and does not show that the program caused it.</p></div>`;
  },
  bind(root) {
    const r = $('#trMorph', root);
    r.addEventListener('input', () => { this.auto = false; this.syncAuto(); this.setMorph(r.value / 1000); });
    $('#trAuto', root).onclick = () => { this.auto = !this.auto; this.syncAuto(); };
    this.setMorph(this.morph);
  },
  syncAuto() { const b = $('#trAuto'); if (b) b.innerHTML = this.auto ? `${svgPause} Hold` : `${svgPlay} Animate`; },
  pick(x, y) {
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), camera);
    const h = ray.intersectObject(this.hit)[0]; if (!h) return false;
    const k = clamp(Math.round((h.point.z + 4) / 2), 0, 4); this.inspectConstruct(k); return true;
  },
  inspectConstruct(k) {
    this.u.uHot.value = k;
    const c = CONSTRUCTS[k];
    showInspect(`<header><div><h2>${esc(c.label)}</h2><div class="sub">${fmt(A.n)} modeled learners, scored 0 to 100</div></div>${closeBtn}</header>
      <dl class="facts"><dt>Mean before</dt><dd>${fx(A.cPreMean[k])}</dd><dt>Mean after</dt><dd>${fx(A.cPostMean[k])}</dd><dt>Mean gain</dt><dd style="color:var(--ok)">+${fx(A.cPostMean[k] - A.cPreMean[k])}</dd><dt>Scoring 70+ before</dt><dd>${pct(A.cPre70[k] / A.n)}</dd><dt>Scoring 70+ after</dt><dd>${pct(A.cPost70[k] / A.n)}</dd></dl>
      <div class="scorebar"><div class="rail"></div><div class="gain" style="left:${A.cPreMean[k]}%;width:${A.cPostMean[k] - A.cPreMean[k]}%"></div><div class="m" style="left:${A.cPreMean[k]}%;background:var(--plasma)"></div><div class="m" style="left:${A.cPostMean[k]}%;background:var(--ion)"></div></div>`);
  },
  onDeselect() { this.u.uHot.value = -1; },
  exit() { this.onDeselect(); this.lbls = null; },
};
