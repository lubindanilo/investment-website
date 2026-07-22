import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildFutureResiliencePilotPrompt,
  FUTURE_RESILIENCE_VERSION,
  scoreFutureResilience,
} from './resilienceFuturePilot.js';

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
        futureProjectionContract: true,
        controlType: 'proprietary_stack_or_ip', controlStillNeeded: true, companySpecific: true,
        majorityCoreCoverage: true, scarcitySurvivesAiChina: true, replicableWithinFiveYears: false,
        futureRentPaid: true, systemBottleneck: false, multipleIndependentControls: false, ...common,
        controlPortfolio: {
          applies: false,
          nonOverlappingCombinedMajorityCoverage: false,
          controls: [] as Array<Record<string, unknown>>,
        },
      },
      disruption_positioning: {
        forces: [
          { force: 'ai_agents', majorityCoreThreatPath: false, technicalAndEconomicPath: false, materialPressure: false, materialDirectBenefit: true, responseControlsOutcome: true, benefitMechanism: 'external_demand_expansion' },
          { force: 'automation_robotics', majorityCoreThreatPath: false, technicalAndEconomicPath: false, materialPressure: false, materialDirectBenefit: true, responseControlsOutcome: true, benefitMechanism: 'company_specific_cost_or_capacity_advantage' },
          { force: 'china_engineering', majorityCoreThreatPath: false, technicalAndEconomicPath: false, materialPressure: false, materialDirectBenefit: false, responseControlsOutcome: false, benefitMechanism: 'none' },
        ],
        ...common,
      },
      future_dependencies: {
        residualOnlyAssessment: true, futureSeverityContract: true,
        futureShockGroupContract: true,
        coverageComplete: true, clusters: [] as Array<Record<string, unknown>>, ...common,
      },
      structural_demand: {
        futureCategoryTrend: 'rising', causalDirectness: 'direct', coreExposure: 'majority',
        netExpansionAfterSubstitution: true, futureDriver: 'ai_agents', ...common,
      },
      future_value_capture: {
        roleArchetype: 'proprietary_stack_operator', agentsNeedControlledAccess: true,
        credibleMajorityBypass: false,
        finalNeedPersists: true, paidCompanyRolePersists: true, roleCoversMajorityCore: true,
        majorityAbsorptionWithinSevenYears: false, companySpecificControl: true,
        paymentMechanismPersists: true, aiPriceCommoditization: false,
        aiPriceCommoditizationCoversMajorityCore: false, ...common,
        serviceOperatorMechanics: {
          applies: false, customerBuysOutcomeNotTool: false,
          companyOwnsInternalOperatingStack: false,
          companyControlsStructuredOperationalData: false,
          companyRetainsExecutionAccountability: false, aiExpandsServiceCapacity: false,
          serviceRoleCoversMajorityCore: false, customerCanInternalizeMajorityBy2033: true,
        },
        operationalControlPlaneMechanics: {
          applies: false, vendorProvidesCrossSystemStateModel: false,
          vendorEnforcesPermissionsAndActions: false, executionCoversMajorityCore: false,
          agentsNeedCompanyRuntime: false,
          customerCanReplicateAtEquivalentReliabilityBy2033: true,
          hyperscalerCanBypassMajorityBy2033: true,
        },
      },
      transition_capacity: {
        futureAdaptationContract: true,
        futureDifferentiatedAdaptationContract: true,
        adaptationLeversSurviveScenario: true,
        coreReconfigurableWithinScenario: true,
        adaptationLeadTimeFits: true,
        legacyConstraintManageable: true,
        adaptationAdvantageType: 'proprietary_internal_tooling_and_data',
        companySpecificAdaptationLevers: true,
        adaptationMechanismCoversMajorityCore: true,
        competitorsCanAccessSameLevers: false,
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

  it('exige les effets macro de second ordre sans les convertir en moat', () => {
    const prompt = buildFutureResiliencePilotPrompt({
      ticker: 'TEST',
      company: 'Test Company',
      industry: 'Test Industry',
      dossier: 'Dossier fige.',
    });
    expect(prompt).toContain('effets economiques de premier ET de second ordre');
    expect(prompt).toContain('force macro -> variation du nombre de besoins');
    expect(prompt).toContain('ne prouve jamais le controle specifique, la capture ou le pricing power');
    expect(prompt).toContain('Aucun chiffre actuel de croissance, marge, taille, revenu, FCF ou part de marche');
    expect(prompt).toContain('Une statistique presente peut identifier un point de depart, jamais fixer le score');
    expect(prompt).toContain('Une prevision sectorielle generique');
    expect(prompt).toContain('Les finances et deploiements actuels ne donnent aucun point');
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

  it('refuse une prevision sectorielle generique comme moteur futur maximal', () => {
    const input = fixture();
    Object.assign(input.criteria.structural_demand, {
      futureCategoryTrend: 'rising',
      netExpansionAfterSubstitution: true,
      futureDriver: 'generic_market_forecast',
    });
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
    const narrowControl = scoreFutureResilience(input);
    expect(narrowControl.criteria[0]!.score).toBe(1);
    expect(narrowControl.criteria[4]!.score).toBe(1);
    expect(narrowControl.criteria[4]!.audit.captureLimitedByNarrowControl).toBe(true);

    Object.assign(input.criteria.future_control, { majorityCoreCoverage: false });
    expect(scoreFutureResilience(input).criteria[0]!.score).toBe(0);
  });

  it('ne confond pas un concurrent existant avec la replication d un controle rare', () => {
    const input = fixture();
    Object.assign(input.criteria.future_control, {
      controlType: 'cost_supply_chain',
      systemBottleneck: true,
      multipleIndependentControls: true,
      scarcitySurvivesAiChina: true,
      replicableWithinFiveYears: true,
    });
    const result = scoreFutureResilience(input);
    expect(result.criteria[0]!.score).toBe(2);
    expect(result.criteria[0]!.score).not.toBe(3);
  });

  it('accorde seulement un controle etroit a un portefeuille diversifie de rentes independantes', () => {
    const input = fixture();
    Object.assign(input.criteria.future_control, {
      controlType: 'none', controlStillNeeded: false, companySpecific: false,
      majorityCoreCoverage: false, scarcitySurvivesAiChina: false,
      replicableWithinFiveYears: true, futureRentPaid: false,
      controlPortfolio: {
        applies: true,
        nonOverlappingCombinedMajorityCoverage: true,
        controls: [
          {
            controlType: 'installed_base', coreSegment: 'instruments',
            materialMinorityCoverage: true, companySpecific: true, futureRentPaid: true,
            survivesAiChina: true, independentFromOtherControls: true,
          },
          {
            controlType: 'regulated_execution_capability', coreSegment: 'services',
            materialMinorityCoverage: true, companySpecific: true, futureRentPaid: true,
            survivesAiChina: true, independentFromOtherControls: true,
          },
        ],
      },
    });
    const result = scoreFutureResilience(input);
    expect(result.criteria[0]!.score).toBe(1);
    expect(result.criteria[0]!.audit.portfolioControlQualified).toBe(true);

    input.criteria.future_control.controlPortfolio.nonOverlappingCombinedMajorityCoverage = false;
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

  it('necrase jamais un refus explicite d acces controle par la checklist marketplace', () => {
    const input = fixture();
    Object.assign(input.criteria.future_control, { controlType: 'network_liquidity' });
    Object.assign(input.criteria.future_value_capture, {
      marketplaceMechanics: {
        applies: true,
        fragmentedCounterparties: true,
        companyOperatesMatchingAndExecution: true,
        agentsRequireComparableCoverageOrLiquidity: true,
        scaledAlternativeCanBypassMajorityBy2033: false,
      },
      roleArchetype: 'controlled_marketplace_liquidity',
      agentsNeedControlledAccess: false,
      credibleMajorityBypass: false,
      aiPriceCommoditization: true,
    });
    const result = scoreFutureResilience(input);
    expect(result.criteria[0]!.score).toBe(1);
    expect(result.criteria[0]!.audit.marketplaceControlledAccessRefuted).toBe(true);
    expect(result.criteria[4]!.score).toBe(1);
    expect(result.criteria[4]!.audit.marketplaceChecklistQualified).toBe(false);
  });

  it('refuse qu une checklist marketplace ecrase des refus explicites', () => {
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
    expect(result.criteria[0]!.score).toBe(1);
    expect(result.criteria[1]!.score).toBe(1);
    expect(result.criteria[4]!.score).toBe(1);

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

  it('ne penalise une stack numerique que si la commoditisation couvre le coeur', () => {
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
    const minorityPricePressure = scoreFutureResilience(input);
    expect(minorityPricePressure.criteria[0]!.score).toBe(3);
    expect(minorityPricePressure.criteria[1]!.score).toBe(3);

    input.criteria.future_value_capture.aiPriceCommoditizationCoversMajorityCore = true;
    const majorityCommoditization = scoreFutureResilience(input);
    expect(majorityCommoditization.criteria[0]!.score).toBe(1);
    expect(majorityCommoditization.criteria[1]!.score).toBe(2);

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

  it('ne laisse pas un workflow minoritaire plafonner un operateur physique majoritaire', () => {
    const input = fixture();
    Object.assign(input.criteria.future_control, {
      controlType: 'proprietary_stack_or_ip',
      systemBottleneck: true,
      multipleIndependentControls: true,
    });
    Object.assign(input.criteria.future_value_capture, {
      roleArchetype: 'physical_product_operator',
      agentsNeedControlledAccess: false,
      credibleMajorityBypass: false,
      workflowReplacement: {
        applies: true,
        customerOwnsCoreState: true,
        workflowRebuildableByAgents: true,
        vendorControlsRegulatedOrIrreversibleExecution: false,
        vendorExecutionType: 'none',
        vendorExecutionCoversMajorityCore: false,
        workflowCoversMajorityCore: false,
        majorityCustomReplacementEconomicallyPlausibleBy2033: true,
        migrationComplexityPrimaryBarrier: true,
      },
    });
    const result = scoreFutureResilience(input);
    expect(result.gates).not.toContain('customer_owned_workflow_replacement');
    expect(result.criteria[0]!.score).toBe(3);
    expect(result.criteria[4]!.score).toBe(2);
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
    expect(explicitlyRefuted.criteria[0]!.score).toBe(2);
    expect(explicitlyRefuted.criteria[1]!.score).toBe(3);
    expect(explicitlyRefuted.criteria[4]!.score).toBe(2);
    expect(explicitlyRefuted.gates).not.toContain('customer_owned_workflow_replacement');
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

  it('preserve un operateur de service verticalise sans transformer tout support en moat', () => {
    const input = fixture();
    Object.assign(input.criteria.future_control, {
      scarcitySurvivesAiChina: false,
      replicableWithinFiveYears: true,
    });
    Object.assign(input.criteria.future_value_capture, {
      roleArchetype: 'vertical_service_operator',
      credibleMajorityBypass: true,
      serviceOperatorMechanics: {
        applies: true,
        customerBuysOutcomeNotTool: true,
        companyOwnsInternalOperatingStack: true,
        companyControlsStructuredOperationalData: true,
        companyRetainsExecutionAccountability: true,
        aiExpandsServiceCapacity: true,
        serviceRoleCoversMajorityCore: true,
        customerCanInternalizeMajorityBy2033: false,
      },
      workflowReplacement: {
        applies: true,
        customerOwnsCoreState: true,
        workflowRebuildableByAgents: true,
        vendorControlsRegulatedOrIrreversibleExecution: false,
        vendorExecutionType: 'none',
        vendorExecutionCoversMajorityCore: false,
        workflowCoversMajorityCore: true,
        majorityCustomReplacementEconomicallyPlausibleBy2033: true,
        migrationComplexityPrimaryBarrier: true,
      },
    });
    const result = scoreFutureResilience(input);
    expect(result.criteria[0]!.score).toBe(1);
    expect(result.criteria[4]!.score).toBe(2);
    expect(result.criteria[4]!.audit.verticalServiceOperatorCandidate).toBe(true);
    expect(result.gates).not.toContain('customer_owned_workflow_replacement');

    input.criteria.future_value_capture.serviceOperatorMechanics.customerCanInternalizeMajorityBy2033 = true;
    const internalizable = scoreFutureResilience(input);
    expect(internalizable.criteria[4]!.score).toBe(1);
    expect(internalizable.gates).toContain('customer_owned_workflow_replacement');
  });

  it('preserve un plan de controle operationnel mais pas un CRM reconstruisible', () => {
    const input = fixture();
    Object.assign(input.criteria.future_control, {
      systemBottleneck: false,
      multipleIndependentControls: false,
      scarcitySurvivesAiChina: false,
      replicableWithinFiveYears: true,
    });
    Object.assign(input.criteria.future_value_capture, {
      roleArchetype: 'proprietary_stack_operator',
      agentsNeedControlledAccess: true,
      credibleMajorityBypass: true,
      operationalControlPlaneMechanics: {
        applies: true,
        vendorProvidesCrossSystemStateModel: true,
        vendorEnforcesPermissionsAndActions: true,
        executionCoversMajorityCore: null,
        agentsNeedCompanyRuntime: true,
        customerCanReplicateAtEquivalentReliabilityBy2033: false,
        hyperscalerCanBypassMajorityBy2033: false,
      },
      workflowReplacement: {
        applies: true,
        customerOwnsCoreState: true,
        workflowRebuildableByAgents: true,
        vendorControlsRegulatedOrIrreversibleExecution: false,
        vendorExecutionType: 'none',
        vendorExecutionCoversMajorityCore: false,
        workflowCoversMajorityCore: true,
        majorityCustomReplacementEconomicallyPlausibleBy2033: true,
        migrationComplexityPrimaryBarrier: true,
      },
    });
    const controlPlane = scoreFutureResilience(input);
    expect(controlPlane.criteria[0]!.score).toBe(2);
    expect(controlPlane.criteria[4]!.score).toBe(2);
    expect(controlPlane.gates).not.toContain('customer_owned_workflow_replacement');

    input.criteria.future_value_capture.operationalControlPlaneMechanics.vendorEnforcesPermissionsAndActions = false;
    const rebuildableCrm = scoreFutureResilience(input);
    expect(rebuildableCrm.criteria[0]!.score).toBe(1);
    expect(rebuildableCrm.criteria[4]!.score).toBe(1);
    expect(rebuildableCrm.gates).toContain('customer_owned_workflow_replacement');
  });

  it('ne confond pas une stack proprietaire d enforcement securite avec un workflow client', () => {
    const input = fixture();
    Object.assign(input.criteria.future_control, {
      systemBottleneck: false,
      multipleIndependentControls: true,
    });
    Object.assign(input.criteria.future_value_capture, {
      roleArchetype: 'proprietary_stack_operator',
      agentsNeedControlledAccess: false,
      companySpecificControl: true,
      credibleMajorityBypass: false,
      aiPriceCommoditization: true,
      aiPriceCommoditizationCoversMajorityCore: false,
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
    expect(result.criteria[0]!.score).toBe(1);
    expect(result.criteria[4]!.score).toBe(2);
    expect(result.criteria[4]!.audit.proprietarySecurityEnforcementCandidate).toBe(true);
  });

  it('ne confond pas une capacite de service reglementee avec son logiciel de workflow', () => {
    const input = fixture();
    Object.assign(input.criteria.future_control, {
      controlType: 'regulated_execution_capability',
      systemBottleneck: false,
      multipleIndependentControls: false,
    });
    Object.assign(input.criteria.future_value_capture, {
      roleArchetype: 'regulated_operator',
      workflowReplacement: {
        applies: true,
        customerOwnsCoreState: true,
        workflowRebuildableByAgents: true,
        vendorControlsRegulatedOrIrreversibleExecution: false,
        vendorExecutionType: 'none',
        vendorExecutionCoversMajorityCore: false,
        majorityCustomReplacementEconomicallyPlausibleBy2033: true,
        migrationComplexityPrimaryBarrier: false,
      },
    });
    const result = scoreFutureResilience(input);
    expect(result.criteria[0]!.score).toBe(2);
    expect(result.criteria[1]!.score).toBe(3);
    expect(result.gates).not.toContain('customer_owned_workflow_replacement');
    expect(result.criteria[4]!.audit.regulatedExecutionServiceCandidate).toBe(true);

    input.criteria.future_control.futureRentPaid = false;
    expect(scoreFutureResilience(input).criteria[0]!.score).toBe(0);
  });

  it('garde un controle reglemente etroit quand la barriere est prouvee mais la rente inconnue', () => {
    const input = fixture();
    Object.assign(input.criteria.future_control, {
      controlType: 'regulated_execution_capability',
      controlStillNeeded: true,
      companySpecific: true,
      majorityCoreCoverage: null,
      scarcitySurvivesAiChina: false,
      replicableWithinFiveYears: true,
      futureRentPaid: null,
      systemBottleneck: false,
      multipleIndependentControls: false,
    });
    expect(scoreFutureResilience(input).criteria[0]!.score).toBe(1);
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
      coreReconfigurableWithinScenario: false,
      adaptationLeadTimeFits: false,
      legacyConstraintManageable: false,
    });
    const result = scoreFutureResilience(input);
    expect(result.criteria[5]!.score).toBe(0);
    expect(result.finalScore).toBe(79);
    expect(result.grade).toBe('B');
    expect(result.gates).toContain('future_a_eligibility');
  });

  it('ne donne aucun point de transition pour la seule capacite financiere actuelle en legacy', () => {
    const input = fixture();
    input.criteria.transition_capacity = {
      fundingCapacity: true,
      scaledAdaptationEvidence: false,
      scaledAdaptationType: 'none',
      measuredOperatingEffect: false,
      monetizedMaterialOutcome: false,
      outcomeCausallyAttributedToAdaptation: false,
      legacyConstraintManageable: null,
      ...common,
    } as unknown as typeof input.criteria.transition_capacity;
    const result = scoreFutureResilience(input);
    expect(result.criteria[5]!.score).toBe(0);
    expect(result.criteria[5]!.audit.fundingCapacityScoresDirectly).toBe(false);
  });

  it('preserve le contrat legacy pour une annonce ou un pilote', () => {
    const input = fixture();
    input.criteria.transition_capacity = {
      fundingCapacity: true,
      scaledAdaptationEvidence: true,
      scaledAdaptationType: 'announcement_or_pilot',
      measuredOperatingEffect: false,
      monetizedMaterialOutcome: false,
      outcomeCausallyAttributedToAdaptation: false,
      legacyConstraintManageable: true,
      ...common,
    } as unknown as typeof input.criteria.transition_capacity;
    const result = scoreFutureResilience(input);
    expect(result.criteria[5]!.score).toBe(1);
    expect(result.criteria[5]!.audit.scaledAdaptationEvidence).toBe(false);
  });

  it('note la capacite future sans exiger un deploiement actuel', () => {
    const input = fixture();
    Object.assign(input.criteria.transition_capacity, {
      adaptationLeversSurviveScenario: true,
      coreReconfigurableWithinScenario: true,
      adaptationLeadTimeFits: true,
      legacyConstraintManageable: true,
    });
    const result = scoreFutureResilience(input);
    expect(result.criteria[5]!.score).toBe(2);
    expect(result.criteria[5]!.audit.currentDeploymentScoresDirectly).toBe(false);
  });

  it('garde un point quand la projection d adaptation reste mixte', () => {
    const input = fixture();
    Object.assign(input.criteria.transition_capacity, {
      adaptationLeversSurviveScenario: true,
      coreReconfigurableWithinScenario: null,
      adaptationLeadTimeFits: false,
      legacyConstraintManageable: true,
    });
    const result = scoreFutureResilience(input);
    expect(result.criteria[5]!.score).toBe(1);
  });

  it('reserve la transition maximale a un levier futur specifique et non partage', () => {
    const input = fixture();
    Object.assign(input.criteria.transition_capacity, {
      futureDifferentiatedAdaptationContract: true,
      adaptationAdvantageType: 'modular_physical_architecture',
      companySpecificAdaptationLevers: true,
      adaptationMechanismCoversMajorityCore: true,
      competitorsCanAccessSameLevers: true,
    });
    expect(scoreFutureResilience(input).criteria[5]!.score).toBe(1);

    input.criteria.transition_capacity.competitorsCanAccessSameLevers = false;
    const differentiated = scoreFutureResilience(input);
    expect(differentiated.criteria[5]!.score).toBe(2);
    expect(differentiated.criteria[5]!.audit.differentiatedAdaptation).toBe(true);
  });

  it('refuse A face a deux chocs existentiels non fortement mitiges', () => {
    const input = fixture();
    input.criteria.future_control.systemBottleneck = true;
    (input.criteria.future_dependencies as { clusters: Array<Record<string, unknown>> }).clusters = [
      { name: 'Pays operatoire', material: true, continuityImpact: 'existential', mitigation: 'medium', coreContinuityAtRisk: true },
      { name: 'Technologie critique', material: true, continuityImpact: 'existential', mitigation: 'medium', coreContinuityAtRisk: true },
    ];
    const result = scoreFutureResilience(input);
    expect(result.finalScore).toBe(79);
    expect(result.grade).toBe('B');
    expect(result.gates).toContain('concentrated_continuity_dependencies');

    Object.assign(input.criteria.future_control, { controlType: 'installed_base' });
    const diversifiedPhysicalOperator = scoreFutureResilience(input);
    expect(diversifiedPhysicalOperator.gates).not.toContain('concentrated_continuity_dependencies');
    expect(diversifiedPhysicalOperator.criteria[2]!.score).toBe(0);
    expect(diversifiedPhysicalOperator.grade).toBe('B');
  });

  it('note C un role paye futur sans controle durable', () => {
    const input = fixture();
    Object.assign(input.criteria.future_control, {
      controlType: 'none', controlStillNeeded: false, companySpecific: false,
      majorityCoreCoverage: false, scarcitySurvivesAiChina: false,
      replicableWithinFiveYears: true, futureRentPaid: false,
    });
    const result = scoreFutureResilience(input);
    expect(result.criteria[4]!.score).toBe(1);
    expect(result.criteria[4]!.audit.captureLimitedByNarrowControl).toBe(true);
    expect(result.finalScore).toBe(63);
    expect(result.grade).toBe('C');
  });

  it('penalise uniquement une rupture avec voie majoritaire technique et economique', () => {
    const input = fixture();
    Object.assign(input.criteria.disruption_positioning.forces[1]!, {
      materialDirectBenefit: false,
      responseControlsOutcome: false,
      benefitMechanism: 'none',
    });
    const ai = input.criteria.disruption_positioning.forces[0]!;
    ai.majorityCoreThreatPath = true;
    ai.technicalAndEconomicPath = false;
    ai.responseControlsOutcome = false;
    expect(scoreFutureResilience(input).criteria[1]!.score).toBe(2);
    ai.technicalAndEconomicPath = true;
    expect(scoreFutureResilience(input).criteria[1]!.score).toBe(1);
  });

  it('audite une pression future partielle sans la confondre avec une rupture majoritaire', () => {
    const input = fixture();
    for (const force of input.criteria.disruption_positioning.forces) {
      Object.assign(force, {
        materialDirectBenefit: false,
        responseControlsOutcome: false,
        benefitMechanism: 'none',
      });
    }
    Object.assign(input.criteria.disruption_positioning.forces[0]!, {
      majorityCoreThreatPath: false,
      technicalAndEconomicPath: true,
      materialPressure: true,
    });
    const result = scoreFutureResilience(input);
    expect(result.criteria[1]!.score).toBe(2);
    expect((result.criteria[1]!.audit.forces as Array<{ verdict: string }>)[0]!.verdict).toBe('pressure');
  });

  it('ne penalise pas une voie plausible dont l impact futur reste non materiel', () => {
    const input = fixture();
    Object.assign(input.criteria.disruption_positioning.forces[0]!, {
      majorityCoreThreatPath: false,
      technicalAndEconomicPath: true,
      materialPressure: false,
      materialDirectBenefit: false,
      responseControlsOutcome: false,
      benefitMechanism: 'none',
    });
    const result = scoreFutureResilience(input);
    expect(result.criteria[1]!.score).toBe(3);
    expect((result.criteria[1]!.audit.forces as Array<{ verdict: string }>)[0]!.verdict).toBe('neutral');
  });

  it('conserve les deux faces materielles d une meme force comme effet mixte', () => {
    const input = fixture();
    Object.assign(input.criteria.disruption_positioning.forces[0]!, {
      majorityCoreThreatPath: false,
      technicalAndEconomicPath: true,
      materialPressure: true,
      materialDirectBenefit: true,
      responseControlsOutcome: false,
      benefitMechanism: 'external_demand_expansion',
    });
    Object.assign(input.criteria.disruption_positioning.forces[1]!, {
      materialDirectBenefit: false,
      responseControlsOutcome: false,
      benefitMechanism: 'none',
    });
    const result = scoreFutureResilience(input);
    expect(result.criteria[1]!.score).toBe(2);
    expect((result.criteria[1]!.audit.forces as Array<{ verdict: string }>)[0]!.verdict).toBe('mixed');
    expect(result.criteria[1]!.audit.mixedForces).toBe(1);
  });

  it('penalise deux pressions futures materielles non controlees', () => {
    const input = fixture();
    for (const force of input.criteria.disruption_positioning.forces) {
      Object.assign(force, {
        materialDirectBenefit: false,
        responseControlsOutcome: false,
        benefitMechanism: 'none',
      });
    }
    for (const force of input.criteria.disruption_positioning.forces.slice(0, 2)) {
      Object.assign(force, {
        majorityCoreThreatPath: false, technicalAndEconomicPath: true, materialPressure: true,
      });
    }
    expect(scoreFutureResilience(input).criteria[1]!.score).toBe(1);
  });

  it('derive une pression agentique pour un role commoditise sans controle', () => {
    const input = fixture();
    Object.assign(input.criteria.future_control, {
      controlType: 'none', controlStillNeeded: false, companySpecific: false,
      majorityCoreCoverage: true, scarcitySurvivesAiChina: false,
      replicableWithinFiveYears: true, futureRentPaid: false,
    });
    Object.assign(input.criteria.future_value_capture, {
      roleArchetype: 'other', agentsNeedControlledAccess: false,
      companySpecificControl: false, aiPriceCommoditization: true,
      aiPriceCommoditizationCoversMajorityCore: false,
    });
    for (const force of input.criteria.disruption_positioning.forces) {
      Object.assign(force, {
        materialDirectBenefit: false,
        responseControlsOutcome: false,
        benefitMechanism: 'none',
      });
    }
    const result = scoreFutureResilience(input);
    expect(result.criteria[1]!.score).toBe(1);
    expect((result.criteria[1]!.audit.forces as Array<{ derivedUncontrolledAgenticPressure: boolean }>)[0]!
      .derivedUncontrolledAgenticPressure).toBe(true);
  });

  it('reconnait une expansion externe directe sans exiger que l entreprise controle la force macro', () => {
    const input = fixture();
    Object.assign(input.criteria.disruption_positioning.forces[1]!, {
      materialDirectBenefit: false,
      responseControlsOutcome: false,
      benefitMechanism: 'none',
    });
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

  it('accorde 3 sur 3 a un avantage structurel specifique aligne avec une demande majoritaire', () => {
    const input = fixture();
    Object.assign(input.criteria.disruption_positioning.forces[0]!, {
      materialDirectBenefit: false,
      responseControlsOutcome: false,
      benefitMechanism: 'none',
    });
    const result = scoreFutureResilience(input);
    expect(result.criteria[1]!.score).toBe(3);
    expect(result.criteria[1]!.audit.companySpecificStructuralAdvantage).toBe(true);
  });

  it('ne bonifie pas un avantage specifique lorsque la demande structurelle n est pas maximale', () => {
    const input = fixture();
    Object.assign(input.criteria.disruption_positioning.forces[0]!, {
      materialDirectBenefit: false,
      responseControlsOutcome: false,
      benefitMechanism: 'none',
    });
    Object.assign(input.criteria.structural_demand, { futureCategoryTrend: 'stable' });
    expect(scoreFutureResilience(input).criteria[1]!.score).toBe(2);
  });

  it('ne transforme pas une simple expansion externe de demande en avantage structurel specifique', () => {
    const input = fixture();
    Object.assign(input.criteria.disruption_positioning.forces[1]!, {
      materialDirectBenefit: false,
      responseControlsOutcome: false,
      benefitMechanism: 'none',
    });
    expect(scoreFutureResilience(input).criteria[1]!.score).toBe(2);
  });

  it('reconnait la capture d un operateur physique par leadership de cout specifique', () => {
    const input = fixture();
    Object.assign(input.criteria.future_control, {
      controlType: 'cost_supply_chain',
      scarcitySurvivesAiChina: false,
      replicableWithinFiveYears: true,
      futureRentPaid: false,
    });
    Object.assign(input.criteria.future_value_capture, {
      roleArchetype: 'physical_product_operator',
      agentsNeedControlledAccess: false,
      credibleMajorityBypass: true,
      aiPriceCommoditization: true,
      aiPriceCommoditizationCoversMajorityCore: false,
    });
    const result = scoreFutureResilience(input);
    expect(result.criteria.map(criterion => criterion.score)).toEqual([1, 3, 2, 2, 2, 2]);
    expect(result.criteria[0]!.reason).toContain('contrôle industriel étroit');
    expect(result.criteria[4]!.reason).toContain('volumes, des parts de marché');
    expect(result.criteria[0]!.audit.physicalCostLeadershipFloor).toBe(true);
    expect(result.criteria[4]!.audit.physicalCostLeadershipCapture).toBe(true);
  });

  it('ne bonifie pas un fabricant sans controle specifique de son avantage de cout', () => {
    const input = fixture();
    Object.assign(input.criteria.future_control, {
      controlType: 'cost_supply_chain',
      scarcitySurvivesAiChina: false,
      replicableWithinFiveYears: true,
      futureRentPaid: false,
    });
    Object.assign(input.criteria.future_value_capture, {
      roleArchetype: 'physical_product_operator',
      agentsNeedControlledAccess: false,
      credibleMajorityBypass: true,
      companySpecificControl: false,
      aiPriceCommoditization: true,
      aiPriceCommoditizationCoversMajorityCore: false,
    });
    const result = scoreFutureResilience(input);
    expect(result.criteria[0]!.score).toBe(0);
    expect(result.criteria[4]!.score).toBe(1);
  });

  it('ne bonifie pas un leader de cout expose a une force negative majoritaire', () => {
    const input = fixture();
    Object.assign(input.criteria.future_control, {
      controlType: 'cost_supply_chain',
      scarcitySurvivesAiChina: false,
      replicableWithinFiveYears: true,
      futureRentPaid: false,
    });
    Object.assign(input.criteria.future_value_capture, {
      roleArchetype: 'physical_product_operator',
      agentsNeedControlledAccess: false,
      credibleMajorityBypass: true,
      aiPriceCommoditization: true,
      aiPriceCommoditizationCoversMajorityCore: false,
    });
    Object.assign(input.criteria.disruption_positioning.forces[2]!, {
      majorityCoreThreatPath: true,
      technicalAndEconomicPath: true,
    });
    const result = scoreFutureResilience(input);
    expect(result.criteria[0]!.score).toBe(0);
    expect(result.criteria[4]!.score).toBe(1);
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
        mitigation: 'unproven', coreContinuityAtRisk: true,
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
        mitigation: 'medium', coreContinuityAtRisk: true,
      }],
    });
    expect(scoreFutureResilience(input).criteria[2]!.score).toBe(1);
    Object.assign(input.criteria.future_dependencies, {
      clusters: [{
        name: 'Dependance materielle', material: true, continuityImpact: 'material_impairment',
        mitigation: 'strong', coreContinuityAtRisk: true,
      }],
    });
    expect(scoreFutureResilience(input).criteria[2]!.score).toBe(2);
  });

  it('ne transforme pas trois risques ordinaires en menace de continuite du coeur', () => {
    const input = fixture();
    Object.assign(input.criteria.future_dependencies, {
      coverageComplete: true,
      clusters: ['Pays', 'Fournisseur', 'Travail'].map(name => ({
        name, material: true, continuityImpact: 'material_impairment', mitigation: 'medium',
        coreContinuityAtRisk: false,
      })),
    });
    const result = scoreFutureResilience(input);
    expect(result.criteria[2]!.score).toBe(2);
    expect(result.criteria[2]!.audit.nonStrongMaterialShocks).toBe(3);
  });

  it('note zero deux chocs non mitiges menacant la continuite du coeur', () => {
    const input = fixture();
    Object.assign(input.criteria.future_dependencies, {
      coverageComplete: true,
      clusters: ['Pays', 'Infrastructure'].map(name => ({
        name, material: true, continuityImpact: 'material_impairment', mitigation: 'none',
        coreContinuityAtRisk: true,
      })),
    });
    const result = scoreFutureResilience(input);
    expect(result.criteria[2]!.score).toBe(0);
    expect(result.criteria[2]!.audit.unmitigatedCoreContinuityShocks).toBe(2);
  });

  it('deduplique deux manifestations du meme choc de continuite', () => {
    const input = fixture();
    Object.assign(input.criteria.future_dependencies, {
      futureShockGroupContract: true,
      coverageComplete: true,
      clusters: [
        {
          name: 'Retrait du droit d operer', shockGroup: 'state_access', material: true,
          continuityImpact: 'existential', mitigation: 'none', coreContinuityAtRisk: true,
        },
        {
          name: 'Coupure reseau par le meme Etat', shockGroup: 'state_access', material: true,
          continuityImpact: 'existential', mitigation: 'none', coreContinuityAtRisk: true,
        },
      ],
    });
    const deduplicated = scoreFutureResilience(input);
    expect(deduplicated.criteria[2]!.score).toBe(1);
    expect(deduplicated.criteria[2]!.audit.independentShockCount).toBe(1);

    input.criteria.future_dependencies.clusters[1]!.shockGroup = 'independent_network_failure';
    expect(scoreFutureResilience(input).criteria[2]!.score).toBe(0);
  });
});
