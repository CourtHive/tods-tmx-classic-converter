// handles situation where draw data in legacy tournament is missing draw_position attributes for some matches

const getId = p => p?.id || p?.puid;

export function getPositionAssignmentHashes({
  matches = [],
  tournament,
  brackets,
}) {
  const positionHashMap = {};
  matches.forEach(legacyMatch => {
    legacyMatch.teams?.forEach(team => {
      if (!team?.length) return;
      addToHash(team);
    });
    if (legacyMatch.winner) addToHash(legacyMatch.winner);
    if (legacyMatch.loser) addToHash(legacyMatch.loser);
  });

  function addToHash(side, position) {
    const opponent1 = side && side[0] && typeof side[0] === 'object' && side[0];
    const opponent2 = side && side[1] && typeof side[1] === 'object' && side[1];
    const drawPosition = opponent1?.draw_position || opponent2?.draw_position;
    const addTeamPlayers = players => {
      Object.keys(players).forEach(playerId => {
        positionHashMap[playerId] = drawPosition;
      });
    };
    const checkTournamentTeams = id => {
      const team = tournament?.teams?.find(team => team.id === id);
      if (team?.players) addTeamPlayers(team.players);
    };

    if (drawPosition) {
      if (opponent1?.id) positionHashMap[opponent1.id] = drawPosition;
      if (opponent2?.id) positionHashMap[opponent2.id] = drawPosition;
      if (opponent1?.puid) positionHashMap[opponent1.puid] = drawPosition;
      if (opponent2?.puid) positionHashMap[opponent2.puid] = drawPosition;
      if (opponent1.players) addTeamPlayers(opponent1.players);
      checkTournamentTeams(opponent1?.id);
    }
  }

  // handle round robins which have no draw positions specified
  if (brackets && !Object.keys(positionHashMap).length) {
    brackets.forEach(bracket => {
      const byePositions = bracket.byes?.map(bye => bye.position) || [];
      bracket.teams?.forEach((team, index) => {
        if (!byePositions.includes(index + 1)) addToHash(team, index + 1);
      });
    });
    console.log({ positionHashMap });
  }

  return positionHashMap;
}
