import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Focus, Maximize2, Minus, Move3D, Plus, RotateCcw, Orbit, Pause } from 'lucide-react';
import { enrollmentTimestamp, selectOutcomeRecords } from '../lib/impact-exploration';
import { STAGE_LABELS, type OutcomeFilters, type OutcomesDataset } from '../lib/outcomes';
import { defaultCamera, FIELD_COLORS, StudentFieldRenderer, type FieldCamera, type FieldLayout, type FieldRecord } from '../lib/student-field-renderer';
import '../student-field-cinema.css';

export type FieldScene = FieldLayout;
const scenes: { id: FieldScene; name: string; description: string; axis: string }[] = [
  { id: 'chronology', name: 'Time ribbons', description: 'Exact enrollment date runs left to right. Height groups eventual highest stage; depth separates the three cohort years.', axis: 'ENROLLMENT DATE × FINAL STAGE × COHORT' },
  { id: 'cohorts', name: 'Cohort orbits', description: 'One orbit per cohort year. Angle follows the recorded day within its 63-day season; height groups eventual stage. Within-day spread is schematic.', axis: 'COHORT RADIUS × ENROLLMENT DAY × FINAL STAGE' },
  { id: 'ladder', name: 'Stage helix', description: 'Eight levels follow eventual highest stage. Angle groups the before score, and radius separates cohort years. The helix is schematic, not a dated learning path.', axis: 'FINAL STAGE × BEFORE SCORE × COHORT' },
  { id: 'learning', name: 'Learning space', description: 'Horizontal position is the before score and height is the after score, each on a 0–100 scale. Depth separates cohort years.', axis: 'BEFORE SCORE × AFTER SCORE × COHORT' },
];
const readCamera = (scene: FieldScene): FieldCamera => {
  const value = new URLSearchParams(location.search).get('camera');
  if (!value) return defaultCamera(scene);
  const parts = value.split(',').map(Number);
  return parts.length === 3 && parts.every(Number.isFinite) && Math.abs(parts[0]) <= 6.3 && parts[1] >= -.1 && parts[1] <= 1.4 && parts[2] >= .65 && parts[2] <= 1.5 ? { yaw: parts[0], pitch: parts[1], zoom: parts[2] } : defaultCamera(scene);
};

export default function StudentField({ dataset, filters, date, scene, onSceneChange, quiet }: {
  dataset: OutcomesDataset; filters: OutcomeFilters; date: string; scene: FieldScene;
  onSceneChange: (scene: FieldScene) => void; quiet: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null), overlay = useRef<HTMLCanvasElement>(null), host = useRef<HTMLDivElement>(null);
  const renderer = useRef<StudentFieldRenderer | null>(null);
  const [inspect, setInspect] = useState<number | null>(null);
  const [orbitMode, setOrbitMode] = useState(false), [rotating, setRotating] = useState(() => new URLSearchParams(location.search).get('orbit') !== '0' && !quiet && !matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [camera, setCamera] = useState(() => readCamera(scene));
  const currentCamera = useRef(camera), previousScene = useRef(scene);
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [size, setSize] = useState({ width: 900, height: 600 });
  const [visible, setVisible] = useState(true), [documentVisible, setDocumentVisible] = useState(() => !document.hidden);
  const drag = useRef<{ x: number; y: number; startX: number; startY: number; moved: boolean; allowed: boolean } | null>(null);
  const marks = useMemo(() => Array.from(selectOutcomeRecords(dataset, filters), index => ({ index,
    year: Number(dataset.meta.dict.cohort[dataset.columns.cohort[index]]), stage: dataset.columns.stage[index], day: dataset.columns.eday[index],
    date: enrollmentTimestamp(dataset, index), pre: dataset.columns.pre_total[index] / 10, post: dataset.columns.post_total[index] / 10,
  } satisfies FieldRecord)), [dataset, filters]);
  const asOf = Date.parse(date + 'T23:59:59.999Z');
  const shown = useMemo(() => marks.filter(mark => mark.date <= asOf), [marks, asOf]);
  const counts = useMemo(() => [2024, 2025, 2026].map(year => shown.filter(mark => mark.year === year).length), [shown]);
  const picked = inspect === null ? null : shown[inspect], description = scenes.find(item => item.id === scene)!;

  useEffect(() => {
    if (!canvas.current || !overlay.current) return;
    const engine = new StudentFieldRenderer(canvas.current, overlay.current); renderer.current = engine;
    return () => { engine.dispose(); renderer.current = null; };
  }, []);
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const visibility = () => setDocumentVisible(!document.hidden), motion = () => setReducedMotion(preference.matches);
    document.addEventListener('visibilitychange', visibility); preference.addEventListener('change', motion);
    return () => { document.removeEventListener('visibilitychange', visibility); preference.removeEventListener('change', motion); };
  }, []);
  useEffect(() => {
    if (!host.current) return;
    const resize = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.width < 600 ? 430 : 600 }));
    const intersection = new IntersectionObserver(entries => { const entry = entries.at(-1); if (entry) setVisible(entry.isIntersecting); });
    resize.observe(host.current); intersection.observe(host.current);
    return () => { resize.disconnect(); intersection.disconnect(); };
  }, []);
  useEffect(() => { renderer.current?.resize(size.width, size.height); }, [size]);
  useEffect(() => { renderer.current?.setData(shown, scene); setInspect(null); }, [shown, scene]);
  useEffect(() => {
    if (previousScene.current !== scene) { const next = defaultCamera(scene); currentCamera.current = next; setCamera(next); previousScene.current = scene; }
  }, [scene]);
  useEffect(() => { renderer.current?.setCamera(camera); currentCamera.current = camera; }, [camera]);
  useEffect(() => { renderer.current?.setMotion(quiet || reducedMotion, rotating); if ((quiet || reducedMotion) && rotating) stopOrbit(); }, [quiet, reducedMotion, rotating]);
  useEffect(() => { renderer.current?.setVisible(visible && documentVisible); }, [visible, documentVisible]);
  useEffect(() => { renderer.current?.setInspection(inspect); }, [inspect]);
  useEffect(() => {
    const url = new URL(location.href); url.searchParams.set('camera', [camera.yaw, camera.pitch, camera.zoom].map(value => value.toFixed(3)).join(',')); history.replaceState(history.state, '', url);
  }, [camera]);
  useEffect(() => { const url = new URL(location.href); url.searchParams.set('orbit', rotating ? '1' : '0'); history.replaceState(history.state, '', url); }, [rotating]);

  const commitCamera = (next: FieldCamera) => { const bounded = { yaw: ((next.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI, pitch: Math.max(-.1, Math.min(1.4, next.pitch)), zoom: Math.max(.65, Math.min(1.5, next.zoom)) }; setCamera(bounded); };
  const stopOrbit = () => { setRotating(false); commitCamera(renderer.current?.getCamera() || camera); };
  const rotate = (amount: number) => { setRotating(false); const next = renderer.current?.getCamera() || camera; commitCamera({ ...next, yaw: next.yaw + amount }); };
  const zoom = (amount: number) => { setRotating(false); const next = renderer.current?.getCamera() || camera; commitCamera({ ...next, zoom: next.zoom + amount }); };
  const pointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const allowed = event.pointerType === 'mouse' || orbitMode;
    drag.current = { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false, allowed };
    if (allowed) { event.currentTarget.setPointerCapture(event.pointerId); stopOrbit(); }
  };
  const pointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const state = drag.current; if (!state) return;
    if (Math.hypot(event.clientX - state.startX, event.clientY - state.startY) > 5) state.moved = true;
    if (state.allowed && state.moved) {
      const next = renderer.current?.getCamera() || currentCamera.current;
      next.yaw += (event.clientX - state.x) * .006; next.pitch += (event.clientY - state.y) * .005;
      renderer.current?.setCamera(next); currentCamera.current = renderer.current?.getCamera() || next;
    }
    state.x = event.clientX; state.y = event.clientY;
  };
  const pointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const state = drag.current; drag.current = null;
    if (!state?.moved) { const rect = event.currentTarget.getBoundingClientRect(); setInspect(renderer.current?.pick(event.clientX - rect.left, event.clientY - rect.top) ?? null); }
    else if (state.allowed) commitCamera(currentCamera.current);
  };
  const keyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', 'Escape'].includes(event.key)) return;
    event.preventDefault(); setRotating(false);
    const next = renderer.current?.getCamera() || camera;
    if (event.key === 'Escape') { commitCamera(next); setInspect(null); setOrbitMode(false); }
    else { if (event.key === 'ArrowLeft') next.yaw -= .12; if (event.key === 'ArrowRight') next.yaw += .12; if (event.key === 'ArrowUp') next.pitch -= .08; if (event.key === 'ArrowDown') next.pitch += .08; if (event.key === '+') next.zoom += .1; if (event.key === '-') next.zoom -= .1; commitCamera(next); }
  };

  return <section className="student-field field-cinema" aria-labelledby="student-field-title">
    <div className="exploration-heading"><div><span className="exploration-eyebrow">02 / THE ENROLLMENT CONSTELLATION</span><h2 id="student-field-title">Beneath the numbers,<br/>a universe.</h2><p>Every light is one modeled enrollment. Move through the same data in four dimensions of understanding.</p></div><div className="field-count-instrument"><Focus size={19}/><strong>{shown.length.toLocaleString()}</strong><span>EXACT RECORDS BY {date}</span></div></div>
    <div className="field-mode-controls" role="group" aria-label="Student field layout">{scenes.map((option, index) => <button key={option.id} aria-pressed={scene === option.id} onClick={() => onSceneChange(option.id)}><span aria-hidden="true">0{index + 1}</span><span>{option.name}</span></button>)}</div>
    <div className={'field-stage field-cinema-stage' + (orbitMode ? ' is-orbiting' : '')} ref={host}>
      <div className="field-instrument-label"><i/> ONE LIGHT = ONE MODELED ENROLLMENT</div>
      <div className="field-axis-ledger">{description.axis}</div>
      <div className="field-cinema-corner field-cinema-corner--tl"/><div className="field-cinema-corner field-cinema-corner--br"/>
      <canvas ref={canvas} style={{ width: '100%', height: size.height, touchAction: orbitMode ? 'none' : 'pan-y' }} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => {if(drag.current?.allowed && drag.current.moved)commitCamera(currentCamera.current);drag.current = null;}} onKeyDown={keyDown} tabIndex={0} role="img" aria-describedby="field-camera-help" aria-label={description.name + ': ' + shown.length + ' modeled enrollment records joined by ' + date + '. ' + description.description}/>
      <canvas ref={overlay} className="field-label-overlay" style={{ width: '100%', height: size.height }} aria-hidden="true"/>
      {!shown.length && <div className="field-empty">No selected records had joined by this date.<br/>Move the timeline forward or choose another cohort.</div>}
      <div className="field-camera-bar"><span id="field-camera-help">{orbitMode ? 'Drag to orbit · tap a light to inspect' : 'Drag with a mouse · tap a light to inspect'}</span><div><button onClick={()=>rotate(-.2)} aria-label="Rotate view left"><ChevronLeft size={17}/></button><button onClick={()=>rotate(.2)} aria-label="Rotate view right"><ChevronRight size={17}/></button><button aria-label="Zoom out" onClick={()=>zoom(-.1)}><Minus size={17}/></button><span className="field-zoom-reading">{Math.round(camera.zoom*100)}%</span><button aria-label="Zoom in" onClick={()=>zoom(.1)}><Plus size={17}/></button><button aria-label="Reset camera" onClick={()=>{setRotating(false);commitCamera(defaultCamera(scene));}}><RotateCcw size={16}/></button></div></div>
    </div>
    <div className="field-year-instruments">{counts.map((count,index)=><div key={index} style={{'--year-color':FIELD_COLORS[index]} as React.CSSProperties}><span><i/>{2024+index} COHORT</span><strong>{count.toLocaleString()}</strong><div className="field-year-meter"><b style={{width:(shown.length ? count/shown.length*100 : 0)+'%'}}/></div><small>{shown.length ? (count/shown.length*100).toFixed(1) : '0.0'}% of records by this date</small></div>)}</div>
    <div className="field-interaction-bar"><div><button aria-pressed={orbitMode} onClick={()=>setOrbitMode(!orbitMode)}><Move3D size={17}/>{orbitMode ? 'Exit touch orbit' : 'Touch orbit'}</button><button aria-pressed={rotating} disabled={quiet || reducedMotion} onClick={()=>{if(rotating)commitCamera(renderer.current?.getCamera() || camera);setRotating(!rotating);}}>{rotating?<Pause size={16}/>:<Orbit size={17}/>}Auto orbit</button><button onClick={()=>{setRotating(false);commitCamera(defaultCamera(scene));}}><Maximize2 size={16}/>Frame the data</button></div>{shown.length > 0 && <div className="field-record-navigation"><button aria-label="Previous synthetic record" onClick={()=>setInspect(current=>current===null?0:(current-1+shown.length)%shown.length)}><ChevronLeft size={16}/></button><span>Inspect records</span><button aria-label="Next synthetic record" onClick={()=>setInspect(current=>current===null?0:(current+1)%shown.length)}><ChevronRight size={16}/></button></div>}</div>
    <div className="field-reading"><p>{description.description}</p></div>
    {picked && <div className="field-inspector" role="status"><strong>Synthetic record · {picked.year} cohort</strong><span>Joined {new Date(picked.date).toISOString().slice(0,10)}</span><span>Eventual highest stage: S{picked.stage} · {STAGE_LABELS[picked.stage]}</span><span>Before {picked.pre.toFixed(1)} → after {picked.post.toFixed(1)}</span><button onClick={()=>setInspect(null)}>Close inspection</button></div>}
    <p className="exploration-note">The date cursor filters enrollment. Stages and scores are eventual modeled outcomes without recorded achievement dates. Light, camera motion and spatial transitions do not change the data. All records are synthetic.</p>
  </section>;
}
