import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deriveLifecycle,
  hasCurrentResponseAction,
  isQualifyingResponseEvent,
  lifecycleColor,
  publicDiscussionIncidentId,
  type LifecycleFacts,
  mayorLabel,
  officialLabel,
  type PrimaryStage,
  RESIDENT_STAGE_TONES,
  residentLabel,
  residentProgressSteps,
  residentStageTone,
  residentStepTone,
} from '../lib/reportLifecycle.ts';
import { colors } from '../styles/theme.ts';
import { formatOperationTimestamp } from '../lib/formatTime.ts';
import {
  intakeJurisdiction,
  isInsideReportCoverage,
} from '../supabase/functions/_shared/report-coverage.ts';

test('resident progress restores connected milestones without inventing response history', () => {
  const confirmedSteps = residentProgressSteps({ primaryStage: 'confirmed', coordinationBadge: null, summaryMissing: false });
  assert.deepEqual(confirmedSteps.map((step) => step.label), ['Received', 'Confirmed', 'Response ongoing', 'Resolved']);
  assert.equal(confirmedSteps[0].complete, true);
  assert.equal(confirmedSteps[1].current, true);
  assert.equal(confirmedSteps[2].complete, false);
  const resolvedSteps = residentProgressSteps({ primaryStage: 'resolved', coordinationBadge: null, summaryMissing: false });
  assert.equal(resolvedSteps.some((step) => step.label === 'Response ongoing' && step.complete), false);
  assert.equal(resolvedSteps.at(-1)?.current, true);
  const legacySteps = residentProgressSteps({ primaryStage: 'resolved', coordinationBadge: null, summaryMissing: true });
  assert.equal(legacySteps.some((step) => step.label === 'Confirmed'), false);
  const assessmentSteps = residentProgressSteps({ primaryStage: 'being_assessed', coordinationBadge: null, summaryMissing: false });
  assert.equal(assessmentSteps.some((step) => step.label === 'Confirmed' && step.complete), false);
  const publicSteps = residentProgressSteps({ primaryStage: 'withdrawn', coordinationBadge: null, summaryMissing: false }, 'public');
  assert.deepEqual(publicSteps.map((step) => step.label), ['Reported', 'Confirmed', 'Correction posted']);
  const publicResolved = residentProgressSteps({ primaryStage: 'resolved', coordinationBadge: null, summaryMissing: false }, 'public');
  assert.deepEqual(publicResolved.map((step) => step.label), ['Reported', 'Confirmed', 'Response ongoing', 'Resolved']);
});

test('resident map discussion opens only after confirmation and stays closed after withdrawal', () => {
  const caseId = 'a2000000-0000-4000-8000-000000000001';
  const lifecycle = (primaryStage: PrimaryStage) => ({
    primaryStage,
    coordinationBadge: null,
    summaryMissing: false,
  });

  assert.equal(publicDiscussionIncidentId(caseId, lifecycle('awaiting_review')), null);
  assert.equal(publicDiscussionIncidentId(caseId, lifecycle('being_assessed')), null);
  assert.equal(publicDiscussionIncidentId(caseId, lifecycle('withdrawn')), null);
  assert.equal(publicDiscussionIncidentId(caseId, lifecycle('confirmed')), caseId);
  assert.equal(publicDiscussionIncidentId(caseId, lifecycle('response_ongoing')), caseId);
  assert.equal(publicDiscussionIncidentId(caseId, lifecycle('resolved')), caseId);
  assert.equal(publicDiscussionIncidentId(null, lifecycle('confirmed')), null);
  assert.equal(publicDiscussionIncidentId(caseId, undefined), null);
});

test('resident stage colors are distinct per milestone and readable on their soft fill', () => {
  const summary = (primaryStage: PrimaryStage) => ({ primaryStage, coordinationBadge: null, summaryMissing: false });
  const stages: PrimaryStage[] = ['under_review', 'being_assessed', 'confirmed', 'response_ongoing', 'resolved', 'withdrawn', 'not_confirmed'];
  const stageColors = stages.map((stage) => residentStageTone(summary(stage)).color);
  assert.equal(new Set(stageColors).size, stages.length);
  const stepColors = ['Received', 'Confirmed', 'Response ongoing', 'Resolved'].map((label) => residentStepTone(label).color);
  assert.equal(new Set(stepColors).size, 4);
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255)
      .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  for (const tone of Object.values(RESIDENT_STAGE_TONES)) {
    const contrast = (luminance(tone.softColor) + 0.05) / (luminance(tone.color) + 0.05);
    assert.ok(contrast >= 4.5, `${tone.color} on ${tone.softColor} has contrast ${contrast.toFixed(2)}`);
  }
});

const baseFacts: LifecycleFacts = {
  status: 'unverified',
  reviewOutcome: 'pending',
  reviewClaimedByName: null,
  reviewClaimedAt: null,
  jurisdictionStatus: 'in_coverage',
  incidentVerification: null,
  incidentState: null,
  coordination: null,
  leadOffice: null,
  municipalFinding: null,
  hasQualifyingResponseAction: false,
  legacyResolution: false,
  withdrawn: false,
  legacyEscalation: false,
};
const confirmed: Partial<LifecycleFacts> = {
  status: 'verified',
  reviewOutcome: 'verified',
  incidentVerification: 'confirmed',
  incidentState: 'active',
  coordination: 'local',
  leadOffice: 'barangay',
};
const municipal: Partial<LifecycleFacts> = {
  ...confirmed,
  coordination: 'municipal_lead',
  leadOffice: 'municipal',
  municipalFinding: 'confirmed',
};
const context = { barangayName: 'Tunghaan' };
const claimContext = {
  claimedByName: 'Officer A',
  claimedAt: '2026-10-30T08:00:00Z',
};

// The plan's facts-to-label acceptance table is intentionally independent of
// compatibility status: several distinct outcomes share the same old status.
const labelCases: {
  row: number;
  facts: Partial<LifecycleFacts>;
  resident: string;
  official: string;
  mayor: string;
}[] = [
  {
    row: 1,
    facts: {},
    resident: 'Awaiting barangay review',
    official: 'Needs review',
    mayor: 'Awaiting Brgy. Tunghaan review',
  },
  {
    row: 2,
    facts: {
      reviewClaimedByName: 'Officer A',
      reviewClaimedAt: claimContext.claimedAt,
    },
    resident: 'Under review',
    official: `Under review by Officer A · since ${formatOperationTimestamp(claimContext.claimedAt)}`,
    mayor: 'Under review at Brgy. Tunghaan',
  },
  {
    row: 3,
    facts: { jurisdictionStatus: 'needs_check' },
    resident: 'Checking which office covers this location',
    official: 'Jurisdiction check (MDRRMO)',
    mayor: 'Jurisdiction check',
  },
  {
    row: 4,
    facts: {
      reviewOutcome: 'needs_assessment',
      incidentVerification: 'pending',
      incidentState: 'active',
    },
    resident: 'Being assessed',
    official: 'Being assessed',
    mayor: 'Being assessed',
  },
  {
    row: 5,
    facts: confirmed,
    resident: 'Confirmed',
    official: 'Confirmed · no response action recorded',
    mayor: 'Confirmed · awaiting response action',
  },
  {
    row: 6,
    facts: { ...confirmed, hasQualifyingResponseAction: true },
    resident: 'Response ongoing',
    official: 'Response ongoing (local)',
    mayor: 'Brgy. Tunghaan response ongoing',
  },
  {
    row: 7,
    facts: { ...confirmed, coordination: 'support_requested' },
    resident: 'Confirmed',
    official: 'Support requested · awaiting MDRRMO',
    mayor: 'MDRRMO support requested',
  },
  {
    row: 8,
    facts: { ...confirmed, coordination: 'support_active' },
    resident: 'Confirmed',
    official: 'MDRRMO supporting',
    mayor: 'Brgy. Tunghaan lead · MDRRMO supporting',
  },
  {
    row: 9,
    facts: {
      ...confirmed,
      status: 'escalated',
      coordination: 'transfer_requested',
    },
    resident:
      'Forwarded to MDRRMO — Brgy. Tunghaan remains responsible until MDRRMO accepts',
    official: 'Forwarded · awaiting MDRRMO acceptance',
    mayor: 'Forwarded to municipal',
  },
  {
    row: 10,
    facts: { ...municipal, municipalFinding: null, status: 'escalated' },
    resident: 'Municipal review — MDRRMO is now responsible',
    official: 'Municipal review · finding needed',
    mayor: 'Awaiting municipal finding',
  },
  {
    row: 11,
    facts: municipal,
    resident: 'Confirmed — MDRRMO responsible',
    official: 'Confirmed (MDRRMO) · no response action recorded',
    mayor: 'Municipal · awaiting response action',
  },
  {
    row: 12,
    facts: { ...municipal, hasQualifyingResponseAction: true },
    resident: 'Response ongoing (MDRRMO)',
    official: 'Response ongoing (municipal)',
    mayor: 'Municipal response ongoing',
  },
  {
    row: 13,
    facts: { ...confirmed, status: 'resolved', incidentState: 'resolved' },
    resident: 'Resolved',
    official: 'Resolved',
    mayor: 'Resolved',
  },
  {
    row: 14,
    facts: {
      ...confirmed,
      status: 'resolved',
      incidentState: 'resolved',
      legacyResolution: true,
    },
    resident: 'Resolved — the office has not posted an outcome summary yet',
    official: 'Resolved · summary missing (action needed)',
    mayor: 'Resolved · summary missing',
  },
  {
    row: 15,
    facts: {
      ...municipal,
      status: 'closed',
      incidentState: 'closed',
      incidentVerification: 'not_confirmed',
      municipalFinding: 'not_confirmed',
      withdrawn: true,
    },
    resident: 'Withdrawn after municipal review',
    official: 'Withdrawn · correction posted',
    mayor: 'Withdrawn',
  },
  {
    row: 16,
    facts: {
      status: 'closed',
      reviewOutcome: 'needs_assessment',
      incidentState: 'closed',
      incidentVerification: 'not_confirmed',
    },
    resident: 'Not confirmed',
    official: 'Closed — not confirmed',
    mayor: 'Not confirmed',
  },
  {
    row: 17,
    facts: { status: 'closed', reviewOutcome: 'could_not_confirm' },
    resident: 'Could not be confirmed — send a new report if conditions change',
    official: 'Closed — could not confirm',
    mayor: 'Could not be confirmed — send a new report if conditions change',
  },
  {
    row: 18,
    facts: { status: 'closed', reviewOutcome: 'rejected' },
    resident: 'Not accepted',
    official: 'Closed — rejected',
    mayor: 'Not accepted',
  },
  {
    row: 19,
    facts: {
      status: 'closed',
      jurisdictionStatus: 'outside_coverage',
      reviewOutcome: 'outside_coverage',
    },
    resident: 'Outside DisasterLink coverage — not forwarded to any office',
    official: 'Closed — outside coverage',
    mayor: 'Outside DisasterLink coverage — not forwarded to any office',
  },
  {
    row: 20,
    facts: { reviewOutcome: 'linked' },
    resident: 'Added to an existing incident',
    official: 'Linked to incident',
    mayor: 'Added to an existing incident',
  },
  {
    row: 21,
    facts: {
      ...confirmed,
      coordination: 'transfer_requested',
      legacyEscalation: true,
    },
    resident: 'Forwarded to MDRRMO',
    official: 'Legacy escalation · MDRRMO acceptance not recorded',
    mayor: 'Forwarded (legacy)',
  },
  {
    row: 22,
    facts: { ...municipal, legacyHandoff: true },
    resident: 'Confirmed — MDRRMO responsible',
    official:
      'Legacy handoff · MDRRMO re-verified; separate acceptance not recorded',
    mayor: 'Municipal (legacy handoff)',
  },
];

for (const scenario of labelCases) {
  test(`plan table row ${scenario.row}: labels reflect the recorded facts`, () => {
    const summary = deriveLifecycle({ ...baseFacts, ...scenario.facts });
    assert.equal(residentLabel(summary, context), scenario.resident);
    assert.equal(officialLabel(summary, claimContext), scenario.official);
    assert.equal(mayorLabel(summary, context), scenario.mayor);
    assert.ok(Object.values(colors).includes(lifecycleColor(summary)));
  });
}

for (
  const event of [
    'hotline_contacted',
    'assistance_requested',
    'reporter_call',
    'external_info',
    'internal_note',
    'progress_update',
  ]
) {
  test(`${event} alone never means response ongoing`, () => {
    assert.equal(isQualifyingResponseEvent(event), false);
    const summary = deriveLifecycle({
      ...baseFacts,
      ...confirmed,
      hasQualifyingResponseAction: isQualifyingResponseEvent(event),
    });
    assert.equal(summary.primaryStage, 'confirmed');
    assert.doesNotMatch(residentLabel(summary, context), /Response ongoing/);
  });
}
for (
  const event of [
    'dispatch_confirmed',
    'responders_on_site',
    'assistance_given',
    'work_done',
  ]
) {
  test(`${event} qualifies without confirming a provisional assessment`, () => {
    assert.equal(isQualifyingResponseEvent(event), true);
    const summary = deriveLifecycle({
      ...baseFacts,
      incidentVerification: 'pending',
      hasQualifyingResponseAction: true,
    });
    assert.equal(summary.primaryStage, 'being_assessed');
  });
}
test('a claim never confirms; requests never imply acceptance', () => {
  assert.equal(
    deriveLifecycle({ ...baseFacts, reviewClaimedAt: claimContext.claimedAt })
      .primaryStage,
    'under_review',
  );
  assert.doesNotMatch(
    officialLabel(
      deriveLifecycle({
        ...baseFacts,
        ...confirmed,
        coordination: 'support_requested',
      }),
      claimContext,
    ),
    /MDRRMO supporting/,
  );
  assert.doesNotMatch(
    residentLabel(
      deriveLifecycle({
        ...baseFacts,
        ...confirmed,
        coordination: 'transfer_requested',
      }),
      context,
    ),
    /Municipal review/,
  );
});
test('every reporter call outcome still requires separate verification and response evidence', () => {
  for (
    const outcome of ['reached', 'no_answer', 'call_failed', 'not_recorded']
  ) {
    assert.equal(isQualifyingResponseEvent('reporter_call'), false, outcome);
    assert.equal(
      deriveLifecycle(baseFacts).primaryStage,
      'awaiting_review',
      outcome,
    );
  }
});
test('old responses fall back to each compatibility status safely', () => {
  for (
    const [status, stage] of [
      ['unverified', 'awaiting_review'],
      ['verified', 'confirmed'],
      ['escalated', 'confirmed'],
      ['resolved', 'resolved'],
      ['closed', 'not_confirmed'],
    ] as const
  ) {
    assert.equal(
      deriveLifecycle({
        ...baseFacts,
        status,
        reviewOutcome: null,
        jurisdictionStatus: null,
      }).primaryStage,
      stage,
    );
  }
  assert.equal(
    deriveLifecycle({ ...baseFacts, isQueuedLocally: true }).primaryStage,
    'sending',
  );
});
test('a reopened assessment keeps its correction without falsely labelling it withdrawn', () => {
  assert.equal(
    deriveLifecycle({
      ...baseFacts,
      incidentState: 'active',
      incidentVerification: 'pending',
      withdrawn: true,
    }).primaryStage,
    'being_assessed',
  );
});
test('a linked report follows its incident once case facts are present', () => {
  assert.equal(
    deriveLifecycle({
      ...baseFacts,
      ...confirmed,
      reviewOutcome: 'linked',
      incidentState: 'resolved',
    }).primaryStage,
    'resolved',
  );
});

test('municipal lead and reopened cases need response actions in the current response period', () => {
  const earlierAction = {
    eventType: 'dispatch_confirmed',
    occurredAt: '2026-10-30T08:00:00Z',
  };
  const transfer = {
    eventType: 'transfer_accepted',
    occurredAt: '2026-10-30T09:00:00Z',
  };
  const municipalAction = {
    eventType: 'responders_on_site',
    occurredAt: '2026-10-30T09:05:00Z',
  };
  assert.equal(hasCurrentResponseAction([earlierAction], 'barangay'), true);
  assert.equal(
    hasCurrentResponseAction([earlierAction, transfer], 'municipal'),
    false,
  );
  assert.equal(
    hasCurrentResponseAction(
      [earlierAction, transfer, municipalAction],
      'municipal',
    ),
    true,
  );
  assert.equal(
    hasCurrentResponseAction([earlierAction, {
      ...transfer,
      eventType: 'reopened',
    }], 'barangay'),
    false,
  );
});

test('coverage bounds reject outside/non-finite coordinates and include the boundary', () => {
  assert.equal(isInsideReportCoverage(10.25, 123.8), true);
  assert.equal(isInsideReportCoverage(10.15, 123.7), true);
  assert.equal(isInsideReportCoverage(10.149, 123.8), false);
  assert.equal(isInsideReportCoverage(10.25, 123.901), false);
  assert.equal(isInsideReportCoverage(NaN, 123.8), false);
});
test('centroid routing sends distant or mismatched selected locations for jurisdiction only', () => {
  const route = {
    nearestDistanceMeters: 100,
    selectedDistanceMeters: 100,
    selectedBarangayId: 'a',
    nearestBarangayId: 'a',
  };
  assert.equal(intakeJurisdiction(route), 'in_coverage');
  assert.equal(
    intakeJurisdiction({ ...route, nearestDistanceMeters: 1500 }),
    'in_coverage',
  );
  assert.equal(
    intakeJurisdiction({ ...route, nearestDistanceMeters: 1501 }),
    'needs_check',
  );
  assert.equal(
    intakeJurisdiction({
      ...route,
      selectedBarangayId: 'b',
      selectedDistanceMeters: 1800,
    }),
    'needs_check',
  );
  assert.equal(
    intakeJurisdiction({
      ...route,
      selectedBarangayId: 'b',
      selectedDistanceMeters: 200,
    }),
    'in_coverage',
  );
  assert.equal(
    intakeJurisdiction({ ...route, nearestDistanceMeters: null }),
    'needs_check',
  );
});
