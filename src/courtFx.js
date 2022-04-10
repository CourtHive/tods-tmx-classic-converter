export function courtData(tournament, luid, max_matches_per_court = 14) {
  let courts = [];
  safeArr(tournament.locations).forEach(l => {
    let identifiers = l.identifiers ? l.identifiers.split(',') : [];
    if (!luid || luid === l.luid) {
      range(1, +l.courts + 1).forEach(index => {
        let identifier = identifiers[index - 1] || index;
        let court = {
          luid: l.luid,
          name: `${l.abbreviation} ${identifier}`,
          availability: range(1, max_matches_per_court + 1),
          index,
        };
        courts.push(court);
      });
    }
  });
  return courts;
}

export function ctuuid(schedule) {
  return schedule ? `${schedule.luid}|${schedule.index}` : '';
}

function safeArr(x) {
  return (
    (Array.isArray(x) && x) ||
    (typeof x === 'object' && Object.keys(x).map(k => x[k])) ||
    []
  );
}
function range(start, end) {
  return Array.from({ length: end - start }, (v, k) => k + start);
}
