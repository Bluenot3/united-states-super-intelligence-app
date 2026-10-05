// USSI Genesis — engine: renderer, post-processing, shared sky, labels, layout-aware camera, sound.
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false });
renderer.setClearColor(0x050716, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
const fixedQuality = params.get('q') === 'fixed';
const DPR_CAP = coarse ? 1.75 : 2;
let dpr = Math.min(devicePixelRatio || 1, DPR_CAP);
let dprLimit = 99; // per-chapter ceiling (the raymarched vault asks for less)

const camera = new THREE.PerspectiveCamera(48, 1, 0.05, 600);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.075; controls.enablePan = false;
controls.rotateSpeed = coarse ? 0.55 : 0.7; controls.zoomSpeed = 0.8;
controls.autoRotateSpeed = 0.35;
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(new THREE.Scene(), camera);
const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.9, 0.6, 0.12);
const outputPass = new OutputPass();
const FinalShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uWarp: { value: 0 }, uFlash: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uGrain: { value: 0.035 }, uCA: { value: 0.006 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime,uWarp,uFlash,uGrain,uCA; uniform vec2 uRes; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    vec3 samp(vec2 uv, vec2 c, float ca){ return vec3(texture2D(tDiffuse, uv - c*ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv + c*ca).b); }
    void main(){
      vec2 uv=vUv, c=uv-.5; float r=length(c*vec2(uRes.x/uRes.y,1.));
      float ca=(uCA+uWarp*.05)*dot(c,c)*4.;
      vec3 col;
      if(uWarp>.002){
        col=vec3(0.); float tot=0.;
        for(int i=0;i<12;i++){ float t=float(i)/11.; float s=1.-uWarp*.22*t; float w=1.-t*.6; col+=samp(.5+c*s,c,ca)*w; tot+=w; }
        col/=tot; col*=1.+uWarp*.6;
      } else col=samp(uv,c,ca);
      col+=uFlash*vec3(.55,.65,1.)*(1.-r*.6);
      col*=mix(1.,smoothstep(1.25,.25,r),.55);
      col+= (h(uv*uRes+fract(uTime)*91.7)-.5)*uGrain;
      gl_FragColor=vec4(col,1.);
    }`,
};
const finalPass = new ShaderPass(FinalShader);
composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(outputPass); composer.addPass(finalPass);

// ---------- shared sky: nebula dome + twinkling starfield ----------
function makeSky() {
  const group = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(300, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uTintA: { value: new THREE.Color('#1a1060') }, uTintB: { value: new THREE.Color('#06345a') }, uAmt: { value: 1 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `
      uniform float uTime,uAmt; uniform vec3 uTintA,uTintB; varying vec3 vDir;
      float hash(vec3 p){ p=fract(p*.3183099+.1); p*=17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      float noise(vec3 x){ vec3 i=floor(x),f=fract(x); f=f*f*(3.-2.*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
      float fbm(vec3 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*noise(p); p*=2.03; a*=.5; } return s; }
      void main(){
        vec3 d=normalize(vDir);
        float n=fbm(d*2.4+vec3(0.,uTime*.004,0.));
        float m=fbm(d*5.1-vec3(uTime*.003));
        float band=exp(-pow(d.y*2.6+.25*sin(d.x*3.),2.));
        vec3 col=vec3(.008,.011,.035);
        col+=uTintA*pow(n,2.6)*1.1*(.45+band);
        col+=uTintB*pow(m,3.2)*1.3*band;
        col+=vec3(.6,.7,1.)*pow(max(0.,n*m-.32),2.)*.9;
        gl_FragColor=vec4(col*uAmt,1.);
      }`,
  }));
  dome.frustumCulled = false; group.add(dome);
  const N = 7000, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const u = hash(i, 7) * 2 - 1, t = hash(i, 8) * Math.PI * 2, r = 260, s = Math.sqrt(1 - u * u);
    pos.set([r * s * Math.cos(t), r * u, r * s * Math.sin(t)], i * 3); seed[i] = hash(i, 9);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const stars = new THREE.Points(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: 1 } },
    vertexShader: `attribute float aSeed; uniform float uTime,uPx; varying float vA; varying vec3 vC;
      void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv;
        float big=step(.985,aSeed); gl_PointSize=(1.1+big*1.8+aSeed*.6)*uPx;
        vA=(.25+.75*aSeed)*(.6+.4*sin(uTime*(.6+aSeed*2.)+aSeed*90.));
        vC=mix(vec3(.75,.82,1.),vec3(1.,.85,.7),step(.7,fract(aSeed*13.))); }`,
    fragmentShader: `varying float vA; varying vec3 vC; void main(){ vec2 q=gl_PointCoord*2.-1.; float a=exp(-dot(q,q)*3.)*vA; gl_FragColor=vec4(vC*a,a); }`,
  }));
  stars.frustumCulled = false; group.add(stars);
  return { group, dome, stars };
}
const sky = makeSky();

// ---------- shared shader snippets ----------
const GLSL_NOISE = `
  vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;} vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
  vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);} vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
  float snoise(vec3 v){ const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);
    vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx); vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g;
    vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy); vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
    i=mod289(i); vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
    float n_=.142857142857; vec3 ns=n_*D.wyz-D.xzx; vec4 j=p-49.*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
    vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y); vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.)); vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3))); p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
    vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;
    return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3))); }
  float fbm3(vec3 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*snoise(p); p*=2.02; a*=.5; } return s; }
`;
function glowSprite(color, size, power = 2.2, opacity = 1) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(color) }, uPow: { value: power }, uOp: { value: opacity }, uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(0.,0.,0.,1.); mv.xy+=position.xy*vec2(length(modelMatrix[0].xyz),length(modelMatrix[1].xyz)); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uPow,uOp,uTime; varying vec2 vUv; void main(){ float r=length(vUv-.5)*2.; float a=pow(max(0.,1.-r),uPow)*uOp; gl_FragColor=vec4(uColor*a,a); }`,
  }));
  m.scale.set(size, size, 1); m.frustumCulled = false; return m;
}

// ---------- labels anchored to 3D points ----------
const labelRoot = $('#labels');
const labels = {
  list: [],
  add(html, pos, opt = {}) {
    const el = document.createElement(opt.onTap ? 'button' : 'div');
    el.className = 'lbl ' + (opt.cls || 'tag'); el.innerHTML = html;
    if (opt.onTap) { el.classList.add('tap'); el.addEventListener('click', e => { e.stopPropagation(); opt.onTap(); }); el.setAttribute('aria-label', opt.aria || el.textContent); }
    labelRoot.appendChild(el);
    const L = { el, pos: pos instanceof THREE.Vector3 ? pos : new THREE.Vector3(), fn: typeof pos === 'function' ? pos : null, anchor: opt.anchor || 'bottom', hidden: false, fade: opt.fade ?? 0, alpha: 1 };
    this.list.push(L); return L;
  },
  clear() { this.list.forEach(l => l.el.remove()); this.list = []; },
  update() {
    const w = innerWidth, h = innerHeight, v = new THREE.Vector3();
    for (const L of this.list) {
      if (L.fn) L.fn(L.pos);
      v.copy(L.pos).project(camera);
      const off = v.z > 1 || v.z < -1 || L.hidden || L.alpha <= 0.01;
      if (off) { if (L.el.style.visibility !== 'hidden') L.el.style.visibility = 'hidden'; continue; }
      L.el.style.visibility = 'visible';
      const x = (v.x * .5 + .5) * w, y = (-v.y * .5 + .5) * h;
      const t = L.anchor === 'left' ? 'translate(8px,-50%)' : L.anchor === 'center' ? 'translate(-50%,-50%)' : L.anchor === 'top' ? 'translate(-50%,6px)' : 'translate(-50%,-100%) translateY(-8px)';
      L.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) ${t}`;
      L.el.style.opacity = L.alpha.toFixed(2);
    }
  },
};

// ---------- layout-aware view offset: keep the subject centered in the visible area ----------
const view = { x: 0, y: 0, tx: 0, ty: 0, enabled: true };
function measureOcclusion() {
  const panel = $('#panel'), inspect = $('#inspect');
  let tx = 0, ty = 0;
  if (!view.enabled) { view.tx = 0; view.ty = 0; return; }
  if (isNarrow()) {
    const top = 56;
    const visibleSheet = !inspect.hidden ? inspect : (!panel.hidden ? panel : null);
    const bottom = visibleSheet ? innerHeight - visibleSheet.getBoundingClientRect().top : 80;
    ty = clamp((bottom - top) / 2, 0, innerHeight * 0.28);
  } else {
    const left = panel.hidden ? 0 : panel.getBoundingClientRect().right;
    const right = inspect.hidden ? 0 : innerWidth - inspect.getBoundingClientRect().left;
    tx = (left - right) / 2;
  }
  view.tx = tx; view.ty = ty;
}
function applyView(dt) {
  const k = 1 - Math.exp(-dt * 5);
  view.x += (view.tx - view.x) * k; view.y += (view.ty - view.y) * k;
  const w = innerWidth, h = innerHeight;
  if (Math.abs(view.x) < .5 && Math.abs(view.y) < .5) camera.clearViewOffset();
  else camera.setViewOffset(w, h, -view.x, view.y, w, h);
}
// Distance needed to frame a sphere of radius r in the visible part of the viewport
function fitDistance(r) {
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const visH = isNarrow() ? innerHeight * 0.56 : innerHeight * 0.9;
  const visW = isNarrow() ? innerWidth * 0.98 : innerWidth - Math.min(430, innerWidth * .34);
  const t = Math.min(tanV * visH / innerHeight, tanV * visW / innerHeight);
  return r / Math.sin(Math.atan(t));
}

function resize() {
  const w = innerWidth, h = innerHeight, p = Math.min(dpr, dprLimit);
  renderer.setPixelRatio(p); renderer.setSize(w, h, false);
  composer.setPixelRatio(p); composer.setSize(w, h);
  bloom.resolution.set(w * p, h * p);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  finalPass.uniforms.uRes.value.set(w * p, h * p);
  sky.stars.material.uniforms.uPx.value = p;
  measureOcclusion();
  Chapters.current?.onResize?.();
}

// ---------- adaptive quality ----------
const perf = { acc: 0, frames: 0, cool: 0 };
function adapt(dtMs) {
  if (fixedQuality) return;
  perf.acc += dtMs; perf.frames++; perf.cool -= dtMs;
  if (perf.frames >= 75) {
    const avg = perf.acc / perf.frames; perf.acc = 0; perf.frames = 0;
    if (avg > 23 && dpr > 0.75 && perf.cool <= 0) { dpr = Math.max(0.75, dpr - 0.25); perf.cool = 2500; resize(); }
  }
}

// ---------- ambient sound (generated, no files) ----------
const Sound = {
  ctx: null, on: false, master: null, oscs: [], filter: null,
  init() {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    const ctx = this.ctx = new AC();
    const master = this.master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
    const delay = ctx.createDelay(1.5); delay.delayTime.value = 0.42; const fb = ctx.createGain(); fb.gain.value = 0.42; const wet = ctx.createGain(); wet.gain.value = 0.35;
    delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);
    this.bus = ctx.createGain(); this.bus.connect(master); this.bus.connect(delay);
    const filter = this.filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 520; filter.Q.value = 2; filter.connect(this.bus);
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = 0.05; lfoG.gain.value = 260; lfo.connect(lfoG); lfoG.connect(filter.frequency); lfo.start();
    [[1, 'sawtooth', .05], [1.5, 'triangle', .06], [2, 'sine', .07], [3.003, 'sine', .025], [0.5, 'sine', .09]].forEach(([m, type, g]) => {
      const o = ctx.createOscillator(), gn = ctx.createGain(); o.type = type; o.frequency.value = 55 * m; o.detune.value = (Math.random() - .5) * 12; gn.gain.value = g; o.connect(gn); gn.connect(filter); o.start(); this.oscs.push([o, m]);
    });
    // airy noise bed
    const len = ctx.sampleRate * 2, nb = ctx.createBuffer(1, len, ctx.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = .7; const ng = ctx.createGain(); ng.gain.value = .018; ns.connect(bp); bp.connect(ng); ng.connect(this.bus); ns.start();
    return true;
  },
  toggle(force) {
    const want = force ?? !this.on;
    if (want && !this.ctx && !this.init()) return;
    this.on = want; if (!this.ctx) return;
    this.ctx.resume?.();
    const t = this.ctx.currentTime; this.master.gain.cancelScheduledValues(t); this.master.gain.setTargetAtTime(want ? 0.55 : 0, t, 0.6);
    const b = $('#soundBtn'); b.setAttribute('aria-pressed', String(want)); b.setAttribute('aria-label', want ? 'Turn ambient sound off' : 'Turn ambient sound on'); b.querySelector('.wave').setAttribute('opacity', want ? '1' : '.35');
  },
  root(f) { if (!this.ctx) return; const t = this.ctx.currentTime; this.oscs.forEach(([o, m]) => o.frequency.setTargetAtTime(f * m, t, 1.4)); },
  blip(freq = 880, dur = .18, vol = .08, type = 'sine') {
    if (!this.on || !this.ctx) return; const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 1.5, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + dur + .05);
  },
  whoosh() {
    if (!this.on || !this.ctx) return; const ctx = this.ctx, t = ctx.currentTime, len = ctx.sampleRate * 1.2, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / len);
    const s = ctx.createBufferSource(); s.buffer = b; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3; f.frequency.setValueAtTime(200, t); f.frequency.exponentialRampToValueAtTime(3200, t + .6); f.frequency.exponentialRampToValueAtTime(300, t + 1.2);
    const g = ctx.createGain(); g.gain.value = .22; s.connect(f); f.connect(g); g.connect(this.bus); s.start(t);
  },
};
