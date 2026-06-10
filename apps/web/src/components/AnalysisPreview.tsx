import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TickerPreview } from '../lib/api.js';
import { ScorePill, Icon } from './ui/primitives.js';

/**
 * Aperçu PUBLIC affiché à un visiteur ANONYME sur /analyse/:ticker, à la place d'une
 * redirection sèche vers /signup. Il ne montre QUE le socle déjà servi aux bots (note /10,
 * P/FCF, secteur, opportunité) : aucune donnée nouvelle exposée, et le bot et l'humain
 * voient la même chose (fin du cloaking). Le détail des critères, la valorisation, le suivi
 * et le qualitatif restent derrière l'inscription/Pro (panneau ci-dessous).
 */
type Lang = 'fr' | 'en' | 'es';
function pickLang(l: string): Lang {
  const b = (l || 'fr').toLowerCase().split('-')[0];
  return b === 'en' ? 'en' : b === 'es' ? 'es' : 'fr';
}

interface Copy {
  preview: string;
  scoreLabel: string;
  pfcfLabel: string;
  opp: string;
  gatedTitle: string;
  bullets: string[];
  cta: string;
  haveAccount: string;
  scoreHint: string;
}

const T: Record<Lang, Copy> = {
  fr: {
    preview: 'Aperçu public',
    scoreLabel: 'Note de qualité',
    pfcfLabel: 'Valorisation (P/FCF)',
    opp: 'Opportunité du moment',
    gatedTitle: 'Crée un compte gratuit pour voir l’analyse complète',
    bullets: [
      'Le détail des 10 critères : lesquels sont validés, et pourquoi',
      'La valorisation : le prix d’achat raisonnable face au cours actuel',
      'Le suivi dans ta watchlist et les dates de résultats',
      'L’analyse qualitative (moat, management) avec le Pro',
    ],
    cta: 'Créer un compte gratuit',
    haveAccount: 'J’ai déjà un compte',
    scoreHint: 'sur 10 critères financiers objectifs',
  },
  en: {
    preview: 'Public preview',
    scoreLabel: 'Quality score',
    pfcfLabel: 'Valuation (P/FCF)',
    opp: 'Opportunity right now',
    gatedTitle: 'Create a free account to see the full analysis',
    bullets: [
      'The 10 criteria in detail: which ones pass, and why',
      'The valuation: the reasonable buy price versus the current price',
      'Tracking in your watchlist and earnings dates',
      'The qualitative analysis (moat, management) with Pro',
    ],
    cta: 'Create a free account',
    haveAccount: 'I already have an account',
    scoreHint: 'across 10 objective financial criteria',
  },
  es: {
    preview: 'Vista previa pública',
    scoreLabel: 'Nota de calidad',
    pfcfLabel: 'Valoración (P/FCF)',
    opp: 'Oportunidad ahora mismo',
    gatedTitle: 'Crea una cuenta gratuita para ver el análisis completo',
    bullets: [
      'El detalle de los 10 criterios: cuáles se cumplen y por qué',
      'La valoración: el precio de compra razonable frente al precio actual',
      'El seguimiento en tu watchlist y las fechas de resultados',
      'El análisis cualitativo (foso, gestión) con Pro',
    ],
    cta: 'Crear una cuenta gratuita',
    haveAccount: 'Ya tengo una cuenta',
    scoreHint: 'sobre 10 criterios financieros objetivos',
  },
};

export function AnalysisPreview({ data }: { data: TickerPreview }) {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const S = T[pickLang(i18n.language)];
  const from = `/analyse/${data.ticker}`;

  const score = data.scoreChiffresMax ? Math.round(((data.scoreChiffres ?? 0) / data.scoreChiffresMax) * 10) : 0;
  const hasPfcf = data.pfcfTTM != null && data.pfcfTTM > 0;
  const pfcf = hasPfcf ? `${data.pfcfTTM!.toFixed(1)}×` : null;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 760, margin: '0 auto' }}>
      <div className="row between wide" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div className="col gap-4">
          <span className="tiny muted" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>{S.preview}</span>
          <h1 style={{ margin: 0, fontSize: 24 }}>{data.name ?? data.ticker} <span className="num muted">({data.ticker})</span></h1>
          {data.sector && <span className="tiny muted">{data.sector}</span>}
        </div>
        <ScorePill score={score} />
      </div>

      <div className="row gap-12" style={{ flexWrap: 'wrap' }}>
        <div className="col gap-4" style={{ minWidth: 150 }}>
          <span className="tiny muted">{S.scoreLabel}</span>
          <span className="num" style={{ fontSize: 20, fontWeight: 700 }}>{data.scoreChiffres ?? 0}/{data.scoreChiffresMax ?? 10}</span>
          <span className="tiny muted">{S.scoreHint}</span>
        </div>
        {pfcf && (
          <div className="col gap-4" style={{ minWidth: 150 }}>
            <span className="tiny muted">{S.pfcfLabel}</span>
            <span className="num" style={{ fontSize: 20, fontWeight: 700 }}>{pfcf}</span>
          </div>
        )}
        {data.opportunity && (
          <div className="col gap-4" style={{ minWidth: 150 }}>
            <span className="tiny muted">&nbsp;</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--good-ink)' }}>
              <Icon name="gem" size={14} stroke={2} />{S.opp}
            </span>
          </div>
        )}
      </div>

      {/* Panneau d'inscription inline (pas de redirection sèche). */}
      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <strong style={{ fontSize: 16 }}>{S.gatedTitle}</strong>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14 }}>
          {S.bullets.map((b) => <li key={b}>{b}</li>)}
        </ul>
        <div className="row gap-12" style={{ flexWrap: 'wrap', marginTop: 4 }}>
          <button type="button" className="btn btn-brand" onClick={() => navigate('/signup', { state: { from } })}>
            {S.cta}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/login', { state: { from } })}>
            {S.haveAccount}
          </button>
        </div>
      </div>
    </div>
  );
}
