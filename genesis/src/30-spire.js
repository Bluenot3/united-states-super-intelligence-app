// Chapter 2 — The Launch Spire: every learner climbs to the highest stage they reached.
const LEVEL_H = 1.22;
const Spire = {
  id: 'spire', name: 'Launch spire', root: 61.7, title: 'From first login to capstone.',
  sky: { a: '#14205e', b: '#063a4a', amt: .8 }, bloom: { strength: 1.0, radius: 0.55, threshold: 0.1 },
  controls: { min: 5, max: 45, maxPolar: Math.PI * 0.62, rotateSpeed: 0.3 },
  hint: 'Drag to orbit, tap a ring to read that stage',
  cohort: -1,
  stats(co) {
    const st = co < 0 ? A.stages : A.byCohort[co].stages, n = st.reduce((a, b) => a + b, 0);
    const at = st.map((_, s) => st.slice(s).reduce((a, b) => a + b, 0));
    return { st, n, at };
  },
  radius(at, n) { return 0.9 + 4.5 * Math.sqrt(at / n); },
  build() {
    const scene = this.scene = new THREE.Scene(), n = D.n, c = D.c;
    const data = new Float32Array(n * 4), seeds = new Float32Array(n * 3), pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const co = Math.min(2, c.cohort[i]);
      data.set([c.stage[i], co, (co * SEASON_DAYS + c.eday[i]) / (SEASON_DAYS * 3) * 5.5 + hash(i, 21) * 0.25, 0], i * 4);
      seeds.set([hash(i, 22), hash(i, 23), hash(i, 24)], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aData', new THREE.BufferAttribute(data, 4)); g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
    const s0 = this.stats(-1);
    this.radii = s0.at.map(v => this.radius(v, s0.n));
    this.u = { uTime: { value: 0 }, uClock: { value: 0 }, uR: { value: this.radii.slice() }, uCohort: { value: -1 }, uScale: { value: 1 }, uPx: { value: 1 }, uStage: { value: STAGE_COLORS.map(h => new THREE.Color(h)) }, uH: { value: LEVEL_H } };
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute vec4 aData; attribute vec3 aSeed; uniform float uTime,uClock,uR[8],uCohort,uScale,uPx,uH; uniform vec3 uStage[8];
        varying vec3 vC; varying float vA;
        void main(){
          int s=int(aData.x+.5); float lv=aData.x;
          float vis = (uCohort<-.5 || abs(aData.y-uCohort)<.1) ? 1. : 0.;
          float dur = 1.4 + lv*.42;
          float p = lv<.5 ? 0. : clamp((uClock-aData.z)/dur,0.,1.);
          float rT = uR[s]*(.58+.42*sqrt(aSeed.y));
          float rPad = uR[0]*(.58+.42*sqrt(aSeed.y));
          float a1=smoothstep(0.,.16,p), a2=smoothstep(.12,.82,p), a3=smoothstep(.78,1.,p);
          float rr = mix(mix(rPad,.18+.12*aSeed.x,a1), rT, a3);
          float y = lv*uH*(1.-pow(1.-a2,2.2));
          float ang = aSeed.x*6.2831 + p*9. + uTime*(.06+.35/(rr+.6));
          y += (aSeed.z-.5)*.16*(1.-a2+a3);
          vec3 pos=vec3(cos(ang)*rr, y, sin(ang)*rr);
          vec4 mv=modelViewMatrix*vec4(pos,1.); gl_Position=projectionMatrix*mv;
          float climbing = a2*(1.-a3);
          gl_PointSize = clamp((.05+climbing*.05)*uScale/-mv.z,0.,40.*uPx)*vis;
          vC = uStage[s]*(.75+climbing*1.6);
          vA = vis*(.75+.25*sin(uTime*2.+aSeed.z*50.));
        }`,
      fragmentShader: `varying vec3 vC; varying float vA; void main(){ vec2 q=gl_PointCoord*2.-1.; float r2=dot(q,q); if(r2>1.) discard; float a=(exp(-r2*10.)+exp(-r2*3.)*.25)*vA; gl_FragColor=vec4(vC*a,a); }`,
    }));
    this.points.frustumCulled = false; scene.add(this.points);

    // Energy column
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, LEVEL_H * 7 + 1.6, 48, 1, true), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uTime: this.u.uTime },
      vertexShader: `varying vec2 vUv; varying vec3 vN,vV; void main(){ vUv=uv; vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform float uTime; varying vec2 vUv; varying vec3 vN,vV;
        void main(){ float f=pow(1.-abs(dot(vN,vV)),2.); float bands=pow(.5+.5*sin(vUv.y*60.-uTime*7.),6.); float fade=smoothstep(1.,.75,vUv.y)*smoothstep(0.,.05,vUv.y);
          vec3 c=mix(vec3(.25,.6,1.),vec3(.9,.95,1.),bands)*(f*.9+bands*.35)*fade; gl_FragColor=vec4(c,1.); }`,
    }));
    col.position.y = (LEVEL_H * 7 + 1.6) / 2 - 0.4; scene.add(col);
    const crown = glowSprite('#fff1cf', 2.6, 2.6, 0.9); crown.position.y = LEVEL_H * 7 + 0.9; scene.add(crown); this.crown = crown;

    // Gauge rings: 100 ticks per ring, lit ticks = share of learners who reached this stage
    this.rings = []; this.discs = [];
    for (let s = 0; s < 8; s++) {
      const ringU = { uTime: this.u.uTime, uColor: { value: new THREE.Color(STAGE_COLORS[s]) }, uRate: { value: s0.at[s] / s0.n }, uHot: { value: 0 } };
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.93, 1.0, 256, 1), new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: ringU,
        vertexShader: `varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
        fragmentShader: `uniform vec3 uColor; uniform float uRate,uTime,uHot; varying vec2 vP;
          void main(){ float a=atan(vP.y,vP.x); float u=fract(-a/6.28318+.25); float tick=step(.32,fract(u*100.));
            float lit=step(u,uRate); float r=length(vP); float edge=smoothstep(.93,.95,r)*smoothstep(1.,.98,r);
            float sweep=pow(max(0.,1.-abs(fract(u-uTime*.08)-.5)*2.),18.)*.8;
            float v=edge*(tick*(lit*1.1+.12)+sweep*lit)*(1.+uHot*1.2); gl_FragColor=vec4(uColor*v,v); }`,
      }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = s * LEVEL_H; ring.scale.setScalar(this.radii[s]);
      scene.add(ring); this.rings.push({ mesh: ring, u: ringU, anim: { v: this.radii[s] } });
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 96), new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: ringU,
        vertexShader: `varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
        fragmentShader: `uniform vec3 uColor; uniform float uHot; varying vec2 vP; void main(){ float r=length(vP); float grid=smoothstep(.04,0.,abs(fract(r*6.)-.5)-.46)*.5; float v=(pow(r,3.)*.12+grid*.05)*(1.+uHot*2.); gl_FragColor=vec4(uColor*v,v); }`,
      }));
      disc.rotation.x = -Math.PI / 2; disc.position.y = s * LEVEL_H - 0.002; disc.scale.setScalar(this.radii[s]); disc.userData.stage = s;
      scene.add(disc); this.discs.push(disc);
    }
    // Floor: polar grid
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 128), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { uTime: this.u.uTime },
      vertexShader: `varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform float uTime; varying vec2 vP; void main(){ float r=length(vP), a=atan(vP.y,vP.x);
        float rings=smoothstep(.03,0.,abs(fract(r*.8)-.5)-.47); float spokes=smoothstep(.02,0.,abs(fract(a*12./6.2832)-.5)-.48)*step(1.,r);
        float pulse=smoothstep(.25,0.,abs(r-mod(uTime*3.,30.)))*.6; float fade=smoothstep(30.,4.,r);
        float v=(rings*.16+spokes*.07+pulse*.25)*fade; gl_FragColor=vec4(vec3(.35,.6,1.)*v,v); }`,
    }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.45; scene.add(floor);
  },
  enter() {
    const d = fitDistance(isNarrow() ? 7.6 : 6.6), tgt = new THREE.Vector3(0, LEVEL_H * 3.6, 0);
    fly(new THREE.Vector3(d * 0.62, LEVEL_H * 3.6 + d * 0.32, d * 0.76), tgt, 2.6, new THREE.Vector3(0, -2, d * 1.6), new THREE.Vector3(0, LEVEL_H * 6, 0));
    this.replay();
    this.makeLabels(); this.onResize();
  },
  onResize() { this.u.uPx.value = renderer.getPixelRatio(); this.u.uScale.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)); },
  replay() { this.u.uClock.value = reduceMotion ? 99 : -0.3; },
  makeLabels() {
    const S = this.stats(this.cohort);
    const right = new THREE.Vector3();
    this.lbls = this.rings.map((r, s) => labels.add(this.labelHTML(s, S), p => {
      camera.getWorldDirection(right); right.set(-right.z, 0, right.x).normalize();
      p.copy(right).multiplyScalar(this.rings[s].mesh.scale.x + 0.15); p.y = s * LEVEL_H;
    }, { cls: 'tag', anchor: 'left', onTap: () => this.inspectStage(s), aria: `Stage ${s} details` }));
  },
  labelHTML(s, S) { return isNarrow() ? `<b>S${s}</b> <span class="num">${pct(S.at[s] / S.n, 0)}</span>` : `<b>S${s}</b> ${esc(STAGE_SHORT[s])} <b class="num">${pct(S.at[s] / S.n)}</b><small class="line">${fmt(S.st[s])} stopped here</small>`; },
  setCohort(co) {
    this.cohort = co; this.u.uCohort.value = co;
    const S = this.stats(co);
    this.rings.forEach((r, s) => {
      tween(r.anim, 'v', this.radius(S.at[s], S.n), 1.2);
      tween(r.u.uRate, 'value', S.at[s] / S.n, 1.2);
      if (this.lbls?.[s]) this.lbls[s].el.innerHTML = this.labelHTML(s, S);
    });
    this.replay(); this.renderKpis();
  },
  renderKpis() {
    const S = this.stats(this.cohort), co = this.cohort, dep = S.at[2], k = $('#spKpis'); if (!k) return;
    const days = co < 0 ? A.medianDays : null;
    k.innerHTML = `${kpi(pct(dep / S.n), 'Shipped a live URL', `${fmt(dep)} of ${fmt(S.n)}`)}${kpi(pct(S.at[5] / S.n), 'Public launch, custom domain', `${fmt(S.at[5])} learners`)}${kpi(pct(S.at[7] / S.n), 'Capstone and credential', `${fmt(S.at[7])} AI Pioneers`)}${kpi(co < 0 ? `${fx(days, 0)} days` : fmt(S.n), co < 0 ? 'Median time to first deploy' : `Learners in ${2024 + co}`, co < 0 ? `Mean ${fx(A.meanDays)} days, S2+ only` : 'Cohort enrollment records')}`;
  },
  panel() {
    return `<p class="lede more">All ${fmt(A.n)} learners start on the launch pad. Each one climbs the column and settles on the highest stage they reached. Each ring is a gauge with 100 ticks, and the lit ticks show the share who got that far.</p>
      <div class="kpis" id="spKpis"></div>
      <div class="controls"><div><div class="ctl-label">Cohort</div>${seg('Cohort', [[-1, 'All'], [0, '2024'], [1, '2025'], [2, '2026'], ['sealed', '2027', true]], this.cohort)}</div>
      <div class="row"><button class="btn ghost" id="spReplay">${svgReplay} Replay the launch</button></div></div>
      <div class="more"><div class="ctl-label">Credential tiers</div>${barRows(TIER_LABELS.map((t, i) => { const S = this.stats(this.cohort); const v = S.st.reduce((a, x, s) => a + (TIER_OF[s] === i ? x : 0), 0); return [t, v]; }), this.stats(this.cohort).n, ['#6a55c9', '#3d9bff', '#3dfcbf', '#ffcf5c', '#fff3d6'])}<p class="note" style="margin-top:10px">Stages are each learner's highest modeled milestone. There are no achievement dates, so the climb animation shows final standing, not timing.</p></div>`;
  },
  bind(root) {
    this.renderKpis();
    bindSeg(root, '.seg', v => { this.setCohort(+v); const tiers = $('.more .bars', root); if (tiers) tiers.outerHTML = barRows(TIER_LABELS.map((t, i) => [t, this.stats(this.cohort).st.reduce((a, x, s) => a + (TIER_OF[s] === i ? x : 0), 0)]), this.stats(this.cohort).n, ['#6a55c9', '#3d9bff', '#3dfcbf', '#ffcf5c', '#fff3d6']); });
    $('#spReplay', root).onclick = () => { this.replay(); Sound.blip(330, .5, .06, 'triangle'); };
  },
  update(dt, t) {
    this.u.uTime.value = t; this.u.uClock.value += dt;
    this.rings.forEach((r, s) => {
      r.u.uHot.value += ((r.hot ? 1 : 0) - r.u.uHot.value) * Math.min(1, dt * 6);
      r.mesh.scale.setScalar(r.anim.v); this.discs[s].scale.setScalar(r.anim.v); this.u.uR.value[s] = r.anim.v;
    });
    this.crown.material.uniforms.uOp.value = 0.6 + 0.3 * Math.sin(t * 1.7);
  },
  pick(x, y) {
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(this.discs, false)[0]; if (!hit) return false;
    this.inspectStage(hit.object.userData.stage); return true;
  },
  inspectStage(s) {
    this.rings.forEach((r, i) => r.hot = i === s);
    const rows = [0, 1, 2].map(co => { const S = this.stats(co); return [`${2024 + co} cohort`, S.at[s] / S.n, pct(S.at[s] / S.n)]; });
    const S = this.stats(this.cohort);
    showInspect(`<header><div><h2>S${s} ${esc(STAGE_LABELS[s])}</h2><div class="sub">${this.cohort < 0 ? 'All cohorts' : `${2024 + this.cohort} cohort`}, tier: ${TIER_LABELS[TIER_OF[s]]}</div></div>${closeBtn}</header>
      <dl class="facts"><dt>Reached this stage or higher</dt><dd>${fmt(S.at[s])} (${pct(S.at[s] / S.n)})</dd><dt>Stopped at this stage</dt><dd>${fmt(S.st[s])} (${pct(S.st[s] / S.n)})</dd>${s > 0 ? `<dt>Carried on from S${s - 1}</dt><dd>${pct(S.at[s] / S.at[s - 1])}</dd>` : ''}</dl>
      <div><div class="ctl-label">Share reaching S${s}+ by cohort</div><div class="bars">${rows.map((r, i) => `<div class="bar"><span>${r[0]}</span><b>${r[2]}</b><div class="track"><i style="width:${(r[1] * 100).toFixed(1)}%;background:${COHORT_COLORS[i]}"></i></div></div>`).join('')}</div></div>`);
  },
  onDeselect() { this.rings.forEach(r => r.hot = false); },
  exit() { this.onDeselect(); },
};
