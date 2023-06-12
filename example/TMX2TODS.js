import { SingleBar, Presets } from 'cli-progress';
import { convertTMX2TODS } from '../dist';
import fs from 'fs';

export function TMX2TODS({
  targetExtension = '.tods.json',
  processParticipants,
  disableProgress,
  tournamentId,
  sourceDir,
  targetDir,
  count,
} = {}) {
  const sourcePath = sourceDir || '.';
  const targetPath = targetDir || '.';

  const orgs = { no_org: { count: 0 } };

  const participants = {};

  const filenames = fs
    .readdirSync(sourcePath)
    .filter(
      filename =>
        filename.indexOf('.json') > 0 &&
        filename.split('.').reverse()[0] === 'json'
    );
  count = count || filenames.length;

  const progressBar = new SingleBar({}, Presets.shades_classic);
  if (!disableProgress) progressBar.start(count, 0);

  filenames.slice(0, count).forEach((filename, index) => {
    const tournamentRaw = fs.readFileSync(`${sourcePath}/${filename}`, 'UTF8');

    let tournament;
    try {
      tournament = JSON.parse(tournamentRaw);
    } catch (err) {
      console.log('error', { filename });
      console.log({ err });
    }

    if (disableProgress && tournament)
      console.log(`${index + 1}: ${tournament.name}, ${tournament.tuid}`);

    if (!tournamentId || tournamentId === tournament?.tuid) {
      try {
        const { tournamentRecord } = convertTMX2TODS({ tournament });
        if (typeof processParticipants === 'function')
          processParticipants(tournamentRecord);

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

    if (!disableProgress) progressBar.update(index + 1);
  });

  if (Object.keys(orgs).length) {
    fs.writeFileSync(
      `${targetPath}/orgs.json`,
      JSON.stringify(orgs, undefined, 2),
      'UTF-8'
    );
  }
  if (!disableProgress) progressBar.stop();
}

export default TMX2TODS;
