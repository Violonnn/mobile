import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const sourceText = readFileSync(new URL('../app/official/map.tsx', import.meta.url), 'utf8');
const source = ts.createSourceFile('map.tsx', sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function roleBranch(role: string): ts.Statement {
  let result: ts.Statement | undefined;
  function visit(node: ts.Node): void {
    if (ts.isIfStatement(node) && ts.isBinaryExpression(node.expression)) {
      const comparison = node.expression;
      if (comparison.left.getText(source) === 'officialKind' &&
        comparison.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
        ts.isStringLiteral(comparison.right) && comparison.right.text === role) {
        result = node.thenStatement;
        return;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(result, `Missing explicit ${role} map branch`);
  return result;
}

function presentationAttributes(branch: ts.Statement): string[] {
  const result: string[] = [];
  function visit(node: ts.Node): void {
    if (ts.isJsxAttribute(node) && ['useScopedPresentation', 'reportLegendAudience'].includes(node.name.getText(source))) {
      result.push(node.name.getText(source));
    }
    ts.forEachChild(node, visit);
  }
  visit(branch);
  return result;
}

// Similar map instances previously made it easy to attach an opt-in to the wrong role.
test('experimental report presentation remains outside the Mayor map branch', () => {
  assert.deepEqual(presentationAttributes(roleBranch('Mayor')), []);
  for (const role of ['MDRRMO', 'BDRRMO']) {
    assert.deepEqual(presentationAttributes(roleBranch(role)).sort(), [
      'reportLegendAudience', 'useScopedPresentation',
    ]);
  }
});
