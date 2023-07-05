import { getStructureContent } from './getStructureContent';
import { matchFormatCode } from './matchFormatCode';
import { scoreFormat } from './scoreFormat';
import { getStage } from './utilities';
import {
  drawDefinitionConstants,
  entryStatusConstants,
  tournamentEngine,
  drawEngine,
} from 'tods-competition-factory';

const {
  CONSOLATION,
  DRAW,
  MAIN,
  QUALIFYING,
  WINNER,
  LOSER,
} = drawDefinitionConstants;

export function extractStructures({
  mainStructureId,
  matchUpFormat,
  legacyEvents,
  participants,
  tournament,
  eventType,
  tieFormat,
}) {
  const eventEntriesAccumulator = {};
  const missingParticipants = [];
  const entriesAccumulator = {};
  const drawStructures = [];
  const drawTypes = [];
  const links = [];

  legacyEvents?.forEach(legacyEvent => {
    legacyEvent.approved?.forEach(id => {
      if (!Array.isArray(id)) {
        const entry = {
          entryStatus: entryStatusConstants.DIRECT_ACCEPTANCE,
          entryStage: MAIN,
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

    const drawType =
      (legacyEvent.draw_type === 'A' && 'AD_HOC') ||
      (legacyEvent?.draw?.brackets && 'ROUND_ROBIN') ||
      (legacyEvent?.draw?.compass && 'COMPASS') ||
      'SINGLE_ELIMINATION';

    drawTypes.push(drawType);

    const stage =
      legacyEvent.euid === mainStructureId
        ? drawDefinitionConstants.MAIN
        : getStage({ legacyEvent });

    const format = legacyEvent.score_format;
    const formatCode =
      legacyEvent.matchFormat ||
      (format && matchFormatCode.stringify(scoreFormat.jsonTODS(format)));

    if (['AD_HOC', 'SINGLE_ELIMINATION', 'ROUND_ROBIN'].includes(drawType)) {
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
        participants,
        legacyEvent,
        tournament,
        eventType,
        tieFormat,
        drawType,
      });
      entries?.forEach(entry => {
        entriesAccumulator[entry.participantId] = entry;
      });

      drawEngine.addFinishingRounds({ matchUps });

      const structure = {
        structureName: legacyEvent.name,
        structureId: legacyEvent.euid,
        positionAssignments,
        stageSequence: 1,
        finishingPosition,
        seedAssignments,
        seedLimit,
        matchUps,
        stage,
      };
      if (drawType === 'AD_HOC') {
        structure.finishingPosition = undefined;
      }
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

  if (links.length < drawStructures.length - 1) {
    const consolationStructure = drawStructures.find(
      ({ stage }) => stage === CONSOLATION
    );
    const qualifyingStructure = drawStructures.find(
      ({ stage }) => stage === QUALIFYING
    );
    const mainStructure = drawStructures.find(
      ({ stage, stageSequence }) => stage === MAIN && stageSequence === 1
    );

    if (qualifyingStructure && mainStructure) {
      const roundNumber = qualifyingStructure.matchUps?.reduce(
        (roundNumber, matchUp) => {
          return matchUp.roundNumber > roundNumber
            ? matchUp.roundNumber
            : roundNumber;
        },
        0
      );

      qualifyingStructure.structureName += ' Qualifying';

      if (roundNumber) {
        const link = {
          linkType: WINNER,
          source: {
            structureId: qualifyingStructure.structureId,
            roundNumber: 2,
          },
          target: {
            feedProfile: DRAW,
            structureId: mainStructure.structureId,
            roundNumber: 1,
          },
        };
        links.push(link);
      } else if (qualifyingStructure.finishingPosition === 'WIN_RATIO') {
        const link = {
          linkType: WINNER,
          source: {
            structureId: qualifyingStructure.structureId,
            finishingPositions: [1],
          },
          target: {
            feedProfile: DRAW,
            structureId: mainStructure.structureId,
            roundNumber: 1,
          },
        };
        links.push(link);
      }
    }

    if (consolationStructure && mainStructure) {
      consolationStructure.structureName += ' Consolation';
      const link = {
        linkType: LOSER,
        source: {
          structureId: mainStructure.structureId,
          roundNumber: 1,
        },
        target: {
          structureId: consolationStructure.structureId,
          feedProfile: DRAW,
          roundNumber: 1,
        },
      };
      links.push(link);
    }
  }

  return {
    structures: drawStructures,
    eventEntriesAccumulator,
    missingParticipants,
    drawEntries,
    drawTypes,
    links,
  };
}
