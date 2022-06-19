const { argsDestructing, avoidTypeLiterals } = require('./rules');

module.exports = {
  rules: {
    'avoid-type-literals': avoidTypeLiterals,
    'args-destructing': argsDestructing,
  },
  configs: {
    recommended: {
      'avoid-type-literals': 'error',
      'args-destructing': 'error',
    },
  },
};
