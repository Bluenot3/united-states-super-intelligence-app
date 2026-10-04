import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Focus } from 'lucide-react';
import { enrollmentTimestamp, selectOutcomeRecords } from '../lib/impact-exploration';
import { STAGE_LABELS, type OutcomeFilters, type OutcomesDataset } from '../lib/outcomes';

export type FieldScene = 'chronology' | 'cohorts' | 'ladder' | 'learning';
const COLORS = ['#cfae73', '#77bdb5', '#b3a3ed'];
const scenes: { id: FieldScene; name: string; description: string }[] = [
  { id: 'chronology', name: 'Time ribbons', description: 'Horizontal position is the exact modeled enrollment date. Vertical position is the eventual highest stage.' },
  { id: 'cohorts', name: 'Cohort orbits', description: 'One ring per enrollment year. Angle groups the recorded day within its 63-day enrollment season. Position within each day is schematic.' },
  { id: 'ladder', name: 'Stage helix', description: 'Eight levels group records by eventual highest stage. The spiral is a schematic arrangement, not a dated learning path.' },
  { id: 'learning', name: 'Learning space', description: 'Horizontal position is the before score; vertical position is the after score, each on a 0–100 scale.' },
];
const random = (index: number, seed: number) => { let v = (index + seed) >>> 0; v = Math.imul(v ^ (v >>> 16), 0x7feb352d); v = Math.imul(v ^ (v >>> 15), 0x846ca68b); return ((v ^ (v >>> 16)) >>> 0) / 4294967295; };
type Mark = { index: number; year: number; stage: number; date: number; pre: number; post: number };
type Point = { x: number; y: number; z: number };

export default function StudentField({ dataset, filters, date, scene, onSceneChange, quiet }: {
  dataset: OutcomesDataset; filters: OutcomeFilters; date: string; scene: FieldScene;
  onSceneChange: (scene: FieldScene) => void; quiet: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const points = useRef<Point[]>([]);
  const pointIndices = useRef<number[]>([]);
  const [size, setSize] = useState({ width: 900, height: 440 });
  const [inspect, setInspect] = useState<number | null>(null);
  const [visible, setVisible] = useState(true);
  const [documentVisible, setDocumentVisible] = useState(() => !document.hidden);
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [fallback, setFallback] = useState(false);
  const marks = useMemo(() => Array.from(selectOutcomeRecords(dataset, filters), index => ({ index,
    year: Number(dataset.meta.dict.cohort[dataset.columns.cohort[index]]), stage: dataset.columns.stage[index],
    date: enrollmentTimestamp(dataset, index), pre: dataset.columns.pre_total[index] / 10, post: dataset.columns.post_total[index] / 10,
  } satisfies Mark)), [dataset, filters]);
  const asOf = Date.parse(`${date}T23:59:59.999Z`);
  const shown = useMemo(() => marks.filter(mark => mark.date <= asOf), [marks, asOf]);
  const picked = inspect === null ? null : shown[inspect];

  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const visibility = () => setDocumentVisible(!document.hidden);
    const motion = () => setReducedMotion(preference.matches);
    document.addEventListener('visibilitychange', visibility); preference.addEventListener('change', motion);
    return () => { document.removeEventListener('visibilitychange', visibility); preference.removeEventListener('change', motion); };
  }, []);

  useEffect(() => {
    if (!host.current) return;
    const resize = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.width < 600 ? 370 : 440 }));
    const intersection = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    resize.observe(host.current); intersection.observe(host.current);
    return () => { resize.disconnect(); intersection.disconnect(); };
  }, []);
  useEffect(() => { setInspect(null); }, [marks, date, scene]);

  useEffect(() => {
    const element = canvas.current;
    if (!element || !visible || !documentVisible) return;
    const context = element.getContext('2d');
    if (!context) { setFallback(true); return; }
    const { width, height } = size, dpr = Math.min(devicePixelRatio || 1, 1.5);
    element.width = Math.round(width * dpr); element.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    const compact = width < 600;
    const left = compact ? 40 : 65, right = width - (compact ? 24 : 45), top = 30, bottom = height - 42;
    const start = Date.UTC(2024, 8, 9), end = Date.UTC(2026, 10, 10);
    const target = shown.map((mark, i): Point => {
      const r1 = random(mark.index, 11), r2 = random(mark.index, 73);
      if (scene === 'chronology') return { x: left + (mark.date - start) / (end - start) * (right - left), y: bottom - (mark.stage + .08 + r2 * .72) / 8 * (bottom - top), z: r1 };
      if (scene === 'learning') return { x: left + mark.pre / 100 * (right - left), y: bottom - mark.post / 100 * (bottom - top), z: r1 };
      if (scene === 'cohorts') {
        const radius = (mark.year - 2024 + 1) * Math.min(width * .12, height * .15);
        const angle = (dataset.columns.eday[mark.index] + r1) / 63 * Math.PI * 2 - Math.PI / 2, depth = Math.sin(angle);
        return { x: width / 2 + Math.cos(angle) * (radius + (r2 - .5) * 22), y: height / 2 + depth * radius * .55 + (mark.stage - 3.5) * 2.8, z: (depth + 1) / 2 };
      }
      const angle = mark.stage * .74 + (r1 - .5) * 1.2;
      const radius = Math.min(width * .29, 200) + (r2 - .5) * 35;
      return { x: width / 2 + Math.cos(angle) * radius, y: bottom - mark.stage / 7 * (bottom - top - 20) + Math.sin(angle) * 22 + (random(i, 34) - .5) * 14, z: (Math.sin(angle) + 1) / 2 };
    });
    const old = new Map(pointIndices.current.map((index, position) => [index, points.current[position]]));
    const origin = shown.map((mark, position) => old.get(mark.index) ?? { ...target[position], x: target[position].x + 8, y: target[position].y + 8 });
    pointIndices.current = shown.map(mark => mark.index);
    let frame = 0, startTime = 0;
    const unchanged = target.every((point, index) => Math.abs(point.x - origin[index].x) < .01 && Math.abs(point.y - origin[index].y) < .01);
    const reduced = quiet || reducedMotion || unchanged;
    const draw = (time: number) => {
      if (!startTime) startTime = time;
      const progress = reduced ? 1 : Math.min(1, (time - startTime) / 850), ease = 1 - Math.pow(1 - progress, 3);
      context.clearRect(0, 0, width, height);
      context.strokeStyle = 'rgba(173,201,211,.14)'; context.lineWidth = 1;
      context.fillStyle = '#92a8b9'; context.font = '11px "Instrument Sans", sans-serif';
      if (scene === 'chronology' || scene === 'learning') {
        for (let tick = 0; tick <= (scene === 'learning' ? 4 : 7); tick++) {
          const y = scene === 'learning' ? bottom - tick / 4 * (bottom - top) : bottom - (tick + .5) / 8 * (bottom - top);
          context.beginPath(); context.moveTo(left, y); context.lineTo(right, y); context.stroke();
          context.textAlign = 'right'; context.fillText(scene === 'learning' ? String(tick * 25) : `S${tick}`, left - 12, y + 4);
        }
        if (scene === 'learning') {
          context.setLineDash([3, 6]); context.beginPath(); context.moveTo(left, bottom); context.lineTo(right, top); context.stroke(); context.setLineDash([]);
          [0, 25, 50, 75, 100].forEach(value => { context.textAlign = 'center'; context.fillText(String(value), left + value / 100 * (right - left), bottom + 25); });
        } else [2024, 2025, 2026].forEach(year => { context.textAlign = 'center'; const x = left + (Date.UTC(year, 8, 9) - start) / (end - start) * (right - left); context.fillText(String(year), Math.min(right - 12, Math.max(left + 12, x)), bottom + 25); });
      }
      const drawn: Point[] = [];
      for (let i = 0; i < target.length; i++) {
        const to = target[i], from = origin[i];
        const point = { x: from.x + (to.x - from.x) * ease, y: from.y + (to.y - from.y) * ease, z: to.z };
        drawn.push(point);
        context.globalAlpha = .3 + to.z * .52;
        context.fillStyle = COLORS[shown[i].year - 2024];
        const radius = compact ? 1.2 : 1.35;
        context.fillRect(point.x, point.y, radius, radius);
      }
      context.globalAlpha = 1;
      if (inspect !== null && drawn[inspect]) {
        const point = drawn[inspect]; context.strokeStyle = '#fff'; context.lineWidth = 1.5;
        context.beginPath(); context.arc(point.x, point.y, 7, 0, Math.PI * 2); context.stroke();
        context.beginPath(); context.moveTo(point.x - 12, point.y); context.lineTo(point.x + 12, point.y); context.stroke();
      }
      points.current = drawn;
      element.dataset.ready = 'true'; element.dataset.marks = String(shown.length);
      element.dataset.scene = scene;
      element.dataset.settled = String(progress === 1);
      if (progress < 1 && !document.hidden) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [size, shown, scene, quiet, reducedMotion, documentVisible, visible, inspect]);

  const pick = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
    let nearest = -1, distance = 18 * 18;
    points.current.forEach((point, index) => { const d = (point.x - x) ** 2 + (point.y - y) ** 2; if (d < distance) { distance = d; nearest = index; } });
    setInspect(nearest < 0 ? null : nearest);
  };
  return <section className="student-field" aria-labelledby="student-field-title">
    <div className="exploration-heading"><div><span className="exploration-eyebrow">02 / THE STUDENT UNIVERSE</span><h2 id="student-field-title">Every point. A possibility.</h2></div><span className="field-exact-count">{shown.length.toLocaleString()} exact modeled records</span></div>
    <div className="field-mode-controls" role="group" aria-label="Student field layout">{scenes.map(option => <button key={option.id} aria-pressed={scene === option.id} onClick={() => onSceneChange(option.id)}>{option.name}</button>)}</div>
    <div className="field-stage" ref={host} style={{ minHeight: size.height }}>
      <div className="field-instrument-label"><Focus size={14} /> ONE POINT = ONE MODELED ENROLLMENT RECORD</div>
      {fallback ? <p className="field-fallback">Canvas unavailable. The exact cohort table and timeline remain available above.</p> : <canvas ref={canvas} style={{ width: '100%', height: size.height }} onPointerUp={pick} role="img" aria-label={`${scenes.find(item => item.id === scene)?.name}: ${shown.length} modeled enrollment records joined by ${date}. ${scenes.find(item => item.id === scene)?.description}`} />}
      {!shown.length && <div className="field-empty">No selected records had joined by this date.<br />Move the timeline forward or choose another cohort.</div>}
      <div className="field-year-key">{[2024, 2025, 2026].map((year, i) => <span key={year}><i style={{ background: COLORS[i] }} />{year}<b>{shown.filter(mark => mark.year === year).length.toLocaleString()}</b></span>)}</div>
    </div>
    <div className="field-reading"><p>{scenes.find(option => option.id === scene)?.description} Click or tap a point to inspect its synthetic record.</p>{shown.length > 0 && <div className="field-record-navigation"><button aria-label="Previous synthetic record" onClick={() => setInspect(current => current === null ? 0 : (current - 1 + shown.length) % shown.length)}><ChevronLeft size={16}/></button><span>Inspect records</span><button aria-label="Next synthetic record" onClick={() => setInspect(current => current === null ? 0 : (current + 1) % shown.length)}><ChevronRight size={16}/></button></div>}</div>
    {picked && <div className="field-inspector" role="status"><strong>Synthetic record · {picked.year} cohort</strong><span>Joined {new Date(picked.date).toISOString().slice(0, 10)}</span><span>Eventual highest stage: S{picked.stage} · {STAGE_LABELS[picked.stage]}</span><span>Before {picked.pre.toFixed(1)} → after {picked.post.toFixed(1)}</span><button onClick={() => setInspect(null)}>Close inspection</button></div>}
    <p className="exploration-note">The date cursor filters enrollment. Stages and scores describe eventual modeled outcomes, with no recorded achievement dates. All records are synthetic.</p>
  </section>;
}
