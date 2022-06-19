'use strict';

const utils = require('@typescript-eslint/utils');

const { createRule, collectIdentifiers, capitalize } = require('../../lib');

const avoidTypeLiterals = createRule({
  name: 'avoid-type-literals',
  meta: {
    type: 'suggestion',
    docs: {
      recommended: 'error',
      description: 'Disallow use type literals not for type definition',
    },
    messages: {
      generic:
        'Unexpected type literal was provided. Replace it with type defintion',
      intersection: 'Unexpected usage of intersection type literals',
    },
    schema: [],
    fixable: 'code',
  },
  defaultOptions: [],
  create(context) {
    const source = context.getSourceCode();
    const scope = context.getScope();

    const identifiersMap = collectIdentifiers(scope);

    return {
      // TODO: Migrate from string api to reconstructing types from AST and merge duplicated keys correctly
      TSIntersectionType: node => {
        const typeLiterals = node.types.filter(
          type => type.type === utils.AST_NODE_TYPES.TSTypeLiteral,
        );

        if (typeLiterals.length < 2) return;

        context.report({
          messageId: 'intersection',
          node,
          loc: node.loc,
          fix: fixer => {
            const actionNode = takeRootActionNode(node);

            const actionText = source.getText(actionNode);

            const merged =
              typeLiterals.reduce(
                (acc, literal) =>
                  acc +
                  literal.members.reduce(
                    (total, literalMember) =>
                      total + source.getText(literalMember) + ',',
                    '',
                  ),
                '{',
              ) + '}';

            const definedTypes = node.types
              .filter(type => type.type !== utils.AST_NODE_TYPES.TSTypeLiteral)
              .map(type => source.getText(type))
              .join(' & ');

            return fixer.replaceText(node, merged + ' & ' + definedTypes);
          },
        });
      },
      TSTypeLiteral: node => {
        if (!node.parent) return;

        if (
          node.parent.type === utils.AST_NODE_TYPES.TSIntersectionType &&
          node.parent.types.filter(
            type => type.type === utils.AST_NODE_TYPES.TSTypeLiteral,
          ).length > 1
        )
          return; // handled by TSIntersectionType

        if (node.parent.type !== utils.AST_NODE_TYPES.TSTypeAliasDeclaration)
          return context.report({
            node,
            messageId: 'generic',
            loc: node.loc,
            fix: fixer => {
              const actionNode = takeRootActionNode(node);

              const actionNodeText = source.getText(actionNode);

              const typeLiteralNode = source.getText(node);

              const typeName = createTypeNameByActionNode(actionNode, node);

              const uniqueName = unifyName(typeName, identifiersMap);

              const fixedActionNodeText = actionNodeText.replace(
                typeLiteralNode,
                uniqueName,
              );

              identifiersMap[uniqueName] = uniqueName;

              return fixer.replaceText(
                actionNode,
                `interface ${uniqueName} ${typeLiteralNode}\n\n` +
                  `${fixedActionNodeText}`,
              );
            },
          });
      },
    };
  },
});

/**
 * @returns {import('@typescript-eslint/utils').TSESTree.BaseNode} node
 */
const takeRootActionNode = node =>
  node?.parent?.parent ? takeRootActionNode(node.parent) : node;
``;

const TYPE_POSTFIX_BY_LITERAL_TYPE_MAP = {
  [utils.AST_NODE_TYPES.TSTypeParameterInstantiation]: 'Generic',
  [utils.AST_NODE_TYPES.TSTypeAnnotation]: '',
  [utils.AST_NODE_TYPES.TSIntersectionType]: 'Type',
  [utils.AST_NODE_TYPES.TSArrayType]: 'Item',
  [utils.AST_NODE_TYPES.TSTupleType]: '',
};

function createTypeNameByActionNode(actionNode, literalNode) {
  const name = takeActionNodeName(actionNode);
  const postfix = takeTypePostfix(actionNode, literalNode);

  return capitalize(`${name}${postfix}`);
}

/**
 * @param {import('@typescript-eslint/utils').TSESTree.Node} node
 */
function takeActionNodeName(node) {
  if (
    node.type === utils.AST_NODE_TYPES.TSTypeAliasDeclaration ||
    node.type === utils.AST_NODE_TYPES.FunctionDeclaration ||
    node.type === utils.AST_NODE_TYPES.TSInterfaceDeclaration
  )
    return node.id.name;

  if (node.type === utils.AST_NODE_TYPES.VariableDeclaration) {
    return node.declarations[0]?.id.name || '';
  }

  return ''; //should be unreachable;
}

/**
 * @param {import('@typescript-eslint/utils').TSESTree.Node} actionNode
 * @param {import('@typescript-eslint/utils').TSESTree.Node} literalNode
 */
function takeTypePostfix(actionNode, literalNode) {
  if (
    actionNode.type === utils.AST_NODE_TYPES.VariableDeclaration ||
    actionNode.type === utils.AST_NODE_TYPES.FunctionDeclaration
  )
    return isPayloadAnnotation(literalNode) || isFnCallGeneric(literalNode)
      ? 'Payload'
      : isReturnAnnotation(literalNode) || isReturnAs(literalNode)
      ? 'Result'
      : isFnParameterGeneric(literalNode)
      ? 'Generic'
      : ''; // should be unreachable

  if (
    (actionNode.type === utils.AST_NODE_TYPES.TSTypeAliasDeclaration ||
      actionNode.type === utils.AST_NODE_TYPES.TSInterfaceDeclaration) &&
    isNestedTypeLiteralAnnotation(literalNode)
  )
    return capitalize(literalNode.parent.parent.key.name);

  return (
    TYPE_POSTFIX_BY_LITERAL_TYPE_MAP[literalNode.parent.type] ?? '' // should be unreachable
  );
}
/**
 * @param {import('@typescript-eslint/utils').TSESTree.Node} literalNode
 */
const isPayloadAnnotation = literalNode =>
  conditionLifting(literalNode.parent, [
    node => node.type === utils.AST_NODE_TYPES.TSTypeAnnotation,
    node => node.type === utils.AST_NODE_TYPES.Identifier,
    node =>
      node.type === utils.AST_NODE_TYPES.ArrowFunctionExpression ||
      node.type === utils.AST_NODE_TYPES.FunctionDeclaration ||
      node.type === utils.AST_NODE_TYPES.CallExpression,
  ]);

const isFnCallGeneric = literalNode =>
  conditionLifting(literalNode.parent, [
    node => node.type === utils.AST_NODE_TYPES.TSTypeParameterInstantiation,
    node => node.type === utils.AST_NODE_TYPES.CallExpression,
  ]);

const isFnParameterGeneric = literalNode =>
  conditionLifting(literalNode.parent, [
    node => node.type === utils.AST_NODE_TYPES.TSTypeParameter,
    node => node.type === utils.AST_NODE_TYPES.TSTypeParameterDeclaration,
  ]);

const isReturnAnnotation = literalNode =>
  conditionLifting(literalNode.parent, [
    node => node.type === utils.AST_NODE_TYPES.TSTypeAnnotation,
    node =>
      node.type === utils.AST_NODE_TYPES.ArrowFunctionExpression ||
      node.type === utils.AST_NODE_TYPES.FunctionDeclaration,
  ]);

const isReturnAs = literalNode =>
  conditionLifting(literalNode.parent, [
    node => node.type === utils.AST_NODE_TYPES.TSAsExpression,
    node => node.type === utils.AST_NODE_TYPES.ReturnStatement,
  ]);

const isNestedTypeLiteralAnnotation = literalNode =>
  conditionLifting(literalNode.parent, [
    node => node.type === utils.AST_NODE_TYPES.TSTypeAnnotation,
    node => node.type === utils.AST_NODE_TYPES.TSPropertySignature,
  ]);

function unifyName(name, usedNames, initialName = name) {
  if (name in usedNames) {
    const numbersCount =
      initialName.length - name.length < 0
        ? (initialName.length - name.length) * -1
        : initialName.length - name.length;
    const numbers = Number(name[name.length - numbersCount]);

    if (isNaN(numbers)) return unifyName(name + '1', usedNames, initialName);

    return unifyName(
      name.substr(0, name.length - numbersCount) + (numbers + 1),
      usedNames,
      initialName,
    );
  }

  return name;
}

function conditionLifting(startNode, conditions) {
  let node = startNode;
  for (const condition of conditions) {
    if (!condition(node)) {
      return false;
    }

    node = node.parent;
  }
  return true;
}

module.exports = avoidTypeLiterals;
