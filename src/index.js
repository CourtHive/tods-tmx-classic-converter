import { SingleBar, Presets } from 'cli-progress';
import { convertTMX2TODS } from './convertTMX2TODS';
import fs from 'fs';

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

  const orgs = { no_org: { count: 0 } };

  const files = fs
    .readdirSync(sourcePath)
    .filter(
      filename =>
        filename.indexOf('.json') > 0 &&
        filename.split('.').reverse()[0] === 'json'
    );
  count = count || files.length;

  const progressBar = new SingleBar({}, Presets.shades_classic);
  progressBar.start(count, 0);

  files.slice(0, count).forEach((file, index) => {
    const tournamentRaw = fs.readFileSync(`${sourcePath}/${file}`, 'UTF8');
    const tournament = JSON.parse(tournamentRaw);

    if (tournament?.tuid) {
      try {
        const { tournamentRecord } = convertTMX2TODS({ tournament });
        const organisationId =
          tournamentRecord.parentOrganisationId ||
          tournamentRecord.unifiedTournamentId?.organisationId ||
          'no_org';
        if (tournamentRecord.unifiedTournamentId && !orgs[organisationId]) {
          orgs[organisationId] = {
            count: 1,
            ...tournamentRecord.unifiedTournamentId,
          };
          delete orgs[organisationId].tournamentId;
        } else {
          orgs[organisationId].count += 1;
        }
        const orgPath = organisationId ? `/${organisationId}` : '';
        if (orgPath) {
          if (!fs.existsSync(`${targetPath}${orgPath}`)) {
            fs.mkdirSync(`${targetPath}${orgPath}`);
          }
        }
        fs.writeFileSync(
          `${targetPath}${orgPath}/${tournament.tuid}${targetExtension}`,
          JSON.stringify(tournamentRecord, undefined, 2),
          'UTF-8'
        );
      } catch (err) {
        console.log({ err });
      }
    }

    progressBar.update(index + 1);
  });

  if (Object.keys(orgs).length) {
    fs.writeFileSync(
      `${targetPath}/orgs.json`,
      JSON.stringify(orgs, undefined, 2),
      'UTF-8'
    );
  }
  progressBar.stop();
}

export default TMX2TODS;
