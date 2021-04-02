import { convertTMX2TODS } from './convertTMX2TODS';
export { convertTMX2TODS } from './convertTMX2TODS';

// collectionDefinitions, ratings category ranges (event.ratings_filter: { high: #, low: #}), Round Robins
// player Representatives
// Compressed draw structures... with D3 visualizations works fine... may not work with React-draws
// drawEngine.buildDrawHierarchy is not handling pre-round structures which have only one children[] attribute rather than true hierarchy

export function TMX2TODS({
  count,
  sourceDir,
  targetDir,
  targetExtension = '.tods.json',
} = {}) {
  const sourcePath = sourceDir || '.';
  const targetPath = targetDir || '.';

  const files = fs
    .readdirSync(sourcePath)
    .filter(
      filename =>
        filename.indexOf('.json') > 0 &&
        filename.split('.').reverse()[0] === 'json'
    );
  count = count || files.length;

  files.slice(0, count).forEach(file => {
    const tournamentRaw = fs.readFileSync(`${sourcePath}/${file}`, 'UTF8');
    const tournament = JSON.parse(tournamentRaw);

    if (tournament?.tuid) {
      try {
        const { tournamentRecord } = convertTMX2TODS({ tournament });
        fs.writeFileSync(
          `${targetPath}/${tournament.tuid}${targetExtension}`,
          JSON.stringify(tournamentRecord, undefined, 2),
          'UTF-8'
        );
      } catch (err) {
        console.log({ err });
      }
    }
  });
}

export default TMX2TODS;
