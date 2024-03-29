import { normalizeName } from './normalizeName';
import { getGender } from './utilities';
import { matchFx } from './matchFx';
import { format } from 'date-fns';
import { drawFx } from './drawFx';

import {
  errorConditionConstants,
  entryStatusConstants,
  participantConstants,
  timeItemConstants,
  tournamentEngine,
  participantTypes,
  participantRoles,
  penaltyConstants,
  scaleConstants,
  fixtures,
  tools,
} from 'tods-competition-factory';

const dfx = drawFx();

export function extractParticipants({ tournament }) {
  const {
    individualParticipants,
    schools,
    clubs,
  } = extractIndividualParticipants({
    tournament,
  });
  const tournamentId = tournament.tuid;
  const tournamentRecord = {
    participants: individualParticipants,
    tournamentId: tournamentId || 'foo',
  };
  tournamentEngine.setState(tournamentRecord);

  extractPairParticipants({
    participants: individualParticipants,
    tournament,
  });

  Object.values(schools).forEach(groupParticipant => {
    tournamentEngine.addParticipant({
      participant: groupParticipant,
    });
  });
  Object.values(clubs).forEach(groupParticipant => {
    tournamentEngine.addParticipant({
      participant: groupParticipant,
    });
  });

  const tournamentParticipants = tournamentEngine.getParticipants()
    .participants;

  const teamParticipants = extractTeamParticipants({
    tournament,
  });

  const competitorParticipants = tournamentParticipants.concat(
    ...teamParticipants
  );

  return { competitorParticipants };
}

function extractTeamParticipants({ tournament }) {
  const teamParticipants = (tournament.teams || []).map(team => {
    const individualParticipantIds = Object.keys(team.players);
    const teamParticipant = {
      participantId: team.id,
      participantType: participantTypes.TEAM,
      participantRole: participantRoles.COMPETITOR,
      participantOtherName: team.abbreviation,
      individualParticipantIds,
      participantName: team.name,
      representing: team.ioc,
    };
    if (team.code) {
      teamParticipant.extensions = [{ name: 'code', value: team.code }];
    }

    return teamParticipant;
  });

  return teamParticipants;
}

function extractPairParticipants({ participants, tournament }) {
  const pairParticipants = [];
  const legacyEvents = tournament.events || [];
  const legacyDual = tournament.type === 'dual';
  const relevantEvents = legacyEvents.filter(
    legacyEvent => legacyEvent.format === 'D' || legacyDual
  );
  relevantEvents?.forEach(legacyEvent => {
    const matches = matchFx.eventMatches(legacyEvent, tournament, true);
    const teams = matches.map(match => match.teams).flat();
    teams
      .filter(team => Array.isArray(team) && team.length === 2)
      ?.forEach(team => {
        const individualParticipants = team
          .map(player =>
            participants.find(participant => {
              const matchingParticipantId =
                participant.participantId === getId(player);
              const foundInOtherIds = participant?.person?.personOtherIds?.find(
                otherId => otherId.personId === getId(player)
              );
              return matchingParticipantId || foundInOtherIds;
            })
          )
          .filter(Boolean);
        if (individualParticipants.length === 2) {
          const participantName = individualParticipants
            .map(participant => participant.person.standardFamilyName)
            .join('/');
          const individualParticipantIds = individualParticipants.map(
            participant => participant.participantId
          );
          const pairParticipant = {
            participantType: participantTypes.PAIR,
            participantRole: participantRoles.COMPETITOR,
            individualParticipantIds,
            participantName,
          };
          tournamentEngine.addParticipant({ participant: pairParticipant });
          pairParticipants.push(pairParticipant);
        }
      });
  });

  return pairParticipants;
}

const getId = p => p?.id || p?.puid;
function extractIndividualParticipants({ tournament }) {
  const players = tournament.players || [];
  const individualParticipantIds = [];
  const individualParticipants = [];
  const schools = {};
  const clubs = {};

  const tournamentStartDate =
    tournament.start && format(new Date(tournament.start), 'yyyy-MM-dd');
  const tournamentCategory = tournament.category;
  const organisationId = tournament.org?.ouid;

  function getISO(ioc) {
    const country = fixtures.countries.find(country => country.ioc === ioc);
    return country?.iso || ioc;
  }

  function getPlayerBirth(birth) {
    if (!isValidDate(birth)) return undefined;
    try {
      return format(new Date(player.birth), 'yyyy-MM-dd');
    } catch (err) {
      return undefined;
    }
  }

  function addParticipant(player) {
    const participantId = getId(player);
    const standardFamilyName = getName(player.last_name);
    const standardGivenName = getName(player.first_name);
    const participantName = `${standardFamilyName.toUpperCase()}, ${standardGivenName}`;
    const birthDate = getPlayerBirth(player.birth);

    const participant = {
      participantName,
      participantId,
      participantType: participantTypes.INDIVIDUAL,
      participantRole: participantRoles.COMPETITOR,
      timeItems: [],
      person: {
        personId: participantId,
        standardFamilyName,
        standardGivenName,
        sex: getGender(player.sex),
        nationalityCode: getISO(player.ioc),
        birthDate,
        otherNames: [],
      },
    };

    addSignInStatus({ player, participant, tournamentStartDate });
    addOtherNames({ player, participant });
    addOtherIds({ player, participant, organisationId });
    addRankings({
      tournamentStartDate,
      tournamentCategory,
      participant,
      player,
    });
    addRatings({ player, participant, tournamentStartDate });
    addPenalties({ player, participant, tournamentStartDate });
    addTimeItems({ player, participant, tournamentStartDate });
    addExtensions({ player, participant });

    if (!individualParticipantIds?.includes(participant.participantId)) {
      individualParticipants.push(participant);
      individualParticipantIds.push(participantId);
    }

    const { club, club_code, club_name, school } = player;
    if (club_code && !club_name) {
      if (!clubs[club_code])
        clubs[club_code] = {
          extensions: [{ name: 'clubId', value: club_code }],
          participantType: participantTypes.GROUP,
          participantRole: participantRoles.OTHER,
          participantRoleResponsibilities: ['CLUB'],
          participantId: tools.UUID(),
          individualParticipantIds: [],
          participantName: club_code,
        };
      if (
        !clubs[club_code].individualParticipantIds.includes(
          participant.participantId
        )
      ) {
        clubs[club_code].individualParticipantIds.push(
          participant.participantId
        );
      }
    }
    if (club_name) {
      if (!clubs[club_name]) {
        clubs[club_name] = {
          participantType: participantTypes.GROUP,
          participantRole: participantRoles.OTHER,
          participantRoleResponsibilities: ['CLUB'],
          participantId: tools.UUID(),
          individualParticipantIds: [],
          participantName: club_name,
        };
      }
      if (club_code) {
        clubs[club_name].extensions = [{ name: 'clubId', value: club_code }];
      }
      if (
        !clubs[club_name].individualParticipantIds.includes(
          participant.participantId
        )
      ) {
        clubs[club_name].individualParticipantIds.push(
          participant.participantId
        );
      }
    }
    if (school) {
      if (!schools[school]) {
        schools[school] = {
          participantType: participantTypes.GROUP,
          participantRole: participantRoles.OTHER,
          participantRoleResponsibilities: ['SCHOOL'],
          participantId: tools.UUID(),
          individualParticipantIds: [],
          participantName: school,
        };
      }
      if (
        !schools[school].individualParticipantIds.includes(
          participant.participantId
        )
      ) {
        schools[school].individualParticipantIds.push(
          participant.participantId
        );
      }
    }
  }

  players?.forEach(addParticipant);
  const relevantEvents = tournament.events?.filter(event => event.draw) || [];
  // check that there are no individual participants in draws that are not in tournament.players
  relevantEvents?.forEach(event => {
    const matches = dfx.matches(event.draw);
    const players = matches.map(matchUp => matchUp.teams).flat(Infinity);
    // players which have .players are team participants
    players.filter(f => f && !f.players).forEach(addParticipant);
  });

  return { individualParticipants, clubs, schools };
}

function isValidDate(date) {
  if (!date) return;
  try {
    // const formatted = format(new Date(date), 'yyyy-MM-dd');
    const dateObject = new Date(date);
    return dateObject?.toString().trim() ===
      errorConditionConstants.INVALID_DATE
      ? false
      : true;
  } catch (err) {
    return false;
  }
}

function getName(text) {
  return normalizeName(text || '', ['de', 'la', 'da']);
}

function addOtherNames({ player, participant }) {
  if (player.nickname) participant.person.otherNames.push(player.nickname);
}
function addOtherIds({ player, participant, organisationId }) {
  if (player.cropin) {
    const personOtherIds = [
      {
        organisationId,
        uniqueOrganisationName: 'HTS',
        personId: player.cropin,
      },
    ];
    participant.person.personOtherIds = personOtherIds;
  }
  if (player.id && player.puid && player.puid !== player.id) {
    if (!participant.person.personOtherIds)
      participant.person.personOtherIds = [];
    const otherId = {
      organisationId,
      uniqueOrganisationName: 'System',
      personId: player.puid,
    };
    participant.person.personOtherIds.push(otherId);
  }
}

function addRankings({
  player,
  participant,
  tournamentStartDate,
  tournamentCategory,
}) {
  if (player.rank && tournamentCategory) {
    const itemType = `${scaleConstants.SCALE}.${scaleConstants.RANKING}.SINGLES.${tournamentCategory}`;
    const timeItem = {
      itemValue: player.rank,
      timestamp: tournamentStartDate,
      itemType,
    };
    const result = tournamentEngine.addTimeItem({
      removePriorValues: true,
      duplicateValues: false,
      element: participant,
      creationTime: false,
      timeItem,
    });
    if (result.error) console.log(result, { timeItem });
  }
  if (player.modified_ranking && tournamentCategory) {
    const itemType = `${scaleConstants.SCALE}.${scaleConstants.RANKING}.SINGLES.${tournamentCategory}`;
    const timeItem = {
      itemValue: player.modified_ranking,
      timestamp: tournamentStartDate,
      itemType,
    };
    const result = tournamentEngine.addTimeItem({
      removePriorValues: true,
      duplicateValues: false,
      element: participant,
      creationTime: false,
      timeItem,
    });
    if (result.error) console.log(result, { timeItem });
  }
  if (player.rankings) {
    Object.keys(player.rankings).forEach(key => {
      const itemType = `${scaleConstants.SCALE}.${scaleConstants.RANKING}.SINGLES.${key}`;
      const timeItem = {
        itemValue: player.rankings[key],
        timestamp: tournamentStartDate,
        itemType,
      };
      const result = tournamentEngine.addTimeItem({
        removePriorValues: true,
        duplicateValues: false,
        element: participant,
        creationTime: false,
        timeItem,
      });
      if (result.error) console.log(result, { timeItem });
    });
  }
  if (player.category_dbls && tournamentCategory) {
    const itemType = `${scaleConstants.SCALE}.${scaleConstants.RANKING}.DOUBLES.${tournamentCategory}`;
    const timeItem = {
      itemValue: player.category_dbls,
      timestamp: tournamentStartDate,
      itemType,
    };
    const result = tournamentEngine.addTimeItem({
      removePriorValues: true,
      duplicateValues: false,
      element: participant,
      creationTime: false,
      timeItem,
    });
    if (result.error) console.log(result, { timeItem });
  }
}

function addRatings({ player, participant, tournamentStartDate }) {
  if (player.ratings) {
    Object.keys(player.ratings).forEach(key => {
      Object.keys(player.ratings[key]).forEach(ratingType => {
        const itemType = `${scaleConstants.SCALE}.${
          scaleConstants.RATING
        }.${ratingType.toUpperCase()}.${key.toUpperCase()}`;
        const ratingAccessor = `${key.toLowerCase()}Rating`;
        const timeItem = {
          itemValue: {
            [ratingAccessor]: player.ratings[key][ratingType].value,
          },
          timestamp: tournamentStartDate,
          itemType,
        };
        const result = tournamentEngine.addTimeItem({
          removePriorValues: true,
          duplicateValues: false,
          element: participant,
          creationTime: false,
          timeItem,
        });
        if (result.error) console.log(result, { timeItem });
      });
    });
  }
}

function addTimeItems({ player, participant, tournamentStartDate }) {
  if (player.registered) {
    const itemType = `ENTRY.${timeItemConstants.REGISTRATION}`;
    const timeItem = {
      itemValue: player.registered,
      timestamp: tournamentStartDate,
      itemType,
    };
    const result = tournamentEngine.addTimeItem({
      removePriorValues: true,
      duplicateValues: false,
      element: participant,
      creationTime: false,
      timeItem,
    });
    if (result.error) console.log(result, { timeItem });
  }
  if (player.withdrawn === 'Y' && player.withdrew) {
    const itemType = `ENTRY.${entryStatusConstants.WITHDRAWN}`;
    const timeItem = {
      itemValue: player.withdrew,
      timestamp: tournamentStartDate,
      itemType,
    };
    const result = tournamentEngine.addTimeItem({
      removePriorValues: true,
      duplicateValues: false,
      element: participant,
      creationTime: false,
      timeItem,
    });
    if (result.error) console.log(result, { timeItem });
  }
}

function addExtensions({ player, participant }) {
  if (player.suspended_until) {
    const date = new Date(player.suspended_until);
    if (tools.dateTime.isDate(date)) {
      const name = `${timeItemConstants.ELIGIBILITY}.${timeItemConstants.SUSPENSION}.UNTIL`;
      const extension = {
        value: tools.dateTime.formatDate(date),
        name,
      };
      tournamentEngine.addExtension({
        element: participant,
        creationTime: false,
        extension,
      });
    }
  }
  if (player.registered_until) {
    const date = new Date(player.registered_until);
    if (tools.dateTime.isDate(date)) {
      const name = `${timeItemConstants.ELIGIBILITY}.${timeItemConstants.REGISTRATION}.UNTIL`;
      const extension = {
        value: tools.dateTime.formatDate(player.registered_until),
        name,
      };
      tournamentEngine.addExtension({
        element: participant,
        creationTime: false,
        extension,
      });
    }
  }
  if (player.right_to_play_until) {
    const date = new Date(player.right_to_play_until);
    if (tools.dateTime.isDate(date)) {
      const name = `${timeItemConstants.ELIGIBILITY}.${timeItemConstants.MEDICAL}.UNTIL`;
      const extension = {
        value: tools.dateTime.formatDate(player.right_to_play_until),
        name,
      };
      tournamentEngine.addExtension({
        element: participant,
        creationTime: false,
        extension,
      });
    }
  }
}

function addSignInStatus({ player, participant, tournamentStartDate }) {
  const itemValue = player.signed_in
    ? participantConstants.SIGNED_IN
    : participantConstants.SIGNED_OUT;
  const timeItem = {
    itemType: participantConstants.SIGN_IN_STATUS,
    timeStamp: tournamentStartDate,
    itemValue,
  };
  const result = tournamentEngine.addTimeItem({
    removePriorValues: true,
    duplicateValues: false,
    element: participant,
    creationTime: false,
    timeItem,
  });
  if (result.error) console.log(result, { timeItem });
}

function addPenalties({ player, participant, tournamentStartDate }) {
  if (player.penalties) {
    participant.penalties = [];
    player.penalties?.forEach(penalty => {
      const penaltyTime =
        (isValidDate(penalty.time) && penalty.time) || tournamentStartDate;
      const penaltyId = tools.UUID();
      const penaltyItem = {
        penaltyId,
        matchUpId: penalty.muid,
        penaltyType: getPenaltyType(penalty),
        notes: penalty.penalty,
        createdAt: new Date(penaltyTime).toISOString(),
      };
      participant.penalties.push(penaltyItem);
    });
  }

  function getPenaltyType(penalty) {
    if (penalty.penalty?.value === 'unsporting')
      return penaltyConstants.UNSPORTSMANLIKE_CONDUCT;
    if (penalty.penalty?.value === 'fail2signout')
      return penaltyConstants.FAILURE_TO_COMPLETE;
    if (penalty.penalty?.value === 'illegalcoaching')
      return penaltyConstants.COACHING;
    if (penalty.penalty?.value === 'ballabuse')
      return penaltyConstants.BALL_ABUSE;
    if (penalty.penalty?.value === 'racquetabuse')
      return penaltyConstants.RACKET_ABUSE;
    if (penalty.penalty?.value === 'equipmentabuse')
      return penaltyConstants.EQUIMENT_VIOLATION;
    if (penalty.penalty?.value === 'cursing')
      return penaltyConstants.UNSPORTSMANLIKE_CONDUCT;
    if (penalty.penalty?.value === 'rudegestures')
      return penaltyConstants.UNSPORTSMANLIKE_CONDUCT;
    if (penalty.penalty?.value === 'foullanguage')
      return penaltyConstants.UNSPORTSMANLIKE_CONDUCT;
    if (penalty.penalty?.value === 'timeviolation')
      return penaltyConstants.PUNCTUALITY;
    if (penalty.penalty?.value === 'latearrival')
      return penaltyConstants.PUNCTUALITY;
  }
}
