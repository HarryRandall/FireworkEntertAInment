/** Discover renderer integrations rather than maintaining a partial list of page names. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import ts from 'typescript';

function insideSurface(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isJsxElement(parent) && parent.openingElement.tagName.getText() === 'CanvasSurface')
      return true;
  }
  return false;
}

test('every viewer, poster and legacy canvas mount uses the shared clipping surface', (t) => {
  let mounts = 0;
  for (const root of ['app', 'ui']) {
    for (const relative of readdirSync(root, { recursive: true }).filter((file) =>
      file.endsWith('.tsx'),
    )) {
      const path = `${root}/${relative}`;
      const source = readFileSync(path, 'utf8');
      const ast = ts.createSourceFile(
        path,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      const stages = new Set([
        'ShowRendererCanvas',
        'FireworkReplayCanvas',
        'ImportRenderHarness',
        'DesignPreview',
      ]);
      // Follow dynamic and memo aliases, including imports of the shared preset adapter.
      function aliases(node) {
        if (
          ts.isVariableDeclaration(node) &&
          node.initializer &&
          (/import\(['"]@\/ui\/replay\/(ShowRendererCanvas|FireworkReplayCanvas)['"]\)/.test(
            node.initializer.getText(ast),
          ) ||
            [...stages].some((name) => node.initializer.getText(ast) === `memo(${name})`))
        )
          stages.add(node.name.getText(ast));
        if (
          ts.isImportDeclaration(node) &&
          /ShowPresetReplayCanvas/.test(node.moduleSpecifier.getText(ast))
        ) {
          const bindings = node.importClause?.namedBindings;
          if (bindings && ts.isNamedImports(bindings))
            for (const entry of bindings.elements) stages.add(entry.name.text);
        }
        ts.forEachChild(node, aliases);
      }
      aliases(ast);
      const viewerRefs = [];
      function findViewer(node) {
        if (ts.isNewExpression(node) && node.expression.getText(ast) === 'Viewer') {
          const mount = node.arguments?.[0]?.getText(ast).match(/^(\w+)\.current$/)?.[1];
          assert.ok(mount, `${path}: viewer mount must use an owned ref`);
          viewerRefs.push(mount);
        }
        ts.forEachChild(node, findViewer);
      }
      findViewer(ast);
      const foundRefs = new Set();
      function inspect(node) {
        if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
          const tag = node.tagName.getText(ast);
          if (stages.has(tag) || (tag === 'canvas' && /\bposter\(/.test(source))) {
            mounts++;
            // Sealed harness bytes retain their fixed-step evidence identity. Its route owns clipping.
            if (path === 'app/internal/import-render/ImportRenderHarness.tsx') {
              const route = readFileSync('app/internal/import-render/page.tsx', 'utf8');
              assert.match(
                route,
                /<CanvasSurface[^>]*>[\s\S]*<ImportRenderHarness \/>[\s\S]*<\/CanvasSurface>/,
              );
              return;
            }
            assert.ok(insideSurface(node), `${path}: ${tag} escapes CanvasSurface`);
          }
          for (const attribute of node.attributes.properties) {
            if (
              !ts.isJsxAttribute(attribute) ||
              attribute.name.getText(ast) !== 'ref' ||
              !attribute.initializer ||
              !ts.isJsxExpression(attribute.initializer)
            )
              continue;
            const ref = attribute.initializer.expression?.getText(ast);
            if (viewerRefs.includes(ref)) {
              mounts++;
              foundRefs.add(ref);
              assert.equal(
                tag,
                'CanvasSurface',
                `${path}: Viewer ref ${ref} must mount on CanvasSurface`,
              );
            }
          }
        }
        ts.forEachChild(node, inspect);
      }
      inspect(ast);
      for (const ref of viewerRefs)
        assert.ok(foundRefs.has(ref), `${path}: missing Viewer surface ${ref}`);
    }
  }
  assert.ok(mounts > 0);
  t.diagnostic(`${mounts} canvas integration mounts checked across all app and UI sources`);
});
