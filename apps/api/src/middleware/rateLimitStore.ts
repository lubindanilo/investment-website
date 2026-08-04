/**
 * Store de rate limit partagé entre instances de lambda.
 *
 * LE PROBLÈME. `express-rate-limit` utilise par défaut un store en mémoire. Sur Vercel,
 * chaque instance de fonction a le sien : une limite annoncée à 12 requêtes par minute vaut
 * en réalité 12 × le nombre d'instances chaudes. Sous charge, la limite est donc largement
 * inopérante — et sur un endpoint public qui déclenche deux requêtes sortantes par appel,
 * c'est le trou le plus exploitable du service.
 *
 * LA SOLUTION. Un compteur dans Redis, partagé par toutes les instances. On parle à Upstash
 * en REST plutôt qu'en TCP : pas de connexion à maintenir, ce qui est le bon modèle en
 * serverless, et aucune dépendance à installer.
 *
 * REPLI. Si aucune variable n'est configurée, `sharedStore()` renvoie `undefined` et
 * `express-rate-limit` garde son store en mémoire. Le service fonctionne donc sans Redis —
 * mais la limite reste par instance, ce que dit le log au démarrage.
 *
 * EN CAS DE PANNE REDIS, on laisse passer (fail-open). C'est un choix : sur un outil public
 * d'acquisition, refuser tout le trafic parce que le compteur est injoignable transforme un
 * incident de dépendance en indisponibilité totale. Le risque inverse — une fenêtre sans
 * limite pendant une panne — est borné et préférable.
 *
 * Variables reconnues, dans cet ordre :
 *   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN   (intégration Upstash)
 *   KV_REST_API_URL / KV_REST_API_TOKEN                 (Vercel KV, même API)
 */
import type { Store, ClientRateLimitInfo, IncrementResponse, Options } from 'express-rate-limit';

const URL_ENV = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const TOKEN_ENV = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

/** Préfixe pour ne pas collisionner avec d'autres usages de la même base. */
const PREFIX = 'rl:';

interface PipelineResult {
  result?: unknown;
  error?: string;
}

async function pipeline(commands: Array<Array<string | number>>): Promise<PipelineResult[]> {
  const res = await fetch(`${URL_ENV}/pipeline`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${TOKEN_ENV}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(commands),
    // Un compteur de rate limit ne doit jamais devenir le facteur limitant de la latence.
    signal: AbortSignal.timeout(1_500),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  return (await res.json()) as PipelineResult[];
}

class UpstashStore implements Store {
  private windowMs = 60_000;
  /** On ne veut pas inonder les logs si Redis tombe : un avertissement par minute suffit. */
  private lastWarn = 0;

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  private warn(e: unknown): void {
    const now = Date.now();
    if (now - this.lastWarn < 60_000) return;
    this.lastWarn = now;
    console.warn('[rate-limit] Redis injoignable, on laisse passer :', (e as Error).message);
  }

  async increment(key: string): Promise<IncrementResponse> {
    const k = PREFIX + key;
    const sec = Math.max(1, Math.ceil(this.windowMs / 1000));
    try {
      // SET NX + EX crée la clé AVEC son expiration seulement si elle n'existe pas ; INCR
      // compte ; PTTL donne le temps restant. Un seul aller-retour, et aucune commande
      // exotique — donc compatible avec toute version de Redis.
      const [, incr, pttl] = await pipeline([
        ['SET', k, 0, 'EX', sec, 'NX'],
        ['INCR', k],
        ['PTTL', k],
      ]);
      const totalHits = Number(incr?.result ?? 1);
      const ttl = Number(pttl?.result ?? -1);
      return {
        totalHits: Number.isFinite(totalHits) && totalHits > 0 ? totalHits : 1,
        resetTime: ttl > 0 ? new Date(Date.now() + ttl) : new Date(Date.now() + this.windowMs),
      };
    } catch (e) {
      this.warn(e);
      // Fail-open : 1 hit, jamais au-dessus de la limite.
      return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) };
    }
  }

  async decrement(key: string): Promise<void> {
    try {
      await pipeline([['DECR', PREFIX + key]]);
    } catch (e) {
      this.warn(e);
    }
  }

  async resetKey(key: string): Promise<void> {
    try {
      await pipeline([['DEL', PREFIX + key]]);
    } catch (e) {
      this.warn(e);
    }
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    try {
      const [val, pttl] = await pipeline([['GET', PREFIX + key], ['PTTL', PREFIX + key]]);
      if (val?.result == null) return undefined;
      const ttl = Number(pttl?.result ?? -1);
      return {
        totalHits: Number(val.result) || 0,
        resetTime: ttl > 0 ? new Date(Date.now() + ttl) : undefined,
      };
    } catch (e) {
      this.warn(e);
      return undefined;
    }
  }
}

let announced = false;
let cached: Store | undefined;

/** Store partagé si Redis est configuré, sinon `undefined` (repli mémoire). */
export function sharedStore(): Store | undefined {
  if (!URL_ENV || !TOKEN_ENV) {
    if (!announced && process.env.NODE_ENV !== 'test') {
      announced = true;
      console.warn(
        '[rate-limit] Aucun Redis configuré : les compteurs sont par instance de lambda, ' +
        'donc la limite effective vaut la limite × le nombre d’instances chaudes. ' +
        'Définir UPSTASH_REDIS_REST_URL et UPSTASH_REDIS_REST_TOKEN pour la rendre réelle.',
      );
    }
    return undefined;
  }
  cached ??= new UpstashStore();
  return cached;
}

/**
 * À étaler dans les options de `rateLimit()`.
 *
 * On ne passe PAS `store: undefined` explicitement : l'étalement écraserait le store par
 * défaut de la bibliothèque par `undefined`. On étale donc un objet vide quand il n'y a rien.
 */
export function storeOption(): { store?: Store } {
  const s = sharedStore();
  return s ? { store: s } : {};
}
