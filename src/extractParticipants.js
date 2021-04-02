import { normalizeName } from "normalize-text";
import { getGender } from "./utilities";
import { matchFx } from "./matchFx";
import { format } from "date-fns";
import { drawFx } from "./drawFx";

import {
  errorConditionConstants,
  participantConstants,
  participantRoles,
  penaltyConstants,
  scaleConstants,
  utilities,
} from "tods-competition-factory";

const dfx = drawFx();

export function extractParticipants({ tournament, file }) {
  const individualParticipants = extractIndividualParticipants({ tournament });

  const pairParticipants = extractPairParticipants({
    participants: individualParticipants,
    tournament,
    file,
  });

  const teamParticipants = extractTeamParticipants({
    tournament,
    file,
  });

  const competitorParticipants = individualParticipants.concat(
    ...pairParticipants,
    ...teamParticipants
  );

  return { competitorParticipants };
}

function extractTeamParticipants({ tournament, file }) {
  const teamParticipants = (tournament.teams || []).map((team) => {
    const individualParticipantIds = Object.keys(team.players);
    const teamParticipant = {
      participantId: team.id,
      participantType: participantConstants.TEAM,
      participantRole: participantRoles.COMPETITOR,
      individualParticipantIds,
      participantName: team.name,
    };
    return teamParticipant;
  });

  return teamParticipants;
}

function extractPairParticipants({ tournament, participants, file }) {
  const pairParticipants = [];
  const legacyEvents = tournament.events || [];
  const legacyDual = tournament.type === "dual";
  const relevantEvents = legacyEvents.filter(
    (legacyEvent) => legacyEvent.format === "D" || legacyDual
  );
  relevantEvents.forEach((legacyEvent) => {
    const matches = matchFx.eventMatches(legacyEvent, tournament, true);
    const teams = matches.map((match) => match.teams).flat();
    teams
      .filter((team) => Array.isArray(team) && team.length === 2)
      .forEach((team) => {
        const individualParticipants = team
          .map((player) =>
            participants.find((participant) => {
              const matchingParticipantId =
                participant.participantId === player?.id;
              const foundInOtherIds = participant?.person?.personOtherIds?.find(
                (otherId) => otherId.personId === player?.id
              );
              return matchingParticipantId || foundInOtherIds;
            })
          )
          .filter((f) => f);
        if (individualParticipants.length === 2) {
          const participantName = individualParticipants
            .map((participant) => participant.person.standardFamilyName)
            .join("/");
          const individualParticipantIds = individualParticipants.map(
            (participant) => participant.participantId
          );
          const pairParticipant = {
            participantId: utilities.UUID(),
            participantType: participantConstants.PAIR,
            participantRole: participantRoles.COMPETITOR,
            individualParticipantIds,
            participantName,
          };
          pairParticipants.push(pairParticipant);
        }
      });
  });

  return pairParticipants;
}

function extractIndividualParticipants({ tournament }) {
  const individualParticipants = [];
  const individualParticipantIds = [];
  const players = tournament.players || [];

  const tournamentStartDate =
    tournament.start && format(new Date(tournament.start), "yyyy-MM-dd");
  const tournamentCategory = tournament.category;
  const organisationId = tournament.org?.ouid;

  function addParticipant(player) {
    const participantId = player.id || player.puid;
    const standardFamilyName = getName(player.last_name);
    const standardGivenName = getName(player.first_name);
    const participantName = `${standardFamilyName.toUpperCase()}, ${standardGivenName}`;
    const birthDate =
      isValidDate(player.birth) && format(new Date(player.birth), "yyyy-MM-dd");

    const participant = {
      participantName,
      participantId,
      participantType: participantConstants.INDIVIDUAL,
      participantRole: participantRoles.COMPETITOR,
      timeItems: [],
      person: {
        personId: participantId,
        standardFamilyName,
        standardGivenName,
        sex: getGender(player.sex),
        nationalityCode: player.ioc,
        birthDate,
        otherNames: [],
      },
    };

    addSignInStatus({ player, participant, tournamentStartDate });
    addOtherNames({ player, participant });
    addOtherIds({ player, participant, organisationId });
    addRankings({
      player,
      participant,
      tournamentStartDate,
      tournamentCategory,
    });
    addRatings({ player, participant, tournamentStartDate });
    addPenalties({ player, participant, tournamentStartDate });

    if (!individualParticipantIds.includes(participant.participantId)) {
      individualParticipants.push(participant);
      individualParticipantIds.push(participantId);
    }
  }

  players.forEach(addParticipant);

  const relevantEvents = tournament.events?.filter((event) => event.draw) || [];
  // check that there are no individual participants in draws that are not in tournament.players
  relevantEvents.forEach((event) => {
    const matches = dfx.matches(event.draw);
    const players = matches.map((matchUp) => matchUp.teams).flat(Infinity);
    // players which have .players are team participants
    players.filter((f) => f && !f.players).forEach(addParticipant);
  });

  return individualParticipants;
}

function isValidDate(date) {
  if (!date) return;
  try {
    const dateObject = new Date(date);
    if (dateObject.trim() === errorConditionConstants.INVALID_DATE) {
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

function getName(text) {
  return normalizeName(text || "", ["de", "la", "da"]);
}

function addOtherNames({ player, participant }) {
  if (player.nickname) participant.person.otherNames.push(player.nickname);
}
function addOtherIds({ player, participant, organisationId }) {
  if (player.cropin) {
    const personOtherIds = [
      {
        organisationId,
        uniqueOrganisationName: "HTS",
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
      uniqueOrganisationName: "System",
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
  if (player.rankings) {
    Object.keys(player.rankings).forEach((key) => {
      const itemType = `${scaleConstants.SCALE}.${scaleConstants.RANKING}.SINGLES.${key}`;
      const timeItem = {
        itemType,
        itemValue: player.rankings[key],
        timestamp: tournamentStartDate,
      };
      participant.timeItems.push(timeItem);
    });
  }
  if (player.category_dbls && tournamentCategory) {
    const itemType = `${scaleConstants.SCALE}.${scaleConstants.RANKING}.SINGLES.${tournamentCategory}`;
    const timeItem = {
      itemType,
      itemValue: player.category_dbls,
      timestamp: tournamentStartDate,
    };
    participant.timeItems.push(timeItem);
  }
}

function addRatings({ player, participant, tournamentStartDate }) {
  if (player.ratings) {
    Object.keys(player.ratings).forEach((key) => {
      Object.keys(player.ratings[key]).forEach((ratingType) => {
        const itemType = `${scaleConstants.SCALE}.${
          scaleConstants.RATING
        }.${ratingType.toUpperCase()}.${key.toUpperCase()}`;
        const timeItem = {
          itemType,
          itemValue: player.ratings[key][ratingType].value,
          timestamp: tournamentStartDate,
        };
        if (timeItem.itemValue) participant.timeItems.push(timeItem);
      });
    });
  }
}

function addSignInStatus({ player, participant, tournamentStartDate }) {
  const itemValue = player.signed_in
    ? participantConstants.SIGNED_IN
    : participantConstants.SIGNED_OUT;
  const timeItem = {
    itemSubject: participantConstants.SIGN_IN_STATUS,
    timeStamp: tournamentStartDate,
    itemValue,
  };
  participant.timeItems.push(timeItem);
}

function addPenalties({ player, participant, tournamentStartDate }) {
  if (player.penalties) {
    participant.penalties = [];
    player.penalties.forEach((penalty) => {
      const penaltyTime =
        (isValidDate(penalty.time) && penalty.time) || tournamentStartDate;
      const penaltyId = utilities.UUID();
      const penaltyItem = {
        penaltyId,
        matchUpId: penalty.muid,
        penaltyType: getPenaltyType(penalty),
        notes: penalty.penalty?.label,
        createdAt: new Date(penaltyTime).toISOString(),
      };
      participant.penalties.push(penaltyItem);
      // TODO: add to matchUp.timeItems
      /*
      const timeItem = {
        itemSubject: "PENALTY",
        itemValue: penaltyItem.penaltyId,
        timeStamp: penaltyItem.createdAt
      };
      */
    });
  }

  function getPenaltyType(penalty) {
    if (penalty.penalty?.value === "unsporting")
      return penaltyConstants.UNSPORTSMANLIKE_CONDUCT;
    if (penalty.penalty?.value === "fail2signout")
      return penaltyConstants.FAILURE_TO_COMPLETE;
    if (penalty.penalty?.value === "illegalcoaching")
      return penaltyConstants.COACHING;
    if (penalty.penalty?.value === "ballabuse")
      return penaltyConstants.BALL_ABUSE;
    if (penalty.penalty?.value === "racquetabuse")
      return penaltyConstants.RACKET_ABUSE;
    if (penalty.penalty?.value === "equipmentabuse")
      return penaltyConstants.EQUIMENT_VIOLATION;
    if (penalty.penalty?.value === "cursing")
      return penaltyConstants.UNSPORTSMANLIKE_CONDUCT;
    if (penalty.penalty?.value === "rudegestures")
      return penaltyConstants.UNSPORTSMANLIKE_CONDUCT;
    if (penalty.penalty?.value === "foullanguage")
      return penaltyConstants.UNSPORTSMANLIKE_CONDUCT;
    if (penalty.penalty?.value === "timeviolation")
      return penaltyConstants.PUNCTUALITY;
    if (penalty.penalty?.value === "latearrival")
      return penaltyConstants.PUNCTUALITY;
  }
}
