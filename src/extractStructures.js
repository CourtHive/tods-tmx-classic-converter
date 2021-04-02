import { drawDefinitionConstants } from "tods-competition-factory";
import { matchFormatCode } from "./matchFormatCode";
import { scoreFormat } from "./scoreFormat";
import { getStructureContent } from "./getStructureContent";
import { getStage } from "./utilities";

export function extractStructures({
  eventType,
  tieFormat,
  tournament,
  participants,
  legacyEvents,
  matchUpFormat,
  mainStructureId,
}) {
  const entriesAccumulator = {};
  const structures = legacyEvents.map((legacyEvent) => {
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
      eventType,
      tieFormat,
      tournament,
      legacyEvent,
      participants,
    });
    entries.forEach((entry) => {
      entriesAccumulator[entry.participantId] = entry;
    });

    const stage =
      legacyEvent.euid === mainStructureId
        ? drawDefinitionConstants.MAIN
        : getStage({ legacyEvent });

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

    const format = legacyEvent.score_format;
    const formatCode =
      legacyEvent.matchFormat ||
      (format && matchFormatCode.stringify(scoreFormat.jsonTODS(format)));
    if (formatCode || matchUpFormat)
      structure.matchUpFormat = formatCode || matchUpFormat;

    return structure;
  });

  const drawEntries = Object.values(entriesAccumulator);
  return { structures, drawEntries };
}
