import { getPositionAssignmentHashes } from './getPositionAssignmentHashes';
import { roundRobinStructure } from './roundRobinStructure';
import { processLegacyMatch } from './processLegacyMatch';
import { normalizeName } from './normalizeName';
import { getStage } from './utilities';
import { matchFx } from './matchFx';
import { drawFx } from './drawFx';

import { drawDefinitionConstants, utilities } from 'tods-competition-factory';

const {
  CONTAINER,
  ITEM,
  ROUND_OUTCOME,
  WIN_RATIO,
  TOP_DOWN,
  LOSER,
} = drawDefinitionConstants;

const dfx = drawFx();

export function getStructureContent({
  drawType,
  eventType,
  tieFormat,
  tournament,
  legacyEvent,
  participants,
}) {
  const legacyDual = tournament.type === 'dual';
  const totalPlayers =
    legacyEvent.approved.length + (legacyEvent.qualifiers || 0) ||
    legacyEvent.feed_base ||
    legacyEvent.draw_size;
  const seedLimit = dfx.seedLimit({
    total_players: totalPlayers,
    evt: legacyEvent,
  });

  const entryStage = getStage({ legacyEvent });
  const info = dfx.drawInfo(legacyEvent.draw);

  const props = {
    participants,
    legacyEvent,
    tournament,
    legacyDual,
    seedLimit,
    entryStage,
    tieFormat,
    eventType,
    info,
  };

  const result =
    (drawType === 'ROUND_ROBIN' && roundRobinStructure(props)) ||
    (drawType === 'COMPASS' && getCompassComponents(props)) ||
    eliminationStructure(props);

  return result;
}

function getCompassComponents(props) {
  const directions = {
    east: { stageSequence: 1 },
    west: { stageSequence: 2, roundOffset: 1 },
    north: { stageSequence: 2, roundOffset: 2 },
    south: { stageSequence: 3, roundOffset: 2 },
    northeast: { stageSequence: 2, roundOffset: 3 },
    northwest: { stageSequence: 3, roundOffset: 3 },
    southwest: { stageSequence: 3, roundOffset: 3 },
    southeast: { stageSequence: 4, roundOffset: 3 },
  };

  const legacyDirections = Object.keys(props.legacyEvent.draw);
  const directionsPresent = utilities.intersection(
    Object.keys(directions),
    legacyDirections.filter(key => props.legacyEvent.draw[key])
  );

  directionsPresent?.forEach(direction => {
    directions[direction].structureId = utilities.UUID();
  });

  const compassStructures = directionsPresent
    .map(direction => {
      props.legacyEvent.draw.compass = direction;
      const info = dfx.drawInfo(props.legacyEvent.draw);
      const result = eliminationStructure({
        direction,
        directions,
        ...props,
        info,
      });
      return result;
    })
    .filter(Boolean);

  const compassLinks = [];
  const linkProfiles = {
    east: { west: 1, north: 2, northeast: 3 },
    west: { south: 1, southwest: 2 },
    north: { northwest: 1 },
    south: { southeast: 1 },
  };

  directionsPresent?.forEach(direction => {
    linkProfiles[direction] &&
      Object.keys(linkProfiles[direction]).forEach(linkedDirection => {
        if (directionsPresent.includes(linkedDirection)) {
          const link = {
            linkType: LOSER,
            source: {
              roundNumber: linkProfiles[direction][linkedDirection],
              structureName: normalizeName(direction),
              structureId: directions[direction].structureId,
            },
            target: {
              roundNumber: 1,
              feedProfile: TOP_DOWN,
              structureName: normalizeName(linkedDirection),
              structureId: directions[linkedDirection].structureId,
            },
          };
          compassLinks.push(link);
        }
      });
  });

  return { compassStructures, compassLinks };
}

function eliminationStructure({
  tournament,
  direction,
  directions,
  tieFormat,
  legacyDual,
  seedLimit,
  entryStage,
  legacyEvent,
  participants,
  tournamentEngine,
  eventType,
  info,
}) {
  // logic for elmination structures
  const eventMatches = matchFx.eventMatches(legacyEvent, tournament, true);
  // if tournament type is dual then matches need to be retrieved differently
  const roundNames = matchFx.roundNames(tournament, legacyEvent);
  const dfxMatches = dfx.matches(
    legacyEvent.draw,
    roundNames.names,
    roundNames.calculated_names,
    true
  );
  const matches = ((legacyDual ? dfxMatches : eventMatches) || []).filter(
    match => !direction || match.draw === direction
  );
  const tieMatches = (legacyDual && eventMatches) || [];
  const positionAssignments = [];
  const seedAssignments = [];
  const participantIds = [];
  const entries = [];

  const matchUpFormat = legacyEvent.matchFormat;

  const drawPositionHashMap = getPositionAssignmentHashes({
    matches,
    tournament,
  });

  const isAdhocEvent = legacyEvent.draw_type === 'A';

  const matchUps = matches
    .map(legacyMatch => {
      const result = processLegacyMatch({
        entries,
        tieFormat,
        eventType,
        isAdhocEvent,
        matchUpFormat,
        seedAssignments,
        drawPositionHashMap,

        tournamentEngine,
        tieMatches,
        legacyMatch,
        participantIds,
        participants,
        entryStage,
        seedLimit,
        info,
      });
      if (result) {
        const { matchUp, positionAssignments: matchUpAssignments } = result;
        if (matchUpAssignments) positionAssignments.push(...matchUpAssignments);
        return matchUp;
      }
      return undefined;
    })
    .filter(Boolean);

  positionAssignments.sort((a, b) =>
    a.drawPosition > b.drawPosition ? 1 : -1
  );
  seedAssignments.sort((a, b) => (a.seedNumber > b.seedNumber ? 1 : -1));

  const structureContent = {
    entries,
    matchUps,
    seedAssignments,
    positionAssignments,
    finishingPosition: ROUND_OUTCOME,
  };

  if (!isAdhocEvent) structureContent.seedLimit = seedLimit;

  if (direction) {
    const structureName = normalizeName(direction);
    structureContent.structureName = structureName;
    structureContent.structureAbbreviation = structureName[0];
    Object.assign(structureContent, directions[direction]);
  }

  return structureContent;
}
