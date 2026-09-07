import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const sourceRoots = ['app', 'components', 'hooks', 'lib', 'utils'];

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

const files = sourceRoots.flatMap(walk).filter((file) => /\.[jt]sx?$/.test(file));
const importers = new Map(files.map((file) => [file, new Set()]));
const crossRouteImports = [];

function resolveImport(importer, specifier) {
  const base = specifier.startsWith('@/')
    ? specifier.slice(2)
    : specifier.startsWith('.')
      ? path.normalize(path.join(path.dirname(importer), specifier))
      : null;
  if (!base) return null;
  return [
    base,
    ...['.tsx', '.ts', '.jsx', '.js', '/index.ts', '/index.tsx'].map((ext) => base + ext),
  ].find((candidate) => importers.has(candidate));
}

for (const file of files) {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  function visit(node) {
    const specifier =
      ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
        ? node.moduleSpecifier
        : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
          ? node.arguments[0]
          : undefined;
    if (specifier && ts.isStringLiteral(specifier)) {
      const target = resolveImport(file, specifier.text);
      if (target) {
        importers.get(target).add(file);
        if (
          target.startsWith('app/') &&
          !target.startsWith('app/actions/') &&
          (!file.startsWith('app/') || file.split('/')[1] !== target.split('/')[1])
        ) {
          crossRouteImports.push({ importer: file, target });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

function inheritedFile(file, name) {
  let directory = path.dirname(file);
  while (directory === 'app' || directory.startsWith('app/')) {
    const candidate = `${directory}/${name}.tsx`;
    if (importers.has(candidate)) return candidate;
    directory = path.dirname(directory);
  }
  return null;
}

const pages = files
  .filter((file) => file.endsWith('/page.tsx'))
  .sort()
  .map((file) => {
    const source = readFileSync(file, 'utf8');
    return {
      file,
      route:
        '/' +
        file
          .split('/')
          .slice(1, -1)
          .filter((part) => !part.startsWith('('))
          .join('/'),
      group: file.split('/')[1],
      kind: /\bredirect\(/.test(source)
        ? 'redirect or conditional redirect'
        : /<ComingSoon\b/.test(source)
          ? 'placeholder'
          : 'page',
      loading: inheritedFile(file, 'loading'),
      error: inheritedFile(file, 'error'),
    };
  });
const components = files.filter((file) => file.startsWith('components/'));
const report = {
  counts: { sourceModules: files.length, componentModules: components.length, pages: pages.length },
  groups: Object.fromEntries(
    [...new Set(pages.map((page) => page.group))].map((group) => [
      group,
      pages.filter((page) => page.group === group).length,
    ]),
  ),
  // Re-exports count as references. These are review candidates, not proof that
  // every export in a referenced module is used, or permission to delete it.
  unreferencedComponentModules: components.filter((file) => importers.get(file).size === 0),
  crossRouteImports,
  pages,
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(
    `${report.counts.pages} pages; ${report.counts.componentModules} component modules; ${report.counts.sourceModules} source modules`,
  );
  console.table(report.groups);
  console.log('Unreferenced component candidates:', report.unreferencedComponentModules);
  console.log('Cross-route imports:', report.crossRouteImports);
  console.table(
    pages.map(({ route, group, kind, loading, error }) => ({
      route,
      group,
      kind,
      loading: Boolean(loading),
      error: Boolean(error),
    })),
  );
}
