import { getPositionAssignmentHashes } from './getPositionAssignmentHashes';
import { drawDefinitionConstants } from 'tods-competition-factory';
import { tournamentEngine } from 'tods-competition-factory';
import { extractMatchUp } from './extractMatchUp';
import { getStage } from './utilities';
import { matchFx } from './matchFx';
import { drawFx } from './drawFx';
import { UUID } from './UUID';

const { CONTAINER, ITEM, ROUND_OUTCOME, WIN_RATIO } = drawDefinitionConstants;

const dfx = drawFx();

export function getStructureContent({
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

  const result = legacyEvent?.draw?.brackets
    ? roundRobinStructure(props)
    : eliminationStructure(props);

  return result;
}

function eliminationStructure({
  legacyEvent,
  tournament,
  tieFormat,
  legacyDual,
  seedLimit,
  entryStage,
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
  const matches = legacyDual ? dfxMatches : eventMatches;
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

  return {
    entries,
    matchUps,
    seedLimit,
    positionAssignments,
    seedAssignments,
    finishingPosition: ROUND_OUTCOME,
  };
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
    const structureName = bracket.name || `Group ${index + 1}`;
    const structure = {
      structureType: ITEM,
      structureId: UUID.generate(),
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
    matchFx.roundNumber({
      match: legacyMatch.match,
      info,
    }) ||
    legacyMatch.match?.round ||
    legacyMatch?.round;
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
