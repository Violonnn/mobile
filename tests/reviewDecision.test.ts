import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

import type ReviewDecisionPanel from '../components/official/ReviewDecisionPanel';
import type ReportPublicationFields from '../components/official/ReportPublicationFields';
import { colors, fonts, radius, spacing } from '../styles/theme.ts';

type PanelProps = Parameters<typeof ReviewDecisionPanel>[0];
type PreviewNode = { type: unknown; props: Record<string, unknown> };
type EffectSlot = { dependencies?: unknown[]; cleanup?: () => void };

function loadReviewPanel(options: { firstLoadFails?: boolean } = {}) {
  const slots: unknown[] = [];
  const effects: (() => void)[] = [];
  let cursor = 0;
  let loads = 0;
  let changes = 0;
  let operation = 0;
  const releases: Record<string, unknown>[] = [];
  const dialogs: { title: string; buttons: { text: string; onPress?: () => void }[] }[] = [];
  const changedDependencies = (previous: unknown[] | undefined, next: unknown[] | undefined) =>
    !previous || !next || previous.length !== next.length || next.some((item, index) => !Object.is(item, previous[index]));
  const createElement = (type: unknown, props: Record<string, unknown> | null, ...children: unknown[]): PreviewNode =>
    ({ type, props: { ...props, children } });
  const react = {
    __esModule: true,
    default: { createElement, Fragment: 'Fragment' },
    useState(initial: unknown) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (next: unknown) => {
        slots[index] = typeof next === 'function' ? next(slots[index]) : next;
      }];
    },
    useRef(initial: unknown) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect(create: () => void | (() => void), dependencies?: unknown[]) {
      const index = cursor++;
      const previous = slots[index] as EffectSlot | undefined;
      if (previous && !changedDependencies(previous.dependencies, dependencies)) return;
      const slot: EffectSlot = { dependencies: dependencies ? Array.from(dependencies) : undefined };
      slots[index] = slot;
      effects.push(() => {
        previous?.cleanup?.();
        const cleanup = create();
        if (typeof cleanup === 'function') slot.cleanup = cleanup;
      });
    },
  };
  const sourceReview = {
    reportId: 'fa000000-0000-4000-8000-000000000001', incidentCaseId: null,
    sourceTitle: 'Original resident statement', sourceDescription: 'Resident text stays unchanged.',
    publicTitle: null, publicDescription: null, media: [],
    reporterNameApproved: false, reporterAvatarApproved: false, exactLocationApproved: false,
    showReporterName: false, showReporterAvatar: false, allowExactLocation: false,
    isSensitive: false, canPublish: true, photoError: null,
  };
  const dependencies: Record<string, unknown> = {
    react,
    'react-native': {
      Text: 'Text', View: 'View', TouchableOpacity: 'TouchableOpacity', Pressable: 'Pressable',
      Alert: { alert: (title: string, _message: string, buttons: { text: string; onPress?: () => void }[]) => dialogs.push({ title, buttons }) },
    },
    '../../lib/officialReports': {
      claimReportReview: async () => ({ error: null }),
      releaseReportReview: async (input: Record<string, unknown>) => { releases.push(input); return { error: null }; },
      reopenReportReview: async () => ({ error: null }),
      reviewOfficialReport: async () => ({ error: null, publicAvailable: true }),
    },
    '../../lib/reportPublication': {
      getOfficialReportPublicationReview: async () => {
        loads += 1;
        return options.firstLoadFails && loads === 1
          ? { review: null, error: 'Temporary review load failure' }
          : { review: sourceReview, error: null };
      },
    },
    '../../lib/reportMedia': { randomUuid: () => `review-operation-${++operation}` },
    '../../lib/formatTime': { formatOperationTimestamp: () => 'Recorded time' },
    '../../styles/components/reportOperations.styles': { reportOperationsStyles: {} },
    './ResourceFormSheet': { __esModule: true, default: 'ResourceFormSheet' },
    './ReportPublicationFields': { __esModule: true, default: 'ReportPublicationFields' },
    './WorkflowForm': Object.fromEntries(['WorkflowActionRow', 'WorkflowButton', 'WorkflowChoices', 'WorkflowFeedback', 'WorkflowNote']
      .map((name) => [name, name])),
  };
  const compiled = ts.transpileModule(readFileSync(new URL('../components/official/ReviewDecisionPanel.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  });
  const runtimeExports: Record<string, unknown> = {};
  // Native nodes are inert. Execute the actual handlers/effect dependencies
  // without a phone, dialogs, authentication, or a database mutation.
  runInNewContext(compiled.outputText, {
    exports: runtimeExports, module: { exports: runtimeExports },
    require(name: string) { assert.ok(name in dependencies, `Unexpected dependency ${name}`); return dependencies[name]; },
  });
  const runtime = runtimeExports as { default: (props: PanelProps) => PreviewNode };
  const props: PanelProps = {
    currentUserId: 'fa000000-0000-4000-8000-000000000002',
    detail: {
      id: sourceReview.reportId, allowedReviewActions: ['verify', 'release'], canReviewReport: true,
      lifecycle: { primaryStage: 'under_review' }, lifecycleFacts: { reviewOutcome: 'pending' },
      reviewClaimedById: 'fa000000-0000-4000-8000-000000000002', intakeChannel: 'resident_app', media: [],
    } as unknown as PanelProps['detail'],
    onChanged: () => { changes += 1; }, onOpenLinkSheet: () => {},
  };
  function render() {
    cursor = 0;
    const tree = runtime.default(props);
    for (const effect of effects.splice(0)) effect();
    return tree;
  }
  function walk(value: unknown, predicate: (node: PreviewNode) => boolean): PreviewNode | null {
    if (Array.isArray(value)) {
      for (const child of value) { const found = walk(child, predicate); if (found) return found; }
      return null;
    }
    if (!value || typeof value !== 'object' || !('props' in value)) return null;
    const node = value as PreviewNode;
    if (node.type === 'ResourceFormSheet' && !node.props.visible) return null;
    return predicate(node) ? node : walk(node.props.children, predicate);
  }
  function find(predicate: (node: PreviewNode) => boolean) { return walk(render(), predicate); }
  function press(node: PreviewNode | null) {
    assert.ok(node, 'The requested action must be available');
    (node.props.onPress as () => void)();
  }
  function chooseConfirmation() {
    const choices = find((node) => node.type === 'WorkflowChoices' &&
      (node.props.values as { value: string }[]).some((option) => option.value === 'verify'));
    assert.ok(choices);
    (choices.props.onSelect as (value: string) => void)('verify');
    render();
  }
  function text(value: unknown): string {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.map(text).join(' ');
    if (!value || typeof value !== 'object' || !('props' in value)) return '';
    return text((value as PreviewNode).props.children);
  }
  return {
    render, find, press, chooseConfirmation, dialogs, releases, text,
    open: () => press(find((node) => node.type === 'WorkflowButton')),
    loadedFields: () => find((node) => node.type === 'ReportPublicationFields'),
    loads: () => loads, changes: () => changes,
    settle: () => new Promise<void>((resolve) => setImmediate(resolve)),
  };
}

test('reselecting Confirm incident preserves the loaded form instead of waiting forever', async () => {
  const fixture = loadReviewPanel();
  fixture.open();
  fixture.chooseConfirmation();
  await fixture.settle();
  assert.ok(fixture.loadedFields());
  const previousLoads = fixture.loads();
  fixture.chooseConfirmation();
  await fixture.settle();
  assert.ok(fixture.loadedFields(), 'The loaded confirmation must remain available after a repeated tap');
  assert.equal(fixture.loads(), previousLoads, 'Repeating the current choice should not discard the review');
});

test('a failed confirmation lookup has a retry action that starts another request', async () => {
  const fixture = loadReviewPanel({ firstLoadFails: true });
  fixture.open();
  fixture.chooseConfirmation();
  await fixture.settle();
  assert.equal(fixture.loadedFields(), null);
  fixture.press(fixture.find((node) => node.type === 'WorkflowButton' && /retry|try again/i.test(String(node.props.label))));
  fixture.render();
  await fixture.settle();
  assert.ok(fixture.loadedFields());
  assert.equal(fixture.loads(), 2);
});

test('release only reaches its mutation after the officer confirms the dialog', async () => {
  const fixture = loadReviewPanel();
  fixture.open();
  const release = () => fixture.find((node) => ['TouchableOpacity', 'Pressable'].includes(String(node.type)) &&
    /release to another officer/i.test(fixture.text(node)));
  fixture.press(release());
  assert.equal(fixture.releases.length, 0, 'The initial tap must not release the claim');
  assert.equal(fixture.changes(), 0);
  assert.equal(fixture.dialogs.length, 1);
  fixture.dialogs[0].buttons.find((button) => /cancel/i.test(button.text))?.onPress?.();
  assert.equal(fixture.releases.length, 0);
  fixture.press(release());
  const confirm = fixture.dialogs[1].buttons.find((button) => /release|confirm/i.test(button.text));
  assert.ok(confirm?.onPress);
  confirm.onPress();
  await fixture.settle();
  assert.equal(fixture.releases.length, 1);
  assert.equal(fixture.changes(), 1);
});

test('a failed photo preview stays mounted for retry while public approval is disabled', () => {
  const slots: unknown[] = [];
  let cursor = 0;
  let selectedPhotoIds = ['photo-1'];
  const react = {
    __esModule: true,
    default: {
      createElement: (type: unknown, props: Record<string, unknown> | null, ...children: unknown[]) =>
        ({ type, props: { ...props, children } }),
      Fragment: 'Fragment',
    },
    useState(initial: unknown) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], (next: unknown) => {
        slots[index] = typeof next === 'function' ? next(slots[index]) : next;
      }];
    },
  };
  const dependencies: Record<string, unknown> = {
    react,
    'react-native': { Alert: { alert() {} }, Pressable: 'Pressable', Text: 'Text', View: 'View' },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    '../../styles/theme': { colors, fonts, radius, spacing },
    '../../styles/screens/official.styles': { officialStyles: {} },
    '../../styles/components/reportOperations.styles': { reportOperationsStyles: {} },
    './WorkflowForm': { WorkflowNote: 'WorkflowNote' },
    './ScreenablePhotoPreview': { __esModule: true, default: 'ScreenablePhotoPreview' },
  };
  const compiled = ts.transpileModule(readFileSync(new URL('../components/official/ReportPublicationFields.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  });
  const runtimeExports: Record<string, unknown> = {};
  runInNewContext(compiled.outputText, {
    React: react.default,
    exports: runtimeExports, module: { exports: runtimeExports },
    require(name: string) { assert.ok(name in dependencies, `Unexpected dependency ${name}`); return dependencies[name]; },
  });
  const runtime = runtimeExports as { default: (props: Parameters<typeof ReportPublicationFields>[0]) => PreviewNode };
  const noChange = () => {};
  function render(): PreviewNode[] {
    cursor = 0;
    const tree = runtime.default({
      sourceTitle: 'Original title', sourceDescription: 'Original description', acknowledged: false,
      onAcknowledgedChange: noChange, sensitive: false, onSensitiveChange: noChange,
      sensitivityReason: '', onSensitivityReasonChange: noChange,
      reporterNameAllowed: false, approveReporterName: false, onApproveReporterNameChange: noChange,
      reporterAvatarAllowed: false, approveReporterAvatar: false, onApproveReporterAvatarChange: noChange,
      exactLocationAllowed: false, approveExactLocation: false, onApproveExactLocationChange: noChange,
      photos: [{ mediaId: 'photo-1', previewUrl: 'https://example.test/thumb.jpg', fullSizeUrl: 'https://example.test/display.jpg', verified: false, publicApproved: false }],
      selectedPhotoMediaIds: selectedPhotoIds,
      onPhotoSelectionChange: (ids) => { selectedPhotoIds = ids; },
    });
    const nodes: PreviewNode[] = [];
    function walk(value: unknown) {
      if (Array.isArray(value)) { value.forEach(walk); return; }
      if (!value || typeof value !== 'object' || !('props' in value)) return;
      const node = value as PreviewNode;
      nodes.push(node);
      walk(node.props.children);
    }
    walk(tree);
    return nodes;
  }
  let nodes = render();
  const preview = nodes.find((node) => node.type === 'ScreenablePhotoPreview');
  assert.ok(preview);
  (preview.props.onFullSizeError as () => void)();
  nodes = render();
  const retryablePreview = nodes.find((node) => node.type === 'ScreenablePhotoPreview');
  assert.ok(retryablePreview, 'Keep the preview mounted so its Retry dialog remains available');
  assert.equal(selectedPhotoIds.length, 0, 'A failed preview must remove pending approval');
  const approval = () => nodes.find((node) => node.props.accessibilityLabel === 'Public photo 1');
  assert.equal(approval()?.props.disabled, true);
  (retryablePreview.props.onFullSizeLoad as () => void)();
  nodes = render();
  assert.equal(approval()?.props.disabled, false, 'A successful retry restores the approval control');
  assert.equal(selectedPhotoIds.length, 0, 'Retrying does not silently reapprove the photo');
});
