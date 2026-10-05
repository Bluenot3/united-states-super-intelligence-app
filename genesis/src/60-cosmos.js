// Chapter 5 — App Cosmos: 17 app categories orbit a star made of every shipped app.
const Cosmos = {
  id: 'cosmos', name: 'App cosmos', root: 58.3, title: 'What the pioneers built.',
  sky: { a: '#2a0f5a', b: '#083a5c', amt: 1 }, bloom: { strength: 1.0, radius: 0.7, threshold: 0.14 },
  controls: { min: 3, max: 55, maxPolar: Math.PI * 0.62, rotateSpeed: 0.2 },
  hint: 'Drag to orbit, tap a planet to fly to it',
  follow: -1,
  build() {
    const scene = this.scene = new THREE.Scene();
    this.u = { uTime: { value: 0 } };
    // Star
    const star = new THREE.Mesh(new THREE.SphereGeometry(1.15, 96, 64), new THREE.ShaderMaterial({
      uniforms: this.u,
      vertexShader: `varying vec3 vN,vP,vV; void main(){ vN=normalize(normalMatrix*normal); vP=position; vec4 mv=modelViewMatrix*vec4(position,1.); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform float uTime; varying vec3 vN,vP,vV; ${GLSL_NOISE}
        void main(){ float n=fbm3(vP*2.2+vec3(0.,uTime*.15,0.)); float m=fbm3(vP*6.+vec3(uTime*.3)); float gran=.5+.5*n; float spots=smoothstep(.35,.6,m);
          float limb=pow(max(dot(vN,vV),0.),.45);
          vec3 c=mix(vec3(1.,.42,.12),vec3(1.,.86,.55),gran)*(1.2+spots*.8); c=mix(c,vec3(1.,.97,.9),pow(gran,4.)); c*=limb*1.6;
          gl_FragColor=vec4(c,1.); }`,
    }));
    scene.add(star);
    this.corona = glowSprite('#ffb066', 7.5, 2.6, 0.85); scene.add(this.corona);
    const halo = glowSprite('#7a5cff', 22, 2.2, 0.28); scene.add(halo);
    // Planets
    const maxN = Math.max(...A.apps.map(a => a.n));
    this.planets = [];
    const pv = `varying vec3 vN,vP,vW,vV; void main(){ vN=normalize(mat3(modelMatrix)*normal); vP=position; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vV=normalize(cameraPosition-w.xyz); gl_Position=projectionMatrix*viewMatrix*w; }`;
    A.appOrder.forEach((ai, rank) => {
      const app = A.apps[ai], r = 0.15 + 0.52 * Math.sqrt(app.n / maxN), a = 2.6 + rank * 0.68;
      const hue = (rank * 0.618034 + 0.52) % 1;
      const cA = new THREE.Color().setHSL(hue, 0.75, 0.62), cB = new THREE.Color().setHSL((hue + 0.08) % 1, 0.7, 0.28);
      const u = { uTime: this.u.uTime, uA: { value: cA }, uB: { value: cB }, uSeed: { value: rank * 3.17 }, uHot: { value: 0 }, uBands: { value: 4 + (rank % 5) * 2 } };
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 40), new THREE.ShaderMaterial({
        uniforms: u, vertexShader: pv,
        fragmentShader: `uniform float uTime,uSeed,uHot,uBands; uniform vec3 uA,uB; varying vec3 vN,vP,vW,vV; ${GLSL_NOISE}
          void main(){ vec3 p=normalize(vP); float warp=fbm3(p*2.5+uSeed)*1.3; float lat=p.y*uBands+warp;
            float bands=.5+.5*sin(lat*3.1416); float storms=smoothstep(.55,.8,fbm3(p*5.+uSeed+vec3(uTime*.05,0.,0.)));
            vec3 alb=mix(uB,uA,bands); alb=mix(alb,vec3(1.,.95,.9),storms*.35);
            vec3 L=normalize(-vW); float d=max(dot(vN,L),0.); float term=smoothstep(-.1,.35,dot(vN,L));
            float fr=pow(1.-max(dot(vN,vV),0.),3.);
            vec3 c=alb*(.05+d*1.15)+uA*fr*(.6+term)+uA*uHot*.4;
            gl_FragColor=vec4(c,1.); }`,
      }));
      const atm = new THREE.Mesh(new THREE.SphereGeometry(r * 1.22, 48, 32), new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide, uniforms: u, vertexShader: pv,
        fragmentShader: `uniform vec3 uA; uniform float uHot; varying vec3 vN,vP,vW,vV; void main(){ float f=pow(1.-abs(dot(vN,vV)),2.2); float lit=.35+.65*max(dot(vN,normalize(-vW)),0.); float a=f*lit*(1.+uHot*1.5); gl_FragColor=vec4(uA*a*1.4,a); }`,
      }));
      // Audience ring: one grain per 1,000 summed 30-day users
      const grains = Math.max(8, Math.round(app.users / 1000)), gp = new Float32Array(grains * 3);
      for (let k = 0; k < grains; k++) { const th = hash(k + rank * 999, 61) * Math.PI * 2, rr = r * (1.55 + hash(k + rank * 999, 62) * 0.8); gp.set([Math.cos(th) * rr, (hash(k + rank * 999, 63) - .5) * r * .06, Math.sin(th) * rr], k * 3); }
      const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(gp, 3));
      const ring = new THREE.Points(gg, new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uA: u.uA, uPx: { value: 1 }, uHot: u.uHot },
        vertexShader: `uniform float uPx; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; gl_PointSize=clamp(14./-mv.z,1.,3.5)*uPx; }`,
        fragmentShader: `uniform vec3 uA; uniform float uHot; void main(){ vec2 q=gl_PointCoord*2.-1.; float a=exp(-dot(q,q)*3.)*(.75+uHot*.5); gl_FragColor=vec4(mix(uA,vec3(1.),.4)*a,a); }`,
      }));
      ring.rotation.x = 0.35 + hash(rank, 64) * 0.5; ring.rotation.z = (hash(rank, 65) - .5) * 0.6;
      const pivot = new THREE.Group(); const body = new THREE.Group(); body.add(mesh, atm, ring); pivot.add(body);
      pivot.rotation.x = (hash(rank, 66) - .5) * 0.22; pivot.rotation.z = (hash(rank, 67) - .5) * 0.22;
      scene.add(pivot);
      const orbit = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 160 }, (_, k) => new THREE.Vector3(Math.cos(k / 160 * Math.PI * 2) * a, 0, Math.sin(k / 160 * Math.PI * 2) * a))),
        new THREE.LineBasicMaterial({ color: cA, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false }));
      pivot.add(orbit);
      mesh.userData.rank = rank;
      this.planets.push({ ai, app, rank, r, a, u, mesh, body, pivot, ring, orbit, phase: hash(rank, 68) * Math.PI * 2, speed: 0.9 / Math.pow(a, 1.5), color: '#' + cA.getHexString() });
    });
    // Asteroid dust between orbits (atmosphere only)
    const B = 1800, bp = new Float32Array(B * 3);
    for (let i = 0; i < B; i++) { const th = hash(i, 71) * Math.PI * 2, rr = 2.0 + hash(i, 72) * 12.5; bp.set([Math.cos(th) * rr, gauss(i, 73) * 0.12, Math.sin(th) * rr], i * 3); }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(bp, 3));
    this.dust = new THREE.Points(bg, new THREE.PointsMaterial({ color: '#8fa0d8', size: 0.025, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(this.dust);
  },
  planetWorld(p, out) { return p.mesh.getWorldPosition(out); },
  enter() {
    const d = fitDistance(9.6);
    fly(new THREE.Vector3(0, d * 0.42, d * 0.9), new THREE.Vector3(0, 0, 0), 2.8, new THREE.Vector3(d * 0.2, d * 0.05, d * 2), new THREE.Vector3(0, 0, 0));
    this.follow = -1;
    this.planets.forEach(p => p.ring.material.uniforms.uPx.value = renderer.getPixelRatio());
    const narrow = isNarrow();
    this.planets.forEach(p => {
      if (p.rank > (narrow ? 4 : 7)) return;
      p.label = labels.add(`<b>${esc(APP_SHORT[p.ai])}</b>${narrow ? '' : ` <small class="num">${fmt(p.app.n)}</small>`}`, v => { this.planetWorld(p, v); v.y += p.r + 0.18; }, { cls: 'tag', onTap: () => this.focusPlanet(p.rank), aria: `${APP_SHORT[p.ai]} details` });
    });
    labels.add(`<b class="num">${fmt(A.dep)}</b> <small>shipped apps</small>`, new THREE.Vector3(0, 1.6, 0), { cls: 'tag' });
  },
  update(dt, t) {
    this.u.uTime.value = t;
    this.planets.forEach(p => {
      const ang = p.phase + t * p.speed * 0.35;
      p.body.position.set(Math.cos(ang) * p.a, 0, Math.sin(ang) * p.a);
      p.mesh.rotation.y = t * 0.25; p.ring.rotation.y = t * 0.12;
      p.u.uHot.value += ((p.rank === this.follow ? 1 : 0) - p.u.uHot.value) * Math.min(1, dt * 5);
      p.orbit.material.opacity = p.rank === this.follow ? 0.45 : 0.1;
    });
    this.dust.rotation.y = t * 0.01;
    if (this.follow >= 0 && !flight.active) {
      const p = this.planets[this.follow], w = this.planetWorld(p, new THREE.Vector3());
      const delta = w.clone().sub(controls.target); controls.target.add(delta); camera.position.add(delta);
    }
  },
  focusPlanet(rank) {
    const p = this.planets[rank]; this.follow = rank;
    const w = this.planetWorld(p, new THREE.Vector3()), dist = Math.max(1.6, p.r * 7.5);
    const dir = camera.position.clone().sub(w).normalize();
    fly(w.clone().add(dir.multiplyScalar(dist)).add(new THREE.Vector3(0, dist * 0.25, 0)), w, 1.6);
    controls.autoRotate = false;
    const a = p.app, hosts = D.meta.dict.hosting.map((h, i) => [h, a.hosts[i]]), tracks = D.meta.dict.track.map((tn, i) => [tn, a.tracks[i]]);
    showInspect(`<header><div><h2>${esc(D.meta.dict.app[p.ai])}</h2><div class="sub">Rank ${rank + 1} of 17 by apps shipped</div></div>${closeBtn}</header>
      <dl class="facts"><dt>Apps shipped</dt><dd>${fmt(a.n)} (${pct(a.n / A.dep)})</dd><dt>Summed 30-day users</dt><dd>${fmt(a.users)}</dd><dt>Users per app, mean</dt><dd>${fmt(a.users / a.n)}</dd><dt>Live at 90 days</dt><dd>${pct(a.live90 / a.n)}</dd><dt>Mean uptime</dt><dd>${fx(a.uptime / a.n, 2)}%</dd><dt>Reached capstone</dt><dd>${pct(a.stages[7] / a.n)}</dd></dl>
      <div><div class="ctl-label">Hosting</div>${barRows(hosts, a.n, HOST_COLORS)}</div>
      <div><div class="ctl-label">Build track</div>${barRows(tracks, a.n, TRACK_COLORS)}</div>
      <p class="note">The ring around the planet has one grain per 1,000 summed 30-day users.</p>`);
  },
  onDeselect() {
    if (this.follow < 0) return; this.follow = -1;
    const d = fitDistance(9.6);
    fly(new THREE.Vector3(camera.position.x, 0, camera.position.z).normalize().multiplyScalar(d * 0.9).add(new THREE.Vector3(0, d * 0.42, 0)), new THREE.Vector3(0, 0, 0), 1.8);
    controls.autoRotate = !reduceMotion;
  },
  exit() { this.follow = -1; },
  panel() {
    const hosts = D.meta.dict.hosting.map((h, i) => [h, A.hosts[i]]);
    return `<p class="lede more">Every learner who reached a live deploy shipped one app. Each planet is an app category, sized by how many were shipped, ordered outward from most to least common. The ring of grains around each planet is its summed 30-day audience.</p>
      <div class="kpis">${kpi(fmt(A.dep), 'Apps shipped', 'One per S2+ learner')}${kpi(fmt(A.users), 'Summed 30-day users', 'Not deduplicated across apps')}${kpi(pct(A.live90 / A.dep), 'Still live at 90 days', `${fmt(A.live90)} apps`)}${kpi(pct(A.hosts[0] / A.dep), 'Hosted on ZEN Arsenal', 'Managed hosting')}</div>
      <div class="controls"><div class="ctl-label">Fly to a category</div><select id="coPick" style="height:40px;border-radius:12px;background:rgba(255,255,255,.04);color:var(--star);border:1px solid var(--hair);padding:0 12px;font:inherit;font-size:14px;max-width:100%"><option value="">Choose an app category</option>${this.planets.map(p => `<option value="${p.rank}">${p.rank + 1}. ${esc(D.meta.dict.app[p.ai])}</option>`).join('')}</select></div>
      <div class="more"><div class="ctl-label">Where the apps are hosted</div>${barRows(hosts, A.dep, HOST_COLORS)}<p class="note" style="margin-top:10px">Audience totals add up each app's users, so one person using two apps counts twice.</p></div>`;
  },
  bind(root) { $('#coPick', root).onchange = e => { if (e.target.value !== '') this.focusPlanet(+e.target.value); }; },
  pick(x, y) {
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), camera);
    // generous tap target: nearest planet whose screen distance is within its radius + 22px
    let best = -1, bd = Infinity; const v = new THREE.Vector3(), e = new THREE.Vector3();
    this.planets.forEach(p => {
      this.planetWorld(p, v); const dist = v.distanceTo(camera.position); e.copy(v).project(camera); if (e.z > 1) return;
      const sx = (e.x * .5 + .5) * innerWidth, sy = (-e.y * .5 + .5) * innerHeight;
      const rpx = p.r / (dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) * innerHeight / 2;
      const d = Math.hypot(sx - x, sy - y) - rpx; if (d < (coarse ? 26 : 16) && d < bd) { bd = d; best = p.rank; }
    });
    if (best < 0) return false; this.focusPlanet(best); return true;
  },
};
