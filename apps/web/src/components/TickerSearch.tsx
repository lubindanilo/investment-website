/**
 * TickerSearch — input de recherche avec autocomplete par ticker OU nom d'entreprise.
 * Réutilisé par AnalysePage, WatchlistPage et ComparePage (via AddTicker).
 * Source : /api/screener/search?q= (TickerSuggestion[]).
 *
 * Variants :
 *  - "field"   : input plein-width (utilisé Analyse, Watchlist).
 *  - "inline"  : input compact (utilisé ComparePage AddTicker).
 *
 * Sur Enter : submit `value` brut (utile pour Analyse où l'utilisateur peut analyser un
 * ticker inconnu de l'univers screener) — la sélection d'une suggestion l'emporte si elle existe.
 */
import { useEffect, useRef, useState } from 'react';
import type { TickerSuggestion } from '@lubin/shared';
import { api } from '../lib/api.js';
import { Icon } from './ui/primitives.js';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSelect: (ticker: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Tickers déjà choisis à exclure de la liste (utilisé par ComparePage). */
  exclude?: string[];
  /** "field" (plein-width 48px) | "inline" (compact 38-40px). */
  variant?: 'field' | 'inline';
  /** Classes additionnelles sur le wrapper extérieur. */
  className?: string;
  /** Style additionnel sur l'input (largeur/hauteur). */
  inputStyle?: React.CSSProperties;
  /** Texte si aucun résultat. */
  noResultLabel?: string;
  /** Min de caractères avant requête (1 par défaut). */
  minChars?: number;
}

export function TickerSearch({
  value, onChange, onSelect, placeholder,
  autoFocus = false, exclude = [],
  variant = 'field', className, inputStyle, noResultLabel = 'Aucun résultat',
  minChars = 1,
}: Props) {
  const [list, setList] = useState<TickerSuggestion[]>([]);
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Fermeture sur clic extérieur
  useEffect(() => {
    if (!focused) return;
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [focused]);

  // Recherche debounced
  useEffect(() => {
    const q = value.trim();
    if (q.length < minChars) { setList([]); return; }
    let cancelled = false;
    const id = setTimeout(() => {
      api.screener.search(q)
        .then(r => { if (!cancelled) {
          const filtered = exclude.length ? r.filter(s => !exclude.includes(s.ticker)) : r;
          setList(filtered);
          setHighlight(0);
        }})
        .catch(() => { if (!cancelled) setList([]); });
    }, 180);
    return () => { cancelled = true; clearTimeout(id); };
  }, [value, exclude, minChars]);

  const showSuggestions = focused && value.trim().length >= minChars;
  const isField = variant === 'field';
  const inputBaseStyle: React.CSSProperties = isField
    ? { height: 48, paddingLeft: 44, fontSize: 15, width: '100%' }
    : { height: 38, paddingLeft: 36, fontSize: 13.5, letterSpacing: '0.03em' };

  return (
    <div ref={wrapRef} className={className} style={{ position: 'relative', flex: isField ? 1 : undefined }}>
      <Icon
        name="search"
        size={isField ? 18 : 15}
        className={isField ? 'anl-search-icon' : undefined}
        style={isField ? undefined : { position: 'absolute', left: 12, top: 12, color: 'var(--ink-4)' }}
      />
      <input
        className={isField ? 'anl-search-input num' : 'input num'}
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value.toUpperCase())}
        onFocus={() => setFocused(true)}
        onKeyDown={e => {
          if (!showSuggestions || list.length === 0) {
            // Pas de suggestion → Enter soumet la valeur brute (cas Analyse : ticker inconnu de l'univers).
            if (e.key === 'Enter' && value.trim()) {
              e.preventDefault();
              onSelect(value.trim().toUpperCase());
              setFocused(false);
            }
            return;
          }
          if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, list.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
          else if (e.key === 'Enter') {
            e.preventDefault();
            const picked = list[highlight] ?? list[0];
            if (picked) { onSelect(picked.ticker); setFocused(false); }
            else if (value.trim()) { onSelect(value.trim().toUpperCase()); setFocused(false); }
          } else if (e.key === 'Escape') { setFocused(false); }
        }}
        style={{ ...inputBaseStyle, ...inputStyle }}
      />
      {showSuggestions && (
        <div className="card fade-in cmp-suggest" style={isField ? { width: '100%', top: 52 } : undefined}>
          {list.length === 0 && <div className="tiny muted" style={{ padding: '12px 10px' }}>{noResultLabel}</div>}
          {list.map((s, i) => (
            <button
              key={s.ticker}
              type="button"
              className={'cmp-suggest-item' + (i === highlight ? ' is-active' : '')}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => { onSelect(s.ticker); setFocused(false); }}
            >
              <span className="row gap-10">
                <span className="num" style={{ fontWeight: 700, fontSize: 13, minWidth: 56 }}>{s.ticker}</span>
                <span style={{ fontSize: 13, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{s.name ?? s.ticker}</span>
              </span>
              <Icon name="chevronR" size={14} style={{ color: 'var(--ink-4)' }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
