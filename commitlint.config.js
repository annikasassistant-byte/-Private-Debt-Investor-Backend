/** @type {import('@commitlint/types').UserConfig} */
export default {
  // Accept any non-empty commit message (conventional optional)
  parserPreset: {
    parserOpts: {
      headerPattern: /^(.*)$/,
      headerCorrespondence: ['header'],
    },
  },
  rules: {
    'header-max-length': [2, 'always', 100],
  },
};
