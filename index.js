module.exports = {
  rules: {
    'avoid-type-literals': require('./rules/avoid-type-literals'),
    'args-destructing': require('./rules/args-destructing'),
  },
  configs: {
    recommended: {
      rules: {
        'lifting/avoid-type-literals': 'error',
        'lifting/args-destructing': 'error',
      },
    },
  },
};
