export type FieldLayout = 'chronology' | 'cohorts' | 'ladder' | 'learning';
export type FieldRecord = { index: number; year: number; stage: number; day: number; date: number; pre: number; post: number };
export type FieldCamera = { yaw: number; pitch: number; zoom: number };
type XYZ = { x: number; y: number; z: number };
export const FIELD_COLORS = ['#efc27a', '#6ae0d1', '#b6a2ff'];
const RGB = [[.94, .72, .38], [.32, .86, .78], [.66, .54, 1]];
const random = (index: number, seed: number) => { let v = (index + seed) >>> 0; v = Math.imul(v ^ (v >>> 16), 0x7feb352d); v = Math.imul(v ^ (v >>> 15), 0x846ca68b); return ((v ^ (v >>> 16)) >>> 0) / 4294967295; };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const defaultCamera = (scene: FieldLayout): FieldCamera => scene === 'cohorts' ? { yaw: -.3, pitch: .62, zoom: 1 } : scene === 'ladder' ? { yaw: -.4, pitch: .16, zoom: 1.05 } : { yaw: -.18, pitch: .12, zoom: 1 };

/** World coordinates are data encodings; camera projection never changes their values. */
export function fieldPosition(record: FieldRecord, scene: FieldLayout): XYZ {
  const r1 = random(record.index, 11), r2 = random(record.index, 73), year = record.year - 2024;
  if (scene === 'chronology') return { x: -1.7 + (record.date - Date.UTC(2024, 8, 9)) / (Date.UTC(2026, 10, 10) - Date.UTC(2024, 8, 9)) * 3.4, y: -1 + (record.stage + .08 + r2 * .72) / 8 * 2, z: (year - 1) * .65 };
  if (scene === 'learning') return { x: -1.5 + record.pre / 100 * 3, y: -1.2 + record.post / 100 * 2.4, z: (year - 1) * .7 };
  if (scene === 'cohorts') {
    const radius = .64 + year * .49 + (r2 - .5) * .11, angle = (record.day + r1) / 63 * Math.PI * 2 - Math.PI / 2;
    return { x: Math.cos(angle) * radius, y: (record.stage - 3.5) * .035, z: Math.sin(angle) * radius };
  }
  const angle = record.stage * .82 + record.pre / 100 * 1.5, radius = .75 + year * .19 + (r1 - .5) * .08;
  return { x: Math.cos(angle) * radius, y: -1.2 + record.stage / 7 * 2.4 + (r2 - .5) * .06, z: Math.sin(angle) * radius };
}

export function projectField(point: XYZ, camera: FieldCamera, width: number, height: number) {
  const x = Math.cos(camera.yaw) * point.x + Math.sin(camera.yaw) * point.z;
  const z = -Math.sin(camera.yaw) * point.x + Math.cos(camera.yaw) * point.z;
  const y = Math.cos(camera.pitch) * point.y - Math.sin(camera.pitch) * z;
  const depth = Math.sin(camera.pitch) * point.y + Math.cos(camera.pitch) * z;
  const perspective = 4.5 / (4.5 + depth), scale = Math.min(width * .24, height * .28) * camera.zoom;
  return { x: width / 2 + x * scale * perspective, y: height * .49 - y * scale * perspective, depth, perspective };
}

const VERTEX = `
precision mediump float;
attribute vec3 aFrom; attribute vec3 aTo; attribute vec3 aColor; attribute float aDelay;
uniform float uProgress; uniform vec3 uCamera; uniform vec2 uScale; uniform float uDpr; uniform float uHalo;
varying vec3 vColor; varying float vAlpha;
void main(){
 float p=clamp((uProgress-aDelay)/(1.0-aDelay),0.0,1.0); p=1.0-pow(1.0-p,3.0);
 vec3 pos=mix(aFrom,aTo,p); float cy=cos(uCamera.x),sy=sin(uCamera.x),cp=cos(uCamera.y),sp=sin(uCamera.y);
 float x=cy*pos.x+sy*pos.z;float z=-sy*pos.x+cy*pos.z;float y=cp*pos.y-sp*z;float depth=sp*pos.y+cp*z;
 float perspective=4.5/(4.5+depth);gl_Position=vec4(x*perspective*uScale.x,y*perspective*uScale.y+0.02,0.0,1.0);
 gl_PointSize=(uHalo>0.5?7.5:2.0)*uDpr*perspective;
 vColor=aColor;vAlpha=(uHalo>0.5?0.065:0.68)*clamp(perspective,0.65,1.4);
}`;
const FRAGMENT = `precision mediump float;varying vec3 vColor;varying float vAlpha;uniform float uHalo;
void main(){vec2 uv=gl_PointCoord*2.0-1.0;float r=dot(uv,uv);if(r>1.0)discard;
float fall=uHalo>0.5?exp(-r*5.0)*(1.0-r):(1.0-smoothstep(0.1,1.0,r));
gl_FragColor=vec4(vColor*vAlpha*fall,vAlpha*fall);}`;

export class StudentFieldRenderer {
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private buffer: WebGLBuffer | null = null;
  private ctx: CanvasRenderingContext2D | null;
  private records: FieldRecord[] = [];
  private from: XYZ[] = [];
  private to: XYZ[] = [];
  private positions = new Map<number, XYZ>();
  private frame = 0;
  private started = 0;
  private progress = 1;
  private width = 900;
  private height = 580;
  private dpr = 1;
  private visible = true;
  private quiet = false;
  private rotating = false;
  private inspect: number | null = null;
  private scene: FieldLayout = 'chronology';
  private camera: FieldCamera = defaultCamera('chronology');
  private last = 0;
  private frameCount = 0;
  private disposed = false;
  private lost = (event: Event) => { event.preventDefault(); this.gl = null; this.program = null; this.buffer = null; this.canvas.dataset.renderer = 'canvas2d'; this.request(); };
  private restored = () => { this.initGPU(); this.upload(); this.request(); };

  constructor(private canvas: HTMLCanvasElement, private overlay: HTMLCanvasElement) {
    this.ctx = overlay.getContext('2d');
    this.initGPU();
    canvas.addEventListener('webglcontextlost', this.lost);
    canvas.addEventListener('webglcontextrestored', this.restored);
  }
  private initGPU() {
    try {
      const gl = this.canvas.getContext('webgl', { alpha: true, antialias: false, powerPreference: 'low-power', preserveDrawingBuffer: true });
      if (!gl) return;
      const compile = (source: string, type: number) => { const shader = gl.createShader(type)!; gl.shaderSource(shader, source); gl.compileShader(shader); if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { this.canvas.dataset.fallbackReason = gl.getShaderInfoLog(shader) || 'Shader unavailable'; gl.deleteShader(shader); return null; } return shader; };
      const vertex = compile(VERTEX, gl.VERTEX_SHADER), fragment = compile(FRAGMENT, gl.FRAGMENT_SHADER);
      if (!vertex || !fragment) { if (vertex) gl.deleteShader(vertex); if (fragment) gl.deleteShader(fragment); return; }
      const program = gl.createProgram()!; gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program); gl.deleteShader(vertex); gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { this.canvas.dataset.fallbackReason = gl.getProgramInfoLog(program) || 'Shader link unavailable'; gl.deleteProgram(program); return; }
      this.gl = gl; this.program = program; this.buffer = gl.createBuffer();
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.disable(gl.DEPTH_TEST);
    } catch { this.gl = null; }
    this.canvas.dataset.renderer = this.gl ? 'webgl' : 'canvas2d';
  }
  setData(records: FieldRecord[], scene: FieldLayout) {
    this.capturePositions();
    this.records = records; this.scene = scene;
    this.to = records.map(record => fieldPosition(record, scene));
    this.from = records.map((record, index) => this.positions.get(record.index) ?? { ...this.to[index], y: this.to[index].y - .12 });
    this.started = 0; this.progress = this.quiet ? 1 : 0; this.upload(); this.request();
  }
  private upload() {
    if (!this.gl || !this.program || !this.buffer) return;
    const values = new Float32Array(this.records.length * 10);
    this.records.forEach((record, index) => { const a = this.from[index], b = this.to[index]; values.set([a.x, a.y, a.z, b.x, b.y, b.z, ...RGB[record.year - 2024], random(record.index, 101) * .16], index * 10); });
    const gl = this.gl; gl.useProgram(this.program); gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer); gl.bufferData(gl.ARRAY_BUFFER, values, gl.STATIC_DRAW);
    for (const [name, length, offset] of [['aFrom', 3, 0], ['aTo', 3, 12], ['aColor', 3, 24], ['aDelay', 1, 36]] as const) { const location = gl.getAttribLocation(this.program, name); gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, length, gl.FLOAT, false, 40, offset); }
  }
  resize(width: number, height: number) {
    this.width = width; this.height = height; this.dpr = Math.min(devicePixelRatio || 1, width < 600 ? 1.25 : 1.5);
    for (const canvas of [this.canvas, this.overlay]) { canvas.width = Math.round(width * this.dpr); canvas.height = Math.round(height * this.dpr); }
    this.request();
  }
  setCamera(camera: FieldCamera) { this.camera = { yaw: camera.yaw, pitch: clamp(camera.pitch, -.1, 1.4), zoom: clamp(camera.zoom, .65, 1.5) }; this.request(); }
  getCamera() { return { ...this.camera }; }
  setMotion(quiet: boolean, rotating: boolean) { if (this.quiet && !quiet && this.progress === 1) this.started = performance.now() - 1200; this.quiet = quiet; this.rotating = rotating && !quiet; if (quiet) this.progress = 1; this.request(); }
  setVisible(visible: boolean) { this.visible = visible; this.canvas.dataset.visible = String(visible); if (visible) { this.last = 0; this.request(); } else { cancelAnimationFrame(this.frame); this.frame = 0; } }
  setInspection(index: number | null) { this.inspect = index; this.request(); }
  pick(x: number, y: number) {
    let nearest: number | null = null, distance = 18 * 18;
    this.records.forEach((record, index) => { const point = projectField(this.current(index), this.camera, this.width, this.height), d = (point.x - x) ** 2 + (point.y - y) ** 2; if (d < distance) { distance = d; nearest = index; } });
    return nearest;
  }
  private current(index: number): XYZ {
    const a = this.from[index], b = this.to[index], delay = random(this.records[index].index, 101) * .16;
    const progress = clamp((this.progress - delay) / (1 - delay), 0, 1), p = 1 - (1 - progress) ** 3;
    return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, z: a.z + (b.z - a.z) * p };
  }
  private capturePositions() { this.positions = new Map(this.records.map((record, index) => [record.index, this.current(index)])); }
  private request() { if (!this.frame && !this.disposed && this.visible) this.frame = requestAnimationFrame(this.draw); }
  private draw = (time: number) => {
    this.frame = 0; if (this.disposed || !this.visible) return;
    if (!this.started) this.started = time;
    this.progress = this.quiet ? 1 : Math.min(1, (time - this.started) / 1200);
    if (this.rotating && this.last) this.camera.yaw += Math.min(time - this.last, 40) * .00008;
    this.last = time;
    const gl = this.gl, program = this.program;
    if (gl && program) {
      gl.viewport(0, 0, this.canvas.width, this.canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.useProgram(program);
      const uniform = (name: string) => gl.getUniformLocation(program, name);
      const scale = Math.min(this.width * .24, this.height * .28) * this.camera.zoom;
      gl.uniform1f(uniform('uProgress'), this.progress); gl.uniform3f(uniform('uCamera'), this.camera.yaw, this.camera.pitch, this.camera.zoom); gl.uniform2f(uniform('uScale'), scale * 2 / this.width, scale * 2 / this.height); gl.uniform1f(uniform('uDpr'), this.dpr * (this.width < 600 ? .75 : 1));
      gl.uniform1f(uniform('uHalo'), 1); gl.drawArrays(gl.POINTS, 0, this.records.length); gl.uniform1f(uniform('uHalo'), 0); gl.drawArrays(gl.POINTS, 0, this.records.length);
    }
    this.drawOverlay();
    Object.assign(this.canvas.dataset, { ready: 'true', marks: String(this.records.length), scene: this.scene, settled: String(this.progress === 1), renderer: this.gl ? 'webgl' : 'canvas2d', rotating: String(this.rotating), frame: String(++this.frameCount), camera: `${this.camera.yaw.toFixed(3)},${this.camera.pitch.toFixed(3)},${this.camera.zoom.toFixed(3)}` });
    if (this.progress < 1 || this.rotating) this.request();
  };
  private drawOverlay() {
    const ctx = this.ctx; if (!ctx) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); ctx.clearRect(0, 0, this.width, this.height);
    const project = (point: XYZ) => projectField(point, this.camera, this.width, this.height);
    const line = (points: XYZ[], color = '#708baa', alpha = .14, thickness = 1) => {
      ctx.beginPath(); points.forEach((point, i) => { const p = project(point); if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }); ctx.strokeStyle = color; ctx.globalAlpha = alpha; ctx.lineWidth = thickness; ctx.stroke(); ctx.globalAlpha = 1;
    };
    const label = (point: XYZ, text: string, color = '#879db6', offsetY = 0) => { const p = project(point); p.y += offsetY; if (p.x < 10 || p.x > this.width - 10 || p.y < 30 || p.y > this.height - 24) return; ctx.font = '11px "Instrument Sans",sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#07111d'; ctx.globalAlpha = .9; ctx.fillRect(p.x - ctx.measureText(text).width / 2 - 5, p.y - 10, ctx.measureText(text).width + 10, 16); ctx.globalAlpha = 1; ctx.fillStyle = color; ctx.fillText(text, p.x, p.y + 2); };
    if (this.scene === 'cohorts') {
      [2024, 2025, 2026].forEach((year, index) => {
        const radius = .64 + index * .49;
        line(Array.from({ length: 97 }, (_, i) => ({ x: Math.cos(i / 96 * Math.PI * 2) * radius, y: -.18, z: Math.sin(i / 96 * Math.PI * 2) * radius })), FIELD_COLORS[index], .35);
        label({ x: radius + .12, y: .13, z: 0 }, String(year), FIELD_COLORS[index], this.width < 600 ? -index * 19 : 0);
      });
      line([{ x: 0, y: -.4, z: 0 }, { x: 0, y: .4, z: 0 }], '#c0d4ef', .3);
    } else if (this.scene === 'ladder') {
      for (let stage = 0; stage <= 7; stage++) { const y = -1.2 + stage / 7 * 2.4; line(Array.from({ length: 65 }, (_, i) => ({ x: Math.cos(i / 64 * Math.PI * 2) * 1.24, y, z: Math.sin(i / 64 * Math.PI * 2) * 1.24 })), '#7687ad', .14); label({ x: -1.4, y, z: 0 }, `S${stage}`); }
      line(Array.from({ length: 121 }, (_, i) => { const stage = i / 120 * 7, angle = stage * .82 + .75; return { x: Math.cos(angle) * .96, y: -1.2 + stage / 7 * 2.4, z: Math.sin(angle) * .96 }; }), '#9cc6da', .24, 1.5);
    } else {
      const learning = this.scene === 'learning', xMin = learning ? -1.5 : -1.7, xMax = -xMin, yMin = learning ? -1.2 : -1, yMax = -yMin;
      for (let year = 0; year < 3; year++) {
        const z = (year - 1) * (learning ? .7 : .65);
        line([{ x: xMin, y: yMin, z }, { x: xMax, y: yMin, z }, { x: xMax, y: yMax, z }, { x: xMin, y: yMax, z }, { x: xMin, y: yMin, z }], FIELD_COLORS[year], .20);
        const ticks = learning ? 4 : 8;
        for (let tick = 1; tick < ticks; tick++) line([{ x: xMin, y: yMin + tick / ticks * (yMax - yMin), z }, { x: xMax, y: yMin + tick / ticks * (yMax - yMin), z }], FIELD_COLORS[year], .065);
      }
      if (learning) {
        [0, 25, 50, 75, 100].forEach(value => { label({ x: xMin + value / 100 * 3, y: yMin - .13, z: 0 }, String(value)); label({ x: xMin - .15, y: yMin + value / 100 * 2.4, z: 0 }, String(value)); });
        line([{ x: -1.5, y: -1.2, z: 0 }, { x: 1.5, y: 1.2, z: 0 }], '#d4e4f6', .25);
      } else {
        [2024, 2025, 2026].forEach(year => label({ x: -1.7 + (Date.UTC(year, 8, 9) - Date.UTC(2024, 8, 9)) / (Date.UTC(2026, 10, 10) - Date.UTC(2024, 8, 9)) * 3.4, y: -1.15, z: (year - 2025) * .65 }, String(year), FIELD_COLORS[year - 2024]));
        [0, 2, 4, 6, 7].forEach(stage => label({ x: -1.86, y: -1 + (stage + .5) / 8 * 2, z: 0 }, `S${stage}`));
      }
    }
    if (!this.gl) {
      this.records.forEach((record, index) => { const p = project(this.current(index)); ctx.fillStyle = FIELD_COLORS[record.year - 2024]; ctx.globalAlpha = .6; ctx.fillRect(p.x, p.y, 1.7, 1.7); }); ctx.globalAlpha = 1;
    }
    if (this.inspect !== null && this.records[this.inspect]) {
      const p = project(this.current(this.inspect)); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.moveTo(p.x - 16, p.y); ctx.lineTo(p.x + 16, p.y); ctx.moveTo(p.x, p.y - 16); ctx.lineTo(p.x, p.y + 16); ctx.stroke();
      ctx.setLineDash([3, 5]); ctx.strokeStyle = '#b3cbed'; ctx.beginPath(); ctx.moveTo(p.x, p.y + 18); ctx.lineTo(p.x, this.height - 25); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  dispose() { this.disposed = true; cancelAnimationFrame(this.frame); this.canvas.removeEventListener('webglcontextlost', this.lost); this.canvas.removeEventListener('webglcontextrestored', this.restored); if (this.gl) { if (this.buffer) this.gl.deleteBuffer(this.buffer); if (this.program) this.gl.deleteProgram(this.program); const context = this.gl; queueMicrotask(() => { if (!this.canvas.isConnected) context.getExtension('WEBGL_lose_context')?.loseContext(); }); } }
}
