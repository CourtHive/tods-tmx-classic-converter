// node -r esm testrun
const { TMX2TODS } = require('./TMX2TODS');
const minimist = require('minimist');
process.env.NODE_ENV = 'production';

const args = minimist(process.argv.slice(2), {
  alias: { i: 'inDir', o: 'outDir', c: 'count', s: 'start' },
  default: { inDir: './sourceFiles', outDir: './output' },
});

const sourceDir = args.sourceDir || `./sourceFiles`;
const targetDir = args.targetDir || `./output`;

TMX2TODS({
  disableProgress: true,
  targetDir: args.outDir,
  sourceDir: args.inDir,
  count: args.count,
  start: args.start,
});
