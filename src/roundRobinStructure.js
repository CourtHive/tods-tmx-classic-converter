import { getPositionAssignmentHashes } from './getPositionAssignmentHashes';
import { processLegacyMatch } from './processLegacyMatch';
import { matchFx } from './matchFx';

import { drawDefinitionConstants, utilities } from 'tods-competition-factory';

const { CONTAINER, ITEM, WIN_RATIO } = drawDefinitionConstants;

export function roundRobinStructure({
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
    brackets: legacyEvent.draw.brackets,
    tournament,
    matches,
  });

  legacyEvent.draw.brackets?.forEach((bracket, index) => {
    const groupSize = legacyEvent.draw.bracket_size || 0;
    const drawPositionOffset = index * groupSize;
    const positionAssignments = (bracket.byes || []).map(({ position }) => ({
      drawPosition: position + drawPositionOffset,
      bye: true,
    }));

    const rounds = utilities.roundRobinGroups.groupRounds({
      drawPositionOffset,
      groupSize,
    });

    const matchUps = bracket.matches
      .map(legacyMatch => {
        const result = processLegacyMatch({
          drawPositionHashMap,
          drawPositionOffset,
          seedAssignments,
          participantIds,
          matchUpFormat,
          participants,
          legacyMatch,
          tieMatches,
          entryStage,
          eventType,
          tieFormat,
          seedLimit,
          entries,
          info,
        });

        if (result) {
          const { matchUp, positionAssignments: matchUpAssignments } = result;
          const drawPositions = matchUp?.drawPositions;

          if (matchUpAssignments) {
            positionAssignments.push(...matchUpAssignments);
          }

          if (drawPositions?.length === 1) {
            matchUp.roundNumber = utilities.roundRobinGroups.determineRoundNumber(
              {
                hash: utilities.roundRobinGroups.drawPositionsHash(
                  drawPositions
                ),
                rounds,
              }
            );
          }

          return matchUp;
        }
        return undefined;
      })
      .filter(Boolean);

    positionAssignments.sort((a, b) => a.drawPosition - b.drawPosition);
    const structureName = bracket.name || `Group ${index + 1}`;
    const structure = {
      structureId: utilities.UUID(),
      structureType: ITEM,
      positionAssignments,
      stageSequence: 1,
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
