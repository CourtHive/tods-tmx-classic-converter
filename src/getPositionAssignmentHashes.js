// handles situation where draw data in legacy tournament is missing draw_position attributes for some matches

export function getPositionAssignmentHashes({ matches }) {
  const positionHashMap = {};
  matches.forEach(legacyMatch => {
    legacyMatch.teams.forEach((team, index) => {
      if (!team?.length) return;

      const idHash = team
        .map(player => player?.id)
        .filter(f => f)
        .sort()
        .join('|');

      const player1 = team && team[0] && typeof team[0] === 'object' && team[0];
      const player2 = team && team[1] && typeof team[1] === 'object' && team[1];
      const drawPosition = player1?.draw_position || player2?.draw_position;
      if (idHash && drawPosition && !positionHashMap[idHash])
        positionHashMap[idHash] = drawPosition;
    });
  });
  return positionHashMap;
}
