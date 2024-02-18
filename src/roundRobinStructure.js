import { getPositionAssignmentHashes } from './getPositionAssignmentHashes';
import { processLegacyMatch } from './processLegacyMatch';
import { matchFx } from './matchFx';

import {
  drawDefinitionConstants,
  generationGovernor,
  tools,
} from 'tods-competition-factory';

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

  let missingDrawPositions = 0;
  legacyEvent.draw.brackets?.forEach((bracket, index) => {
    const groupSize = legacyEvent.draw.bracket_size || 0;
    const drawPositionOffset = index * groupSize;
    const positionAssignments = (bracket.byes || []).map(({ position }) => ({
      drawPosition: position + drawPositionOffset,
      bye: true,
    }));

    const rounds = generationGovernor.roundRobinGroups.groupRounds({
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
          if (result.missingDrawPositions) missingDrawPositions++;
          const drawPositions = matchUp?.drawPositions;

          if (matchUpAssignments) {
            positionAssignments.push(...matchUpAssignments);
          }

          if (drawPositions?.length === 1) {
            matchUp.roundNumber = generationGovernor.roundRobinGroups.determineRoundNumber(
              {
                hash: generationGovernor.roundRobinGroups.drawPositionsHash(
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
      structureId: tools.UUID(),
      structureType: ITEM,
      positionAssignments,
      stageSequence: 1,
      structureName,
      matchUps,
    };
    structures.push(structure);
  });

  if (missingDrawPositions) console.log({ missingDrawPositions });

  return {
    finishingPosition: WIN_RATIO,
    structureType: CONTAINER,
    seedAssignments: [],
    structures,
    seedLimit,
    entries,
  };
}
