// Chapter 6 — The 2027 Vault: a raymarched sealed crystal with a live countdown to the reviewed release.
const Vault = {
  id: 'vault', name: '2027 vault', root: 41.2, title: 'The 2027 cohort is sealed.',
  bloom: { strength: 0.8, radius: 0.6, threshold: 0.2 }, skyVisible: false, maxDpr: coarse ? 1 : 1.35,
  controls: { min: 4.5, max: 16, minPolar: 0.35, maxPolar: Math.PI * 0.62, rotateSpeed: 0.6 },
  hint: '',
  build() {
    const scene = this.scene = new THREE.Scene();
    this.u = { uTime: { value: 0 }, uRes: { value: new THREE.Vector2() }, uCam: { value: new THREE.Vector3() }, uRot: { value: new THREE.Matrix3() }, uTan: { value: 0.4 }, uAspect: { value: 1 }, uOff: { value: new THREE.Vector2() }, uOpen: { value: 0 } };
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: this.u, depthWrite: false, depthTest: false,
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
      fragmentShader: `
        uniform float uTime,uTan,uAspect,uOpen; uniform vec3 uCam; uniform mat3 uRot; uniform vec2 uOff; varying vec2 vUv;
        mat2 r2(float a){ float c=cos(a),s=sin(a); return mat2(c,-s,s,c); }
        float sdOct(vec3 p,float s){ p=abs(p); return (p.x+p.y+p.z-s)*.57735027; }
        float sdTorus(vec3 p,vec2 t){ vec2 q=vec2(length(p.xz)-t.x,p.y); return length(q)-t.y; }
        float sdBox(vec3 p,vec3 b){ vec3 q=abs(p)-b; return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.); }
        vec3 crys(vec3 p){ p.xz*=r2(uTime*.18); p.y*=.62; return p; }
        float gcore=0., gring=0.;
        vec2 map(vec3 p){
          vec3 q=crys(p);
          float c=sdOct(q,1.05)*.8;
          float groove=abs(sdOct(q,.86))-.012; c=max(c,-groove*.9);
          float m=c; float id=1.;
          float core=length(p)-.32; gcore+=.012/(.01+core*core*6.);
          for(int i=0;i<3;i++){
            float fi=float(i); vec3 r=p; r.xy*=r2(.9+fi*1.05+uTime*(.1+fi*.07)); r.yz*=r2(fi*1.3+uTime*.13);
            float rad=1.75+fi*.32; float t=sdTorus(r,vec2(rad,.028));
            float ang=atan(r.z,r.x); float seg=step(.5,fract(ang*6./6.2832*(2.+fi)+uTime*.2));
            gring+=.0008/(.0016+t*t*110.)*(.3+seg);
            if(t<m){ m=t; id=2.+fi; }
          }
          return vec2(m,id);
        }
        vec3 nrm(vec3 p){ vec2 e=vec2(.002,0.); return normalize(vec3(map(p+e.xyy).x-map(p-e.xyy).x,map(p+e.yxy).x-map(p-e.yxy).x,map(p+e.yyx).x-map(p-e.yyx).x)); }
        void main(){
          vec2 sc=(vUv*2.-1.); sc.x*=uAspect; sc+=uOff;
          vec3 rd=normalize(uRot*vec3(sc*uTan,-1.)); vec3 ro=uCam;
          float t=0.; vec2 h=vec2(1.,0.); bool hit=false;
          for(int i=0;i<90;i++){ vec3 p=ro+rd*t; h=map(p); if(h.x<.0015){ hit=true; break; } t+=h.x*.85; if(t>30.) break; }
          vec3 bg=vec3(.012,.014,.04)+vec3(.08,.06,.22)*pow(max(0.,1.-length(sc)*.55),3.);
          // floor grid far below
          if(rd.y<-.02){ float ft=(-2.6-ro.y)/rd.y; vec3 fp=ro+rd*ft; vec2 g=abs(fract(fp.xz*.8)-.5); float l=smoothstep(.03,0.,min(g.x,g.y)); float fd=exp(-ft*.09);
            float pulse=smoothstep(.4,0.,abs(length(fp.xz)-mod(uTime*2.2,22.)));
            bg+=vec3(.25,.4,1.)*l*fd*.35+vec3(1.,.75,.4)*pulse*l*fd*.6; }
          vec3 col=bg;
          if(hit){
            vec3 p=ro+rd*t, n=nrm(p); float fr=pow(1.-max(dot(-rd,n),0.),3.);
            if(h.y<1.5){
              vec3 q=crys(p); float facet=abs(fract((q.x+q.y*1.7+q.z)*3.)-.5);
              vec3 ref=reflect(rd,n); float env=pow(max(0.,ref.y*.5+.5),3.);
              vec3 inner=vec3(.18,.26,.75)*(.2+.8*pow(max(0.,1.-length(p)*.6),2.))+vec3(1.,.8,.5)*smoothstep(.46,.5,facet)*.35;
              col=inner*.32+vec3(.6,.7,1.)*env*.22+vec3(.5,.65,1.)*fr*.9;
              float seam=smoothstep(.05,0.,abs(sdOct(q,.86))); col+=vec3(1.,.78,.42)*seam*(1.2+.8*sin(uTime*2.));
            } else {
              float sp=pow(max(dot(reflect(rd,n),normalize(vec3(.5,.8,.3))),0.),40.);
              col=vec3(.06,.07,.12)+vec3(1.,.8,.5)*sp*1.5+vec3(.5,.6,1.)*fr*.6;
            }
          }
          col+=vec3(1.,.82,.55)*gcore*.2+mix(vec3(.5,.7,1.),vec3(1.,.78,.45),.5+.5*sin(uTime*.7))*gring*.3;
          col*=1.-.25*dot(vUv-.5,vUv-.5);
          gl_FragColor=vec4(col,1.);
        }`,
    }));
    quad.frustumCulled = false; scene.add(quad);
  },
  enter() {
    view.enabled = false; view.tx = view.ty = 0;
    const dist = isNarrow() ? 15 : 9.8;
    fly(new THREE.Vector3(0, dist * 0.18, dist), new THREE.Vector3(0, 0, 0), 2.4, new THREE.Vector3(0, 6, dist * 1.8), new THREE.Vector3(0, 0, 0));
    this.renderClock(); clearInterval(this.timer); this.timer = setInterval(() => this.renderClock(), 1000);
  },
  exit() { view.enabled = true; clearInterval(this.timer); requestAnimationFrame(measureOcclusion); },
  renderClock() {
    const el = $('#vault'), target = new Date(D.source.sealedUntil).getTime(), ms = Math.max(0, target - Date.now());
    const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
    const cells = [[d, 'days'], [h, 'hours'], [m, 'minutes'], [s, 'seconds']].map(([v, l]) => `<div><b>${String(v).padStart(2, '0')}</b><span>${l}</span></div>`).join('');
    if (!el.dataset.ready) { el.innerHTML = `<div class="seal">Sealed until review</div><div class="clock" id="vClock" aria-live="off">${cells}</div><p>${ms > 0 ? `Opens ${dateFmt.format(new Date(target))} at 12:00 AM Eastern, after explicit review. The countdown does not publish any data.` : 'The review window has opened. The 2027 cohort appears here only after an explicitly reviewed release.'}</p>`; el.dataset.ready = '1'; }
    else $('#vClock').innerHTML = cells;
  },
  update(dt, t) {
    const u = this.u; u.uTime.value = t;
    u.uCam.value.copy(camera.position); u.uRot.value.setFromMatrix4(camera.matrixWorld);
    u.uTan.value = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2); u.uAspect.value = innerWidth / innerHeight;
    if (isNarrow()) u.uOff.value.set(0, -0.1);
    else { const pr = $('#panel').hidden ? 0 : $('#panel').getBoundingClientRect().right; u.uOff.value.set(-(pr / 2) / (innerHeight / 2), -0.16); }
  },
  panel() {
    return `<p class="lede more">The program's fourth season is not in this dataset. The vault holds the place where it will appear once the cohort has finished and its figures have been reviewed. Until then, no row is published and nothing is estimated.</p>
      <div class="kpis">${kpi('0', 'Rows published for 2027', 'Sealed in the source')}${kpi('3', 'Seasons in this model', '2024, 2025, 2026')}${kpi(fmt(A.n), 'Modeled records so far', 'All synthetic')}${kpi('Mar 30', 'Review release date', '2027, 12:00 AM ET')}</div>
      <div class="row more"><a class="btn" href="https://www.zenai.world/ailiteracyyouth" target="_blank" rel="noopener">AI Pioneer Program</a><a class="btn ghost" href="https://arsenal.world" target="_blank" rel="noopener">ZEN Arsenal</a><a class="btn ghost" href="${esc(D.source.sourceUrl)}" target="_blank" rel="noopener">Dataset</a></div>`;
  },
  pick() { return false; },
};
