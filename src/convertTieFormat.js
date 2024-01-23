import { tools } from 'tods-competition-factory';

export function convertTieFormat(matchorder, matchUpFormats) {
  const matchUpTypes = tools.unique(
    matchorder.map(({ format }) => format.toUpperCase())
  );
  const collectionDefinitions = matchUpTypes.map(matchUpType => {
    const collectionMatchUps = matchorder.filter(
      order => order.format.toUpperCase() === matchUpType
    );
    const collectionValue =
      collectionMatchUps
        ?.map(({ value }) => parseFloat(value))
        .filter(value => !isNaN(value))
        .reduce((a, b) => a + b, 0) || 0;

    const collectionValueProfile = (collectionMatchUps || []).map(
      (matchUp, index) => ({
        collectionPosition: index + 1,
        matchUpValue: parseFloat(matchUp.value),
      })
    );
    const collectionDefinition = {
      matchUpsCount: collectionMatchUps.length,
      collectionName: matchUpType,
      collectionId: tools.UUID(),
      matchUpFormat:
        matchUpFormats && matchUpFormats[matchUpType?.toLowerCase()],
      collectionValue,
      matchUpType,
    };

    const valuesDiffer =
      tools.unique(
        collectionValueProfile.map(({ matchUpValue }) => matchUpValue)
      ).length > 1;

    if (valuesDiffer) {
      // if not all collection matchUpValues are equal, add collectionValueProfile...
      collectionDefinition.collectionValueProfile = collectionValueProfile;
    } else {
      // ...otherwise just add matchUpValue
      collectionDefinition.matchUpValue =
        collectionValueProfile[0].matchUpValue;
    }

    return collectionDefinition;
  });

  const totalTieValue = collectionDefinitions
    .map(({ collectionValue }) => collectionValue)
    .reduce((a, b) => a + b);

  // TMX 1.9 valueGoals were always 1 more than half
  const valueGoal = Math.floor(totalTieValue / 2) + 1;
  const winCriteria = { valueGoal };

  return { collectionDefinitions, winCriteria };
}
