import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, ArrowRight, BookOpen, ChartNoAxesCombined, CircleDot, Compass, Home, Layers3, LockKeyhole, Menu, Palette, RotateCcw, X } from 'lucide-react';
import { THEMES, type ThemeId } from './themes';
import VisualCore from './components/VisualCore';
import ThemeStudio from './components/ThemeStudio';
import Ecosystem from './components/Ecosystem';
import Methodology from './components/Methodology';
import Impact from './components/Impact';
import CohortChart from './components/CohortChart';
import { loadOutcomes, aggregateOutcomes, DEFAULT_FILTERS, type OutcomeFilters } from './lib/outcomes';
import { readAnalysisFilters, writeAnalysisFilters } from './lib/impact-state';
import { publicAsset } from './lib/publicAsset';

type Page = 'overview' | 'impact' | 'ecosystem' | 'themes' | 'methodology';
const nav = [{id:'overview',label:'Overview',icon:Home},{id:'impact',label:'Impact observatory',icon:ChartNoAxesCombined},{id:'ecosystem',label:'Ecosystem',icon:Layers3},{id:'themes',label:'Theme studio',icon:Palette},{id:'methodology',label:'Methodology',icon:BookOpen}] as const;
const readStored = (key:string, fallback:string) => {try{return localStorage.getItem(key)||fallback;}catch{return fallback;}};
const getPage = ():Page => {const p=location.hash.slice(1);return nav.some(n=>n.id===p)?p as Page:'overview';};
const initialTheme = ():ThemeId => {const candidate=new URLSearchParams(location.search).get('theme')||readStored('ussi:theme','observatory');return THEMES.some(t=>t.id===candidate)?candidate as ThemeId:'observatory';};
const fullExperienceUrl = () => {const url=new URL(location.href);url.searchParams.delete('embed');url.hash='impact';return url.href;};

export default function App(){
  const [embedded]=useState(()=>new URLSearchParams(location.search).get('embed')==='data');
  const [page,setPage]=useState<Page>(()=>embedded?'impact':getPage());
  const [theme,setTheme]=useState<ThemeId>(initialTheme);
  const [quiet,setQuiet]=useState(()=>readStored('ussi:quiet',String(matchMedia('(prefers-reduced-motion: reduce)').matches))==='true');
  const [mobileNav,setMobileNav]=useState(false);
  const [dataset,setDataset]=useState<Awaited<ReturnType<typeof loadOutcomes>>|null>(null);
  const [error,setError]=useState('');
  const [filters,setFilters]=useState<OutcomeFilters>({...DEFAULT_FILTERS});
  const [retry,setRetry]=useState(0);
  useEffect(()=>{let alive=true;setError('');loadOutcomes(publicAsset('data')).then(d=>{if(alive){setFilters(readAnalysisFilters(d));setDataset(d);}}).catch(e=>{if(alive)setError(e instanceof Error?e.message:'The reference data could not load.');});return()=>{alive=false;};},[retry]);
  useEffect(()=>{if(dataset)writeAnalysisFilters(filters);},[dataset,filters]);
  useEffect(()=>{if(!dataset)return;const handler=()=>setFilters(readAnalysisFilters(dataset));addEventListener('popstate',handler);return()=>removeEventListener('popstate',handler);},[dataset]);
  useEffect(()=>{const handler=()=>{setPage(embedded?'impact':getPage());setMobileNav(false);window.scrollTo({top:0,behavior:'instant'});};addEventListener('hashchange',handler);return()=>removeEventListener('hashchange',handler);},[embedded]);
  useEffect(()=>{document.documentElement.dataset.theme=theme;document.documentElement.dataset.quiet=String(quiet);try{localStorage.setItem('ussi:theme',theme);localStorage.setItem('ussi:quiet',String(quiet));}catch{/* Session remains usable when storage is unavailable. */}const url=new URL(location.href);url.searchParams.set('theme',theme);history.replaceState(null,'',url);},[theme,quiet]);
  const all=useMemo(()=>dataset?aggregateOutcomes(dataset,DEFAULT_FILTERS):null,[dataset]);
  const navigate=(p:Page)=>{location.hash=p;if(page===p){setMobileNav(false);window.scrollTo({top:0,behavior:'instant'});}};
  const currentTheme=THEMES.find(t=>t.id===theme)!;
  return <div className="app-shell" data-embed={embedded?'data':undefined}>
    <a href="#main" className="skip-link" onClick={e=>{e.preventDefault();document.getElementById('main')?.focus();document.getElementById('main')?.scrollIntoView();}}>Skip to content</a>
    {!embedded&&<aside className={`sidebar ${mobileNav?'sidebar--open':''}`} aria-label="USSI navigation">
      <a href="#overview" className="brand" aria-label="USSI overview"><img src={publicAsset('visuals/zen-mark.svg')} alt="" className="zen-mark"/><span className="wordmark">ussi<span>.</span></span><span className="brand-expanded">UNITED STATES<br/>SUPER INTELLIGENCE</span><span className="brand-credit">by ZEN AI Co.</span></a>
      <button className="nav-close icon-button" onClick={()=>setMobileNav(false)} aria-label="Close navigation"><X/></button>
      <nav>{nav.map(n=><a key={n.id} href={`#${n.id}`} aria-current={page===n.id?'page':undefined}><n.icon size={19} strokeWidth={1.6}/><span>{n.label}</span>{page===n.id&&<i/>}</a>)}</nav>
      <div className="sidebar-statement"><span>PEOPLE.<br/>INTELLIGENCE.<br/>POSSIBILITY.</span><div className="side-orbit" aria-hidden="true"><CircleDot size={120} strokeWidth={.4}/></div></div>
      <div className="sidebar-bottom"><a href="https://arsenal.world" target="_blank" rel="noreferrer"><ArrowUpRight size={17}/><span>Open Arsenal</span><ArrowUpRight size={14}/></a><a href="https://zenai.world" target="_blank" rel="noreferrer"><ArrowUpRight size={17}/><span>ZEN AI Co.</span><ArrowUpRight size={14}/></a><p>A ZEN AI Co. initiative<span>Built for what comes next.</span></p></div>
    </aside>}
    {!embedded&&mobileNav&&<button className="nav-backdrop" onClick={()=>setMobileNav(false)} aria-label="Close navigation"/>}
    <div className="workspace" style={embedded?{marginLeft:0}:undefined}>
      {embedded?<header aria-label="Embedded USSI observatory" style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'12px 20px',padding:'12px clamp(16px,2.5vw,38px)',borderBottom:'1px solid var(--line)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,fontSize:14}}><img src={publicAsset('visuals/zen-mark.svg')} alt="" width={22} height={22}/><span className="topbar-brand">USSI</span><span style={{color:'var(--muted)'}}>AI Pioneer data</span></div>
        <div style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:'10px 18px'}}><label style={{display:'flex',alignItems:'center',gap:8,fontSize:14}}><Palette size={15} aria-hidden="true"/><span>Theme</span><select aria-label="Observatory theme" value={theme} onChange={event=>setTheme(event.target.value as ThemeId)} style={{minHeight:44,maxWidth:170,fontSize:14}}>{THEMES.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</select></label><a className="text-button" href={fullExperienceUrl()} target="_blank" rel="noopener noreferrer" onClick={event=>{event.currentTarget.href=fullExperienceUrl();}} style={{minHeight:44,fontSize:14}}>Open full USSI <ArrowUpRight size={15}/><span className="sr-only"> (opens a new tab)</span></a></div>
      </header>:<header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={()=>setMobileNav(true)}><Menu/></button><span className="topbar-brand">USSI.APP</span><span className="topbar-divider"/><span className="topbar-message">An intelligence ecosystem by ZEN.</span></div><button className="appearance-button" onClick={()=>navigate('themes')}><Palette size={15}/><span>{currentTheme.name}</span><span className="appearance-count">{currentTheme.number}</span></button></header>}
      <main id="main" tabIndex={-1} className={`main-content page-${page}`}>
        {!embedded&&page==='overview'&&<>
          <section className="hero"><div className="hero-copy"><h1>Intelligence,<br/>with consequence<span>.</span></h1><p>People, programs, and powerful tools, connected by ZEN. Move from understanding AI to building something that matters.</p><div className="hero-actions"><button className="button-primary" onClick={()=>navigate('impact')}>Explore the impact <ArrowRight size={17}/></button><button className="text-button" onClick={()=>navigate('ecosystem')}>Meet the ecosystem <ArrowUpRight size={16}/></button></div></div><div className="hero-art"><VisualCore theme={theme} quiet={quiet}/><div className="hero-art-caption"><span>THE {currentTheme.name.toUpperCase()} EDITION</span><button onClick={()=>navigate('themes')}>Discover all nine <ArrowRight size={13}/></button></div></div></section>
          <div className="overview-source"><span className="modeled-label"><CircleDot size={12}/> MODELED REFERENCE DATASET</span><button onClick={()=>navigate('methodology')}>Understand the numbers <ArrowUpRight size={13}/></button></div>
          {all?<div className="overview-stats">{[{value:all.students.toLocaleString(),label:'Modeled learners',note:'Across 2024–2026'},{value:all.deployed.toLocaleString(),label:'Live URL deployments',note:'Modeled learner outcomes'},{value:all.sites.toLocaleString(),label:'Modeled sites',note:`${all.jurisdictions} jurisdictions`},{value:'3',label:'Cohorts, one trajectory',note:'2027 remains sealed'}].map(s=><div key={s.label}><strong>{s.value}</strong><span>{s.label}</span><small>{s.note}</small></div>)}</div>:<div className="data-loading">{error?<>Reference dataset unavailable. <button onClick={()=>setRetry(r=>r+1)}>Try again</button></>:'Decoding the local reference dataset…'}</div>}
          {all&&<CohortChart overview rows={all.cohorts.map(c=>({year:c.year,students:c.students,deployed:c.deployed,capstones:c.capstones}))} onSelect={year=>{setFilters({...DEFAULT_FILTERS,cohort:year as OutcomeFilters['cohort']});navigate('impact');}}/>}
          <div className="section-title"><div><span className="eyebrow">CONNECTED BY ZEN</span><h2>Many platforms. One purpose.</h2></div><button className="text-button" onClick={()=>navigate('ecosystem')}>Explore the ecosystem <ArrowRight size={16}/></button></div><Ecosystem compact/>
          <div className="theme-invitation"><div><Compass size={23}/><span>Same intelligence. A different atmosphere.</span></div><button className="text-button" onClick={()=>navigate('themes')}>Find your USSI <ArrowRight size={16}/></button></div>
        </>}
        {page==='impact'&&(dataset?<Impact dataset={dataset} filters={filters} onFiltersChange={setFilters} quiet={quiet} onQuietChange={setQuiet}/>:<section className="page-header"><h1>Opening the observatory.</h1><p role="status">{error||'Decoding the local modeled dataset…'}</p>{error&&<button className="button-outline" onClick={()=>setRetry(r=>r+1)}><RotateCcw size={16}/>Retry data load</button>}</section>)}
        {!embedded&&page==='ecosystem'&&<Ecosystem/>}
        {!embedded&&page==='themes'&&<ThemeStudio theme={theme} onThemeChange={setTheme} quiet={quiet} onQuietChange={setQuiet}/>}
        {!embedded&&page==='methodology'&&<Methodology/>}
        {!embedded&&<footer className="footer"><span><img src={publicAsset('visuals/zen-mark.svg')} alt=""/> USSI · ZEN AI Co.</span><p>Intelligence becomes valuable when it becomes useful.</p><a href="#methodology">Source & methodology <ArrowUpRight size={13}/></a></footer>}
      </main>
    </div>
  </div>;
}
