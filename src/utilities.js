import {
  eventConstants,
  genderConstants,
  drawDefinitionConstants,
} from 'tods-competition-factory';

const surfaceCategoryMap = {
  C: 'CLAY',
  H: 'HARD',
  G: 'GRASS',
  R: 'CARPET',
};

export function getSurface(element) {
  return surfaceCategoryMap[element?.surface];
}

export function getIndoorOutdoor(element) {
  return (
    (element?.inout === 'o' && 'OUTDOOR') ||
    (element?.inout === 'i' && 'INDOOR')
  );
}

export function intersection(a, b) {
  return a
    .filter(n => b.indexOf(n) !== -1)
    .filter((e, i, c) => c.indexOf(e) === i);
}

export function getAgeCategoryCode(category) {
  const categoryCodeMap = {
    U10: '10U',
    U12: '12U',
    U14: '14U',
    U16: '16U',
    U18: '18U',
    10: '10U',
    12: '12U',
    14: '14U',
    16: '16U',
    18: '18U',
    Senior: 'O18',
  };

  return categoryCodeMap[category];
}

export function getMatchUpType(format) {
  return (
    (['S', 'SINGLES'].includes(format.toUpperCase()) &&
      eventConstants.SINGLES) ||
    (['D', 'DOUBLES'].includes(format.toUpperCase()) && eventConstants.DOUBLES)
  );
}

export function getGender(value) {
  if (!value) return genderConstants.MIXED;
  if (['F', 'FEMALE', 'W', 'WOMAN'].includes(value.toUpperCase()))
    return genderConstants.FEMALE;
  if (['M', 'MALE', 'MAN'].includes(value.toUpperCase()))
    return genderConstants.MALE;
  return genderConstants.MIXED;
}

export function getStage({ legacyEvent }) {
  const stageMap = {
    E: drawDefinitionConstants.MAIN,
    Q: drawDefinitionConstants.QUALIFYING,
    S: drawDefinitionConstants.MAIN,
    C: drawDefinitionConstants.CONSOLATION,
    P: drawDefinitionConstants.PLAY_OFF,
    A: drawDefinitionConstants.MAIN,
  };

  if (legacyEvent.draw_type === 'R') {
    if (Object.keys(legacyEvent.links || {}).includes('E')) {
      return drawDefinitionConstants.QUALIFYING;
    } else {
      return drawDefinitionConstants.MAIN;
    }
  }

  return stageMap[legacyEvent.draw_type];
}
