# Kit d'identité de marque (empilement d'entité)

Base de référence pour tous les profils externes : X, Reddit, LinkedIn, annuaires,
registres MCP, communiqués. Sert le geste « empilement d'entité » du chapitre 7 de la
masterclass SEO : l'accumulation de profils dont la description est **identique mot pour
mot** produit des changements de classement mesurables sur les petites marques, avant même
toute publication de contenu.

## La seule règle

**Copier-coller sans reformuler.** La cohérence exacte est le mécanisme, pas le contenu.
Une variante « améliorée » sur un profil casse le signal sur tous les autres. Si une
plateforme impose une limite plus courte, prendre la version courte ci-dessous, jamais
inventer un raccourci.

## Identité retenue

| Champ | Valeur |
|---|---|
| Nom affiché partout | `Lubin Danilo` |
| Handle principal | `lubin_danilo` (créé le 2026-08-04) |
| Site | `https://lubin-investment.com` |
| Localisation | `France` |

**Pourquoi le nom de la personne et pas celui de la marque.** Deux raisons. En YMYL
finance, la réputation qui compte est celle de l'auteur, et Google la stocke (chapitre 8).
Et sur Reddit, un compte au nom d'un produit est identifié comme promotionnel dès le
premier message, ce qui est précisément le chemin vers le sentiment négatif qui bloque les
mentions de marque dans ChatGPT. La marque reste couverte : « Lubin » est dans les deux
noms, et elle figure dans chaque description.

## Description canonique

### Version courte (≤ 160 caractères)

Pour X, et pour tout annuaire à limite serrée.

**FR** (146 car.)
```
Investisseur particulier, je bats le S&P 500 depuis 3 ans. J'ai bâti Lubin Investment : la qualité et le prix de 16 000 actions, notés séparément.
```

**EN** (142 car.)
```
Individual investor, beating the S&P 500 for 3 years. I built Lubin Investment: the quality and the price of 16,000 stocks, scored separately.
```

**ES** (152 car.)
```
Inversor particular, supero al S&P 500 desde hace 3 años. He creado Lubin Investment: la calidad y el precio de 16.000 acciones, puntuados por separado.
```

### Version moyenne (~300 caractères)

Pour LinkedIn (section À propos), les annuaires professionnels, les registres MCP, les
fiches de presse.

**FR** (307 car.)
```
Investisseur particulier autodidacte, je bats le S&P 500 depuis trois ans. J'ai bâti Lubin Investment pour juger séparément la qualité d'une entreprise et son prix, sur des critères inspirés de Warren Buffett, Michael Mauboussin et Aswath Damodaran. Plus de 16 000 actions notées et mises à jour en continu.
```

**EN** (292 car.)
```
A self-taught individual investor, I have beaten the S&P 500 for three years. I built Lubin Investment to judge a company's quality and its price separately, using criteria drawn from Warren Buffett, Michael Mauboussin and Aswath Damodaran. Over 16,000 stocks scored and updated continuously.
```

**ES** (307 car.)
```
Inversor particular autodidacta, supero al S&P 500 desde hace tres años. He creado Lubin Investment para juzgar por separado la calidad de una empresa y su precio, con criterios inspirados en Warren Buffett, Michael Mauboussin y Aswath Damodaran. Más de 16.000 acciones puntuadas y actualizadas en continuo.
```

### Version longue

Utiliser telle quelle la constante `AUTHOR_BIO` de
[apps/api/src/routes/seoPrerender.ts](../../apps/api/src/routes/seoPrerender.ts) (FR, EN,
ES). C'est déjà la bio publiée sur le site, donc c'est elle qui fait référence. Ne pas en
créer une seconde.

## X (compte anglophone)

Le compte est tenu en anglais : c'est la langue dans laquelle les posts seront écrits, et
c'est aussi là qu'est la portée réelle du site (l'article Micron EN a fait 55 % des
impressions du domaine). La bio ci-dessous est donc la référence pour X, et la version
courte EN reste la description canonique pour les annuaires anglophones.

| Champ | À coller |
|---|---|
| Name | `Lubin Danilo` |
| Username | `lubin_danilo` |
| Bio (148 car.) | voir ci-dessous |
| Location | `France` |
| Website | `https://lubin-investment.com` |
| Header | `docs/seo/assets/x-banner.png` (1500 × 500) |
| Photo | la même que LinkedIn, sans exception |

**Bio** (148 car.)
```
I score every listed company on 3 things: quality today, resilience tomorrow, a price worth paying. 16,000+ stocks. Beating the S&P 500 for 3 years.
```

Les trois piliers sont ceux du produit, pas une reformulation : `quality` noté sur 10,
`resilience` notée de A à E, `valuation` en P/FCF. C'est déjà la phrase du site en anglais
(`apps/web/src/i18n/locales/en.json:607` : « Quality and resilience scores, followed by
P/FCF valuation »), donc la bio, la home EN et les posts disent la même chose. C'est
exactement ce que cherche l'empilement d'entité.

La marque n'est pas nommée dans la prose, elle n'en a pas besoin : elle est dans le nom
affiché, dans le champ Website et sur la bannière. Ça libère une vingtaine de caractères
pour le message.

La performance vient en dernier, et elle n'est défendable que si le post épinglé la
documente.

**Post épinglé.** Pointer `/palmares`, avec le bloc de lecture honnête (biais de survie)
visible. En finance sur X, une performance annoncée sans preuve consultable se fait
attaquer en quelques heures. Le track record public avec ses réserves est l'inverse : c'est
l'atout, et c'est aussi ce que le chapitre 8 mesure comme variable de survie en YMYL
(l'équilibre éditorial sépare -53 % de -97,6 % de trafic).

## Reddit

| Champ | À coller |
|---|---|
| Username | `lubin_danilo` |
| Display name | `Lubin Danilo` |
| About (200 car. max) | voir ci-dessous |
| Social link | `https://lubin-investment.com` |

**About** (170 car., FR)
```
Investisseur particulier, analyse fondamentale. Je note séparément la qualité d'une entreprise et son prix, sur des critères inspirés de Buffett, Mauboussin et Damodaran.
```

**Volontairement sans marque ni mention de gratuité.** C'est la seule description du kit
qui s'écarte de la canonique, et c'est délibéré. Le corpus signale qu'un sentiment négatif
sur Reddit empêche les mentions de marque d'apparaître dans les réponses de ChatGPT, et que
personne ne sait comment le corriger. Le coût d'une mauvaise entrée sur Reddit est donc
supérieur au coût de l'absence. La marque s'ajoute plus tard, une fois l'historique
constitué.

**Posture des premières semaines** : lire et répondre, zéro lien vers le site, zéro mention
du produit. Les subs finance bannissent l'autopromotion, et un compte neuf qui poste un
lien est traité comme du spam.

## Après création

Câbler les deux URLs dans le code (ce sont aujourd'hui des trous ou des liens morts) :

- `sameAs` du `Person` : n'a que LinkedIn, `apps/api/src/routes/seoPrerender.ts:1520`
- `sameAs` absent de l'`Organization` de la home, `seoPrerender.ts:2688`
- `twitter:site` et `twitter:creator` absents partout (`twitter:card` est bien posé)
- `apps/web/src/components/AppFooter.tsx:66` : deux liens `href="#"` morts, étiquetés
  « Twitter » et « LinkedIn », présents sur toutes les pages du site
