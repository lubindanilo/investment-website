/**
 * DividendBlock — résumé dividende (Yahoo) : rendement, dividende/action, payout, prochaine
 * ex-date. Affiche « Ne verse pas de dividende » proprement pour les valeurs concernées.
 */
import { useTranslation } from 'react-i18next';
import type { DividendInfo } from '@lubin/shared';
import { Icon } from './ui/primitives.js';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T12:00:00Z');
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="col gap-2" style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--line)', minWidth: 120, flex: 1 }}>
      <span className="tiny muted">{label}</span>
      <span className="num" style={{ fontWeight: 700, fontSize: 16 }}>{value}</span>
    </div>
  );
}

export function DividendBlock({ dividend, currency = 'USD' }: { dividend: DividendInfo; currency?: string }) {
  const { t } = useTranslation();
  const sym = currency === 'USD' ? '$' : `${currency} `;

  if (!dividend.paysDividend) {
    return (
      <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ink-3)' }}>
        <Icon name="x" size={16} />
        <span style={{ fontSize: 14, fontWeight: 600 }}>{t('dividend.none')}</span>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: '18px 20px', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      <Stat label={t('dividend.yield')} value={dividend.yieldPct != null ? `${dividend.yieldPct.toFixed(2)} %` : '—'} />
      <Stat label={t('dividend.rate')} value={dividend.ratePerShare != null ? `${sym}${dividend.ratePerShare.toFixed(2)}` : '—'} />
      <Stat label={t('dividend.payout')} value={dividend.payoutRatioPct != null ? `${dividend.payoutRatioPct.toFixed(0)} %` : '—'} />
      <Stat label={t('dividend.exDate')} value={fmtDate(dividend.exDate)} />
    </div>
  );
}
