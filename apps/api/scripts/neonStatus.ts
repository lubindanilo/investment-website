/**
 * neonStatus — diagnostic READ-ONLY de la clé NEON_API_KEY : liste tous les projets Neon visibles,
 * avec leur taille de stockage (logical_size, la métrique du plafond 512 Mo du plan Free) et leur
 * consommation compute du mois. Ne modifie rien, ne consomme aucun compute Neon (API console
 * uniquement, pas de connexion Postgres).
 *
 * Sert à trancher, sans jamais exposer la clé, lequel des projets visibles par le compte est la
 * base de production — point bloquant du 12/11/2026 où drainScreener.ts a commencé à refuser de
 * choisir entre deux projets (cf. NEON_PROJECT_ID dans neonBudget.ts).
 *
 * Usage : `pnpm --filter @lubin/api exec tsx scripts/neonStatus.ts` avec NEON_API_KEY en env.
 */
const NEON_API = 'https://console.neon.tech/api/v2';

interface NeonProject {
  id: string;
  name?: string;
  created_at?: string;
  compute_time_seconds?: number;
  active_time_seconds?: number;
  /** Octets transférés hors de Neon (proxy), cumul de la période de facturation courante. */
  data_transfer_bytes?: number;
  /** Octets écrits, cumul de la période de facturation courante. */
  written_data_bytes?: number;
}

interface NeonBranch {
  id: string;
  name?: string;
  default?: boolean;
  logical_size?: number;
  created_at?: string;
  last_reset_at?: string;
}

async function get<T>(apiKey: string, path: string): Promise<T> {
  const res = await fetch(`${NEON_API}${path}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Neon API ${path} → HTTP ${res.status} ${body}`.slice(0, 300));
  }
  return (await res.json()) as T;
}

async function listAllProjects(apiKey: string): Promise<NeonProject[]> {
  const own = await get<{ projects?: NeonProject[] }>(apiKey, '/projects').catch((e: Error) => {
    if (!/org_id is required/i.test(e.message)) throw e;
    return null;
  });
  if (own?.projects?.length) return own.projects;

  const orgs = await get<{ organizations?: { id?: string }[] }>(apiKey, '/users/me/organizations');
  const out: NeonProject[] = [];
  for (const org of orgs.organizations ?? []) {
    if (!org.id) continue;
    const r = await get<{ projects?: NeonProject[] }>(apiKey, `/projects?org_id=${encodeURIComponent(org.id)}`);
    out.push(...(r.projects ?? []));
  }
  return out;
}

async function main(): Promise<void> {
  const apiKey = (process.env.NEON_API_KEY ?? '').trim();
  if (!apiKey) throw new Error('NEON_API_KEY absente.');

  const projects = await listAllProjects(apiKey);
  console.log(`${projects.length} projet(s) Neon visible(s) avec cette clé.\n`);

  for (const p0 of projects) {
    // La liste /projects ne porte pas toujours data_transfer_bytes/written_data_bytes :
    // on relit le détail /projects/{id} pour les avoir de façon fiable.
    const detail = await get<{ project?: NeonProject }>(apiKey, `/projects/${encodeURIComponent(p0.id)}`)
      .then(r => r.project ?? p0)
      .catch(() => p0);
    const p = { ...p0, ...detail };
    const cuH = (p.compute_time_seconds ?? 0) / 3600;
    const transferGb = (p.data_transfer_bytes ?? 0) / 1_000_000_000;
    const writtenGb = (p.written_data_bytes ?? 0) / 1_000_000_000;
    console.log(`--- ${p.name ?? '(sans nom)'}  [id: ${p.id}]`);
    console.log(`    créé le        : ${p.created_at ?? '?'}`);
    console.log(`    compute ce mois: ${cuH.toFixed(2)} CU-h`);
    console.log(`    transfert réseau ce mois : ${transferGb.toFixed(3)} Go (plafond Free ≈ 5 Go)`);
    console.log(`    données écrites ce mois  : ${writtenGb.toFixed(3)} Go`);

    const branches = await get<{ branches?: NeonBranch[] }>(apiKey, `/projects/${encodeURIComponent(p.id)}/branches`)
      .catch((e: Error) => ({ branches: [] as NeonBranch[], error: e.message }));
    const list = branches.branches ?? [];
    let totalMb = 0;
    for (const b of list) {
      const mb = (b.logical_size ?? 0) / 1_000_000;
      totalMb += mb;
      console.log(`    branche ${b.default ? '(default) ' : ''}${b.name ?? b.id} : ${mb.toFixed(1)} Mo`);
    }
    console.log(`    STOCKAGE TOTAL : ${totalMb.toFixed(1)} Mo (plafond Free = 512 Mo)\n`);
  }
}

main().catch((e: Error) => {
  console.error(`::error::${e.message}`);
  process.exit(1);
});
