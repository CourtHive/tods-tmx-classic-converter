import { getStructureContent } from './getStructureContent';
import { matchFormatCode } from './matchFormatCode';
import { scoreFormat } from './scoreFormat';
import { getStage } from './utilities';
import {
  drawDefinitionConstants,
  entryStatusConstants,
  tournamentEngine,
  utilities,
} from 'tods-competition-factory';

export function extractStructures({
  eventType,

  tieFormat,
  tournament,
  participants,
  legacyEvents,
  matchUpFormat,
  mainStructureId,
}) {
  const links = [];
  const drawStructures = [];
  const entriesAccumulator = {};
  const eventEntriesAccumulator = {};
  const missingParticipants = [];

  legacyEvents?.forEach(legacyEvent => {
    legacyEvent.approved?.forEach(id => {
      if (!Array.isArray(id)) {
        const entry = {
          entryStatus: entryStatusConstants.DIRECT_ACCEPTANCE,
          entryStage: drawDefinitionConstants.MAIN,
          participantId: id,
        };
        eventEntriesAccumulator[entry.participantId] = entry;
      } else if (Array.isArray(id)) {
        const {
          participant: existingParticipant,
        } = tournamentEngine.getPairedParticipant({
          participantIds: id,
        });
        if (!existingParticipant) {
          const {
            participant: newParticipant,
          } = tournamentEngine.addParticipant({
            returnParticipant: true,
            participant: {
              participantType: 'PAIR',
              participantRole: 'COMPETITOR',
              individualParticipantIds: id,
            },
          });
          if (newParticipant) {
            missingParticipants.push(newParticipant);
            const entry = {
              entryStatus: entryStatusConstants.DIRECT_ACCEPTANCE,
              entryStage: drawDefinitionConstants.MAIN,
              participantId: newParticipant.participantId,
            };
            eventEntriesAccumulator[entry.participantId] = entry;
          }
        }
      }
    });

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
      entries?.forEach(entry => {
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
      const { compassStructures, compassLinks } = getStructureContent({
        drawType,
        eventType,
        tieFormat,
        tournament,
        legacyEvent,
        participants,
      });
      if (compassLinks?.length) links.push(...compassLinks);
      compassStructures?.forEach(structure => {
        structure.entries?.forEach(entry => {
          entriesAccumulator[entry.participantId] = entry;
        });

        delete structure.entries;
        if (structure.roundOffset) delete structure.seedLimit;

        structure.stage = stage;

        if (formatCode || matchUpFormat)
          structure.matchUpFormat = formatCode || matchUpFormat;

        drawStructures.push(structure);
      });
    }
  });

  const drawEntries = Object.values(entriesAccumulator);

  drawEntries.forEach(entry => {
    eventEntriesAccumulator[entry.participantId] = entry;
  });

  return {
    structures: drawStructures,
    eventEntriesAccumulator,
    missingParticipants,
    drawEntries,
    links,
  };
}
