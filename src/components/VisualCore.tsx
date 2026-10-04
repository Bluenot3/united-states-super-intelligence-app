import { useEffect, useId, useRef, useState } from 'react';
import type { ThemeId } from '../themes';
import '../theme-studio.css';

interface VisualCoreProps { theme: ThemeId; quiet?: boolean; compact?: boolean }
interface GraphicInstance { destroy: () => void; set?: (options: Record<string, unknown>) => void }
interface GraphicEngine { mount: (canvas: HTMLCanvasElement, options: Record<string, unknown>) => GraphicInstance | null }
declare global {
  interface Window { MeridianCore?: GraphicEngine; ZenithCore?: GraphicEngine; Quicksilver?: GraphicEngine }
}

const scriptLoads = new Map<string, Promise<void>>();
function loadEngine(source: string) {
  const existing = scriptLoads.get(source);
  if (existing) return existing;
  const loaded = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = source;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { scriptLoads.delete(source); reject(new Error('Graphic engine unavailable')); };
    document.head.appendChild(script);
  });
  scriptLoads.set(source, loaded);
  return loaded;
}

const MARK = 'M0 31L12 31L22 21L10 21L10 9L44 9L3 50L0 50L0 75L5 75L10 70L10 57L58 9L77 9L0 86L100 86L100 55L88 55L78 65L90 65L90 77L56 77L97 36L100 36L100 11L95 11L90 16L90 29L42 77L23 77L100 0L0 0Z';

function RingStudy({ theme }: { theme: ThemeId }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const dark = theme === 'treasury' || theme === 'aurora';
  const gold = theme === 'sovereign' || theme === 'vellum';
  const colors = theme === 'aurora' ? ['#a9f0dc', '#939cf8', '#efaacb', '#b7e6de'] : gold ? ['#fff0bd', '#997136', '#e5c578', '#b79650'] : dark ? ['#f4f5f6', '#5c6572', '#c4cbd6', '#737e8d'] : ['#b5d1bc', '#194e3a', '#f0e7cb', '#749779'];
  return (
    <svg className="ring-study" viewBox="0 0 640 580" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-metal`} x1="160" y1="90" x2="470" y2="510" gradientUnits="userSpaceOnUse">{colors.map((color, index) => <stop key={color + index} offset={index / 3} stopColor={color} />)}</linearGradient>
        <radialGradient id={`${id}-glass`}><stop stopColor={colors[0]} stopOpacity=".5" /><stop offset="1" stopColor={colors[1]} stopOpacity=".12" /></radialGradient>
        <filter id={`${id}-shadow`} x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="12" /></filter>
        <filter id={`${id}-glow`}><feGaussianBlur stdDeviation="1.2" /></filter>
      </defs>
      <ellipse cx="320" cy="504" rx="157" ry="16" fill={colors[1]} opacity=".16" filter={`url(#${id}-shadow)`} />
      <g className="sculpture-float">
        <ellipse cx="321" cy="274" rx="214" ry="61" transform="rotate(-29 321 274)" stroke={`url(#${id}-metal)`} strokeWidth="15" />
        <ellipse cx="320" cy="270" rx="173" ry="209" transform="rotate(31 320 270)" stroke={`url(#${id}-metal)`} strokeWidth="10" />
        <ellipse cx="320" cy="270" rx="191" ry="73" transform="rotate(51 320 270)" stroke={`url(#${id}-metal)`} strokeWidth="19" />
        <ellipse cx="320" cy="270" rx="104" ry="172" transform="rotate(-15 320 270)" stroke={`url(#${id}-metal)`} strokeWidth="8" />
        <circle cx="320" cy="270" r="63" fill={`url(#${id}-glass)`} stroke={colors[0]} strokeOpacity=".5" />
        <path d={MARK} transform="translate(286 240) scale(.68)" fill={dark ? '#e7f4ee' : '#153d31'} fillRule="evenodd" opacity=".84" />
        <ellipse cx="321" cy="274" rx="214" ry="61" transform="rotate(-29 321 274)" stroke={colors[0]} strokeOpacity=".45" strokeWidth="1" />
        <circle cx="469" cy="145" r="4" fill={colors[0]} /><circle cx="145" cy="358" r="3" fill={colors[2]} />
      </g>
    </svg>
  );
}

function FoilStudy() {
  return <div className="foil-study"><div className="foil-orbit foil-orbit-a" /><div className="foil-orbit foil-orbit-b" /><img src="/visuals/vellum-lens.png" className="foil-lens" alt="" /><img src="/visuals/vellum-foil.png" className="foil-mark" alt="" /></div>;
}

function AuroraStudy() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return <svg className="aurora-study" viewBox="0 0 640 580" aria-hidden="true"><defs><linearGradient id={`${id}-prism`} x1="130" y1="140" x2="500" y2="420" gradientUnits="userSpaceOnUse"><stop stopColor="#9cebcf" /><stop offset=".28" stopColor="#81bde5" /><stop offset=".56" stopColor="#ac96ff" /><stop offset=".8" stopColor="#f3b8d7" /><stop offset="1" stopColor="#cbefc8" /></linearGradient><radialGradient id={`${id}-halo`}><stop stopColor="#927bf1" stopOpacity=".22" /><stop offset="1" stopColor="#927bf1" stopOpacity="0" /></radialGradient></defs><ellipse cx="320" cy="290" rx="280" ry="248" fill={`url(#${id}-halo)`} /><g className="aurora-ribbons">{Array.from({ length: 38 }, (_, i) => { const shift = i * 2.3; return <path key={i} d={`M ${137 + shift} ${289 - shift * .7} C ${166 + shift} ${84 - shift * .25}, ${425 + shift * .42} ${54 + shift * 1.2}, ${472 - shift * .15} ${207 + shift * .86} S ${355 - shift * .55} ${483 - shift * .43}, ${189 + shift * .49} ${397 - shift * .48} S ${240 + shift} ${232 - shift * .3}, ${374 - shift * .73} ${243 + shift * .3}`} fill="none" stroke={`url(#${id}-prism)`} strokeWidth={i % 4 === 0 ? '2.5' : '.8'} opacity={.35 + i / 90} />; })}</g><circle cx="321" cy="286" r="44" fill="#0b1628" fillOpacity=".66" stroke="#c4e7ee" strokeOpacity=".45" /><path d={MARK} transform="translate(296 264) scale(.5)" fill="#d6f3ed" fillRule="evenodd" /></svg>;
}

export function VisualCore({ theme, quiet = false, compact = false }: VisualCoreProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [observatoryLoaded, setObservatoryLoaded] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(preference.matches);
    sync(); preference.addEventListener('change', sync);
    return () => preference.removeEventListener('change', sync);
  }, []);
  const staticMode = compact || quiet || reducedMotion;
  const hasWebgl = theme === 'meridian' || theme === 'zenith' || theme === 'quicksilver';
  useEffect(() => {
    setReady(false);
    if (staticMode || !hasWebgl) return;
    let disposed = false;
    let instance: GraphicInstance | null = null;
    let mountedCanvas: HTMLCanvasElement | null = null;
    const source = `/visuals/${theme === 'quicksilver' ? 'quicksilver' : theme === 'zenith' ? 'zenith' : 'meridian'}-core.js`;
    loadEngine(source).then(() => {
      if (disposed || !canvasRef.current) return;
      const engine = theme === 'quicksilver' ? window.Quicksilver : theme === 'zenith' ? window.ZenithCore : window.MeridianCore;
      if (!engine) return;
      mountedCanvas = canvasRef.current;
      const callbacks = { onReady: () => { if (!disposed) setReady(true); }, onLost: () => { if (!disposed) setReady(false); } };
      if (theme === 'quicksilver') {
        instance = engine.mount(canvasRef.current, {
          ...callbacks, maxDpr: 1.5, quality: .85,
          camera: { pos: [0, 2.0, 6.8], target: [0, .45, -.15], fov: 38 },
          scene: { wallZ: 2.6, cove: 1.25, light: [.3, 4.6, 1.9], k: .18, exposure: 1.35 },
          wall: { big: '', small: '', label: '', rect: [-2, 1.6, 4, 1.4], texW: 1024 },
          drops: [
            { x: -.74, z: 0, r: .68, tint: [.8, .81, .84] },
            { x: .7, z: -.38, r: .47, tint: [.56, .66, .98] },
            { x: .58, z: .75, r: .35, tint: [.77, .65, .95] },
          ],
        });
      } else {
        instance = engine.mount(canvasRef.current, { ...callbacks, maxDpr: 1.5, zoom: 1.12, introDur: 1.6, speed: .35, bloom: .65, chart: false, tiltSpan: .5, pointerTarget: canvasRef.current.parentElement, segs: 220 });
      }
    }).catch(() => { if (!disposed) setReady(false); });
    return () => {
      disposed = true;
      instance?.destroy();
      if (instance && mountedCanvas) {
        // Free the source armillary's GPU objects when leaving the active theme.
        mountedCanvas.getContext('webgl')?.getExtension('WEBGL_lose_context')?.loseContext();
      }
    };
  }, [theme, staticMode, hasWebgl]);

  return (
    <div className={`visual-core visual-core--${theme}${compact ? ' is-compact' : ''}${staticMode ? ' is-quiet' : ''}`} aria-hidden="true">
      {theme === 'observatory' && <><div className={`observatory-fallback${observatoryLoaded ? ' is-hidden' : ''}`}><RingStudy theme={theme} /></div><img className={`observatory-image${observatoryLoaded ? ' is-loaded' : ''}`} src="/visuals/observatory.png" alt="" onLoad={() => setObservatoryLoaded(true)} onError={() => setObservatoryLoaded(false)} /></>}
      {(theme === 'meridian' || theme === 'zenith') && <img src={`/visuals/${theme}-orbit.png`} className={`core-poster${ready ? ' is-hidden' : ''}`} alt="" />}
      {theme === 'quicksilver' && <div className={`quicksilver-poster-crop${ready ? ' is-hidden' : ''}`}><img src="/visuals/quicksilver-poster.webp" alt="" /></div>}
      {hasWebgl && !staticMode && <canvas ref={canvasRef} className={`core-canvas${ready ? ' is-ready' : ''}`} />}
      {theme === 'arcology' && <img className="arcology-study" src="/visuals/arcology-study.svg" alt="" />}
      {theme === 'vellum' && <FoilStudy />}
      {(theme === 'sovereign' || theme === 'treasury') && <div className="engraved-study"><img src={`/visuals/${theme}-lathe.svg`} className="engraved-lathe" alt="" /><div className="engraved-center"><svg viewBox="0 0 100 86"><path d={MARK} fill="currentColor" fillRule="evenodd" /></svg></div><div className="engraved-ring" /></div>}
      {theme === 'aurora' && <img className="aurora-image" src="/visuals/aurora.png" alt="" />}
    </div>
  );
}

export default VisualCore;
