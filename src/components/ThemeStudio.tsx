import { useEffect, useState } from 'react';
import { Bookmark, Check, Pause, Play } from 'lucide-react';
import { THEMES, type ThemeId } from '../themes';
import { VisualCore } from './VisualCore';
import '../theme-studio.css';

interface ThemeStudioProps {
  theme: ThemeId;
  onThemeChange: (id: ThemeId) => void;
  quiet: boolean;
  onQuietChange: (quiet: boolean) => void;
}

export function ThemeStudio({ theme, onThemeChange, quiet, onQuietChange }: ThemeStudioProps) {
  const [shortlist, setShortlist] = useState<ThemeId[]>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem('ussi:shortlist') || '[]');
      return Array.isArray(saved) ? [...new Set(saved.filter((id): id is ThemeId => THEMES.some((option) => option.id === id)))] : [];
    } catch { return []; }
  });
  const [storageAvailable, setStorageAvailable] = useState(true);
  useEffect(() => {
    try { localStorage.setItem('ussi:shortlist', JSON.stringify(shortlist)); setStorageAvailable(true); } catch { setStorageAvailable(false); }
  }, [shortlist]);
  const toggleKeep = (id: ThemeId) => setShortlist((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  return (
    <section className="theme-studio" id="themes" aria-labelledby="theme-studio-title">
      <div className="theme-studio-intro">
        <div>
          <span className="studio-index">04 / THE DESIGN ATELIER</span>
          <h1 id="theme-studio-title">One intelligence.<br /><em>Many expressions.</em></h1>
        </div>
        <div className="studio-intro-aside">
          <p>Seven worlds from the ZEN design lineage. Two new frontiers for USSI. Choose a world and watch the entire experience change.</p>
          <button type="button" className="studio-motion" aria-pressed={quiet} onClick={() => onQuietChange(!quiet)}>
            {quiet ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
            {quiet ? 'Resume motion' : 'Still mode'}
          </button>
          <p className="studio-shortlist-status" role="status">{shortlist.length ? `${shortlist.length} ${shortlist.length === 1 ? 'world' : 'worlds'} in your shortlist · ${storageAvailable ? 'saved on this device' : 'kept for this visit'}` : 'Keep your favorites to build a shortlist.'}</p>
        </div>
      </div>
      <div className="theme-grid" role="group" aria-label="Choose a visual theme">
        {THEMES.map((option) => {
          const selected = theme === option.id;
          const kept = shortlist.includes(option.id);
          return (
            <article key={option.id} className={`theme-specimen theme-specimen--${option.id}${selected ? ' is-selected' : ''}`}>
              <button type="button" className="theme-preview-button" aria-label={`Preview ${option.name} theme`} aria-pressed={selected} onClick={() => onThemeChange(option.id)}>
              <span className="theme-specimen-art" style={{ background: option.palette[0], color: option.palette[1] }}>
                <span className="theme-number">{option.number}</span>
                <VisualCore theme={option.id} compact quiet />
                {selected && <span className="theme-selected"><Check size={14} aria-hidden="true" /> Selected</span>}
              </span>
              <span className="theme-specimen-body">
                <span className="theme-specimen-title"><strong>{option.name}</strong><span className="theme-swatches" aria-hidden="true">{option.palette.slice(1).map((color) => <i key={color} style={{ background: color }} />)}</span></span>
                <span className="theme-description">{option.description}</span>
                <span className="theme-origin">{option.origin}<span aria-hidden="true">↗</span></span>
              </span>
              </button>
              <div className="theme-keep-row"><button type="button" className={`theme-keep${kept ? ' is-kept' : ''}`} aria-pressed={kept} onClick={() => toggleKeep(option.id)}><Bookmark size={14} fill={kept ? 'currentColor' : 'none'} aria-hidden="true" />{kept ? 'Kept in shortlist' : 'Keep this world'}</button></div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default ThemeStudio;
