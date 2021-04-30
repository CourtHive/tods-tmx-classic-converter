// node -r esm testrun
const { TMX2TODS } = require('./TMX2TODS');

const sourceDir = `./sourceFiles`;
const targetDir = `./output`;

TMX2TODS({ sourceDir, targetDir, disableProgress: true });
