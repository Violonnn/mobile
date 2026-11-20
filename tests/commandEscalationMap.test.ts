import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

import type CommandEscalationMap from '../components/official/CommandEscalationMap';

type Props = Parameters<typeof CommandEscalationMap>[0];
type PreviewNode = { type: unknown; props: Record<string, unknown> };
function loadMap(initialProps: Props) {
  const state: unknown[] = [];
  let cursor = 0;
  let props = initialProps;
  const routes: string[] = [];
  const react = {
    __esModule: true,
    default: {
      createElement: (type: unknown, elementProps: Record<string, unknown> | null, ...children: unknown[]) =>
        ({ type, props: { ...elementProps, children } }),
    },
    useState(initial: unknown) {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
      return [state[index], (next: unknown) => {
        state[index] = typeof next === 'function' ? (next as (current: unknown) => unknown)(state[index]) : next;
      }];
    },
    useMemo(factory: () => unknown) { return factory(); },
    // Effects only schedule a clock update or cleanup; native timers are inert in this harness.
    useEffect() {},
  };
  const dependencies: Record<string, unknown> = {
    react,
    'react-native': { Text: 'Text', TouchableOpacity: 'TouchableOpacity', View: 'View' },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    'expo-router': { useRouter: () => ({ push: (href: string) => routes.push(href) }) },
    '../map/officialMapReports': { officialReportMapMarker: (report: { id: string }) => ({ id: report.id }) },
    '../../lib/reportLifecycle': { officialLabel: (lifecycle: { primaryStage: string }) => lifecycle.primaryStage },
    '../map/InteractiveMap': { __esModule: true, default: 'InteractiveMap' },
    '../../lib/incidentTypes': {
      formatIncidentType: (value: string, otherDescription?: string | null) =>
        value === 'other' ? otherDescription?.trim() || 'Other' : value,
    },
    '../../lib/reportPresentation': {
      scopedLifecyclePresentation: (lifecycle: { primaryStage: string }) => ({
        stageLabel: lifecycle.primaryStage,
        tone: { color: 'blue', softColor: 'pale-blue' },
        coordinationLabel: null,
        leadLabel: null,
        reviewLabel: null,
        note: null,
      }),
    },
    '../../lib/reports': {
      getMapReportPresentation: () => ({ color: 'red', backgroundColor: 'pink' }),
      getReportStatusPresentation: (status: string) => ({ color: status === 'escalated' ? 'red' : 'green' }),
    },
    '../../styles/theme': { colors: { white: 'white', text: 'black', navigationActive: 'blue' } },
    '../../styles/screens/mdrrmoCommand.styles': { mdrrmoCommandStyles: new Proxy({}, { get: (_target, key) => String(key) }) },
  };
  const compiled = ts.transpileModule(readFileSync(new URL('../components/official/CommandEscalationMap.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  });
  const runtimeExports: Record<string, unknown> = {};
  runInNewContext(compiled.outputText, {
    React: react.default,
    exports: runtimeExports,
    module: { exports: runtimeExports },
    setInterval: () => 1,
    clearInterval: () => {},
    require(name: string) { assert.ok(name in dependencies, `Unexpected dependency ${name}`); return dependencies[name]; },
  });
  const runtime = runtimeExports as { default: (input: Props) => PreviewNode };
  function render(nextProps = props): PreviewNode {
    props = nextProps;
    cursor = 0;
    return runtime.default(props);
  }
  function walk(value: unknown, predicate: (node: PreviewNode) => boolean): PreviewNode | null {
    if (Array.isArray(value)) {
      for (const child of value) { const found = walk(child, predicate); if (found) return found; }
      return null;
    }
    if (!value || typeof value !== 'object' || !('props' in value)) return null;
    const node = value as PreviewNode;
    return predicate(node) ? node : walk(node.props.children, predicate);
  }
  return { render, find: (predicate: (node: PreviewNode) => boolean) => walk(render(), predicate), routes };
}

function report(
  id: string,
  primaryStage: string,
  coordination: string,
  leadOffice: string,
): Props['reports'][number] {
  return {
    id, title: 'Flood report', description: 'Response team dispatched', incidentType: 'flood', incidentTypeOther: null,
    addressText: 'Central Road', barangayName: 'Workflow Local', reporterName: 'Resident', mediaCount: 0,
    createdAt: '2026-11-15T00:00:00Z', escalatedAt: null, escalationNote: null,
    latitude: 10.25, longitude: 123.8, lifecycle: { primaryStage },
    lifecycleFacts: { reviewClaimedByName: null, reviewClaimedAt: null, coordination, leadOffice, municipalFinding: null },
  } as unknown as Props['reports'][number];
}

function props(reports: Props['reports'], selectedLane: Props['selectedLane'], overrides: Partial<Props> = {}): Props {
  return {
    reports, selectedLane, onLaneChange: () => {}, requestCount: 0, activeCount: reports.length,
    laneLoading: false, laneError: null, onRetry: async () => {}, ...overrides,
  };
}

function text(node: PreviewNode): string {
  const value = node.props.children;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((child) => child && typeof child === 'object' && 'props' in child ? text(child as PreviewNode) : String(child ?? '')).join(' ');
  return '';
}

test('active municipal lifecycle reports remain present in the server-selected lane', () => {
  const activeCases = [
    report('accepted-support', 'response_ongoing', 'support_active', 'barangay'),
    report('accepted-provisional-transfer', 'being_assessed', 'municipal_lead', 'municipal'),
  ];
  for (const activeCase of activeCases) {
    const fixture = loadMap(props([activeCase], 'active'));
    const card = fixture.find((node) => node.type === 'Text' && text(node).toLowerCase().includes('flood'));
    assert.ok(card, `${activeCase.id} report should remain rendered`);
    const markerMap = fixture.find((node) => node.type === 'InteractiveMap');
    assert.ok(markerMap);
    assert.equal((markerMap.props.markers as { id: string }[])[0].id, activeCase.id);
  }
  const provisionalCard = loadMap(props([activeCases[1]], 'active'))
    .find((node) => node.type === 'Text' && text(node).includes('BEING_ASSESSED'));
  assert.ok(provisionalCard);
  assert.ok(text(provisionalCard).includes('BEING_ASSESSED'));
});

test('lane tabs stay available during active loading/errors and queue link follows the lane', () => {
  let selectedLane: Props['selectedLane'] = 'active';
  const fixture = loadMap(props([], selectedLane, { laneLoading: true, onLaneChange: (lane) => { selectedLane = lane; } }));
  let requestsTab = fixture.find((node) => node.props.accessibilityLabel === 'Requests, 0');
  assert.ok(requestsTab);
  (requestsTab.props.onPress as () => void)();
  assert.equal(selectedLane, 'requests');
  const requestQueueFixture = loadMap(props([], 'requests'));
  const requestQueue = requestQueueFixture.find((node) => node.type === 'TouchableOpacity' && node.props.accessibilityLabel === 'View 0 requests');
  assert.ok(requestQueue);
  (requestQueue.props.onPress as () => void)();
  assert.ok(requestQueueFixture.routes.at(-1)?.includes('queue=incoming_requests'));
  const activeQueueFixture = loadMap(props([], 'active'));
  const activeQueue = activeQueueFixture.find((node) => node.type === 'TouchableOpacity' && node.props.accessibilityLabel === 'View 0 active response');
  assert.ok(activeQueue);
  (activeQueue.props.onPress as () => void)();
  assert.ok(activeQueueFixture.routes.at(-1)?.includes('queue=municipal_active'));

  const errored = loadMap(props([], 'active', { laneError: 'Temporary failure' }));
  assert.ok(errored.find((node) => node.props.accessibilityLabel === 'Requests, 0'));
});

test('changing the selected lane resets the report pager to the first card', () => {
  const first = report('one', 'confirmed', 'municipal_lead', 'municipal');
  const second = report('two', 'response_ongoing', 'support_active', 'barangay');
  const fixture = loadMap(props([first, second], 'requests'));
  const next = fixture.find((node) => node.props.accessibilityLabel === 'Next request');
  assert.ok(next);
  (next.props.onPress as () => void)();
  const changed = props([first, second], 'active');
  fixture.render(changed);
  fixture.render(changed);
  const title = fixture.find((node) => node.type === 'Text' && text(node).toLowerCase().includes('flood'));
  assert.ok(title);
  const pager = fixture.find((node) => node.type === 'Text' && String(node.props.accessibilityLabel).includes('of 2'));
  assert.ok(pager);
  assert.ok(String(pager.props.accessibilityLabel).startsWith('1 of 2'));
});
