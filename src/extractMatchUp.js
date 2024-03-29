import { matchFormatCode } from './matchFormatCode';
import { scoreFormat } from './scoreFormat';
import { dateFx } from './dateFx';
import {
  participantRoles,
  participantConstants,
  entryStatusConstants,
  matchUpStatusConstants,
  tournamentEngine,
} from 'tods-competition-factory';

const getId = p => p?.id || p?.puid;

export function extractMatchUp({
  drawPositionHashMap = {},
  drawPositionOffset = 0,
  participantIds,
  matchUpFormat,
  participants,
  isAdhocEvent,
  legacyMatch,
  entryStage,
  eventType,
  seedLimit,
  tieFormat,
}) {
  const matchUpId = legacyMatch.match?.muid || legacyMatch.muid;

  const sides = [];
  const entries = [];
  const seedAssignments = [];
  const missingParticipants = [];
  const positionAssignments = [];

  let matchUpType =
    eventType === 'TEAM' ? legacyMatch.format?.toUpperCase() : eventType;

  if (eventType === 'TEAM' && !matchUpType) {
    matchUpType = 'TEAM';
  }

  const collectionDefinition = tieFormat?.collectionDefinitions.find(
    collectionDefinition => collectionDefinition.matchUpType === matchUpType
  );
  const collectionId = collectionDefinition?.collectionId;

  let scoreString = legacyMatch.match?.score || legacyMatch.score || '';

  const time = scoreString.indexOf('TIME') > 0;
  const live = scoreString.indexOf('LIVE') > 0;
  const interrupted = scoreString.indexOf('INT') > 0;
  const incomplete = scoreString.indexOf('INC') > 0;
  const walkover = scoreString.indexOf('W.O.') >= 0;
  const cancelled = scoreString.indexOf('CCL') >= 0;
  const abandoned = scoreString.indexOf('ABD') >= 0;
  const defaulted = scoreString.indexOf('DEF') >= 0;
  const retired = scoreString.indexOf('RET') > 0;
  [
    'INT.',
    'INC.',
    'CCL.',
    'ABD.',
    'DEF.',
    'RET.',
    'TIME',
    'LIVE',
    'INT',
    'INC',
    'W.O.',
    'CCL',
    'ABD',
    'DEF',
    'RET',
  ]?.forEach(
    stringStatus =>
      (scoreString = (scoreString || '')
        .split(stringStatus)
        .join('')
        .trim())
  );
  let winner_index =
    legacyMatch.match?.winner_index !== undefined &&
    legacyMatch.match.winner_index;
  if (![0, 1].includes(parseInt(winner_index)))
    winner_index = legacyMatch.winner_index;
  const winner = [0, 1].includes(parseInt(winner_index));
  let winningSide = (winner && winner_index + 1) || undefined;

  let missingDrawPositions = 0;
  let isBye = false;

  if (Array.isArray(legacyMatch.teams)) {
    legacyMatch.teams?.forEach((team, index) => {
      if (!team?.length) return;

      let participantId;
      const individualParticipantIds = team.map(getId).filter(Boolean);

      const player1 = team?.[0] && typeof team[0] === 'object' && team[0];
      const player2 = team?.[1] && typeof team[1] === 'object' && team[1];
      let drawPosition =
        (drawPositionHashMap &&
          (drawPositionHashMap[player1?.id] ||
            drawPositionHashMap[player1?.puid] ||
            drawPositionHashMap[player2?.id] ||
            drawPositionHashMap[player2?.puid])) ||
        player1?.draw_position ||
        player2?.draw_position;

      if (drawPosition) drawPosition += drawPositionOffset;

      if (winningSide && !drawPosition && !isAdhocEvent) {
        missingDrawPositions++;
      }

      const seed = player1?.seed;
      const bye = player1?.bye;

      if (individualParticipantIds.length === 1) {
        participantId = individualParticipantIds[0];
      }
      if (individualParticipantIds.length === 2) {
        let { participant } = tournamentEngine.getPairedParticipant({
          participantIds: individualParticipantIds,
        });
        if (!participant) {
          ({ participant } = tournamentEngine.addParticipant({
            participant: {
              participantType: 'PAIR',
              participantRole: 'COMPETITOR',
              individualParticipantIds: [getId(player1), getId(player2)],
            },
          }));
          missingParticipants.push(participant);
        }
        participantId = participant?.participantId;
      }

      const side = { sideNumber: index + 1 };
      if (drawPosition) side.drawPosition = drawPosition;
      if (bye) {
        side.bye = bye;
        isBye = true;
      }

      if (participantId) {
        side.participantId = participantId;
      } else {
        // console.log('no participantId', { team, individualParticipantIds });
      }

      sides.push(side);

      if (participantId && !participantIds?.includes(participantId)) {
        participantIds.push(participantId);
        const entry = {
          entryStage,
          participantId,
          entryStatus: entryStatusConstants.DIRECT_ACCEPTANCE,
        };
        entries.push(entry);
        const positionAssignment = { drawPosition, participantId };
        if (!isAdhocEvent) {
          positionAssignments.push(positionAssignment);
          if (seed && seed <= seedLimit) {
            const seedAssignment = {
              seedNumber: seed,
              seedValue: seed, // TODO: check whether there is a seed display value in TMX 1.9
              participantId,
            };
            seedAssignments.push(seedAssignment);
          }
        }
      } else if (bye) {
        const positionAssignment = { drawPosition, bye };
        if (!isAdhocEvent) positionAssignments.push(positionAssignment);
      }
    });
  }

  const timeItems = getTimeItems({ participants, legacyMatch });
  const drawPositions =
    sides?.map(side => side.drawPosition).filter(Boolean) || [];

  if (drawPositions[1] < drawPositions[0]) {
    winningSide = 3 - winningSide;
  }

  const reversedScoreString = reverseScore(scoreString) || '';
  const scoreStringSide1 = matchTiebreakTODS(
    !winner || winningSide === 1 ? scoreString : reversedScoreString
  );
  const scoreStringSide2 = matchTiebreakTODS(
    !winner || winningSide === 1 ? reversedScoreString : scoreString
  );
  const sets = tournamentEngine.parseScoreString({
    scoreString: scoreStringSide1,
  });
  const score = {
    scoreStringSide1,
    scoreStringSide2,
    sets,
  };

  const matchUp = {
    drawPositions: drawPositions.slice().sort(),
    matchUpId,
    score,
  };

  if (isAdhocEvent) {
    matchUp.sides = sides;
    matchUp.roundNumber = legacyMatch.round || 1;
  }

  const matchUpStatus =
    (live && matchUpStatusConstants.IN_PROGRESS) ||
    (interrupted && matchUpStatusConstants.SUSPENDED) ||
    (incomplete && matchUpStatusConstants.INCOMPLETE) ||
    (walkover && matchUpStatusConstants.WALKOVER) ||
    (cancelled && matchUpStatusConstants.NOT_PLAYED) ||
    (abandoned && matchUpStatusConstants.ABANDONED) ||
    (defaulted && matchUpStatusConstants.DEFAULTED) ||
    (retired && matchUpStatusConstants.RETIRED) ||
    (isBye && matchUpStatusConstants.BYE) ||
    (winningSide && matchUpStatusConstants.COMPLETED) ||
    (time && matchUpStatusConstants.COMPLETED) ||
    (!winningSide && matchUpStatusConstants.TO_BE_PLAYED);

  if (matchUpType) matchUp.matchUpType = matchUpType;
  if (winningSide) matchUp.winningSide = winningSide;
  if (timeItems?.length) matchUp.timeItems = timeItems;
  if (collectionId) matchUp.collectionId = collectionId;
  if (matchUpStatus) matchUp.matchUpStatus = matchUpStatus;

  const format = legacyMatch.match?.score_format || legacyMatch.score_format;
  const formatCode =
    format && matchFormatCode.stringify(scoreFormat.jsonTODS(format));
  matchUpFormat = legacyMatch.match?.matchFormat || matchUpFormat;
  if (formatCode || matchUpFormat)
    matchUp.matchUpFormat = formatCode || matchUpFormat;

  const collectionPosition = legacyMatch.sequence;
  if (collectionPosition) {
    matchUp.collectionPosition = collectionPosition;
  }

  return {
    missingDrawPositions,
    positionAssignments,
    missingParticipants,
    seedAssignments,
    matchUp,
    entries,
  };
}

function getTimeItems({ participants, legacyMatch }) {
  const timeItems = [];
  const schedule = legacyMatch.match?.schedule || legacyMatch.schedule || {};
  const umpire = legacyMatch.match?.umpire || legacyMatch.umpire;

  if (schedule.luid && schedule.index >= 0) {
    let timeItem = {
      itemType: 'SCHEDULE.ASSIGNMENT.VENUE',
      itemValue: schedule.luid,
    };
    timeItems.push(timeItem);

    timeItem = {
      itemType: 'SCHEDULE.ASSIGNMENT.COURT',
      itemValue: `${schedule.luid}|${parseInt(schedule.index)}`,
    };
    timeItems.push(timeItem);
  }

  if (schedule.day) {
    const timeItem = {
      itemType: 'SCHEDULE.DATE',
      itemValue: schedule.day,
    };
    timeItems.push(timeItem);

    if (schedule.start) {
      const startTime = properTime(schedule.start);
      const startDateTime = `${dateFx.formatDate(schedule.day)}T${startTime}`;
      const timeItem = {
        itemType: 'SCHEDULE.TIME.START',
        itemValue: new Date(startDateTime).toISOString(),
      };
      timeItems.push(timeItem);
    }

    if (schedule.end) {
      const endTime = properTime(schedule.end);
      const endDateTime = `${dateFx.formatDate(schedule.day)}T${endTime}`;
      const timeItem = {
        itemType: 'SCHEDULE.TIME.END',
        itemValue: new Date(endDateTime).toISOString(),
      };
      timeItems.push(timeItem);
    }
  }

  if (
    schedule.oop_round &&
    schedule.day &&
    schedule.luid &&
    schedule.index >= 0
  ) {
    const timeItem = {
      itemType: 'SCHEDULE.COURT.ORDER',
      itemValue: schedule.oop_round,
    };
    timeItems.push(timeItem);

    if (schedule.heading || schedule.time_prefix) {
      const timeModifiers = [];
      if (schedule.heading?.includes('Followed By'))
        timeModifiers.push('FOLLOWED_BY');
      if (schedule.heading?.includes('Next Available'))
        timeModifiers.push('NEXT_AVAILABLE');
      if (schedule.time_prefix?.includes('After Rest'))
        timeModifiers.push('AFTER_REST');
      if (schedule.time_prefix?.includes('NB'))
        timeModifiers.push('NOT_BEFORE');

      const timeItem = {
        itemType: 'SCHEDULE.TIME.MODIFIERS',
        itemValue: timeModifiers,
      };
      timeItems.push(timeItem);
    }
  }

  if (schedule.time) {
    const itemValue = properTime(schedule.time);
    const timeItem = {
      itemType: 'SCHEDULE.TIME.SCHEDULED',
      itemValue,
    };
    timeItems.push(timeItem);
  }

  if (umpire) {
    const tournamentOfficials = participants?.filter(
      participant =>
        participant.participantType === participantConstants.INDIVIDUAL &&
        participant.participantRole === participantRoles.OFFICIAL
    );
    const official = tournamentOfficials.find(
      official => official.name === umpire
    );
    const itemValue = official?.participantId;
    const timeItem = {
      itemType: 'SCHEDULE.ASSIGNMENT.OFFICIAL',
      itemValue,
    };
    if (itemValue) timeItems.push(timeItem);
  }

  return timeItems;
}

function properTime(time) {
  const military = dateFx.militaryTime(time);
  const zeroPad = number => (number.toString()[1] ? number : '0' + number);
  return military
    .split(':')
    .map(part => zeroPad(part))
    .join(':');
}

function matchTiebreakTODS(score = '') {
  return score
    .split(' ')
    .map(set => {
      return set.includes('/') ? matchTiebreak(set) : set;
    })
    .join(' ');

  function matchTiebreak(set) {
    return `[${set.split('/').join('-')}]`;
  }
}

function reverseScore(score, split = ' ') {
  let irreversible = null;
  if (score) {
    let reversed = score
      .split(split)
      .map(parseSet)
      .join(split);
    let result = irreversible ? `${irreversible} ${reversed}` : reversed;
    return result;
  }

  function parseSet(set) {
    let divider = set.indexOf('/') > 0 ? '/' : '-';
    let set_scores = set
      .split(divider)
      .map(parseSetScore)
      .reverse()
      .filter(Boolean);
    let set_games = set_scores.map(s => s.games);
    let tb_scores = set_scores.map(s => s.tiebreak).filter(Boolean);
    let tiebreak = tb_scores.length === 1 ? `(${tb_scores[0]})` : '';
    let set_score =
      tb_scores.length < 2
        ? set_games.join(divider)
        : set_games.map((s, i) => `${s}(${tb_scores[i]})`).join(divider);
    return `${set_score}${tiebreak}`;
  }

  function parseSetScore(set) {
    let ss = /(\d+)/;
    let sst = /(\d+)\((\d+)\)/;
    if (sst.test(set))
      return { games: sst.exec(set)[1], tiebreak: sst.exec(set)[2] };
    if (ss.test(set)) return { games: ss.exec(set)[1] };
    irreversible = set;
    return undefined;
  }
}
