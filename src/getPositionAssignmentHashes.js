// handles situation where draw data in legacy tournament is missing draw_position attributes for some matches

const getId = p => p?.id || p?.puid;

export function getPositionAssignmentHashes({ matches = [] }) {
  const positionHashMap = {};
  matches.forEach(legacyMatch => {
    legacyMatch.teams?.forEach((team, index) => {
      if (!team?.length) return;

      const opponent1 =
        team && team[0] && typeof team[0] === 'object' && team[0];
      const opponent2 =
        team && team[1] && typeof team[1] === 'object' && team[1];
      const drawPosition = opponent1?.draw_position || opponent2?.draw_position;

      if (drawPosition) {
        if (getId(opponent1)) positionHashMap[getId(opponent1)] = drawPosition;
        if (getId(opponent2)) positionHashMap[getId(opponent2)] = drawPosition;
        if (opponent1.players) {
          Object.keys(opponent1.players).forEach(playerId => {
            positionHashMap[playerId] = drawPosition;
          });
        }
      }
    });
  });
  return positionHashMap;
}
