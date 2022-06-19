'use strict';

/**
 * @param {import('@typescript-eslint/utils').TSESLintScope.Scope} scope
 * @returns {Map<string, string>}
 */
function collectIdentifiers(scope) {
  const identifiersMap = {};
  for (const variable of scope.variables) {
    if (variable.identifiers.length === 0) continue;
    for (const identifier of variable.identifiers) {
      identifiersMap[identifier.name] = identifier.name;
    }
  }
  return identifiersMap;
}

module.exports = { collectIdentifiers };
