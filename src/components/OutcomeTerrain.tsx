import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronLeft, ChevronRight, Minus, Mountain, Plus, RotateCcw, Table2 } from 'lucide-react';
import { buildOutcomeTerrain, DEFAULT_TERRAIN_CAMERA, OutcomeTerrainRenderer, TERRAIN_PAIRS, terrainProbe, type TerrainCamera, type TerrainPair, type TerrainProbe } from '../lib/outcome-terrain';
import type { OutcomeFilters, OutcomesDataset } from '../lib/outcomes';
import '../outcome-terrain.css';

const count = new Intl.NumberFormat('en-US');
const value = (number: number) => Number(number.toFixed(2)).toLocaleString('en-US', { maximumFractionDigits: 2 });
const range = (from: number, to: number, inclusive = false) => `${value(from)}–${value(to)}${inclusive ? ' inclusive' : ' (upper excluded)'}`;
const PAGE_SIZE = 40;
type Mode = 'webgl' | 'canvas2d' | 'unavailable';
const pairFromUrl = (): TerrainPair => {
  const requested = new URLSearchParams(location.search).get('terrain');
  return TERRAIN_PAIRS.some(item => item.id === requested) ? requested as TerrainPair : 'prepost';
};

function ProbeReadout({ probe, xLabel, yLabel }: { probe: TerrainProbe | null; xLabel: string; yLabel: string }) {
  return <div className="terrain-readout" aria-live="polite">
    {probe ? <><div><span className="terrain-overline">EXACT SOURCE BIN</span><strong>{count.format(probe.count)} <small>modeled records</small></strong><p>{xLabel}: {range(probe.xFrom, probe.xTo, probe.upperXInclusive)}<br />{yLabel}: {range(probe.yFrom, probe.yTo, probe.upperYInclusive)}</p></div><div><span className="terrain-overline">LOCAL NEIGHBORHOOD</span><strong>{count.format(probe.neighborhoodCount)} <small>exact records</small></strong><p>{xLabel}: {value(probe.neighborhoodX[0])}–{value(probe.neighborhoodX[1])}<br />{yLabel}: {value(probe.neighborhoodY[0])}–{value(probe.neighborhoodY[1])}<br />Up to 5 × 5 source bins; upper bounds excluded except at the axis maximum.</p></div><div><span className="terrain-overline">SMOOTHED SURFACE</span><strong>{probe.peakPercent.toFixed(1)}% <small>of this view’s peak</small></strong><p>{probe.density.toFixed(2)} Gaussian-weighted records per bin.<br />Fractional density is a visual estimate, not a learner count.</p></div></> : <p className="terrain-probe-empty">Tap the surface or choose a peak to inspect its exact source bin and surrounding neighborhood.</p>}
  </div>;
}

/** Full-cohort eventual outcomes; intentionally independent of the enrollment-date cursor. */
export default function OutcomeTerrain({ dataset, filters, quiet }: { dataset: OutcomesDataset; filters: OutcomeFilters; quiet: boolean }) {
  const [pair, setPair] = useState<TerrainPair>(pairFromUrl);
  const [mode, setMode] = useState<Mode>('webgl');
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [autoOrbit, setAutoOrbit] = useState(false);
  const [touchOrbit, setTouchOrbit] = useState(false);
  const [table, setTable] = useState(false);
  const [page, setPage] = useState(0);
  const [probeIndex, setProbeIndex] = useState<number | null>(null);
  const [visible, setVisible] = useState(true);
  const [documentVisible, setDocumentVisible] = useState(() => !document.hidden);
  const [size, setSize] = useState({ width: 900, height: 530 });
  const host = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), overlay = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<OutcomeTerrainRenderer | null>(null);
  const drag = useRef<{ pointerId: number; x: number; y: number; camera: TerrainCamera; moved: boolean; orbit: boolean } | null>(null);
  const data = useMemo(() => buildOutcomeTerrain(dataset, filters, pair), [dataset, filters, pair]);
  const probe = probeIndex === null ? null : terrainProbe(data, probeIndex);
  const motionLimited = quiet || reducedMotion;

  useEffect(() => {
    const url = new URL(location.href); url.searchParams.set('terrain', pair);
    history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, [pair]);
  useEffect(() => { const restore = () => setPair(pairFromUrl()); addEventListener('popstate', restore); return () => removeEventListener('popstate', restore); }, []);

  useEffect(() => {
    if (!canvas.current || !overlay.current) return;
    const instance = new OutcomeTerrainRenderer(canvas.current, overlay.current, setMode); renderer.current = instance;
    return () => { instance.dispose(); renderer.current = null; };
  }, []);
  useEffect(() => { renderer.current?.setData(data); setProbeIndex(null); setPage(0); }, [data]);
  useEffect(() => { renderer.current?.resize(size.width, size.height); }, [size]);
  useEffect(() => { renderer.current?.setMotion(motionLimited, autoOrbit); }, [motionLimited, autoOrbit]);
  useEffect(() => { renderer.current?.setVisible(visible && documentVisible); }, [visible, documentVisible]);
  useEffect(() => { renderer.current?.setProbe(probeIndex); }, [probeIndex]);
  useEffect(() => {
    if (!host.current) return;
    const resize = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.width < 600 ? 330 : 530 }));
    const intersection = new IntersectionObserver(entries => { const entry = entries.at(-1); if (entry) setVisible(entry.isIntersecting); }, { rootMargin: '80px' });
    resize.observe(host.current); intersection.observe(host.current);
    return () => { resize.disconnect(); intersection.disconnect(); };
  }, []);
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)'), onMotion = () => setReducedMotion(preference.matches), onVisibility = () => setDocumentVisible(!document.hidden);
    preference.addEventListener('change', onMotion); document.addEventListener('visibilitychange', onVisibility);
    return () => { preference.removeEventListener('change', onMotion); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);

  const adjust = (yaw: number, pitch: number, zoom = 0) => { const instance = renderer.current; if (!instance) return; setAutoOrbit(false); const camera = instance.getCamera(); instance.setCamera({ yaw: camera.yaw + yaw, pitch: camera.pitch + pitch, zoom: camera.zoom + zoom }); };
  const reset = () => { setAutoOrbit(false); renderer.current?.setCamera({ ...DEFAULT_TERRAIN_CAMERA }); };
  const inspect = (index: number) => { setAutoOrbit(false); setProbeIndex(index); };
  const startDrag = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!renderer.current || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const orbit = event.pointerType !== 'touch' || touchOrbit;
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, camera: renderer.current.getCamera(), moved: false, orbit };
    if (orbit) event.currentTarget.setPointerCapture(event.pointerId);
    setAutoOrbit(false);
  };
  const moveDrag = (event: PointerEvent<HTMLCanvasElement>) => {
    const current = drag.current; if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.x, dy = event.clientY - current.y;
    if (Math.hypot(dx, dy) > 5) current.moved = true;
    if (current.moved && current.orbit) renderer.current?.setCamera({ yaw: current.camera.yaw - dx * .006, pitch: current.camera.pitch + dy * .004, zoom: current.camera.zoom });
  };
  const endDrag = (event: PointerEvent<HTMLCanvasElement>) => {
    const current = drag.current; if (!current || current.pointerId !== event.pointerId) return;
    if (!current.moved && event.type === 'pointerup') { const bounds = event.currentTarget.getBoundingClientRect(), selected = renderer.current?.pick(event.clientX - bounds.left, event.clientY - bounds.top); if (selected) setProbeIndex(selected.index); }
    drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const pages = Math.max(1, Math.ceil(data.bins.length / PAGE_SIZE)), shownPage = Math.min(page, pages - 1), rows = data.bins.slice(shownPage * PAGE_SIZE, (shownPage + 1) * PAGE_SIZE);
  const canvasLabel = `Dimensional Gaussian-smoothed density of ${count.format(data.eligibleCount)} modeled records. ${data.xAxis.label} versus ${data.yAxis.label}. Height is relative density, not a measured outcome. Mouse drag or enable Touch orbit to rotate; arrow keys rotate; plus and minus zoom; Home resets the camera. Touch scrolling remains available by default. Peak buttons and exact count table are available below.`;

  return <section className="outcome-terrain" aria-labelledby="outcome-terrain-title" data-pair={pair} data-selected-count={data.totalSelected} data-eligible-count={data.eligibleCount}>
    <header className="terrain-heading"><div><span className="terrain-overline">OUTCOME TOPOGRAPHY / EVERY RECORD</span><h2 id="outcome-terrain-title">See the shape<br /><em>of possibility.</em></h2><p>One landscape, thousands of modeled journeys. Follow the ridges to see where outcomes gather.</p></div><div className="terrain-population"><strong>{count.format(data.eligibleCount)}</strong><span>{pair === 'attendance-days' ? 'modeled deployed learners · S2+' : 'modeled learners under your filters'}</span><small>Full selected enrollment period · eventual outcomes</small></div></header>
    <div className="terrain-pair-tabs" role="group" aria-label="Topography measures">{TERRAIN_PAIRS.map(option => <button key={option.id} type="button" aria-pressed={pair === option.id} onClick={() => setPair(option.id)}>{option.label}</button>)}</div>
    <div className={`terrain-instrument${touchOrbit ? ' is-touch-orbit' : ''}`} ref={host} style={{ height: size.height }}>
      <div className="terrain-instrument-top"><span><Mountain size={14} aria-hidden="true" />GAUSSIAN-SMOOTHED DENSITY</span><span>{mode === 'webgl' ? 'DIMENSIONAL SURFACE' : mode === 'canvas2d' ? 'PROJECTED CANVAS FALLBACK' : 'EXACT TABLE AVAILABLE'}</span></div>
      <canvas ref={canvas} className="terrain-surface" style={{ width: '100%', height: size.height }} role="img" aria-label={canvasLabel} tabIndex={0} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onKeyDown={event => { const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'Home']; if (!keys.includes(event.key)) return; event.preventDefault(); if (event.key === 'Home') reset(); else adjust(event.key === 'ArrowLeft' ? -.12 : event.key === 'ArrowRight' ? .12 : 0, event.key === 'ArrowUp' ? .07 : event.key === 'ArrowDown' ? -.07 : 0, event.key === '+' || event.key === '=' ? .08 : event.key === '-' ? -.08 : 0); }} />
      <canvas ref={overlay} className="terrain-overlay" style={{ width: '100%', height: size.height }} aria-hidden="true" />
      {!data.eligibleCount && <div className="terrain-empty">No {pair === 'attendance-days' ? 'deployed ' : ''}records meet these filters.<span>The exact bin total is zero.</span></div>}
      {mode === 'unavailable' && data.eligibleCount > 0 && <div className="terrain-empty">Graphics unavailable in this browser.<span>Use the exact count table below.</span></div>}
      <div className="terrain-instrument-bottom"><span>{touchOrbit ? 'TOUCH ORBIT ON · TAP TO PROBE' : 'SCROLL / TAP · ENABLE TOUCH ORBIT TO ROTATE'}</span><div className="terrain-density-key"><span>0</span><i /><span>Peak</span></div></div>
    </div>
    <div className="terrain-tools"><div className="terrain-camera-tools" role="group" aria-label="Terrain camera"><button type="button" onClick={() => adjust(-.18, 0)} aria-label="Orbit terrain left" title="Orbit left"><ArrowLeft size={16} /></button><button type="button" onClick={() => adjust(.18, 0)} aria-label="Orbit terrain right" title="Orbit right"><ArrowRight size={16} /></button><button type="button" onClick={() => adjust(0, .1)} aria-label="View terrain from higher angle" title="Higher view"><ArrowUp size={16} /></button><button type="button" onClick={() => adjust(0, -.1)} aria-label="View terrain from lower angle" title="Lower view"><ArrowDown size={16} /></button><button type="button" onClick={() => adjust(0, 0, -.1)} aria-label="Zoom terrain out" title="Zoom out"><Minus size={16} /></button><button type="button" onClick={() => adjust(0, 0, .1)} aria-label="Zoom terrain in" title="Zoom in"><Plus size={16} /></button><button type="button" onClick={reset}><RotateCcw size={14} />Reset</button></div><div className="terrain-motion-tools"><button className="terrain-touch-toggle" type="button" aria-pressed={touchOrbit} onClick={() => setTouchOrbit(current => !current)}>{touchOrbit ? 'Touch orbit on' : 'Touch orbit'}</button><button className="terrain-orbit-toggle" type="button" aria-pressed={autoOrbit && !motionLimited} disabled={motionLimited} onClick={() => setAutoOrbit(current => !current)}>{motionLimited ? 'Motion reduced' : autoOrbit ? 'Pause orbit' : 'Slow orbit'}</button></div></div>
    <div className="terrain-metrics"><div><span>EXACT BIN TOTAL</span><strong>{count.format(data.raw.reduce((sum, number) => sum + number, 0))}</strong></div><div><span>GRID / SMOOTHING</span><strong>{data.gridSize} × {data.gridSize}<small>σ {data.sigma} cells</small></strong></div><div><span>PEARSON CORRELATION</span><strong>{data.correlation === null ? '—' : data.correlation.toFixed(3)}<small>all {count.format(data.eligibleCount)} eligible records</small></strong></div></div>
    {data.peaks.length > 0 && <div className="terrain-peaks" role="group" aria-label="Probe modeled density peaks"><span>Probe a ridge</span>{data.peaks.map((peak, index) => <button type="button" key={peak.index} aria-pressed={probeIndex === peak.index} onClick={() => inspect(peak.index)}><b>P{index + 1}</b><span>{value((peak.xFrom + peak.xTo) / 2)} {data.xAxis.unit} / {value((peak.yFrom + peak.yTo) / 2)} {data.yAxis.unit}</span></button>)}</div>}
    <ProbeReadout probe={probe} xLabel={data.xAxis.label} yLabel={data.yAxis.label} />
    <div className="terrain-method"><p>Every eligible record contributes to one exact count bin. The landscape smooths those counts with a mass-preserving Gaussian kernel (σ {data.sigma} bins); height is normalized to this filtered view’s peak. Contours show equal relative density. Heights and colors describe record concentration, with no additional modeled achievements.</p><p>All cohort, track, jurisdiction and delivery filters apply across the full selected enrollment period. The date cursor does not apply here. Scores and stages are eventual modeled outcomes, with no recorded assessment or achievement dates.{pair === 'attendance-days' && ` Only S2+ learners enter deployment timing; ${count.format(data.excludedCount)} selected learners without a deployment are excluded. The full 0–${data.yAxis.max}-day axis preserves outliers.`} All records are synthetic. Correlation describes this source model and does not establish causation.</p><button type="button" onClick={() => setTable(current => !current)} aria-expanded={table} aria-controls="terrain-exact-table"><Table2 size={15} />{table ? 'Hide exact count table' : 'Show exact count table'}</button></div>
    {table && <div className="terrain-table-panel" id="terrain-exact-table"><div className="terrain-table-heading"><div><h3>The counts beneath the landscape.</h3><p>{count.format(data.bins.length)} nonzero bins; all other bins have zero records. Sorted by exact count. Final bins include the axis maximum.</p></div><strong>{count.format(data.eligibleCount)}<small>eligible / {count.format(data.totalSelected)} selected</small></strong></div><div className="terrain-table-scroll"><table><caption>Exact unsmoothed 2D count bins for {data.title}, under all four active filters.</caption><thead><tr><th scope="col">{data.xAxis.label}</th><th scope="col">{data.yAxis.label}</th><th scope="col">Exact records</th><th scope="col">Share of eligible</th><th scope="col">Probe</th></tr></thead><tbody>{rows.map(bin => <tr key={bin.index} className={probeIndex === bin.index ? 'is-probed' : ''}><td>{range(bin.xFrom, bin.xTo, bin.upperXInclusive)}</td><td>{range(bin.yFrom, bin.yTo, bin.upperYInclusive)}</td><td>{count.format(bin.count)}</td><td>{data.eligibleCount ? (bin.count / data.eligibleCount * 100).toFixed(2) : '0'}%</td><td><button type="button" onClick={() => inspect(bin.index)} aria-label={`Probe source bin with ${bin.count} modeled records`}>Inspect</button></td></tr>)}{!rows.length && <tr><td colSpan={5}>No records in these bins under the selected filters.</td></tr>}</tbody></table></div><div className="terrain-pagination"><span>{data.bins.length ? `${shownPage * PAGE_SIZE + 1}–${Math.min((shownPage + 1) * PAGE_SIZE, data.bins.length)}` : '0'} of {count.format(data.bins.length)} nonzero bins</span><div><button type="button" disabled={shownPage === 0} onClick={() => setPage(shownPage - 1)} aria-label="Previous terrain bin page"><ChevronLeft size={17} /></button><button type="button" disabled={shownPage === pages - 1} onClick={() => setPage(shownPage + 1)} aria-label="Next terrain bin page"><ChevronRight size={17} /></button></div></div></div>}
  </section>;
}
