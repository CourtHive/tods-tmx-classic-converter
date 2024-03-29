import { convertTieFormat } from './convertTieFormat';
import { extractStructures } from './extractStructures';
import { matchFormatCode } from './matchFormatCode';
import { scoreFormat } from './scoreFormat';
import {
  getGender,
  getIndoorOutdoor,
  getMatchUpType,
  getSurface,
} from './utilities';
import {
  tournamentEngine,
  factoryConstants,
  matchUpTypes,
  tools,
} from 'tods-competition-factory';

export function extractEvents({ tournament, participants }) {
  const legacyEventPublished = {};
  const drawPublishingDetail = {};
  const eventCategories = {};
  const eventPairParticipants = [];
  const legacyEvents = tournament.events || [];
  const tournamentId = tournament.tuid;
  const tournamentRecord = {
    tournamentId: tournamentId || 'foo',
    participants,
  };
  tournamentEngine.setState(tournamentRecord);

  // linkedStructures are events which have explicit links
  const linkedStructures = {};

  legacyEvents?.forEach(legacyEvent => {
    legacyEventPublished[legacyEvent.euid] = legacyEvent.published;
    const euid = legacyEvent.euid;
    const eventIds = [euid];
    legacyEvent.links &&
      Object.keys(legacyEvent.links).forEach(key => {
        const linkedEuid = legacyEvent.links[key];
        eventIds.push(linkedEuid);
      });
    const groupEuid = tools.intersection(
      Object.keys(linkedStructures),
      eventIds
    );
    if (groupEuid.length) {
      linkedStructures[groupEuid[0]][euid] = legacyEvent;
    } else {
      linkedStructures[euid] = { [euid]: legacyEvent };
    }
  });

  Object.keys(linkedStructures).forEach(key => {
    const published = legacyEventPublished[key];
    const structureGroup = linkedStructures[key];
    const structureGroupIds = Object.keys(structureGroup);
    const groupStructures = structureGroupIds.map(id => structureGroup[id]);
    const structureGroupDrawTypes = groupStructures.map(
      event => event.draw_type
    );
    const mainDrawTypes = ['E', 'S'];
    if (!tools.intersection(mainDrawTypes, structureGroupDrawTypes).length) {
      if (structureGroupDrawTypes?.includes('R')) mainDrawTypes.push('R');
      else if (structureGroupDrawTypes?.includes('A')) mainDrawTypes.push('A');
      else if (structureGroupDrawTypes?.includes('C')) mainDrawTypes.push('C');
      else if (structureGroupDrawTypes?.includes('Q')) mainDrawTypes.push('Q');
      else if (structureGroupDrawTypes?.includes('P')) mainDrawTypes.push('P');
      else console.log('unlinked event', { structureGroup });
    }
    const mainLegacyEvent = groupStructures.find(legacyEvent =>
      mainDrawTypes?.includes(legacyEvent.draw_type)
    );
    const matchUpFormats = mainLegacyEvent?.matchFormats;
    const eventType =
      getMatchUpType(mainLegacyEvent.format) ||
      ((mainLegacyEvent.matchorder || tournament.type === 'dual') &&
        matchUpTypes.TEAM);
    const ageCategoryDetail = tournamentEngine.getCategoryAgeDetails({
      category: mainLegacyEvent.category,
    });
    const category = { categoryName: mainLegacyEvent.category };
    if (!ageCategoryDetail.error) Object.assign(category, ageCategoryDetail);

    const {
      name,
      //      automated,
      //      draw_size,
      matchorder,
      draw_created,
      broadcast_name,
      custom_category,
      //      category: legacyCategory,
    } = mainLegacyEvent;

    const tieFormat =
      mainLegacyEvent.matchorder &&
      convertTieFormat(matchorder, matchUpFormats);

    const format = mainLegacyEvent.score_format;
    const matchUpFormat =
      !tieFormat &&
      (mainLegacyEvent.matchFormat ||
        (format && matchFormatCode.stringify(scoreFormat.jsonTODS(format))));

    const {
      eventEntriesAccumulator,
      drawEntries: entries,
      missingParticipants,
      structures,
      drawTypes,
      links,
    } = extractStructures({
      mainStructureId: mainLegacyEvent.euid,
      legacyEvents: groupStructures,
      matchUpFormat,
      participants,
      tournament,
      eventType,
      tieFormat,
    });

    if (missingParticipants?.length)
      eventPairParticipants.push(...missingParticipants);

    const hasPopulatedMatchUps = structures
      .map(structure => {
        // account for AD_HOC
        if (structure.matchUps?.some(({ sides }) => sides))
          return structure.matchUps.length;
        if (structure.structures) {
          return structure.structures
            .map(
              ({ positionAssignments }) =>
                positionAssignments.filter(a => a.participantId)?.length || 0
            )
            .reduce((a, b) => a + b, 0);
        } else {
          return (
            structure.positionAssignments?.filter(a => a.participantId)
              ?.length || 0
          );
        }
      })
      .reduce((a, b) => a + b, 0);

    const drawDefinition = {
      // drawId will be assigned after allocation to events
      drawName:
        custom_category ||
        broadcast_name ||
        name ||
        factoryConstants.drawDefinitionConstants.MAIN,
      createdAt: draw_created && new Date(draw_created).toISOString(),
      structures,
      entries,
      links,
    };

    if (drawTypes?.length === 1) {
      drawDefinition.drawType = drawTypes[0];
    } else if (drawTypes?.length === 2) {
      if (drawDefinition.structures[0].stage === 'QUALIFYING') {
        drawDefinition.drawType = drawTypes[1];
      } else if (drawDefinition.structures[1].stage === 'CONSOLATION') {
        drawDefinition.drawType = 'FIRST_ROUND_LOSER_CONSOLATION';
      }
    }

    tournamentEngine.addGoesTo({ drawDefinition });

    if (tieFormat) {
      drawDefinition.tieFormat = tieFormat;
    } else if (matchUpFormat) {
      drawDefinition.matchUpFormat = matchUpFormat;
    }

    const surfaceCategory = getSurface(mainLegacyEvent);
    const indoorOutdoor = getIndoorOutdoor(mainLegacyEvent);
    const gender = getGender(mainLegacyEvent.gender);
    const eventRank = mainLegacyEvent.rank;

    const nameRoot = category.categoryName ? `${category.categoryName}-` : '';
    const categoryName = `${nameRoot}${gender}-${eventType}`;

    const code = parseFloat(
      `${eventType}-${categoryName}`
        .split('')
        .map(c => c.charCodeAt(0))
        .join('')
    )
      .toString(36)
      .slice(0, 10);

    const code1 = parseFloat(
      `${categoryName}-${eventType}`
        .split('')
        .map(c => c.charCodeAt(0))
        .join('')
    )
      .toString(36)
      .slice(0, 10);

    const code2 = parseFloat(
      `${gender || 'MIXED'}-${eventRank || 'UR'}`
        .split('')
        .map(c => c.charCodeAt(0))
        .join('')
    )
      .toString(36)
      .slice(0, 10);

    const eventId = `${tournamentId.split('-')[0]}-${code}-${code1}-${code2}`;

    if (!eventCategories[categoryName]) {
      eventCategories[categoryName] = {
        drawDefinitions: hasPopulatedMatchUps ? [drawDefinition] : undefined,
        eventName: categoryName,
        eventRank,
        eventType,
        category,
        eventId,
        gender,
      };
      if (published) eventCategories[categoryName].published = published;
      if (indoorOutdoor)
        eventCategories[categoryName].indoorOutdoor = indoorOutdoor;
      if (surfaceCategory)
        eventCategories[categoryName].surfaceCategory = surfaceCategory;
    } else {
      if (!eventCategories[categoryName].drawDefinitions) {
        eventCategories[categoryName].drawDefinitions = [];
      }
      eventCategories[categoryName].drawDefinitions.push(drawDefinition);
      if (indoorOutdoor && !eventCategories[categoryName].indoorOutdoor)
        eventCategories[categoryName].indoorOutdoor = indoorOutdoor;
      if (surfaceCategory && !eventCategories[categoryName].surfaceCategory)
        eventCategories[categoryName].surfaceCategory = surfaceCategory;
    }

    eventCategories[
      categoryName
    ].eventEntriesAccumulator = eventEntriesAccumulator;
  });

  const events = Object.values(eventCategories);
  events?.forEach(event => {
    const eventId = event.eventId;
    event.drawDefinitions?.forEach((drawDefinition, i) => {
      const drawId = `${eventId}-${i + 1}`;
      // drawPublishingDetail[drawId] = legacyEventPublished[eventId];
      drawDefinition.drawId = drawId;
      drawDefinition.entries?.forEach(entry => {
        event.eventEntriesAccumulator[entry.participantId] = entry;
      });
      const { matchUps } = tournamentEngine.allDrawMatchUps({
        tournamentParticipants: participants,
        drawDefinition,
      });
      drawDefinition.structures?.forEach(structure => {
        if (structure.structureType === 'CONTAINER') {
          structure.structures.forEach(childStructure => {
            const positionAssignments = childStructure.positionAssignments;
            const childMatchUps = matchUps.filter(
              m => m.structureId === childStructure.structureId
            );
            const {
              participantResults,
            } = tournamentEngine.tallyParticipantResults({
              matchUpFormat: structure.matchUpFormat,
              matchUps: childMatchUps,
            });
            const resultsParticipantIds = Object.keys(participantResults || {});
            if (resultsParticipantIds?.length) {
              positionAssignments?.forEach(assignment => {
                const { participantId } = assignment;
                if (resultsParticipantIds?.includes(participantId)) {
                  assignment.extensions = [
                    {
                      value: participantResults[participantId],
                      name: 'tally',
                    },
                  ];
                }
              });
            }
          });
        }
      });
    });
    event.entries = Object.values(event.eventEntriesAccumulator);
    event.eventEntriesAccumulator = undefined;
    if (event.published) {
      // capture legacyEvent.published and for each event add publishState timeItem
      const timeItem = {
        itemType: 'PUBLISH.STATUS',
        itemValue: {
          PUBLIC: {
            drawDetails: Object.assign(
              {},
              ...(event.drawDefinitions ?? []).map(({ drawId }) => ({
                [drawId]: { publishingDetail: { published: true } },
              }))
            ),
            published: true,
          },
        },
      };
      event.timeItems = [timeItem];
      event.published = undefined;
    }
  });

  return { events, eventPairParticipants };
}
