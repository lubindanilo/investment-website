export const FUTURE_RESILIENCE_VERSION = '2.9.1-pilot.19' as const;
export const FUTURE_SCENARIO_YEAR = 2033 as const;

export const FUTURE_RESILIENCE_WEIGHTS = {
  future_control: 25,
  disruption_positioning: 20,
  future_dependencies: 10,
  structural_demand: 15,
  future_value_capture: 25,
  transition_capacity: 5,
} as const;

export type FutureCriterionId = keyof typeof FUTURE_RESILIENCE_WEIGHTS;
export type FutureGrade = 'A' | 'B' | 'C' | 'D' | 'E';
export type FutureConfidence = 'high' | 'medium' | 'low';
type TriState = boolean | null;

const MAX_SCORES: Record<FutureCriterionId, 2 | 3> = {
  future_control: 3,
  disruption_positioning: 3,
  future_dependencies: 2,
  structural_demand: 2,
  future_value_capture: 2,
  transition_capacity: 2,
};

export interface FutureCriterionResult {
  id: FutureCriterionId;
  score: number;
  maxScore: 2 | 3;
  reason: string;
  adverseCase: string;
  decisiveTrigger: string;
  confidence: FutureConfidence;
  audit: Record<string, unknown>;
}

export interface FutureResilienceAnalysis {
  version: typeof FUTURE_RESILIENCE_VERSION;
  scenarioYear: typeof FUTURE_SCENARIO_YEAR;
  rawScore: number;
  finalScore: number;
  grade: FutureGrade;
  gates: string[];
  criteria: FutureCriterionResult[];
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}: objet requis`);
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label}: texte requis`);
  return value.trim();
}

function tri(value: unknown, label: string): TriState {
  if (value === true || value === false || value === null) return value;
  throw new Error(`${label}: true, false ou null requis`);
}

function optionalTri(value: unknown, label: string): TriState {
  return value === undefined ? null : tri(value, label);
}

function choice<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (typeof value === 'string' && values.includes(value as T)) return value as T;
  throw new Error(`${label}: valeur invalide`);
}

function optionalChoice<T extends string>(
  value: unknown,
  values: readonly T[],
  fallback: T,
  label: string,
): T {
  return value === undefined ? fallback : choice(value, values, label);
}

function common(raw: Record<string, unknown>, id: FutureCriterionId) {
  return {
    id,
    maxScore: MAX_SCORES[id],
    reason: text(raw.reason, `${id}.reason`),
    adverseCase: text(raw.adverseCase, `${id}.adverseCase`),
    decisiveTrigger: text(raw.decisiveTrigger, `${id}.decisiveTrigger`),
    confidence: choice(raw.confidence, ['high', 'medium', 'low'] as const, `${id}.confidence`),
  };
}

function scoreFutureControl(raw: Record<string, unknown>): FutureCriterionResult {
  const audit = {
    futureProjectionContract: optionalTri(
      raw.futureProjectionContract,
      'future_control.futureProjectionContract',
    ),
    controlType: choice(raw.controlType, [
      'scarce_asset', 'regulated_right', 'trusted_brand', 'network_liquidity',
      'proprietary_stack_or_ip', 'cost_supply_chain', 'installed_base',
      'regulated_execution_capability', 'none',
    ] as const, 'future_control.controlType'),
    controlStillNeeded: tri(raw.controlStillNeeded, 'future_control.controlStillNeeded'),
    companySpecific: tri(raw.companySpecific, 'future_control.companySpecific'),
    majorityCoreCoverage: tri(raw.majorityCoreCoverage, 'future_control.majorityCoreCoverage'),
    scarcitySurvivesAiChina: tri(raw.scarcitySurvivesAiChina, 'future_control.scarcitySurvivesAiChina'),
    replicableWithinFiveYears: tri(raw.replicableWithinFiveYears, 'future_control.replicableWithinFiveYears'),
    futureRentPaid: tri(raw.futureRentPaid, 'future_control.futureRentPaid'),
    systemBottleneck: tri(raw.systemBottleneck, 'future_control.systemBottleneck'),
    multipleIndependentControls: tri(raw.multipleIndependentControls, 'future_control.multipleIndependentControls'),
    rightsVisibilityThroughScenario: optionalTri(
      raw.rightsVisibilityThroughScenario,
      'future_control.rightsVisibilityThroughScenario',
    ),
  };
  const foundation = audit.controlType !== 'none' && audit.controlStillNeeded === true &&
    audit.futureRentPaid === true;
  const qualifiedIndustrialBottleneck = audit.controlType === 'cost_supply_chain' &&
    audit.scarcitySurvivesAiChina === true && audit.systemBottleneck === true &&
    audit.multipleIndependentControls === true;
  const durableAgainstReplication = audit.scarcitySurvivesAiChina === true ||
    audit.replicableWithinFiveYears === false;
  const erosionProven = audit.scarcitySurvivesAiChina === false ||
    (audit.replicableWithinFiveYears === true && !qualifiedIndustrialBottleneck);
  const supportingPillars = [
    audit.companySpecific === true,
    audit.majorityCoreCoverage === true,
    durableAgainstReplication,
  ].filter(Boolean).length;
  const wideControl = foundation && audit.companySpecific === true &&
    audit.majorityCoreCoverage === true && !erosionProven;
  const regulatedExecutionNarrowControl = audit.controlType === 'regulated_execution_capability' &&
    audit.controlStillNeeded === true && audit.companySpecific === true &&
    audit.majorityCoreCoverage !== false && audit.futureRentPaid !== false;
  const controlRejected = audit.controlType === 'none' || audit.controlStillNeeded === false ||
    audit.companySpecific === false || audit.futureRentPaid === false ||
    (erosionProven && audit.majorityCoreCoverage !== true && !regulatedExecutionNarrowControl);
  const exceptionalControl = wideControl && audit.scarcitySurvivesAiChina === true &&
    audit.replicableWithinFiveYears === false &&
    (audit.systemBottleneck === true || audit.multipleIndependentControls === true);
  const score = controlRejected
    ? 0
    : erosionProven
      ? 1
      : exceptionalControl
      ? 3
      : wideControl
        ? 2
        : audit.controlType !== 'none' && audit.controlStillNeeded === true
          ? 1
          : 0;
  return { ...common(raw, 'future_control'), score, audit };
}

const DISRUPTION_FORCES = ['ai_agents', 'automation_robotics', 'china_engineering'] as const;

function scoreDisruption(
  raw: Record<string, unknown>,
  marketplaceBypassDisproved = false,
  digitalStackBenefitNotControlled = false,
  customerWorkflowMajorityThreat = false,
  uncontrolledAgenticPressure = false,
): FutureCriterionResult {
  if (!Array.isArray(raw.forces) || raw.forces.length !== DISRUPTION_FORCES.length) {
    throw new Error('disruption_positioning.forces: trois forces requises');
  }
  const forces = raw.forces.map((value, index) => {
    const item = record(value, `disruption_positioning.forces[${index}]`);
    const force = choice(item.force, DISRUPTION_FORCES, `disruption_positioning.forces[${index}].force`);
    const majorityCoreThreatPath = tri(item.majorityCoreThreatPath, `${force}.majorityCoreThreatPath`);
    const technicalAndEconomicPath = tri(item.technicalAndEconomicPath, `${force}.technicalAndEconomicPath`);
    const materialPressure = optionalTri(item.materialPressure, `${force}.materialPressure`);
    const pressureContractPresent = item.materialPressure !== undefined;
    const materialDirectBenefit = tri(item.materialDirectBenefit, `${force}.materialDirectBenefit`);
    const responseControlsOutcome = tri(item.responseControlsOutcome, `${force}.responseControlsOutcome`);
    const benefitMechanism = optionalChoice(item.benefitMechanism, [
      'none', 'external_demand_expansion', 'company_specific_control_strengthening',
      'company_specific_cost_or_capacity_advantage', 'company_specific_value_capture_expansion',
      'unproven',
    ] as const, 'unproven', `${force}.benefitMechanism`);
    const legacyBenefitContract = item.benefitMechanism === undefined;
    const contradictedMarketplaceBypass = marketplaceBypassDisproved && force === 'ai_agents';
    const contradictedDigitalStackBenefit = digitalStackBenefitNotControlled && force === 'ai_agents';
    const derivedCustomerWorkflowThreat = customerWorkflowMajorityThreat && force === 'ai_agents';
    const derivedUncontrolledAgenticPressure = uncontrolledAgenticPressure && force === 'ai_agents';
    const negative = derivedCustomerWorkflowThreat ||
      (majorityCoreThreatPath === true && technicalAndEconomicPath === true &&
        responseControlsOutcome !== true && !contradictedMarketplaceBypass);
    const pressure = !negative && !contradictedMarketplaceBypass &&
      (derivedUncontrolledAgenticPressure ||
        (majorityCoreThreatPath !== true && technicalAndEconomicPath === true &&
          responseControlsOutcome !== true &&
          (!pressureContractPresent || materialPressure === true)));
    const controlledBenefitMechanism = benefitMechanism !== 'none' && benefitMechanism !== 'unproven';
    const benefitDoesNotRequireCompanyControl = benefitMechanism === 'external_demand_expansion';
    const positive = !negative && !pressure && materialDirectBenefit === true &&
      (responseControlsOutcome === true || benefitDoesNotRequireCompanyControl) &&
      !contradictedDigitalStackBenefit && (legacyBenefitContract || controlledBenefitMechanism);
    return {
      force, majorityCoreThreatPath, technicalAndEconomicPath, materialDirectBenefit,
      materialPressure, pressureContractPresent, responseControlsOutcome, benefitMechanism, legacyBenefitContract,
      contradictedMarketplaceBypass, contradictedDigitalStackBenefit,
      derivedCustomerWorkflowThreat, derivedUncontrolledAgenticPressure,
      verdict: negative ? 'negative' : pressure ? 'pressure' : positive ? 'positive' : 'neutral',
    };
  });
  if (new Set(forces.map(item => item.force)).size !== DISRUPTION_FORCES.length) {
    throw new Error('disruption_positioning.forces: forces dupliquees');
  }
  const negatives = forces.filter(item => item.verdict === 'negative').length;
  const pressures = forces.filter(item => item.verdict === 'pressure').length;
  const uncontrolledPressures = forces.filter(item =>
    item.verdict === 'pressure' && item.derivedUncontrolledAgenticPressure).length;
  const positiveMechanisms = new Set(forces
    .filter(item => item.verdict === 'positive')
    .map(item => item.legacyBenefitContract ? `legacy:${item.force}` : item.benefitMechanism));
  const score = negatives >= 2 || (negatives === 1 && pressures >= 1)
    ? 0
    : negatives === 1 || pressures >= 2 || uncontrolledPressures >= 1
      ? 1
      : positiveMechanisms.size >= 2 ? 3 : 2;
  return { ...common(raw, 'disruption_positioning'), score, audit: { forces } };
}

function scoreDependencies(raw: Record<string, unknown>): FutureCriterionResult {
  const coverageComplete = tri(raw.coverageComplete, 'future_dependencies.coverageComplete');
  const residualOnlyAssessment = optionalTri(
    raw.residualOnlyAssessment,
    'future_dependencies.residualOnlyAssessment',
  );
  const futureSeverityContract = optionalTri(
    raw.futureSeverityContract,
    'future_dependencies.futureSeverityContract',
  );
  if (!Array.isArray(raw.clusters)) throw new Error('future_dependencies.clusters: tableau requis');
  const clusters = raw.clusters.map((value, index) => {
    const item = record(value, `future_dependencies.clusters[${index}]`);
    return {
      name: text(item.name, `future_dependencies.clusters[${index}].name`),
      material: tri(item.material, `future_dependencies.clusters[${index}].material`),
      continuityImpact: choice(item.continuityImpact, [
        'existential', 'material_impairment', 'non_core', 'unproven',
      ] as const, `future_dependencies.clusters[${index}].continuityImpact`),
      mitigation: choice(item.mitigation, [
        'strong', 'medium', 'none', 'unproven',
      ] as const, `future_dependencies.clusters[${index}].mitigation`),
      coreContinuityAtRisk: optionalTri(
        item.coreContinuityAtRisk,
        `future_dependencies.clusters[${index}].coreContinuityAtRisk`,
      ),
    };
  });
  const material = clusters.filter(item => item.material === true && item.continuityImpact !== 'non_core');
  const existential = material.some(item => item.continuityImpact === 'existential' && item.mitigation === 'none');
  const unmitigated = material.filter(item => item.mitigation === 'none').length;
  const aBlockingContinuityShocks = material.filter(item =>
    item.mitigation === 'none' ||
    (item.continuityImpact === 'existential' && item.mitigation !== 'strong'));
  const unmitigatedMaterialShocks = material.filter(item => item.mitigation === 'none').length;
  const existentialNonStrongShocks = material.filter(item =>
    item.continuityImpact === 'existential' && item.mitigation !== 'strong').length;
  const nonStrongMaterialShocks = material.filter(item => item.mitigation !== 'strong').length;
  const strictResidualBurden = residualOnlyAssessment === true &&
    (nonStrongMaterialShocks >= 3 || existentialNonStrongShocks >= 2);
  const coreContinuityShocks = material.filter(item => item.coreContinuityAtRisk === true);
  const nonStrongCoreContinuityShocks = coreContinuityShocks.filter(item => item.mitigation !== 'strong');
  const unmitigatedCoreContinuityShocks = coreContinuityShocks.filter(item => item.mitigation === 'none');
  const strictFutureContinuityBurden = unmitigatedCoreContinuityShocks.length >= 2 ||
    nonStrongCoreContinuityShocks.filter(item => item.continuityImpact === 'existential').length >= 2;
  const score = futureSeverityContract === true
    ? strictFutureContinuityBurden
      ? 0
      : coverageComplete === true && nonStrongCoreContinuityShocks.length === 0
        ? 2
        : 1
    : existential || unmitigated >= 3 || strictResidualBurden
      ? 0
      : coverageComplete === true && material.every(item => item.mitigation === 'strong')
        ? 2
        : 1;
  return {
    ...common(raw, 'future_dependencies'),
    score,
    audit: {
      coverageComplete,
      residualOnlyAssessment,
      futureSeverityContract,
      clusters,
      aBlockingContinuityShocks: aBlockingContinuityShocks.length,
      unmitigatedMaterialShocks,
      existentialNonStrongShocks,
      nonStrongMaterialShocks,
      coreContinuityShocks: coreContinuityShocks.length,
      nonStrongCoreContinuityShocks: nonStrongCoreContinuityShocks.length,
      unmitigatedCoreContinuityShocks: unmitigatedCoreContinuityShocks.length,
    },
  };
}

function scoreDemand(raw: Record<string, unknown>): FutureCriterionResult {
  const projectionContractPresent = raw.netExpansionAfterSubstitution !== undefined ||
    raw.futureDriver !== undefined;
  const audit = {
    futureCategoryTrend: choice(raw.futureCategoryTrend, [
      'rising', 'stable', 'declining', 'unproven',
    ] as const, 'structural_demand.futureCategoryTrend'),
    causalDirectness: choice(raw.causalDirectness, [
      'direct', 'enabling', 'indirect', 'none', 'unproven',
    ] as const, 'structural_demand.causalDirectness'),
    coreExposure: choice(raw.coreExposure, [
      'majority', 'material_minority', 'limited', 'unproven',
    ] as const, 'structural_demand.coreExposure'),
    netExpansionAfterSubstitution: optionalTri(
      raw.netExpansionAfterSubstitution,
      'structural_demand.netExpansionAfterSubstitution',
    ),
    futureDriver: optionalChoice(raw.futureDriver, [
      'ai_agents', 'automation_robotics', 'china_engineering', 'demographics_social',
      'climate_resources', 'regulation_infrastructure', 'generic_market_forecast', 'unproven',
    ] as const, 'unproven', 'structural_demand.futureDriver'),
    projectionContractPresent,
  };
  const direct = audit.causalDirectness === 'direct' || audit.causalDirectness === 'enabling';
  const qualifiedNetExpansion = !projectionContractPresent ||
    (audit.netExpansionAfterSubstitution === true &&
      !['generic_market_forecast', 'unproven'].includes(audit.futureDriver));
  const score = audit.futureCategoryTrend === 'rising' && direct &&
      audit.coreExposure === 'majority' && qualifiedNetExpansion
    ? 2
    : direct && (audit.futureCategoryTrend === 'rising' || audit.futureCategoryTrend === 'stable') &&
        (audit.coreExposure === 'majority' || audit.coreExposure === 'material_minority')
      ? 1
      : audit.futureCategoryTrend === 'unproven' && direct && audit.coreExposure === 'majority'
        ? 1
      : 0;
  return { ...common(raw, 'structural_demand'), score, audit };
}

function scoreValueCapture(
  raw: Record<string, unknown>,
  futureControlScore: number,
  marketplaceDurabilityOverride = false,
): FutureCriterionResult {
  const marketplaceRaw = raw.marketplaceMechanics === undefined
    ? {}
    : record(raw.marketplaceMechanics, 'future_value_capture.marketplaceMechanics');
  const marketplaceMechanics = {
    applies: optionalTri(marketplaceRaw.applies, 'marketplaceMechanics.applies'),
    fragmentedCounterparties: optionalTri(
      marketplaceRaw.fragmentedCounterparties,
      'marketplaceMechanics.fragmentedCounterparties',
    ),
    companyOperatesMatchingAndExecution: optionalTri(
      marketplaceRaw.companyOperatesMatchingAndExecution,
      'marketplaceMechanics.companyOperatesMatchingAndExecution',
    ),
    agentsRequireComparableCoverageOrLiquidity: optionalTri(
      marketplaceRaw.agentsRequireComparableCoverageOrLiquidity,
      'marketplaceMechanics.agentsRequireComparableCoverageOrLiquidity',
    ),
    scaledAlternativeCanBypassMajorityBy2033: optionalTri(
      marketplaceRaw.scaledAlternativeCanBypassMajorityBy2033,
      'marketplaceMechanics.scaledAlternativeCanBypassMajorityBy2033',
    ),
  };
  const marketplaceChecklistQualified = marketplaceMechanics.applies === true &&
    marketplaceMechanics.fragmentedCounterparties === true &&
    marketplaceMechanics.companyOperatesMatchingAndExecution === true &&
    marketplaceMechanics.agentsRequireComparableCoverageOrLiquidity === true &&
    marketplaceMechanics.scaledAlternativeCanBypassMajorityBy2033 === false;
  const workflowRaw = raw.workflowReplacement === undefined
    ? {}
    : record(raw.workflowReplacement, 'future_value_capture.workflowReplacement');
  const workflowReplacement = {
    applies: optionalTri(workflowRaw.applies, 'workflowReplacement.applies'),
    customerOwnsCoreState: optionalTri(
      workflowRaw.customerOwnsCoreState,
      'workflowReplacement.customerOwnsCoreState',
    ),
    workflowRebuildableByAgents: optionalTri(
      workflowRaw.workflowRebuildableByAgents,
      'workflowReplacement.workflowRebuildableByAgents',
    ),
    vendorControlsRegulatedOrIrreversibleExecution: optionalTri(
      workflowRaw.vendorControlsRegulatedOrIrreversibleExecution,
      'workflowReplacement.vendorControlsRegulatedOrIrreversibleExecution',
    ),
    majorityCustomReplacementEconomicallyPlausibleBy2033: optionalTri(
      workflowRaw.majorityCustomReplacementEconomicallyPlausibleBy2033,
      'workflowReplacement.majorityCustomReplacementEconomicallyPlausibleBy2033',
    ),
    migrationComplexityPrimaryBarrier: optionalTri(
      workflowRaw.migrationComplexityPrimaryBarrier,
      'workflowReplacement.migrationComplexityPrimaryBarrier',
    ),
    vendorExecutionType: optionalChoice(workflowRaw.vendorExecutionType, [
      'none', 'regulated_ledger_or_mandate', 'money_movement', 'security_enforcement',
      'compute_identity_control_plane', 'physical_or_transaction_execution', 'unproven',
    ] as const, 'unproven', 'workflowReplacement.vendorExecutionType'),
    vendorExecutionCoversMajorityCore: optionalTri(
      workflowRaw.vendorExecutionCoversMajorityCore,
      'workflowReplacement.vendorExecutionCoversMajorityCore',
    ),
    workflowCoversMajorityCore: optionalTri(
      workflowRaw.workflowCoversMajorityCore,
      'workflowReplacement.workflowCoversMajorityCore',
    ),
  };
  const audit = {
    marketplaceMechanics,
    workflowReplacement,
    roleArchetype: optionalChoice(raw.roleArchetype, [
      'weak_digital_interface', 'authoritative_system', 'controlled_marketplace_liquidity',
      'transaction_or_asset_operator', 'physical_product_operator', 'regulated_operator',
      'proprietary_stack_operator', 'brand_product_operator', 'other', 'unproven',
    ] as const, 'unproven', 'future_value_capture.roleArchetype'),
    agentsNeedControlledAccess: optionalTri(
      raw.agentsNeedControlledAccess,
      'future_value_capture.agentsNeedControlledAccess',
    ),
    credibleMajorityBypass: optionalTri(
      raw.credibleMajorityBypass,
      'future_value_capture.credibleMajorityBypass',
    ),
    finalNeedPersists: tri(raw.finalNeedPersists, 'future_value_capture.finalNeedPersists'),
    paidCompanyRolePersists: tri(raw.paidCompanyRolePersists, 'future_value_capture.paidCompanyRolePersists'),
    roleCoversMajorityCore: tri(raw.roleCoversMajorityCore, 'future_value_capture.roleCoversMajorityCore'),
    majorityAbsorptionWithinSevenYears: tri(
      raw.majorityAbsorptionWithinSevenYears,
      'future_value_capture.majorityAbsorptionWithinSevenYears',
    ),
    companySpecificControl: tri(raw.companySpecificControl, 'future_value_capture.companySpecificControl'),
    paymentMechanismPersists: tri(raw.paymentMechanismPersists, 'future_value_capture.paymentMechanismPersists'),
    aiPriceCommoditization: tri(raw.aiPriceCommoditization, 'future_value_capture.aiPriceCommoditization'),
    aiPriceCommoditizationCoversMajorityCore: optionalTri(
      raw.aiPriceCommoditizationCoversMajorityCore,
      'future_value_capture.aiPriceCommoditizationCoversMajorityCore',
    ),
  };
  const marketplaceAssertionsConsistent = audit.agentsNeedControlledAccess !== false &&
    audit.credibleMajorityBypass !== true;
  const qualifiedMarketplaceChecklist = marketplaceChecklistQualified && marketplaceAssertionsConsistent;
  const roleLossProven = audit.finalNeedPersists === false || audit.paidCompanyRolePersists === false ||
    audit.majorityAbsorptionWithinSevenYears === true;
  const roleFoundation = audit.finalNeedPersists === true && audit.paidCompanyRolePersists === true &&
    audit.roleCoversMajorityCore === true && audit.majorityAbsorptionWithinSevenYears !== true;
  const bypassNotProven = audit.credibleMajorityBypass !== true;
  const majorityCorePriceCommoditization = audit.aiPriceCommoditizationCoversMajorityCore === true ||
    (audit.aiPriceCommoditizationCoversMajorityCore === null && audit.aiPriceCommoditization === true);
  const derivedFromFutureControl = futureControlScore >= 2 && bypassNotProven &&
    audit.paymentMechanismPersists === true && !majorityCorePriceCommoditization;
  const marketplaceQualified = qualifiedMarketplaceChecklist || marketplaceDurabilityOverride;
  const marketplaceRole = audit.roleArchetype === 'controlled_marketplace_liquidity';
  const durableMarketplaceCapture = futureControlScore >= 2 &&
    (audit.roleArchetype === 'controlled_marketplace_liquidity' || marketplaceQualified) &&
    (audit.agentsNeedControlledAccess === true ||
      (audit.agentsNeedControlledAccess === null && marketplaceQualified)) &&
    (audit.credibleMajorityBypass === false ||
      (audit.credibleMajorityBypass === null && marketplaceQualified)) &&
    audit.paymentMechanismPersists === true;
  const genericDurableCapture =
    (audit.companySpecificControl === true && audit.paymentMechanismPersists === true &&
      !majorityCorePriceCommoditization && bypassNotProven) ||
      derivedFromFutureControl;
  const durableCapture = roleFoundation &&
    (marketplaceRole ? durableMarketplaceCapture : genericDurableCapture);
  const score = durableCapture ? 2 : roleFoundation ? 1 : 0;
  return {
    ...common(raw, 'future_value_capture'),
    score,
    audit: {
      ...audit,
      marketplaceChecklistQualified: qualifiedMarketplaceChecklist,
      marketplaceChecklistRawQualified: marketplaceChecklistQualified,
      marketplaceAssertionsConsistent,
      marketplaceDurabilityOverride,
      roleLossProven,
      majorityCorePriceCommoditization,
      derivedFromFutureControl,
      durableMarketplaceCapture,
    },
  };
}

function scoreTransition(raw: Record<string, unknown>): FutureCriterionResult {
  const futureAdaptationContract = optionalTri(
    raw.futureAdaptationContract,
    'transition_capacity.futureAdaptationContract',
  );
  if (futureAdaptationContract === true) {
    const audit = {
      futureAdaptationContract,
      adaptationLeversSurviveScenario: tri(
        raw.adaptationLeversSurviveScenario,
        'transition_capacity.adaptationLeversSurviveScenario',
      ),
      coreReconfigurableWithinScenario: tri(
        raw.coreReconfigurableWithinScenario,
        'transition_capacity.coreReconfigurableWithinScenario',
      ),
      adaptationLeadTimeFits: tri(
        raw.adaptationLeadTimeFits,
        'transition_capacity.adaptationLeadTimeFits',
      ),
      legacyConstraintManageable: tri(
        raw.legacyConstraintManageable,
        'transition_capacity.legacyConstraintManageable',
      ),
      currentFinancialsScoreDirectly: false,
      currentDeploymentScoresDirectly: false,
    };
    const signals = [
      audit.adaptationLeversSurviveScenario,
      audit.coreReconfigurableWithinScenario,
      audit.adaptationLeadTimeFits,
      audit.legacyConstraintManageable,
    ];
    const positives = signals.filter(value => value === true).length;
    const negatives = signals.filter(value => value === false).length;
    const score = positives === signals.length
      ? 2
      : negatives >= 2 ||
          (audit.coreReconfigurableWithinScenario === false && audit.adaptationLeadTimeFits === false)
        ? 0
        : 1;
    return { ...common(raw, 'transition_capacity'), score, audit };
  }
  const declaredScaledAdaptation = tri(raw.scaledAdaptationEvidence, 'transition_capacity.scaledAdaptationEvidence');
  const scaledAdaptationType = optionalChoice(raw.scaledAdaptationType, [
    'none', 'announcement_or_pilot', 'material_core_deployment', 'unproven',
  ] as const, 'unproven', 'transition_capacity.scaledAdaptationType');
  const measuredOperatingEffect = optionalTri(
    raw.measuredOperatingEffect,
    'transition_capacity.measuredOperatingEffect',
  );
  const monetizedMaterialOutcome = optionalTri(
    raw.monetizedMaterialOutcome,
    'transition_capacity.monetizedMaterialOutcome',
  );
  const outcomeCausallyAttributedToAdaptation = optionalTri(
    raw.outcomeCausallyAttributedToAdaptation,
    'transition_capacity.outcomeCausallyAttributedToAdaptation',
  );
  const attributionFieldMissing = raw.outcomeCausallyAttributedToAdaptation === undefined;
  const attributionQualified = outcomeCausallyAttributedToAdaptation === true ||
    (attributionFieldMissing && scaledAdaptationType === 'material_core_deployment' &&
      (measuredOperatingEffect === true || monetizedMaterialOutcome === true));
  const scaledAdaptationEvidence = declaredScaledAdaptation === true &&
    scaledAdaptationType === 'material_core_deployment' &&
    attributionQualified &&
    (measuredOperatingEffect === true || monetizedMaterialOutcome === true);
  const audit = {
    fundingCapacity: tri(raw.fundingCapacity, 'transition_capacity.fundingCapacity'),
    declaredScaledAdaptation,
    scaledAdaptationEvidence,
    scaledAdaptationType,
    measuredOperatingEffect,
    monetizedMaterialOutcome,
    outcomeCausallyAttributedToAdaptation,
    attributionFieldMissing,
    attributionQualified,
    legacyConstraintManageable: tri(raw.legacyConstraintManageable, 'transition_capacity.legacyConstraintManageable'),
    fundingCapacityScoresDirectly: false,
  };
  const structuralAdaptation = audit.scaledAdaptationEvidence === true;
  const structuralFlexibility = audit.legacyConstraintManageable === true;
  const structurallyBlocked = audit.legacyConstraintManageable === false &&
    audit.fundingCapacity === false;
  const score = structuralAdaptation && structuralFlexibility
    ? 2
    : !structurallyBlocked && (structuralAdaptation || structuralFlexibility)
      ? 1
      : 0;
  return { ...common(raw, 'transition_capacity'), score, audit };
}

function grade(score: number): FutureGrade {
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  if (score >= 36) return 'D';
  return 'E';
}

export function scoreFutureResilience(rawValue: unknown): FutureResilienceAnalysis {
  const raw = record(rawValue, 'future_adjudication');
  if (raw.scenarioYear !== FUTURE_SCENARIO_YEAR) throw new Error('scenarioYear doit valoir 2033');
  const criteria = record(raw.criteria, 'criteria');
  const futureControl = scoreFutureControl(record(criteria.future_control, 'future_control'));
  const disruptionRaw = record(criteria.disruption_positioning, 'disruption_positioning');
  const disruptionForces = Array.isArray(disruptionRaw.forces) ? disruptionRaw.forces : [];
  const chinaResponseControlsOutcome = disruptionForces.some(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const force = value as Record<string, unknown>;
    return force.force === 'china_engineering' && force.responseControlsOutcome === true;
  });
  let futureValueCapture = scoreValueCapture(
    record(criteria.future_value_capture, 'future_value_capture'),
    futureControl.score,
  );
  const workflowReplacement = futureValueCapture.audit.workflowReplacement as
    | Record<string, unknown>
    | undefined;
  const qualifiedVendorExecution =
    workflowReplacement?.vendorControlsRegulatedOrIrreversibleExecution === true &&
    workflowReplacement.vendorExecutionType !== 'none' &&
    workflowReplacement.vendorExecutionType !== 'unproven' &&
    workflowReplacement.vendorExecutionCoversMajorityCore === true;
  const legacyVendorExecution =
    workflowReplacement?.vendorExecutionType === 'unproven' &&
    workflowReplacement.vendorExecutionCoversMajorityCore === null &&
    workflowReplacement.vendorControlsRegulatedOrIrreversibleExecution === true;
  const proprietarySecurityEnforcementCandidate =
    workflowReplacement?.vendorExecutionType === 'security_enforcement' &&
    futureValueCapture.audit.roleArchetype === 'proprietary_stack_operator' &&
    futureValueCapture.audit.companySpecificControl === true &&
    futureValueCapture.audit.credibleMajorityBypass === false;
  const regulatedExecutionServiceCandidate =
    futureControl.audit.controlType === 'regulated_execution_capability' &&
    futureValueCapture.audit.roleArchetype === 'regulated_operator' &&
    futureValueCapture.audit.roleCoversMajorityCore === true;
  const pureWorkflowCompany =
    futureValueCapture.audit.roleCoversMajorityCore === true &&
    ['weak_digital_interface', 'authoritative_system'].includes(
      String(futureValueCapture.audit.roleArchetype),
    );
  const workflowCoversMajorityCore =
    workflowReplacement?.workflowCoversMajorityCore === true ||
    (workflowReplacement?.workflowCoversMajorityCore === null && pureWorkflowCompany);
  const customerOwnedWorkflowMechanicsQualified =
    workflowReplacement?.applies === true &&
    workflowReplacement.customerOwnsCoreState === true &&
    workflowReplacement.workflowRebuildableByAgents === true &&
    workflowCoversMajorityCore &&
    !qualifiedVendorExecution && !legacyVendorExecution && !proprietarySecurityEnforcementCandidate &&
    !regulatedExecutionServiceCandidate;
  if (proprietarySecurityEnforcementCandidate) {
    futureControl.audit.proprietarySecurityEnforcementCandidate = true;
    futureValueCapture.audit.proprietarySecurityEnforcementCandidate = true;
  }
  if (regulatedExecutionServiceCandidate) {
    futureControl.audit.regulatedExecutionServiceCandidate = true;
    futureValueCapture.audit.regulatedExecutionServiceCandidate = true;
  }
  futureValueCapture.audit.workflowCoversMajorityCore = workflowCoversMajorityCore;
  const majorityReplacementDerivedFromWorkflowMechanics =
    customerOwnedWorkflowMechanicsQualified &&
    workflowReplacement?.majorityCustomReplacementEconomicallyPlausibleBy2033 === null &&
    workflowReplacement.migrationComplexityPrimaryBarrier === true;
  const customerOwnedWorkflowReplacementQualified =
    customerOwnedWorkflowMechanicsQualified &&
    (workflowReplacement?.majorityCustomReplacementEconomicallyPlausibleBy2033 === true ||
      majorityReplacementDerivedFromWorkflowMechanics);
  if (customerOwnedWorkflowReplacementQualified) {
    futureControl.score = Math.min(futureControl.score, 1);
    futureValueCapture.score = Math.min(futureValueCapture.score, 1);
    futureControl.audit.customerOwnedWorkflowCapApplied = true;
    futureValueCapture.audit.customerOwnedWorkflowCapApplied = true;
    if (majorityReplacementDerivedFromWorkflowMechanics) {
      futureControl.audit.majorityReplacementDerivedFromWorkflowMechanics = true;
      futureValueCapture.audit.majorityReplacementDerivedFromWorkflowMechanics = true;
    }
  }
  const durableDigitalControlPlane =
    futureControl.audit.controlType === 'proprietary_stack_or_ip' &&
    futureControl.audit.systemBottleneck === true &&
    futureValueCapture.audit.roleArchetype === 'proprietary_stack_operator' &&
    futureValueCapture.audit.roleCoversMajorityCore === true &&
    futureValueCapture.audit.companySpecificControl === true &&
    futureValueCapture.audit.paymentMechanismPersists === true &&
    futureValueCapture.audit.credibleMajorityBypass === false &&
    futureValueCapture.audit.majorityAbsorptionWithinSevenYears !== true;
  const digitalStackBenefitNotControlled =
    futureControl.audit.controlType === 'proprietary_stack_or_ip' &&
    futureValueCapture.audit.roleArchetype === 'proprietary_stack_operator' &&
    futureValueCapture.audit.agentsNeedControlledAccess === false &&
    futureValueCapture.audit.aiPriceCommoditization === true &&
    (futureValueCapture.audit.aiPriceCommoditizationCoversMajorityCore === true ||
      futureValueCapture.audit.credibleMajorityBypass === true ||
      proprietarySecurityEnforcementCandidate) &&
    !durableDigitalControlPlane &&
    !chinaResponseControlsOutcome;
  if (digitalStackBenefitNotControlled) {
    futureControl.score = Math.min(futureControl.score, 1);
    futureControl.audit.digitalCommoditizationConsistencyApplied = true;
  }
  if (durableDigitalControlPlane) {
    futureControl.audit.durableDigitalControlPlane = true;
  }
  const temporaryRegulatedRightsWithoutScenarioVisibility =
    futureControl.audit.controlType === 'proprietary_stack_or_ip' &&
    futureValueCapture.audit.roleArchetype === 'regulated_operator' &&
    futureControl.audit.rightsVisibilityThroughScenario !== true;
  if (temporaryRegulatedRightsWithoutScenarioVisibility) {
    futureControl.score = Math.min(futureControl.score, 1);
    futureValueCapture.score = Math.min(futureValueCapture.score, 1);
    futureControl.audit.temporaryRightsVisibilityCapApplied = true;
    futureValueCapture.audit.temporaryRightsVisibilityCapApplied = true;
  }
  const checklistQualified =
    futureValueCapture.audit.marketplaceChecklistQualified === true;
  const marketplaceMechanics = futureValueCapture.audit.marketplaceMechanics as
    | Record<string, unknown>
    | undefined;
  const marketplaceControlledAccessRefuted =
    futureControl.audit.controlType === 'network_liquidity' &&
    marketplaceMechanics?.applies === true &&
    futureValueCapture.audit.agentsNeedControlledAccess === false;
  if (marketplaceControlledAccessRefuted) {
    futureControl.score = Math.min(futureControl.score, 1);
    futureControl.audit.marketplaceControlledAccessRefuted = true;
  }
  const marketplaceDurabilityOverride = futureControl.audit.controlType === 'network_liquidity' &&
    marketplaceMechanics?.applies === true &&
    marketplaceMechanics.fragmentedCounterparties === true &&
    marketplaceMechanics.companyOperatesMatchingAndExecution === true &&
    marketplaceMechanics.agentsRequireComparableCoverageOrLiquidity === true &&
    futureValueCapture.audit.agentsNeedControlledAccess !== false &&
    futureValueCapture.audit.credibleMajorityBypass !== true &&
    futureControl.audit.scarcitySurvivesAiChina === true &&
    futureControl.audit.replicableWithinFiveYears === false;
  const marketplaceQualified = checklistQualified || marketplaceDurabilityOverride;
  if (marketplaceQualified && futureControl.audit.controlType === 'network_liquidity') {
    futureControl.score = Math.max(futureControl.score, 2);
    futureControl.audit.marketplaceControlDerived = true;
    futureValueCapture = scoreValueCapture(
      record(criteria.future_value_capture, 'future_value_capture'),
      futureControl.score,
      marketplaceDurabilityOverride,
    );
  }
  if (futureControl.score < 2 && futureValueCapture.score === 2 &&
      !proprietarySecurityEnforcementCandidate) {
    futureValueCapture.score = 1;
    futureValueCapture.audit.captureLimitedByNarrowControl = true;
  }
  const uncontrolledAgenticPressure =
    futureValueCapture.audit.aiPriceCommoditization === true &&
    futureValueCapture.audit.companySpecificControl !== true &&
    futureValueCapture.audit.agentsNeedControlledAccess !== true &&
    futureControl.score <= 1;
  const disruption = scoreDisruption(
    disruptionRaw,
    marketplaceQualified,
    digitalStackBenefitNotControlled,
    customerOwnedWorkflowReplacementQualified,
    uncontrolledAgenticPressure,
  );
  const structuralDemand = scoreDemand(record(criteria.structural_demand, 'structural_demand'));
  const auditedDisruptionForces = Array.isArray(disruption.audit.forces) ? disruption.audit.forces : [];
  const hasCompanySpecificCostAdvantage = auditedDisruptionForces.some(value =>
    value && typeof value === 'object' && !Array.isArray(value) &&
    (value as Record<string, unknown>).verdict === 'positive' &&
    (value as Record<string, unknown>).benefitMechanism ===
      'company_specific_cost_or_capacity_advantage');
  const hasNegativeDisruptionForce = auditedDisruptionForces.some(value =>
    value && typeof value === 'object' && !Array.isArray(value) &&
    (value as Record<string, unknown>).verdict === 'negative');
  const companySpecificStructuralAdvantage = disruption.score === 2 && structuralDemand.score === 2 &&
    !digitalStackBenefitNotControlled &&
    auditedDisruptionForces.some(value => value && typeof value === 'object' && !Array.isArray(value) &&
      (value as Record<string, unknown>).verdict === 'positive' &&
      ['company_specific_control_strengthening', 'company_specific_cost_or_capacity_advantage',
        'company_specific_value_capture_expansion'].includes(
        String((value as Record<string, unknown>).benefitMechanism),
      )) &&
    !hasNegativeDisruptionForce;
  if (companySpecificStructuralAdvantage) {
    disruption.score = 3;
    disruption.audit.companySpecificStructuralAdvantage = true;
  }
  const physicalCostLeadershipCapture =
    futureControl.audit.controlType === 'cost_supply_chain' &&
    futureControl.audit.controlStillNeeded === true &&
    futureControl.audit.companySpecific === true &&
    futureControl.audit.majorityCoreCoverage === true &&
    structuralDemand.score === 2 &&
    hasCompanySpecificCostAdvantage &&
    !hasNegativeDisruptionForce &&
    futureValueCapture.audit.roleArchetype === 'physical_product_operator' &&
    futureValueCapture.audit.finalNeedPersists === true &&
    futureValueCapture.audit.paidCompanyRolePersists === true &&
    futureValueCapture.audit.roleCoversMajorityCore === true &&
    futureValueCapture.audit.majorityAbsorptionWithinSevenYears !== true &&
    futureValueCapture.audit.companySpecificControl === true &&
    futureValueCapture.audit.paymentMechanismPersists === true &&
    futureValueCapture.audit.aiPriceCommoditizationCoversMajorityCore !== true;
  if (physicalCostLeadershipCapture) {
    futureControl.score = Math.max(futureControl.score, 1);
    futureValueCapture.score = Math.max(futureValueCapture.score, 2);
    futureControl.reason += ' Ce système productif constitue toutefois un contrôle industriel étroit ' +
      'par ses coûts et sa capacité, sans prouver une rente rare.';
    futureValueCapture.reason += ' La capture future peut donc venir des volumes, des parts de marché ' +
      "et de la marge sur coût plutôt que d'une prime de prix.";
    futureControl.audit.physicalCostLeadershipFloor = true;
    futureValueCapture.audit.physicalCostLeadershipCapture = true;
  }
  const results: FutureCriterionResult[] = [
    futureControl,
    disruption,
    scoreDependencies(record(criteria.future_dependencies, 'future_dependencies')),
    structuralDemand,
    futureValueCapture,
    scoreTransition(record(criteria.transition_capacity, 'transition_capacity')),
  ];
  const rawScore = Math.round(results.reduce((sum, criterion) =>
    sum + FUTURE_RESILIENCE_WEIGHTS[criterion.id] * criterion.score / criterion.maxScore, 0));
  const byId = new Map(results.map(criterion => [criterion.id, criterion]));
  const gates: string[] = [];
  let finalScore = rawScore;
  if (byId.get('future_value_capture')!.audit.roleLossProven === true && finalScore > 29) {
    finalScore = 29;
    gates.push('no_future_paid_role');
  }
  const futureValueAudit = byId.get('future_value_capture')!.audit;
  const disruptionAudit = byId.get('disruption_positioning')!.audit;
  const auditedForces = Array.isArray(disruptionAudit.forces) ? disruptionAudit.forces : [];
  const hasMaterialDirectFutureBenefit = auditedForces.some(value =>
    value && typeof value === 'object' && !Array.isArray(value) &&
    (value as Record<string, unknown>).materialDirectBenefit === true);
  const weakDigitalInterface = byId.get('future_control')!.score === 0 &&
    futureValueAudit.roleArchetype === 'weak_digital_interface' &&
    futureValueAudit.companySpecificControl === false &&
    futureValueAudit.aiPriceCommoditization === true;
  if (weakDigitalInterface && finalScore > 29) {
    finalScore = 29;
    gates.push('commoditized_weak_digital_interface');
  }
  const commoditizedInterchangeablePaidRole = byId.get('future_control')!.score === 0 &&
    byId.get('future_value_capture')!.score <= 1 &&
    futureValueAudit.aiPriceCommoditization === true &&
    futureValueAudit.agentsNeedControlledAccess !== true &&
    futureValueAudit.credibleMajorityBypass === true &&
    !hasMaterialDirectFutureBenefit &&
    ['transaction_or_asset_operator', 'regulated_operator', 'proprietary_stack_operator',
      'other', 'unproven'].includes(String(futureValueAudit.roleArchetype));
  if (commoditizedInterchangeablePaidRole && finalScore > 49) {
    finalScore = 49;
    gates.push('commoditized_interchangeable_paid_role');
  }
  if (customerOwnedWorkflowReplacementQualified && finalScore > 49) {
    finalScore = 49;
    gates.push('customer_owned_workflow_replacement');
  }
  const dependencyAudit = byId.get('future_dependencies')!.audit;
  const concentratedContinuityDependencies =
    Number(dependencyAudit.unmitigatedMaterialShocks) >= 2 ||
    (Number(dependencyAudit.existentialNonStrongShocks) >= 2 &&
      ['proprietary_stack_or_ip', 'cost_supply_chain'].includes(
        String(byId.get('future_control')!.audit.controlType),
      ));
  if (concentratedContinuityDependencies && finalScore > 79) {
    finalScore = 79;
    gates.push('concentrated_continuity_dependencies');
  }
  if (byId.get('future_control')!.score === 0 && finalScore > 69) {
    finalScore = 69;
    gates.push('interchangeable_future_role');
  }
  const aEligible = byId.get('future_control')!.score === 3 &&
    byId.get('disruption_positioning')!.score >= 2 &&
    byId.get('future_dependencies')!.score >= 1 &&
    byId.get('structural_demand')!.score >= 1 &&
    byId.get('future_value_capture')!.score === 2 &&
    byId.get('transition_capacity')!.score >= 1;
  if (!aEligible && finalScore > 79) {
    finalScore = 79;
    gates.push('future_a_eligibility');
  }
  return {
    version: FUTURE_RESILIENCE_VERSION,
    scenarioYear: FUTURE_SCENARIO_YEAR,
    rawScore,
    finalScore,
    grade: grade(finalScore),
    gates,
    criteria: results,
  };
}

export function buildFutureResiliencePilotPrompt(args: {
  ticker: string;
  company: string;
  industry: string;
  dossier: string;
}): string {
  return `Tu adjudique la resilience economique FUTURE de ${args.company} (${args.ticker}), secteur ${args.industry}, dans un scenario central commun en 2033.

SCENARIO 2033 FIGE
- IA generative, agents de recherche/achat/travail et automatisation largement adoptes.
- Robotique nettement plus avancee, sans supposer une automatisation techniquement magique.
- La Chine atteint ou conserve un avantage majeur d'ingenierie, de supply chain et de rapport qualite-prix dans les secteurs exposés.
- Les interfaces, logiciels et intermediaires facilement reproductibles subissent une forte compression de prix.
- Les actifs physiques rares, droits regules, marques de confiance/statut, liquidites transactionnelles, stacks proprietaires et supply chains difficiles a reproduire peuvent conserver une rente si leur controle reste specifique a l'entreprise.

QUESTION UNIQUE
Quelle place economique et quel pouvoir de capture cette entreprise conservera-t-elle en 2033 ? Le passe et le present servent uniquement a identifier les mecanismes economiques de depart. Aucun chiffre actuel de croissance, marge, taille, revenu, FCF ou part de marche ne donne directement un point.

DOSSIER SOURCE FIGE
${args.dossier}

DISCIPLINE DE PROJECTION
- Aucune recherche web. Aucun chiffre ou fait absent du dossier.
- Cherche d'abord le scenario adverse: absorption par agent/plateforme, commoditisation, substitution chinoise, automatisation, perte de controle ou dependance de continuite.
- Les champs true/false decrivent ton scenario CENTRAL le plus probable en 2033, pas une certitude historique. Formule une projection causale a partir du scenario fige et du modele economique.
- Aucun champ ne demande que l'etat de 2033 soit deja demontre aujourd'hui. Les proportions actuelles n'imposent jamais seules majorityCoreCoverage=false : projette le mix economique le plus probable en 2033. Une statistique presente peut identifier un point de depart, jamais fixer le score.
- Pour chaque force du scenario, examine les effets economiques de premier ET de second ordre. Construis explicitement la chaine force macro -> variation du nombre de besoins, produits, transactions ou volumes a servir -> evolution de la categorie -> exposition du coeur de l'entreprise. L'IA peut par exemple creer de nouveaux volumes en amont tout en automatisant une partie de leur traitement en aval; ne limite jamais l'analyse a l'effet direct sur les processus actuels.
- Le passe et le present contraignent la projection mais ne donnent aucun point automatique: croissance, marge, taille ou moat actuel ne suffisent jamais seuls.
- Inversement, n'exige pas une preuve litterale venue de 2033. Si le mecanisme economique devrait raisonnablement persister et qu'aucune voie adverse majoritaire credible ne domine le scenario central, tranche true et baisse confidence si necessaire.
- Utilise null seulement si le dossier ne permet meme pas d'identifier le mecanisme ou l'exposition. L'incertitude normale d'une prevision doit etre exprimee par confidence, pas par une accumulation de null.
- technicalAndEconomicPath=true des qu'une force dispose d'une voie technique ET economique plausible vers le coeur d'ici 2033. materialPressure=true seulement si cette voie devrait comprimer de facon non marginale les volumes, prix, rentes ou le role dans le scenario central; une concurrence generique, un risque ordinaire ou une possibilite sans impact economique net attendu vaut false. majorityCoreThreatPath indique separement si cette pression devrait depasser 50% du coeur.
- majorityCoreThreatPath vaut true uniquement si la force devrait faire perdre ou absorber plus de 50% du role economique de l'entreprise en 2033. Une simple compression de prix, une concurrence accrue ou un avantage devenu standard ne suffit pas et reste traitee dans future_control/future_value_capture.
- Une force avec technicalAndEconomicPath=true, materialPressure=true, majorityCoreThreatPath=false et responseControlsOutcome different de true constitue une pression materielle non controlee. Une voie plausible mais non materielle n'est pas une pression de scoring.
- materialDirectBenefit=true exige un effet strategique materiel controle par l'entreprise: expansion externe de la demande, renforcement d'un controle specifique, avantage durable de cout/capacite ou expansion de la capture. Une efficacite operationnelle generique egalement accessible aux concurrents vaut false.
- benefitMechanism nomme cet effet. Deux forces fondees sur le meme mecanisme ne comptent qu'une fois; n'invente pas deux renforcements IA/robotique pour le meme gain de planification, d'automatisation ou de productivite.
- Tous les champs "majorityCore" portent sur plus de 50% du chiffre d'affaires ou de l'activite economique propre de l'entreprise, jamais sur sa part du marche mondial. Un role peut couvrir 100% du coeur d'une entreprise qui ne detient que 10% de son marche. Ne confonds pas non plus couverture, specificite et defensibilite: ils sont testes separement.
- Pour future_control, adjudique le controle qui devrait couvrir le mix economique de 2033. Une base installee, un reseau physique, une marque ou une capacite qualifiee peuvent former un controle meme si des concurrents comparables existent; leur existence joue sur rarete et replication, pas sur companySpecific. controlType=none exige l'absence projetee de tout controle economiquement paye, pas l'absence d'un monopole. futureRentPaid=true si le scenario central implique encore une preference, une friction, un acces ou une execution payee; n'exige pas une prime de prix publiee aujourd'hui.
- companySpecific=true signifie que l'entreprise possede ou controle elle-meme l'actif, le droit, le reseau, la marque ou la stack. Cela n'exige pas qu'aucun concurrent ne possede un mecanisme comparable; la rarete et la replicabilite repondent a cette seconde question.
- Ne confonds jamais croissance, marge, notoriete ou taille actuelle avec controle futur.
- Une marque peut rester un controle futur si confiance, statut, authenticite ou preference payante devraient survivre aux agents et a la convergence qualite-prix; anciennete et notoriete seules restent insuffisantes.
- Une marketplace conserve un controle seulement si inventaire/liquidite/matching/transaction restent necessaires aux agents et difficiles a contourner sur la majorite du coeur.
- roleArchetype=controlled_marketplace_liquidity exige une offre fragmentee agregee, une liquidite ou execution exploitee par l'entreprise et un acces encore necessaire aux agents pour la majorite du coeur. Une simple audience, des listings ou une interface de comparaison ne suffisent pas.
- Le multihoming des fournisseurs, les reservations directes et la possibilite technique pour un agent d'appeler plusieurs canaux ne prouvent jamais seuls un contournement majoritaire. Il faut une alternative capable d'agreger une couverture/liquidite comparable et d'executer economiquement plus de 50% du coeur a l'echelle.
- agentsNeedControlledAccess=true seulement si les agents doivent acceder a un inventaire, droit, actif, transaction ou systeme controle par l'entreprise pour accomplir la majorite du besoin. Un lien, une API generique ou un canal utile mais substituable vaut false.
- Pour une stack proprietaire, l'acces controle inclut le plan de controle du calcul, des donnees, de l'identite, des permissions ou de l'execution. Une interface tierce n'annule pas cet acces si les workloads majoritaires doivent encore passer par ce plan de controle specifique.
- Les donnees, configurations, permissions et workflows appartenant au client ne constituent pas seuls un controle specifique du fournisseur. Pour les logiciels de workflow et systemes d'autorite, remplis workflowReplacement afin de distinguer une friction de migration d'une execution reglementee ou irreversible reellement controlee par le fournisseur.
- Une entreprise de services ne devient pas un logiciel de workflow parce qu'elle utilise une plateforme proprietaire. Si la majorite du role paye reste l'execution humaine, clinique, physique ou reglementaire d'un mandat complexe, workflowReplacement.applies=false. Les agents peuvent rendre le processus plus efficace sans permettre au client de vibe-coder l'accreditation, le reseau operationnel, la responsabilite reglementaire ou le savoir-faire d'execution.
- controlType=regulated_execution_capability designe une capacite d'execution reglementee et specialisee couvrant le coeur, avec savoir-faire, reseau operationnel ou historique de conformite difficile a reproduire. La reglementation sectorielle seule ne suffit pas: il faut une rente ou des switching costs payes et une replication majoritaire non plausible dans les cinq ans.
- Pour une capacite d'execution reglementee, une revalidation ou un transfert reglementaire documente pendant un mandat actif peut etablir un controle etroit meme si des concurrents savent gagner de nouveaux mandats. Les concurrents rendent replicableWithinFiveYears=true et interdisent le controle large; ils ne justifient pas controlType=none si la barriere de transition propre au mandat est prouvee. L'absence de taux de retention ou de prime de prix publiee donne futureRentPaid=null, jamais false; false exige une contre-preuve economique affirmative.
- Dans workflowReplacement, vendorControlsRegulatedOrIrreversibleExecution=true n'est publiable que si vendorExecutionType nomme un type admissible et si vendorExecutionCoversMajorityCore=true. Une CMDB, un workflow configurable, un journal d'audit, des permissions client ou une integration ne sont pas en eux-memes une execution reglementee ou irreversible.
- workflowCoversMajorityCore=true uniquement si le workflow reconstruisible represente lui-meme plus de 50% du chiffre d'affaires ou de l'activite propre de l'entreprise. Un produit logiciel minoritaire dans un groupe diversifie vaut false et ne peut plafonner les activites physiques, transactionnelles, reglementees ou d'infrastructure independantes.
- majorityCustomReplacementEconomicallyPlausibleBy2033=true exige qu'une grande entreprise puisse reconstruire et exploiter economiquement plus de 50% du role avec ses donnees, ses agents et son infrastructure d'ici 2033; une simple maquette ou une interface personnalisee ne suffit pas. Lorsque le client possede l'etat, que les agents peuvent reconstruire le workflow, qu'aucune execution fournisseur qualifiee ne couvre le coeur et que la migration est la barriere principale, la migration seule ne peut justifier false dans le scenario 2033.
- credibleMajorityBypass=true lorsqu'une voie technique ET economique permet aux agents, fournisseurs, flottes ou plateformes de contourner l'entreprise sur plus de 50% du coeur d'ici 2033.
- roleCoversMajorityCore mesure la part de l'activite propre de l'entreprise couverte par le role paye decrit. Il ne mesure ni son moat, ni sa part de marche, ni le caractere unique du role. Une entreprise peut donc avoir roleCoversMajorityCore=true et companySpecificControl=false.
- aiPriceCommoditization signale toute pression de prix causee par l'IA. aiPriceCommoditizationCoversMajorityCore=true uniquement si cette pression detruit le pouvoir de capture sur plus de 50% du coeur; la commoditisation d'une interface minoritaire ou d'une couche analytique vaut false pour ce second champ.
- Dans future_dependencies, mets residualOnlyAssessment=true et futureSeverityContract=true uniquement apres avoir examine les grandes categories pays, fournisseurs, clients, travail, infrastructure, reglementation et financement, puis ne liste que les chocs residuels qui pourraient encore interrompre ou deteriorer materiellement le role 2033 apres diversification et mitigation. Un fournisseur ordinaire, un cycle de demande, la conformite generale, le financement courant ou une exposition geographique diffuse ne sont pas des clusters materiels. coreContinuityAtRisk=true uniquement si ce choc, pris seul dans le scenario central adverse plausible, pourrait interrompre ou rendre non viable une part majeure du coeur; une baisse d'utilisation, de marge ou de volume vaut false. mitigation=strong exige une redondance qui preserve le coeur, medium une continuite partielle et none aucune solution deployable. Plusieurs risques ordinaires ne deviennent pas mecaniquement un risque existentiel par addition.
- Dans structural_demand, futureCategoryTrend et causalDirectness sont independants. Un besoin stable directement servi par le coeur vaut causalDirectness=direct, meme s'il ne resout aucun probleme qui s'aggrave. rising exige une expansion NETTE et structurelle jusqu'en 2033 causee par le scenario futur ou une autre force macro explicitement projetee, apres avoir soustrait automatisation, substitution, baisse de prix et destruction de volumes. Une prevision sectorielle generique, la croissance actuelle, un rebond, la seule adoption d'un produit ou la simple persistance du besoin valent stable ou unproven, jamais rising. Un tailwind de categorie ne prouve jamais le controle specifique, la capture ou le pricing power de l'entreprise et ne doit pas etre recompte comme renforcement dans disruption_positioning sans mecanisme de capture controle.
- Pour un portefeuille de brevets ou droits reglementaires temporaires, rightsVisibilityThroughScenario=true exige une protection documentee ou raisonnablement projetable sur la majorite du portefeuille economique jusqu'en 2033. Une promesse generale de renouvellement du pipeline ne suffit pas.
- roleArchetype=weak_digital_interface lorsque le role principal est une interface, un workflow ou une API reproductible sans actif, droit, liquidite ou systeme d'autorite specifique. Ne classe jamais un fabricant physique, un operateur d'actifs ou un rail transactionnel dans cette categorie.
- Les finances et deploiements actuels ne donnent aucun point dans transition_capacity. Evalue uniquement si, dans le scenario 2033, les leviers d'adaptation resteraient accessibles, si le coeur pourrait etre reconfigure avant que la rupture ne l'absorbe, si le delai d'adaptation serait compatible avec la vitesse de la rupture et si les contraintes heritees resteraient gerables. Une entreprise riche mais structurellement piegee peut valoir 0; une organisation sans preuve actuelle d'IA peut valoir 2 si son role et ses actifs sont reellement reconfigurables.
- Les attentes du benchmark ne sont pas fournies. N'essaie pas d'anticiper une note.

Retourne uniquement un objet JSON strict, sans markdown, exactement sous cette forme. Chaque reason, adverseCase et decisiveTrigger est une phrase causale concise en francais. confidence mesure la solidite du scenario central, sans modifier directement le score.
{
  "scenarioYear": 2033,
  "criteria": {
    "future_control": {
      "futureProjectionContract": true,
      "controlType": "scarce_asset|regulated_right|trusted_brand|network_liquidity|proprietary_stack_or_ip|cost_supply_chain|installed_base|regulated_execution_capability|none",
      "controlStillNeeded": true|false|null,
      "companySpecific": true|false|null,
      "majorityCoreCoverage": true|false|null,
      "scarcitySurvivesAiChina": true|false|null,
      "replicableWithinFiveYears": true|false|null,
      "futureRentPaid": true|false|null,
      "systemBottleneck": true|false|null,
      "multipleIndependentControls": true|false|null,
      "rightsVisibilityThroughScenario": true|false|null,
      "reason": "...", "adverseCase": "...", "decisiveTrigger": "...", "confidence": "high|medium|low"
    },
    "disruption_positioning": {
      "forces": [
        {"force":"ai_agents","majorityCoreThreatPath":true|false|null,"technicalAndEconomicPath":true|false|null,"materialPressure":true|false|null,"materialDirectBenefit":true|false|null,"responseControlsOutcome":true|false|null,"benefitMechanism":"none|external_demand_expansion|company_specific_control_strengthening|company_specific_cost_or_capacity_advantage|company_specific_value_capture_expansion|unproven"},
        {"force":"automation_robotics","majorityCoreThreatPath":true|false|null,"technicalAndEconomicPath":true|false|null,"materialPressure":true|false|null,"materialDirectBenefit":true|false|null,"responseControlsOutcome":true|false|null,"benefitMechanism":"none|external_demand_expansion|company_specific_control_strengthening|company_specific_cost_or_capacity_advantage|company_specific_value_capture_expansion|unproven"},
        {"force":"china_engineering","majorityCoreThreatPath":true|false|null,"technicalAndEconomicPath":true|false|null,"materialPressure":true|false|null,"materialDirectBenefit":true|false|null,"responseControlsOutcome":true|false|null,"benefitMechanism":"none|external_demand_expansion|company_specific_control_strengthening|company_specific_cost_or_capacity_advantage|company_specific_value_capture_expansion|unproven"}
      ],
      "reason": "...", "adverseCase": "...", "decisiveTrigger": "...", "confidence": "high|medium|low"
    },
    "future_dependencies": {
      "residualOnlyAssessment": true,
      "futureSeverityContract": true,
      "coverageComplete": true|false|null,
      "clusters": [{"name":"...","material":true|false|null,"continuityImpact":"existential|material_impairment|non_core|unproven","mitigation":"strong|medium|none|unproven","coreContinuityAtRisk":true|false|null}],
      "reason": "...", "adverseCase": "...", "decisiveTrigger": "...", "confidence": "high|medium|low"
    },
    "structural_demand": {
      "futureCategoryTrend": "rising|stable|declining|unproven",
      "causalDirectness": "direct|enabling|indirect|none|unproven",
      "coreExposure": "majority|material_minority|limited|unproven",
      "netExpansionAfterSubstitution": true|false|null,
      "futureDriver": "ai_agents|automation_robotics|china_engineering|demographics_social|climate_resources|regulation_infrastructure|generic_market_forecast|unproven",
      "reason": "...", "adverseCase": "...", "decisiveTrigger": "...", "confidence": "high|medium|low"
    },
    "future_value_capture": {
      "marketplaceMechanics": {
        "applies": true|false|null,
        "fragmentedCounterparties": true|false|null,
        "companyOperatesMatchingAndExecution": true|false|null,
        "agentsRequireComparableCoverageOrLiquidity": true|false|null,
        "scaledAlternativeCanBypassMajorityBy2033": true|false|null
      },
      "workflowReplacement": {
        "applies": true|false|null,
        "customerOwnsCoreState": true|false|null,
        "workflowRebuildableByAgents": true|false|null,
        "vendorControlsRegulatedOrIrreversibleExecution": true|false|null,
        "vendorExecutionType": "none|regulated_ledger_or_mandate|money_movement|security_enforcement|compute_identity_control_plane|physical_or_transaction_execution|unproven",
        "vendorExecutionCoversMajorityCore": true|false|null,
        "workflowCoversMajorityCore": true|false|null,
        "majorityCustomReplacementEconomicallyPlausibleBy2033": true|false|null,
        "migrationComplexityPrimaryBarrier": true|false|null
      },
      "roleArchetype": "weak_digital_interface|authoritative_system|controlled_marketplace_liquidity|transaction_or_asset_operator|physical_product_operator|regulated_operator|proprietary_stack_operator|brand_product_operator|other|unproven",
      "agentsNeedControlledAccess": true|false|null,
      "credibleMajorityBypass": true|false|null,
      "finalNeedPersists": true|false|null,
      "paidCompanyRolePersists": true|false|null,
      "roleCoversMajorityCore": true|false|null,
      "majorityAbsorptionWithinSevenYears": true|false|null,
      "companySpecificControl": true|false|null,
      "paymentMechanismPersists": true|false|null,
      "aiPriceCommoditization": true|false|null,
      "aiPriceCommoditizationCoversMajorityCore": true|false|null,
      "reason": "...", "adverseCase": "...", "decisiveTrigger": "...", "confidence": "high|medium|low"
    },
      "transition_capacity": {
      "futureAdaptationContract": true,
      "adaptationLeversSurviveScenario": true|false|null,
      "coreReconfigurableWithinScenario": true|false|null,
      "adaptationLeadTimeFits": true|false|null,
      "legacyConstraintManageable": true|false|null,
      "reason": "...", "adverseCase": "...", "decisiveTrigger": "...", "confidence": "high|medium|low"
    }
  }
}`;
}

export function buildFutureWorkflowRepairPrompt(args: {
  ticker: string;
  company: string;
  industry: string;
  dossier: string;
  currentAdjudication: Record<string, unknown>;
}): string {
  return `Complete uniquement la checklist de remplacement des workflows pour ${args.company} (${args.ticker}), secteur ${args.industry}, dans le scenario central 2033. Ne revise aucun autre champ de l'adjudication.

SCENARIO 2033
- IA et agents largement adoptes; generation de code fiable; automatisation avancee; interfaces et workflows reproductibles fortement comprimes.

REGLES
- applies=true seulement si une part materielle du coeur est un logiciel de workflow, un systeme d'autorite, un outil de productivite ou une stack numerique que le client pourrait reconstruire ou remplacer.
- applies=false si le logiciel ne fait qu'assister un service dont le coeur paye reste une execution humaine, clinique, physique ou reglementaire complexe; coder l'interface ne remplace ni l'accreditation, ni le reseau operationnel, ni la responsabilite, ni le savoir-faire d'execution.
- customerOwnsCoreState=true si les donnees, configurations, regles et historique economiquement utiles appartiennent principalement au client et peuvent etre exportes ou reconstruits; l'hebergement actuel chez le fournisseur ne vaut pas propriete.
- workflowRebuildableByAgents=true si des agents et outils de code devraient pouvoir reconstruire les interfaces, automatisations et logique metier majoritaires. Ne confonds pas interface reconstruisible et moteur transactionnel critique.
- vendorControlsRegulatedOrIrreversibleExecution=true seulement si le fournisseur controle encore une execution que le client ne peut pas raisonnablement internaliser: ledger reglemente, mouvement d'argent, enforcement securite, calcul/identite systemique, transaction irreversible ou droit externe. Audit, permissions et integrations configurables par le client ne suffisent pas seuls.
- vendorExecutionType doit nommer le mecanisme exact. Utilise none pour un workflow, une CMDB, des permissions ou un audit configurables par le client; un type positif sans couverture de plus de 50% du coeur ne preserve pas la plateforme a l'echelle de l'entreprise.
- workflowCoversMajorityCore=true uniquement si ce workflow reconstruisible represente lui-meme plus de 50% du coeur propre de l'entreprise. Un segment logiciel minoritaire d'un groupe diversifie vaut false.
- majorityCustomReplacementEconomicallyPlausibleBy2033=true exige une voie technique ET economique permettant a une grande entreprise d'absorber plus de 50% du role sans le fournisseur d'ici 2033. Une maquette, un front-end personnalise ou quelques automatisations ne suffisent pas.
- migrationComplexityPrimaryBarrier=true si l'avantage defendu repose surtout sur le cout historique de migration, les configurations et les integrations du client, plutot que sur un actif rare controle par le fournisseur.
- Les faits du dossier contraignent la projection. N'ajoute aucun fait et ne cherche pas a reproduire une note attendue.

ADJUDICATION ACTUELLE FIGEE
${JSON.stringify(args.currentAdjudication)}

DOSSIER FIGE
${args.dossier}

Retourne uniquement ce JSON strict:
{
  "applies": true|false|null,
  "customerOwnsCoreState": true|false|null,
  "workflowRebuildableByAgents": true|false|null,
  "vendorControlsRegulatedOrIrreversibleExecution": true|false|null,
  "vendorExecutionType": "none|regulated_ledger_or_mandate|money_movement|security_enforcement|compute_identity_control_plane|physical_or_transaction_execution|unproven",
  "vendorExecutionCoversMajorityCore": true|false|null,
  "workflowCoversMajorityCore": true|false|null,
  "majorityCustomReplacementEconomicallyPlausibleBy2033": true|false|null,
  "migrationComplexityPrimaryBarrier": true|false|null
}`;
}

export function buildFutureMarketplaceRepairPrompt(args: {
  ticker: string;
  company: string;
  industry: string;
  dossier: string;
  currentAdjudication: Record<string, unknown>;
}): string {
  return `Complete uniquement la checklist marketplace manquante pour ${args.company} (${args.ticker}), secteur ${args.industry}, dans le scenario central 2033. Ne revise aucun autre champ de l'adjudication.

SCENARIO 2033
- IA et agents largement adoptes; robotique avancee; forte progression chinoise; compression des interfaces reproductibles.

REGLES
- applies=true seulement si le coeur repose sur une marketplace ou une liquidite de matching entre contreparties.
- fragmentedCounterparties=true si l'offre ou la demande pertinente reste dispersee entre de nombreux acteurs independants.
- companyOperatesMatchingAndExecution=true si l'entreprise exploite le matching et une execution contractuelle/transactionnelle materielle, pas seulement des listings ou du trafic.
- agentsRequireComparableCoverageOrLiquidity=true si un agent doit encore obtenir une couverture, une disponibilite ou une liquidite comparable pour satisfaire la majorite du besoin.
- scaledAlternativeCanBypassMajorityBy2033=true exige une voie technique ET economique permettant a une alternative d'agreger cette couverture et d'executer plus de 50% du coeur a l'echelle d'ici 2033.
- Le multihoming, les ventes directes ou la capacite theorique d'appeler plusieurs API ne suffisent pas a prouver un bypass majoritaire.
- Pour une mobilite autonome, une flotte integree peut constituer un bypass seulement si elle peut capter a la fois une offre et une demande suffisantes a l'echelle.
- Les faits du dossier contraignent la projection; le benchmark et la note attendue sont inconnus.

ADJUDICATION ACTUELLE FIGEE
${JSON.stringify(args.currentAdjudication)}

DOSSIER FIGE
${args.dossier}

Retourne uniquement ce JSON strict:
{
  "applies": true|false|null,
  "fragmentedCounterparties": true|false|null,
  "companyOperatesMatchingAndExecution": true|false|null,
  "agentsRequireComparableCoverageOrLiquidity": true|false|null,
  "scaledAlternativeCanBypassMajorityBy2033": true|false|null
}`;
}
