import path from 'node:path';

function localTarget(importer, specifier) {
  if (specifier.startsWith('@/')) return path.posix.normalize(specifier.slice(2));
  if (specifier.startsWith('.'))
    return path.posix.normalize(path.posix.join(path.posix.dirname(importer), specifier));
  return null;
}

export function importBoundaryViolation(importer, specifier) {
  const target = localTarget(importer, specifier);
  if (!target || /\.(?:css|svg|png|jpg|webp)$/.test(target)) return null;

  if (
    importer.startsWith('components/ui/') &&
    (target.startsWith('app/') ||
      (target.startsWith('components/') && !target.startsWith('components/ui/')))
  ) {
    return 'UI primitives must not depend on product components or routes.';
  }
  if (
    importer.startsWith('components/design-system/') &&
    (target.startsWith('app/') ||
      (target.startsWith('components/') &&
        !target.startsWith('components/design-system/') &&
        !target.startsWith('components/ui/')))
  ) {
    return 'Design-system patterns may compose UI primitives, not product features or routes.';
  }
  if (!target.startsWith('app/') || target.startsWith('app/actions/')) return null;
  if (importer.startsWith('components/')) {
    return 'Move shared route code into its component domain or lib before importing it here.';
  }
  if (importer.startsWith('app/')) {
    const owner = target.includes('/_components/') ? target.split('/_components/')[0] : null;
    if (
      importer.split('/')[1] !== target.split('/')[1] ||
      (owner && !importer.startsWith(`${owner}/`))
    ) {
      return 'Route implementation belongs to its route subtree. Promote reused code to a shared domain.';
    }
  }
  return null;
}

const boundaries = {
  meta: { type: 'problem', schema: [], messages: { boundary: '{{reason}}' } },
  create(context) {
    const importer = path.relative(context.cwd, context.filename).split(path.sep).join('/');
    function inspect(node) {
      const source = node.source;
      if (source?.type !== 'Literal' || typeof source.value !== 'string') return;
      const reason = importBoundaryViolation(importer, source.value);
      if (reason) context.report({ node: source, messageId: 'boundary', data: { reason } });
    }
    return {
      ImportDeclaration: inspect,
      ExportNamedDeclaration: inspect,
      ExportAllDeclaration: inspect,
      ImportExpression: inspect,
    };
  },
};

const semanticColours = {
  meta: {
    type: 'suggestion',
    schema: [],
    messages: {
      colour:
        'Use a semantic theme token for shared UI colours. Keep colour values in styles/theme.css.',
    },
  },
  create(context) {
    function inspect(node, value) {
      if (/\b(?:bg|text|border|ring|fill|stroke)-\[(?:#|(?:rgb|hsl|oklch)\()/.test(value)) {
        context.report({ node, messageId: 'colour' });
      }
    }
    return {
      Literal(node) {
        if (typeof node.value === 'string') inspect(node, node.value);
      },
      TemplateElement(node) {
        inspect(node, node.value.raw);
      },
    };
  },
};

const architecture = { rules: { boundaries, 'semantic-colours': semanticColours } };
export default architecture;
