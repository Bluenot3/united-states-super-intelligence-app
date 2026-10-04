import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CalendarDays, Copy, Pause, Play, RotateCcw, Table2 } from 'lucide-react';
import { enrollmentTimestamp, exploreImpact, selectOutcomeRecords } from '../lib/impact-exploration';
import type { OutcomeFilters, OutcomesDataset } from '../lib/outcomes';
import StudentField, { type FieldScene } from './StudentField';
import '../impact-exploration.css';

type TimeView = 'cumulative' | 'daily' | 'season';
const COLORS = ['#cfae73', '#77bdb5', '#b3a3ed'];
const num = (value: number) => value.toLocaleString('en-US');
const pretty = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const query = (key: string) => new URLSearchParams(location.search).get(key);
const writeQuery = (values: Record<string, string>) => { const url = new URL(location.href); Object.entries(values).forEach(([key, value]) => url.searchParams.set(key, value)); history.replaceState(null, '', url); };

export default function ImpactChronicle({ dataset, filters, onFiltersChange, quiet, onQuietChange, exploration }: {
  dataset: OutcomesDataset; filters: OutcomeFilters; onFiltersChange: (filters: OutcomeFilters) => void;
  quiet: boolean; onQuietChange: (quiet: boolean) => void;
  exploration: ReturnType<typeof exploreImpact>;
}) {
  const span = useMemo(() => {
    let min = Infinity, max = -Infinity;
    for (const index of selectOutcomeRecords(dataset)) { const timestamp = enrollmentTimestamp(dataset, index); min = Math.min(min, timestamp); max = Math.max(max, timestamp); }
    return { start: new Date(min).toISOString().slice(0, 10), end: new Date(max).toISOString().slice(0, 10) };
  }, [dataset]);
  const joins = useMemo(() => exploration.timeline.filter(row => row.newLearners > 0), [exploration]);
  const initialDate = query('date');
  const [date, setDate] = useState(() => initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate) && Number.isFinite(Date.parse(`${initialDate}T00:00:00Z`)) && new Date(`${initialDate}T00:00:00Z`).toISOString().slice(0, 10) === initialDate && initialDate >= span.start && initialDate <= span.end ? initialDate : span.end);
  const [playing, setPlaying] = useState(false);
  const [timeView, setTimeView] = useState<TimeView>(() => ['daily', 'season'].includes(query('time') || '') ? query('time') as TimeView : 'cumulative');
  const [scene, setScene] = useState<FieldScene>(() => ['cohorts', 'ladder', 'learning'].includes(query('scene') || '') ? query('scene') as FieldScene : 'chronology');
  const [table, setTable] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState(false);
  const [width, setWidth] = useState(950);
  const plot = useRef<HTMLDivElement>(null);
  const id = useId().replace(/:/g, '');
  const today = new Date().toISOString().slice(0, 10);
  const activeIndex = Math.max(0, joins.filter(row => row.date <= date).length - 1);
  const active = exploration.timeline.filter(row => row.date <= date).at(-1);
  const joined = active?.selectedCumulativeLearners ?? 0;
  const contextJoined = active?.cumulativeLearners ?? 0;
  const dayJoins = exploration.timeline.find(row => row.date === date)?.selectedNewLearners ?? 0;
  const end = span.end;
  useEffect(() => { writeQuery({ date, scene, time: timeView }); }, [date, scene, timeView]);
  useEffect(() => {
    if (!plot.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(300, entry.contentRect.width)));
    observer.observe(plot.current); return () => observer.disconnect();
  }, [table]);
  useEffect(() => { setPlaying(false); }, [filters]);
  useEffect(() => { if (quiet) setPlaying(false); }, [quiet]);
  useEffect(() => {
    if (!playing || quiet || document.hidden) return;
    const interval = window.setInterval(() => setDate(previous => {
      const next = joins.find(row => row.date > previous);
      if (!next) { setPlaying(false); return previous; }
      return next.date;
    }), 140);
    const stop = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener('visibilitychange', stop);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', stop); };
  }, [playing, joins, quiet]);
  const selectDate = (next: string) => { setPlaying(false); if (next >= span.start && next <= end) setDate(next); };
  const replay = () => { if (quiet) onQuietChange(false); if (playing) setPlaying(false); else { if (!joins.some(row => row.date > date)) setDate(joins[0]?.date ?? span.start); setPlaying(true); } };
  const copy = async () => { try { await navigator.clipboard.writeText(location.href); setCopied(true); setShareError(false); } catch { setCopied(false); setShareError(true); } };
  const chart = useMemo(() => {
    const left = width < 550 ? 45 : 60, right = width - 18, top = 28, bottom = 236;
    const minDate = Date.parse(`${span.start}T00:00:00Z`), maxDate = Date.parse(`${end}T00:00:00Z`);
    const dateX = (value: string) => left + (Date.parse(`${value}T00:00:00Z`) - minDate) / Math.max(1, maxDate - minDate) * (right - left);
    const seasonRows = [2024, 2025, 2026].map(year => {
      let cumulative = 0;
      return joins.filter(row => row.year === year).map(row => {
        cumulative += row.newLearners;
        return { date: row.date, year, value: cumulative, day: (Date.parse(`${row.date}T00:00:00Z`) - Date.UTC(year, 8, 9)) / 86400000 };
      });
    });
    const peak = timeView === 'daily' ? Math.max(1, ...joins.map(row => row.newLearners)) : timeView === 'season' ? Math.max(1, ...seasonRows.flat().map(row => row.value)) : Math.max(1, exploration.totalContext);
    const scale = peak > 1000 ? Math.ceil(peak / 5000) * 5000 : Math.ceil(peak / 100) * 100;
    const y = (value: number) => bottom - value / scale * (bottom - top);
    const step = (rows: { date: string; cumulativeLearners: number }[], through: string) => rows.length ? `M ${left} ${bottom} ${rows.map(row => `H ${dateX(row.date)} V ${y(row.cumulativeLearners)}`).join(' ')} H ${dateX(through)}` : '';
    return { left, right, top, bottom, dateX, scale, y, seasonRows, fullPath: step(exploration.timeline.filter(row => row.date <= end), end), activePath: step(exploration.timeline.filter(row => row.date <= date && row.date <= end), date), selectedPath: step(exploration.timeline.filter(row => row.date <= date && row.date <= end).map(row=>({...row,cumulativeLearners:row.selectedCumulativeLearners})), date) };
  }, [width, joins, exploration, date, timeView, end]);
  const checkpoint = (year: number) => { onFiltersChange({ ...filters, cohort: 'all' }); selectDate(`${year}-11-10`); };

  return <div className="impact-exploration">
    <section className="enrollment-chronicle" aria-labelledby="enrollment-chronicle-title">
      <div className="exploration-heading"><div><span className="exploration-eyebrow">01 / THE ENROLLMENT CHRONICLE</span><h2 id="enrollment-chronicle-title">Watch possibility gather.</h2><p>Exact modeled join dates. Three enrollment seasons. One growing story.</p></div><button className="chronicle-share" onClick={copy}><Copy size={15}/>{copied ? 'Link copied' : 'Share this view'}</button></div>
      {shareError&&<label className="chronicle-share-fallback">Copy this analysis link<input readOnly value={location.href} onFocus={event=>event.currentTarget.select()}/></label>}
      <div className="chronicle-topline"><div className="chronicle-main-reading"><span>MODELED ENROLLMENT RECORDS BY THIS DATE</span><strong data-testid="chronicle-total">{num(joined)}</strong><p>{filters.cohort === 'all' ? 'Cumulative across 2024–2026' : `${filters.cohort} cohort · ${num(contextJoined)} across the context cohorts`}</p></div><div className="chronicle-date-reading"><span>AS OF · UTC</span><strong>{pretty(date)}</strong><p><b>{num(dayJoins)}</b> modeled joins on this date</p></div><div className="chronicle-cohort-readings">{exploration.cohortStages.map((row, i) => <button key={row.year} onClick={() => checkpoint(row.year)} aria-label={`Show cumulative enrollment through ${row.year}`}><i style={{ background: COLORS[i] }}/><span>{row.year} cohort</span><strong>{num(row.students)}</strong><small>Independent cohort total</small></button>)}</div></div>
      <div className="chronicle-toolbar"><div role="group" aria-label="Enrollment chart view">{([{ id: 'cumulative', label: 'Cumulative growth' }, { id: 'daily', label: 'Daily arrivals' }, { id: 'season', label: 'Season comparison' }] as const).map(view => <button key={view.id} aria-pressed={timeView === view.id} onClick={() => setTimeView(view.id)}>{view.label}</button>)}</div><button aria-label={table ? 'Show enrollment chart' : 'Show enrollment table'} onClick={() => setTable(!table)}><Table2 size={16}/>{table ? 'Chart' : 'Data'}</button></div>
      {table ? <div className="chronicle-table table-scroll"><table><caption>Exact modeled enrollment dates. Cohort context respects build-track, jurisdiction and delivery filters.</caption><thead><tr><th>Date</th><th>Year</th><th>New joins · selected</th><th>Cumulative · selected</th><th>Cumulative · context</th></tr></thead><tbody>{joins.map(row => <tr key={row.date} className={row.date === date ? 'active-date-row' : ''}><th><button onClick={() => selectDate(row.date)}>{row.date}</button></th><td>{row.year}</td><td>{num(row.selectedNewLearners)}</td><td>{num(row.selectedCumulativeLearners)}</td><td>{num(row.cumulativeLearners)}</td></tr>)}</tbody></table></div> : <div className="chronicle-plot" ref={plot}>
        <svg viewBox={`0 0 ${width} 280`} role="img" aria-label={`${timeView} chart of exact modeled joins, 2024 through 2026. Selected date ${date}: ${num(joined)} selected enrollment records.`}>
          <defs><linearGradient id={`${id}-growth`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#77bdb5" stopOpacity=".4"/><stop offset="1" stopColor="#77bdb5" stopOpacity=".02"/></linearGradient></defs>
          {[0, .25, .5, .75, 1].map(fraction => <g key={fraction}><line x1={chart.left} x2={chart.right} y1={chart.y(chart.scale * fraction)} y2={chart.y(chart.scale * fraction)} className="chronicle-grid"/><text x={chart.left - 10} y={chart.y(chart.scale * fraction) + 4} textAnchor="end">{chart.scale >= 1000 ? `${chart.scale * fraction / 1000}k` : Math.round(chart.scale * fraction)}</text></g>)}
          {timeView === 'cumulative' && <><path d={chart.fullPath} fill="none" stroke="#78929c" strokeWidth="1.5" opacity=".3"/>{chart.activePath&&<path d={`${chart.activePath} V ${chart.bottom} H ${chart.left} Z`} fill={`url(#${id}-growth)`}/>}<path d={chart.activePath} fill="none" stroke="#8bd8c8" strokeWidth="2.5"/>{filters.cohort!=='all'&&<path d={chart.selectedPath} fill="none" stroke={COLORS[Number(filters.cohort)-2024]} strokeWidth="2.5" strokeDasharray="5 4"/>}<circle cx={chart.dateX(date)} cy={chart.y(contextJoined)} r="5" fill="#b7f0df"/><line x1={chart.dateX(date)} x2={chart.dateX(date)} y1={chart.top} y2={chart.bottom} className="chronicle-cursor"/></>}
          {timeView === 'daily' && joins.map(row => <rect key={row.date} x={chart.dateX(row.date) - 1} y={chart.y(row.newLearners)} width={Math.max(1.3, (chart.right - chart.left) / 820)} height={chart.bottom - chart.y(row.newLearners)} fill={COLORS[row.year - 2024]} opacity={row.date <= date ? .95 : .2}><title>{row.date}: {num(row.newLearners)} new modeled joins in context</title></rect>)}
          {timeView === 'season' && chart.seasonRows.map((rows, i) => <g key={i}><path d={`M ${chart.left} ${chart.bottom} ${rows.map(row => `H ${chart.left + row.day / 62 * (chart.right - chart.left)} V ${chart.y(row.value)}`).join(' ')}`} fill="none" stroke={COLORS[i]} strokeWidth="2.5"/><text x={chart.right - 8} y={chart.y(rows.at(-1)?.value || 0) - 9} textAnchor="end" fill={COLORS[i]}>{2024 + i} · {num(rows.at(-1)?.value || 0)}</text></g>)}
          {(timeView === 'season' ? [0, 14, 28, 42, 62] : [2024, 2025, 2026]).map(value => <text key={value} x={timeView === 'season' ? chart.left + value / 62 * (chart.right - chart.left) : Math.max(chart.left + 18, chart.dateX(`${value}-09-09`))} y="265" textAnchor="middle">{timeView === 'season' ? `Day ${value}` : `${value}`}</text>)}
        </svg>
        <p className="chronicle-chart-definition">{timeView === 'season' ? 'Cumulative joins within each 63-day enrollment season. Day 0 = September 9. Curves show full modeled seasons.' : timeView === 'daily' ? 'Each vertical pulse is the exact count joining on that UTC date. Quiet gaps separate enrollment seasons.' : `Step height is cumulative modeled enrollment records across context cohorts. The bright trace ends at your selected date.${filters.cohort!=='all'?' The dashed trace isolates your selected cohort.':''}`}</p>
      </div>}
      <div className="chronicle-playback"><button className="chronicle-play" disabled={!joins.length} onClick={replay} aria-label={playing ? 'Pause enrollment replay' : 'Replay enrollment timeline'}>{playing ? <Pause size={18}/> : <Play size={18}/>}<span>{playing ? 'Pause replay' : 'Replay the years'}</span></button><div className="chronicle-scrubber"><input type="range" min="0" max={Math.max(0, joins.length - 1)} value={activeIndex} disabled={!joins.length} onChange={event => selectDate(joins[Number(event.target.value)].date)} aria-label="Enrollment date cursor" aria-valuetext={`${pretty(date)} · ${num(joined)} selected modeled joins accumulated`}/><div><span>SEP 2024</span><span>SEP 2025</span><span>NOV 2026</span></div></div><label className="chronicle-date-input"><CalendarDays size={15}/><input type="date" min={span.start} max={end} value={date} onChange={event => selectDate(event.target.value)} aria-label="Exact enrollment as-of date"/></label><button className="chronicle-reset" onClick={() => selectDate(end)} aria-label="Show complete modeled enrollment period"><RotateCcw size={17}/></button></div>
      <div className="chronicle-disclosure"><span>{date > today ? date === end ? 'FULL MODEL PERIOD · INCLUDES FUTURE MODELED ENROLLMENT' : 'FUTURE MODELED AS-OF VIEW · EVERY RECORD IS SYNTHETIC' : 'MODELED AS-OF VIEW · EVERY RECORD IS SYNTHETIC'}</span><button onClick={() => selectDate(today < span.start ? span.start : today > end ? end : today)}>View today’s date</button><button onClick={() => onQuietChange(!quiet)}>{quiet ? 'Enable motion' : 'Still mode'}</button></div>
      <p className="exploration-note">Replay follows the recorded enrollment dates and skips dates with zero joins. Cumulative totals count enrollment records across cohorts; unique people across years cannot be verified from this source. 2027 remains sealed.</p>
    </section>
    <StudentField dataset={dataset} filters={filters} date={date} scene={scene} onSceneChange={setScene} quiet={quiet}/>
  </div>;
}
