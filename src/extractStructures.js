import { drawDefinitionConstants, utilities } from 'tods-competition-factory';
import { getStructureContent } from './getStructureContent';
import { matchFormatCode } from './matchFormatCode';
import { scoreFormat } from './scoreFormat';
import { getStage } from './utilities';

export function extractStructures({
  eventType,
  tieFormat,
  tournament,
  participants,
  legacyEvents,
  matchUpFormat,
  mainStructureId,
}) {
  const drawStructures = [];
  const entriesAccumulator = {};
  legacyEvents.forEach(legacyEvent => {
    const drawType = legacyEvent?.draw?.brackets
      ? 'ROUND_ROBIN'
      : legacyEvent?.draw?.compass
      ? 'COMPASS'
      : 'ELIMINATION';

    const stage =
      legacyEvent.euid === mainStructureId
        ? drawDefinitionConstants.MAIN
        : getStage({ legacyEvent });

    const format = legacyEvent.score_format;
    const formatCode =
      legacyEvent.matchFormat ||
      (format && matchFormatCode.stringify(scoreFormat.jsonTODS(format)));

    if (['ELIMINATION', 'ROUND_ROBIN'].includes(drawType)) {
      const {
        entries,
        matchUps,
        seedLimit,
        structures,
        structureType,
        finishingPosition,
        seedAssignments,
        positionAssignments,
      } = getStructureContent({
        drawType,
        eventType,
        tieFormat,
        tournament,
        legacyEvent,
        participants,
      });
      entries.forEach(entry => {
        entriesAccumulator[entry.participantId] = entry;
      });

      const structure = {
        stage,
        matchUps,
        seedLimit,
        finishingPosition,
        seedAssignments,
        positionAssignments,
        stageSequence: 1,
        structureId: legacyEvent.euid,
        structureName: legacyEvent.name,
      };
      if (structures) structure.structures = structures;
      if (structureType) structure.structureType = structureType;

      if (formatCode || matchUpFormat)
        structure.matchUpFormat = formatCode || matchUpFormat;

      drawStructures.push(structure);
    } else {
      const compassStructures = getStructureContent({
        drawType,
        eventType,
        tieFormat,
        tournament,
        legacyEvent,
        participants,
      });
      compassStructures.forEach(structure => {
        structure.entries.forEach(entry => {
          entriesAccumulator[entry.participantId] = entry;
        });

        delete structure.entries;
        if (structure.roundOffset) delete structure.seedLimit;

        structure.stage = stage;
        structure.structureId = utilities.UUID();

        if (formatCode || matchUpFormat)
          structure.matchUpFormat = formatCode || matchUpFormat;

        drawStructures.push(structure);
      });
    }
  });

  const drawEntries = Object.values(entriesAccumulator);
  return { structures: drawStructures, drawEntries };
}
