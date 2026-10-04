import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowDownUp, ArrowRight, ChevronLeft, ChevronRight, Layers3, Map, Network, ScanLine, Table2 } from 'lucide-react';
import { ASSESSMENT_CONSTRUCTS, TIER_LABELS, type OutcomeFilters, type OutcomeSummary, type OutcomesDataset } from '../lib/outcomes';
import { exploreImpact } from '../lib/impact-exploration';
import '../impact-atlas.css';

export interface ImpactAtlasProps {
  dataset: OutcomesDataset;
  summary: OutcomeSummary;
  filters: OutcomeFilters;
  onFiltersChange: (filters: OutcomeFilters) => void;
  exploration?: ReturnType<typeof exploreImpact>;
}

type Exploration = ReturnType<typeof exploreImpact>;
const number = (value: number) => value.toLocaleString('en-US');
const percent = (value: number | null) => value === null ? '—' : `${(value * 100).toFixed(1)}%`;
const short = (value: number) => value >= 10000 ? `${(value / 1000).toFixed(0)}k` : number(value);
const palette = ['var(--accent)', 'var(--chart-2)', 'var(--chart-3)', 'color-mix(in srgb, var(--accent) 55%, var(--chart-2))', 'color-mix(in srgb, var(--chart-2) 55%, var(--ink))'];
const tabs = [
  { id: 'flow', label: 'Capability flows', icon: Network },
  { id: 'learning', label: 'Learning landscape', icon: ArrowDownUp },
  { id: 'hosting', label: 'Hosting fabric', icon: Layers3 },
  { id: 'geography', label: 'Geographic reach', icon: Map },
  { id: 'sites', label: 'Site fingerprints', icon: ScanLine },
] as const;
type TabId = (typeof tabs)[number]['id'];

function useChartWidth() {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(700);
  useEffect(() => {
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(260, entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return { ref: setElement, width };
}

function DataTable({ headers, rows, caption }: { headers: string[]; rows: ReactNode[][]; caption: string }) {
  return <div className="atlas-table-wrap"><table className="atlas-table"><caption>{caption}</caption><thead><tr>{headers.map((header) => <th scope="col" key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => cellIndex === 0 ? <th scope="row" key={cellIndex}>{cell}</th> : <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

function ChartKey({ labels, onSelect, activeIndex }: { labels: string[]; onSelect?: (index: number) => void; activeIndex?: number }) {
  return <div className="atlas-chart-key">{labels.map((label, index) => onSelect ? <button key={label} aria-pressed={activeIndex === index} onClick={() => onSelect(index)}><i style={{ background: palette[index % palette.length] }} />{label}</button> : <span key={label}><i style={{ background: palette[index % palette.length] }} />{label}</span>)}</div>;
}

function activate(event: KeyboardEvent<SVGGElement>, action: () => void) {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); action(); }
}

function FlowView({ data, filters, onFiltersChange, showTable }: { data: Exploration; filters: OutcomeFilters; onFiltersChange: ImpactAtlasProps['onFiltersChange']; showTable: boolean }) {
  const { ref, width } = useChartWidth();
  const [selected, setSelected] = useState<{ track: number; tier: number } | null>(null);
  const mobile = width < 540;
  const top = 40, height = mobile ? 350 : 285;
  const dataHeight = height - 40, scale = dataHeight / Math.max(1, data.totalSelected);
  const left = mobile ? 67 : 170, right = width - (mobile ? 80 : 155), nodeWidth = 8;
  const tierCounts = TIER_LABELS.map((_, tier) => data.tracks.reduce((sum, track) => sum + track.tierCounts[tier], 0));
  const layoutNodes = (counts: number[]) => {
    let previous: { y: number; height: number } | undefined;
    return counts.map((count) => {
      const nodeHeight = count * scale;
      if (!count) return { y: previous ? previous.y + previous.height : top, height: 0 };
      const y = previous ? Math.max(previous.y + previous.height + 12, previous.y + previous.height / 2 + 40 - nodeHeight / 2) : top;
      const node = { y, height: nodeHeight };
      previous = node;
      return node;
    });
  };
  const trackNodes = layoutNodes(data.tracks.map((track) => track.students));
  const tierNodes = layoutNodes(tierCounts);
  const svgHeight = Math.max(height + 90, ...[...trackNodes, ...tierNodes].map((node) => node.y + node.height + 45));
  const offsets = tierNodes.map((node) => node.y);
  const ribbons: { track: number; tier: number; count: number; path: string }[] = [];
  data.tracks.forEach((track, trackIndex) => {
    let y0 = trackNodes[trackIndex].y;
    track.tierCounts.forEach((count, tier) => {
      const ribbonHeight = count * scale;
      const y1 = offsets[tier], control = (right - left) * .43;
      const path = `M${left + nodeWidth},${y0} C${left + nodeWidth + control},${y0} ${right - control},${y1} ${right},${y1} L${right},${y1 + ribbonHeight} C${right - control},${y1 + ribbonHeight} ${left + nodeWidth + control},${y0 + ribbonHeight} ${left + nodeWidth},${y0 + ribbonHeight} Z`;
      if (count) ribbons.push({ track: trackIndex, tier, count, path });
      y0 += ribbonHeight; offsets[tier] += ribbonHeight;
    });
  });
  const active = selected && ribbons.find((ribbon) => ribbon.track === selected.track && ribbon.tier === selected.tier);
  const inspect = active || [...ribbons].sort((a, b) => b.count - a.count)[0];
  const filterTrack = (index: number) => onFiltersChange({ ...filters, track: filters.track === data.tracks[index].name ? 'all' : data.tracks[index].name });
  const shortTracks = ['Agent', 'Data', 'Creative', 'Civic'];
  const shortTiers = ['None', 'Deployer', 'Builder', 'Operator', 'Pioneer'];
  return <div className="atlas-view atlas-flow-view">
    <div className="atlas-view-intro"><div><h3>Every path has a destination.</h3><p>Build track → modeled credential tier. Ribbon width is proportional to the exact number of learners.</p></div><span className="atlas-total"><strong>{number(data.totalSelected)}</strong>modeled learners</span></div>
    {showTable ? <DataTable caption="Track-to-tier counts under all active filters" headers={['Build track', ...TIER_LABELS, 'Total']} rows={[...data.tracks.map((track) => [track.name, ...track.tierCounts.map(number), number(track.students)]), ['All tracks', ...tierCounts.map(number), number(data.totalSelected)]]} /> : <div className="atlas-flow-frame" ref={ref}>
      <svg viewBox={`0 0 ${width} ${svgHeight}`} width={width} height={svgHeight} aria-label="Exact modeled learners flowing from build tracks to credential tiers">
        <text x={mobile ? 0 : left} y={18} className="atlas-axis-title">BUILD TRACK</text><text x={mobile ? width : right} y={18} textAnchor="end" className="atlas-axis-title">{mobile ? 'TIER' : 'CREDENTIAL TIER'}</text>
        {ribbons.map((ribbon) => <g key={`${ribbon.track}-${ribbon.tier}`} role="button" tabIndex={0} aria-label={`${data.tracks[ribbon.track].name} to ${TIER_LABELS[ribbon.tier]}: ${number(ribbon.count)} modeled learners`} onClick={() => setSelected(ribbon)} onFocus={() => setSelected(ribbon)} onKeyDown={(event) => activate(event, () => setSelected(ribbon))} className="atlas-ribbon-target"><path d={ribbon.path} fill={palette[ribbon.track]} fillOpacity={active ? (active.track === ribbon.track && active.tier === ribbon.tier ? .85 : .14) : .35} className="atlas-ribbon" /><path d={ribbon.path} fill="transparent" stroke="transparent" strokeWidth={10} /><title>{`${data.tracks[ribbon.track].name} → ${TIER_LABELS[ribbon.tier]} · ${number(ribbon.count)}`}</title></g>)}
        {data.tracks.map((track, index) => track.students > 0 && <g key={track.name} className="atlas-flow-node" role="button" tabIndex={0} aria-label={`${track.name}: ${number(track.students)} learners. ${filters.track === track.name ? 'Clear' : 'Apply'} build-track filter.`} onClick={() => filterTrack(index)} onKeyDown={(event) => activate(event, () => filterTrack(index))}><rect x={left} y={trackNodes[index].y} width={nodeWidth} height={Math.max(1, trackNodes[index].height)} fill={palette[index]} /><text x={left - 12} y={trackNodes[index].y + Math.max(0, trackNodes[index].height) / 2 - 4} textAnchor="end">{mobile ? shortTracks[index] : track.name}</text><text x={left - 12} y={trackNodes[index].y + Math.max(0, trackNodes[index].height) / 2 + 15} textAnchor="end" className="atlas-count-label">{number(track.students)}</text></g>)}
        {tierCounts.map((count, tier) => count > 0 && <g key={tier}><rect x={right} y={tierNodes[tier].y} width={nodeWidth} height={Math.max(1, tierNodes[tier].height)} fill="var(--ink)" opacity={.45} /><text x={right + 17} y={tierNodes[tier].y + tierNodes[tier].height / 2 - 4}>{mobile ? shortTiers[tier] : TIER_LABELS[tier]}</text><text x={right + 17} y={tierNodes[tier].y + tierNodes[tier].height / 2 + 15} className="atlas-count-label">{number(count)}</text></g>)}
      </svg>
    </div>}
    <div className="atlas-inspector" aria-live="polite">{inspect ? <><span className="atlas-inspector-kicker">PATH INSPECTION</span><span>{data.tracks[inspect.track].name}<ArrowRight size={14} aria-hidden="true" />{TIER_LABELS[inspect.tier]}</span><strong>{number(inspect.count)} learners <small>{percent(inspect.count / Math.max(1, data.totalSelected))} of this view</small></strong></> : <span>No paths under these filters.</span>}</div>
    <div className="atlas-track-buttons">{data.tracks.map((track, index) => <button key={track.name} aria-pressed={filters.track === track.name} onClick={() => filterTrack(index)}><i style={{ background: palette[index] }} />{track.name}</button>)}</div>
    <p className="atlas-caveat">Tap a ribbon to inspect it, or a track to filter the observatory. Every modeled learner appears once; credential tiers describe the source model and do not issue a credential.</p>
  </div>;
}

function LearningView({ data, showTable }: { data: Exploration; showTable: boolean }) {
  const { ref, width } = useChartWidth();
  const [construct, setConstruct] = useState('all');
  const [bin, setBin] = useState(25);
  const visible = data.constructs.filter((item) => construct === 'all' || item.key === construct);
  const peak = Math.max(1, ...data.constructs.flatMap((item) => [...item.preBins, ...item.postBins].map((item) => item.count)));
  const left = 12, plotWidth = width - 30;
  const height = construct === 'all' ? 98 : 170, baseline = height - 25, amplitude = baseline - 12;
  const ridge = (bins: Exploration['constructs'][number]['preBins']) => `M${left},${baseline} ${bins.map((item, index) => `L${left + (index + .5) / 50 * plotWidth},${baseline - item.count / peak * amplitude}`).join(' ')} L${left + plotWidth},${baseline} Z`;
  const inspectAt = (clientX: number, element: SVGSVGElement) => { const bounds = element.getBoundingClientRect(); setBin(Math.max(0, Math.min(49, Math.floor(((clientX - bounds.left) / bounds.width * width - left) / plotWidth * 50)))); };
  return <div className="atlas-view atlas-learning-view">
    <div className="atlas-view-intro"><div><h3>The shift beneath the average.</h3><p>Exact pre/post score distributions, in 2-point bins. All ridges share one count scale.</p></div><label className="atlas-select"><span>Construct</span><select value={construct} onChange={(event) => setConstruct(event.target.value)}><option value="all">All five constructs</option>{ASSESSMENT_CONSTRUCTS.map((item) => <option value={item.key} key={item.key}>{item.label}</option>)}</select></label></div>
    <div className="atlas-learning-key"><span><i className="is-before" />Before instruction</span><span><i className="is-after" />After instruction</span><small>{number(data.totalSelected)} modeled scores per series</small></div>
    {showTable ? <DataTable caption="Exact 2-point score-bin counts under all active filters; final bin includes 100" headers={['Construct', 'Score bin', 'Before', 'After']} rows={visible.flatMap((item) => item.preBins.map((scoreBin, index) => [item.label, `${scoreBin.from}–${scoreBin.to}${scoreBin.upperInclusive ? ' inclusive' : ' (upper excluded)'}`, number(scoreBin.count), number(item.postBins[index].count)]))} /> : <div className="atlas-ridges" ref={ref}>{visible.map((item) => <div className="atlas-ridge" key={item.key}><div className="atlas-ridge-heading"><h4>{item.label}</h4><span>Mean <b>{item.pre.mean === null ? '—' : item.pre.mean.toFixed(1)}</b><ArrowRight size={12} aria-hidden="true" /><b>{item.post.mean === null ? '—' : item.post.mean.toFixed(1)}</b></span></div><svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} tabIndex={0} role="group" aria-label={`${item.label} score distribution. Use left and right arrows to inspect 2-point bins.`} onPointerMove={(event) => inspectAt(event.clientX, event.currentTarget)} onClick={(event) => inspectAt(event.clientX, event.currentTarget)} onKeyDown={(event) => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); setBin((current) => event.key === 'Home' ? 0 : event.key === 'End' ? 49 : Math.max(0, Math.min(49, current + (event.key === 'ArrowRight' ? 1 : -1)))); } }}>
      {[0, 25, 50, 75, 100].map((tick) => <g key={tick}><line x1={left + tick / 100 * plotWidth} x2={left + tick / 100 * plotWidth} y1={5} y2={baseline} className="atlas-grid-line" /><text x={left + tick / 100 * plotWidth} y={height - 7} textAnchor="middle" className="atlas-axis-label">{tick}</text></g>)}
      <path d={ridge(item.preBins)} className="atlas-ridge-before" /><path d={ridge(item.postBins)} className="atlas-ridge-after" />
      <rect x={left + bin / 50 * plotWidth} y={4} width={plotWidth / 50} height={baseline - 4} className="atlas-bin-selection" />
    </svg></div>)}</div>}
    <div className="atlas-bin-inspector" aria-live="polite"><div><span className="atlas-inspector-kicker">BIN INSPECTION</span><strong>{bin * 2}–{bin * 2 + 2} points{bin === 49 ? ' · includes 100' : ' · upper bound excluded'}</strong></div>{visible.map((item) => <div key={item.key}><span>{item.label}</span><p><b>{number(item.preBins[bin].count)}</b> before <ArrowRight size={12} aria-hidden="true" /><b>{number(item.postBins[bin].count)}</b> after</p></div>)}</div>
    <p className="atlas-caveat">Height encodes the count in a 2-point score bin. Inspect with tap, pointer, or arrow keys. These are generated scores without a comparison group; the shift is descriptive and provides no causal evidence.</p>
  </div>;
}

function HostingView({ data, filters, onFiltersChange, showTable }: { data: Exploration; filters: OutcomeFilters; onFiltersChange: ImpactAtlasProps['onFiltersChange']; showTable: boolean }) {
  const [mode, setMode] = useState<'count' | 'share'>('count');
  const [selected, setSelected] = useState<{ year: number; host: number } | null>(null);
  const max = Math.max(1, ...data.cohortHosting.map((row) => row.deployed));
  const total = data.cohortHosting.reduce((sum, row) => sum + row.deployed, 0);
  const active = selected && data.cohortHosting.find((row) => row.year === selected.year);
  return <div className="atlas-view atlas-hosting-view">
    <div className="atlas-view-intro"><div><h3>Where the work takes root.</h3><p>Hosting composition among S2+ deployed projects, using the source’s five hosting categories.</p></div><div className="atlas-switch" aria-label="Hosting display"><button aria-pressed={mode === 'count'} onClick={() => setMode('count')}>App counts</button><button aria-pressed={mode === 'share'} onClick={() => setMode('share')}>Share</button></div></div>
    <ChartKey labels={data.hosting.map((host) => host.name)} activeIndex={selected?.host} onSelect={(host) => setSelected({ host, year: selected?.year ?? (filters.cohort !== 'all' && filters.cohort !== '2027' ? Number(filters.cohort) : data.cohortHosting.at(-1)?.year ?? 2026) })} />
    {showTable ? <DataTable caption="Exact deployed-project counts by cohort and source hosting category; cohort filter does not hide context" headers={['Cohort', ...data.hosting.map((host) => host.name), 'Total deployed']} rows={data.cohortHosting.map((row) => [String(row.year), ...row.counts.map(number), number(row.deployed)])} /> : <div className="atlas-hosting-bars">{data.cohortHosting.map((row) => <div className={`atlas-hosting-row${row.selected ? ' is-selected' : ''}`} key={row.year}><button className="atlas-cohort-label" aria-pressed={filters.cohort === String(row.year)} onClick={() => onFiltersChange({ ...filters, cohort: filters.cohort === String(row.year) ? 'all' : String(row.year) as OutcomeFilters['cohort'] })}><strong>{row.year}</strong><span>{number(row.deployed)} apps</span></button><div className="atlas-hosting-track">{row.counts.map((count, host) => count > 0 && <button key={host} className="atlas-hosting-segment" onClick={() => setSelected({ year: row.year, host })} aria-label={`${row.year}, ${data.hosting[host].name}: ${number(count)} apps, ${percent(row.deployed ? count / row.deployed : null)}`} style={{ width: `${count / (mode === 'share' ? Math.max(1, row.deployed) : max) * 100}%`, background: palette[host] }}><span>{mode === 'share' ? percent(count / Math.max(1, row.deployed)) : short(count)}</span></button>)}</div><span className="atlas-hosting-end">{mode === 'share' ? (row.deployed ? '100%' : '—') : number(row.deployed)}</span></div>)}<div className="atlas-hosting-axis"><span>0</span><span>{mode === 'share' ? '50%' : number(Math.round(max / 2))}</span><span>{mode === 'share' ? '100%' : number(max)}</span></div></div>}
    <div className="atlas-inspector" aria-live="polite"><span className="atlas-inspector-kicker">{active && selected ? 'HOSTING INSPECTION' : 'COHORT CONTEXT'}</span>{active && selected ? <><span>{active.year} · {data.hosting[selected.host].name}</span><strong>{number(active.counts[selected.host])} apps <small>{percent(active.deployed ? active.counts[selected.host] / active.deployed : null)} of that cohort’s deployed apps</small></strong></> : <><span>All three published model cohorts</span><strong>{number(total)} deployed apps <small>under the other active filters</small></strong></>}</div>
    <p className="atlas-caveat">The cohort filter highlights a year while preserving the comparison. Build track, jurisdiction, and delivery filters apply. Tap a segment for its exact value or a hosting category to inspect it in the latest or selected cohort. Tap a cohort to filter. Managed-hosting shifts are source model assumptions.</p>
  </div>;
}

const usTiles: [string, number, number][] = [
  ['ME',11,0],['VT',10,1],['NH',11,1],['WA',0,2],['ID',1,2],['MT',2,2],['ND',3,2],['MN',4,2],['WI',5,2],['IL',6,2],['MI',7,2],['NY',9,2],['MA',10,2],
  ['OR',0,3],['NV',1,3],['WY',2,3],['SD',3,3],['IA',4,3],['IN',6,3],['OH',7,3],['PA',8,3],['NJ',9,3],['CT',10,3],['RI',11,3],
  ['CA',0,4],['UT',1,4],['CO',2,4],['NE',3,4],['MO',4,4],['KY',6,4],['WV',7,4],['MD',8,4],['DE',9,4],
  ['AZ',1,5],['NM',2,5],['KS',3,5],['AR',4,5],['TN',5,5],['VA',7,5],['NC',8,5],['DC',9,5],
  ['OK',3,6],['LA',4,6],['MS',5,6],['AL',6,6],['GA',7,6],['SC',8,6],['AK',0,7],['HI',1,7],['TX',3,7],['FL',8,7],
];

function GeographyView({ data, filters, onFiltersChange, showTable }: { data: Exploration; filters: OutcomeFilters; onFiltersChange: ImpactAtlasProps['onFiltersChange']; showTable: boolean }) {
  const [metric, setMetric] = useState<'students' | 'deployment'>('students');
  const [inspection, setInspection] = useState<string | null>(null);
  const rows = data.jurisdictions;
  const maximum = Math.max(1, ...rows.map((row) => row.students));
  const sorted = [...rows].sort((a, b) => b.students - a.students);
  const active = rows.find((row) => row.code === (inspection || filters.jurisdiction)) || sorted[0];
  const select = (code: string) => { setInspection(code); onFiltersChange({ ...filters, jurisdiction: filters.jurisdiction === code ? 'all' : code }); };
  const tile = (code: string, column?: number, rowIndex?: number) => {
    const row = rows.find((item) => item.code === code);
    const countRatio = (row?.students || 0) / maximum;
    const intensity = metric === 'students' ? countRatio : row?.deploymentRate || 0;
    const style = { gridColumn: column === undefined ? undefined : column + 1, gridRow: rowIndex === undefined ? undefined : rowIndex + 1, '--tile-intensity': `${12 + intensity * 48}%`, '--tile-height': `${countRatio * 65}%` } as CSSProperties;
    return <button style={style} className={`atlas-state-tile${filters.jurisdiction === code ? ' is-selected' : ''}${row ? '' : ' is-absent'}`} key={code} disabled={!row} aria-pressed={filters.jurisdiction === code} aria-label={row ? `${code}: ${number(row.students)} modeled learners, ${percent(row.deploymentRate)} deployed. Filter this jurisdiction.` : `${code}: no modeled records under the other filters`} onClick={() => select(code)} onFocus={() => setInspection(code)}><i /><span>{code}</span><strong>{row ? short(row.students) : '—'}</strong>{metric === 'deployment' && row && <small>{percent(row.deploymentRate)}</small>}</button>;
  };
  return <div className="atlas-view atlas-geography-view">
    <div className="atlas-view-intro"><div><h3>A national frame. A local view.</h3><p>Tile position is schematic. Bar height encodes learners; color shows the selected measure.</p></div><div className="atlas-switch" aria-label="Geography color measure"><button aria-pressed={metric === 'students'} onClick={() => setMetric('students')}>Learners</button><button aria-pressed={metric === 'deployment'} onClick={() => setMetric('deployment')}>Deployment rate</button></div></div>
    <div className="atlas-map-key"><span className="atlas-map-desktop-label">SCHEMATIC U.S. TILE MAP</span><span className="atlas-map-mobile-label">JURISDICTIONS / RANKED BY MODEL ENROLLMENT</span><div><i /><span>Low</span><b /><span>High</span></div><small>{rows.length} jurisdictions with modeled records</small></div>
    {showTable ? <DataTable caption="Jurisdiction context under all filters except the jurisdiction selection" headers={['Jurisdiction', 'Learners', 'S2+ deployed', 'Deployment rate', 'S7 capstones', 'Mean gain']} rows={sorted.map((row) => [row.code, number(row.students), number(row.deployed), percent(row.deploymentRate), number(row.capstones), row.meanGain === null ? '—' : `${row.meanGain.toFixed(1)} pts`])} /> : <><div className="atlas-us-map">{usTiles.map(([code, column, row]) => tile(code, column, row))}</div><div className="atlas-geography-mobile">{sorted.map((row) => tile(row.code))}</div></>}
    <div className="atlas-inspector" aria-live="polite"><span className="atlas-inspector-kicker">JURISDICTION INSPECTION</span>{active ? <><span>{active.code} · {number(active.students)} modeled learners</span><strong>{percent(active.deploymentRate)} deployed <small>{number(active.deployed)} of {number(active.students)} · {number(active.capstones)} capstones</small></strong></> : <span>No jurisdiction context for these filters.</span>}</div>
    <p className="atlas-caveat">Select a jurisdiction to filter the observatory. Context preserves other jurisdictions under the cohort, build-track, and delivery filters. Tiles do not show precise geography, actual partner locations, or observed program reach. Blank tiles have no records in this view.</p>
  </div>;
}

const siteMeasures = ['Deployment', 'Public launch', 'Capstone', 'Live at 90d', 'Score gain', 'Attendance'];
type Site = Exploration['sites'][number];
const siteValues = (site: Site) => [site.students ? site.deployed / site.students : 0, site.students ? site.launched / site.students : 0, site.students ? site.capstones / site.students : 0, site.deployed ? site.live90 / site.deployed : 0, Math.max(0, Math.min(1, (site.meanGain || 0) / 100)), site.attendanceRate || 0];

function SiteGlyph({ site, large = false }: { site: Site; large?: boolean }) {
  const values = siteValues(site), radius = large ? 77 : 40, center = large ? 100 : 50;
  const point = (index: number, ratio: number) => `${center + Math.sin(index * Math.PI / 3) * radius * ratio},${center - Math.cos(index * Math.PI / 3) * radius * ratio}`;
  return <svg viewBox={`0 0 ${center * 2} ${center * 2}`} className={`atlas-site-glyph${large ? ' is-large' : ''}`} aria-hidden="true">{[.25,.5,.75,1].map((ratio) => <polygon key={ratio} points={values.map((_, index) => point(index, ratio)).join(' ')} className="atlas-site-grid" />)}{values.map((_, index) => <line key={index} x1={center} y1={center} x2={center + Math.sin(index * Math.PI / 3) * radius} y2={center - Math.cos(index * Math.PI / 3) * radius} className="atlas-site-spoke" />)}<polygon points={values.map((ratio, index) => point(index, ratio)).join(' ')} className="atlas-site-shape" />{values.map((ratio, index) => <circle key={index} cx={center + Math.sin(index * Math.PI / 3) * radius * ratio} cy={center - Math.cos(index * Math.PI / 3) * radius * ratio} r={large ? 3 : 2} className="atlas-site-dot" />)}{large && values.map((_, index) => <text key={`axis-${index}`} x={center + Math.sin(index * Math.PI / 3) * radius * 1.15} y={center - Math.cos(index * Math.PI / 3) * radius * 1.15} textAnchor="middle" dominantBaseline="middle" className="atlas-site-axis-index">{index + 1}</text>)}</svg>;
}

function SitesView({ data, showTable }: { data: Exploration; showTable: boolean }) {
  const [query, setQuery] = useState('');
  const [order, setOrder] = useState<'students' | 'deployment'>('students');
  const [page, setPage] = useState(0);
  const [selection, setSelection] = useState<number | null>(null);
  const inspector = useRef<HTMLElement>(null);
  useEffect(() => {
    if (selection !== null && window.matchMedia('(max-width: 760px)').matches) inspector.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }, [selection]);
  const matching = useMemo(() => data.sites.filter((site) => `${site.code} ${site.state} ${site.network}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => order === 'students' ? b.students - a.students : b.deployed / Math.max(1,b.students) - a.deployed / Math.max(1,a.students)), [data.sites, query, order]);
  const pages = Math.max(1, Math.ceil(matching.length / 18)), currentPage = Math.min(page, pages - 1);
  const visible = matching.slice(currentPage * 18, (currentPage + 1) * 18);
  const active = matching.find((site) => site.siteIndex === selection) || matching[0];
  const values = active ? siteValues(active) : [];
  return <div className="atlas-view atlas-sites-view">
    <div className="atlas-view-intro"><div><h3>The shape of a learning community.</h3><p>Six defined measures form each site’s fingerprint. Every glyph is calculated from filtered source records.</p></div><span className="atlas-total"><strong>{number(data.sites.length)}</strong>synthetic sites in view</span></div>
    <div className="atlas-site-controls"><label><span>Find a synthetic site</span><input type="search" value={query} placeholder="Site code, network, jurisdiction" onChange={(event) => { setQuery(event.target.value); setPage(0); }} /></label><label className="atlas-select"><span>Order by</span><select value={order} onChange={(event) => { setOrder(event.target.value as typeof order); setPage(0); }}><option value="students">Learners in view</option><option value="deployment">Deployment rate</option></select></label></div>
    {showTable ? <DataTable caption="Synthetic site statistics under all active global filters and the local search" headers={['Synthetic site', 'Learners', 'Deployment', 'Public launch', 'Capstone', 'Live 90d / deployed', 'Mean gain', 'Attendance']} rows={matching.map((site) => [site.code, number(site.students), percent(site.deployed / Math.max(1,site.students)), percent(site.launched / Math.max(1,site.students)), percent(site.capstones / Math.max(1,site.students)), percent(site.deployed ? site.live90 / site.deployed : null), site.meanGain === null ? '—' : `${site.meanGain.toFixed(1)} pts`, percent(site.attendanceRate)])} /> : <div className="atlas-sites-layout"><div className="atlas-site-gridfield">{visible.map((site) => <button key={site.siteIndex} className={`atlas-site-button${active?.siteIndex === site.siteIndex ? ' is-selected' : ''}`} aria-pressed={active?.siteIndex === site.siteIndex} aria-label={`Inspect ${site.code}: ${number(site.students)} modeled learners`} onClick={() => setSelection(site.siteIndex)}><SiteGlyph site={site} /><strong>{site.code}</strong><span>{number(site.students)} learners · {percent(site.deployed / Math.max(1,site.students))} deployed</span></button>)}</div><aside className="atlas-site-inspector" ref={inspector} aria-live="polite">{active ? <><span className="atlas-inspector-kicker">LOCAL SITE INSPECTION</span><h4>{active.code}</h4><p>{active.network}<br />{active.state} · starts in {active.year}</p><SiteGlyph site={active} large /><dl>{siteMeasures.map((label, index) => <div key={label}><dt><i>{index + 1}</i>{label}</dt><dd>{index === 4 ? `${active.meanGain === null ? '—' : active.meanGain.toFixed(1)} pts` : index === 3 && !active.deployed ? '—' : percent(values[index])}</dd></div>)}</dl></> : <p>No synthetic sites match this search.</p>}</aside></div>}
    {!showTable && <div className="atlas-pagination"><span>{matching.length ? `${currentPage * 18 + 1}–${Math.min((currentPage + 1) * 18, matching.length)}` : '0'} of {number(matching.length)} sites</span><button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} aria-label="Previous site page"><ChevronLeft size={18} /></button><button disabled={currentPage >= pages - 1} onClick={() => setPage(currentPage + 1)} aria-label="Next site page"><ChevronRight size={18} /></button></div>}
    <p className="atlas-caveat">Clockwise from the top: deployment / all learners, public launch / all, capstone / all, live at 90 days / deployed, mean score gain / 100 points, and attendance / 24 sessions. All radial scales run 0–100%; negative gain is clipped at zero in the glyph. Site codes are synthetic and do not identify real clubs. Site selection is local inspection and does not change the global filters.</p>
  </div>;
}

export default function ImpactAtlas({ dataset, summary, filters, onFiltersChange, exploration }: ImpactAtlasProps) {
  const [tab, setTab] = useState<TabId>(() => {
    const requested = new URLSearchParams(window.location.search).get('atlas');
    return tabs.some((item) => item.id === requested) ? requested as TabId : 'flow';
  });
  const [showTable, setShowTable] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const data = useMemo(() => exploration ?? exploreImpact(dataset, filters), [exploration, dataset, filters]);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('atlas', tab);
    window.history.replaceState(window.history.state, '', url);
  }, [tab]);
  const chooseTab = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : null;
    if (next !== null) { event.preventDefault(); setTab(tabs[next].id); tabRefs.current[next]?.focus(); }
  };
  return <section className="impact-atlas panel" aria-labelledby="impact-atlas-title">
    <header className="atlas-header"><div><span className="eyebrow">THE ANALYTICAL ATLAS</span><h2 id="impact-atlas-title">Look closer.<br /><em>The pattern changes.</em></h2><p>Five ways to read the same source, from individual pathways to the infrastructure behind them.</p></div><div className="atlas-header-meta"><span className="modeled-label">SYNTHETIC / MODELED</span><strong>{number(summary.students)}</strong><span>records under your filters</span></div></header>
    <div className="atlas-toolbar"><div className="atlas-tabs" role="tablist" aria-label="Impact analytical view">{tabs.map((item, index) => <button ref={(element) => { tabRefs.current[index] = element; }} key={item.id} role="tab" id={`atlas-tab-${item.id}`} aria-controls={`atlas-panel-${item.id}`} aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1} onClick={() => setTab(item.id)} onKeyDown={(event) => chooseTab(event,index)}><item.icon size={17} aria-hidden="true" /><span>{item.label}</span></button>)}</div><button className="atlas-table-toggle" aria-pressed={showTable} onClick={() => setShowTable((value) => !value)}><Table2 size={17} aria-hidden="true" />{showTable ? 'Graphic' : 'Exact table'}</button></div>
    <div className="atlas-tabpanel" role="tabpanel" id={`atlas-panel-${tab}`} aria-labelledby={`atlas-tab-${tab}`} tabIndex={0}>
      {tab === 'flow' && <FlowView data={data} filters={filters} onFiltersChange={onFiltersChange} showTable={showTable} />}
      {tab === 'learning' && <LearningView data={data} showTable={showTable} />}
      {tab === 'hosting' && <HostingView data={data} filters={filters} onFiltersChange={onFiltersChange} showTable={showTable} />}
      {tab === 'geography' && <GeographyView data={data} filters={filters} onFiltersChange={onFiltersChange} showTable={showTable} />}
      {tab === 'sites' && <SitesView data={data} showTable={showTable} />}
    </div>
    <footer className="atlas-source-footer"><span>ONE SOURCE · EXACT AGGREGATES · 2024–2026</span><p>Generated records for design and evaluation planning. No observed learner, site, or app is represented.</p></footer>
  </section>;
}
