// node -r esm testrun
process.env.NODE_ENV = 'production';
const { TMX2TODS } = require('./TMX2TODS');

const sourceDir = `./sourceFiles`;
const targetDir = `./output`;

TMX2TODS({
  disableProgress: true,
  sourceDir,
  targetDir,
  // count: 1,
});
