import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Copy, MoveHorizontal, Pause, Play, RotateCcw, Table2 } from 'lucide-react';
import { enrollmentTimestamp, exploreImpact, selectOutcomeRecords, type ImpactTimelineRow } from '../lib/impact-exploration';
import type { OutcomeFilters, OutcomesDataset } from '../lib/outcomes';
import StudentField, { type FieldScene } from './StudentField';
import '../impact-exploration.css';
import '../chronicle-cinematic.css';

type TimeView = 'cumulative' | 'daily' | 'season';
const COLORS = ['#e9c58b', '#73dbc6', '#bba6ff'];
const DAY = 86400000;
const num = (value: number) => value.toLocaleString('en-US');
const iso = (timestamp: number) => new Date(timestamp).toISOString().slice(0, 10);
const pretty = (date: string) => new Date(date + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const query = (key: string) => new URLSearchParams(location.search).get(key);
const writeQuery = (values: Record<string, string>) => { const url = new URL(location.href); Object.entries(values).forEach(([key, value]) => url.searchParams.set(key, value)); history.replaceState(null, '', url); };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date + 'T00:00:00Z')) && iso(Date.parse(date + 'T00:00:00Z')) === date;

export interface ChronicleSeason {
  year: number; total: number; selectedTotal: number;
  rows: { date: string; day: number; arrivals: number; selectedArrivals: number; cumulative: number; selectedCumulative: number }[];
}
/** Exact 63-day enrollment seasons. Absent enrollment events have zero joins, never interpolated counts. */
export function buildChronicleSeasons(timeline: readonly ImpactTimelineRow[], years: readonly number[] = [2024, 2025, 2026]): ChronicleSeason[] {
  const events = new Map(timeline.map(row => [row.date, row]));
  return years.map(year => {
    let cumulative = 0, selectedCumulative = 0;
    const rows = Array.from({ length: 63 }, (_, day) => {
      const date = iso(Date.UTC(year, 8, 9 + day)), event = events.get(date);
      const arrivals = event?.newLearners ?? 0, selectedArrivals = event?.selectedNewLearners ?? 0;
      cumulative += arrivals; selectedCumulative += selectedArrivals;
      return { date, day, arrivals, selectedArrivals, cumulative, selectedCumulative };
    });
    return { year, rows, total: cumulative, selectedTotal: selectedCumulative };
  });
}
/** Right-continuous steps retain their last measured height through an exact endpoint or zero-join gap. */
export function chronicleStepPath(points: readonly { x: number; y: number }[], endX: number, baseline: number): string {
  if (!points.length) return '';
  return 'M ' + points[0].x + ' ' + baseline + ' ' + points.map(point => 'H ' + point.x + ' V ' + point.y).join(' ') + ' H ' + endX;
}
function niceScale(peak: number) {
  const quarter = Math.max(1, peak / 4), unit = 10 ** Math.floor(Math.log10(quarter));
  return Math.ceil(quarter / unit) * unit * 4;
}

export default function ImpactChronicle({ dataset, filters, onFiltersChange, quiet, onQuietChange, exploration }: {
  dataset: OutcomesDataset; filters: OutcomeFilters; onFiltersChange: (filters: OutcomeFilters) => void;
  quiet: boolean; onQuietChange: (quiet: boolean) => void;
  exploration: ReturnType<typeof exploreImpact>;
}) {
  const years = useMemo(() => [...dataset.source.cohorts].sort((a, b) => a - b), [dataset]);
  const span = useMemo(() => {
    let min = Infinity, max = -Infinity;
    for (const index of selectOutcomeRecords(dataset)) { const timestamp = enrollmentTimestamp(dataset, index); min = Math.min(min, timestamp); max = Math.max(max, timestamp); }
    return { start: iso(Number.isFinite(min) ? min : Date.UTC(years[0] ?? 2024, 8, 9)), end: iso(Number.isFinite(max) ? max : Date.UTC(years.at(-1) ?? 2026, 10, 10)) };
  }, [dataset, years]);
  const joins = useMemo(() => exploration.timeline.filter(row => row.newLearners > 0), [exploration]);
  const seasons = useMemo(() => buildChronicleSeasons(exploration.timeline, years), [exploration, years]);
  const initialDate = query('date');
  const [date, setDate] = useState(() => initialDate && validDate(initialDate) && initialDate >= span.start && initialDate <= span.end ? initialDate : span.end);
  const [playing, setPlaying] = useState(false);
  const [timeView, setTimeView] = useState<TimeView>(() => ['daily', 'season'].includes(query('time') || '') ? query('time') as TimeView : 'cumulative');
  const [scene, setScene] = useState<FieldScene>(() => ['cohorts', 'ladder', 'learning'].includes(query('scene') || '') ? query('scene') as FieldScene : 'chronology');
  const [table, setTable] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState(false);
  const [width, setWidth] = useState(950);
  const [speed, setSpeed] = useState(140);
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [onscreen, setOnscreen] = useState(true);
  const plot = useRef<HTMLDivElement>(null);
  const section = useRef<HTMLElement>(null);
  const gesture = useRef<{ id: number; x: number; y: number; scrubbing: boolean } | null>(null);
  const id = useId().replace(/:/g, '');
  const today = iso(Date.now()), end = span.end;
  const throughIndex = joins.filter(row => row.date <= date).length - 1;
  const activeIndex = Math.max(0, throughIndex);
  const active = exploration.timeline.filter(row => row.date <= date).at(-1);
  const joined = active?.selectedCumulativeLearners ?? 0;
  const contextJoined = active?.cumulativeLearners ?? 0;
  const dayJoins = exploration.timeline.find(row => row.date === date)?.selectedNewLearners ?? 0;
  const contextDayJoins = exploration.timeline.find(row => row.date === date)?.newLearners ?? 0;
  const activeYear = Number(date.slice(0, 4));
  const rawSeasonDay = Math.floor((Date.parse(date + 'T00:00:00Z') - Date.UTC(activeYear, 8, 9)) / DAY);
  const seasonWithinRange = rawSeasonDay >= 0 && rawSeasonDay <= 62;
  const seasonDay = clamp(rawSeasonDay, 0, 62);
  const progress = joins.length ? Math.max(0, throughIndex + 1) / joins.length : 0;
  const fullDayPeak = Math.max(1, ...seasons.flatMap(season => season.rows.map(row => row.arrivals)));
  const motion = !quiet && !reduced && onscreen;
  const compact = width < 550;

  useEffect(() => { writeQuery({ date, scene, time: timeView }); setCopied(false); }, [date, scene, timeView]);
  useEffect(() => {
    const element = plot.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)));
    observer.observe(element); return () => observer.disconnect();
  }, [table]);
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(preference.matches);
    preference.addEventListener('change', change);
    const observer = new IntersectionObserver(entries => { const entry = entries.at(-1); if (entry) setOnscreen(entry.isIntersecting); });
    if (section.current) observer.observe(section.current);
    return () => { preference.removeEventListener('change', change); observer.disconnect(); };
  }, []);
  useEffect(() => { setPlaying(false); setCopied(false); }, [filters]);
  useEffect(() => { if (quiet || !onscreen || reduced) setPlaying(false); }, [quiet, onscreen, reduced]);
  useEffect(() => {
    if (!playing || quiet || !onscreen || document.hidden) return;
    const interval = window.setInterval(() => setDate(previous => {
      const next = joins.find(row => row.date > previous);
      if (!next) { setPlaying(false); return previous; }
      return next.date;
    }), speed);
    const stop = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener('visibilitychange', stop);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', stop); };
  }, [playing, joins, quiet, speed, onscreen]);
  const selectDate = (next: string) => { setPlaying(false); if (validDate(next) && next >= span.start && next <= end) setDate(next); };
  const replay = () => {
    if (!joins.length) return;
    if (quiet) onQuietChange(false);
    if (playing) setPlaying(false);
    else { if (!joins.some(row => row.date > date)) setDate(joins[0].date); setPlaying(true); }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(location.href); setCopied(true); setShareError(false); } catch { setCopied(false); setShareError(true); } };
  const checkpoint = (year: number) => { onFiltersChange({ ...filters, cohort: 'all' }); selectDate(iso(clamp(Date.UTC(year, 10, 10), Date.parse(span.start), Date.parse(end)))); };
  const moveDate = (direction: -1 | 1) => {
    const next = direction > 0 ? joins.find(row => row.date > date) : [...joins].reverse().find(row => row.date < date);
    if (next) selectDate(next.date);
  };

  const chart = useMemo(() => {
    const left = compact ? 38 : 58, right = width - (compact ? 22 : 106), top = 48, bottom = 322;
    const minDate = Date.parse(span.start), maxDate = Date.parse(end);
    const dateX = (value: string) => left + (Date.parse(value) - minDate) / Math.max(DAY, maxDate - minDate) * (right - left);
    const dayX = (value: number) => left + value / 62 * (right - left);
    const scale = niceScale(timeView === 'season' ? Math.max(1, ...seasons.map(season => season.total)) : exploration.totalContext);
    const y = (value: number) => bottom - value / scale * (bottom - top);
    const values = years.map(() => 0);
    const stack = [{ date: span.start, values: [...values] }, ...joins.map(row => {
      const index = years.indexOf(row.year); if (index >= 0) values[index] += row.newLearners;
      return { date: row.date, values: [...values] };
    }), { date: end, values: [...values] }];
    const cumulative = (counts: number[], index: number) => counts.slice(0, index + 1).reduce((a, b) => a + b, 0);
    const ribbons = years.map((year, index) => {
      const upper = stack.map(row => ({ x: dateX(row.date), y: y(cumulative(row.values, index)) }));
      const lower = stack.map(row => ({ x: dateX(row.date), y: y(cumulative(row.values, index - 1)) }));
      let area = chronicleStepPath(upper, right, bottom) + ' L ' + right + ' ' + lower.at(-1)!.y;
      for (let i = lower.length - 1; i > 0; i--) area += ' V ' + lower[i - 1].y + ' H ' + lower[i - 1].x;
      area += ' Z';
      const startDate = iso(Date.UTC(year, 8, 9));
      const edgeRows = stack.filter(row => row.date >= startDate);
      const edge = edgeRows.map(row => ({ x: dateX(row.date), y: y(cumulative(row.values, index)) }));
      const edgeBaseline = edgeRows.length ? y(cumulative(edgeRows[0].values, index - 1)) : bottom;
      return { year, area, line: values[index] ? chronicleStepPath(edge, right, edgeBaseline) : '', labelY: y(cumulative(values, index - 1) + values[index] / 2), total: values[index] };
    });
    const selectedPath = chronicleStepPath([{ x: left, y: bottom }, ...joins.filter(row => row.date <= date).map(row => ({ x: dateX(row.date), y: y(row.selectedCumulativeLearners) }))], dateX(date), bottom);
    const seasonPaths = seasons.map(season => ({ ...season,
      path: chronicleStepPath(season.rows.map(row => ({ x: dayX(row.day), y: y(row.cumulative) })), right, bottom),
      pointY: y(season.rows[seasonDay].cumulative),
    }));
    const rawLabels = (timeView === 'season' ? seasonPaths.map(row => ({ year: row.year, anchor: y(row.total), total: row.total })) : ribbons.map(row => ({ year: row.year, anchor: row.labelY, total: row.total }))).sort((a, b) => a.anchor - b.anchor);
    const labels = rawLabels.map((label, i) => ({ ...label, y: clamp(label.anchor, top + 16 + i * 28, bottom - 14 - (rawLabels.length - i - 1) * 28) }));
    for (let i = 1; i < labels.length; i++) labels[i].y = Math.max(labels[i].y, labels[i - 1].y + 28);
    const laneTop = 62, laneHeight = 88, laneGap = 25;
    const dailyScale = niceScale(fullDayPeak);
    return { left, right, top, bottom, dateX, dayX, scale, y, ribbons, selectedPath, seasonPaths, labels, laneTop, laneHeight, laneGap, dailyScale };
  }, [width, compact, span, end, timeView, exploration, seasons, joins, date, years, seasonDay, fullDayPeak]);

  const scrub = (event: React.PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width * width;
    const y = (event.clientY - bounds.top) / bounds.height * 420;
    const fraction = clamp((x - chart.left) / Math.max(1, chart.right - chart.left), 0, 1);
    if (timeView === 'cumulative') {
      const first = Date.parse(span.start), last = Date.parse(end);
      selectDate(iso(first + Math.round(fraction * (last - first) / DAY) * DAY));
    } else {
      const year = timeView === 'daily' ? years[clamp(Math.floor((y - chart.laneTop + 20) / (chart.laneHeight + chart.laneGap)), 0, years.length - 1)] : activeYear;
      const timestamp = Date.UTC(year, 8, 9 + Math.round(fraction * 62));
      selectDate(iso(clamp(timestamp, Date.parse(span.start), Date.parse(end))));
    }
  };
  const pointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, scrubbing: event.pointerType !== 'touch' };
    event.currentTarget.setPointerCapture(event.pointerId);
    if (event.pointerType !== 'touch') scrub(event);
  };
  const pointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    if (Math.abs(event.clientX - current.x) > 6 && Math.abs(event.clientX - current.x) > Math.abs(event.clientY - current.y)) current.scrubbing = true;
    if (current.scrubbing) scrub(event);
  };
  const pointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    const current = gesture.current;
    if (current?.id === event.pointerId && (current.scrubbing || Math.hypot(event.clientX - current.x, event.clientY - current.y) < 8)) scrub(event);
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const seasonYear = (year: number) => selectDate(iso(clamp(Date.UTC(year, 8, 9 + seasonDay), Date.parse(span.start), Date.parse(end))));
  const modeDescription = timeView === 'cumulative'
    ? 'Band thickness is cumulative enrollment records in each cohort; the bands add to the context total. Bright color ends at the selected calendar date. Flat stretches preserve months with zero joins.'
    : timeView === 'daily'
      ? 'Each stem is the exact count of joins on one date. The three seasons share the same height scale. Bright stems have occurred by the selected date; dim stems show the remainder of the synthetic model.'
      : 'Each stepped ribbon shows cumulative joins within a 63-day season. Day 0 is September 9; day 62 is November 10. The cursor compares the same season day across years; curves show full modeled seasons.';

  return <div className="impact-exploration">
    <section ref={section} className={'enrollment-chronicle chronicle-cinematic' + (motion ? ' chronicle-motion' : '') + (playing ? ' chronicle-playing' : '')} aria-labelledby="enrollment-chronicle-title">
      <div className="exploration-heading"><div><span className="exploration-eyebrow">01 / THE ENROLLMENT CHRONICLE</span><h2 id="enrollment-chronicle-title">Watch possibility gather.</h2><p>Three seasons of arrival. Every date, every record, every rise in the model.</p></div><button className="chronicle-share" onClick={copy}><Copy size={15}/>{copied ? 'Link copied' : 'Share this view'}</button></div>
      {shareError && <label className="chronicle-share-fallback">Copy this analysis link<input readOnly value={location.href} onFocus={event => event.currentTarget.select()}/></label>}
      <div className="chronicle-cinematic-reading"><div className="chronicle-main-reading"><span>MODELED RECORDS JOINED BY THIS DATE</span><strong data-testid="chronicle-total">{num(joined)}</strong><p>{filters.cohort === 'all' ? 'Cumulative enrollment records · 2024–2026' : filters.cohort + ' cohort · ' + num(contextJoined) + ' in cohort context'}</p></div><div className="chronicle-arrival-reading"><span>ARRIVAL SIGNAL · UTC</span><strong key={date}>{dayJoins > 0 ? '+' : ''}{num(dayJoins)}<small>joins</small></strong><time dateTime={date}>{pretty(date)}</time><p>{dayJoins === 0 ? 'No selected enrollments on this date' : 'Exact selected enrollments on this date'}</p></div></div>
      <div className="chronicle-toolbar"><div role="group" aria-label="Enrollment chart view">{([{ id: 'cumulative', label: 'Cumulative growth' }, { id: 'daily', label: 'Daily arrivals' }, { id: 'season', label: 'Season comparison' }] as const).map(view => <button key={view.id} aria-pressed={timeView === view.id} onClick={() => setTimeView(view.id)}>{view.label}</button>)}</div><button aria-label={table ? 'Show enrollment chart' : 'Show enrollment table'} onClick={() => setTable(!table)}><Table2 size={16}/>{table ? 'Chart' : 'Data'}</button></div>
      {table ? <div className="chronicle-table table-scroll"><table><caption>Exact modeled enrollment dates. Context respects track, jurisdiction and delivery filters; selected counts also respect cohort.</caption><thead><tr><th>Date</th><th>Year</th><th>New joins · selected</th><th>Cumulative · selected</th><th>Cumulative · context</th></tr></thead><tbody>{joins.map(row => <tr key={row.date} className={row.date === date ? 'active-date-row' : ''}><th><button onClick={() => selectDate(row.date)}>{row.date}</button></th><td>{row.year}</td><td>{num(row.selectedNewLearners)}</td><td>{num(row.selectedCumulativeLearners)}</td><td>{num(row.cumulativeLearners)}</td></tr>)}</tbody></table></div> : <div className="chronicle-panorama" ref={plot}>
        <div className="chronicle-panorama-meta"><span>{timeView === 'daily' ? 'DAILY JOINS / SHARED SCALE' : timeView === 'season' ? 'COHORT RECORDS / SAME SEASON DAY' : 'CUMULATIVE RECORDS / CALENDAR TIME'}</span><span><MoveHorizontal size={14}/>Tap or drag to scrub</span></div>
        {timeView === 'season' && <div className="chronicle-season-year" role="group" aria-label="Year to scrub in season comparison"><span>Scrub year</span>{years.map((year, index) => <button key={year} onClick={() => seasonYear(year)} aria-pressed={activeYear === year} style={{ '--season-color': COLORS[index] } as React.CSSProperties}>{year}</button>)}</div>}
        <svg className="chronicle-panorama-svg" viewBox={'0 0 ' + width + ' 420'} role="img" aria-label={timeView + ' chart of exact modeled enrollments. ' + pretty(date) + ': ' + num(joined) + ' selected records. Use the native date cursor below as a keyboard alternative.'} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { gesture.current = null; }} onLostPointerCapture={() => { gesture.current = null; }} data-view={timeView} data-date={date} data-selected-count={joined}>
          <defs>
            {years.map((year, index) => <linearGradient key={year} id={id + '-ribbon-' + year} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={COLORS[index]} stopOpacity=".44"/><stop offset="1" stopColor={COLORS[index]} stopOpacity=".06"/></linearGradient>)}
            <filter id={id + '-glow'} x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="4"/></filter>
            <clipPath id={id + '-past'}><rect x={chart.left - 1} y="0" width={Math.max(0, chart.dateX(date) - chart.left + 1)} height="420"/></clipPath>
          </defs>
          {timeView !== 'daily' && <g className="chronicle-grid-layer">{[0, 1, 2, 3, 4].map(tick => <g key={tick}><line x1={chart.left} x2={chart.right} y1={chart.y(chart.scale * tick / 4)} y2={chart.y(chart.scale * tick / 4)}/><text x={chart.left - 9} y={chart.y(chart.scale * tick / 4) + 4} textAnchor="end">{chart.scale >= 1000 ? num(chart.scale * tick / 4000) + 'k' : num(chart.scale * tick / 4)}</text></g>)}</g>}
          {timeView === 'cumulative' && <g className="chronicle-cumulative-scene">
            {years.map((year, index) => <g key={year}><rect x={chart.dateX(iso(Date.UTC(year, 8, 9)))} y={chart.top} width={Math.max(1, chart.dateX(iso(Date.UTC(year, 10, 10))) - chart.dateX(iso(Date.UTC(year, 8, 9))))} height={chart.bottom - chart.top} fill={COLORS[index]} opacity=".025"/><line x1={chart.dateX(iso(Date.UTC(year, 8, 9)))} x2={chart.dateX(iso(Date.UTC(year, 8, 9)))} y1={chart.top} y2={chart.bottom} stroke={COLORS[index]} strokeOpacity=".2" strokeDasharray="2 5"/></g>)}
            <g opacity=".22">{chart.ribbons.map((ribbon, index) => <g key={ribbon.year}><path d={ribbon.area} fill={'url(#' + id + '-ribbon-' + ribbon.year + ')'}/><path d={ribbon.line} fill="none" stroke={COLORS[index]} strokeWidth="1"/></g>)}</g>
            <g clipPath={'url(#' + id + '-past)'}>{chart.ribbons.map((ribbon, index) => <g key={ribbon.year}><path d={ribbon.area} fill={'url(#' + id + '-ribbon-' + ribbon.year + ')'}/><path d={ribbon.line} fill="none" stroke={COLORS[index]} strokeWidth="8" opacity=".18" filter={'url(#' + id + '-glow)'}/><path d={ribbon.line} fill="none" stroke={COLORS[index]} strokeWidth="1.8"/></g>)}</g>
            {joins.map(row => <circle key={row.date} cx={chart.dateX(row.date)} cy={chart.y(row.cumulativeLearners)} r={compact ? 1.2 : 1.8} fill={COLORS[years.indexOf(row.year)]} opacity={row.date <= date ? .85 : .18}/>) }
            {filters.cohort !== 'all' && <path d={chart.selectedPath} fill="none" stroke="#f4f5f1" strokeWidth="2" strokeDasharray="5 5"/>}
            <line x1={chart.dateX(date)} x2={chart.dateX(date)} y1={chart.top - 10} y2={chart.bottom + 55} className="chronicle-date-beam"/>
            <line x1={chart.dateX(date)} x2={chart.dateX(date)} y1={chart.top} y2={chart.bottom} stroke="#d6f6ef" strokeWidth="1" strokeDasharray="3 5" opacity=".55"/>
            <g key={date} className="chronicle-cursor-focus"><circle cx={chart.dateX(date)} cy={chart.y(contextJoined)} r="13" fill="#99f0db" opacity=".12"/><circle cx={chart.dateX(date)} cy={chart.y(contextJoined)} r="4.5" fill="#dbfff5"/></g>
            <g className="chronicle-arrival-floor">{joins.map(row => <line key={row.date} x1={chart.dateX(row.date)} x2={chart.dateX(row.date)} y1="366" y2={366 - row.newLearners / fullDayPeak * 28} stroke={COLORS[years.indexOf(row.year)]} strokeWidth={compact ? .9 : 1.6} opacity={row.date <= date ? .75 : .15}/>) }<text x={chart.left} y="386">DAILY ARRIVALS</text><text x={chart.right} y="386" textAnchor="end">0–{num(fullDayPeak)} / day</text></g>
            {years.slice(0, -1).map(year => { const x = (chart.dateX(iso(Date.UTC(year, 10, 10))) + chart.dateX(iso(Date.UTC(year + 1, 8, 9)))) / 2; return <text key={year} x={x} y="24" textAnchor="middle" className="chronicle-gap-label">{compact ? 'quiet months' : 'ZERO-JOIN GAP'}</text>; })}
            {years.map(year => <text key={year} x={clamp(chart.dateX(iso(Date.UTC(year, 8, 9))), chart.left + 13, chart.right - 13)} y="410" textAnchor="middle" className="chronicle-year-axis">{year}</text>)}
          </g>}
          {timeView === 'season' && <g className="chronicle-season-scene">
            {chart.seasonPaths.map((season, index) => <g key={season.year}><path d={season.path + ' V ' + chart.bottom + ' H ' + chart.left + ' Z'} fill={'url(#' + id + '-ribbon-' + season.year + ')'} opacity=".45"/><path d={season.path} fill="none" stroke={COLORS[index]} strokeWidth="7" opacity=".18" filter={'url(#' + id + '-glow)'}/><path d={season.path} fill="none" stroke={COLORS[index]} strokeWidth={season.year === activeYear ? '2.4' : '1.6'} opacity={season.year === activeYear ? '1' : '.7'}/>{seasonWithinRange && <circle cx={chart.dayX(seasonDay)} cy={season.pointY} r={season.year === activeYear ? '5' : '3'} fill={COLORS[index]}/>}</g>)}
            {seasonWithinRange && <line x1={chart.dayX(seasonDay)} x2={chart.dayX(seasonDay)} y1={chart.top - 10} y2={chart.bottom + 12} className="chronicle-date-beam"/>}
            {[0, 14, 28, 42, 62].map(day => <g key={day}><line x1={chart.dayX(day)} x2={chart.dayX(day)} y1={chart.top} y2={chart.bottom} stroke="#50637e" strokeOpacity=".22"/><text x={chart.dayX(day)} y="352" textAnchor="middle">{compact ? 'D' + day : 'DAY ' + day}</text></g>)}
            <text x={chart.left} y="385" className="chronicle-axis-note">SEP 9 / DAY 0</text><text x={chart.right} y="385" textAnchor="end" className="chronicle-axis-note">NOV 10 / DAY 62</text>
          </g>}
          {timeView !== 'daily' && chart.labels.map(label => { const index = years.indexOf(label.year), labelX = compact ? chart.right - 9 : chart.right + 14; return <g key={label.year} className="chronicle-direct-label"><path d={'M ' + chart.right + ' ' + label.anchor + ' L ' + (compact ? chart.right - 5 : chart.right + 8) + ' ' + label.y} fill="none" stroke={COLORS[index]} strokeOpacity=".5"/><text x={labelX} y={label.y - 2} style={{ fill: COLORS[index] }} textAnchor={compact ? 'end' : 'start'}>{label.year}<tspan x={labelX} dy="15">{num(label.total)}</tspan></text></g>; })}
          {timeView === 'daily' && <g className="chronicle-daily-scene">{seasons.map((season, index) => {
            const laneTop = chart.laneTop + index * (chart.laneHeight + chart.laneGap), baseline = laneTop + chart.laneHeight;
            const pulseY = (count: number) => baseline - count / chart.dailyScale * (chart.laneHeight - 27);
            const profile = chronicleStepPath(season.rows.map(row => ({ x: chart.dayX(row.day), y: pulseY(row.arrivals) })), chart.right, baseline);
            const currentDay = activeYear === season.year && seasonWithinRange ? seasonDay : null;
            return <g key={season.year}><text x={chart.left} y={laneTop - 10} style={{ fill: COLORS[index] }} className="chronicle-lane-year">{season.year}<tspan dx="12" className="chronicle-lane-total">{num(season.total)} records</tspan></text><line x1={chart.left} x2={chart.right} y1={baseline} y2={baseline} stroke={COLORS[index]} strokeOpacity=".25"/><path d={profile + ' V ' + baseline + ' H ' + chart.left + ' Z'} fill={'url(#' + id + '-ribbon-' + season.year + ')'} opacity=".45"/>{season.rows.map(row => <g key={row.date}><line x1={chart.dayX(row.day)} x2={chart.dayX(row.day)} y1={baseline} y2={pulseY(row.arrivals)} stroke={COLORS[index]} strokeWidth={compact ? 1.6 : 3} opacity={row.date <= date ? .9 : .2}/>{row.arrivals > 0 && <circle cx={chart.dayX(row.day)} cy={pulseY(row.arrivals)} r={compact ? 1.2 : 2} fill={COLORS[index]} opacity={row.date <= date ? .9 : .25}/>}<title>{row.date + ': ' + num(row.arrivals) + ' context joins; ' + num(row.selectedArrivals) + ' selected joins'}</title></g>)}{currentDay !== null && <g key={date} className="chronicle-cursor-focus"><line x1={chart.dayX(currentDay)} x2={chart.dayX(currentDay)} y1={laneTop - 5} y2={baseline + 5} stroke="#f4faff" strokeOpacity=".6" strokeDasharray="2 4"/><circle cx={chart.dayX(currentDay)} cy={pulseY(season.rows[currentDay].arrivals)} r="5" fill="#eafff9"/></g>}<text x={compact ? chart.left - 6 : chart.right + 12} y={laneTop + 30} textAnchor={compact ? 'end' : 'start'} className="chronicle-lane-scale">{num(chart.dailyScale)}</text><text x={compact ? chart.left - 6 : chart.right + 12} y={baseline + 3} textAnchor={compact ? 'end' : 'start'} className="chronicle-lane-scale">0</text></g>;
          })}{[0, 14, 28, 42, 62].map(day => <text key={day} x={chart.dayX(day)} y="405" textAnchor="middle">{compact ? 'D' + day : 'DAY ' + day}</text>)}</g>}
        </svg>
        <div className="chronicle-scene-status"><span><i style={{ background: COLORS[years.indexOf(activeYear)] ?? COLORS[0] }}/>{pretty(date)}</span><span>{timeView === 'season' ? seasonWithinRange ? 'Day ' + seasonDay + ' of 62' : 'Cursor is between enrollment seasons' : num(contextDayJoins) + ' context joins on this date'}{filters.cohort !== 'all' && ' · ' + num(dayJoins) + ' selected'}</span></div>
        <p className="chronicle-chart-definition">{modeDescription}{filters.cohort !== 'all' && ' Graphs retain the other cohorts as context; the headline follows your selected cohort.'}{filters.cohort !== 'all' && timeView === 'cumulative' && ' The white dashed trace isolates that selection.'}</p>
      </div>}
      <div className="chronicle-season-strip">{seasons.map((season, index) => {
        const complete = season.rows.filter(row => row.date <= date).at(-1)?.cumulative ?? 0;
        return <button key={season.year} onClick={() => checkpoint(season.year)} aria-label={'Show cumulative enrollment through ' + season.year} style={{ '--season-color': COLORS[index] } as React.CSSProperties}><div><span>{season.year} COHORT</span><strong>{num(season.total)}</strong><small>Independent cohort total</small></div><svg viewBox="0 0 150 44" aria-hidden="true">{season.rows.map(row => <line key={row.day} x1={row.day / 62 * 148 + 1} x2={row.day / 62 * 148 + 1} y1="41" y2={41 - row.arrivals / fullDayPeak * 35} stroke={COLORS[index]} strokeWidth="1.3" opacity={row.date <= date ? .85 : .2}/> )}</svg><span className="chronicle-season-completion">{num(complete)} joined by cursor<span style={{ width: (season.total ? complete / season.total * 100 : 0) + '%' }}/></span></button>;
      })}</div>
      <div className="chronicle-playback"><button className="chronicle-play" disabled={!joins.length} onClick={replay} aria-label={playing ? 'Pause enrollment replay' : 'Replay enrollment timeline'}>{playing ? <Pause size={18}/> : <Play size={18}/>}<span>{playing ? 'Pause replay' : 'Replay the years'}</span></button><div className="chronicle-scrubber"><input type="range" min="0" max={Math.max(0, joins.length - 1)} value={activeIndex} disabled={!joins.length} onChange={event => selectDate(joins[Number(event.target.value)].date)} aria-label="Enrollment date cursor" aria-valuetext={pretty(date) + ' · ' + num(joined) + ' selected modeled joins accumulated'}/><div>{years.map(year => <span key={year}>{year}</span>)}</div></div><div className="chronicle-step-controls"><button onClick={() => moveDate(-1)} disabled={!joins.some(row => row.date < date)} aria-label="Previous occupied enrollment date"><ChevronLeft size={16}/></button><button onClick={() => moveDate(1)} disabled={!joins.some(row => row.date > date)} aria-label="Next occupied enrollment date"><ChevronRight size={16}/></button></div><label className="chronicle-date-input"><CalendarDays size={15}/><input type="date" min={span.start} max={end} value={date} onChange={event => selectDate(event.target.value)} aria-label="Exact enrollment as-of date"/></label><button className="chronicle-reset" onClick={() => selectDate(end)} aria-label="Show complete modeled enrollment period"><RotateCcw size={17}/></button></div>
      <div className="chronicle-replay-meter"><div className="chronicle-replay-progress"><span style={{ width: progress * 100 + '%' }}/></div><p><i className={playing ? 'is-playing' : ''}/>{playing ? 'REPLAYING' : 'CURSOR PAUSED'}<span>{Math.max(0, throughIndex + 1)} / {joins.length} occupied enrollment dates</span></p><label>Replay pace<select aria-label="Enrollment replay pace" value={speed} onChange={event => setSpeed(Number(event.target.value))}><option value="280">Read · 0.5×</option><option value="140">Flow · 1×</option><option value="70">Fast · 2×</option></select></label></div>
      <div className="chronicle-disclosure"><span>{date > today ? date === end ? 'FULL MODEL PERIOD · INCLUDES FUTURE MODELED ENROLLMENT' : 'FUTURE MODELED AS-OF VIEW · EVERY RECORD IS SYNTHETIC' : 'MODELED AS-OF VIEW · EVERY RECORD IS SYNTHETIC'}</span><button onClick={() => selectDate(today < span.start ? span.start : today > end ? end : today)}>View today’s date</button><button onClick={() => onQuietChange(!quiet)}>{quiet ? 'Enable motion' : 'Still mode'}</button></div>
      <p className="exploration-note">Replay advances through recorded enrollment dates and skips zero-join dates. Cumulative totals count enrollment records across cohorts; unique people across years cannot be verified from this source. The 2027 cohort remains sealed.{reduced && ' OS reduced motion is active; ribbon and cursor effects are still.'}</p>
    </section>
    <StudentField dataset={dataset} filters={filters} date={date} scene={scene} onSceneChange={setScene} quiet={quiet}/>
  </div>;
}
