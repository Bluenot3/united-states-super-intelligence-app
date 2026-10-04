import { useEffect, useId, useRef, useState } from 'react';
import { Table2, ChartNoAxesCombined } from 'lucide-react';

export interface CohortPoint { year: string | number; students: number; deployed: number; capstones: number; }
const number = new Intl.NumberFormat('en-US');
export default function CohortChart({ rows, onSelect, selected = 'all', overview = false }: { rows: CohortPoint[]; onSelect?: (year: string) => void; selected?: string; overview?: boolean }) {
  const id = useId().replace(/:/g, '');
  const [table, setTable] = useState(false);
  const [metric, setMetric] = useState<'students' | 'deployed'>('students');
  const [inspected, setInspected] = useState<number | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(880);
  useEffect(() => {
    if (!frameRef.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(300, entry.contentRect.width)));
    observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, [table]);
  const peak = Math.max(1, ...rows.map(r => r.students));
  const step = Math.pow(10, Math.floor(Math.log10(peak))) / 2;
  const max = overview ? Math.max(20000, peak) : Math.ceil(peak / step) * step;
  const left = width < 500 ? 35 : 54, right = width - 28, top = 28, bottom = overview ? 185 : 250;
  const x = (i: number) => left + i * (right - left) / Math.max(1, rows.length - 1);
  const y = (n: number) => bottom - n / max * (bottom - top);
  const series = [{ key: 'students' as const, label: 'Learners', color: 'var(--accent)' }, { key: 'deployed' as const, label: 'Live URLs', color: 'var(--chart-2)' }, { key: 'capstones' as const, label: 'Capstones', color: 'var(--chart-3)' }];
  return <section className={`panel cohort-chart ${overview ? 'cohort-chart--overview' : ''}`} aria-label="Modeled cohort growth">
    <div className="panel-heading"><div><h2>{overview ? 'The impact, over time.' : 'Cohort growth'}</h2><p>{overview ? 'A growing capacity to turn understanding into something real.' : 'Modeled learners, live URLs, and capstones by cohort.'}</p></div>
      <div className="chart-controls">{overview && <div className="segmented"><button aria-pressed={metric === 'students'} onClick={() => setMetric('students')}>Learners</button><button aria-pressed={metric === 'deployed'} onClick={() => setMetric('deployed')}>Deployments</button></div>}
        <button className="icon-button" aria-label={table ? 'Show cohort chart' : 'Show cohort table'} onClick={() => setTable(!table)}>{table ? <ChartNoAxesCombined size={17}/> : <Table2 size={17}/>}</button>
      </div>
    </div>
    {table ? <div className="table-scroll"><table><caption>Modeled outcomes by cohort. Cohort totals remain visible for comparison.</caption><thead><tr><th>Cohort</th>{series.map(s => <th key={s.key}>{s.label}</th>)}</tr></thead><tbody>{rows.map(r => <tr key={r.year}><th>{r.year}</th>{series.map(s => <td key={s.key}>{number.format(r[s.key])}</td>)}</tr>)}</tbody></table></div> : <div className="chart-frame" ref={frameRef}>
      <svg viewBox={`0 0 ${width} ${bottom + 38}`} style={{height:bottom+38}} role="img" aria-label="Cohort growth from 2024 to 2026. Select a point to filter its cohort.">
        <defs>{series.map((s,i) => <linearGradient key={s.key} id={`${id}-${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={s.color} stopOpacity=".3"/><stop offset="100%" stopColor={s.color} stopOpacity=".03"/></linearGradient>)}</defs>
        {[0, .25, .5, .75, 1].map(f => <g key={f}><line x1={left} x2={right + 5} y1={y(max * f)} y2={y(max * f)} className="chart-grid"/><text x={left - 12} y={y(max * f) + 4} textAnchor="end" className="axis-label">{max >= 1000 ? `${max * f / 1000}k` : Number((max * f).toFixed(1))}</text></g>)}
        {series.slice().reverse().map((s) => { const i=series.indexOf(s); const points=rows.map((r,j) => `${x(j)},${y(r[s.key])}`).join(' '); return <g key={s.key} opacity={overview && s.key !== metric ? .47 : 1}><path d={`M${left},${bottom} L${points.replaceAll(' ', ' L')} L${right},${bottom} Z`} fill={`url(#${id}-${i})`}/><polyline points={points} fill="none" stroke={s.color} strokeWidth={s.key === metric ? 2.5 : 1.5}/>{rows.map((r,j) => <circle key={r.year} cx={x(j)} cy={y(r[s.key])} r="4.5" fill={s.color} stroke="var(--surface)" strokeWidth="2"/>)}</g>; })}
        {rows.map((r,i) => <g key={r.year}><line x1={x(i)} x2={x(i)} y1={top} y2={bottom} className="chart-grid" strokeDasharray="3 5"/><text x={x(i)} y={bottom + 26} className="axis-label" textAnchor="middle">{r.year}</text><text x={x(i)} y={y(r[metric]) - 13} textAnchor="middle" className="point-label">{number.format(r[metric])}</text><rect x={x(i)-25} y={top-15} width="50" height={bottom-top+50} fill="transparent" tabIndex={0} role="button" aria-label={`${r.year}: ${number.format(r.students)} modeled learners, ${number.format(r.deployed)} live URLs, ${number.format(r.capstones)} capstones. Select cohort.`} onMouseEnter={() => setInspected(i)} onMouseLeave={() => setInspected(null)} onFocus={() => setInspected(i)} onBlur={() => setInspected(null)} onClick={() => onSelect?.(String(r.year))} onKeyDown={e => {if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect?.(String(r.year));}}} className={selected === String(r.year) ? 'selected-point' : ''}/></g>)}
      </svg>
      {inspected !== null && rows[inspected] && <div className="chart-tooltip" role="status"><strong>{rows[inspected].year} cohort</strong><span>{number.format(rows[inspected].students)} learners · {number.format(rows[inspected].deployed)} live URLs · {number.format(rows[inspected].capstones)} capstones</span></div>}
    </div>}
    <div className="chart-footer"><div className="chart-legend">{series.map(s => <span key={s.key}><i style={{background:s.color}}/>{s.label}</span>)}</div><span className="source-label">Modeled · 2024–2026</span></div>
  </section>;
}
