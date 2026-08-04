/**
 * Textes des constats du vérificateur de visibilité IA, dans les trois langues du site.
 *
 * Pourquoi un module séparé : la page `/visibilite-ia` est traduite côté web, mais les
 * constats sont générés par l'API. Sans ça, un visiteur anglophone recevait une interface en
 * anglais et des constats en français — visible, et sur une page dont tout l'intérêt est
 * d'être partagée.
 *
 * Les constats du CRAWLER (lib/seoCrawler.ts) restent en français, volontairement : ils sont
 * consommés par un assistant dans une conversation, qui rend déjà dans la langue de
 * l'échange. Ici c'est une page publique lue directement par un humain, le cas est différent.
 *
 * Les étiquettes de preuve (`test`, `data`, `consensus`…) ne sont PAS traduites : c'est le
 * vocabulaire du corpus, et le traduire ferait perdre la correspondance avec la documentation.
 */
export type CheckerLang = 'fr' | 'en' | 'es';

export const CHECKER_LANGS: readonly CheckerLang[] = ['fr', 'en', 'es'];

export function toCheckerLang(v: string | undefined | null): CheckerLang {
  const base = (v ?? 'fr').toLowerCase().split('-')[0];
  return (CHECKER_LANGS as readonly string[]).includes(base ?? '') ? (base as CheckerLang) : 'fr';
}

export interface CopyVars {
  botWords: number;
  rawWords: number;
  titleLength: number;
  contentType: string;
}

export type CopyKey =
  | 'a1.invisible' | 'a1.dynamic' | 'a1.thin' | 'a1.ssr'
  | 'h1.negotiated'
  | 'b2.short' | 'b2.ok'
  | 'b1.noTitle' | 'b1.noH1'
  | 'b3.hasDesc'
  | 'l1.jsonLd';

interface Entry { title: string; detail: string }

type Table = Record<CopyKey, (v: CopyVars) => Entry>;

const FR: Table = {
  'a1.invisible': (v) => ({
    title: 'Le contenu de cette page a besoin de JavaScript pour apparaître',
    detail:
      `Un robot d'IA ne reçoit que ${v.botWords} mots. Aucun grand robot d'IA n'exécute JavaScript : ` +
      'ils téléchargent les fichiers .js sans les évaluer. Cette page ne peut donc pas être citée. ' +
      'Le correctif est le rendu serveur, la génération statique ou le prérendu au build — ' +
      'il suffit que le texte parte avec la page, sans changer de stack.',
  }),
  'a1.dynamic': (v) => ({
    title: 'Pré-rendu conditionné à l’user-agent — ça marche, mais c’est fragile',
    detail:
      `Un robot d'IA reçoit ${v.botWords} mots, un navigateur n'en reçoit que ${v.rawWords} avant ` +
      "l'exécution du JavaScript. Le site sert donc du HTML pré-rendu aux user-agents qu'il " +
      'reconnaît. La visibilité dépend alors du maintien de cette liste : tout robot absent de la ' +
      'liste reçoit la coquille vide. À surveiller à chaque nouveau moteur IA.',
  }),
  'a1.thin': (v) => ({
    title: 'La page est lisible, mais elle contient peu de texte',
    detail:
      `${v.botWords} mots lisibles. Le rendu n'est pas le problème : la page est servie telle quelle. ` +
      "Le corpus ne demande pas d'écrire long — une page de vente efficace fait 415 mots en moyenne — " +
      'mais en dessous de cent mots, il n’y a pas de quoi répondre à une requête.',
  }),
  'a1.ssr': (v) => ({
    title: 'Le texte part avec la page',
    detail:
      `${v.botWords} mots lisibles sans exécuter de JavaScript. C'est l'état idéal : la page existe ` +
      'pour les robots d’IA comme pour les moteurs de recherche, sans dépendre d’une liste ' +
      'de user-agents à maintenir.',
  }),
  'h1.negotiated': (v) => ({
    title: 'Ce site sert une version texte dédiée aux robots d’IA',
    detail:
      `Le serveur a répondu en « ${v.contentType} » à un user-agent de robot IA, au lieu de HTML. ` +
      'C’est de la négociation de contenu volontaire, et c’est le signe d’un site déjà préparé pour ' +
      'les moteurs IA. Les contrôles de balises HTML ne s’appliquent pas ici.',
  }),
  'b2.short': (v) => ({
    title: `Titre de ${v.titleLength} caractères`,
    detail:
      'Le corpus mesure +10 à 40 % de trafic pour des titres longs multi-intention de 150 à 250 ' +
      'caractères, avec l’essentiel dans les douze premiers mots. La règle des 60 caractères ' +
      'ne tient pas. Attention toutefois : Google Discover demande l’inverse.',
  }),
  'b2.ok': (v) => ({
    title: `Titre de ${v.titleLength} caractères`,
    detail: 'Dans la fourchette de 150 à 250 caractères que le corpus mesure comme la plus rentable.',
  }),
  'b1.noTitle': () => ({
    title: 'Aucune balise title lisible',
    detail:
      'Le titre est l’un des cinq emplacements qui portent 70 % du résultat on-page — avec l’URL, ' +
      'le H1, le début de la première phrase et la meta description.',
  }),
  'b1.noH1': () => ({
    title: 'Aucun H1',
    detail:
      'Le H1 est l’un des cinq emplacements. Son absence est un défaut ; en revanche le corpus ' +
      'ne tranche pas sur leur NOMBRE, et aucune position n’a d’effet démontré.',
  }),
  'b3.hasDesc': () => ({
    title: 'Cette page a une meta description',
    detail:
      'Google en ignore 63 %, et celles qu’il rédige lui-même convertissent 3 % mieux. Le corpus ' +
      'recommande de n’en écrire que sur cinq à dix pages clés, et de ne jamais en générer ' +
      'automatiquement : les descriptions générées font mesurablement moins bien que pas de description.',
  }),
  'l1.jsonLd': () => ({
    title: 'Balisage schema détecté',
    detail:
      'Quatre tests indépendants, dont un déploiement complet sur deux ans : aucun effet mesurable sur ' +
      'le classement. Effet sur la citation par les IA : +2,4 %, indiscernable de zéro. À garder si ' +
      'c’est là pour un usage précis (nom de site dans les résultats, fiches produit, Google ' +
      'Shopping), mais pas à étendre en attendant du classement.',
  }),
};

const EN: Table = {
  'a1.invisible': (v) => ({
    title: 'This page needs JavaScript for its content to appear',
    detail:
      `An AI crawler receives only ${v.botWords} words. No major AI crawler executes JavaScript: ` +
      'they download .js files without evaluating them. This page therefore cannot be cited. ' +
      'The fix is server rendering, static generation, or prerendering at build time — the text ' +
      'simply has to ship with the page, no stack change required.',
  }),
  'a1.dynamic': (v) => ({
    title: 'Prerendering gated on the user-agent — it works, but it is fragile',
    detail:
      `An AI crawler receives ${v.botWords} words; a browser receives only ${v.rawWords} before ` +
      'JavaScript runs. The site is serving prerendered HTML to user-agents it recognises. ' +
      'Visibility then depends on maintaining that list: any crawler missing from it gets the empty ' +
      'shell. Worth rechecking every time a new AI engine appears.',
  }),
  'a1.thin': (v) => ({
    title: 'The page is readable, but it holds little text',
    detail:
      `${v.botWords} readable words. Rendering is not the problem: the page is served as-is. The ` +
      'corpus does not ask you to write long — an effective sales page averages 415 words — but ' +
      'below a hundred words there is not enough to answer a query.',
  }),
  'a1.ssr': (v) => ({
    title: 'The text ships with the page',
    detail:
      `${v.botWords} words readable without executing any JavaScript. This is the ideal state: the ` +
      'page exists for AI crawlers and search engines alike, without depending on a user-agent ' +
      'list someone has to maintain.',
  }),
  'h1.negotiated': (v) => ({
    title: 'This site serves a text version dedicated to AI crawlers',
    detail:
      `The server answered with "${v.contentType}" to an AI-crawler user-agent instead of HTML. ` +
      'That is deliberate content negotiation, and a sign of a site already prepared for AI ' +
      'engines. HTML tag checks do not apply here.',
  }),
  'b2.short': (v) => ({
    title: `Title is ${v.titleLength} characters`,
    detail:
      'The corpus measures +10 to 40 % traffic for long multi-intent titles of 150 to 250 ' +
      'characters, with the essentials in the first twelve words. The 60-character rule does not ' +
      'hold. One caveat: Google Discover wants the opposite.',
  }),
  'b2.ok': (v) => ({
    title: `Title is ${v.titleLength} characters`,
    detail: 'Within the 150 to 250 character band the corpus measures as the most profitable.',
  }),
  'b1.noTitle': () => ({
    title: 'No readable title tag',
    detail:
      'The title is one of the five placements that carry 70 % of the on-page result — along with ' +
      'the URL, the H1, the start of the first sentence, and the meta description.',
  }),
  'b1.noH1': () => ({
    title: 'No H1',
    detail:
      'The H1 is one of the five placements. Its absence is a defect; the corpus does not, however, ' +
      'settle their NUMBER, and no position on that has a demonstrated effect.',
  }),
  'b3.hasDesc': () => ({
    title: 'This page has a meta description',
    detail:
      'Google ignores 63 % of them, and the ones it writes itself convert 3 % better. The corpus ' +
      'recommends writing them only on five to ten key pages, and never generating them ' +
      'automatically: generated descriptions measurably perform worse than none at all.',
  }),
  'l1.jsonLd': () => ({
    title: 'Schema markup detected',
    detail:
      'Four independent tests, including a full two-year rollout: no measurable effect on rankings. ' +
      'Effect on AI citation: +2.4 %, indistinguishable from zero. Keep it if it serves a specific ' +
      'purpose (site name in results, product listings, Google Shopping), but do not expand it ' +
      'expecting rankings.',
  }),
};

const ES: Table = {
  'a1.invisible': (v) => ({
    title: 'El contenido de esta página necesita JavaScript para aparecer',
    detail:
      `Un rastreador de IA solo recibe ${v.botWords} palabras. Ningún gran rastreador de IA ejecuta ` +
      'JavaScript: descargan los archivos .js sin evaluarlos. Esta página no puede ser citada. ' +
      'La corrección es el renderizado en servidor, la generación estática o el prerrenderizado en ' +
      'el build — basta con que el texto viaje con la página, sin cambiar de stack.',
  }),
  'a1.dynamic': (v) => ({
    title: 'Prerrenderizado condicionado al user-agent: funciona, pero es frágil',
    detail:
      `Un rastreador de IA recibe ${v.botWords} palabras; un navegador solo ${v.rawWords} antes de ` +
      'ejecutar JavaScript. El sitio sirve HTML prerrenderizado a los user-agents que reconoce. ' +
      'La visibilidad depende entonces de mantener esa lista: cualquier rastreador ausente recibe ' +
      'la cáscara vacía. Conviene revisarlo con cada nuevo motor de IA.',
  }),
  'a1.thin': (v) => ({
    title: 'La página es legible, pero contiene poco texto',
    detail:
      `${v.botWords} palabras legibles. El renderizado no es el problema: la página se sirve tal ` +
      'cual. El corpus no pide escribir largo — una página de venta eficaz promedia 415 palabras — ' +
      'pero por debajo de cien palabras no hay con qué responder a una consulta.',
  }),
  'a1.ssr': (v) => ({
    title: 'El texto viaja con la página',
    detail:
      `${v.botWords} palabras legibles sin ejecutar JavaScript. Es el estado ideal: la página existe ` +
      'tanto para los rastreadores de IA como para los motores de búsqueda, sin depender de una ' +
      'lista de user-agents que haya que mantener.',
  }),
  'h1.negotiated': (v) => ({
    title: 'Este sitio sirve una versión de texto dedicada a los rastreadores de IA',
    detail:
      `El servidor respondió con «${v.contentType}» a un user-agent de rastreador de IA en lugar de ` +
      'HTML. Es negociación de contenido deliberada, y señal de un sitio ya preparado para los ' +
      'motores de IA. Las comprobaciones de etiquetas HTML no aplican aquí.',
  }),
  'b2.short': (v) => ({
    title: `Título de ${v.titleLength} caracteres`,
    detail:
      'El corpus mide +10 a 40 % de tráfico con títulos largos multi-intención de 150 a 250 ' +
      'caracteres, con lo esencial en las primeras doce palabras. La regla de los 60 caracteres no ' +
      'se sostiene. Ojo: Google Discover pide lo contrario.',
  }),
  'b2.ok': (v) => ({
    title: `Título de ${v.titleLength} caracteres`,
    detail: 'Dentro del rango de 150 a 250 caracteres que el corpus mide como el más rentable.',
  }),
  'b1.noTitle': () => ({
    title: 'Ninguna etiqueta title legible',
    detail:
      'El título es una de las cinco ubicaciones que aportan el 70 % del resultado on-page, junto ' +
      'con la URL, el H1, el inicio de la primera frase y la meta descripción.',
  }),
  'b1.noH1': () => ({
    title: 'Ningún H1',
    detail:
      'El H1 es una de las cinco ubicaciones. Su ausencia es un defecto; en cambio el corpus no ' +
      'zanja su NÚMERO, y ninguna postura al respecto tiene efecto demostrado.',
  }),
  'b3.hasDesc': () => ({
    title: 'Esta página tiene meta descripción',
    detail:
      'Google ignora el 63 %, y las que redacta él mismo convierten un 3 % mejor. El corpus ' +
      'recomienda escribirlas solo en cinco a diez páginas clave, y nunca generarlas ' +
      'automáticamente: las generadas rinden medibles peor que no poner ninguna.',
  }),
  'l1.jsonLd': () => ({
    title: 'Marcado schema detectado',
    detail:
      'Cuatro pruebas independientes, incluida una implantación completa de dos años: ningún efecto ' +
      'medible en el posicionamiento. Efecto en la citación por IA: +2,4 %, indistinguible de cero. ' +
      'Consérvalo si cumple un uso concreto (nombre del sitio en los resultados, fichas de ' +
      'producto, Google Shopping), pero no lo amplíes esperando posiciones.',
  }),
};

const TABLES: Record<CheckerLang, Table> = { fr: FR, en: EN, es: ES };

export function findingCopy(lang: CheckerLang, key: CopyKey, vars: CopyVars): Entry {
  return TABLES[lang][key](vars);
}
