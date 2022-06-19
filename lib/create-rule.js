'use strict';

const utils = require('@typescript-eslint/utils');

const createRule = utils.ESLintUtils.RuleCreator(
  name => `https://github.com/Vetin/eslint-plugin-lifting/docs/${name}.md`,
);

module.exports = { createRule };
