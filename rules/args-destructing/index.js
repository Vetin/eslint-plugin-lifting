'use strict';

const utils = require('@typescript-eslint/utils');

const { createRule } = require('../../lib');

const argsDestructing = createRule({
  name: 'args-destructing',
  meta: {
    type: 'problem',
    docs: {
      recommended: 'error',
      description: 'Arguments destruction dissalowed',
    },
    messages: {
      destruction: 'Arguments destruction dissalowed',
    },
    schema: [],
    fixable: 'code',
  },
  defaultOptions: [],
  create(context) {
    const source = context.getSourceCode();

    return {
      ObjectPattern: node => {
        let fnNode;
        if (!node.parent) return;

        if (isFn(node.parent)) fnNode = node.parent;

        if (
          node.parent.type === utils.AST_NODE_TYPES.AssignmentPattern &&
          isFn(node.parent.parent)
        )
          fnNode = node.parent.parent;

        if (!fnNode) return;

        if (fnNode.body.type !== utils.AST_NODE_TYPES.BlockStatement) return;

        const { params } = node.parent;
        return context.report({
          messageId: 'destruction',
          node,
          loc: node.loc,
          fix: fixer => {
            const fnText = source.getText(fnNode);

            const issueText = source.getText(node);
            const issuePosition = fnText.indexOf(issueText);

            if (issuePosition === -1) return;

            const fixerRangeStart = node.range[0];
            const fixerRangeEnd = fnNode.body.range[0] + 1;

            const issueFnText = fnText.slice(
              issuePosition,
              fnNode.body.range[0] - fnNode.range[0],
            );

            const preparedText = prepareText(node, issueText);

            const fixedFnText =
              issueFnText.replace(preparedText, DEFAULT_FN_ARG_NAME) +
              `{\n\tconst ${preparedText} = ${DEFAULT_FN_ARG_NAME};\n`;

            return fixer.replaceTextRange(
              [fixerRangeStart, fixerRangeEnd],
              fixedFnText,
            );
          },
        });
      },
    };
  },
});

function prepareText(node, nodeText) {
  if (!node.typeAnnotation) return nodeText;
  return nodeText.substr(0, node.typeAnnotation.range[0] - node.range[0]);
}

const isFn = node =>
  node.type === utils.AST_NODE_TYPES.FunctionDeclaration ||
  node.type === utils.AST_NODE_TYPES.FunctionExpression ||
  node.type === utils.AST_NODE_TYPES.ArrowFunctionExpression;

const DEFAULT_FN_ARG_NAME = 'payload';

module.exports = argsDestructing;
