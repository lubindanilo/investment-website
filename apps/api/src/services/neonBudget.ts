/**
 * neonBudget — lit la consommation compute Neon du mois en cours (API console) et en déduit ce
 * qu'un run de drain a le droit de consommer.
 *
 * POURQUOI : le plan Free facture le TEMPS DE COMPUTE ACTIF (~100 CU-h/mois) et c'est le vrai
 * plafond du scale du screener, pas les quotas des API de données. L'incident du 20/07/2026 (100
 * CU-h cramées en 2 jours par des crons en continu, base suspendue, backend en 500) est arrivé
 * précisément parce qu'aucun compteur n'était branché : « flirter avec la limite » sans mesurer,
 * c'est la dépasser en aveugle. Ici on mesure AVANT le run (pour dimensionner sa durée) et
 * PENDANT (pour l'arrêter dès que sa part est consommée).
 *
 * MÉTRIQUE : `compute_time_seconds` du projet = CU-secondes accumulées sur la période de
 * facturation en cours, donc ÷ 3600 = CU-heures, l'unité du quota. `active_time_seconds` est le
 * temps d'éveil en secondes horloge ; leur rapport donne la taille moyenne de compute réellement
 * facturée (0,25 CU au plancher, jusqu'à 2 CU quand l'autoscale monte, soit 8× le coût horaire).
 * C'est ce rapport, mesuré et non supposé, qui convertit un budget en CU-h en une durée de run.
 *
 * Docs : GET /api/v2/projects/{project_id} (champs de consommation de la période courante).
 */

const NEON_API = 'https://console.neon.tech/api/v2';
const NEON_TIMEOUT_MS = 15_000;

/** Plancher de compute du plan Free (0,25 CU). Repli quand on n'a pas encore de rapport mesurable. */
export const NEON_MIN_CU = 0.25;

/** Forme (partielle) de l'objet `project` de l'API Neon — seuls les champs qu'on exploite. */
interface NeonProjectPayload {
  id: string;
  name?: string;
  compute_time_seconds?: number;
  active_time_seconds?: number;
  consumption_period_start?: string;
  consumption_period_end?: string;
}

export interface NeonUsage {
  projectId: string;
  /** CU-heures consommées depuis le début de la période de facturation. */
  cuHours: number;
  /** Heures d'éveil (horloge) des computes sur la même période. */
  activeHours: number;
  /** Taille moyenne de compute facturée (CU-h / h d'éveil). Plancher NEON_MIN_CU si non mesurable. */
  avgCu: number;
  periodStart: Date;
  periodEnd: Date;
  /** true quand l'API ne peuple pas les bornes de période et qu'on retombe sur le mois calendaire. */
  periodFromCalendar: boolean;
}

async function neonGet<T>(path: string, apiKey: string): Promise<T> {
  const res = await fetch(`${NEON_API}${path}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(NEON_TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Neon API ${path} → HTTP ${res.status} ${body}`.slice(0, 300));
  }
  return await res.json() as T;
}

/**
 * Résout l'ID du projet Neon. Sans `explicit`, on liste les projets visibles par la clé : un seul
 * projet (cas normal) → on le prend ; plusieurs → on refuse de deviner (mesurer le mauvais projet
 * donnerait un budget faux, donc un dépassement silencieux).
 */
export async function resolveNeonProjectId(apiKey: string, explicit?: string): Promise<string> {
  if (explicit) return explicit;
  const { projects } = await neonGet<{ projects: NeonProjectPayload[] }>('/projects', apiKey);
  if (!projects?.length) throw new Error('Aucun projet Neon visible avec cette clé API.');
  if (projects.length > 1) {
    throw new Error(`${projects.length} projets Neon visibles — renseigne NEON_PROJECT_ID (${projects.map(p => p.id).join(', ')}).`);
  }
  return projects[0]!.id;
}

/** Bornes du mois calendaire en UTC — repli quand l'API ne peuple pas la période de consommation. */
export function calendarPeriod(now: Date): { periodStart: Date; periodEnd: Date } {
  return {
    periodStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    periodEnd: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  };
}

/** Date valide et postérieure à 2000 ? L'API renvoie `0001-01-01T00:00:00Z` quand le champ est vide. */
function usableDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) || d.getUTCFullYear() < 2000 ? null : d;
}

export function parseNeonUsage(project: NeonProjectPayload, now: Date): NeonUsage {
  const cuHours = (project.compute_time_seconds ?? 0) / 3600;
  const activeHours = (project.active_time_seconds ?? 0) / 3600;
  const start = usableDate(project.consumption_period_start);
  const end = usableDate(project.consumption_period_end);
  const fallback = calendarPeriod(now);
  return {
    projectId: project.id,
    cuHours,
    activeHours,
    // Sous ~3 min d'éveil cumulé le rapport n'est pas significatif → plancher du plan.
    avgCu: activeHours > 0.05 ? Math.max(NEON_MIN_CU, cuHours / activeHours) : NEON_MIN_CU,
    periodStart: start ?? fallback.periodStart,
    periodEnd: end ?? fallback.periodEnd,
    periodFromCalendar: end == null,
  };
}

export async function fetchNeonUsage(opts: { apiKey: string; projectId?: string; now?: Date }): Promise<NeonUsage> {
  const id = await resolveNeonProjectId(opts.apiKey, opts.projectId);
  const { project } = await neonGet<{ project: NeonProjectPayload }>(`/projects/${id}`, opts.apiKey);
  return parseNeonUsage({ ...project, id }, opts.now ?? new Date());
}

export interface DrainBudgetInput {
  /** CU-heures déjà consommées sur la période (tous usages : site, crons, drain). */
  usedCuH: number;
  periodEnd: Date;
  now: Date;
  /** Quota du plan en CU-h (100 sur Free). */
  monthlyCuH: number;
  /** Part du quota qu'on s'autorise à viser (0,8 = 20 % de marge de sécurité). */
  targetShare: number;
  /** Part du solde QUOTIDIEN réservée au drain ; le reste finance le trafic du site et le cron earnings. */
  drainShare: number;
}

export interface DrainBudget {
  /** Plafond visé = monthlyCuH × targetShare. */
  ceilingCuH: number;
  /** Solde jusqu'au plafond visé. */
  remainingCuH: number;
  daysLeft: number;
  /** Solde ramené au jour (solde / jours restants). */
  dailyCuH: number;
  /** Ce que CE run a le droit de consommer. */
  allowanceCuH: number;
  /** Plafond déjà atteint → le run doit être sauté. */
  exhausted: boolean;
}

/**
 * Répartit le solde du mois : on lisse sur les jours restants (plutôt que de tout dépenser la
 * première nuit) puis on n'en prend qu'une part, le reste finançant le trafic du site et le cron
 * earnings qui tapent la même base.
 */
export function computeDrainBudget(i: DrainBudgetInput): DrainBudget {
  const ceilingCuH = i.monthlyCuH * i.targetShare;
  const remainingCuH = Math.max(0, ceilingCuH - i.usedCuH);
  const daysLeft = Math.max(1, Math.ceil((i.periodEnd.getTime() - i.now.getTime()) / 86_400_000));
  const dailyCuH = remainingCuH / daysLeft;
  return {
    ceilingCuH,
    remainingCuH,
    daysLeft,
    dailyCuH,
    allowanceCuH: dailyCuH * i.drainShare,
    exhausted: remainingCuH <= 0,
  };
}

/**
 * Convertit un budget en CU-heures en durée de run (minutes), à la taille de compute MESURÉE sur
 * le mois. Pendant un drain la base reste éveillée en continu, donc le coût horaire du run est
 * ~avgCu : c'est ce qui permet d'ajuster la durée automatiquement d'une nuit sur l'autre, sans
 * constante devinée.
 */
export function budgetToMinutes(allowanceCuH: number, avgCu: number): number {
  const cu = Math.max(NEON_MIN_CU, avgCu);
  return Math.max(0, Math.floor((allowanceCuH / cu) * 60));
}
