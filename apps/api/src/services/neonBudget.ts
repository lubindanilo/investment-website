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

/** Lecture GET de l'API Neon. Injectable pour tester la résolution du projet sans réseau. */
export type NeonGetter = <T>(path: string) => Promise<T>;

export interface NeonAccess {
  apiKey: string;
  /** Court-circuite toute la découverte (variable NEON_PROJECT_ID). */
  projectId?: string;
  /** Évite l'appel de découverte des organisations (variable NEON_ORG_ID). */
  orgId?: string;
  get?: NeonGetter;
}

function makeGetter(apiKey: string): NeonGetter {
  return async <T>(path: string): Promise<T> => {
    const res = await fetch(`${NEON_API}${path}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(NEON_TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Neon API ${path} → HTTP ${res.status} ${body}`.slice(0, 300));
    }
    return await res.json() as T;
  };
}

/** Organisations visibles par une clé personnelle. */
async function listOrgIds(get: NeonGetter): Promise<string[]> {
  const r = await get<{ organizations?: { id?: string }[] }>('/users/me/organizations');
  const ids = (r.organizations ?? []).map(o => o.id).filter((id): id is string => !!id);
  if (!ids.length) {
    throw new Error('Aucune organisation Neon visible : renseigne NEON_PROJECT_ID (console Neon → Settings → General).');
  }
  return ids;
}

/**
 * Résout l'ID du projet Neon. Sans `projectId` explicite, on liste les projets visibles par la
 * clé : un seul projet (cas normal) → on le prend ; plusieurs → on refuse de deviner (mesurer le
 * mauvais projet donnerait un budget faux, donc un dépassement silencieux).
 *
 * Compte ORGANISATION : `GET /projects` répond alors 400 « org_id is required » (les projets
 * appartiennent à l'organisation, pas au compte), et une clé personnelle doit passer par
 * `GET /projects?org_id=…`. On enchaîne donc sur la découverte des organisations. Cas rencontré au
 * premier run du drain (04/08/2026).
 */
export async function resolveNeonProjectId(access: NeonAccess): Promise<string> {
  if (access.projectId) return access.projectId;
  const get = access.get ?? makeGetter(access.apiKey);

  // 1. Projets rattachés directement au compte (cas hors organisation).
  const own = await get<{ projects?: NeonProjectPayload[] }>('/projects').catch((e: Error) => {
    if (!/org_id is required/i.test(e.message)) throw e;
    return null;
  });
  const found: NeonProjectPayload[] = own?.projects ?? [];

  // 2. Sinon (400 org_id, ou compte sans projet propre) : par organisation.
  if (!found.length) {
    for (const orgId of access.orgId ? [access.orgId] : await listOrgIds(get)) {
      const r = await get<{ projects?: NeonProjectPayload[] }>(`/projects?org_id=${encodeURIComponent(orgId)}`);
      found.push(...(r.projects ?? []));
    }
  }

  if (!found.length) throw new Error('Aucun projet Neon visible avec cette clé API.');
  if (found.length > 1) {
    throw new Error(`${found.length} projets Neon visibles — renseigne NEON_PROJECT_ID (${found.map(p => p.id).join(', ')}).`);
  }
  return found[0]!.id;
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

export async function fetchNeonUsage(opts: NeonAccess & { now?: Date }): Promise<NeonUsage> {
  const get = opts.get ?? makeGetter(opts.apiKey);
  const id = await resolveNeonProjectId(opts);
  const { project } = await get<{ project: NeonProjectPayload }>(`/projects/${id}`);
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
