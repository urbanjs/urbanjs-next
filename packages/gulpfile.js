'use strict';

const path = require('path');
const gulp = require('gulp');
const tools = require('urbanjs-tools');
const typedoc = require('gulp-typedoc');

const compilerOptions = require('../tsconfig.json').compilerOptions;
const cwd = process.cwd();

tools.setGlobalConfiguration(defaults => ({
  babel: false,
  typescript: compilerOptions,
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
  },

  doc: ['typedoc']
});

gulp.task('typedoc', () =>
  gulp
    .src([
      path.join(cwd, 'src/**/*.ts'),
      `!${path.join(cwd, 'src/**/index.ts')}`,
      `!${path.join(cwd, 'src/**/*-tests.ts')}`,
    ])
    .pipe(typedoc({
      theme: 'default',
      tsconfig: path.join(__dirname, '../tsconfig.json'),
      out: './help'
    }))
);

tools.tasks.mocha.register(gulp, 'test-e2e', {
  collectCoverage: false,
  files: 'examples/*-tests.ts'
});
