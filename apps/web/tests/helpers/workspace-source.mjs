import { readFileSync } from 'node:fs';

// Source guards follow the shared pieces each shell actually renders.
export function withWorkspaceSource(source) {
  const dependencies = [];
  if (source.includes('<WorkspaceShell')) dependencies.push('WorkspaceShell');
  if (source.includes('<WorkspaceAccountMenu')) dependencies.push('WorkspaceAccountMenu');
  return [
    source,
    ...dependencies.map((name) =>
      readFileSync(new URL(`../../ui/shell/${name}.tsx`, import.meta.url), 'utf8'),
    ),
  ].join('\n');
}
