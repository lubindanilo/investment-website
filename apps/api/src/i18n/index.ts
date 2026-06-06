/**
 * i18n côté API — localise le CONTENU GÉNÉRÉ (critères chiffrés, erreurs).
 *
 * Le front envoie sa langue via l'en-tête `Accept-Language` ; `parseLang` la normalise.
 * `tt(lang, id, vars)` rend une chaîne du catalogue avec interpolation `{{var}}`.
 */
export const API_LANGS = ['fr', 'en', 'es'] as const;
export type Lang = (typeof API_LANGS)[number];

/** Normalise un en-tête Accept-Language (ou un code brut) en langue supportée, repli `fr`. */
export function parseLang(header?: string | null): Lang {
  if (!header) return 'fr';
  // "fr-FR,fr;q=0.9,en;q=0.8" → "fr" ; "en" → "en"
  const first = header.split(',')[0]?.trim().slice(0, 2).toLowerCase();
  return (API_LANGS as readonly string[]).includes(first ?? '') ? (first as Lang) : 'fr';
}

type Vars = Record<string, string | number>;

/** Interpole `{{x}}` dans une chaîne. */
function interp(s: string, vars?: Vars): string {
  if (!vars) return s;
  return s.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? String(vars[k]) : `{{${k}}}`));
}

/** Rend la chaîne du catalogue pour `id` dans `lang` (repli fr puis l'id brut). */
export function tt(lang: Lang, id: string, vars?: Vars): string {
  const s = CATALOG[lang]?.[id] ?? CATALOG.fr[id] ?? id;
  return interp(s, vars);
}

/**
 * Catalogue plat (id → chaîne) pour les 3 langues. Couvre les 10 critères chiffrés
 * affichés (nom, cible, verdicts) + quelques messages d'erreur API.
 */
const CATALOG: Record<Lang, Record<string, string>> = {
  fr: {
    // netMargin
    'netMargin.name': 'Rentable (marge nette)',
    'netMargin.target': '> 0 %',
    'netMargin.profitable': 'Entreprise rentable ({{pct}})',
    'netMargin.losses': 'Pertes nettes',
    // revenueGrowth5y
    'revenueGrowth5y.name': 'Croissance du CA 5 ans',
    'revenueGrowth5y.target': '> 10 %/an',
    'revenueGrowth5y.strong': 'Croissance soutenue',
    'revenueGrowth5y.weak': 'Croissance insuffisante',
    'revenueGrowth5y.unavailable': 'Historique CA insuffisant',
    // fcfGrowth5y
    'fcfGrowth5y.name': 'Croissance FCF/action 5 ans',
    'fcfGrowth5y.target': '> 10 %/an (ajusté SBC)',
    'fcfGrowth5y.strong': 'Création de valeur par action solide',
    'fcfGrowth5y.weak': 'Création de valeur par action faible',
    'fcfGrowth5y.unavailable': 'Historique FCF/action insuffisant',
    // shareCount5y
    'shareCount5y.name': "Évolution nombre d'actions 5 ans",
    'shareCount5y.target': 'Stable ou en baisse',
    'shareCount5y.buybacks': 'Rachats nets — création de valeur ({{pct}}%/an)',
    'shareCount5y.stable': "Nombre d'actions stable",
    'shareCount5y.moderate': 'Dilution modérée ({{pct}}%/an)',
    'shareCount5y.heavy': 'Dilution forte ({{pct}}%/an)',
    // fcfMargin
    'fcfMargin.name': 'Marge FCF (ajustée SBC)',
    'fcfMargin.target': '> 10 %',
    'fcfMargin.solid': 'Marge FCF solide',
    'fcfMargin.weak': 'Marge FCF faible',
    // operatingLeverage
    'operatingLeverage.name': 'Operating leverage',
    'operatingLeverage.target': 'Marge en expansion sur 5 ans',
    'operatingLeverage.expansionVal': '✓ Expansion',
    'operatingLeverage.compressionVal': '✗ Compression',
    'operatingLeverage.expansion': 'Revenus croissent plus vite que les coûts',
    'operatingLeverage.compression': 'Coûts grandissent plus vite que les revenus',
    'operatingLeverage.unavailable': 'Trajectoire 5 ans indisponible',
    // cashRoce
    'cashRoce.name': 'Cash ROCE',
    'cashRoce.target': '> 15 % (FCF ÷ Capital Investi)',
    'cashRoce.excellent': 'Excellent retour cash sur capital',
    'cashRoce.weak': 'Retour sur capital insuffisant',
    'cashRoce.note.noExcess': ' (calcul fallback ultra-cash-rich — voir ⓘ)',
    'cashRoce.note.noGoodwill': ' (formule Buffett goodwill inclus — voir ⓘ)',
    'cashRoce.note.financial': ' (formule secteur financier — voir ⓘ)',
    // netDebtFcf
    'netDebtFcf.name': 'Dette nette / FCF',
    'netDebtFcf.target': '< 3 ans',
    'netDebtFcf.netcash': 'Trésorerie nette positive',
    'netDebtFcf.repayable': 'Remboursable en {{years}} ans',
    'netDebtFcf.high': 'Endettement élevé',
    // cashConversion
    'cashConversion.name': 'Cash Conversion Rate',
    'cashConversion.target': '> 1 (FCF / Net Income)',
    'cashConversion.good': 'Les bénéfices deviennent vraiment du cash',
    'cashConversion.weak': "Une partie des bénéfices ne se transforme pas en cash",
    // ccc — Cash Conversion Cycle (jours) = DSO + DIO − DPO
    'ccc.name': 'Cycle de conversion du cash',
    'ccc.target': 'en baisse ou négatif (modèle float)',
    'ccc.float': '{{x}} j — la société encaisse avant de payer ses fournisseurs (modèle float type Amazon, Costco)',
    'ccc.compressing': '{{x}} j · en compression ({{s}} j/an) — efficacité opérationnelle qui s\'améliore',
    'ccc.stable': '{{x}} j · stable ({{s}} j/an) — pas d\'évolution significative sur 5 ans',
    'ccc.lengthening': '{{x}} j · en allongement ({{s}} j/an) — créances ou stocks qui dérapent',
    'ccc.noTrend': '{{x}} j — historique insuffisant pour estimer la tendance sur 5 ans',
    'ccc.unavailable': 'Cycle de conversion du cash indisponible (créances, stocks ou coût des ventes manquants)',
    // commun
    'common.unavailable': 'Donnée indisponible',
    'common.notCalc': 'Non calculable',
    'common.perYear': '%/an',
    // erreurs API
    'error.notFound': '« {{ticker}} » n\'a pas été trouvé',
    'error.notFoundDetail': "Aucune donnée pour ce symbole. Vérifie l'orthographe (ex : AAPL, MSFT, MC.PA). Si le symbole est correct, il n'est peut-être pas couvert, ou réessaie dans une minute.",
  },
  en: {
    'netMargin.name': 'Profitable (net margin)',
    'netMargin.target': '> 0 %',
    'netMargin.profitable': 'Profitable company ({{pct}})',
    'netMargin.losses': 'Net losses',
    'revenueGrowth5y.name': 'Revenue growth 5Y',
    'revenueGrowth5y.target': '> 10 %/yr',
    'revenueGrowth5y.strong': 'Strong growth',
    'revenueGrowth5y.weak': 'Insufficient growth',
    'revenueGrowth5y.unavailable': 'Insufficient revenue history',
    'fcfGrowth5y.name': 'FCF/share growth 5Y',
    'fcfGrowth5y.target': '> 10 %/yr (SBC-adjusted)',
    'fcfGrowth5y.strong': 'Strong per-share value creation',
    'fcfGrowth5y.weak': 'Weak per-share value creation',
    'fcfGrowth5y.unavailable': 'Insufficient FCF/share history',
    'shareCount5y.name': 'Share count trend 5Y',
    'shareCount5y.target': 'Stable or declining',
    'shareCount5y.buybacks': 'Net buybacks — value creation ({{pct}}%/yr)',
    'shareCount5y.stable': 'Stable share count',
    'shareCount5y.moderate': 'Moderate dilution ({{pct}}%/yr)',
    'shareCount5y.heavy': 'Heavy dilution ({{pct}}%/yr)',
    'fcfMargin.name': 'FCF margin (SBC-adjusted)',
    'fcfMargin.target': '> 10 %',
    'fcfMargin.solid': 'Solid FCF margin',
    'fcfMargin.weak': 'Weak FCF margin',
    'operatingLeverage.name': 'Operating leverage',
    'operatingLeverage.target': 'Margin expanding over 5Y',
    'operatingLeverage.expansionVal': '✓ Expansion',
    'operatingLeverage.compressionVal': '✗ Compression',
    'operatingLeverage.expansion': 'Revenue grows faster than costs',
    'operatingLeverage.compression': 'Costs grow faster than revenue',
    'operatingLeverage.unavailable': '5Y trajectory unavailable',
    'cashRoce.name': 'Cash ROCE',
    'cashRoce.target': '> 15 % (FCF ÷ Invested Capital)',
    'cashRoce.excellent': 'Excellent cash return on capital',
    'cashRoce.weak': 'Insufficient return on capital',
    'cashRoce.note.noExcess': ' (ultra-cash-rich fallback calc — see ⓘ)',
    'cashRoce.note.noGoodwill': ' (Buffett formula incl. goodwill — see ⓘ)',
    'cashRoce.note.financial': ' (financial-sector formula — see ⓘ)',
    'netDebtFcf.name': 'Net debt / FCF',
    'netDebtFcf.target': '< 3 yrs',
    'netDebtFcf.netcash': 'Net cash positive',
    'netDebtFcf.repayable': 'Repayable in {{years}} yrs',
    'netDebtFcf.high': 'High leverage',
    'cashConversion.name': 'Cash Conversion Rate',
    'cashConversion.target': '> 1 (FCF / Net Income)',
    'cashConversion.good': 'Earnings truly convert to cash',
    'cashConversion.weak': "Part of earnings doesn't convert to cash",
    'ccc.name': 'Cash Conversion Cycle',
    'ccc.target': 'falling or negative (float model)',
    'ccc.float': '{{x}} d — customers pay before suppliers (Amazon/Costco-style float model)',
    'ccc.compressing': '{{x}} d · compressing ({{s}} d/yr) — operating efficiency improving',
    'ccc.stable': '{{x}} d · stable ({{s}} d/yr) — no significant change over 5 years',
    'ccc.lengthening': '{{x}} d · lengthening ({{s}} d/yr) — receivables or inventory drifting',
    'ccc.noTrend': '{{x}} d — insufficient history to estimate the 5-year trend',
    'ccc.unavailable': 'Cash conversion cycle unavailable (receivables, inventory or cost of revenue missing)',
    'common.unavailable': 'Data unavailable',
    'common.notCalc': 'Not available',
    'common.perYear': '%/yr',
    'error.notFound': '“{{ticker}}” was not found',
    'error.notFoundDetail': "No data for this symbol. Check the spelling (e.g. AAPL, MSFT, MC.PA). If the symbol is correct, it may not be covered — or try again in a minute.",
  },
  es: {
    'netMargin.name': 'Rentable (margen neto)',
    'netMargin.target': '> 0 %',
    'netMargin.profitable': 'Empresa rentable ({{pct}})',
    'netMargin.losses': 'Pérdidas netas',
    'revenueGrowth5y.name': 'Crecimiento de ventas 5 años',
    'revenueGrowth5y.target': '> 10 %/año',
    'revenueGrowth5y.strong': 'Crecimiento sólido',
    'revenueGrowth5y.weak': 'Crecimiento insuficiente',
    'revenueGrowth5y.unavailable': 'Histórico de ventas insuficiente',
    'fcfGrowth5y.name': 'Crecimiento FCF/acción 5 años',
    'fcfGrowth5y.target': '> 10 %/año (ajustado SBC)',
    'fcfGrowth5y.strong': 'Sólida creación de valor por acción',
    'fcfGrowth5y.weak': 'Débil creación de valor por acción',
    'fcfGrowth5y.unavailable': 'Histórico FCF/acción insuficiente',
    'shareCount5y.name': 'Evolución del número de acciones 5 años',
    'shareCount5y.target': 'Estable o a la baja',
    'shareCount5y.buybacks': 'Recompras netas — creación de valor ({{pct}}%/año)',
    'shareCount5y.stable': 'Número de acciones estable',
    'shareCount5y.moderate': 'Dilución moderada ({{pct}}%/año)',
    'shareCount5y.heavy': 'Dilución fuerte ({{pct}}%/año)',
    'fcfMargin.name': 'Margen FCF (ajustado SBC)',
    'fcfMargin.target': '> 10 %',
    'fcfMargin.solid': 'Margen FCF sólido',
    'fcfMargin.weak': 'Margen FCF débil',
    'operatingLeverage.name': 'Apalancamiento operativo',
    'operatingLeverage.target': 'Margen en expansión a 5 años',
    'operatingLeverage.expansionVal': '✓ Expansión',
    'operatingLeverage.compressionVal': '✗ Compresión',
    'operatingLeverage.expansion': 'Los ingresos crecen más rápido que los costes',
    'operatingLeverage.compression': 'Los costes crecen más rápido que los ingresos',
    'operatingLeverage.unavailable': 'Trayectoria de 5 años no disponible',
    'cashRoce.name': 'Cash ROCE',
    'cashRoce.target': '> 15 % (FCF ÷ Capital Invertido)',
    'cashRoce.excellent': 'Excelente retorno de caja sobre capital',
    'cashRoce.weak': 'Retorno sobre capital insuficiente',
    'cashRoce.note.noExcess': ' (cálculo alternativo ultra-cash-rich — ver ⓘ)',
    'cashRoce.note.noGoodwill': ' (fórmula Buffett con goodwill — ver ⓘ)',
    'cashRoce.note.financial': ' (fórmula sector financiero — ver ⓘ)',
    'netDebtFcf.name': 'Deuda neta / FCF',
    'netDebtFcf.target': '< 3 años',
    'netDebtFcf.netcash': 'Caja neta positiva',
    'netDebtFcf.repayable': 'Reembolsable en {{years}} años',
    'netDebtFcf.high': 'Endeudamiento elevado',
    'cashConversion.name': 'Cash Conversion Rate',
    'cashConversion.target': '> 1 (FCF / Beneficio neto)',
    'cashConversion.good': 'Los beneficios se convierten realmente en caja',
    'cashConversion.weak': 'Parte de los beneficios no se convierte en caja',
    'ccc.name': 'Ciclo de conversión de efectivo',
    'ccc.target': 'a la baja o negativo (modelo float)',
    'ccc.float': '{{x}} d — los clientes pagan antes que los proveedores (modelo float tipo Amazon, Costco)',
    'ccc.compressing': '{{x}} d · en compresión ({{s}} d/año) — eficiencia operativa mejorando',
    'ccc.stable': '{{x}} d · estable ({{s}} d/año) — sin variación significativa en 5 años',
    'ccc.lengthening': '{{x}} d · en alargamiento ({{s}} d/año) — cuentas por cobrar o inventario deslizándose',
    'ccc.noTrend': '{{x}} d — historial insuficiente para estimar la tendencia a 5 años',
    'ccc.unavailable': 'Ciclo de conversión de efectivo no disponible (cuentas por cobrar, inventario o coste de ventas faltantes)',
    'common.unavailable': 'Dato no disponible',
    'common.notCalc': 'No disponible',
    'common.perYear': '%/año',
    'error.notFound': '«{{ticker}}» no se ha encontrado',
    'error.notFoundDetail': "No hay datos para este símbolo. Verifica la ortografía (p. ej. AAPL, MSFT, MC.PA). Si el símbolo es correcto, puede que no esté cubierto — o inténtalo de nuevo en un minuto.",
  },
};
