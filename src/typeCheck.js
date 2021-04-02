export const typeCheck = (function () {
  let tc = {};

  const FEED = "feed";
  const SINGLES = "singles";
  const DOUBLES = "doubles";
  const BACKDRAW = "backdraw";

  tc.isActiveEvent = ({ e }) => e && e.active;
  tc.isAdHoc = ({ e }) => e && e.draw_type && e.draw_type === "A";
  tc.isPlayoff = ({ e }) => e && e.draw_type && e.draw_type === "P";
  tc.isQualifying = ({ e }) => e && e.draw_type && e.draw_type === "Q";
  tc.isRoundRobin = ({ e }) => e && e.draw_type && e.draw_type === "R";
  tc.isConsolation = ({ e }) => e && e.draw_type && e.draw_type === "C";
  tc.isElimination = ({ e }) => e && e.draw_type && e.draw_type === "E";
  tc.hasEliminationStructure = ({ e }) =>
    e && e.draw_type && ["E", "Q", "C", "P", "S"].indexOf(e.draw_type) >= 0;
  tc.isCompass = ({ e }) =>
    e &&
    ((e.draw_type && ["S", "O"].indexOf(e.draw_type) >= 0) ||
      e.direction ||
      (e.draw && e.draw.compass));

  tc.isFeedIn = ({ e, value }) =>
    (value && value === FEED) || (e && e.structure && e.structure === FEED);
  tc.isBackdraw = ({ e, value }) =>
    (value && value === BACKDRAW) ||
    (e && e.structure && e.structure === BACKDRAW);

  tc.hasRoundNames = ({ e }) =>
    e && e.draw_type && ["E", "S", "C", "O"].indexOf(e.draw_type) >= 0;

  tc.isConsolationFeedIn = ({ e }) =>
    tc.isConsolation({ e }) && tc.isFeedIn({ e });
  tc.isConsolationBackdraw = ({ e }) =>
    tc.isConsolation({ e }) && tc.isBackdraw({ e });
  tc.isConsolationFixed = ({ e }) =>
    tc.isConsolation({ e }) && (tc.isFeedIn({ e }) || tc.isBackdraw({ e }));

  tc.isSingles = ({ e, match }) => {
    if (e)
      return (
        e.format && (e.format === "S" || e.format.toLowerCase() === SINGLES)
      );
    if (match)
      return (
        match.format &&
        (match.format === "S" || match.format.toLowerCase() === SINGLES)
      );
  };
  tc.isDoubles = ({ e, match }) => {
    if (e)
      return (
        e.format && (e.format === "D" || e.format.toLowerCase() === DOUBLES)
      );
    if (match)
      return (
        match.format &&
        (match.format === "D" || match.format.toLowerCase() === DOUBLES)
      );
  };

  tc.isTeam = ({ tournament, e }) => {
    if (tournament && tournament.type)
      return ["team", "dual"].indexOf(tournament.type) >= 0;
    let dual_draw = e && e.draw && e.draw.dual_matches;
    return e && (dual_draw || e.event_type === "dual");
  };

  tc.isPreRound = ({ env, e }) => {
    let qualifying_bracket_seeding =
      env && env.drawFx && env.drawFx.qualifying_bracket_seeding;
    return (
      tc.isQualifying({ e }) &&
      e.approved &&
      e.approved.length &&
      +e.qualifiers === e.draw_size / 2 &&
      qualifying_bracket_seeding
    );
  };

  return tc;
})();
