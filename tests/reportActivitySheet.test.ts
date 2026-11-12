import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import {
  createActivitySubmissionId,
  responseServiceIdentity,
  responseServiceLabel,
} from '../lib/reportContactFlow.ts';
import { colors } from '../styles/theme.ts';

import type ResponseEventSheet from '../components/official/ResponseEventSheet';

type SheetProps = Parameters<typeof ResponseEventSheet>[0];
type PreviewNode = { type: unknown; props: Record<string, unknown> };

function loadActivitySheet(options: {
  target?: SheetProps['target'];
  initialType?: SheetProps['initialType'];
  initialDetails?: Record<string, string>;
  saveError?: string;
  saveErrors?: (string | null)[];
  delaySave?: boolean;
} = {}) {
  const slots: unknown[] = [];
  let cursor = 0;
  let closed = 0;
  const saved: { rpc: string; input: Record<string, unknown> }[] = [];
  const completions: Record<string, unknown>[] = [];
  const dialogs: {
    title: string;
    buttons: { text: string; onPress?: () => void }[];
  }[] = [];
  let releaseSave: (() => void) | undefined;
  const saveDelay = options.delaySave
    ? new Promise<void>((resolve) => {
      releaseSave = resolve;
    })
    : Promise.resolve();
  function createElement(
    type: unknown,
    props: Record<string, unknown> | null,
    ...children: unknown[]
  ): PreviewNode {
    return { type, props: { ...props, children } };
  }
  const react = {
    __esModule: true,
    default: { createElement, Fragment: 'Fragment' },
    useState(initial: unknown) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], (next: unknown) => {
        slots[index] = typeof next === 'function' ? next(slots[index]) : next;
      }];
    },
    useRef(initial: unknown) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
  };
  async function save(rpc: string, input: Record<string, unknown>) {
    saved.push({ rpc, input: JSON.parse(JSON.stringify(input)) });
    const attempt = saved.length - 1;
    await saveDelay;
    return {
      error: options.saveErrors?.[attempt] ?? options.saveError ?? null,
    };
  }
  const dependencies: Record<string, unknown> = {
    react,
    'react-native': {
      Text: 'Text',
      View: 'View',
      TouchableOpacity: 'TouchableOpacity',
      Alert: {
        alert: (
          title: string,
          _message: string,
          buttons: { text: string; onPress?: () => void }[],
        ) => dialogs.push({ title, buttons }),
      },
    },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    '../../styles/theme': { colors },
    '../../lib/officialReports': {
      logReportContact: (input: Record<string, unknown>) =>
        save('report', input),
    },
    '../../lib/incidentCases': {
      logIncidentEvent: (input: Record<string, unknown>) =>
        save('incident', input),
    },
    '../../lib/reportContactFlow': {
      createActivitySubmissionId,
      responseServiceIdentity,
      responseServiceLabel,
    },
    '../../styles/screens/official.styles': { officialStyles: {} },
    '../../styles/components/reportOperations.styles': {
      reportOperationsStyles: {},
    },
    './ResourceFormSheet': { __esModule: true, default: 'ResourceFormSheet' },
    './WorkflowForm': Object.fromEntries(
      [
        'WorkflowActionRow',
        'WorkflowButton',
        'WorkflowChoices',
        'WorkflowFeedback',
        'WorkflowNote',
      ].map((name) => [name, name]),
    ),
  };
  const compiled = ts.transpileModule(
    readFileSync(
      new URL('../components/official/ResponseEventSheet.tsx', import.meta.url),
      'utf8',
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.React,
        esModuleInterop: true,
      },
    },
  );
  const exports: Record<string, unknown> = {};
  // Exercise the real form handlers and authenticated-RPC choice. Native view
  // components are inert nodes, so these tests never open a modal or write data.
  runInNewContext(compiled.outputText, {
    exports,
    module: { exports },
    require(name: string) {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  const runtime = exports as unknown as {
    default: (props: SheetProps) => PreviewNode;
  };
  const props: SheetProps = {
    visible: true,
    target: options.target ??
      { reportId: 'a1000000-0000-4000-8000-000000000001' },
    initialType: options.initialType,
    initialDetails: options.initialDetails,
    onClose: () => {
      closed += 1;
    },
    onLogged: (result) => completions.push(JSON.parse(JSON.stringify(result))),
  };
  function render(): PreviewNode {
    cursor = 0;
    const wrapper = runtime.default(props);
    return (wrapper.type as (input: Record<string, unknown>) => PreviewNode)(
      wrapper.props,
    );
  }
  function find(predicate: (node: PreviewNode) => boolean): PreviewNode | null {
    function walk(value: unknown): PreviewNode | null {
      if (Array.isArray(value)) {
        for (const child of value) {
          const found = walk(child);
          if (found) return found;
        }
        return null;
      }
      if (!value || typeof value !== 'object' || !('props' in value)) {
        return null;
      }
      const node = value as PreviewNode;
      return predicate(node) ? node : walk(node.props.children);
    }
    return walk(render());
  }
  function press(node: PreviewNode | null) {
    assert.ok(node, 'Expected the action to be visible.');
    (node.props.onPress as () => void)();
  }
  return {
    render,
    find,
    press,
    saved,
    completions,
    dialogs,
    closed: () => closed,
    settle: () => new Promise<void>((resolve) => setImmediate(resolve)),
    release: () => releaseSave?.(),
  };
}

for (
  const target of [
    { reportId: 'a1000000-0000-4000-8000-000000000001' },
    { incidentCaseId: 'a2000000-0000-4000-8000-000000000001' },
  ]
) {
  test(`dismissing a reporter outcome records unknown without saving the draft note (${Object.keys(target)[0]})`, async () => {
    const fixture = loadActivitySheet({ target, initialType: 'reporter_call' });
    fixture.press(
      fixture.find((node) =>
        node.type === 'WorkflowActionRow' &&
        String(node.props.title).includes('Add a note')
      ),
    );
    const note = fixture.find((node) =>
      node.type === 'WorkflowNote' &&
      String(node.props.label).startsWith('Additional note')
    );
    assert.ok(note);
    (note.props.onChange as (value: string) => void)(
      'Unfinished draft must stay private',
    );
    (fixture.render().props.onClose as () => void)();
    await fixture.settle();
    assert.equal(fixture.saved.length, 1);
    assert.equal(
      fixture.saved[0].rpc,
      'reportId' in target ? 'report' : 'incident',
    );
    assert.deepEqual(fixture.saved[0].input.details, {
      outcome: 'not_recorded',
    });
    assert.equal(fixture.saved[0].input.note, '');
    assert.deepEqual(fixture.completions, [{
      eventType: 'reporter_call',
      outcome: 'not_recorded',
      dismissed: true,
    }]);
    assert.equal(fixture.closed(), 1);
  });
}

test('generic activity and hotline cancellation do not invent reporter-call outcomes', async () => {
  for (const initialType of [null, 'hotline_contacted'] as const) {
    const fixture = loadActivitySheet({ initialType });
    (fixture.render().props.onClose as () => void)();
    await fixture.settle();
    assert.equal(fixture.saved.length, 0);
    assert.equal(fixture.completions.length, 0);
    assert.equal(fixture.closed(), 1);
  }
});

test('locked reporter-call form presents outcomes rather than a no-op activity selector', () => {
  const fixture = loadActivitySheet({ initialType: 'reporter_call' });
  assert.equal(
    fixture.find((node) =>
      node.type === 'WorkflowChoices' && node.props.label === 'Activity'
    ),
    null,
  );
  assert.equal(
    fixture.find((node) =>
      node.type === 'WorkflowActionRow' &&
      node.props.title === 'Change activity'
    ),
    null,
  );
  assert.ok(
    fixture.find((node) =>
      node.type === 'WorkflowChoices' &&
      node.props.label === 'Did you reach them?'
    ),
  );
});

test('saving an actual selected outcome emits confirmation only after the RPC succeeds', async () => {
  const fixture = loadActivitySheet({
    initialType: 'reporter_call',
    delaySave: true,
  });
  const outcomes = fixture.find((node) =>
    node.type === 'WorkflowChoices' &&
    node.props.label === 'Did you reach them?'
  );
  assert.ok(outcomes);
  (outcomes.props.onSelect as (value: string) => void)('reached');
  fixture.press(
    fixture.find((node) =>
      node.type === 'WorkflowButton' &&
      String(node.props.label).startsWith('Save')
    ),
  );
  assert.equal(fixture.saved.length, 1);
  assert.equal(fixture.closed(), 0);
  assert.equal(fixture.completions.length, 0);
  fixture.release();
  await fixture.settle();
  assert.deepEqual(fixture.completions, [{
    eventType: 'reporter_call',
    outcome: 'reached',
    dismissed: false,
  }]);
  assert.equal(fixture.closed(), 1);
});

test('rapid dismiss taps produce a single not-recorded audit event', async () => {
  const fixture = loadActivitySheet({
    initialType: 'reporter_call',
    delaySave: true,
  });
  const close = fixture.render().props.onClose as () => void;
  close();
  close();
  assert.equal(fixture.saved.length, 1);
  fixture.release();
  await fixture.settle();
  assert.equal(fixture.completions.length, 1);
});

test('failed audit save leaves the form open with an error and no success confirmation', async () => {
  const fixture = loadActivitySheet({
    initialType: 'reporter_call',
    saveError: 'Network unavailable',
  });
  (fixture.render().props.onClose as () => void)();
  await fixture.settle();
  assert.equal(fixture.closed(), 0);
  assert.equal(fixture.completions.length, 0);
  assert.ok(
    fixture.find((node) =>
      node.type === 'WorkflowFeedback' &&
      node.props.error === 'Network unavailable'
    ),
  );
});

type ActivityFixture = ReturnType<typeof loadActivitySheet>;
type GroupedDetails = {
  submission_id: string;
  services: { details: Record<string, string>; note: string | null }[];
};

function enterText(fixture: ActivityFixture, label: string, value: string) {
  if (
    label === 'Specific station, office, or unit (optional)' &&
    !fixture.find((node) => node.props.label === label)
  ) {
    fixture.press(
      fixture.find((node) =>
        node.props.title === 'Add specific unit (optional)'
      ),
    );
  }
  const field = fixture.find((node) =>
    node.type === 'WorkflowNote' && node.props.label === label
  );
  assert.ok(field, `Expected the ${label} field.`);
  (field.props.onChange as (next: string) => void)(value);
}

function choose(fixture: ActivityFixture, label: string, value: string) {
  if (
    label === 'Service' && !fixture.find((node) => node.props.label === label)
  ) {
    fixture.press(
      fixture.find((node) =>
        node.props.description === 'Service contacted - tap to change'
      ),
    );
  }
  const choice = fixture.find((node) =>
    node.type === 'WorkflowChoices' && node.props.label === label
  );
  assert.ok(choice, `Expected the ${label} choices.`);
  (choice.props.onSelect as (next: string) => void)(value);
}

function fillIdentity(
  fixture: ActivityFixture,
  service: string,
  name: string,
  municipality = 'Minglanilla',
) {
  choose(fixture, 'Service', service);
  if (service === 'other') enterText(fixture, 'Other service name', name);
  enterText(fixture, 'Specific station, office, or unit (optional)', name);
  enterText(fixture, 'Municipality / city of the service', municipality);
}

function fillDispatch(
  fixture: ActivityFixture,
  service: string,
  confirmedBy: string,
  method: string,
  name = service === 'bfp' ? 'Fire Station' : 'Medical response',
  municipality = 'Minglanilla',
) {
  fillIdentity(fixture, service, name, municipality);
  enterText(fixture, 'Who confirmed dispatch?', confirmedBy);
  choose(fixture, 'How was dispatch confirmed?', method);
}

function pressLabel(fixture: ActivityFixture, label: string) {
  fixture.press(
    fixture.find((node) =>
      node.type === 'WorkflowButton' && node.props.label === label
    ),
  );
}

function submit(fixture: ActivityFixture) {
  fixture.press(
    fixture.find((node) =>
      node.type === 'WorkflowButton' &&
      String(node.props.label).startsWith('Save')
    ),
  );
}

function queueTwoServices(
  options: Parameters<typeof loadActivitySheet>[0] = {},
) {
  const fixture = loadActivitySheet({
    target: { incidentCaseId: 'a2000000-0000-4000-8000-000000000001' },
    initialType: 'dispatch_confirmed',
    ...options,
  });
  fillDispatch(fixture, 'bfp', 'Fire dispatcher', 'radio');
  pressLabel(fixture, 'Add another service');
  assert.equal(
    fixture.saved.length,
    0,
    'queuing a service creates no audit event',
  );
  fillDispatch(fixture, 'rhu_ambulance', 'Medical dispatcher', 'callback');
  return fixture;
}

function groupDetails(fixture: ActivityFixture, attempt = 0): GroupedDetails {
  const details = fixture.saved[attempt]?.input.details as GroupedDetails;
  assert.match(
    details.submission_id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  assert.ok(Array.isArray(details.services));
  return details;
}

function editFire(fixture: ActivityFixture) {
  fixture.press(
    fixture.find((node) =>
      node.props.title === 'Edit BFP · Fire Station · Minglanilla'
    ),
  );
}

function removeFire(fixture: ActivityFixture) {
  fixture.press(
    fixture.find((node) =>
      node.props.accessibilityLabel ===
        'Remove BFP · Fire Station · Minglanilla draft'
    ),
  );
}

test('three distinct services save as one activity with separate dispatch evidence', async () => {
  const fixture = queueTwoServices();
  pressLabel(fixture, 'Add another service');
  fillDispatch(
    fixture,
    'pnp',
    'Police commander',
    'in_person',
    'Police Station',
    'Talisay',
  );
  enterText(fixture, 'Dispatch reference (optional)', 'Radio log Alpha');
  fixture.press(
    fixture.find((node) => node.props.title === 'Add a note (optional)'),
  );
  enterText(
    fixture,
    'Additional note (no phone numbers)',
    'Traffic assistance',
  );
  submit(fixture);
  await fixture.settle();
  assert.equal(fixture.saved.length, 1);
  assert.equal(fixture.saved[0].rpc, 'incident');
  assert.equal(fixture.saved[0].input.note, '');
  assert.deepEqual(groupDetails(fixture).services, [
    {
      details: {
        service: 'bfp',
        service_name: 'Fire Station',
        municipality: 'Minglanilla',
        confirmed_by: 'Fire dispatcher',
        method: 'radio',
      },
      note: null,
    },
    {
      details: {
        service: 'rhu_ambulance',
        service_name: 'Medical response',
        municipality: 'Minglanilla',
        confirmed_by: 'Medical dispatcher',
        method: 'callback',
      },
      note: null,
    },
    {
      details: {
        service: 'pnp',
        service_name: 'Police Station',
        municipality: 'Talisay',
        confirmed_by: 'Police commander',
        method: 'in_person',
        reference: 'Radio log Alpha',
      },
      note: 'Traffic assistance',
    },
  ]);
  assert.deepEqual(fixture.completions, [{
    eventType: 'dispatch_confirmed',
    serviceCount: 3,
  }]);
  assert.equal(fixture.closed(), 1);
});

test('an incomplete current service prevents any grouped write', async () => {
  const fixture = queueTwoServices();
  enterText(fixture, 'Who confirmed dispatch?', '');
  submit(fixture);
  await fixture.settle();
  assert.equal(fixture.saved.length, 0);
  assert.equal(fixture.closed(), 0);
  assert.ok(
    fixture.find((node) =>
      node.props.label === 'Who confirmed dispatch?' &&
      Boolean(node.props.error)
    ),
  );
});

test('an exact team and municipality duplicate is blocked despite case and spacing', async () => {
  const fixture = queueTwoServices();
  fillDispatch(
    fixture,
    'bfp',
    'Another confirmer',
    'callback',
    '  fIRE   sTATION  ',
    ' mINGLANILLA ',
  );
  submit(fixture);
  await fixture.settle();
  assert.equal(fixture.saved.length, 0);
  assert.ok(
    fixture.find((node) =>
      node.props.label === 'Specific station, office, or unit (optional)' &&
      String(node.props.error).includes('already listed')
    ),
  );
});

for (
  const [name, municipality] of [
    ['Fire Station', 'Talisay'],
    ['North Fire Unit', 'Minglanilla'],
  ]
) {
  test(`the same service category can include ${name} in ${municipality}`, async () => {
    const fixture = queueTwoServices();
    fillDispatch(
      fixture,
      'bfp',
      'Second dispatcher',
      'callback',
      name,
      municipality,
    );
    submit(fixture);
    await fixture.settle();
    assert.equal(fixture.saved.length, 1);
    const services = groupDetails(fixture).services;
    assert.equal(services.length, 2);
    assert.equal(services[1].details.service_name, name);
    assert.equal(services[1].details.municipality, municipality);
  });
}

test('retry after an uncertain response resends one whole group using the same submission ID', async () => {
  const fixture = queueTwoServices({
    saveErrors: ['Network unavailable', null],
  });
  submit(fixture);
  await fixture.settle();
  assert.equal(fixture.saved.length, 1);
  assert.equal(fixture.completions.length, 0);
  assert.equal(fixture.closed(), 0);
  assert.ok(fixture.find((node) => node.props.error === 'Network unavailable'));
  submit(fixture);
  await fixture.settle();
  assert.equal(
    fixture.saved.length,
    2,
    'each attempt performs exactly one RPC',
  );
  assert.deepEqual(groupDetails(fixture, 1), groupDetails(fixture));
  assert.deepEqual(fixture.completions, [{
    eventType: 'dispatch_confirmed',
    serviceCount: 2,
  }]);
});

test('a failed grouped save leaves every draft editable and keeps its ID after edits', async () => {
  const fixture = queueTwoServices({
    saveErrors: ['Rejected service detail', null],
  });
  submit(fixture);
  await fixture.settle();
  editFire(fixture);
  enterText(fixture, 'Who confirmed dispatch?', 'Updated fire dispatcher');
  pressLabel(fixture, 'Apply service changes');
  assert.ok(
    fixture.find((node) =>
      node.props.label === 'Who confirmed dispatch?' &&
      node.props.value === 'Medical dispatcher'
    ),
  );
  enterText(fixture, 'Who confirmed dispatch?', 'Updated medical dispatcher');
  submit(fixture);
  await fixture.settle();
  assert.equal(fixture.saved.length, 2);
  const original = groupDetails(fixture);
  const retry = groupDetails(fixture, 1);
  assert.equal(
    retry.submission_id,
    original.submission_id,
    'edits cannot turn a lost response into a new activity',
  );
  assert.deepEqual(retry.services.map((entry) => entry.details.confirmed_by), [
    'Updated fire dispatcher',
    'Updated medical dispatcher',
  ]);
  assert.deepEqual(fixture.completions, [{
    eventType: 'dispatch_confirmed',
    serviceCount: 2,
  }]);
});

test('closing after a grouped failure never fabricates partial success', async () => {
  const fixture = queueTwoServices({ saveError: 'Network unavailable' });
  submit(fixture);
  await fixture.settle();
  (fixture.render().props.onClose as () => void)();
  assert.equal(fixture.saved.length, 1);
  assert.equal(fixture.closed(), 1);
  assert.deepEqual(fixture.completions, []);
});

test('rapid grouped saves and dismissals are guarded until the single RPC completes', async () => {
  const fixture = queueTwoServices({ delaySave: true });
  const saveButton = fixture.find((node) =>
    node.props.label === 'Save activity'
  );
  fixture.press(saveButton);
  fixture.press(saveButton);
  (fixture.render().props.onClose as () => void)();
  assert.equal(fixture.saved.length, 1);
  assert.equal(fixture.closed(), 0);
  assert.equal(fixture.completions.length, 0);
  fixture.release();
  await fixture.settle();
  assert.equal(fixture.saved.length, 1);
  assert.equal(fixture.completions.length, 1);
});

test('a native hotline follow-up records only its actual contact without requiring an invented municipality', async () => {
  const fixture = loadActivitySheet({
    initialType: 'hotline_contacted',
    initialDetails: { service: 'other', service_other: 'Local fire hotline' },
  });
  assert.equal(
    fixture.find((node) => node.props.label === 'Add another service'),
    null,
  );
  assert.equal(
    fixture.find((node) =>
      node.props.label === 'Municipality / city of the service'
    ),
    null,
  );
  choose(fixture, 'Did you reach them?', 'reached');
  submit(fixture);
  await fixture.settle();
  assert.equal(fixture.saved.length, 1);
  assert.deepEqual(fixture.saved[0].input.details, {
    service: 'other',
    service_other: 'Local fire hotline',
    outcome: 'reached',
  });
  assert.deepEqual(fixture.completions, [{
    eventType: 'hotline_contacted',
    outcome: 'reached',
    dismissed: false,
  }]);
});

test('one grouped contact preserves different outcomes and service municipalities', async () => {
  const fixture = loadActivitySheet();
  choose(fixture, 'Activity group', 'contact');
  fixture.press(
    fixture.find((node) => node.props.title === 'Hotline contacted'),
  );
  fillIdentity(fixture, 'bfp', 'Fire Station', 'Minglanilla');
  choose(fixture, 'Did you reach them?', 'reached');
  pressLabel(fixture, 'Add another service');
  fillIdentity(fixture, 'bfp', 'Fire Station', 'Talisay');
  choose(fixture, 'Did you reach them?', 'no_answer');
  submit(fixture);
  await fixture.settle();
  assert.equal(fixture.saved.length, 1);
  assert.equal(fixture.saved[0].rpc, 'report');
  assert.deepEqual(
    groupDetails(fixture).services.map((
      entry,
    ) => [entry.details.municipality, entry.details.outcome]),
    [
      ['Minglanilla', 'reached'],
      ['Talisay', 'no_answer'],
    ],
  );
  assert.deepEqual(fixture.completions, [{
    eventType: 'hotline_contacted',
    serviceCount: 2,
  }]);
});

test('choosing a named agency clears the previous custom category name', async () => {
  const fixture = loadActivitySheet({ initialType: 'dispatch_confirmed' });
  fillDispatch(
    fixture,
    'other',
    'Road officer',
    'in_person',
    'Road engineering crew',
  );
  choose(fixture, 'Service', 'bfp');
  submit(fixture);
  await fixture.settle();
  assert.equal(fixture.saved.length, 1);
  assert.equal(
    (fixture.saved[0].input.details as Record<string, string>).service_other,
    undefined,
  );
});

test('manual dispatch validation identifies all required evidence and identity fields', async () => {
  const fixture = loadActivitySheet({ initialType: 'dispatch_confirmed' });
  submit(fixture);
  await fixture.settle();
  for (
    const label of [
      'Service',
      'Municipality / city of the service',
      'Who confirmed dispatch?',
      'How was dispatch confirmed?',
    ]
  ) {
    assert.ok(
      fixture.find((node) =>
        node.props.label === label && typeof node.props.error === 'string'
      ),
      label,
    );
  }
  assert.equal(fixture.saved.length, 0);
});

test('applying a queued-service edit changes only that service and restores the current draft', async () => {
  const fixture = queueTwoServices();
  editFire(fixture);
  enterText(fixture, 'Who confirmed dispatch?', 'Replacement fire dispatcher');
  pressLabel(fixture, 'Apply service changes');
  assert.equal(fixture.saved.length, 0);
  assert.ok(
    fixture.find((node) =>
      node.props.label === 'Who confirmed dispatch?' &&
      node.props.value === 'Medical dispatcher'
    ),
  );
  submit(fixture);
  await fixture.settle();
  assert.deepEqual(
    groupDetails(fixture).services.map((entry) => entry.details.confirmed_by),
    ['Replacement fire dispatcher', 'Medical dispatcher'],
  );
});

test('cancelling a service edit keeps its original and the separate current draft', async () => {
  const fixture = queueTwoServices();
  editFire(fixture);
  enterText(fixture, 'Who confirmed dispatch?', 'Discard this edit');
  pressLabel(fixture, 'Cancel edit');
  assert.ok(
    fixture.find((node) =>
      node.props.label === 'Who confirmed dispatch?' &&
      node.props.value === 'Medical dispatcher'
    ),
  );
  submit(fixture);
  await fixture.settle();
  assert.deepEqual(
    groupDetails(fixture).services.map((entry) => entry.details.confirmed_by),
    ['Fire dispatcher', 'Medical dispatcher'],
  );
});

test('an incomplete queued-service edit cannot apply or trigger an audit save', () => {
  const fixture = queueTwoServices();
  editFire(fixture);
  enterText(fixture, 'Who confirmed dispatch?', '');
  pressLabel(fixture, 'Apply service changes');
  assert.ok(
    fixture.find((node) =>
      node.props.label === 'Who confirmed dispatch?' &&
      Boolean(node.props.error)
    ),
  );
  assert.ok(
    fixture.find((node) => node.props.label === 'Apply service changes'),
  );
  assert.equal(fixture.saved.length, 0);
});

test('opening and cancelling the activity chooser preserves entered evidence', () => {
  const fixture = loadActivitySheet({ initialType: 'dispatch_confirmed' });
  fillDispatch(fixture, 'bfp', 'Fire dispatcher', 'radio');
  fixture.press(fixture.find((node) => node.props.title === 'Change activity'));
  fixture.press(
    fixture.find((node) => node.props.title === 'Keep current activity'),
  );
  assert.ok(
    fixture.find((node) =>
      node.props.label === 'Who confirmed dispatch?' &&
      node.props.value === 'Fire dispatcher'
    ),
  );
  assert.equal(fixture.saved.length, 0);
});

for (
  const label of [
    'Who confirmed dispatch?',
    'Specific station, office, or unit (optional)',
    'Municipality / city of the service',
  ]
) {
  test(`phone privacy blocks the offending ${label} field before any write`, async () => {
    const fixture = queueTwoServices();
    enterText(fixture, label, 'Call 09171234567');
    submit(fixture);
    await fixture.settle();
    assert.ok(
      fixture.find((node) =>
        node.props.label === label &&
        String(node.props.error).includes('phone numbers')
      ),
    );
    assert.equal(fixture.saved.length, 0);
  });
}

test('removing a queued service requires confirmation and preserves the separate draft', async () => {
  const fixture = queueTwoServices();
  removeFire(fixture);
  assert.equal(fixture.dialogs.length, 1);
  assert.ok(
    fixture.find((node) =>
      node.props.title === 'Edit BFP · Fire Station · Minglanilla'
    ),
  );
  fixture.dialogs[0].buttons.find((button) => button.text === 'Keep draft')
    ?.onPress?.();
  assert.ok(
    fixture.find((node) =>
      node.props.title === 'Edit BFP · Fire Station · Minglanilla'
    ),
  );
  removeFire(fixture);
  fixture.dialogs[1].buttons.find((button) => button.text === 'Remove')
    ?.onPress?.();
  assert.equal(
    fixture.find((node) =>
      node.props.title === 'Edit BFP · Fire Station · Minglanilla'
    ),
    null,
  );
  assert.equal(fixture.saved.length, 0);
  submit(fixture);
  await fixture.settle();
  assert.equal(fixture.saved.length, 1);
  assert.equal(
    (fixture.saved[0].input.details as Record<string, string>).confirmed_by,
    'Medical dispatcher',
  );
});

test('removing the service being edited restores the untouched current draft', async () => {
  const fixture = queueTwoServices();
  editFire(fixture);
  enterText(fixture, 'Who confirmed dispatch?', 'Unsaved fire edit');
  removeFire(fixture);
  fixture.dialogs[0].buttons.find((button) => button.text === 'Remove')
    ?.onPress?.();
  assert.ok(
    fixture.find((node) =>
      node.props.label === 'Who confirmed dispatch?' &&
      node.props.value === 'Medical dispatcher'
    ),
  );
  assert.equal(
    fixture.find((node) => node.props.label === 'Apply service changes'),
    null,
  );
  submit(fixture);
  await fixture.settle();
  assert.equal(fixture.saved.length, 1);
  assert.equal(
    (fixture.saved[0].input.details as Record<string, string>).service,
    'rhu_ambulance',
  );
});

test('draft removal and confirmation callbacks cannot alter an in-flight group', async () => {
  const fixture = queueTwoServices({ delaySave: true });
  removeFire(fixture);
  const confirmRemoval = fixture.dialogs[0].buttons.find((button) =>
    button.text === 'Remove'
  )?.onPress;
  const removeButton = fixture.find((node) =>
    node.props.accessibilityLabel ===
      'Remove BFP · Fire Station · Minglanilla draft'
  );
  submit(fixture);
  fixture.press(removeButton);
  confirmRemoval?.();
  assert.equal(
    fixture.dialogs.length,
    1,
    'no additional removal dialog opens during submission',
  );
  assert.equal(groupDetails(fixture).services.length, 2);
  fixture.release();
  await fixture.settle();
  assert.equal(fixture.saved.length, 1);
  assert.deepEqual(fixture.completions, [{
    eventType: 'dispatch_confirmed',
    serviceCount: 2,
  }]);
});

function fillRoutineDispatch(
  fixture: ActivityFixture,
  service: string,
  municipality = 'Minglanilla',
) {
  choose(fixture, 'Service', service);
  enterText(fixture, 'Municipality / city of the service', municipality);
  enterText(fixture, 'Who confirmed dispatch?', 'Duty dispatcher');
  choose(fixture, 'How was dispatch confirmed?', 'radio');
}

test('a routine known service saves without opening or inventing a specific unit', async () => {
  const fixture = loadActivitySheet({ initialType: 'dispatch_confirmed' });
  fillRoutineDispatch(fixture, 'pnp');
  assert.equal(
    fixture.find((node) =>
      node.props.label === 'Specific station, office, or unit (optional)'
    ),
    null,
  );
  assert.ok(fixture.find((node) => node.props.title === 'PNP · Minglanilla'));
  submit(fixture);
  await fixture.settle();
  assert.deepEqual(fixture.saved[0].input.details, {
    service: 'pnp',
    municipality: 'Minglanilla',
    confirmed_by: 'Duty dispatcher',
    method: 'radio',
  });
  assert.equal(fixture.closed(), 1);
});

test('a repeated unnamed service asks for a differentiator without changing the first entry', async () => {
  const fixture = loadActivitySheet({ initialType: 'dispatch_confirmed' });
  fillRoutineDispatch(fixture, 'mdrrmo_rescue');
  pressLabel(fixture, 'Add another service');
  fillRoutineDispatch(fixture, 'mdrrmo_rescue');
  submit(fixture);
  await fixture.settle();
  assert.equal(fixture.saved.length, 0);
  assert.ok(
    fixture.find((node) =>
      node.props.label === 'Specific station, office, or unit (optional)' &&
      String(node.props.error).includes('already listed')
    ),
  );
  enterText(
    fixture,
    'Specific station, office, or unit (optional)',
    'Rescue Team Beta',
  );
  submit(fixture);
  await fixture.settle();
  const services = groupDetails(fixture).services;
  assert.equal(services[0].details.service_name, undefined);
  assert.equal(services[1].details.service_name, 'Rescue Team Beta');
});

test('the same unnamed category from different municipalities saves as one activity', async () => {
  const fixture = loadActivitySheet({ initialType: 'dispatch_confirmed' });
  fillRoutineDispatch(fixture, 'pnp');
  pressLabel(fixture, 'Add another service');
  fillRoutineDispatch(fixture, 'pnp', 'Naga City, Cebu');
  submit(fixture);
  await fixture.settle();
  assert.deepEqual(
    groupDetails(fixture).services.map((entry) => entry.details.municipality),
    ['Minglanilla', 'Naga City, Cebu'],
  );
  assert.ok(
    groupDetails(fixture).services.every((entry) =>
      entry.details.service_name === undefined
    ),
  );
});

test('clearing an optional unit removes the field instead of sending an empty required detail', async () => {
  const fixture = loadActivitySheet({ initialType: 'dispatch_confirmed' });
  fillDispatch(fixture, 'bfp', 'Duty dispatcher', 'radio');
  enterText(fixture, 'Specific station, office, or unit (optional)', '   ');
  submit(fixture);
  await fixture.settle();
  assert.equal(
    (fixture.saved[0].input.details as Record<string, string>).service_name,
    undefined,
  );
  assert.equal(fixture.closed(), 1);
});

test('Other requires a service name but does not require a separate unit', async () => {
  const fixture = loadActivitySheet({ initialType: 'dispatch_confirmed' });
  fillRoutineDispatch(fixture, 'other');
  submit(fixture);
  await fixture.settle();
  assert.equal(fixture.saved.length, 0);
  assert.ok(
    fixture.find((node) =>
      node.props.label === 'Other service name' && Boolean(node.props.error)
    ),
  );
  enterText(fixture, 'Other service name', 'Road engineering crew');
  submit(fixture);
  await fixture.settle();
  assert.equal(
    (fixture.saved[0].input.details as Record<string, string>).service_other,
    'Road engineering crew',
  );
  assert.equal(
    (fixture.saved[0].input.details as Record<string, string>).service_name,
    undefined,
  );
});

test('different named Other services in the same municipality are not false duplicates', async () => {
  const fixture = loadActivitySheet({ initialType: 'dispatch_confirmed' });
  fillRoutineDispatch(fixture, 'other');
  enterText(fixture, 'Other service name', 'Road engineering crew');
  pressLabel(fixture, 'Add another service');
  fillRoutineDispatch(fixture, 'other');
  enterText(fixture, 'Other service name', 'Coastal assistance team');
  submit(fixture);
  await fixture.settle();
  assert.deepEqual(
    groupDetails(fixture).services.map((entry) => entry.details.service_other),
    ['Road engineering crew', 'Coastal assistance team'],
  );
});
