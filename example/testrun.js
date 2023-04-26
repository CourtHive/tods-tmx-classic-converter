// node -r esm testrun
process.env.NODE_ENV = 'production';
const { TMX2TODS } = require('./TMX2TODS');

// const sourceDir = `./sourceFiles`;
const sourceDir = `../../legacy-json-tournaments`;
const targetDir = `./output`;

TMX2TODS({ sourceDir, targetDir, disableProgress: true });
