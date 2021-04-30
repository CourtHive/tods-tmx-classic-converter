import { getPositionAssignmentHashes } from './getPositionAssignmentHashes';
import { tournamentEngine } from 'tods-competition-factory';
import { extractMatchUp } from './extractMatchUp';
import { normalizeName } from 'normalize-text';
import { getStage } from './utilities';
import { matchFx } from './matchFx';
import { drawFx } from './drawFx';

import {
  drawDefinitionConstants,
  drawEngine,
  utilities,
} from 'tods-competition-factory';

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
    drawType === 'ROUND_ROBIN'
      ? roundRobinStructure(props)
      : drawType === 'COMPASS'
      ? getCompassComponents(props)
      : eliminationStructure(props);

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

  directionsPresent.forEach(direction => {
    directions[direction].structureId = utilities.UUID();
  });

  const compassStructures = directionsPresent
    .map(direction => eliminationStructure({ direction, directions, ...props }))
    .filter(f => f.matchUps?.length);

  const compassLinks = [];
  const linkProfiles = {
    east: { west: 1, north: 2, northeast: 3 },
    west: { south: 1, southwest: 2 },
    north: { northwest: 1 },
    south: { southeast: 1 },
  };

  directionsPresent.forEach(direction => {
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
    .filter(f => f);

  positionAssignments.sort((a, b) =>
    a.drawPosition > b.drawPosition ? 1 : -1
  );
  seedAssignments.sort((a, b) => (a.seedNumber > b.seedNumber ? 1 : -1));

  const structureContent = {
    entries,
    matchUps,
    seedLimit,
    seedAssignments,
    positionAssignments,
    finishingPosition: ROUND_OUTCOME,
  };

  if (direction) {
    const structureName = normalizeName(direction);
    structureContent.structureName = structureName;
    structureContent.structureAbbreviation = structureName[0];
    Object.assign(structureContent, directions[direction]);
  }

  return structureContent;
}

function roundRobinStructure({
  tournament,
  legacyEvent,
  legacyDual,
  participants,
  entryStage,
  seedLimit,
  tieFormat,
  eventType,
  info,
}) {
  const eventMatches = matchFx.eventMatches(legacyEvent, tournament, true);
  const tieMatches = (legacyDual && eventMatches) || [];

  const structures = [];
  const seedAssignments = [];
  const participantIds = [];
  const entries = [];

  const matchUpFormat = legacyEvent.matchFormat;

  const matches = legacyEvent.draw.brackets
    .map(bracket => bracket.matches)
    .flat();
  const drawPositionHashMap = getPositionAssignmentHashes({
    matches,
    tournament,
    brackets: legacyEvent.draw.brackets,
  });

  legacyEvent.draw.brackets.forEach((bracket, index) => {
    const drawPositionOffset = index * (legacyEvent.draw.bracket_size || 0);
    const positionAssignments = [];
    const matchUps = bracket.matches
      .map(legacyMatch => {
        const result = processLegacyMatch({
          seedAssignments,
          entries,
          eventType,
          tieFormat,
          matchUpFormat,
          drawPositionHashMap,
          drawPositionOffset,
          participantIds,
          participants,
          legacyMatch,
          tieMatches,
          entryStage,
          seedLimit,
          info,
        });
        if (result) {
          const { matchUp, positionAssignments: matchUpAssignments } = result;
          if (matchUpAssignments)
            positionAssignments.push(...matchUpAssignments);
          return matchUp;
        }
        return undefined;
      })
      .filter(f => f);

    const { participantResults } = drawEngine.tallyParticipantResults({
      matchUps,
    });
    const resultsParticipantIds = Object.keys(participantResults || {});
    if (resultsParticipantIds?.length) {
      positionAssignments?.forEach(assignment => {
        const { participantId } = assignment;
        if (resultsParticipantIds?.includes(participantId)) {
          assignment.extensions = [
            {
              name: 'tally',
              value: participantResults[participantId],
            },
          ];
        }
      });
    }

    const structureName = bracket.name || `Group ${index + 1}`;
    const structure = {
      structureType: ITEM,
      structureId: utilities.UUID(),
      stageSequence: 1,
      positionAssignments,
      structureName,
      matchUps,
    };
    structures.push(structure);
  });

  return {
    entries,
    seedLimit,
    structures,
    seedAssignments: [],
    structureType: CONTAINER,
    finishingPosition: WIN_RATIO,
  };
}

function processLegacyMatch({
  seedAssignments,
  matchUpFormat,
  isAdhocEvent,
  tieFormat,
  eventType,
  entries,

  drawPositionHashMap,
  drawPositionOffset,
  participantIds,
  participants,
  legacyMatch,
  tieMatches,
  entryStage,
  seedLimit,
  info,
}) {
  const positionAssignments = [];
  const isDualMatch = !!legacyMatch.dual_match;
  const matchUpId = legacyMatch.match?.muid || legacyMatch.muid;
  if (!legacyMatch.teams || isDualMatch) {
    return {};
  }

  const roundNumberString =
    legacyMatch?.round ||
    legacyMatch.match?.round ||
    matchFx.roundNumber({
      match: legacyMatch.match,
      info,
    });
  const roundNumber = !isNaN(parseInt(roundNumberString))
    ? parseInt(roundNumberString)
    : undefined;
  const roundPositionString = matchFx.roundPosition({
    match: legacyMatch.match,
    info,
  });
  const roundPosition = !isNaN(parseInt(roundPositionString))
    ? parseInt(roundPositionString)
    : undefined;
  const roundName =
    legacyMatch.match?.calculated_round_name ||
    legacyMatch.match?.round_name ||
    legacyMatch?.round_name ||
    '';

  const tieMatchUps = tieMatches
    .filter(tieMatch => tieMatch.dual_match === matchUpId)
    .map(tieMatch => {
      const { matchUp, missingParticipants } = extractMatchUp({
        info,
        tieFormat,
        eventType,
        seedLimit,
        entryStage,
        isAdhocEvent,
        participants,
        participantIds,
        tournamentEngine,
        drawPositionHashMap,
        legacyMatch: tieMatch,
      });
      Object.assign(matchUp, { roundName, roundNumber, roundPosition });
      if (missingParticipants.length) console.log({ missingParticipants });
      return matchUp;
    });

  const {
    matchUp,
    missingParticipants,
    positionAssignments: matchUpPositionAssignments,
    seedAssignments: matchUpSeedAssignments,
    entries: matchUpEntries,
  } = extractMatchUp({
    info,
    eventType,
    seedLimit,
    entryStage,
    legacyMatch,
    isAdhocEvent,
    participants,
    matchUpFormat,
    participantIds,
    tournamentEngine,
    drawPositionOffset,
    drawPositionHashMap,
  });
  if (missingParticipants?.filter(f => f).length)
    console.log({ missingParticipants });

  if (tieMatchUps) {
    tieMatchUps.forEach(tieMatchUp => {
      const { collectionPosition, matchUpType, sides } = tieMatchUp;
      const collectionDefinition = tieFormat?.collectionDefinitions.find(
        collectionDefinition => collectionDefinition.matchUpType === matchUpType
      );
      const collectionId = collectionDefinition?.collectionId;
      if (sides?.length) {
        sides.forEach(({ participantId, sideNumber }) => {
          const side = matchUp.sides.find(
            side => side.sideNumber === sideNumber
          );
          if (!side.lineUp) side.lineUp = [];
          const competitor = side.lineUp.find(
            competitor => competitor.participantId === participantId
          );
          if (competitor) {
            competitor.collectionAssignments.push({
              collectionId,
              collectionPosition,
            });
          } else {
            const competitor = {
              participantId,
              collectionAssignments: [{ collectionId, collectionPosition }],
            };
            side.lineUp.push(competitor);
          }
        });
      }
    });
  }

  matchUpPositionAssignments.forEach(positionAssignment =>
    positionAssignments.push(positionAssignment)
  );
  matchUpSeedAssignments.forEach(seedAssignment =>
    seedAssignments.push(seedAssignment)
  );
  matchUpEntries.forEach(entry => entries.push(entry));

  Object.assign(matchUp, { roundName, roundNumber, roundPosition });
  if (tieMatchUps.length) {
    Object.assign(matchUp, { tieMatchUps });
  }

  return { matchUp, positionAssignments };
}
