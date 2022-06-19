const { argsDestructing, avoidTypeLiterals } = require('./src');

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
