import { extractMatchUp } from './extractMatchUp';
import { matchFx } from './matchFx';

export function processLegacyMatch({
  tournamentEngine,
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

  const roundNumberString = legacyMatch?.round || legacyMatch.match?.round;
  const roundNumber = !isNaN(parseInt(roundNumberString))
    ? parseInt(roundNumberString)
    : undefined;

  const matches = info?.all_matches;
  const roundPositionString = matchFx.roundPosition({
    match: legacyMatch.match,
    matches,
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
    positionAssignments: matchUpPositionAssignments,
    seedAssignments: matchUpSeedAssignments,
    entries: matchUpEntries,
    missingDrawPositions,
    missingParticipants,
    matchUp,
  } = extractMatchUp({
    drawPositionHashMap,
    drawPositionOffset,
    tournamentEngine,
    participantIds,
    matchUpFormat,
    isAdhocEvent,
    participants,
    legacyMatch,
    entryStage,
    eventType,
    seedLimit,
    info,
  });

  if (missingParticipants?.filter(Boolean).length)
    console.log({ missingParticipants });

  if (tieMatchUps) {
    tieMatchUps?.forEach(tieMatchUp => {
      const { collectionPosition, matchUpType, sides } = tieMatchUp;
      const collectionDefinition = tieFormat?.collectionDefinitions.find(
        collectionDefinition => collectionDefinition.matchUpType === matchUpType
      );
      const collectionId = collectionDefinition?.collectionId;
      if (sides?.length) {
        sides?.forEach(({ participantId, sideNumber }) => {
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

  matchUpPositionAssignments?.forEach(positionAssignment =>
    positionAssignments.push(positionAssignment)
  );
  matchUpSeedAssignments?.forEach(seedAssignment =>
    seedAssignments.push(seedAssignment)
  );
  matchUpEntries?.forEach(entry => entries.push(entry));

  if (isAdhocEvent) {
    Object.assign(matchUp, { roundName });
  } else {
    Object.assign(matchUp, { roundName, roundNumber, roundPosition });
    if (tieMatchUps.length) {
      Object.assign(matchUp, { tieMatchUps });
    }
  }

  return { matchUp, positionAssignments, missingDrawPositions };
}
