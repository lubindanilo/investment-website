import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type {
  AnalyzeResponse,
  LocalizedText,
  ResilienceAnalysis,
  ResilienceAuditValue,
  ResilienceCriterion,
  ResilienceCriterionId,
} from '@lubin/shared';
import { Icon } from './ui/primitives.js';
import './ResilienceAnalysis.css';

type ResilienceLang = keyof LocalizedText;

const CRITERION_IDS: ResilienceCriterionId[] = [
  'moat',
  'disruption_resilience',
  'residual_dependencies',
  'structural_demand_capture',
  'economic_persistence',
  'recurrence_balance',
];

function currentLang(language: string): ResilienceLang {
  if (language.toLowerCase().startsWith('en')) return 'en';
  if (language.toLowerCase().startsWith('es')) return 'es';
  return 'fr';
}

function qualityTone(score: number) {
  if (score >= 8) return 'var(--good)';
  if (score >= 6) return 'var(--warn)';
  return 'var(--bad)';
}

function resilienceTone(analysis: ResilienceAnalysis | null) {
  if (!analysis?.grade) return 'var(--ink-4)';
  if (analysis.grade === 'A') return 'var(--good)';
  if (analysis.grade === 'B') return 'var(--brand)';
  if (analysis.grade === 'C') return 'var(--warn)';
  return 'var(--bad)';
}

function ringStyle(color: string, score: number | null): CSSProperties {
  return {
    '--score-ring-color': color,
    '--score-ring-progress': `${Math.max(0, Math.min(score ?? 0, 100))}%`,
  } as CSSProperties;
}

export function AnalysisHeader({
  analysis,
  qualityScore,
  watched,
  onWatch,
}: {
  analysis: AnalyzeResponse;
  qualityScore: number;
  watched: boolean;
  onWatch: () => void;
}) {
  const { t, i18n } = useTranslation();
  const lang = currentLang(i18n.language);
  const resilience = analysis.resilience ?? null;
  const resilienceScore = resilience?.finalScore ?? null;
  const currency = analysis.currency || 'USD';

  return (
    <section className="card anl-analysis-head" aria-labelledby="analysis-company-name">
      <div className="anl-company-head">
        <div>
          <div className="anl-company-line">
            <h1 id="analysis-company-name" className="anl-company">{analysis.company}</h1>
            <span className="num anl-ticker-badge">{analysis.ticker}</span>
          </div>
          {analysis.price != null && (
            <div className="num anl-price">{currency} {analysis.price.toFixed(2)}</div>
          )}
        </div>
        <button className={`btn ${watched ? 'btn-soft' : 'btn-muted'}`} onClick={onWatch}>
          {watched
            ? <><Icon name="check" size={16} /> {t('analyse.inWatchlist')}</>
            : <><Icon name="plus" size={16} /> {t('analyse.addToWatchlist')}</>}
        </button>
      </div>

      <div className="anl-score-stories" aria-label={t('analyse.scoreStoriesLabel')}>
        <div className="anl-score-story">
          <div className="anl-score-unit">
            <div
              className="anl-score-ring"
              style={ringStyle(qualityTone(qualityScore), qualityScore * 10)}
              aria-label={t('analyse.qualityScoreLabel', { score: qualityScore })}
            >
              <div className="anl-score-ring-inner">
                <span className="num anl-quality-number">{qualityScore}<small>/10</small></span>
              </div>
            </div>
            <span className="anl-score-kind">{t('analyse.quality')}</span>
          </div>
          <p className="anl-score-story-text">{analysis.qualityVerdict}</p>
        </div>

        <div className="anl-score-story">
          <div className="anl-score-unit">
            <div
              className={`anl-score-ring${resilienceScore == null ? ' is-pending' : ''}`}
              style={ringStyle(resilienceTone(resilience), resilienceScore)}
              aria-label={resilienceScore == null
                ? t('analyse.resiliencePendingShort')
                : t('analyse.resilienceScoreLabel', { grade: resilience!.grade, score: resilienceScore })}
            >
              <div className="anl-score-ring-inner">
                <span className="anl-resilience-grade">{resilience?.grade ?? '-'}</span>
                <span className="num anl-resilience-number">
                  {resilienceScore == null ? t('analyse.resiliencePendingShort') : `${resilienceScore}/100`}
                </span>
              </div>
            </div>
            <span className="anl-score-kind">{t('analyse.resilience')}</span>
          </div>
          <p className="anl-score-story-text">
            {resilience ? resilience.verdict[lang] : t('analyse.resiliencePendingVerdict')}
          </p>
        </div>
      </div>
    </section>
  );
}

function criterionTone(criterion: ResilienceCriterion) {
  if (criterion.score == null) return 'review';
  const ratio = criterion.score / criterion.maxScore;
  if (ratio === 1) return 'strong';
  if (ratio >= 0.66) return 'solid';
  if (ratio >= 0.5) return 'mixed';
  return 'fragile';
}

type AuditTone = 'positive' | 'neutral' | 'negative';

interface AuditRow {
  label: string;
  value: string;
  tone: AuditTone;
}

type AuditRecord = Record<string, ResilienceAuditValue>;

function auditRecord(value: ResilienceAuditValue | undefined): AuditRecord | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as AuditRecord
    : null;
}

function auditRecords(value: ResilienceAuditValue | undefined): AuditRecord[] {
  return Array.isArray(value)
    ? value.map(auditRecord).filter((item): item is AuditRecord => item != null)
    : [];
}

function auditString(value: ResilienceAuditValue | undefined): string | null {
  return typeof value === 'string' ? value : null;
}

function auditBoolean(value: ResilienceAuditValue | undefined): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function auditNumber(value: ResilienceAuditValue | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function auditLocalizedText(value: ResilienceAuditValue | undefined, lang: ResilienceLang): string | null {
  const record = auditRecord(value);
  const localized = record?.[lang];
  if (typeof localized === 'string' && localized.trim()) return localized;
  return typeof value === 'string' && value.trim() ? value : null;
}

function humanizeAuditValue(value: string, t: TFunction): string {
  const key = `analyse.resilienceAudit.values.${value}`;
  const translated = t(key);
  if (translated !== key) return translated;
  return value.replaceAll('_', ' ').replace(/^./, letter => letter.toUpperCase());
}

function booleanAuditRow(label: string, value: boolean | null, t: TFunction, positiveWhen = true): AuditRow | null {
  if (value == null) return {
    label,
    value: t('analyse.resilienceUnknown'),
    tone: 'neutral',
  };
  return {
    label,
    value: t(`analyse.resilienceAudit.${value ? 'yes' : 'no'}`),
    tone: value === positiveWhen ? 'positive' : 'negative',
  };
}

function metricAuditRow(
  label: string,
  value: number | null,
  lang: ResilienceLang,
  t: TFunction,
  suffix = '',
): AuditRow {
  return {
    label,
    value: value == null
      ? t('analyse.resilienceUnknown')
      : `${new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(value)}${suffix}`,
    tone: 'neutral',
  };
}

function criterionAuditRows(criterion: ResilienceCriterion, t: TFunction, lang: ResilienceLang): AuditRow[] {
  const audit = criterion.audit;
  const rows: Array<AuditRow | null> = [];

  if (criterion.id === 'moat') {
    for (const engine of auditRecords(audit.engines)) {
      const type = auditString(engine.type);
      const qualification = auditString(engine.qualification);
      const independent = auditBoolean(engine.independent);
      if (!type || independent == null) continue;
      rows.push({
        label: humanizeAuditValue(type, t),
        value: `${qualification ? humanizeAuditValue(qualification, t) : t('analyse.resilienceAudit.notQualified')} · ${t(`analyse.resilienceAudit.${independent ? 'independent' : 'notIndependent'}`)}`,
        tone: independent && qualification ? 'positive' : 'neutral',
      });
      const engineLabel = humanizeAuditValue(type, t);
      const barrierBasis = auditString(engine.barrierBasis);
      if (barrierBasis) rows.push({
        label: `${engineLabel} · ${t('analyse.resilienceAudit.barrierBasis')}`,
        value: barrierBasis === 'none'
          ? t('analyse.resilienceAudit.noBarrierEvidence')
          : humanizeAuditValue(barrierBasis, t),
        tone: barrierBasis === 'none' ? 'negative' : 'neutral',
      });
      const rentBasis = auditString(engine.rentBasis);
      if (rentBasis) rows.push({
        label: `${engineLabel} · ${t('analyse.resilienceAudit.rentBasis')}`,
        value: rentBasis === 'none'
          ? t('analyse.resilienceAudit.noRentEvidence')
          : humanizeAuditValue(rentBasis, t),
        tone: rentBasis === 'none' ? 'negative' : 'neutral',
      });
      const rentEvidenceStrength = auditString(engine.rentEvidenceStrength);
      if (rentEvidenceStrength) rows.push({
        label: `${engineLabel} · ${t('analyse.resilienceAudit.rentEvidenceStrength')}`,
        value: rentEvidenceStrength === 'none'
          ? t('analyse.resilienceAudit.noRentEvidence')
          : humanizeAuditValue(rentEvidenceStrength, t),
        tone: ['direct_quantified', 'multi_year_lead', 'dominant_share_current_plus_durable_barrier']
          .includes(rentEvidenceStrength) ? 'positive' : 'negative',
      });
      const migrationSeverity = auditString(engine.migrationSeverity);
      if (migrationSeverity) rows.push({
        label: `${engineLabel} · ${t('analyse.resilienceAudit.migrationSeverity')}`,
        value: humanizeAuditValue(migrationSeverity, t),
        tone: ['quantified_high', 'multi_system_revalidation'].includes(migrationSeverity)
          ? 'positive'
          : 'neutral',
      });
      const moatEvidenceFields: Array<[string, ResilienceAuditValue | undefined]> = [
        [t('analyse.resilienceAudit.independenceBasis'), engine.independenceBasis],
        [t('analyse.resilienceAudit.replicationEvidence'), engine.replicationEvidence],
        [t('analyse.resilienceAudit.substitutionEvidence'), engine.substitutionEvidence],
      ];
      for (const [label, rawValue] of moatEvidenceFields) {
        const value = auditString(rawValue);
        if (value) rows.push({
          label: `${engineLabel} · ${label}`,
          value: humanizeAuditValue(value, t),
          tone: value === 'unproven' ? 'neutral' :
            ['same_rent_mechanism', 'majority_path_under_3y', 'ordinary_inconvenience', 'none']
              .includes(value) ? 'negative' : 'positive',
        });
      }
      rows.push(
        booleanAuditRow(
          `${engineLabel} · ${t('analyse.resilienceAudit.barrierObserved')}`,
          auditBoolean(engine.barrierObserved),
          t,
        ),
        booleanAuditRow(
          `${engineLabel} · ${t('analyse.resilienceAudit.rentObserved')}`,
          auditBoolean(engine.rentObserved),
          t,
        ),
        booleanAuditRow(
          `${engineLabel} · ${t('analyse.resilienceAudit.rentEvidenceQualified')}`,
          auditBoolean(engine.rentEvidenceQualified),
          t,
        ),
        booleanAuditRow(
          `${engineLabel} · ${t('analyse.resilienceAudit.replicationHard')}`,
          auditBoolean(engine.replicationHard),
          t,
        ),
        booleanAuditRow(
          `${engineLabel} · ${t('analyse.resilienceAudit.substitutionPenalty')}`,
          auditBoolean(engine.substitutionPenalty),
          t,
        ),
      );
      const barrierDurationYears = auditNumber(engine.barrierDurationYears);
      if (barrierDurationYears != null) rows.push({
        label: `${engineLabel} · ${t('analyse.resilienceAudit.durability')}`,
        value: t('analyse.resilienceAudit.durationYears', { count: barrierDurationYears }),
        tone: barrierDurationYears >= 5 ? 'positive' : 'neutral',
      });
      const networkEffect = auditRecord(engine.networkEffect);
      if (networkEffect) rows.push(
        booleanAuditRow(
          t('analyse.resilienceAudit.participantValueGrowth'),
          auditBoolean(networkEffect.participantValueGrowth),
          t,
        ),
        booleanAuditRow(
          t('analyse.resilienceAudit.participantInteraction'),
          auditBoolean(networkEffect.participantInteraction),
          t,
        ),
        booleanAuditRow(
          t('analyse.resilienceAudit.meaningfulMultihomingCost'),
          auditBoolean(networkEffect.meaningfulMultihomingCost),
          t,
        ),
      );
      const networkEffectEvidence = auditRecord(engine.networkEffectEvidence);
      if (networkEffectEvidence) {
        const networkEvidenceFields: Array<[string, ResilienceAuditValue | undefined]> = [
          [t('analyse.resilienceAudit.networkValueMechanism'), networkEffectEvidence.valueMechanism],
          [t('analyse.resilienceAudit.networkInteractionMechanism'), networkEffectEvidence.interactionMechanism],
          [t('analyse.resilienceAudit.networkMultihomingEvidence'), networkEffectEvidence.multihomingEvidence],
        ];
        for (const [label, rawValue] of networkEvidenceFields) {
          const value = auditString(rawValue);
          if (value) rows.push({ label, value: humanizeAuditValue(value, t), tone: 'neutral' });
        }
      }
    }
    const bottleneckEvidence = auditString(audit.bottleneckEvidence);
    if (bottleneckEvidence) rows.push({
      label: t('analyse.resilienceAudit.bottleneckEvidence'),
      value: humanizeAuditValue(bottleneckEvidence, t),
      tone: bottleneckEvidence === 'company_controlled_fewer_than_3_substitutes' ? 'positive' : 'neutral',
    });
    const bottleneck = auditBoolean(audit.monopolyBottleneck);
    if (bottleneck != null) rows.push({
      label: t('analyse.resilienceAudit.monopolyBottleneck'),
      value: t(`analyse.resilienceAudit.${bottleneck ? 'yes' : 'no'}`),
      tone: bottleneck ? 'positive' : 'neutral',
    });
  }

  if (criterion.id === 'disruption_resilience') {
    for (const disruption of auditRecords(audit.disruptions)) {
      const name = auditLocalizedText(disruption.name, lang);
      const verdict = auditNumber(disruption.verdict);
      if (!name || verdict == null) continue;
      rows.push({
        label: name,
        value: t(`analyse.resilienceAudit.verdict.${verdict}`),
        tone: verdict > 0 ? 'positive' : verdict < 0 ? 'negative' : 'neutral',
      });
      const archetype = auditString(disruption.archetype);
      if (archetype) rows.push({
        label: t('analyse.resilienceAudit.disruptionArchetype'),
        value: humanizeAuditValue(archetype, t),
        tone: 'neutral',
      });
      const substitutionScope = auditString(disruption.substitutionScope);
      if (substitutionScope) rows.push({
        label: t('analyse.resilienceAudit.substitutionScope'),
        value: humanizeAuditValue(substitutionScope, t),
        tone: substitutionScope === 'majority_core' ? 'negative' : 'neutral',
      });
      const chinaChecklist = auditRecord(disruption.chinaChecklist);
      if (chinaChecklist) {
        const chinaFields: Array<[string, ResilienceAuditValue | undefined, AuditTone]> = [
          [t('analyse.resilienceAudit.chinaCoreExposure'), chinaChecklist.coreExposure, 'neutral'],
          [t('analyse.resilienceAudit.chinaCostQualityPosition'), chinaChecklist.competitorCostQualityPosition, 'neutral'],
          [t('analyse.resilienceAudit.chinaLeverage'), chinaChecklist.companyChinaLeverage, 'neutral'],
          [t('analyse.resilienceAudit.chinaProtection'), chinaChecklist.protection, 'neutral'],
        ];
        for (const [label, rawValue, tone] of chinaFields) {
          const value = auditString(rawValue);
          if (value) rows.push({ label, value: humanizeAuditValue(value, t), tone });
        }
        rows.push(booleanAuditRow(
          t('analyse.resilienceAudit.chinaMajorityPressure'),
          auditBoolean(disruption.chinaMajorityPressure),
          t,
          false,
        ));
      }
      rows.push(
        booleanAuditRow(
          t('analyse.resilienceAudit.threatObserved'),
          auditBoolean(disruption.threatObserved),
          t,
          false,
        ),
        booleanAuditRow(
          t('analyse.resilienceAudit.directCoreSubstitution'),
          auditBoolean(disruption.directCoreSubstitution),
          t,
          false,
        ),
        booleanAuditRow(
          t('analyse.resilienceAudit.credibleResponse'),
          auditBoolean(disruption.credibleResponse),
          t,
        ),
        booleanAuditRow(
          t('analyse.resilienceAudit.responseCurrentlyMonetized'),
          auditBoolean(disruption.responseCurrentlyMonetized),
          t,
        ),
        booleanAuditRow(
          t('analyse.resilienceAudit.materialResponse'),
          auditBoolean(disruption.materialResponse),
          t,
        ),
        booleanAuditRow(
          t('analyse.resilienceAudit.netBenefitObserved'),
          auditBoolean(disruption.netBenefitObserved),
          t,
        ),
      );
      const responseRelevance = auditString(disruption.responseRelevance);
      if (responseRelevance) rows.push({
        label: t('analyse.resilienceAudit.responseRelevance'),
        value: humanizeAuditValue(responseRelevance, t),
        tone: responseRelevance === 'direct' ? 'positive' :
          responseRelevance === 'unrelated' ? 'negative' : 'neutral',
      });
      const threatMetric = auditRecord(disruption.threatMetric);
      const threatMetricKind = auditString(threatMetric?.kind);
      if (threatMetricKind) {
        const metricValue = auditNumber(threatMetric?.value);
        const metricPeriod = auditString(threatMetric?.period);
        const parts = [humanizeAuditValue(threatMetricKind, t)];
        if (metricValue != null) parts.push(`${metricValue}%`);
        if (metricPeriod) parts.push(metricPeriod);
        rows.push({
          label: t('analyse.resilienceAudit.threatMetric'),
          value: parts.join(' · '),
          tone: auditBoolean(disruption.threatObserved) ? 'negative' : 'neutral',
        });
      }
      const responseMetric = auditRecord(disruption.responseMetric);
      const metricKind = auditString(responseMetric?.kind);
      if (metricKind) {
        const metricValue = auditNumber(responseMetric?.value);
        const metricPeriod = auditString(responseMetric?.period);
        const metricAttribution = auditString(responseMetric?.attribution);
        const parts = [humanizeAuditValue(metricKind, t)];
        if (metricValue != null) parts.push(`${metricValue}%`);
        if (metricPeriod) parts.push(metricPeriod);
        if (metricAttribution) parts.push(humanizeAuditValue(metricAttribution, t));
        rows.push({
          label: t('analyse.resilienceAudit.responseMetric'),
          value: parts.join(' · '),
          tone: auditBoolean(disruption.materialResponse) ? 'positive' : 'neutral',
        });
      }
      const benefitMetric = auditRecord(disruption.benefitMetric);
      const benefitMetricKind = auditString(benefitMetric?.kind);
      if (benefitMetricKind) {
        const metricValue = auditNumber(benefitMetric?.value);
        const metricPeriod = auditString(benefitMetric?.period);
        const metricAttribution = auditString(benefitMetric?.attribution);
        const parts = [humanizeAuditValue(benefitMetricKind, t)];
        if (metricValue != null) parts.push(`${metricValue}%`);
        if (metricPeriod) parts.push(metricPeriod);
        if (metricAttribution) parts.push(humanizeAuditValue(metricAttribution, t));
        rows.push({
          label: t('analyse.resilienceAudit.benefitMetric'),
          value: parts.join(' · '),
          tone: auditBoolean(disruption.netBenefitObserved) ? 'positive' : 'neutral',
        });
      }
      if (auditBoolean(disruption.directCoreSubstitutionUnanswered)) rows.push({
        label: t('analyse.resilienceAudit.unansweredSubstitution'),
        value: name,
        tone: 'negative',
      });
    }
  }

  if (criterion.id === 'residual_dependencies') {
    const registryCompleteness = auditString(audit.registryCompleteness);
    if (registryCompleteness) rows.push({
      label: t('analyse.resilienceAudit.registryCompleteness'),
      value: humanizeAuditValue(registryCompleteness, t),
      tone: registryCompleteness === 'registry_not_established' ? 'neutral' : 'positive',
    });
    const registryCoverage = auditRecord(audit.registryCoverage);
    if (registryCoverage) {
      for (const [kind, rawOutcome] of Object.entries(registryCoverage)) {
        const outcome = auditString(rawOutcome);
        if (!outcome) continue;
        rows.push({
          label: `${t('analyse.resilienceAudit.registryCoverage')} · ${humanizeAuditValue(kind, t)}`,
          value: humanizeAuditValue(outcome, t),
          tone: outcome === 'material_dependency_listed' ? 'negative' :
            ['identified_materiality_unproven', 'unproven'].includes(outcome) ? 'neutral' : 'positive',
        });
      }
    }
    for (const dependency of auditRecords(audit.dependencies)) {
      const kind = auditString(dependency.kind);
      const mitigation = auditString(dependency.mitigation);
      if (!kind || !mitigation) continue;
      rows.push({
        label: humanizeAuditValue(kind, t),
        value: humanizeAuditValue(mitigation, t),
        tone: mitigation === 'strong' ? 'positive' : mitigation === 'medium' ? 'neutral' : 'negative',
      });
      rows.push(booleanAuditRow(
        `${humanizeAuditValue(kind, t)} · ${t('analyse.resilienceAudit.materialDependency')}`,
        auditBoolean(dependency.material),
        t,
        false,
      ));
      const materialityBasis = auditString(dependency.materialityBasis);
      if (materialityBasis) rows.push({
        label: `${humanizeAuditValue(kind, t)} · ${t('analyse.resilienceAudit.materialityBasis')}`,
        value: humanizeAuditValue(materialityBasis, t),
        tone: materialityBasis === 'unproven' ? 'neutral' :
          materialityBasis === 'below_threshold' ? 'positive' : 'negative',
      });
      const continuityImpact = auditString(dependency.continuityImpact);
      if (continuityImpact) rows.push({
        label: `${humanizeAuditValue(kind, t)} · ${t('analyse.resilienceAudit.continuityImpact')}`,
        value: humanizeAuditValue(continuityImpact, t),
        tone: continuityImpact === 'core_impossible_over_24m' ? 'negative' :
          continuityImpact === 'unproven' ? 'neutral' : 'neutral',
      });
      if (auditBoolean(dependency.existentialityUnproven)) rows.push({
        label: `${humanizeAuditValue(kind, t)} · ${t('analyse.resilienceAudit.existentialityUnproven')}`,
        value: t('analyse.resilienceUnknown'),
        tone: 'neutral',
      });
      const riskCluster = auditString(dependency.riskCluster);
      if (riskCluster) rows.push({
        label: `${humanizeAuditValue(kind, t)} · ${t('analyse.resilienceAudit.riskCluster')}`,
        value: humanizeAuditValue(riskCluster, t),
        tone: 'neutral',
      });
      const geographicChecklist = auditRecord(dependency.geographicChecklist);
      if (geographicChecklist) {
        const affectedCoreShare = auditString(geographicChecklist.affectedCoreShare);
        const independentZones = auditString(geographicChecklist.independentZones);
        if (affectedCoreShare) rows.push({
          label: t('analyse.resilienceAudit.geographicAffectedCoreShare'),
          value: humanizeAuditValue(affectedCoreShare, t),
          tone: affectedCoreShare === 'majority' ? 'negative' : 'neutral',
        });
        if (independentZones) rows.push({
          label: t('analyse.resilienceAudit.geographicIndependentZones'),
          value: humanizeAuditValue(independentZones, t),
          tone: independentZones === 'three_plus' ? 'positive' : independentZones === 'one' ? 'negative' : 'neutral',
        });
      }
      const laborChecklist = auditRecord(dependency.laborChecklist);
      if (laborChecklist) {
        const laborFields: Array<[string, ResilienceAuditValue | undefined]> = [
          [t('analyse.resilienceAudit.laborCriticality'), laborChecklist.criticality],
          [t('analyse.resilienceAudit.workforceSubstitutability'), laborChecklist.workforceSubstitutability],
          [t('analyse.resilienceAudit.laborAutomationEvidence'), laborChecklist.automationEvidence],
        ];
        for (const [label, rawValue] of laborFields) {
          const value = auditString(rawValue);
          if (value) rows.push({ label, value: humanizeAuditValue(value, t), tone: 'neutral' });
        }
        const bargainingExposure = auditString(laborChecklist.bargainingOrReclassificationExposure);
        if (bargainingExposure) rows.push({
          label: t('analyse.resilienceAudit.laborBargainingExposure'),
          value: t(`analyse.resilienceAudit.exposure.${bargainingExposure}`),
          tone: bargainingExposure === 'high' ? 'negative' : 'neutral',
        });
      }
      if (auditBoolean(dependency.materialityUnproven)) rows.push({
        label: `${humanizeAuditValue(kind, t)} · ${t('analyse.resilienceAudit.materialityUnproven')}`,
        value: t('analyse.resilienceUnknown'),
        tone: 'neutral',
      });
      if (auditBoolean(dependency.structuralRegulation)) rows.push({
        label: `${humanizeAuditValue(kind, t)} · ${t('analyse.resilienceAudit.structuralRegulation')}`,
        value: t('analyse.resilienceAudit.yes'),
        tone: 'neutral',
      });
    }
  }

  if (criterion.id === 'structural_demand_capture') {
    const demandEvidence = auditRecord(audit.demandEvidence);
    if (demandEvidence) {
      const demandFields: Array<[string, ResilienceAuditValue | undefined]> = [
        [t('analyse.resilienceAudit.structuralTrendBasis'), demandEvidence.structuralTrendBasis],
        [t('analyse.resilienceAudit.essentialDemandBasis'), demandEvidence.essentialDemandBasis],
        [t('analyse.resilienceAudit.monetizationBasis'), demandEvidence.monetizationBasis],
      ];
      for (const [label, rawValue] of demandFields) {
        const value = auditString(rawValue);
        if (value) rows.push({
          label,
          value: humanizeAuditValue(value, t),
          tone: value === 'unproven' || value === 'profitable_core_cash_unproven' ? 'neutral' :
            ['stable_or_declining', 'discretionary', 'revenue_only_or_loss_making', 'pre_revenue']
              .includes(value) ? 'negative' : 'positive',
        });
      }
    }
    const captureChecklist = auditRecord(audit.captureChecklist);
    if (captureChecklist) {
      const captureFields: Array<[string, ResilienceAuditValue | undefined]> = [
        [t('analyse.resilienceAudit.relativeGrowth'), captureChecklist.relativeGrowth],
        [t('analyse.resilienceAudit.growthComposition'), captureChecklist.growthComposition],
        [t('analyse.resilienceAudit.marketShareTrajectory'), captureChecklist.marketShareTrajectory],
      ];
      for (const [label, rawValue] of captureFields) {
        const value = auditString(rawValue);
        if (value) rows.push({ label, value: humanizeAuditValue(value, t), tone: 'neutral' });
      }
    }
    rows.push(
      booleanAuditRow(t('analyse.resilienceAudit.structuralTrend'), auditBoolean(audit.structuralTrend), t),
      booleanAuditRow(t('analyse.resilienceAudit.essentialDemandFloor'), auditBoolean(audit.essentialDemandFloor), t),
      booleanAuditRow(t('analyse.resilienceAudit.capturedByCompany'), auditBoolean(audit.capturedByCompany), t),
      booleanAuditRow(t('analyse.resilienceAudit.currentlyMonetized'), auditBoolean(audit.currentlyMonetized), t),
    );
  }

  if (criterion.id === 'economic_persistence') {
    const futureNeedBasis = auditString(audit.futureNeedBasis);
    const needEliminationEvidence = auditString(audit.needEliminationEvidence);
    const roleContinuityBasis = auditString(audit.roleContinuityBasis);
    if (futureNeedBasis) rows.push({
      label: t('analyse.resilienceAudit.futureNeedBasis'),
      value: futureNeedBasis === 'none'
        ? t('analyse.resilienceAudit.noFutureNeed')
        : humanizeAuditValue(futureNeedBasis, t),
      tone: futureNeedBasis === 'none' ? 'negative' : 'neutral',
    });
    if (needEliminationEvidence) rows.push({
      label: t('analyse.resilienceAudit.needEliminationEvidence'),
      value: humanizeAuditValue(needEliminationEvidence, t),
      tone: needEliminationEvidence === 'majority_eliminated' ? 'negative' : 'neutral',
    });
    if (roleContinuityBasis) rows.push({
      label: t('analyse.resilienceAudit.roleContinuityBasis'),
      value: roleContinuityBasis === 'none'
        ? t('analyse.resilienceAudit.noRoleContinuity')
        : humanizeAuditValue(roleContinuityBasis, t),
      tone: roleContinuityBasis === 'none' ? 'negative' : 'neutral',
    });
    const interfaceDependenceBasis = auditString(audit.interfaceDependenceBasis);
    if (interfaceDependenceBasis) rows.push({
      label: t('analyse.resilienceAudit.interfaceDependenceBasis'),
      value: humanizeAuditValue(interfaceDependenceBasis, t),
      tone: interfaceDependenceBasis === 'requires_current_interface' ? 'negative' :
        interfaceDependenceBasis === 'unproven' ? 'neutral' : 'positive',
    });
    const roleAbsorptionChecklist = auditRecord(audit.roleAbsorptionChecklist);
    if (roleAbsorptionChecklist) {
      const absorptionFields: Array<[string, ResilienceAuditValue | undefined, string]> = [
        [t('analyse.resilienceAudit.absorberClass'), roleAbsorptionChecklist.absorberClass, 'noNamedAbsorber'],
        [t('analyse.resilienceAudit.absorptionPath'), roleAbsorptionChecklist.absorptionPath, 'noAbsorptionPath'],
        [t('analyse.resilienceAudit.majorityCoverage'), roleAbsorptionChecklist.majorityCoverage, 'notEstablished'],
      ];
      for (const [label, rawValue, noneKey] of absorptionFields) {
        const value = auditString(rawValue);
        if (value) rows.push({
          label,
          value: value === 'none'
            ? t(`analyse.resilienceAudit.${noneKey}`)
            : humanizeAuditValue(value, t),
          tone: 'neutral',
        });
      }
    }
    rows.push(
      booleanAuditRow(
        t('analyse.resilienceAudit.roleDependsOnCurrentInterface'),
        auditBoolean(audit.roleDependsOnCurrentInterface),
        t,
        false,
      ),
      booleanAuditRow(
        t('analyse.resilienceAudit.interfaceCovered'),
        auditBoolean(audit.interfaceCovered),
        t,
      ),
      booleanAuditRow(
        t('analyse.resilienceAudit.roleAbsorbableAcrossMajorityCoreWithinSevenYears'),
        auditBoolean(audit.roleAbsorbableAcrossMajorityCoreWithinSevenYears),
        t,
        false,
      ),
      booleanAuditRow(t('analyse.resilienceAudit.continuityQualified'), auditBoolean(audit.continuityQualified), t),
      booleanAuditRow(t('analyse.resilienceAudit.futureNeedPersists'), auditBoolean(audit.futureNeedPersists), t),
      booleanAuditRow(t('analyse.resilienceAudit.companyRolePersists'), auditBoolean(audit.companyRolePersists), t),
      booleanAuditRow(t('analyse.resilienceAudit.valueCapturePersists'), auditBoolean(audit.valueCapturePersists), t),
    );
    const horizon = auditNumber(audit.timeHorizonYears);
    const roleControl = auditString(audit.roleControl);
    if (roleControl) rows.push({
      label: t('analyse.resilienceAudit.roleControl'),
      value: roleControl === 'none'
        ? t('analyse.resilienceAudit.noFutureControl')
        : humanizeAuditValue(roleControl, t),
      tone: roleControl === 'none' ? 'negative' : 'positive',
    });
    const roleControlBasis = auditString(audit.roleControlBasis);
    if (roleControlBasis) rows.push({
      label: t('analyse.resilienceAudit.roleControlBasis'),
      value: roleControlBasis === 'none'
        ? t('analyse.resilienceAudit.noControlBasis')
        : humanizeAuditValue(roleControlBasis, t),
      tone: roleControlBasis === 'none' ? 'negative' : 'positive',
    });
    const futureControlChecklist = auditRecord(audit.futureControlChecklist);
    if (futureControlChecklist) {
      const futureControlFields: Array<[string, ResilienceAuditValue | undefined]> = [
        [t('analyse.resilienceAudit.controlOwnershipBasis'), futureControlChecklist.ownershipBasis],
        [t('analyse.resilienceAudit.controlSpecificityBasis'), futureControlChecklist.specificityBasis],
        [t('analyse.resilienceAudit.controlCommoditizationBasis'), futureControlChecklist.commoditizationBasis],
        [t('analyse.resilienceAudit.controlReplaceabilityBasis'), futureControlChecklist.replaceabilityBasis],
      ];
      for (const [label, rawValue] of futureControlFields) {
        const value = auditString(rawValue);
        if (value) rows.push({ label, value: humanizeAuditValue(value, t), tone: 'neutral' });
      }
    }
    const majorityReplaceable = auditBoolean(audit.controlReplaceableAcrossMajorityCoreWithinFiveYears);
    rows.push(
      booleanAuditRow(t('analyse.resilienceAudit.controlHeldByCompany'), auditBoolean(audit.controlHeldByCompany), t),
      booleanAuditRow(t('analyse.resilienceAudit.vendorSpecificControl'), auditBoolean(audit.vendorSpecificControl), t),
      booleanAuditRow(
        t('analyse.resilienceAudit.controlSurvivesAiCommoditization'),
        auditBoolean(audit.controlSurvivesAiCommoditization),
        t,
      ),
      booleanAuditRow(
        t('analyse.resilienceAudit.controlReplaceableAcrossMajorityCoreWithinFiveYears'),
        majorityReplaceable,
        t,
        false,
      ),
      booleanAuditRow(t('analyse.resilienceAudit.durableFutureControl'), auditBoolean(audit.durableFutureControl), t),
    );
    const captureMechanism = auditString(audit.captureMechanism);
    if (captureMechanism) rows.push({
      label: t('analyse.resilienceAudit.captureMechanism'),
      value: captureMechanism === 'none'
        ? t('analyse.resilienceAudit.noCaptureMechanism')
        : humanizeAuditValue(captureMechanism, t),
      tone: captureMechanism === 'none' ? 'negative' : 'positive',
    });
    if (horizon != null) rows.push({
      label: t('analyse.resilienceAudit.timeHorizon'),
      value: t('analyse.resilienceAudit.durationYears', { count: horizon }),
      tone: 'neutral',
    });
  }

  if (criterion.id === 'recurrence_balance') {
    const recurrenceChecklist = auditRecord(audit.recurrenceChecklist);
    const balanceChecklist = auditRecord(audit.balanceChecklist);
    if (recurrenceChecklist) {
      rows.push(
        metricAuditRow(
          t('analyse.resilienceAudit.contractualOrFeeSharePct'),
          auditNumber(recurrenceChecklist.contractualOrFeeSharePct),
          lang,
          t,
          ' %',
        ),
        booleanAuditRow(
          t('analyse.resilienceAudit.contractualOrFeePath'),
          auditBoolean(audit.contractualOrFeePath),
          t,
        ),
        booleanAuditRow(
          t('analyse.resilienceAudit.essentialRepeatPurchases'),
          auditBoolean(recurrenceChecklist.essentialRepeatPurchases),
          t,
        ),
        metricAuditRow(
          t('analyse.resilienceAudit.repeatCycleMonths'),
          auditNumber(recurrenceChecklist.repeatCycleMonths),
          lang,
          t,
          ` ${t('analyse.resilienceAudit.monthsUnit')}`,
        ),
        metricAuditRow(
          t('analyse.resilienceAudit.stableRepeatYearsOutOfFive'),
          auditNumber(recurrenceChecklist.stableRepeatYearsOutOfFive),
          lang,
          t,
          '/5',
        ),
        booleanAuditRow(
          t('analyse.resilienceAudit.essentialRepeatPath'),
          auditBoolean(audit.essentialRepeatPath),
          t,
        ),
        metricAuditRow(
          t('analyse.resilienceAudit.firmBacklogRevenueMultiple'),
          auditNumber(recurrenceChecklist.firmBacklogRevenueMultiple),
          lang,
          t,
          'x',
        ),
        metricAuditRow(
          t('analyse.resilienceAudit.backlogCancellationPct'),
          auditNumber(recurrenceChecklist.backlogCancellationPct),
          lang,
          t,
          ' %',
        ),
        booleanAuditRow(
          t('analyse.resilienceAudit.firmBacklogPath'),
          auditBoolean(audit.firmBacklogPath),
          t,
        ),
      );
      const essentialityBasis = auditString(recurrenceChecklist.essentialityBasis);
      if (essentialityBasis) rows.push({
        label: t('analyse.resilienceAudit.essentialityBasis'),
        value: humanizeAuditValue(essentialityBasis, t),
        tone: essentialityBasis === 'essential_to_core' ? 'positive' :
          essentialityBasis === 'unproven' ? 'neutral' : 'negative',
      });
    }
    rows.push(
      booleanAuditRow(t('analyse.resilienceAudit.recurrencePillar'), auditBoolean(audit.recurrencePillar), t),
    );
    if (balanceChecklist) {
      const profile = auditString(balanceChecklist.profile);
      rows.push({
        label: t('analyse.resilienceAudit.profile'),
        value: profile ? humanizeAuditValue(profile, t) : t('analyse.resilienceUnknown'),
        tone: 'neutral',
      });
      rows.push(
        booleanAuditRow(t('analyse.resilienceAudit.netCash'), auditBoolean(balanceChecklist.netCash), t),
        metricAuditRow(
          t('analyse.resilienceAudit.cashAndLiquidInvestments'),
          auditNumber(balanceChecklist.cashAndLiquidInvestments),
          lang,
          t,
        ),
        metricAuditRow(
          t('analyse.resilienceAudit.grossDebt'),
          auditNumber(balanceChecklist.grossDebt),
          lang,
          t,
        ),
        metricAuditRow(
          t('analyse.resilienceAudit.netDebtEbitda'),
          auditNumber(balanceChecklist.netDebtEbitda),
          lang,
          t,
          'x',
        ),
        metricAuditRow(
          t('analyse.resilienceAudit.netDebtThreshold'),
          auditNumber(audit.netDebtThreshold),
          lang,
          t,
          'x',
        ),
        metricAuditRow(
          t('analyse.resilienceAudit.interestCoverage'),
          auditNumber(balanceChecklist.interestCoverage),
          lang,
          t,
          'x',
        ),
        metricAuditRow(
          t('analyse.resilienceAudit.interestCoverageThreshold'),
          auditNumber(audit.interestCoverageThreshold),
          lang,
          t,
          'x',
        ),
        metricAuditRow(
          t('analyse.resilienceAudit.positiveFcf'),
          auditNumber(balanceChecklist.positiveFcfYears),
          lang,
          t,
          '/5',
        ),
        metricAuditRow(
          t('analyse.resilienceAudit.observedFcfYears'),
          auditNumber(balanceChecklist.observedFcfYears),
          lang,
          t,
          '/5',
        ),
        metricAuditRow(
          t('analyse.resilienceAudit.financialBufferBps'),
          auditNumber(balanceChecklist.financialBufferBps),
          lang,
          t,
          ` ${t('analyse.resilienceAudit.bpsUnit')}`,
        ),
        booleanAuditRow(
          t('analyse.resilienceAudit.wideInfrastructure'),
          auditBoolean(audit.wideInfrastructure),
          t,
        ),
      );
    }
    rows.push(
      booleanAuditRow(t('analyse.resilienceAudit.balancePillar'), auditBoolean(audit.balancePillar), t),
    );
  }

  return rows.filter((row): row is AuditRow => row != null);
}

function criterionScoreExplanation(criterion: ResilienceCriterion, t: TFunction): string {
  const audit = criterion.audit;
  const score = criterion.score ?? 0;

  if (criterion.score == null) return t('analyse.resilienceScoreExplanations.review');

  if (criterion.id === 'moat') {
    const engines = auditRecords(audit.engines).filter(engine => auditBoolean(engine.independent));
    const wide = engines.filter(engine => auditString(engine.qualification) === 'wide').length;
    const narrow = engines.filter(engine => auditString(engine.qualification) === 'narrow').length;
    return t('analyse.resilienceScoreExplanations.moat', {
      score,
      wide,
      narrow,
      bottleneck: t(`analyse.resilienceAudit.${auditBoolean(audit.monopolyBottleneck) ? 'yes' : 'no'}`),
    });
  }

  if (criterion.id === 'disruption_resilience') {
    const disruptions = auditRecords(audit.disruptions);
    const verdicts = disruptions.map(item => auditNumber(item.verdict));
    return t('analyse.resilienceScoreExplanations.disruption_resilience', {
      score,
      positive: verdicts.filter(value => value === 1).length,
      neutral: verdicts.filter(value => value === 0).length,
      negative: verdicts.filter(value => value === -1).length,
    });
  }

  if (criterion.id === 'residual_dependencies') {
    const dependencyClusters = auditRecords(audit.dependencyClusters);
    const dependencies = dependencyClusters.length > 0 ? dependencyClusters : auditRecords(audit.dependencies);
    const mitigations = dependencies.map(item => auditString(item.mitigation));
    return t('analyse.resilienceScoreExplanations.residual_dependencies', {
      score,
      total: dependencies.length,
      strong: mitigations.filter(value => value === 'strong').length,
      medium: mitigations.filter(value => value === 'medium').length,
      exposed: mitigations.filter(value => value === 'unmitigated' || value === 'existential').length,
    });
  }

  if (criterion.id === 'structural_demand_capture') {
    const translatedBoolean = (value: ResilienceAuditValue | undefined) => {
      const parsed = auditBoolean(value);
      return parsed == null ? t('analyse.resilienceUnknown') : t(`analyse.resilienceAudit.${parsed ? 'yes' : 'no'}`);
    };
    return t('analyse.resilienceScoreExplanations.structural_demand_capture', {
      score,
      trend: translatedBoolean(audit.structuralTrend),
      essential: translatedBoolean(audit.essentialDemandFloor),
      capture: translatedBoolean(audit.capturedByCompany),
      monetized: translatedBoolean(audit.currentlyMonetized),
    });
  }

  if (criterion.id === 'economic_persistence') {
    return t('analyse.resilienceScoreExplanations.economic_persistence', {
      score,
      need: t(`analyse.resilienceAudit.${auditBoolean(audit.futureNeedPersists) ? 'yes' : 'no'}`),
      role: t(`analyse.resilienceAudit.${auditBoolean(audit.companyRolePersists) ? 'yes' : 'no'}`),
      capture: t(`analyse.resilienceAudit.${auditBoolean(audit.valueCapturePersists) ? 'yes' : 'no'}`),
      horizon: auditNumber(audit.timeHorizonYears) ?? 0,
    });
  }

  const pillars = [audit.recurrencePillar, audit.balancePillar].filter(value => auditBoolean(value) === true).length;
  return t('analyse.resilienceScoreExplanations.recurrence_balance', { score, pillars });
}

function CriterionDetails({ criterion, lang }: { criterion: ResilienceCriterion; lang: ResilienceLang }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);
  const id = useId();
  const auditRows = criterionAuditRows(criterion, t, lang);
  const researchSummary = auditLocalizedText(criterion.audit.researchSummary, lang);
  const scoreExplanation = researchSummary ?? criterionScoreExplanation(criterion, t);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('keydown', closeEscape);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !panelRef.current) return;

    const positionPanel = () => {
      if (!buttonRef.current || !panelRef.current) return;
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const panelRect = panelRef.current.getBoundingClientRect();
      const navHeight = Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--nav-h'),
      ) || 60;
      const gap = 8;
      const edge = 12;
      const topBoundary = navHeight + edge;
      const spaceAbove = buttonRect.top - topBoundary - gap;
      const spaceBelow = window.innerHeight - buttonRect.bottom - edge - gap;
      const openAbove = spaceAbove >= panelRect.height || spaceAbove >= spaceBelow;
      const desiredTop = openAbove
        ? buttonRect.top - panelRect.height - gap
        : buttonRect.bottom + gap;
      const top = Math.max(
        topBoundary,
        Math.min(desiredTop, window.innerHeight - panelRect.height - edge),
      );
      const left = Math.max(
        edge,
        Math.min(buttonRect.right - panelRect.width, window.innerWidth - panelRect.width - edge),
      );
      setPanelStyle({ top, left });
    };

    positionPanel();
    window.addEventListener('resize', positionPanel);
    window.addEventListener('scroll', positionPanel, { capture: true, passive: true });
    return () => {
      window.removeEventListener('resize', positionPanel);
      window.removeEventListener('scroll', positionPanel, true);
    };
  }, [open]);

  return (
    <div className="anl-resilience-details" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        className="anl-resilience-info"
        onClick={() => setOpen(value => !value)}
        aria-label={t('analyse.resilienceDetails')}
        aria-expanded={open}
        aria-controls={id}
        title={t('analyse.resilienceDetails')}
      >
        <Icon name="info" size={14} />
      </button>
      {open && (
        <div
          ref={panelRef}
          className="anl-resilience-panel fade-in"
          id={id}
          role="dialog"
          aria-labelledby={`${id}-title`}
          style={panelStyle ?? { visibility: 'hidden' }}
        >
          <div className="anl-resilience-panel-head">
            <strong id={`${id}-title`}>{t(`analyse.resilienceCriteria.${criterion.id}.label`)}</strong>
            <span className="num">{criterion.score == null ? t('analyse.resilienceUnknown') : `${criterion.score}/${criterion.maxScore}`}</span>
          </div>

          <span className="anl-resilience-detail-label">{t('analyse.resilienceScoreReading')}</span>
          <p className="anl-resilience-score-explanation">{scoreExplanation}</p>

          <span className="anl-resilience-detail-label">{t('analyse.resilienceReason')}</span>
          <p>{criterion.summary[lang]}</p>

          <span className="anl-resilience-detail-label">{t('analyse.resilienceWatchpoints')}</span>
          {criterion.watchpoints.map((watchpoint, index) => <p key={index}>{watchpoint[lang]}</p>)}

          <span className="anl-resilience-detail-label">{t('analyse.resilienceEvidence')}</span>
          {criterion.evidence.length > 0 ? (
            <div className="anl-resilience-links">
              {criterion.evidence.map((evidence, index) => (
                <a key={`${evidence.url}-${index}`} href={evidence.url} target="_blank" rel="noopener noreferrer">
                  {t('analyse.resilienceEvidenceItem', {
                    index: index + 1,
                    date: evidence.date ? ` · ${evidence.date}` : '',
                  })} <Icon name="external" size={11} />
                </a>
              ))}
            </div>
          ) : <p className="anl-resilience-empty">{t('analyse.resilienceNoEvidence')}</p>}

          <button
            type="button"
            className={`anl-resilience-tech-toggle${showTechnical ? ' is-open' : ''}`}
            aria-expanded={showTechnical}
            onClick={() => setShowTechnical(value => !value)}
          >
            <Icon name="chevronR" size={13} />
            {t('analyse.resilienceTechnicalToggle')}
          </button>
          {showTechnical && (
            <div className="anl-resilience-tech">
              <span className="anl-resilience-detail-label">{t('analyse.resilienceDecisionFactors')}</span>
              {auditRows.length > 0 ? (
                <div className="anl-resilience-audit">
                  {auditRows.map((row, index) => (
                    <div className="anl-resilience-audit-row" key={`${row.label}-${index}`}>
                      <span>{row.label}</span>
                      <strong className={`tone-${row.tone}`}>{row.value}</strong>
                    </div>
                  ))}
                </div>
              ) : <p className="anl-resilience-empty">{t('analyse.resilienceNoDecisionFactor')}</p>}

              <span className="anl-resilience-detail-label">{t('analyse.resilienceMeasure')}</span>
              <p>{t(`analyse.resilienceCriteria.${criterion.id}.measure`)}</p>

              <span className="anl-resilience-detail-label">{t('analyse.resilienceScoringRule')}</span>
              <p>{t(`analyse.resilienceCriteria.${criterion.id}.scoreRule`)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ResilienceGrid({ analysis }: { analysis: ResilienceAnalysis | null }) {
  const { t, i18n } = useTranslation();
  const lang = currentLang(i18n.language);

  if (!analysis) {
    return (
      <div className="anl-resilience-pending">
        <Icon name="shield" size={18} />
        <span>{t('analyse.resiliencePending')}</span>
      </div>
    );
  }

  const byId = new Map(analysis.criteria.map(criterion => [criterion.id, criterion]));
  return (
    <div className="anl-resilience-grid">
      {CRITERION_IDS.flatMap(id => {
        const criterion = byId.get(id);
        if (!criterion) return [];
        const tone = criterionTone(criterion);
        const cardText = auditLocalizedText(criterion.audit.researchSummary, lang) ?? criterion.summary[lang];
        return [
          <article className={`anl-resilience-card tone-${tone}`} key={id}>
            <div className="anl-resilience-card-head">
              <h3>{t(`analyse.resilienceCriteria.${id}.label`)}</h3>
              <span className="num anl-resilience-score">
                {criterion.score == null ? t('analyse.resilienceUnknown') : `${criterion.score}/${criterion.maxScore}`}
              </span>
            </div>
            <span className="anl-resilience-level">{t(`analyse.resilienceLevels.${tone}`)}</span>
            <p className="anl-resilience-card-body">{cardText}</p>
            <div className="anl-resilience-card-foot">
              <CriterionDetails criterion={criterion} lang={lang} />
            </div>
          </article>,
        ];
      })}
    </div>
  );
}
