// handles situation where draw data in legacy tournament is missing draw_position attributes for some matches

export function getPositionAssignmentHashes({ matches = [] }) {
  const positionHashMap = {};
  matches.forEach(legacyMatch => {
    legacyMatch.teams?.forEach((team, index) => {
      if (!team?.length) return;

      const idHash = team
        .map(player => player?.id)
        .filter(f => f)
        .sort()
        .join('|');

      const opponent1 =
        team && team[0] && typeof team[0] === 'object' && team[0];
      const opponent2 =
        team && team[1] && typeof team[1] === 'object' && team[1];
      const drawPosition = opponent1?.draw_position || opponent2?.draw_position;

      if (idHash && drawPosition && !positionHashMap[idHash])
        positionHashMap[idHash] = drawPosition;

      if (opponent1.players) {
        Object.keys(opponent1.players).forEach(playerId => {
          positionHashMap[playerId] = drawPosition;
        });
      }
    });
  });
  return positionHashMap;
}
