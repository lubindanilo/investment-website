import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FUTURE_RESILIENCE_VERSION, scoreFutureResilience } from './resilienceFuturePilot.js';

const common = {
  reason: 'Raison factuelle.',
  adverseCase: 'Cas adverse factuel.',
  decisiveTrigger: 'Declencheur mesurable.',
  confidence: 'high',
};

function fixture() {
  return {
    scenarioYear: 2033,
    criteria: {
      future_control: {
        controlType: 'proprietary_stack_or_ip', controlStillNeeded: true, companySpecific: true,
        majorityCoreCoverage: true, scarcitySurvivesAiChina: true, replicableWithinFiveYears: false,
        futureRentPaid: true, systemBottleneck: false, multipleIndependentControls: false, ...common,
      },
      disruption_positioning: {
        forces: [
          { force: 'ai_agents', majorityCoreThreatPath: false, technicalAndEconomicPath: false, materialDirectBenefit: true, responseControlsOutcome: true, benefitMechanism: 'external_demand_expansion' },
          { force: 'automation_robotics', majorityCoreThreatPath: false, technicalAndEconomicPath: false, materialDirectBenefit: true, responseControlsOutcome: true, benefitMechanism: 'company_specific_cost_or_capacity_advantage' },
          { force: 'china_engineering', majorityCoreThreatPath: false, technicalAndEconomicPath: false, materialDirectBenefit: false, responseControlsOutcome: false, benefitMechanism: 'none' },
        ],
        ...common,
      },
      future_dependencies: { coverageComplete: true, clusters: [], ...common },
      structural_demand: { futureCategoryTrend: 'rising', causalDirectness: 'direct', coreExposure: 'majority', ...common },
      future_value_capture: {
        roleArchetype: 'proprietary_stack_operator', agentsNeedControlledAccess: true,
        credibleMajorityBypass: false,
        finalNeedPersists: true, paidCompanyRolePersists: true, roleCoversMajorityCore: true,
        majorityAbsorptionWithinSevenYears: false, companySpecificControl: true,
        paymentMechanismPersists: true, aiPriceCommoditization: false,
        aiPriceCommoditizationCoversMajorityCore: false, ...common,
      },
      transition_capacity: {
        fundingCapacity: true,
        scaledAdaptationEvidence: true,
        scaledAdaptationType: 'material_core_deployment',
        measuredOperatingEffect: true,
        monetizedMaterialOutcome: true,
        outcomeCausallyAttributedToAdaptation: true,
        legacyConstraintManageable: true,
        ...common,
      },
    },
  };
}

describe('scoreFutureResilience', () => {
  it('garde le code, le schema et les miroirs locaux sur la meme version', () => {
    const requiredMirrors = [
      new URL('../../../../docs/resilience/README.md', import.meta.url),
      new URL('../../../../docs/resilience/adjudication.schema.json', import.meta.url),
    ];
    const optionalLocalMirrors = [
      '/Users/lubin.danilo/Personal Agents/vault/connaissances/strategie/lubin-investment-resilience-strategie.md',
      '/Users/lubin.danilo/.codex/skills/lubin-resilience-scorer/SKILL.md',
    ].filter(path => existsSync(path));

    for (const mirror of [...requiredMirrors, ...optionalLocalMirrors]) {
      expect(readFileSync(mirror, 'utf8')).toContain(FUTURE_RESILIENCE_VERSION);
    }
  });

  it('note le scenario 2033 sans utiliser de donnees Quality', () => {
    const result = scoreFutureResilience(fixture());
    expect(result.criteria.map(criterion => criterion.score)).toEqual([2, 3, 2, 2, 2, 2]);
    expect(result.finalScore).toBe(79);
    expect(result.grade).toBe('B');
  });

  it('reserve le grade A a un controle futur exceptionnel', () => {
    const input = fixture();
    input.criteria.future_control.systemBottleneck = true;
    const result = scoreFutureResilience(input);
    expect(result.criteria[0]!.score).toBe(3);
    expect(result.finalScore).toBe(100);
    expect(result.grade).toBe('A');
  });

  it('ne transforme pas l incertitude de projection en absence de controle', () => {
    const input = fixture();
    Object.assign(input.criteria.future_control, {
      companySpecific: null,
      majorityCoreCoverage: null,
      scarcitySurvivesAiChina: null,
      replicableWithinFiveYears: null,
    });
    expect(scoreFutureResilience(input).criteria[0]!.score).toBe(1);
  });

  it('garde une demande directement exposee neutre quand sa tendance est inconnue', () => {
    const input = fixture();
    Object.assign(input.criteria.structural_demand, { futureCategoryTrend: 'unproven' });
    expect(scoreFutureResilience(input).criteria[3]!.score).toBe(1);
  });

  it('ne compte pas deux fois la meme preuve de resistance a la replication', () => {
    const input = fixture();
    Object.assign(input.criteria.future_control, {
      scarcitySurvivesAiChina: null,
      replicableWithinFiveYears: null,
    });
    expect(scoreFutureResilience(input).criteria[0]!.score).toBe(2);
  });

  it('garde un point a un controle majoritaire encore paye mais en erosion', () => {
    const input = fixture();
    Object.assign(input.criteria.future_control, {
      scarcitySurvivesAiChina: false,
      replicableWithinFiveYears: true,
    });
    expect(scoreFutureResilience(input).criteria[0]!.score).toBe(1);

    Object.assign(input.criteria.future_control, { majorityCoreCoverage: false });
    expect(scoreFutureResilience(input).criteria[0]!.score).toBe(0);
  });

  it('plafonne a E une entreprise dont le role paye disparait', () => {
    const input = fixture();
    input.criteria.future_value_capture.paidCompanyRolePersists = false;
    const result = scoreFutureResilience(input);
    expect(result.rawScore).toBeGreaterThan(29);
    expect(result.finalScore).toBe(29);
    expect(result.gates).toContain('no_future_paid_role');
  });

  it('ne confond pas couverture partielle et disparition du role paye', () => {
    const input = fixture();
    input.criteria.future_value_capture.roleCoversMajorityCore = false;
    const result = scoreFutureResilience(input);
    expect(result.criteria[4]!.score).toBe(0);
    expect(result.gates).not.toContain('no_future_paid_role');
    expect(result.finalScore).toBeGreaterThan(29);
  });

  it("ne transforme pas une absorption inconnue en disparition du role paye", () => {
    const input = fixture();
    Object.assign(input.criteria.future_value_capture, { majorityAbsorptionWithinSevenYears: null });
    const result = scoreFutureResilience(input);
    expect(result.criteria[4]!.score).toBe(2);
    expect(result.gates).not.toContain('no_future_paid_role');
  });

  it('derive la capture durable d un controle futur deja qualifie', () => {
    const input = fixture();
    Object.assign(input.criteria.future_value_capture, {
      majorityAbsorptionWithinSevenYears: null,
      companySpecificControl: null,
      aiPriceCommoditization: null,
    });
    expect(scoreFutureResilience(input).criteria[4]!.score).toBe(2);

    Object.assign(input.criteria.future_control, {
      controlType: 'none', controlStillNeeded: false, companySpecific: false,
      majorityCoreCoverage: false, scarcitySurvivesAiChina: false,
      replicableWithinFiveYears: true, futureRentPaid: false,
    });
    expect(scoreFutureResilience(input).criteria[4]!.score).toBe(1);
  });

  it('separe la compression de l interface de celle de la rente majoritaire', () => {
    const input = fixture();
    Object.assign(input.criteria.future_value_capture, {
      aiPriceCommoditization: true,
      aiPriceCommoditizationCoversMajorityCore: false,
    });
    expect(scoreFutureResilience(input).criteria[4]!.score).toBe(2);

    input.criteria.future_value_capture.aiPriceCommoditizationCoversMajorityCore = true;
    expect(scoreFutureResilience(input).criteria[4]!.score).toBe(1);
  });

  it('qualifie une marketplace que les agents doivent encore utiliser malgre la compression', () => {
    const input = fixture();
    const marketplaceMechanics = {
      applies: true,
      fragmentedCounterparties: true,
      companyOperatesMatchingAndExecution: true,
      agentsRequireComparableCoverageOrLiquidity: true,
      scaledAlternativeCanBypassMajorityBy2033: false,
    };
    Object.assign(input.criteria.future_value_capture, {
      marketplaceMechanics,
      roleArchetype: 'controlled_marketplace_liquidity',
      agentsNeedControlledAccess: true,
      credibleMajorityBypass: false,
      aiPriceCommoditization: true,
    });
    expect(scoreFutureResilience(input).criteria[4]!.score).toBe(2);

    Object.assign(input.criteria.future_value_capture, {
      credibleMajorityBypass: true,
      marketplaceMechanics: {
        ...marketplaceMechanics,
        scaledAlternativeCanBypassMajorityBy2033: true,
      },
    });
    expect(scoreFutureResilience(input).criteria[4]!.score).toBe(1);
  });

  it('resout les contradictions marketplace avec la checklist detaillee', () => {
    const input = fixture();
    Object.assign(input.criteria.future_control, {
      controlType: 'network_liquidity', majorityCoreCoverage: false,
    });
    const ai = input.criteria.disruption_positioning.forces[0]!;
    Object.assign(ai, {
      majorityCoreThreatPath: true, technicalAndEconomicPath: true,
      materialDirectBenefit: true, responseControlsOutcome: false,
    });
    Object.assign(input.criteria.future_value_capture, {
      marketplaceMechanics: {
        applies: true,
        fragmentedCounterparties: true,
        companyOperatesMatchingAndExecution: true,
        agentsRequireComparableCoverageOrLiquidity: true,
        scaledAlternativeCanBypassMajorityBy2033: true,
      },
      roleArchetype: 'transaction_or_asset_operator',
      agentsNeedControlledAccess: false,
      credibleMajorityBypass: true,
      aiPriceCommoditization: true,
    });
    const result = scoreFutureResilience(input);
    expect(result.criteria[0]!.score).toBe(2);
    expect(result.criteria[1]!.score).toBe(2);
    expect(result.criteria[4]!.score).toBe(2);

    Object.assign(input.criteria.future_control, { replicableWithinFiveYears: true });
    const replicableMarketplace = scoreFutureResilience(input);
    expect(replicableMarketplace.criteria[0]!.score).toBe(0);
    expect(replicableMarketplace.criteria[1]!.score).toBe(1);
    expect(replicableMarketplace.criteria[4]!.score).toBe(1);
  });

  it('plafonne une interface numerique commoditisable sans penaliser un operateur physique', () => {
    const input = fixture();
    Object.assign(input.criteria.future_control, {
      controlType: 'installed_base', scarcitySurvivesAiChina: false,
      replicableWithinFiveYears: true, majorityCoreCoverage: false,
    });
    Object.assign(input.criteria.future_value_capture, {
      roleArchetype: 'weak_digital_interface', companySpecificControl: false,
      aiPriceCommoditization: true,
    });
    const weakInterface = scoreFutureResilience(input);
    expect(weakInterface.finalScore).toBe(29);
    expect(weakInterface.gates).toContain('commoditized_weak_digital_interface');

    Object.assign(input.criteria.future_value_capture, { roleArchetype: 'physical_product_operator' });
    const physicalOperator = scoreFutureResilience(input);
    expect(physicalOperator.gates).not.toContain('commoditized_weak_digital_interface');
    expect(physicalOperator.finalScore).toBeGreaterThan(29);
  });

  it('ne cumule pas controle exceptionnel et benefice IA pour une stack numerique commoditisee', () => {
    const input = fixture();
    Object.assign(input.criteria.future_control, {
      systemBottleneck: false,
      multipleIndependentControls: true,
    });
    Object.assign(input.criteria.future_value_capture, {
      roleArchetype: 'proprietary_stack_operator',
      agentsNeedControlledAccess: false,
      aiPriceCommoditization: true,
    });
    const result = scoreFutureResilience(input);
    expect(result.criteria[0]!.score).toBe(1);
    expect(result.criteria[1]!.score).toBe(2);

    const china = input.criteria.disruption_positioning.forces[2]!;
    Object.assign(china, { responseControlsOutcome: true });
    const integratedPhysicalDefense = scoreFutureResilience(input);
    expect(integratedPhysicalDefense.criteria[0]!.score).toBe(3);
    expect(integratedPhysicalDefense.criteria[1]!.score).toBe(3);
  });

  it('preserve un plan de controle numerique majoritaire qui reste un goulot systeme', () => {
    const input = fixture();
    Object.assign(input.criteria.future_control, {
      systemBottleneck: true,
      multipleIndependentControls: true,
    });
    Object.assign(input.criteria.future_value_capture, {
      roleArchetype: 'proprietary_stack_operator',
      agentsNeedControlledAccess: false,
      credibleMajorityBypass: false,
      majorityAbsorptionWithinSevenYears: false,
      companySpecificControl: true,
      paymentMechanismPersists: true,
      aiPriceCommoditization: true,
    });
    const result = scoreFutureResilience(input);
    expect(result.criteria[0]!.score).toBe(3);
    expect(result.criteria[0]!.audit.durableDigitalControlPlane).toBe(true);
    expect(result.criteria[1]!.score).toBe(3);
  });

  it('degrade un workflow client reconstruisible sans execution controlee par le fournisseur', () => {
    const input = fixture();
    Object.assign(input.criteria.future_control, {
      controlType: 'installed_base',
      systemBottleneck: false,
    });
    Object.assign(input.criteria.future_value_capture, {
      roleArchetype: 'authoritative_system',
      workflowReplacement: {
        applies: true,
        customerOwnsCoreState: true,
        workflowRebuildableByAgents: true,
        vendorControlsRegulatedOrIrreversibleExecution: false,
        majorityCustomReplacementEconomicallyPlausibleBy2033: true,
        migrationComplexityPrimaryBarrier: true,
      },
    });
    const result = scoreFutureResilience(input);
    expect(result.criteria[0]!.score).toBe(1);
    expect(result.criteria[1]!.score).toBe(1);
    expect(result.criteria[4]!.score).toBe(1);
    expect(result.criteria[0]!.audit.customerOwnedWorkflowCapApplied).toBe(true);
  });

  it('derive le remplacement quand la migration est la seule barriere restante', () => {
    const input = fixture();
    Object.assign(input.criteria.future_control, { controlType: 'installed_base' });
    const workflowReplacement = {
      applies: true,
      customerOwnsCoreState: true,
      workflowRebuildableByAgents: true,
      vendorControlsRegulatedOrIrreversibleExecution: false,
      majorityCustomReplacementEconomicallyPlausibleBy2033: null as boolean | null,
      migrationComplexityPrimaryBarrier: true,
    };
    Object.assign(input.criteria.future_value_capture, {
      roleArchetype: 'authoritative_system',
      workflowReplacement,
    });
    const derived = scoreFutureResilience(input);
    expect(derived.criteria[0]!.score).toBe(1);
    expect(derived.criteria[1]!.score).toBe(1);
    expect(derived.criteria[4]!.score).toBe(1);
    expect(derived.criteria[0]!.audit.majorityReplacementDerivedFromWorkflowMechanics).toBe(true);
    expect(derived.finalScore).toBe(49);
    expect(derived.gates).toContain('customer_owned_workflow_replacement');

    workflowReplacement.majorityCustomReplacementEconomicallyPlausibleBy2033 = false;
    const explicitlyRefuted = scoreFutureResilience(input);
    expect(explicitlyRefuted.criteria[0]!.score).toBe(1);
    expect(explicitlyRefuted.criteria[1]!.score).toBe(1);
    expect(explicitlyRefuted.finalScore).toBe(49);
  });

  it('preserve un systeme qui controle une execution reglementee ou irreversible', () => {
    const input = fixture();
    Object.assign(input.criteria.future_control, { controlType: 'installed_base' });
    Object.assign(input.criteria.future_value_capture, {
      roleArchetype: 'authoritative_system',
      workflowReplacement: {
        applies: true,
        customerOwnsCoreState: true,
        workflowRebuildableByAgents: true,
        vendorControlsRegulatedOrIrreversibleExecution: true,
        vendorExecutionType: 'regulated_ledger_or_mandate',
        vendorExecutionCoversMajorityCore: true,
        majorityCustomReplacementEconomicallyPlausibleBy2033: true,
        migrationComplexityPrimaryBarrier: false,
      },
    });
    const result = scoreFutureResilience(input);
    expect(result.criteria[0]!.score).toBe(2);
    expect(result.criteria[1]!.score).toBe(3);
    expect(result.criteria[4]!.score).toBe(2);
    expect(result.criteria[0]!.audit.customerOwnedWorkflowCapApplied).toBeUndefined();
  });

  it('ne confond pas une stack proprietaire d enforcement securite avec un workflow client', () => {
    const input = fixture();
    Object.assign(input.criteria.future_value_capture, {
      roleArchetype: 'proprietary_stack_operator',
      companySpecificControl: true,
      credibleMajorityBypass: false,
      workflowReplacement: {
        applies: true,
        customerOwnsCoreState: true,
        workflowRebuildableByAgents: true,
        vendorControlsRegulatedOrIrreversibleExecution: false,
        vendorExecutionType: 'security_enforcement',
        vendorExecutionCoversMajorityCore: false,
        majorityCustomReplacementEconomicallyPlausibleBy2033: false,
        migrationComplexityPrimaryBarrier: true,
      },
    });
    const result = scoreFutureResilience(input);
    expect(result.gates).not.toContain('customer_owned_workflow_replacement');
    expect(result.criteria[4]!.audit.proprietarySecurityEnforcementCandidate).toBe(true);
  });

  it('refuse une execution critique seulement declaree sans type ni couverture majoritaire', () => {
    const input = fixture();
    Object.assign(input.criteria.future_control, { controlType: 'installed_base' });
    Object.assign(input.criteria.future_value_capture, {
      roleArchetype: 'authoritative_system',
      workflowReplacement: {
        applies: true,
        customerOwnsCoreState: true,
        workflowRebuildableByAgents: true,
        vendorControlsRegulatedOrIrreversibleExecution: true,
        vendorExecutionType: 'none',
        vendorExecutionCoversMajorityCore: false,
        majorityCustomReplacementEconomicallyPlausibleBy2033: true,
        migrationComplexityPrimaryBarrier: true,
      },
    });
    const result = scoreFutureResilience(input);
    expect(result.criteria[0]!.score).toBe(1);
    expect(result.criteria[1]!.score).toBe(1);
    expect(result.criteria[4]!.score).toBe(1);
  });

  it('refuse une capture durable lorsqu un bypass majoritaire reste credible', () => {
    const input = fixture();
    Object.assign(input.criteria.future_value_capture, {
      roleArchetype: 'physical_product_operator',
      credibleMajorityBypass: true,
      aiPriceCommoditization: false,
    });
    const result = scoreFutureResilience(input);
    expect(result.criteria[4]!.score).toBe(1);
    expect(result.criteria[4]!.audit.derivedFromFutureControl).toBe(false);
  });

  it('plafonne les droits temporaires sans visibilite majoritaire jusqu en 2033', () => {
    const input = fixture();
    Object.assign(input.criteria.future_control, {
      rightsVisibilityThroughScenario: null,
    });
    Object.assign(input.criteria.future_value_capture, {
      roleArchetype: 'regulated_operator',
      credibleMajorityBypass: false,
      aiPriceCommoditization: false,
    });
    const unresolvedRights = scoreFutureResilience(input);
    expect(unresolvedRights.criteria[0]!.score).toBe(1);
    expect(unresolvedRights.criteria[4]!.score).toBe(1);

    Object.assign(input.criteria.future_control, { rightsVisibilityThroughScenario: true });
    const visibleRights = scoreFutureResilience(input);
    expect(visibleRights.criteria[0]!.score).toBe(2);
    expect(visibleRights.criteria[4]!.score).toBe(2);
  });

  it('plafonne a D un role paye mais commoditise et contournable', () => {
    const input = fixture();
    Object.assign(input.criteria.future_control, {
      controlType: 'none', controlStillNeeded: false, companySpecific: false,
      majorityCoreCoverage: false, scarcitySurvivesAiChina: false,
      replicableWithinFiveYears: true, futureRentPaid: false,
    });
    Object.assign(input.criteria.future_value_capture, {
      roleArchetype: 'regulated_operator',
      agentsNeedControlledAccess: false,
      credibleMajorityBypass: true,
      companySpecificControl: true,
      aiPriceCommoditization: true,
    });
    for (const force of input.criteria.disruption_positioning.forces) {
      force.materialDirectBenefit = false;
      force.responseControlsOutcome = false;
    }
    const result = scoreFutureResilience(input);
    expect(result.finalScore).toBe(49);
    expect(result.grade).toBe('D');
    expect(result.gates).toContain('commoditized_interchangeable_paid_role');

    Object.assign(input.criteria.future_value_capture, { roleArchetype: 'physical_product_operator' });
    expect(scoreFutureResilience(input).gates).not.toContain('commoditized_interchangeable_paid_role');

    Object.assign(input.criteria.future_value_capture, { roleArchetype: 'regulated_operator' });
    input.criteria.disruption_positioning.forces[0]!.materialDirectBenefit = true;
    expect(scoreFutureResilience(input).gates).not.toContain('commoditized_interchangeable_paid_role');
  });

  it('interdit le grade A quand la capacite de transition est nulle', () => {
    const input = fixture();
    input.criteria.future_control.systemBottleneck = true;
    Object.assign(input.criteria.transition_capacity, {
      fundingCapacity: true,
      scaledAdaptationEvidence: false,
      legacyConstraintManageable: false,
    });
    const result = scoreFutureResilience(input);
    expect(result.criteria[5]!.score).toBe(0);
    expect(result.finalScore).toBe(79);
    expect(result.grade).toBe('B');
    expect(result.gates).toContain('future_a_eligibility');
  });

  it('ne qualifie pas une annonce ou un pilote comme adaptation a l echelle', () => {
    const input = fixture();
    Object.assign(input.criteria.transition_capacity, {
      scaledAdaptationEvidence: true,
      scaledAdaptationType: 'announcement_or_pilot',
      measuredOperatingEffect: false,
      monetizedMaterialOutcome: false,
      outcomeCausallyAttributedToAdaptation: false,
    });
    const result = scoreFutureResilience(input);
    expect(result.criteria[5]!.score).toBe(1);
    expect(result.criteria[5]!.audit.scaledAdaptationEvidence).toBe(false);
  });

  it('refuse un resultat general non attribue au deploiement d adaptation', () => {
    const input = fixture();
    input.criteria.transition_capacity.outcomeCausallyAttributedToAdaptation = false;
    const result = scoreFutureResilience(input);
    expect(result.criteria[5]!.score).toBe(1);
    expect(result.criteria[5]!.audit.scaledAdaptationEvidence).toBe(false);
  });

  it('plafonne a C un role futur interchangeable', () => {
    const input = fixture();
    Object.assign(input.criteria.future_control, {
      controlType: 'none', controlStillNeeded: false, companySpecific: false,
      majorityCoreCoverage: false, scarcitySurvivesAiChina: false,
      replicableWithinFiveYears: true, futureRentPaid: false,
    });
    const result = scoreFutureResilience(input);
    expect(result.finalScore).toBe(69);
    expect(result.gates).toContain('interchangeable_future_role');
  });

  it('penalise uniquement une rupture avec voie majoritaire technique et economique', () => {
    const input = fixture();
    const ai = input.criteria.disruption_positioning.forces[0]!;
    ai.majorityCoreThreatPath = true;
    ai.technicalAndEconomicPath = false;
    ai.responseControlsOutcome = false;
    expect(scoreFutureResilience(input).criteria[1]!.score).toBe(2);
    ai.technicalAndEconomicPath = true;
    expect(scoreFutureResilience(input).criteria[1]!.score).toBe(1);
  });

  it('ne qualifie pas de renforcement un benefice que l entreprise ne controle pas', () => {
    const input = fixture();
    const ai = input.criteria.disruption_positioning.forces[0]!;
    Object.assign(ai, { responseControlsOutcome: null });
    expect(scoreFutureResilience(input).criteria[1]!.score).toBe(2);
  });

  it('reserve 3 sur 3 a au moins deux forces positives', () => {
    const input = fixture();
    Object.assign(input.criteria.disruption_positioning.forces[1]!, {
      materialDirectBenefit: false,
      responseControlsOutcome: false,
    });
    expect(scoreFutureResilience(input).criteria[1]!.score).toBe(2);
  });

  it('ne compte qu une fois deux forces positives fondees sur le meme mecanisme', () => {
    const input = fixture();
    input.criteria.disruption_positioning.forces[1]!.benefitMechanism = 'external_demand_expansion';
    expect(scoreFutureResilience(input).criteria[1]!.score).toBe(2);
  });

  it('refuse un gain d efficacite generique sans mecanisme controle', () => {
    const input = fixture();
    Object.assign(input.criteria.disruption_positioning.forces[0]!, {
      materialDirectBenefit: true,
      responseControlsOutcome: true,
      benefitMechanism: 'none',
    });
    Object.assign(input.criteria.disruption_positioning.forces[1]!, {
      materialDirectBenefit: false,
      responseControlsOutcome: false,
    });
    expect(scoreFutureResilience(input).criteria[1]!.score).toBe(2);
  });

  it('ne transforme pas une mitigation inconnue en dependance existentielle non mitigee', () => {
    const input = fixture();
    Object.assign(input.criteria.future_dependencies, {
      coverageComplete: true,
      clusters: [{
        name: 'Dependance critique', material: true, continuityImpact: 'existential',
        mitigation: 'unproven',
      }],
    });
    expect(scoreFutureResilience(input).criteria[2]!.score).toBe(1);
  });

  it('reserve 2 sur 2 aux dependances fortement mitigees', () => {
    const input = fixture();
    Object.assign(input.criteria.future_dependencies, {
      coverageComplete: true,
      clusters: [{
        name: 'Dependance materielle', material: true, continuityImpact: 'material_impairment',
        mitigation: 'medium',
      }],
    });
    expect(scoreFutureResilience(input).criteria[2]!.score).toBe(1);
    Object.assign(input.criteria.future_dependencies, {
      clusters: [{
        name: 'Dependance materielle', material: true, continuityImpact: 'material_impairment',
        mitigation: 'strong',
      }],
    });
    expect(scoreFutureResilience(input).criteria[2]!.score).toBe(2);
  });
});
