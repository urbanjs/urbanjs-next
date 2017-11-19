'use strict';

const gulp = require('gulp');
const tools = require('urbanjs-tools');

tools.setGlobalConfiguration(defaults => ({
  babel: false,
  typescript: require('../tsconfig.json').compilerOptions,
  sourceFiles: defaults.sourceFiles.concat('examples/**/*.ts')
}));

tools.initialize(gulp, {
  babel: {
    emitOnError: false
  },

  'check-dependencies': true,

  'check-file-names': true,

  'conventional-changelog': true,

  mocha: {
    collectCoverage: false
  },

  nsp: true,

  retire: true,

  tslint: {
    configFile: '../../tslint.json'
  }
});

tools.tasks.mocha.register(gulp, 'test-e2e', {
  collectCoverage: false,
  files: 'examples/*-tests.ts'
});
