import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type SVGProps } from 'react';
import { ArrowDownUp, ArrowRight, ChevronLeft, ChevronRight, Layers3, Map, Network, ScanLine, Table2 } from 'lucide-react';
import { ASSESSMENT_CONSTRUCTS, TIER_LABELS, type OutcomeFilters, type OutcomeSummary, type OutcomesDataset } from '../lib/outcomes';
import { credentialTierFromStage, exploreImpact, selectOutcomeRecords } from '../lib/impact-exploration';
import '../impact-atlas.css';

export interface ImpactAtlasProps {
  dataset: OutcomesDataset;
  summary: OutcomeSummary;
  filters: OutcomeFilters;
  onFiltersChange: (filters: OutcomeFilters) => void;
  exploration?: ReturnType<typeof exploreImpact>;
  quiet?: boolean;
}

type Exploration = ReturnType<typeof exploreImpact>;
type ViewProps = { data: Exploration; showTable: boolean; still: boolean };
type FilterViewProps = ViewProps & Pick<ImpactAtlasProps, 'filters' | 'onFiltersChange'>;
const number = (value: number) => value.toLocaleString('en-US');
const percent = (value: number | null) => value === null ? '—' : `${(value * 100).toFixed(1)}%`;
const score = (value: number | null) => value === null ? '—' : value.toFixed(1);
const palette = ['var(--accent)', 'var(--chart-2)', 'var(--chart-3)', 'color-mix(in srgb, var(--accent) 55%, var(--chart-2))', 'color-mix(in srgb, var(--chart-2) 55%, var(--ink))', 'var(--muted)'];
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
function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(preference.matches);
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  return reduced;
}
/** Interpolate source geometry on a filter change; accessible values always describe the final counts. */
function MeasuredPath({ d, still, ...props }: SVGProps<SVGPathElement> & { d: string; still: boolean }) {
  const previous = useRef(d);
  const animation = useRef<SVGAnimateElement>(null);
  const from = previous.current;
  useEffect(() => { previous.current = d; }, [d]);
  useEffect(() => { if (!still && from !== d) animation.current?.beginElement(); }, [d, still, from]);
  return <path {...props} d={d}>{!still && from !== d && <animate ref={animation} key={d} begin="indefinite" attributeName="d" from={from} to={d} dur="0.8s" calcMode="spline" keyTimes="0;1" keySplines=".2 .7 .2 1" fill="freeze" />}</path>;
}
function ColorDefinitions({ id, colors = palette }: { id: string; colors?: string[] }) {
  return <defs>{colors.map((color, index) => <linearGradient key={index} id={`${id}-${index}`} x1="0" y1="0" x2=".8" y2="1"><stop offset="0" stopColor={color} stopOpacity=".9" /><stop offset=".48" stopColor={color} stopOpacity=".55" /><stop offset="1" stopColor={color} stopOpacity=".88" /></linearGradient>)}</defs>;
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

type FlowNode = { x: number; y: number; height: number; count: number; index: number; column: number; label: string };
type Ribbon = { id: string; source: FlowNode; target: FlowNode; count: number; tier: number; path: string; centerline: string };
function FlowView({ dataset, data, filters, onFiltersChange, showTable, still }: FilterViewProps & { dataset: OutcomesDataset }) {
  const { ref, width } = useChartWidth();
  const id = useId().replace(/:/g, '');
  const [step, setStep] = useState<0 | 1>(0);
  const [selected, setSelected] = useState<string | null>(null);
  const compact = width < 860;
  const tierHost = useMemo(() => {
    const matrix = TIER_LABELS.map(() => Array<number>(data.hosting.length + 1).fill(0));
    for (const row of selectOutcomeRecords(dataset, filters)) {
      const stage = dataset.columns.stage[row];
      const host = stage >= 2 && dataset.columns.host[row] < data.hosting.length ? dataset.columns.host[row] : data.hosting.length;
      matrix[credentialTierFromStage(stage)][host]++;
    }
    return matrix;
  }, [dataset, filters, data.hosting.length]);
  const hostNames = [...data.hosting.map((host) => host.name), 'Not deployed'];
  const tierCounts = TIER_LABELS.map((_, tier) => data.tracks.reduce((sum, track) => sum + track.tierCounts[tier], 0));
  const hostCounts = hostNames.map((_, host) => tierHost.reduce((sum, counts) => sum + counts[host], 0));
  const scale = (compact ? 285 : 340) / Math.max(1, data.totalSelected);
  const nodeWidth = compact ? 10 : 13;
  const x = compact ? [82, width - 100] : [145, width * .5 - 12, width - 160];
  const shortTracks = ['Agent', 'Data', 'Creative', 'Civic'];
  const shortTiers = ['None', 'Deployer', 'Builder', 'Operator', 'Pioneer'];
  const shortHosts = ['ZEN Arsenal', compact ? 'Vercel' : 'Vercel + Supabase', 'Netlify', 'Cloudflare', 'Replit', 'Not deployed'];
  const layout = (counts: number[], column: number, labels: readonly string[]) => {
    let previous: FlowNode | undefined;
    return counts.map((count, index) => {
      const height = count * scale;
      const y = previous ? Math.max(previous.y + previous.height + 18, previous.y + previous.height / 2 + 44 - height / 2) : 66;
      const node = { x: x[compact ? column - step : column] ?? 0, y, height, count, index, column, label: labels[index] };
      if (count) previous = node;
      return node;
    });
  };
  const columns = [layout(data.tracks.map((track) => track.students), 0, data.tracks.map((track) => track.name)), layout(tierCounts, 1, TIER_LABELS), layout(hostCounts, 2, hostNames)];
  const ribbons: Ribbon[] = [];
  const connect = (matrix: number[][], column: number) => {
    const incoming = columns[column + 1].map((node) => node.y);
    matrix.forEach((counts, sourceIndex) => {
      const source = columns[column][sourceIndex];
      let offset = source.y;
      counts.forEach((count, targetIndex) => {
        const target = columns[column + 1][targetIndex], thickness = count * scale;
        const a = source.x + nodeWidth, b = target.x, control = (b - a) * .48, sy = offset, ty = incoming[targetIndex];
        if (count) ribbons.push({ id: `${column}-${sourceIndex}-${targetIndex}`, source, target, count, tier: column === 0 ? targetIndex : sourceIndex,
          path: `M${a},${sy} C${a + control},${sy} ${b - control},${ty} ${b},${ty} L${b},${ty + thickness} C${b - control},${ty + thickness} ${a + control},${sy + thickness} ${a},${sy + thickness} Z`,
          centerline: `M${a},${sy + thickness / 2} C${a + control},${sy + thickness / 2} ${b - control},${ty + thickness / 2} ${b},${ty + thickness / 2}` });
        offset += thickness; incoming[targetIndex] += thickness;
      });
    });
  };
  if (!compact || step === 0) connect(data.tracks.map((track) => track.tierCounts), 0);
  if (!compact || step === 1) connect(tierHost, 1);
  const active = ribbons.find((ribbon) => ribbon.id === selected);
  const inspect = active || [...ribbons].sort((a, b) => b.count - a.count)[0];
  const visibleColumns = compact ? columns.slice(step, step + 2) : columns;
  const svgHeight = Math.max(420, ...visibleColumns.flat().filter((node) => node.count).map((node) => node.y + node.height + 32));
  const filterTrack = (index: number) => onFiltersChange({ ...filters, track: filters.track === data.tracks[index].name ? 'all' : data.tracks[index].name });
  const titles = ['BUILD TRACK', 'CREDENTIAL TIER', 'HOSTING'];
  return <div className="atlas-view atlas-flow-view">
    <div className="atlas-view-intro"><div><h3>Capability becomes infrastructure.</h3><p>Build track → modeled credential tier → hosting. Each ribbon carries an exact count; its thickness uses one shared learner scale.</p></div><span className="atlas-total"><strong>{number(data.totalSelected)}</strong>modeled learners</span></div>
    {compact && !showTable && <div className="atlas-flow-navigation atlas-switch" aria-label="Flow stage"><button aria-pressed={step === 0} onClick={() => { setStep(0); setSelected(null); }}>Track → Tier</button><button aria-pressed={step === 1} onClick={() => { setStep(1); setSelected(null); }}>Tier → Hosting</button></div>}
    {showTable ? <div className="atlas-flow-tables"><DataTable caption="Exact track-to-tier counts under all active filters" headers={['Build track', ...TIER_LABELS, 'Total']} rows={[...data.tracks.map((track) => [track.name, ...track.tierCounts.map(number), number(track.students)]), ['All tracks', ...tierCounts.map(number), number(data.totalSelected)]]} /><DataTable caption="Exact tier-to-hosting counts; every selected learner is counted once, including those not deployed" headers={['Credential tier', ...hostNames, 'Total']} rows={[...tierHost.map((counts, tier) => [TIER_LABELS[tier], ...counts.map(number), number(tierCounts[tier])]), ['All tiers', ...hostCounts.map(number), number(data.totalSelected)]]} /></div> : <div className="atlas-flow-frame atlas-scene" ref={ref}>
      <svg viewBox={`0 0 ${width} ${svgHeight}`} width={width} height={svgHeight} aria-label="Exact modeled learners flowing from build track to credential tier to hosting">
        <ColorDefinitions id={`${id}-ribbon`} />
        <defs><filter id={`${id}-depth`} x="-5%" y="-5%" width="110%" height="115%"><feDropShadow dx="0" dy="5" stdDeviation="3" floodColor="var(--ink)" floodOpacity=".12" /></filter><linearGradient id={`${id}-node`} x2="1" y2="0"><stop stopColor="var(--ink)" stopOpacity=".8" /><stop offset=".55" stopColor="var(--ink)" stopOpacity=".35" /><stop offset="1" stopColor="var(--ink)" stopOpacity=".7" /></linearGradient></defs>
        {visibleColumns.map((nodes) => <g key={nodes[0]?.column}><text x={nodes[0]?.x + (compact && nodes[0]?.column === step ? -10 : 0)} y={22} textAnchor={compact && nodes[0]?.column === step ? 'end' : 'start'} className="atlas-axis-title">{compact ? ['TRACK', 'TIER', 'HOSTING'][nodes[0]?.column] : titles[nodes[0]?.column]}</text><line x1={nodes[0]?.x + nodeWidth / 2} x2={nodes[0]?.x + nodeWidth / 2} y1={40} y2={svgHeight - 15} className="atlas-flow-column-guide" /></g>)}
        <g filter={`url(#${id}-depth)`}>{ribbons.map((ribbon, index) => {
          const related = !active || ribbon.tier === active.tier;
          return <g key={ribbon.id} role="button" tabIndex={0} aria-label={`${ribbon.source.label} to ${ribbon.target.label}: ${number(ribbon.count)} modeled learners`} onClick={() => setSelected(ribbon.id)} onFocus={() => setSelected(ribbon.id)} onKeyDown={(event) => activate(event, () => setSelected(ribbon.id))} className={`atlas-ribbon-target${related ? ' is-related' : ''}${active?.id === ribbon.id ? ' is-selected' : ''}`} style={{ '--scene-delay': `${index * 22}ms` } as CSSProperties}>
            <MeasuredPath d={ribbon.path} still={still} fill={`url(#${id}-ribbon-${ribbon.tier})`} className="atlas-ribbon" opacity={related ? .82 : .12} />
            <MeasuredPath d={ribbon.path} still={still} fill="none" stroke={palette[ribbon.tier]} strokeWidth={.7} opacity={related ? .72 : .14} className="atlas-ribbon-edge" />
            <path d={ribbon.path} fill="transparent" stroke="transparent" strokeWidth={10} />
            {inspect?.id === ribbon.id && <path d={ribbon.centerline} pathLength={100} className="atlas-flow-signal" fill="none" stroke={palette[ribbon.tier]} strokeWidth={2} />}
            <title>{`${ribbon.source.label} → ${ribbon.target.label} · ${number(ribbon.count)} learners · ${percent(ribbon.count / Math.max(1, ribbon.source.count))} of source`}</title>
          </g>;
        })}</g>
        {visibleColumns.flat().map((node) => node.count > 0 && <g key={`${node.column}-${node.index}`} className={`atlas-flow-node${node.column === 0 ? ' is-actionable' : ''}`} role={node.column === 0 ? 'button' : undefined} tabIndex={node.column === 0 ? 0 : undefined} aria-label={node.column === 0 ? `${node.label}: ${number(node.count)} learners. ${filters.track === node.label ? 'Clear' : 'Apply'} track filter.` : undefined} onClick={node.column === 0 ? () => filterTrack(node.index) : undefined} onKeyDown={node.column === 0 ? (event) => activate(event, () => filterTrack(node.index)) : undefined}>
          <rect x={node.x} y={node.y} width={nodeWidth} height={node.height} rx={2} fill={node.column === 1 ? palette[node.index] : node.column === 2 ? palette[node.index] : `url(#${id}-node)`} />
          <line x1={node.x + 2} x2={node.x + 2} y1={node.y + 2} y2={node.y + node.height - 2} stroke="var(--surface)" strokeOpacity=".6" />
          <text x={node.x + (node.column === step && compact || node.column === 0 ? -12 : nodeWidth + 14)} y={node.y + node.height / 2 - 4} textAnchor={node.column === step && compact || node.column === 0 ? 'end' : 'start'} className="atlas-flow-label">{node.column === 2 ? shortHosts[node.index] : compact ? node.column === 0 ? shortTracks[node.index] : shortTiers[node.index] : node.label}</text>
          <text x={node.x + (node.column === step && compact || node.column === 0 ? -12 : nodeWidth + 14)} y={node.y + node.height / 2 + 16} textAnchor={node.column === step && compact || node.column === 0 ? 'end' : 'start'} className="atlas-count-label atlas-flow-label">{number(node.count)}</text>
        </g>)}
      </svg>
    </div>}
    <div className="atlas-inspector" aria-live="polite">{inspect ? <><span className="atlas-inspector-kicker">PATH INSPECTION</span><span><i className="atlas-inspector-swatch" style={{ background: palette[inspect.tier] }} />{inspect.source.label}<ArrowRight size={14} aria-hidden="true" />{inspect.target.label}</span><strong>{number(inspect.count)} learners <small>{percent(inspect.count / Math.max(1, inspect.source.count))} of {inspect.source.label}</small></strong></> : <span>No paths under these filters.</span>}</div>
    <div className="atlas-track-buttons">{data.tracks.map((track, index) => <button key={track.name} aria-pressed={filters.track === track.name} onClick={() => filterTrack(index)}><i style={{ background: palette[index] }} />{track.name}</button>)}</div>
    <p className="atlas-caveat">Tap or focus a ribbon to trace its tier across both stages. Each learner appears once per stage; tiers describe the source model and do not issue credentials. Depth and moving highlights indicate structure and direction, not additional records or elapsed time.</p>
  </div>;
}

function LearningView({ data, showTable, still }: ViewProps) {
  const { ref, width } = useChartWidth();
  const id = useId().replace(/:/g, '');
  const [construct, setConstruct] = useState('all');
  const [bin, setBin] = useState(25);
  const visible = data.constructs.filter((item) => construct === 'all' || item.key === construct);
  const peak = Math.max(1, ...data.constructs.flatMap((item) => [...item.preBins, ...item.postBins].map((item) => item.count)));
  const left = 16, plotWidth = width - 54;
  const height = construct === 'all' ? 132 : 250, baseline = height - 45, amplitude = baseline - 14;
  const ridge = (bins: Exploration['constructs'][number]['preBins']) => `M${left},${baseline} ${bins.map((item, index) => `L${left + index / 50 * plotWidth},${baseline - item.count / peak * amplitude} L${left + (index + 1) / 50 * plotWidth},${baseline - item.count / peak * amplitude}`).join(' ')} L${left + plotWidth},${baseline} Z`;
  const inspectAt = (clientX: number, element: SVGSVGElement) => { const bounds = element.getBoundingClientRect(); setBin(Math.max(0, Math.min(49, Math.floor(((clientX - bounds.left) / bounds.width * width - left) / plotWidth * 50)))); };
  const central = construct === 'all' ? data.assessment : visible[0];
  return <div className="atlas-view atlas-learning-view">
    <div className="atlas-view-intro"><div><h3>The shift beneath the average.</h3><p>Five landscapes of modeled learning. Exact 2-point score bins reveal the distribution behind the change in means.</p></div><label className="atlas-select"><span>Construct</span><select value={construct} onChange={(event) => setConstruct(event.target.value)}><option value="all">All five constructs</option>{ASSESSMENT_CONSTRUCTS.map((item) => <option value={item.key} key={item.key}>{item.label}</option>)}</select></label></div>
    <div className="atlas-learning-statistics"><div><span>Before · mean score</span><strong>{score(central?.pre.mean ?? null)}<small>/ 100</small></strong></div><ArrowRight aria-hidden="true" /><div><span>After · mean score</span><strong>{score(central?.post.mean ?? null)}<small>/ 100</small></strong></div><div className="atlas-learning-gain"><span>Modeled mean gain</span><strong>{central?.gain.mean === null || !central ? '—' : `${central.gain.mean >= 0 ? '+' : ''}${central.gain.mean.toFixed(1)}`}<small>points</small></strong></div></div>
    <div className="atlas-learning-key"><span><i className="is-before" />Before instruction</span><span><i className="is-after" />After instruction</span><small>{data.totalSelected ? `Shared height scale: 0–${number(peak)} scores / bin` : 'No modeled scores under these filters'}</small></div>
    {showTable ? <DataTable caption="Exact 2-point score-bin counts under all active filters; final bin includes 100" headers={['Construct', 'Score bin', 'Before', 'After']} rows={visible.flatMap((item) => item.preBins.map((scoreBin, index) => [item.label, `${scoreBin.from}–${scoreBin.to}${scoreBin.upperInclusive ? ' inclusive' : ' (upper excluded)'}`, number(scoreBin.count), number(item.postBins[index].count)]))} /> : <div className="atlas-ridges" ref={ref}>{visible.map((item, index) => <div className="atlas-ridge atlas-scene" key={item.key} style={{ '--scene-delay': `${index * 75}ms` } as CSSProperties}>
      <div className="atlas-ridge-heading"><h4><span>{String(index + 1).padStart(2, '0')}</span>{item.label}</h4><span>Mean <b>{score(item.pre.mean)}</b><ArrowRight size={12} aria-hidden="true" /><b>{score(item.post.mean)}</b></span></div>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} tabIndex={0} role="group" aria-label={`${item.label} exact score distribution. Use left and right arrows to inspect 2-point bins.`} onPointerMove={(event) => inspectAt(event.clientX, event.currentTarget)} onClick={(event) => inspectAt(event.clientX, event.currentTarget)} onKeyDown={(event) => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); setBin((current) => event.key === 'Home' ? 0 : event.key === 'End' ? 49 : Math.max(0, Math.min(49, current + (event.key === 'ArrowRight' ? 1 : -1)))); } }}>
        <defs><linearGradient id={`${id}-${item.key}-pre`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="var(--chart-2)" stopOpacity=".45" /><stop offset="1" stopColor="var(--chart-2)" stopOpacity=".08" /></linearGradient><linearGradient id={`${id}-${item.key}-post`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="var(--accent)" stopOpacity=".85" /><stop offset=".4" stopColor="var(--accent)" stopOpacity=".45" /><stop offset="1" stopColor="var(--accent)" stopOpacity=".13" /></linearGradient></defs>
        {[0, 25, 50, 75, 100].map((tick) => <g key={tick}><line x1={left + tick / 100 * plotWidth} x2={left + tick / 100 * plotWidth} y1={6} y2={baseline + 25} className="atlas-grid-line" /><text x={left + tick / 100 * plotWidth} y={height - 6} textAnchor="middle" className="atlas-axis-label">{tick}</text></g>)}
        {[0, .5, 1].map((ratio) => <line key={ratio} x1={left} x2={left + plotWidth} y1={baseline - amplitude * ratio} y2={baseline - amplitude * ratio} className="atlas-ridge-count-guide" />)}
        <text x={width - 1} y={baseline - amplitude + 4} textAnchor="end" className="atlas-axis-label atlas-peak-label">{data.totalSelected ? number(peak) : '0'}</text>
        <MeasuredPath d={ridge(item.preBins)} still={still} fill={`url(#${id}-${item.key}-pre)`} className="atlas-ridge-before" />
        <MeasuredPath d={ridge(item.postBins)} still={still} transform="translate(0 4)" className="atlas-ridge-depth" />
        <MeasuredPath d={ridge(item.postBins)} still={still} fill={`url(#${id}-${item.key}-post)`} className="atlas-ridge-after" />
        {item.postBins.map((count, binIndex) => binIndex % 2 === 0 && count.count > 0 && <line key={binIndex} x1={left + (binIndex + 1) / 50 * plotWidth} x2={left + (binIndex + 1) / 50 * plotWidth} y1={baseline} y2={baseline - count.count / peak * amplitude} className="atlas-ridge-facet" />)}
        {[item.pre, item.post].map((distribution, series) => distribution.mean !== null && <g key={series} style={{ color: series === 0 ? 'var(--chart-2)' : 'var(--accent)' }}>
          <line x1={left + distribution.mean / 100 * plotWidth} x2={left + distribution.mean / 100 * plotWidth} y1={12} y2={baseline + 8} className="atlas-mean-guide" />
          <circle cx={left + distribution.mean / 100 * plotWidth} cy={baseline + 10 + series * 9} r={3} fill="currentColor" />
          {distribution.p25 !== null && distribution.p75 !== null && <line x1={left + distribution.p25 / 100 * plotWidth} x2={left + distribution.p75 / 100 * plotWidth} y1={baseline + 10 + series * 9} y2={baseline + 10 + series * 9} className="atlas-quantile-rail"><title>{`${series ? 'After' : 'Before'} middle 50%: ${score(distribution.p25)}–${score(distribution.p75)} points; mean ${score(distribution.mean)}`}</title></line>}
        </g>)}
        <rect x={left + bin / 50 * plotWidth} y={4} width={plotWidth / 50} height={baseline - 4} className="atlas-bin-selection" />
        <line x1={left + (bin + .5) / 50 * plotWidth} x2={left + (bin + .5) / 50 * plotWidth} y1={4} y2={baseline} className="atlas-bin-cursor" />
      </svg>
    </div>)}</div>}
    <div className="atlas-bin-inspector" aria-live="polite"><div><span className="atlas-inspector-kicker">BIN INSPECTION</span><strong>{bin * 2}–{bin * 2 + 2} points{bin === 49 ? ' · includes 100' : ' · upper bound excluded'}</strong><span>{number(data.totalSelected)} modeled scores per series</span></div>{visible.map((item) => <div key={item.key}><span>{item.label}</span><p><b>{number(item.preBins[bin].count)}</b> before <ArrowRight size={12} aria-hidden="true" /><b>{number(item.postBins[bin].count)}</b> after</p></div>)}</div>
    <p className="atlas-caveat">Front-face height is the exact bin count on one shared scale; depth is schematic. Dots mark means; horizontal rails mark the middle 50% of scores. Inspect with tap, pointer, or arrow keys. Generated scores without a comparison group provide no causal evidence.</p>
  </div>;
}

function HostingView({ data, filters, onFiltersChange, showTable, still }: FilterViewProps) {
  const { ref, width } = useChartWidth();
  const id = useId().replace(/:/g, '');
  const [mode, setMode] = useState<'count' | 'share'>('count');
  const [selected, setSelected] = useState<{ year: number; host: number } | null>(null);
  const max = Math.max(1, ...data.cohortHosting.map((row) => row.deployed));
  const total = data.cohortHosting.reduce((sum, row) => sum + row.deployed, 0);
  const active = selected && data.cohortHosting.find((row) => row.year === selected.year);
  const narrow = width < 540, left = narrow ? 42 : 62, right = narrow ? 12 : 45, baseline = narrow ? 292 : 320, plotHeight = narrow ? 235 : 260;
  const slot = (width - left - right) / 3, barWidth = Math.min(narrow ? 46 : 116, slot * .58), dx = narrow ? 10 : 22, dy = narrow ? 6 : 13;
  const filterCohort = (year: number) => onFiltersChange({ ...filters, cohort: filters.cohort === String(year) ? 'all' : String(year) as OutcomeFilters['cohort'] });
  return <div className="atlas-view atlas-hosting-view">
    <div className="atlas-view-intro"><div><h3>Where the work takes root.</h3><p>Three cohorts, five hosting categories. The height of each infrastructure column is built from exact S2+ project counts.</p></div><div className="atlas-switch" aria-label="Hosting display"><button aria-pressed={mode === 'count'} onClick={() => setMode('count')}>App counts</button><button aria-pressed={mode === 'share'} onClick={() => setMode('share')}>Share</button></div></div>
    <ChartKey labels={data.hosting.map((host) => host.name)} activeIndex={selected?.host} onSelect={(host) => setSelected({ host, year: selected?.year ?? (filters.cohort !== 'all' && filters.cohort !== '2027' ? Number(filters.cohort) : data.cohortHosting.at(-1)?.year ?? 2026) })} />
    {showTable ? <DataTable caption="Exact deployed-project counts by cohort and source hosting category; cohort filter does not hide context" headers={['Cohort', ...data.hosting.map((host) => host.name), 'Total deployed']} rows={data.cohortHosting.map((row) => [String(row.year), ...row.counts.map(number), number(row.deployed)])} /> : <div className="atlas-hosting-scene atlas-scene" ref={ref}>
      <svg viewBox={`0 0 ${width} ${baseline + 90}`} width={width} height={baseline + 90} aria-label={`Hosting composition by cohort. Column height encodes ${mode === 'count' ? 'exact deployed-project count' : 'share of deployed projects'}. Depth is schematic.`}>
        <ColorDefinitions id={`${id}-host`} />
        {[0, .25, .5, .75, 1].map((ratio) => <g key={ratio}><line x1={left - 3} x2={width - right} y1={baseline - ratio * plotHeight} y2={baseline - ratio * plotHeight} className="atlas-grid-line" /><text x={left - 8} y={baseline - ratio * plotHeight + 4} textAnchor="end" className="atlas-axis-label">{mode === 'share' ? `${ratio * 100}%` : number(Math.round(ratio * max))}</text></g>)}
        <path d={`M${left},${baseline} L${width - right},${baseline} L${width - right + dx},${baseline - dy} L${left + dx},${baseline - dy} Z`} className="atlas-host-floor" />
        {data.cohortHosting.map((row, index) => {
          const x = left + slot * (index + .5) - barWidth / 2 - dx / 2;
          const denominator = mode === 'share' ? Math.max(1, row.deployed) : max;
          let offset = 0;
          return <g key={row.year} className={`atlas-hosting-column${row.selected ? ' is-selected' : ''}`} style={{ '--scene-delay': `${index * 100}ms` } as CSSProperties}>
            <ellipse cx={x + barWidth / 2 + dx / 2} cy={baseline + 3} rx={barWidth * .68} ry={dy * .9 + 3} className="atlas-column-shadow" />
            {row.counts.map((count, host) => {
              const h = count / denominator * plotHeight, y = baseline - offset - h;
              offset += h;
              if (!count) return null;
              const path = `M${x},${y} H${x + barWidth} V${y + h} H${x} Z`;
              const side = `M${x + barWidth},${y} L${x + barWidth + dx},${y - dy} V${y + h - dy} L${x + barWidth},${y + h} Z`;
              const top = `M${x},${y} L${x + dx},${y - dy} H${x + barWidth + dx} L${x + barWidth},${y} Z`;
              const inspected = selected?.year === row.year && selected.host === host;
              return <g key={host} role="button" tabIndex={0} onClick={() => setSelected({ year: row.year, host })} onFocus={() => setSelected({ year: row.year, host })} onKeyDown={(event) => activate(event, () => setSelected({ year: row.year, host }))} aria-label={`${row.year}, ${data.hosting[host].name}: ${number(count)} apps, ${percent(row.deployed ? count / row.deployed : null)}`} className={`atlas-hosting-layer${inspected ? ' is-inspected' : ''}`} opacity={selected && selected.host !== host ? .24 : 1}>
                <MeasuredPath d={side} still={still} fill={palette[host]} fillOpacity={.42} className="atlas-host-side" />
                <MeasuredPath d={path} still={still} fill={`url(#${id}-host-${host})`} className="atlas-host-front" />
                <MeasuredPath d={top} still={still} fill={palette[host]} fillOpacity={.72} stroke="var(--surface)" strokeOpacity={.4} strokeWidth={.6} />
                {!narrow && h > 28 && <text x={x + barWidth / 2} y={y + h / 2 + 4} textAnchor="middle" className="atlas-host-value">{mode === 'count' ? number(count) : percent(count / Math.max(1, row.deployed))}</text>}
                <title>{`${row.year} · ${data.hosting[host].name} · ${number(count)} apps`}</title>
              </g>;
            })}
            <text x={x + barWidth / 2 + dx / 2} y={baseline - offset - dy - 15} textAnchor="middle" className="atlas-column-total">{mode === 'share' ? row.deployed ? '100%' : '—' : number(row.deployed)}</text>
            <g role="button" tabIndex={0} className="atlas-cohort-svg-button" aria-label={`${filters.cohort === String(row.year) ? 'Clear' : 'Apply'} ${row.year} cohort filter`} onClick={() => filterCohort(row.year)} onKeyDown={(event) => activate(event, () => filterCohort(row.year))}>
              <rect x={x - 5} y={baseline + 17} width={barWidth + dx + 10} height={50} rx={4} fill={row.selected ? 'var(--accent-soft)' : 'transparent'} stroke={row.selected ? 'var(--accent)' : 'var(--line)'} />
              <text x={x + barWidth / 2 + dx / 2} y={baseline + 39} textAnchor="middle" className="atlas-cohort-year">{row.year}</text>
              {!narrow && <text x={x + barWidth / 2 + dx / 2} y={baseline + 56} textAnchor="middle" className="atlas-count-label">{number(row.deployed)} deployed</text>}
            </g>
          </g>;
        })}
      </svg>
    </div>}
    <div className="atlas-inspector" aria-live="polite"><span className="atlas-inspector-kicker">{active && selected ? 'HOSTING INSPECTION' : 'COHORT CONTEXT'}</span>{active && selected ? <><span><i className="atlas-inspector-swatch" style={{ background: palette[selected.host] }} />{active.year} · {data.hosting[selected.host].name}</span><strong>{number(active.counts[selected.host])} apps <small>{percent(active.deployed ? active.counts[selected.host] / active.deployed : null)} of that cohort’s deployed apps</small></strong></> : <><span>All three published model cohorts</span><strong>{number(total)} deployed apps <small>under the other active filters</small></strong></>}</div>
    <p className="atlas-caveat">The cohort filter highlights a year while preserving the comparison. Build track, jurisdiction, and delivery filters apply. Front-face height encodes count or share; column depth is schematic. Inspect a segment or hosting key for an exact value, or select a year to filter. Hosting shifts are source model assumptions.</p>
  </div>;
}

const usTiles: [string, number, number][] = [
  ['ME',11,0],['VT',10,1],['NH',11,1],['WA',0,2],['ID',1,2],['MT',2,2],['ND',3,2],['MN',4,2],['WI',5,2],['IL',6,2],['MI',7,2],['NY',9,2],['MA',10,2],
  ['OR',0,3],['NV',1,3],['WY',2,3],['SD',3,3],['IA',4,3],['IN',6,3],['OH',7,3],['PA',8,3],['NJ',9,3],['CT',10,3],['RI',11,3],
  ['CA',0,4],['UT',1,4],['CO',2,4],['NE',3,4],['MO',4,4],['KY',6,4],['WV',7,4],['MD',8,4],['DE',9,4],['AZ',1,5],['NM',2,5],['KS',3,5],['AR',4,5],['TN',5,5],['VA',7,5],['NC',8,5],['DC',9,5],['OK',3,6],['LA',4,6],['MS',5,6],['AL',6,6],['GA',7,6],['SC',8,6],['AK',0,7],['HI',1,7],['TX',3,7],['FL',8,7],
];
function GeographyView({ data, filters, onFiltersChange, showTable, still }: FilterViewProps) {
  const { ref, width } = useChartWidth();
  const [metric, setMetric] = useState<'learners' | 'deployment'>('learners');
  const [inspection, setInspection] = useState<string | null>(null);
  const rows = data.jurisdictions;
  const sorted = [...rows].sort((a, b) => b.students - a.students);
  const max = Math.max(1, ...rows.map((row) => row.students));
  const byCode = new globalThis.Map(rows.map((row) => [row.code, row]));
  const active = rows.find((row) => row.code === inspection || row.code === filters.jurisdiction) || sorted[0];
  const select = (code: string) => { setInspection(code); onFiltersChange({ ...filters, jurisdiction: filters.jurisdiction === code ? 'all' : code }); };
  const narrow = width < 700;
  const tower = (code: string, x: number, floor: number, half: number, depth: number, maxHeight: number, showCount = false) => {
    const row = byCode.get(code), h = (row?.students ?? 0) / max * maxHeight;
    const selected = filters.jurisdiction === code;
    const intensity = row ? .18 + .68 * (metric === 'learners' ? row.students / max : row.deploymentRate ?? 0) : 0;
    const tint = `color-mix(in srgb, var(--accent) ${Math.round(intensity * 100)}%, var(--surface))`;
    const y = floor - h, dx = depth, dy = depth * .6;
    return <g key={code} role={row ? 'button' : undefined} tabIndex={row ? 0 : undefined} className={`atlas-geo-tower${selected ? ' is-selected' : ''}${!row ? ' is-absent' : ''}`} aria-label={row ? `${code}: ${number(row.students)} modeled learners, ${percent(row.deploymentRate)} deployed. ${selected ? 'Clear' : 'Apply'} jurisdiction filter.` : undefined} onClick={row ? () => select(code) : undefined} onFocus={row ? () => setInspection(code) : undefined} onKeyDown={row ? (event) => activate(event, () => select(code)) : undefined}>
      <path d={`M${x - half},${floor} L${x - half + dx},${floor - dy} H${x + half + dx} L${x + half},${floor} Z`} className="atlas-geo-plinth" />
      {row && <><MeasuredPath d={`M${x + half},${y} L${x + half + dx},${y - dy} V${floor - dy} L${x + half},${floor} Z`} still={still} fill={tint} className="atlas-geo-side" /><MeasuredPath d={`M${x - half},${y} H${x + half} V${floor} H${x - half} Z`} still={still} fill={tint} className="atlas-geo-front" /><MeasuredPath d={`M${x - half},${y} L${x - half + dx},${y - dy} H${x + half + dx} L${x + half},${y} Z`} still={still} fill={tint} className="atlas-geo-top" /><line x1={x - half + 2} x2={x - half + 2} y1={y + 2} y2={floor - 2} className="atlas-geo-edge" /><rect x={x - Math.max(half, 22)} y={Math.min(y - dy, floor - 28)} width={Math.max(44, half * 2 + dx)} height={Math.max(44, h + dy + 25)} fill="transparent" /></>}
      <text x={x + dx / 2} y={floor + 17} textAnchor="middle" className="atlas-geo-code">{code}</text>
      {row && showCount && <text x={x + dx / 2} y={y - dy - 12} textAnchor="middle" className="atlas-geo-count">{number(row.students)}</text>}
      <title>{row ? `${code} · ${number(row.students)} modeled learners · ${number(row.deployed)} deployed · ${percent(row.deploymentRate)}` : `${code}: no modeled records under these filters`}</title>
    </g>;
  };
  const tile = (code: string) => {
    const row = byCode.get(code);
    return <button key={code} className={`atlas-state-tile${filters.jurisdiction === code ? ' is-selected' : ''}`} aria-pressed={filters.jurisdiction === code} onClick={() => select(code)} style={{ '--tile-intensity': `${18 + 56 * (metric === 'learners' ? (row?.students ?? 0) / max : row?.deploymentRate ?? 0)}%`, '--tile-height': `${(row?.students ?? 0) / max * 72}%` } as CSSProperties}><span>{code}</span><strong>{row ? number(row.students) : '—'}</strong><small>{percent(row?.deploymentRate ?? null)}</small><i aria-hidden="true" /></button>;
  };
  return <div className="atlas-view atlas-geography-view">
    <div className="atlas-view-intro"><div><h3>A skyline of modeled reach.</h3><p>Jurisdictions become a measured landscape. Tower height shows learner count; color reveals count or deployment rate.</p></div><div className="atlas-switch" aria-label="Geographic color measure"><button aria-pressed={metric === 'learners'} onClick={() => setMetric('learners')}>Learners</button><button aria-pressed={metric === 'deployment'} onClick={() => setMetric('deployment')}>Deploy rate</button></div></div>
    <div className="atlas-map-key"><span>{narrow ? 'SIX LARGEST / THEN ALL JURISDICTIONS' : 'SCHEMATIC U.S. SKYLINE'}</span><div><i /><span>Low</span><b /><span>High color</span></div><small>{rows.length} jurisdictions · {rows.length ? `height 0–${number(max)} learners` : 'no source records'}</small></div>
    {showTable ? <DataTable caption="Jurisdiction context under all filters except the jurisdiction selection" headers={['Jurisdiction', 'Learners', 'S2+ deployed', 'Deployment rate', 'S7 capstones', 'Mean gain']} rows={sorted.map((row) => [row.code, number(row.students), number(row.deployed), percent(row.deploymentRate), number(row.capstones), row.meanGain === null ? '—' : `${row.meanGain.toFixed(1)} pts`])} /> : <div ref={ref} className="atlas-geography-graphics">
      <div className="atlas-geographic-skyline atlas-scene"><svg width={width} height={narrow ? 310 : 555} viewBox={`0 0 ${width} ${narrow ? 310 : 555}`} aria-label={narrow ? 'Six largest modeled jurisdictions, tower height proportional to learner count' : 'Schematic United States skyline; tower height proportional to modeled learner count'}>
        {narrow ? <><path d={`M12,255 H${width - 12} L${width - 4},250 H20 Z`} className="atlas-geo-platform" />{sorted.slice(0, 6).map((row, index) => tower(row.code, 18 + (width - 36) / 6 * (index + .5), 255, Math.min(13, (width - 36) / 6 * .27), 8, 195, true))}</> : <>
          {Array.from({ length: 9 }, (_, index) => <line key={index} x1={12} x2={width - 12} y1={134 + index * 49} y2={134 + index * 49} className="atlas-geo-floor-line" />)}
          {usTiles.slice().sort((a, b) => a[2] - b[2]).map(([code, column, row]) => tower(code, 18 + (width - 50) / 12 * (column + .5), 128 + row * 49, Math.min(24, (width - 50) / 12 * .29), 12, 136, filters.jurisdiction === code || sorted.slice(0, 3).some((item) => item.code === code)))}
        </>}
      </svg></div>
      {narrow && <div className="atlas-geography-mobile">{sorted.map((row) => tile(row.code))}</div>}
    </div>}
    <div className="atlas-inspector" aria-live="polite"><span className="atlas-inspector-kicker">JURISDICTION INSPECTION</span>{active ? <><span>{active.code} · {number(active.students)} modeled learners</span><strong>{percent(active.deploymentRate)} deployed <small>{number(active.deployed)} of {number(active.students)} · {number(active.capstones)} capstones</small></strong></> : <span>No jurisdiction context for these filters.</span>}</div>
    <p className="atlas-caveat">Select a jurisdiction to filter the observatory. Context preserves other jurisdictions under the cohort, build-track, and delivery filters. Position and depth are schematic; this is not precise geography, actual partner locations, or observed program reach. Empty plinths have no source records in this view.</p>
  </div>;
}

const siteMeasures = ['Deployment', 'Public launch', 'Capstone', 'Live at 90d', 'Score gain', 'Attendance'];
type Site = Exploration['sites'][number];
const siteValues = (site: Site) => [site.students ? site.deployed / site.students : 0, site.students ? site.launched / site.students : 0, site.students ? site.capstones / site.students : 0, site.deployed ? site.live90 / site.deployed : 0, Math.max(0, Math.min(1, (site.meanGain || 0) / 100)), site.attendanceRate || 0];
function SiteGlyph({ site, large = false, still }: { site: Site; large?: boolean; still: boolean }) {
  const id = useId().replace(/:/g, '');
  const values = siteValues(site), radius = large ? 78 : 43, center = large ? 110 : 55;
  const point = (angle: number, extent: number, lateral = 0) => [center + Math.sin(angle) * extent + Math.cos(angle) * lateral, center - Math.cos(angle) * extent + Math.sin(angle) * lateral];
  const petals = values.map((value, index) => {
    const angle = index * Math.PI / 3, length = radius * value, width = length * .38;
    const a = point(angle, length * .34, width), b = point(angle, length * .87, width * .52), tip = point(angle, length), c = point(angle, length * .87, -width * .52), d = point(angle, length * .34, -width);
    return `M${center},${center} C${a.join(',')} ${b.join(',')} ${tip.join(',')} C${c.join(',')} ${d.join(',')} ${center},${center} Z`;
  });
  return <svg viewBox={`0 0 ${center * 2} ${center * 2}`} className={`atlas-site-glyph${large ? ' is-large' : ''}`} aria-hidden="true">
    <ColorDefinitions id={`${id}-petal`} />
    {[.25,.5,.75,1].map((ratio) => <circle key={ratio} cx={center} cy={center} r={radius * ratio} className="atlas-site-grid" />)}
    {values.map((_, index) => { const end = point(index * Math.PI / 3, radius); return <line key={index} x1={center} y1={center} x2={end[0]} y2={end[1]} className="atlas-site-spoke" />; })}
    {petals.map((path, index) => <g key={index} className="atlas-site-petal" style={{ '--scene-delay': `${index * 45}ms` } as CSSProperties}><MeasuredPath d={path} still={still} fill={`url(#${id}-petal-${index})`} stroke={palette[index]} strokeWidth={large ? 1.2 : .8} /><circle cx={point(index * Math.PI / 3, radius * values[index])[0]} cy={point(index * Math.PI / 3, radius * values[index])[1]} r={large ? 2.8 : 1.5} fill={palette[index]} /></g>)}
    <circle cx={center} cy={center} r={large ? 24 : 10} className="atlas-site-hub" />
    {large && <><text x={center} y={center + 1} textAnchor="middle" className="atlas-site-center-count">{number(site.students)}</text><text x={center} y={center + 15} textAnchor="middle" className="atlas-site-center-label">learners</text></>}
    {large && values.map((_, index) => <text key={`axis-${index}`} x={point(index * Math.PI / 3, radius * 1.2)[0]} y={point(index * Math.PI / 3, radius * 1.2)[1]} textAnchor="middle" dominantBaseline="middle" className="atlas-site-axis-index">{index + 1}</text>)}
  </svg>;
}
function SiteProfileField({ sites, active, onSelect }: { sites: Site[]; active?: Site; onSelect: (index: number) => void }) {
  const { ref, width } = useChartWidth();
  const left = 42, right = 19, top = 24, bottom = 244, plotWidth = width - left - right;
  const max = Math.max(1, ...sites.map((site) => site.students));
  const maximumRadius = width < 540 ? 13 : 23;
  const x = (site: Site) => left + site.deployed / Math.max(1, site.students) * plotWidth;
  const y = (site: Site) => bottom - site.capstones / Math.max(1, site.students) * (bottom - top);
  return <div className="atlas-site-profile" ref={ref}><div className="atlas-site-profile-heading"><span className="atlas-inspector-kicker">THE PROFILE FIELD</span><span>{number(sites.length)} sites · circle area = learners</span></div><svg width={width} height={292} viewBox={`0 0 ${width} 292`} tabIndex={0} role="group" aria-label="Synthetic site profiles: deployment rate horizontally and capstone rate vertically; circle area proportional to learner count. Use arrow keys to inspect sites." onKeyDown={(event) => { if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key) && sites.length) { event.preventDefault(); const index = sites.findIndex((site) => site.siteIndex === active?.siteIndex); const next = event.key === 'Home' ? 0 : event.key === 'End' ? sites.length - 1 : (index + (event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 1) + sites.length) % sites.length; onSelect(sites[next].siteIndex); } }}>
      {[0,.25,.5,.75,1].map((ratio) => <g key={ratio}><line x1={left + plotWidth * ratio} x2={left + plotWidth * ratio} y1={top} y2={bottom} className="atlas-grid-line" /><line x1={left} x2={width - right} y1={bottom - (bottom - top) * ratio} y2={bottom - (bottom - top) * ratio} className="atlas-grid-line" /><text x={left + plotWidth * ratio} y={bottom + 20} textAnchor="middle" className="atlas-axis-label">{ratio * 100}%</text><text x={left - 8} y={bottom - (bottom - top) * ratio + 4} textAnchor="end" className="atlas-axis-label">{ratio * 100}%</text></g>)}
      <text x={left} y={14} className="atlas-axis-title">CAPSTONE / ALL LEARNERS</text><text x={width - right} y={bottom + 45} textAnchor="end" className="atlas-axis-title">DEPLOYMENT / ALL LEARNERS</text>
      {[...sites].sort((a,b) => b.students - a.students).map((site) => <g key={site.siteIndex} role="button" tabIndex={-1} aria-label={`${site.code}: ${number(site.students)} learners, ${percent(site.deployed / Math.max(1,site.students))} deployment, ${percent(site.capstones / Math.max(1,site.students))} capstone`} className={`atlas-profile-site${active?.siteIndex === site.siteIndex ? ' is-selected' : ''}`} onClick={() => onSelect(site.siteIndex)}><circle cx={x(site)} cy={y(site)} r={maximumRadius * Math.sqrt(site.students / max)} fill={palette[(site.year - 2024 + 3) % 3]} /><title>{`${site.code} · ${number(site.students)} learners · ${percent(site.deployed / Math.max(1,site.students))} deployment · ${percent(site.capstones / Math.max(1,site.students))} capstone`}</title></g>)}
      {active && <g pointerEvents="none"><line x1={x(active)} x2={x(active)} y1={y(active)} y2={bottom} className="atlas-profile-guide" /><line x1={left} x2={x(active)} y1={y(active)} y2={y(active)} className="atlas-profile-guide" /><circle cx={x(active)} cy={y(active)} r={maximumRadius * Math.sqrt(active.students / max) + 3} className="atlas-profile-selection" /></g>}
    </svg><ChartKey labels={['Starts in 2024', 'Starts in 2025', 'Starts in 2026']} /></div>;
}
function SitesView({ data, showTable, still }: ViewProps) {
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
    <div className="atlas-view-intro"><div><h3>The shape of a learning community.</h3><p>Six measured petals, one fingerprint. Read the communities together in the profile field, then inspect the source measures of any site.</p></div><span className="atlas-total"><strong>{number(data.sites.length)}</strong>synthetic sites in view</span></div>
    <div className="atlas-site-controls"><label><span>Find a synthetic site</span><input type="search" value={query} placeholder="Site code, network, jurisdiction" onChange={(event) => { setQuery(event.target.value); setPage(0); }} /></label><label className="atlas-select"><span>Order by</span><select value={order} onChange={(event) => { setOrder(event.target.value as typeof order); setPage(0); }}><option value="students">Learners in view</option><option value="deployment">Deployment rate</option></select></label></div>
    {showTable ? <DataTable caption="Synthetic site statistics under all active global filters and the local search" headers={['Synthetic site', 'Learners', 'Deployment', 'Public launch', 'Capstone', 'Live 90d / deployed', 'Mean gain', 'Attendance']} rows={matching.map((site) => [site.code, number(site.students), percent(site.deployed / Math.max(1,site.students)), percent(site.launched / Math.max(1,site.students)), percent(site.capstones / Math.max(1,site.students)), percent(site.deployed ? site.live90 / site.deployed : null), site.meanGain === null ? '—' : `${site.meanGain.toFixed(1)} pts`, percent(site.attendanceRate)])} /> : <>
      <SiteProfileField sites={matching} active={active} onSelect={setSelection} />
      <div className="atlas-sites-layout"><div className="atlas-site-gridfield">{visible.map((site) => <button key={site.siteIndex} className={`atlas-site-button${active?.siteIndex === site.siteIndex ? ' is-selected' : ''}`} aria-pressed={active?.siteIndex === site.siteIndex} aria-label={`Inspect ${site.code}: ${number(site.students)} modeled learners`} onClick={() => setSelection(site.siteIndex)}><SiteGlyph site={site} still={still} /><strong>{site.code}</strong><span>{number(site.students)} learners<br />{percent(site.deployed / Math.max(1,site.students))} deployed</span></button>)}</div><aside className="atlas-site-inspector" ref={inspector} aria-live="polite">{active ? <><span className="atlas-inspector-kicker">LOCAL SITE INSPECTION</span><h4>{active.code}</h4><p>{active.network}<br />{active.state} · starts in {active.year}</p><SiteGlyph site={active} large still={still} /><dl>{siteMeasures.map((label, index) => <div key={label}><dt><i style={{ color: palette[index], borderColor: palette[index] }}>{index + 1}</i>{label}</dt><dd>{index === 4 ? `${active.meanGain === null ? '—' : active.meanGain.toFixed(1)} pts` : index === 3 && !active.deployed ? '—' : percent(values[index])}</dd></div>)}</dl></> : <p>No synthetic sites match this search.</p>}</aside></div>
    </>}
    {!showTable && <div className="atlas-pagination"><span>{matching.length ? `${currentPage * 18 + 1}–${Math.min((currentPage + 1) * 18, matching.length)}` : '0'} of {number(matching.length)} sites</span><button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} aria-label="Previous site page"><ChevronLeft size={18} /></button><button disabled={currentPage >= pages - 1} onClick={() => setPage(currentPage + 1)} aria-label="Next site page"><ChevronRight size={18} /></button></div>}
    <p className="atlas-caveat">Clockwise from the top: deployment / all learners, public launch / all, capstone / all, live at 90 days / deployed, mean score gain / 100 points, and attendance / 24 sessions. Radial extent runs 0–100%; negative gain is clipped at zero. Each profile circle is one synthetic site; its area is proportional to learners. Site codes do not identify real clubs. Search and inspection are local and preserve global filters.</p>
  </div>;
}

export default function ImpactAtlas({ dataset, summary, filters, onFiltersChange, exploration, quiet = false }: ImpactAtlasProps) {
  const [tab, setTab] = useState<TabId>(() => {
    const requested = new URLSearchParams(window.location.search).get('atlas');
    return tabs.some((item) => item.id === requested) ? requested as TabId : 'flow';
  });
  const [showTable, setShowTable] = useState(false);
  const section = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(true);
  const [documentVisible, setDocumentVisible] = useState(() => !document.hidden);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const data = useMemo(() => exploration ?? exploreImpact(dataset, filters), [exploration, dataset, filters]);
  const reduced = useReducedMotion();
  const still = quiet || reduced || !visible || !documentVisible;
  useEffect(() => {
    const observer = new IntersectionObserver(entries => { const entry = entries.at(-1); if (entry) setVisible(entry.isIntersecting); });
    if (section.current) observer.observe(section.current);
    const update = () => setDocumentVisible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update); };
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('atlas', tab);
    window.history.replaceState(window.history.state, '', url);
  }, [tab]);
  const chooseTab = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : null;
    if (next !== null) { event.preventDefault(); setTab(tabs[next].id); tabRefs.current[next]?.focus(); }
  };
  return <section ref={section} className="impact-atlas panel" data-atlas-still={still} aria-labelledby="impact-atlas-title">
    <header className="atlas-header"><div><span className="eyebrow">THE ANALYTICAL ATLAS</span><h2 id="impact-atlas-title">Look closer.<br /><em>The pattern changes.</em></h2><p>Five ways to read the same source, from individual pathways to the infrastructure behind them.</p></div><div className="atlas-header-meta"><span className="modeled-label">SYNTHETIC / MODELED</span><strong>{number(summary.students)}</strong><span>records under your filters</span></div></header>
    <div className="atlas-toolbar"><div className="atlas-tabs" role="tablist" aria-label="Impact analytical view">{tabs.map((item, index) => <button ref={(element) => { tabRefs.current[index] = element; }} key={item.id} role="tab" id={`atlas-tab-${item.id}`} aria-controls={`atlas-panel-${item.id}`} aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1} onClick={() => setTab(item.id)} onKeyDown={(event) => chooseTab(event,index)}><item.icon size={17} aria-hidden="true" /><span>{item.label}</span></button>)}</div><button className="atlas-table-toggle" aria-pressed={showTable} onClick={() => setShowTable((value) => !value)}><Table2 size={17} aria-hidden="true" />{showTable ? 'Graphic' : 'Exact table'}</button></div>
    <div className="atlas-tabpanel" role="tabpanel" id={`atlas-panel-${tab}`} aria-labelledby={`atlas-tab-${tab}`} tabIndex={0}>
      {tab === 'flow' && <FlowView dataset={dataset} data={data} filters={filters} onFiltersChange={onFiltersChange} showTable={showTable} still={still} />}
      {tab === 'learning' && <LearningView data={data} showTable={showTable} still={still} />}
      {tab === 'hosting' && <HostingView data={data} filters={filters} onFiltersChange={onFiltersChange} showTable={showTable} still={still} />}
      {tab === 'geography' && <GeographyView data={data} filters={filters} onFiltersChange={onFiltersChange} showTable={showTable} still={still} />}
      {tab === 'sites' && <SitesView data={data} showTable={showTable} still={still} />}
    </div>
    <footer className="atlas-source-footer"><span>ONE SOURCE · EXACT AGGREGATES · 2024–2026</span><p>Generated records for design and evaluation planning. No observed learner, site, or app is represented.</p></footer>
  </section>;
}
