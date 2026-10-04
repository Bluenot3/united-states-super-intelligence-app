import { selectOutcomeRecords } from './impact-exploration';
import type { OutcomeFilters, OutcomesDataset } from './outcomes';

export type TerrainPair = 'prepost' | 'attendance-gain' | 'attendance-days';
export interface TerrainAxis { label: string; unit: string; min: number; max: number; ticks: number[] }
export interface TerrainBin { index: number; x: number; y: number; xFrom: number; xTo: number; yFrom: number; yTo: number; count: number; upperXInclusive: boolean; upperYInclusive: boolean }
export interface TerrainProbe extends TerrainBin { density: number; peakPercent: number; neighborhoodCount: number; neighborhoodX: [number, number]; neighborhoodY: [number, number] }
export interface TerrainData {
  pair: TerrainPair; title: string; xAxis: TerrainAxis; yAxis: TerrainAxis; gridSize: number;
  sourceCount: number; totalSelected: number; eligibleCount: number; excludedCount: number;
  raw: Uint32Array; smoothed: Float32Array; heights: Float32Array; peakDensity: number;
  sigma: number; bins: TerrainBin[]; peaks: TerrainProbe[]; correlation: number | null;
}
export const TERRAIN_PAIRS: { id: TerrainPair; label: string }[] = [
  { id: 'prepost', label: 'Before / after' }, { id: 'attendance-gain', label: 'Attendance / gain' }, { id: 'attendance-days', label: 'Attendance / deployment' },
];
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Separable Gaussian, renormalized at each source cell's boundary to conserve total mass. */
function gaussian(raw: Uint32Array, size: number, sigma: number): Float32Array {
  const radius = Math.ceil(3 * sigma), kernel = Float64Array.from({ length: radius * 2 + 1 }, (_, i) => Math.exp(-((i - radius) ** 2) / (2 * sigma ** 2)));
  const first = new Float64Array(raw.length), second = new Float64Array(raw.length);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const value = raw[y * size + x]; if (!value) continue;
    const lo = Math.max(-radius, -x), hi = Math.min(radius, size - 1 - x);
    let weight = 0; for (let k = lo; k <= hi; k++) weight += kernel[k + radius];
    for (let k = lo; k <= hi; k++) first[y * size + x + k] += value * kernel[k + radius] / weight;
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const value = first[y * size + x]; if (!value) continue;
    const lo = Math.max(-radius, -y), hi = Math.min(radius, size - 1 - y);
    let weight = 0; for (let k = lo; k <= hi; k++) weight += kernel[k + radius];
    for (let k = lo; k <= hi; k++) second[(y + k) * size + x] += value * kernel[k + radius] / weight;
  }
  return Float32Array.from(second);
}

export function terrainBin(data: TerrainData, index: number): TerrainBin {
  const size = data.gridSize, x = index % size, y = Math.floor(index / size);
  return { index, x, y, xFrom: data.xAxis.min + x / size * (data.xAxis.max - data.xAxis.min), xTo: data.xAxis.min + (x + 1) / size * (data.xAxis.max - data.xAxis.min), yFrom: data.yAxis.min + y / size * (data.yAxis.max - data.yAxis.min), yTo: data.yAxis.min + (y + 1) / size * (data.yAxis.max - data.yAxis.min), count: data.raw[index], upperXInclusive: x === size - 1, upperYInclusive: y === size - 1 };
}
export function terrainProbe(data: TerrainData, index: number): TerrainProbe {
  const bin = terrainBin(data, clamp(Math.trunc(index), 0, data.raw.length - 1)), size = data.gridSize;
  const x0 = Math.max(0, bin.x - 2), x1 = Math.min(size - 1, bin.x + 2), y0 = Math.max(0, bin.y - 2), y1 = Math.min(size - 1, bin.y + 2);
  let count = 0; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) count += data.raw[y * size + x];
  return { ...bin, density: data.smoothed[bin.index], peakPercent: data.heights[bin.index] * 100, neighborhoodCount: count,
    neighborhoodX: [data.xAxis.min + x0 / size * (data.xAxis.max - data.xAxis.min), data.xAxis.min + (x1 + 1) / size * (data.xAxis.max - data.xAxis.min)],
    neighborhoodY: [data.yAxis.min + y0 / size * (data.yAxis.max - data.yAxis.min), data.yAxis.min + (y1 + 1) / size * (data.yAxis.max - data.yAxis.min)] };
}

/** Full selected population. Exact count bins precede all smoothing; no dates or sampled points. */
export function buildOutcomeTerrain(dataset: OutcomesDataset, filters: OutcomeFilters, pair: TerrainPair = 'prepost', requestedSize = 50): TerrainData {
  const size = clamp(Math.round(requestedSize), 40, 64), selected = selectOutcomeRecords(dataset, filters), c = dataset.columns;
  let gainMin = -30, gainMax = 70, daysMax = 80;
  // Domains remain identical between filters and include every published source value.
  const published = new Set(dataset.source.cohorts);
  for (let i = 0; i < dataset.meta.n; i++) if (published.has(Number(dataset.meta.dict.cohort[c.cohort[i]]))) {
    const gain = (c.post_total[i] - c.pre_total[i]) / 10;
    gainMin = Math.min(gainMin, Math.floor(gain / 10) * 10); gainMax = Math.max(gainMax, Math.ceil(gain / 10) * 10);
    if (c.stage[i] >= 2) daysMax = Math.max(daysMax, Math.ceil(c.days[i] / 10) * 10);
  }
  const attendance: TerrainAxis = { label: 'Sessions attended', unit: 'sessions', min: 0, max: 24, ticks: [0, 6, 12, 18, 24] };
  const xAxis: TerrainAxis = pair === 'prepost' ? { label: 'Before score', unit: 'points', min: 0, max: 100, ticks: [0, 25, 50, 75, 100] } : attendance;
  const yAxis: TerrainAxis = pair === 'prepost' ? { label: 'After score', unit: 'points', min: 0, max: 100, ticks: [0, 25, 50, 75, 100] } : pair === 'attendance-gain' ? { label: 'Score gain', unit: 'points', min: gainMin, max: gainMax, ticks: [gainMin, 0, 20, 40, gainMax] } : { label: 'Days to first deploy', unit: 'days', min: 0, max: daysMax, ticks: [0, daysMax / 4, daysMax / 2, daysMax * .75, daysMax] };
  const raw = new Uint32Array(size * size); let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (const index of selected) {
    if (pair === 'attendance-days' && c.stage[index] < 2) continue;
    const x = pair === 'prepost' ? c.pre_total[index] / 10 : c.att[index];
    const y = pair === 'prepost' ? c.post_total[index] / 10 : pair === 'attendance-gain' ? (c.post_total[index] - c.pre_total[index]) / 10 : c.days[index];
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < xAxis.min || x > xAxis.max || y < yAxis.min || y > yAxis.max) throw new RangeError('A modeled outcome falls outside the terrain axes.');
    const ix = Math.min(size - 1, Math.floor((x - xAxis.min) / (xAxis.max - xAxis.min) * size)), iy = Math.min(size - 1, Math.floor((y - yAxis.min) / (yAxis.max - yAxis.min) * size));
    raw[iy * size + ix]++; n++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
  }
  const sigma = 1.35, smoothed = gaussian(raw, size, sigma), peakDensity = smoothed.reduce((max, value) => Math.max(max, value), 0), heights = Float32Array.from(smoothed, value => peakDensity ? value / peakDensity : 0);
  const denominator = Math.sqrt(Math.max(0, (n * sxx - sx * sx) * (n * syy - sy * sy)));
  const data: TerrainData = { pair, title: TERRAIN_PAIRS.find(item => item.id === pair)!.label, xAxis, yAxis, gridSize: size, sourceCount: dataset.source.rows, totalSelected: selected.length, eligibleCount: n, excludedCount: selected.length - n, raw, smoothed, heights, peakDensity, sigma, bins: [], peaks: [], correlation: n > 1 && denominator > 0 ? clamp((n * sxy - sx * sy) / denominator, -1, 1) : null };
  const candidates: number[] = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const index = y * size + x, h = heights[index]; if (raw[index]) data.bins.push(terrainBin(data, index));
    if (h < .08) continue;
    let peak = true;
    for (let dy = -2; dy <= 2 && peak; dy++) for (let dx = -2; dx <= 2; dx++) if (x + dx >= 0 && x + dx < size && y + dy >= 0 && y + dy < size && heights[(y + dy) * size + x + dx] > h) { peak = false; break; }
    if (peak) candidates.push(index);
  }
  candidates.sort((a, b) => heights[b] - heights[a] || a - b);
  for (const index of candidates) if (data.peaks.length < 3 && data.peaks.every(peak => Math.hypot(peak.x - index % size, peak.y - Math.floor(index / size)) > size / 6)) data.peaks.push(terrainProbe(data, index));
  data.bins.sort((a, b) => b.count - a.count || a.index - b.index);
  return data;
}

export type TerrainCamera = { yaw: number; pitch: number; zoom: number };
export const DEFAULT_TERRAIN_CAMERA: TerrainCamera = { yaw: -.38, pitch: .5, zoom: 1 };
type Point3 = [number, number, number];
// Wider domain plane + a distant, narrow-angle camera fill the stage without changing density heights.
const WIDTH = 12, DEPTH = 6, HEIGHT = 2.8;
function multiply(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16); for (let column = 0; column < 4; column++) for (let row = 0; row < 4; row++) for (let k = 0; k < 4; k++) out[column * 4 + row] += a[k * 4 + row] * b[column * 4 + k]; return out;
}
function matrix(camera: TerrainCamera, aspect: number): { value: Float32Array; eye: Point3 } {
  const dist = 19.5 / camera.zoom * Math.max(1, 2.25 / aspect), target: Point3 = [0, .15, 0];
  const eye: Point3 = [Math.sin(camera.yaw) * Math.cos(camera.pitch) * dist, target[1] + Math.sin(camera.pitch) * dist, Math.cos(camera.yaw) * Math.cos(camera.pitch) * dist];
  const normalize = (v: Point3): Point3 => { const n = Math.hypot(...v); return v.map(value => value / n) as Point3; };
  const cross = (a: Point3, b: Point3): Point3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const z = normalize([eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]]), x = normalize(cross([0, 1, 0], z)), y = cross(z, x);
  const dot = (a: Point3, b: Point3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const view = new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
  const f = 1 / Math.tan(Math.PI / 14), near = .1, far = 100;
  const projection = new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0]);
  return { value: multiply(projection, view), eye };
}
function normals(heights: Float32Array, size: number): Float32Array {
  const out = new Float32Array(size * size * 3);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const loX = Math.max(0, x - 1), hiX = Math.min(size - 1, x + 1), loY = Math.max(0, y - 1), hiY = Math.min(size - 1, y + 1);
    const dx = (heights[y * size + hiX] - heights[y * size + loX]) * HEIGHT / ((hiX - loX) * WIDTH / size), dz = -(heights[hiY * size + x] - heights[loY * size + x]) * HEIGHT / ((hiY - loY) * DEPTH / size), length = Math.hypot(dx, 1, dz);
    out.set([-dx / length, 1 / length, -dz / length], (y * size + x) * 3);
  }
  return out;
}
const VERTEX = `attribute vec2 aXZ;attribute vec2 aHeight;attribute vec3 aNormal0;attribute vec3 aNormal1;uniform mat4 uMatrix;uniform float uMix;varying vec3 vNormal;varying vec3 vWorld;varying float vHeight;varying vec2 vUv;
void main(){vHeight=mix(aHeight.x,aHeight.y,uMix);vWorld=vec3(aXZ.x,vHeight*2.8,aXZ.y);vNormal=normalize(mix(aNormal0,aNormal1,uMix));vUv=vec2(aXZ.x/12.0+0.5,0.5-aXZ.y/6.0);gl_Position=uMatrix*vec4(vWorld,1.0);}`;
const FRAGMENT = `precision mediump float;varying vec3 vNormal;varying vec3 vWorld;varying float vHeight;varying vec2 vUv;uniform vec3 uEye;
void main(){vec3 n=normalize(vNormal);vec3 light=normalize(vec3(-0.35,0.9,0.3));float diffuse=max(0.0,dot(n,light));vec3 view=normalize(uEye-vWorld);float spec=pow(max(0.0,dot(n,normalize(light+view))),38.0);
vec3 low=vec3(0.025,0.16,0.22),mid=vec3(0.08,0.58,0.63),high=vec3(0.88,0.93,0.76);vec3 color=mix(low,mid,smoothstep(0.0,0.65,vHeight));color=mix(color,high,smoothstep(0.58,1.0,vHeight));color*=0.36+diffuse*0.72;color+=spec*vec3(0.6,0.84,0.82)*0.65;
float contour=1.0-smoothstep(0.008,0.035,abs(fract(vHeight*12.0+0.5)-0.5));float gx=abs(fract(vUv.x*10.0+0.5)-0.5),gy=abs(fract(vUv.y*10.0+0.5)-0.5);float grid=1.0-smoothstep(0.012,0.025,min(gx,gy));color+=vec3(0.37,0.8,0.78)*contour*0.3;color+=vec3(0.22,0.56,0.61)*grid*0.1;gl_FragColor=vec4(color,1.0);}`;

/** One native WebGL triangle draw; the separate overlay also supplies the projected fallback. */
export class OutcomeTerrainRenderer {
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private buffer: WebGLBuffer | null = null;
  private context: CanvasRenderingContext2D | null;
  private data: TerrainData | null = null;
  private from = new Float32Array(0);
  private progress = 1;
  private started = 0;
  private frame = 0;
  private width = 900;
  private height = 540;
  private camera = { ...DEFAULT_TERRAIN_CAMERA };
  private quiet = false;
  private orbit = false;
  private visible = true;
  private disposed = false;
  private last = 0;
  private vertices = 0;
  private probe: number | null = null;
  private lost = (event: Event) => { event.preventDefault(); this.gl = null; this.program = null; this.buffer = null; this.onMode('canvas2d'); this.request(); };
  private restored = () => { this.init(); this.upload(); this.request(); };
  constructor(private canvas: HTMLCanvasElement, private overlay: HTMLCanvasElement, private onMode: (mode: 'webgl' | 'canvas2d' | 'unavailable') => void) {
    this.context = overlay.getContext('2d'); this.init(); canvas.addEventListener('webglcontextlost', this.lost); canvas.addEventListener('webglcontextrestored', this.restored);
  }
  private init() {
    try {
      const gl = this.canvas.getContext('webgl', { alpha: true, antialias: true, powerPreference: 'low-power' });
      if (!gl) throw new Error('WebGL unavailable');
      const shader = (type: number, source: string) => { const item = gl.createShader(type); if (!item) throw new Error('Shader unavailable'); gl.shaderSource(item, source); gl.compileShader(item); if (!gl.getShaderParameter(item, gl.COMPILE_STATUS)) { gl.deleteShader(item); throw new Error('Terrain shader failed'); } return item; };
      const vertex = shader(gl.VERTEX_SHADER, VERTEX), fragment = shader(gl.FRAGMENT_SHADER, FRAGMENT), program = gl.createProgram();
      if (!program) { gl.deleteShader(vertex); gl.deleteShader(fragment); throw new Error('Program unavailable'); }
      gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program); gl.deleteShader(vertex); gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); throw new Error('Terrain link failed'); }
      this.gl = gl; this.program = program; this.buffer = gl.createBuffer(); gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); this.onMode('webgl');
    } catch { this.gl = null; this.onMode(this.context ? 'canvas2d' : 'unavailable'); }
  }
  setData(data: TerrainData) {
    const prior = this.data, nextFrom = new Float32Array(data.heights.length);
    if (prior && prior.gridSize === data.gridSize) for (let i = 0; i < nextFrom.length; i++) nextFrom[i] = this.from[i] + (prior.heights[i] - this.from[i]) * this.progress;
    this.from = nextFrom; this.data = data; this.progress = this.quiet ? 1 : 0; this.started = 0; this.probe = null; this.upload(); this.request();
  }
  private upload() {
    if (!this.data || !this.gl || !this.program || !this.buffer) return;
    const { gridSize: size, heights } = this.data, firstNormals = normals(this.from, size), finalNormals = normals(heights, size), vertices = new Float32Array((size - 1) ** 2 * 6 * 10); let cursor = 0;
    const append = (index: number) => { vertices.set([-WIDTH / 2 + (index % size + .5) / size * WIDTH, DEPTH / 2 - (Math.floor(index / size) + .5) / size * DEPTH, this.from[index], heights[index], ...firstNormals.subarray(index * 3, index * 3 + 3), ...finalNormals.subarray(index * 3, index * 3 + 3)], cursor); cursor += 10; };
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const a = y * size + x, b = a + 1, c = a + size, d = c + 1; [a, c, b, b, c, d].forEach(append); }
    const gl = this.gl; gl.useProgram(this.program); gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer); gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW); this.vertices = cursor / 10;
    for (const [name, width, offset] of [['aXZ', 2, 0], ['aHeight', 2, 8], ['aNormal0', 3, 16], ['aNormal1', 3, 28]] as const) { const location = gl.getAttribLocation(this.program, name); gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, width, gl.FLOAT, false, 40, offset); }
  }
  resize(width: number, height: number) { this.width = Math.max(1, width); this.height = Math.max(1, height); const dpr = Math.min(devicePixelRatio || 1, 1.5); for (const item of [this.canvas, this.overlay]) { item.width = Math.round(this.width * dpr); item.height = Math.round(this.height * dpr); } this.request(); }
  getCamera(): TerrainCamera { return { ...this.camera }; }
  setCamera(camera: TerrainCamera) { this.camera = { yaw: camera.yaw, pitch: clamp(camera.pitch, .22, 1.3), zoom: clamp(camera.zoom, .7, 1.4) }; this.request(); }
  setMotion(quiet: boolean, orbit: boolean) { if (this.quiet && !quiet && this.progress === 1) this.started = performance.now() - 1100; this.quiet = quiet; this.orbit = orbit && !quiet; if (quiet) this.progress = 1; this.request(); }
  setVisible(visible: boolean) { this.visible = visible; if (visible) { this.last = 0; this.request(); } else { cancelAnimationFrame(this.frame); this.frame = 0; } }
  setProbe(index: number | null) { this.probe = index; this.request(); }
  private project(point: Point3, transform: Float32Array) {
    const [x, y, z] = point, w = transform[3] * x + transform[7] * y + transform[11] * z + transform[15];
    return { x: (1 + (transform[0] * x + transform[4] * y + transform[8] * z + transform[12]) / w) * this.width / 2, y: (1 - (transform[1] * x + transform[5] * y + transform[9] * z + transform[13]) / w) * this.height / 2, depth: (transform[2] * x + transform[6] * y + transform[10] * z + transform[14]) / w, w };
  }
  private world(index: number): Point3 { const size = this.data!.gridSize; return [-WIDTH / 2 + (index % size + .5) / size * WIDTH, (this.from[index] + (this.data!.heights[index] - this.from[index]) * this.progress) * HEIGHT, DEPTH / 2 - (Math.floor(index / size) + .5) / size * DEPTH]; }
  pick(x: number, y: number): TerrainProbe | null {
    if (!this.data || !this.data.eligibleCount || this.progress < .99) return null;
    const size = this.data.gridSize, transform = matrix(this.camera, this.width / this.height).value, points = Array.from({ length: size * size }, (_, index) => this.project(this.world(index), transform)); let bestDepth = Infinity, selected = -1;
    const hit = (a: number, b: number, c: number) => {
      const p = points[a], q = points[b], r = points[c], denom = (q.y - r.y) * (p.x - r.x) + (r.x - q.x) * (p.y - r.y); if (Math.abs(denom) < 1e-8) return;
      const wa = ((q.y - r.y) * (x - r.x) + (r.x - q.x) * (y - r.y)) / denom, wb = ((r.y - p.y) * (x - r.x) + (p.x - r.x) * (y - r.y)) / denom, wc = 1 - wa - wb;
      if (wa < 0 || wb < 0 || wc < 0 || p.w <= 0 || q.w <= 0 || r.w <= 0) return;
      const depth = p.depth * wa + q.depth * wb + r.depth * wc; if (depth >= bestDepth) return;
      const norm = wa / p.w + wb / q.w + wc / r.w, weights = [wa / p.w / norm, wb / q.w / norm, wc / r.w / norm], indices = [a, b, c];
      const cellX = indices.reduce((sum, index, k) => sum + (index % size) * weights[k], 0), cellY = indices.reduce((sum, index, k) => sum + Math.floor(index / size) * weights[k], 0);
      selected = clamp(Math.round(cellY), 0, size - 1) * size + clamp(Math.round(cellX), 0, size - 1); bestDepth = depth;
    };
    for (let iy = 0; iy < size - 1; iy++) for (let ix = 0; ix < size - 1; ix++) { const a = iy * size + ix, b = a + 1, c = a + size, d = c + 1; hit(a, c, b); hit(b, c, d); }
    return selected < 0 ? null : terrainProbe(this.data, selected);
  }
  private request() { if (!this.frame && !this.disposed && this.visible) this.frame = requestAnimationFrame(this.draw); }
  private draw = (time: number) => {
    this.frame = 0; if (!this.data || !this.visible || this.disposed) return;
    if (!this.started) this.started = time; const phase = this.quiet ? 1 : Math.min(1, (time - this.started) / 1100); this.progress = 1 - (1 - phase) ** 3;
    if (this.orbit && this.last) this.camera.yaw += Math.min(40, time - this.last) * .000035; this.last = time;
    const transform = matrix(this.camera, this.width / this.height), gl = this.gl, program = this.program;
    if (gl && program) { gl.viewport(0, 0, this.canvas.width, this.canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.useProgram(program); gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uMatrix'), false, transform.value); gl.uniform1f(gl.getUniformLocation(program, 'uMix'), this.progress); gl.uniform3fv(gl.getUniformLocation(program, 'uEye'), transform.eye); gl.drawArrays(gl.TRIANGLES, 0, this.vertices); }
    this.drawOverlay(transform.value);
    Object.assign(this.canvas.dataset, { ready: 'true', settled: String(phase === 1), renderer: gl ? 'webgl' : this.context ? 'canvas2d' : 'unavailable', pair: this.data.pair, sourceCount: String(this.data.sourceCount), selectedCount: String(this.data.totalSelected), eligibleCount: String(this.data.eligibleCount), binTotal: String(this.data.raw.reduce((sum, count) => sum + count, 0)), gridSize: String(this.data.gridSize), drawCalls: gl ? '1' : '0', camera: `${this.camera.yaw.toFixed(3)},${this.camera.pitch.toFixed(3)},${this.camera.zoom.toFixed(3)}` });
    if (phase < 1 || this.orbit) this.request();
  };
  private drawOverlay(transform: Float32Array) {
    const ctx = this.context, data = this.data; if (!ctx || !data) return;
    const dpr = this.overlay.width / this.width; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, this.width, this.height);
    const project = (point: Point3) => this.project(point, transform);
    if (!this.gl) {
      const points = Array.from({ length: data.raw.length }, (_, index) => project(this.world(index))), size = data.gridSize;
      const faces: { indices: number[]; depth: number }[] = [];
      for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const a = y * size + x; const indices = [a, a + 1, a + size + 1, a + size]; faces.push({ indices, depth: indices.reduce((sum, index) => sum + points[index].depth, 0) / 4 }); }
      faces.sort((a, b) => b.depth - a.depth);
      for (const face of faces) { const h = face.indices.reduce((sum, index) => sum + data.heights[index] * this.progress, 0) / 4; ctx.beginPath(); face.indices.forEach((index, k) => { const p = points[index]; if (k === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }); ctx.closePath(); ctx.fillStyle = `hsl(${190 - h * 40} ${45 + h * 10}% ${13 + h * 55}%)`; ctx.fill(); ctx.strokeStyle = '#90dedc24'; ctx.lineWidth = .4; ctx.stroke(); }
    }
    const line = (a: Point3, b: Point3, color = '#8bc7ce55') => { const p = project(a), q = project(b); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke(); };
    const label = (point: Point3, text: string, color = '#a8bdce', strong = false) => { const p = project(point); if (p.w <= 0 || p.x < 5 || p.x > this.width - 5 || p.y < 35 || p.y > this.height - 12) return; ctx.font = `${strong ? '600' : '400'} ${strong ? 12 : 11}px "Instrument Sans",sans-serif`; ctx.textAlign = 'center'; const width = ctx.measureText(text).width; ctx.fillStyle = '#071420db'; ctx.fillRect(p.x - width / 2 - 5, p.y - 10, width + 10, 17); ctx.fillStyle = color; ctx.fillText(text, p.x, p.y + 3); };
    const halfWidth = WIDTH / 2, halfDepth = DEPTH / 2;
    line([-halfWidth, -.02, halfDepth], [halfWidth, -.02, halfDepth]); line([-halfWidth, -.02, halfDepth], [-halfWidth, -.02, -halfDepth]);
    for (const tick of data.xAxis.ticks) { const x = -halfWidth + (tick - data.xAxis.min) / (data.xAxis.max - data.xAxis.min) * WIDTH; line([x, -.02, halfDepth], [x, -.02, halfDepth + .12]); label([x, -.05, halfDepth + .35], String(tick)); }
    for (const tick of data.yAxis.ticks) { const z = halfDepth - (tick - data.yAxis.min) / (data.yAxis.max - data.yAxis.min) * DEPTH; line([-halfWidth, -.02, z], [-halfWidth - .12, -.02, z]); label([-halfWidth - .35, -.05, z], String(tick)); }
    if (this.width > 560) { label([0, -.06, halfDepth + .85], data.xAxis.label, '#d1e8e6', true); label([-halfWidth - .85, -.06, 0], data.yAxis.label, '#d1e8e6', true); }
    data.peaks.forEach((peak, index) => { const p = this.world(peak.index); label([p[0], p[1] + .23, p[2]], `P${index + 1}`, '#f1dba5', true); });
    if (this.probe !== null) { const world = this.world(this.probe), p = project(world), floor = project([world[0], 0, world[2]]); ctx.strokeStyle = '#f4d494'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.moveTo(p.x, p.y + 7); ctx.lineTo(floor.x, floor.y); ctx.stroke(); }
  }
  dispose() { this.disposed = true; cancelAnimationFrame(this.frame); this.canvas.removeEventListener('webglcontextlost', this.lost); this.canvas.removeEventListener('webglcontextrestored', this.restored); if (this.gl) { this.gl.deleteBuffer(this.buffer); this.gl.deleteProgram(this.program); } }
}
