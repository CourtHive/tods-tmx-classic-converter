import { convertTieFormat } from './convertTieFormat';
import { extractStructures } from './extractStructures';
import { matchFormatCode } from './matchFormatCode';
import { scoreFormat } from './scoreFormat';
import {
  tournamentEngine,
  factoryConstants,
  matchUpTypes,
  utilities,
} from 'tods-competition-factory';

import {
  getGender,
  getSurface,
  intersection,
  getMatchUpType,
  getIndoorOutdoor,
  getAgeCategoryCode,
} from './utilities';

export function extractEvents({ tournament, participants }) {
  const eventCategories = {};
  const legacyEvents = tournament.events || [];
  const tournamentId = tournament.tuid;
  const tournamentRecord = {
    participants,
    tournamentId: tournamentId || 'foo',
  };
  tournamentEngine.setState(tournamentRecord);

  // linkedStructures are events which have explicit links
  const linkedStructures = {};

  legacyEvents?.forEach(legacyEvent => {
    const euid = legacyEvent.euid;
    const eventIds = [euid];
    legacyEvent.links &&
      Object.keys(legacyEvent.links).forEach(key => {
        const linkedEuid = legacyEvent.links[key];
        eventIds.push(linkedEuid);
      });
    const groupEuid = intersection(Object.keys(linkedStructures), eventIds);
    if (groupEuid.length) {
      linkedStructures[groupEuid[0]][euid] = legacyEvent;
    } else {
      linkedStructures[euid] = { [euid]: legacyEvent };
    }
  });

  Object.keys(linkedStructures).forEach(key => {
    const structureGroup = linkedStructures[key];
    const structureGroupIds = Object.keys(structureGroup);
    const groupStructures = structureGroupIds.map(id => structureGroup[id]);
    const structureGroupDrawTypes = groupStructures.map(
      event => event.draw_type
    );
    const mainDrawTypes = ['E', 'S'];
    if (!intersection(mainDrawTypes, structureGroupDrawTypes).length) {
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
    const ageCategoryCode = getAgeCategoryCode(mainLegacyEvent.category);
    const category = { categoryName: mainLegacyEvent.category };
    if (ageCategoryCode) category.ageCategoryCode = ageCategoryCode;

    const {
      name,
      automated,
      draw_size,
      matchorder,
      draw_created,
      broadcast_name,
      custom_category,
      category: legacyCategory,
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
      structures,
      links,
    } = extractStructures({
      eventType,
      tieFormat,
      tournament,
      participants,
      matchUpFormat,
      mainStructureId: mainLegacyEvent.euid,
      legacyEvents: groupStructures,
    });

    const hasPopulatedMatchUps = structures
      .map(
        structure =>
          structure.positionAssignments.filter(a => a.participantId).length
      )
      .reduce((a, b) => a + b, 0).length;

    const drawDefinition = {
      // entries for a drawDefinition needs to be aggregated from structures
      drawId: utilities.UUID(),
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
      .slice(0, 12);

    const eventId = `${tournamentId.split('-')[0]}-${code}`;

    if (!eventCategories[categoryName]) {
      eventCategories[categoryName] = {
        gender,
        eventId,
        category,
        eventType,
        eventRank,
        eventName: categoryName,
        drawDefinitions: hasPopulatedMatchUps ? [drawDefinition] : undefined,
      };
      if (indoorOutdoor)
        eventCategories[categoryName].indoorOutdoor = indoorOutdoor;
      if (surfaceCategory)
        eventCategories[categoryName].surfaceCategory = surfaceCategory;
    } else {
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
    event.drawDefinitions?.forEach(drawDefinition => {
      drawDefinition.entries?.forEach(entry => {
        event.eventEntriesAccumulator[entry.participantId] = entry;
      });
    });
    event.entries = Object.values(event.eventEntriesAccumulator);
    delete event.eventEntriesAccumulator;
  });

  return { events };
}
