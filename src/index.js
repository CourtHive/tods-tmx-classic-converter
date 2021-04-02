import { extractEvents } from "./extractEvents";
import { extractParticipants } from "./extractParticipants";
import { extractTournamentInfo } from "./extractTournamentInfo";

// collectionDefinitions, ratings category ranges (event.ratings_filter: { high: #, low: #}), Round Robins
// player Representatives
// Compressed draw structures... with D3 visualizations works fine... may not work with React-draws
// drawEngine.buildDrawHierarchy is not handling pre-round structures which have only one children[] attribute rather than true hierarchy

export function TMX2TODS({ tournament }) {
  const { tournamentInfo, organisationParticipants } = extractTournamentInfo({
    tournament,
  });
  const { competitorParticipants } = extractParticipants({
    tournament,
  });

  const participants = competitorParticipants.concat(
    ...organisationParticipants
  );

  const { events } = extractEvents({ tournament, participants });

  const tournamentRecord = {
    ...tournamentInfo,
    participants,
    events,
  };

  return { tournamentRecord };
}

export default TMX2TODS;
