// Repository-specific ESLint rules for mechanical readability requirements.

const PLAN_REFERENCE_PATTERNS = [
  /\bPR\s*#?\d+(?:\.\d+)?\b/iu,
  /\brebuild\/[\w-]+\b/iu,
  /\b(?:future|later|next)\s+(?:PR|stage)\b/iu,
  /\b(?:added|removed|deferred)\s+in\s+(?:PR|stage)\b/iu,
  /\buntil\s+(?:PR|stage)\b/iu,
];

function hasPurposeComment(sourceCode, node) {
  const documentedNode = node.parent?.type.startsWith('Export') ? node.parent : node;
  const comment = sourceCode.getCommentsBefore(documentedNode).at(-1);
  if (!comment || comment.type !== 'Block' || !comment.value.startsWith('*')) return false;
  return comment.loc.end.line === documentedNode.loc.start.line - 1;
}

function reportMissingPurposeComment(context, node) {
  if (!hasPurposeComment(context.sourceCode, node)) {
    context.report({ node, messageId: 'missing' });
  }
}

function reportPublicClassMethods(context, declaration) {
  if (declaration?.type !== 'ClassDeclaration') return;
  for (const member of declaration.body.body) {
    if (
      member.type === 'MethodDefinition' &&
      member.kind !== 'constructor' &&
      member.accessibility !== 'private'
    ) {
      reportMissingPurposeComment(context, member);
    }
  }
}

function functionFromDeclaration(declaration) {
  if (declaration?.type === 'FunctionDeclaration' || declaration?.type === 'ClassDeclaration') {
    return declaration;
  }
  return null;
}

function exportedFunctionValues(declaration) {
  if (declaration?.type !== 'VariableDeclaration') return [];
  return declaration.declarations
    .filter(
      (item) =>
        item.init?.type === 'ArrowFunctionExpression' || item.init?.type === 'FunctionExpression',
    )
    .map((item) => item);
}

function findLocalDeclaration(program, name) {
  for (const statement of program.body) {
    if (
      (statement.type === 'FunctionDeclaration' || statement.type === 'ClassDeclaration') &&
      statement.id?.name === name
    ) {
      return statement;
    }
    if (statement.type === 'VariableDeclaration') {
      const declaration = statement.declarations.find((item) => item.id.name === name);
      if (
        declaration?.init?.type === 'ArrowFunctionExpression' ||
        declaration?.init?.type === 'FunctionExpression'
      ) {
        return statement;
      }
    }
  }
  return null;
}

const exportDoc = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Require a purpose doc comment on handwritten function exports.' },
    schema: [],
    messages: { missing: "Add an adjacent /** */ comment explaining this export's purpose." },
  },
  create(context) {
    return {
      ExportNamedDeclaration(node) {
        const declaration = functionFromDeclaration(node.declaration);
        if (declaration) reportMissingPurposeComment(context, declaration);
        reportPublicClassMethods(context, declaration);
        if (exportedFunctionValues(node.declaration).length > 0) {
          reportMissingPurposeComment(context, node.declaration);
        }
        if (!node.source && node.exportKind !== 'type') {
          for (const specifier of node.specifiers) {
            const localDeclaration = findLocalDeclaration(
              context.sourceCode.ast,
              specifier.local.name,
            );
            if (localDeclaration) reportMissingPurposeComment(context, localDeclaration);
            reportPublicClassMethods(context, localDeclaration);
          }
        }
      },
      ExportDefaultDeclaration(node) {
        const declaration = functionFromDeclaration(node.declaration);
        if (declaration) reportMissingPurposeComment(context, declaration);
        reportPublicClassMethods(context, declaration);
      },
    };
  },
};

const disableReason = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Require narrow ESLint disables with an explanatory reason.' },
    schema: [],
    messages: {
      broad: 'Use a line-scoped ESLint disable instead of disabling a rule for a whole file.',
      reason: 'Add a descriptive "-- reason" to this ESLint disable.',
    },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          const directive = comment.value.trim();
          if (!/^eslint-disable(?:-next-line|-line)?(?:\s|$)/u.test(directive)) continue;
          if (/^eslint-disable(?:\s|$)/u.test(directive)) {
            context.report({ loc: comment.loc, messageId: 'broad' });
            continue;
          }
          if (!/\s--\s\S/u.test(directive)) {
            context.report({ loc: comment.loc, messageId: 'reason' });
          }
        }
      },
    };
  },
};

function containsPlanReference(value) {
  return PLAN_REFERENCE_PATTERNS.some((pattern) => pattern.test(value));
}

const noPlanHistory = {
  meta: {
    type: 'problem',
    docs: { description: 'Keep temporary build-plan history out of maintained source.' },
    schema: [],
    messages: { reference: 'Describe current behaviour without PR, stage or branch history.' },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (containsPlanReference(comment.value)) {
            context.report({ loc: comment.loc, messageId: 'reference' });
          }
        }
      },
      Literal(node) {
        if (
          typeof node.value === 'string' &&
          node.parent?.type === 'CallExpression' &&
          node.parent.arguments[0] === node &&
          containsPlanReference(node.value)
        ) {
          context.report({ node, messageId: 'reference' });
        }
      },
    };
  },
};

export default {
  rules: {
    'disable-reason': disableReason,
    'export-doc': exportDoc,
    'no-plan-history': noPlanHistory,
  },
};
