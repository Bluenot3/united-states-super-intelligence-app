import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpDown, RotateCcw } from 'lucide-react';
import type { OutcomeFilters, OutcomesDataset } from '../lib/outcomes';
import { selectOutcomeRecords } from '../lib/impact-exploration';
import '../data-strands.css';

export interface DataStrandsProps { dataset: OutcomesDataset; filters: OutcomeFilters; quiet?: boolean }
type AxisKey = 'attendance' | 'pre' | 'post' | 'gain' | 'stage' | 'days' | 'uptime' | 'users';
interface StrandAxis { key: AxisKey; label: string; short: string; min: number; max: number; step: number; ticks: number[]; unit: string; nullable?: boolean; logarithmic?: boolean }
type Brushes = Partial<Record<AxisKey, [number, number]>>;
type Point = { x: number; y: number };
interface Snapshot { rows: number[]; positions: Map<number, Record<AxisKey, Point>>; matches: Set<number>; order: AxisKey[]; color: 'cohort' | 'tier' }
const INITIAL_ORDER: AxisKey[] = ['attendance', 'pre', 'post', 'gain', 'stage', 'days', 'uptime', 'users'];
const TIER_BY_STAGE = [0, 0, 1, 1, 2, 2, 3, 4];
const DRAW_LIMIT = 2500;
const HEIGHT = 420;
const TOP = 78;
const BOTTOM = 340;
const NA_Y = 376;
const number = new Intl.NumberFormat('en-US');
const signed = (value: number | null) => value === null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;
const percent = (value: number, denominator: number) => denominator ? `${(value / denominator * 100).toFixed(1)}%` : '—';

function axisValue(data: OutcomesDataset, row: number, key: AxisKey): number | null {
  const c = data.columns;
  if (key === 'attendance') return c.att[row];
  if (key === 'pre') return c.pre_total[row] / 10;
  if (key === 'post') return c.post_total[row] / 10;
  if (key === 'gain') return (c.post_total[row] - c.pre_total[row]) / 10;
  if (key === 'stage') return c.stage[row];
  if (c.stage[row] < 2) return null;
  if (key === 'days') return c.days[row];
  if (key === 'uptime') return c.uptime[row] / 100;
  return c.users[row];
}

/** Inclusive raw-value brushes. Missing deployment measures never become zero. */
export function matchesStrandBrushes(data: OutcomesDataset, row: number, brushes: Brushes): boolean {
  for (const key of INITIAL_ORDER) {
    const range = brushes[key];
    if (!range) continue;
    const value = axisValue(data, row, key);
    if (value === null || value < range[0] || value > range[1]) return false;
  }
  return true;
}

function buildAxes(data: OutcomesDataset): StrandAxis[] {
  let maxUsers = 1, maxDays = 1;
  for (let i = 0; i < data.meta.n; i++) if (data.columns.stage[i] >= 2) {
    maxUsers = Math.max(maxUsers, data.columns.users[i]);
    maxDays = Math.max(maxDays, data.columns.days[i]);
  }
  return [
    { key: 'attendance', label: 'Sessions attended', short: 'Sessions', min: 0, max: 24, step: 1, ticks: [0, 6, 12, 18, 24], unit: 'sessions' },
    { key: 'pre', label: 'Pre assessment score', short: 'Pre score', min: 0, max: 100, step: .1, ticks: [0, 25, 50, 75, 100], unit: 'points' },
    { key: 'post', label: 'Post assessment score', short: 'Post score', min: 0, max: 100, step: .1, ticks: [0, 25, 50, 75, 100], unit: 'points' },
    { key: 'gain', label: 'Assessment score gain', short: 'Score gain', min: -100, max: 100, step: .1, ticks: [-100, -50, 0, 50, 100], unit: 'points' },
    { key: 'stage', label: 'Highest stage reached', short: 'Stage', min: 0, max: 7, step: 1, ticks: [0, 2, 4, 6, 7], unit: 'stage' },
    { key: 'days', label: 'Days to first live deployment', short: 'Deploy days', min: 0, max: maxDays, step: 1, ticks: [...new Set([0, 7, 14, 30, maxDays].filter(value => value <= maxDays))], unit: 'days', nullable: true },
    { key: 'uptime', label: 'App uptime, 30-day', short: 'Uptime', min: 0, max: 100, step: .01, ticks: [0, 25, 50, 75, 100], unit: '%', nullable: true },
    { key: 'users', label: 'App users, 30-day', short: 'App users', min: 0, max: maxUsers, step: 1, ticks: [...new Set([0, 10, 100, 1000, 10000, maxUsers].filter(value => value <= maxUsers))], unit: 'users', nullable: true, logarithmic: true },
  ];
}

function displayedValue(axis: StrandAxis, value: number): string {
  if (axis.key === 'stage') return `S${Math.round(value)}`;
  if (axis.key === 'gain') return `${value > 0 ? '+' : ''}${number.format(value)}`;
  if (axis.key === 'uptime') return `${number.format(value)}%`;
  return number.format(value);
}

function normalizedValue(axis: StrandAxis, value: number): number {
  if (axis.logarithmic) return Math.log10(1 + value) / Math.log10(1 + axis.max);
  return (value - axis.min) / (axis.max - axis.min);
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

export default function DataStrands({ dataset, filters, quiet = false }: DataStrandsProps) {
  const id = useId().replaceAll(':', '');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const widthRef = useRef<HTMLDivElement>(null);
  const snapshotRef = useRef<Snapshot | null>(null);
  const visibleRef = useRef(true);
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(980);
  const [themeRevision, setThemeRevision] = useState(0);
  const [onScreen, setOnScreen] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(() => !document.hidden);
  const [order, setOrder] = useState<AxisKey[]>([...INITIAL_ORDER]);
  const [selected, setSelected] = useState<AxisKey>('attendance');
  const [flips, setFlips] = useState<Partial<Record<AxisKey, boolean>>>({});
  const [brushes, setBrushes] = useState<Brushes>({});
  const [color, setColor] = useState<'cohort' | 'tier'>('cohort');
  const [tableOpen, setTableOpen] = useState(false);
  const axes = useMemo(() => buildAxes(dataset), [dataset]);
  const axisByKey = useMemo(() => Object.fromEntries(axes.map(axis => [axis.key, axis])) as Record<AxisKey, StrandAxis>, [axes]);
  const records = useMemo(() => Array.from(selectOutcomeRecords(dataset, filters)), [dataset, filters]);
  const matching = useMemo(() => records.filter(row => matchesStrandBrushes(dataset, row, brushes)), [records, dataset, brushes]);
  const sample = useMemo(() => {
    const count = Math.min(DRAW_LIMIT, records.length);
    // Stable, evenly spaced source indices. Every visual strand is an actual modeled record.
    return Array.from({ length: count }, (_, i) => records[Math.floor((i + .5) * records.length / count)]);
  }, [records]);
  const stats = useMemo(() => {
    const c = dataset.columns;
    let deployed = 0, launched = 0, capstones = 0, gain = 0, users = 0;
    for (const row of matching) {
      if (c.stage[row] >= 2) { deployed++; users += c.users[row]; }
      if (c.stage[row] >= 5) launched++;
      if (c.stage[row] === 7) capstones++;
      gain += (c.post_total[row] - c.pre_total[row]) / 10;
    }
    return { deployed, launched, capstones, meanGain: matching.length ? gain / matching.length : null, users };
  }, [matching, dataset]);
  const activeCount = Object.keys(brushes).length;
  const axis = axisByKey[selected];
  const range = brushes[selected] ?? [axis.min, axis.max];
  const selectedPosition = order.indexOf(selected);

  useEffect(() => {
    const element = widthRef.current;
    if (!element) return;
    const resize = () => setWidth(Math.max(960, Math.round(element.clientWidth)));
    resize();
    const observer = new ResizeObserver(resize); observer.observe(element);
    const visibility = new IntersectionObserver(entries => { const entry = entries.at(-1); if (entry) { visibleRef.current = entry.isIntersecting; setOnScreen(entry.isIntersecting); } }); visibility.observe(element);
    const documentVisibility = () => setDocumentVisible(!document.hidden);
    document.addEventListener('visibilitychange', documentVisibility);
    const themeObserver = new MutationObserver(() => setThemeRevision(value => value + 1));
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { observer.disconnect(); visibility.disconnect(); themeObserver.disconnect(); document.removeEventListener('visibilitychange', documentVisibility); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !onScreen || !documentVisible) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const dpr = Math.min(1.75, devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(HEIGHT * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    const style = getComputedStyle(widthRef.current!);
    const token = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
    const palette = Array.from({ length: 5 }, (_, i) => token(`--strands-color-${i}`, ['#70e7c1', '#93bbff', '#c7a3fb', '#e9cb84', '#ef99ca'][i]));
    const ink = token('--strands-ink', '#d9e8ee'), muted = token('--strands-muted', '#819eae'), grid = token('--strands-grid', '#22404e');
    const xFor = (position: number) => 57 + position * (width - 114) / (order.length - 1);
    const yFor = (key: AxisKey, raw: number | null) => {
      if (raw === null) return NA_Y;
      const value = normalizedValue(axisByKey[key], raw);
      return TOP + (flips[key] ? value : 1 - value) * (BOTTOM - TOP);
    };
    const positions = new Map<number, Record<AxisKey, Point>>();
    for (const row of sample) positions.set(row, Object.fromEntries(order.map((key, position) => [key, { x: xFor(position), y: yFor(key, axisValue(dataset, row, key)) }])) as Record<AxisKey, Point>);
    const current: Snapshot = { rows: sample, positions, matches: new Set(matching), order, color };
    const previous = snapshotRef.current;
    snapshotRef.current = current;
    const animate = !!previous && !quiet && !reduced && visibleRef.current && !document.hidden;
    let frame = 0, cancelled = false;
    const colorFor = (row: number, mode: 'cohort' | 'tier') => mode === 'cohort' ? dataset.columns.cohort[row] : TIER_BY_STAGE[dataset.columns.stage[row]];

    function background() {
      if (!context) return;
      context.globalAlpha = 1; context.globalCompositeOperation = 'source-over';
      context.fillStyle = token('--strands-bg', '#07131d'); context.fillRect(0, 0, width, HEIGHT);
      const glow = context.createRadialGradient(width * .5, HEIGHT * .45, 20, width * .5, HEIGHT * .45, width * .62);
      glow.addColorStop(0, '#29415824'); glow.addColorStop(1, '#07131d00');
      context.fillStyle = glow; context.fillRect(0, 0, width, HEIGHT);
      context.strokeStyle = grid; context.lineWidth = 1;
      context.setLineDash([2, 7]);
      for (let j = 0; j <= 4; j++) { const y = TOP + j / 4 * (BOTTOM - TOP); context.beginPath(); context.moveTo(35, y); context.lineTo(width - 35, y); context.stroke(); }
      context.setLineDash([]);
    }

    function drawRows(rows: number[], snapshot: Snapshot, alpha: number, progress: number, morph: boolean) {
      if (!context || alpha <= 0) return;
      context.globalCompositeOperation = 'screen';
      for (const isMatch of [false, true]) for (let category = 0; category < (snapshot.color === 'cohort' ? 3 : 5); category++) {
        context.beginPath();
        for (const row of rows) {
          if (snapshot.matches.has(row) !== isMatch || colorFor(row, snapshot.color) !== category) continue;
          const to = snapshot.positions.get(row)!;
          const from = morph ? previous?.positions.get(row) : undefined;
          let last: Point | null = null;
          for (const key of snapshot.order) {
            const target = to[key];
            const origin = from?.[key] ?? { x: target.x, y: BOTTOM + 18 };
            const point = morph ? { x: origin.x + (target.x - origin.x) * progress, y: origin.y + (target.y - origin.y) * progress } : target;
            if (!last) context.moveTo(point.x, point.y);
            else { const bend = (point.x - last.x) * .42; context.bezierCurveTo(last.x + bend, last.y, point.x - bend, point.y, point.x, point.y); }
            last = point;
          }
        }
        context.strokeStyle = palette[category];
        context.globalAlpha = alpha * (isMatch ? activeCount ? .18 : .105 : .015);
        context.lineWidth = isMatch ? .85 : .65;
        context.stroke();
      }
      context.globalAlpha = 1; context.globalCompositeOperation = 'source-over';
    }

    function overlay() {
      if (!context) return;
      for (const [position, key] of order.entries()) {
        const axis = axisByKey[key], x = xFor(position), brush = brushes[key];
        if (brush) {
          const y1 = yFor(key, brush[0]), y2 = yFor(key, brush[1]);
          context.fillStyle = '#a5e0f125'; context.fillRect(x - 9, Math.min(y1, y2), 18, Math.max(2, Math.abs(y2 - y1)));
          context.strokeStyle = ink; context.lineWidth = 2; context.beginPath(); context.moveTo(x, y1); context.lineTo(x, y2); context.stroke();
        }
        context.strokeStyle = key === selected ? '#b0dae87a' : grid; context.lineWidth = key === selected ? 1.5 : 1;
        context.beginPath(); context.moveTo(x, TOP); context.lineTo(x, BOTTOM); context.stroke();
        context.font = "11px 'Instrument Sans', sans-serif"; context.textAlign = position === order.length - 1 ? 'right' : 'left';
        for (const tick of axis.ticks) {
          const y = yFor(key, tick);
          context.strokeStyle = grid; context.beginPath(); context.moveTo(x - 4, y); context.lineTo(x + 4, y); context.stroke();
          context.fillStyle = muted; context.fillText(displayedValue(axis, tick), x + (position === order.length - 1 ? -9 : 9), y + 4);
        }
        if (axis.nullable) {
          context.fillStyle = muted; context.textAlign = 'center'; context.fillText('n/a', x, NA_Y + 18);
          context.strokeStyle = grid; context.setLineDash([3, 3]); context.beginPath(); context.moveTo(x - 11, NA_Y); context.lineTo(x + 11, NA_Y); context.stroke(); context.setLineDash([]);
        }
      }
    }

    canvas.dataset.ready = 'false';
    canvas.dataset.settled = 'false';
    const start = performance.now();
    const render = (now: number) => {
      if (cancelled || !context) return;
      const elapsed = animate ? Math.min(1, (now - start) / 850) : 1;
      const progress = 1 - (1 - elapsed) ** 3;
      background();
      drawRows(current.rows, current, animate ? .35 + progress * .65 : 1, progress, animate);
      overlay();
      canvas.dataset.ready = 'true';
      canvas.dataset.drawnCount = String(current.rows.length);
      canvas.dataset.sourceCount = String(records.length);
      canvas.dataset.selectedCount = String(matching.length);
      canvas.dataset.settled = String(elapsed === 1);
      if (elapsed < 1 && visibleRef.current && !document.hidden) frame = requestAnimationFrame(render);
      else if (elapsed < 1) { background(); drawRows(current.rows, current, 1, 1, false); overlay(); canvas.dataset.settled = 'true'; }
    };
    render(start);
    return () => { cancelled = true; cancelAnimationFrame(frame); };
  }, [dataset, sample, matching, order, flips, brushes, color, selected, width, quiet, reduced, themeRevision, axisByKey, activeCount, onScreen, documentVisible]);

  const setRange = (edge: 0 | 1, value: number) => {
    if (!Number.isFinite(value)) return;
    const next: [number, number] = [...range];
    next[edge] = Math.min(axis.max, Math.max(axis.min, value));
    if (edge === 0) next[0] = Math.min(next[0], next[1]); else next[1] = Math.max(next[0], next[1]);
    setBrushes(current => ({ ...current, [selected]: next }));
  };
  const clearAxis = () => setBrushes(current => { const next = { ...current }; delete next[selected]; return next; });
  const reorder = (direction: -1 | 1) => setOrder(current => {
    const next = [...current], index = next.indexOf(selected), other = index + direction;
    if (other < 0 || other >= next.length) return current;
    [next[index], next[other]] = [next[other], next[index]];
    return next;
  });
  const legend = color === 'cohort' ? ['2024 cohort', '2025 cohort', '2026 cohort'] : ['No credential', 'Tier 1 · Deployer', 'Tier 2 · Builder', 'Tier 3 · Operator', 'Tier 4 · AI Pioneer'];
  const tableRows = [
    ['Matching modeled records', number.format(matching.length), 'Exact intersection of local brushes across all globally filtered records.'],
    ['Share of current view', percent(matching.length, records.length), `${number.format(records.length)} globally filtered records.`],
    ['Reached a live URL', `${number.format(stats.deployed)} · ${percent(stats.deployed, matching.length)}`, 'S2+ divided by matching records.'],
    ['Public launch', `${number.format(stats.launched)} · ${percent(stats.launched, matching.length)}`, 'S5+ divided by matching records.'],
    ['Capstone', `${number.format(stats.capstones)} · ${percent(stats.capstones, matching.length)}`, 'S7 divided by matching records.'],
    ['Mean assessment gain', signed(stats.meanGain), 'Post-total minus pre-total. Descriptive score points; no comparison group.'],
    ['App audience, 30-day', number.format(stats.users), 'Sum of deployed-app users; people are not deduplicated across apps.'],
  ];

  return <section className="data-strands panel" aria-labelledby={`${id}-heading`}>
    <div className="strands-heading"><div><span className="strands-index">08 MEASURES / ONE CONNECTED FIELD</span><h2 id={`${id}-heading`}>Follow the threads.</h2><p>Each luminous strand is a modeled learner record. Brush a measure to find the paths that meet it.</p></div><div className="strands-color-control" role="group" aria-label="Color strands by"><button type="button" aria-pressed={color === 'cohort'} onClick={() => setColor('cohort')}>Cohort</button><button type="button" aria-pressed={color === 'tier'} onClick={() => setColor('tier')}>Credential tier</button></div></div>
    <div className="strands-legend" aria-label="Strand color legend">{legend.map((label, index) => <span key={label}><i style={{ background: `var(--strands-color-${index})` }} />{label}</span>)}</div>
    <div className="strands-scroll" tabIndex={0} role="region" aria-label="Parallel-coordinate field; scroll horizontally on smaller screens">
      <div className="strands-chart-width" ref={widthRef} style={{ height: HEIGHT }}>
        <canvas ref={canvasRef} role="img" aria-label={`Eight-measure parallel-coordinate visualization of ${number.format(sample.length)} ${sample.length < records.length ? 'sampled' : ''} modeled records. Exact brush results are listed below.`} />
        <div className="strands-axis-headings">{order.map((key, position) => <button key={key} type="button" className={`strands-axis-heading${selected === key ? ' is-selected' : ''}${brushes[key] ? ' is-brushed' : ''}`} style={{ left: `${57 / width * 100 + position * (width - 114) / width * 100 / (order.length - 1)}%` }} aria-pressed={selected === key} onClick={() => setSelected(key)} title={`Select ${axisByKey[key].label} to brush, flip or move this axis.`}><strong>{axisByKey[key].short}{flips[key] && <span aria-label="axis flipped"> ↓</span>}</strong><small>{axisByKey[key].logarithmic ? 'log₁₀(1 + users)' : axisByKey[key].unit}</small></button>)}</div>
      </div>
    </div>
    <div className="strands-sample-note"><span>{sample.length < records.length ? `${number.format(sample.length)} deterministically sampled strands from ${number.format(records.length)} records` : `${number.format(records.length)} records · every strand shown`}</span><span>Selection counts use every record in the view.</span></div>
    <div className="strands-control-panel">
      <div className="strands-axis-tools"><label htmlFor={`${id}-axis`}>Brush a measure<select id={`${id}-axis`} value={selected} onChange={event => setSelected(event.target.value as AxisKey)}>{order.map(key => <option value={key} key={key}>{axisByKey[key].label}</option>)}</select></label><div className="strands-axis-actions"><button type="button" onClick={() => reorder(-1)} disabled={selectedPosition === 0} aria-label={`Move ${axis.label} axis left`} title="Move selected axis left"><ArrowLeft size={15} />Move left</button><button type="button" onClick={() => reorder(1)} disabled={selectedPosition === order.length - 1} aria-label={`Move ${axis.label} axis right`} title="Move selected axis right"><ArrowRight size={15} />Move right</button><button type="button" onClick={() => setFlips(current => ({ ...current, [selected]: !current[selected] }))} aria-pressed={!!flips[selected]}><ArrowUpDown size={15} />{flips[selected] ? 'Unflip axis' : 'Flip axis'}</button></div></div>
      <div className="strands-range-controls"><label htmlFor={`${id}-min`}><span>Minimum {axis.short.toLowerCase()}<output>{displayedValue(axis, range[0])}</output></span><input id={`${id}-min`} type="range" min={axis.min} max={axis.max} step={axis.step} value={range[0]} aria-valuetext={displayedValue(axis, range[0])} onChange={event => setRange(0, Number(event.target.value))} /></label><label htmlFor={`${id}-max`}><span>Maximum {axis.short.toLowerCase()}<output>{displayedValue(axis, range[1])}</output></span><input id={`${id}-max`} type="range" min={axis.min} max={axis.max} step={axis.step} value={range[1]} aria-valuetext={displayedValue(axis, range[1])} onChange={event => setRange(1, Number(event.target.value))} /></label></div>
      <div className="strands-brush-actions"><span>{activeCount ? `${activeCount} intersecting ${activeCount === 1 ? 'brush' : 'brushes'} · inclusive ranges` : 'No local brushes · all records in view'}</span><div><button type="button" disabled={!brushes[selected]} onClick={clearAxis}>Clear this measure</button><button type="button" disabled={!activeCount} onClick={() => setBrushes({})}><RotateCcw size={14} />Clear all brushes</button></div></div>
      {activeCount > 0 && <div className="strands-brush-chips" aria-label="Active local brush ranges">{axes.filter(item => brushes[item.key]).map(item => <button type="button" key={item.key} onClick={() => setSelected(item.key)} aria-label={`Select ${item.label} brush`}><span>{item.short}</span>{displayedValue(item, brushes[item.key]![0])} → {displayedValue(item, brushes[item.key]![1])}</button>)}</div>}
    </div>
    <div className="strands-exact-stats" aria-live="polite"><div><strong>{number.format(matching.length)}</strong><span>Matching records</span></div><div><strong>{percent(matching.length, records.length)}</strong><span>Share of filtered view</span></div><div><strong>{percent(stats.deployed, matching.length)}</strong><span>Reached a live URL</span></div><div><strong>{signed(stats.meanGain)}</strong><span>Mean gain · points</span></div></div>
    {matching.length === 0 && <p className="strands-empty" role="status">No modeled records match these brushes. Clear a measure or widen its range.</p>}
    <div className="strands-scope"><p>This field shows eventual modeled outcomes across the full enrollment period of the selected cohorts. Brushes apply only here, within the shared cohort, track, jurisdiction and delivery filters. Deployment measures have an explicit n/a band; a numeric brush excludes records that never deployed. App users use a logarithmic axis to keep the full audience range visible.</p><button type="button" aria-expanded={tableOpen} aria-controls={`${id}-table`} onClick={() => setTableOpen(value => !value)}>{tableOpen ? 'Hide' : 'Show'} exact selection table</button></div>
    {tableOpen && <div className="strands-table-wrap" id={`${id}-table`}><table><caption>Exact aggregates of every matching modeled record. The visual sample does not determine these values.</caption><thead><tr><th scope="col">Measure</th><th scope="col">Value</th><th scope="col">Definition</th></tr></thead><tbody>{tableRows.map(([measure, value, definition]) => <tr key={measure}><th scope="row">{measure}</th><td>{value}</td><td>{definition}</td></tr>)}</tbody></table></div>}
  </section>;
}
