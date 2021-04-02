import { typeCheck as tc } from "./typeCheck";
import { courtData, ctuuid } from "./courtFx";
import { scoreFx } from "./scoreFx";
import { dateFx } from "./dateFx";
import { drawFx } from "./drawFx";
import { UUID } from "./UUID";

export const matchFx = (function () {
  let fx = {};
  let dfx = drawFx();

  // create an array of ids of all players who are selected for any event
  // used to prevent sign-out of approved players
  // if dual matches then get a list of all players who are part of any defined match
  fx.activeTeamPlayers = ({ tournament }) => {
    if (!tc.isTeam({ tournament }) || !tournament.events) return [];
    let {
      completed_matches,
      pending_matches,
      upcoming_matches,
    } = fx.tournamentEventMatches({ tournament });
    let all_matches = [].concat(
      ...pending_matches,
      ...upcoming_matches,
      completed_matches
    );
    return []
      .concat(...all_matches.map((m) => m.players))
      .map((p) => p && p.id)
      .filter((f) => f);
  };

  fx.matchPlayers = ({ match, potentials }) => {
    if (!match) return [];
    let pc = !potentials
      ? []
      : flatten(
          match.potentials || (match.match && match.match.potentials) || []
        ).filter((f) => f && f.id);

    let teams = flatten(
      match.teams || (match.match && match.match.teams) || []
    ).filter((f) => f.id);
    if (teams.length) {
      return flatten(teams.concat(...pc));
    }

    let players = flatten(
      match.players || (match.match && match.match.players) || []
    ).filter((f) => f && f.id);
    if (players.length) {
      return flatten(players.concat(...pc));
    }

    let winners = flatten(
      match.winner || (match.match && match.match.winner) || []
    ).filter((f) => f && f.id);
    let losers = flatten(
      match.loser || (match.match && match.match.loser) || []
    ).filter((f) => f && f.id);

    let match_players = pc.concat(...winners, ...losers);
    console.log({ match_players });
    return match_players;
  };

  fx.opponentsInclude = ({ match, potentials, ids }) => {
    let opponents = fx.matchPlayers({ match, potentials }).filter((f) => f);
    let include_ids = opponents.reduce(
      (p, c) => ids.indexOf(c.id) >= 0 || p,
      false
    );
    return include_ids;
  };

  fx.removeMatchSchedule = ({ e, tournament, opponent_ids, env }) => {
    if (!e || !tournament || !opponent_ids) return;
    let event_matches = eventMatches(e, tournament, false, env);
    let match = event_matches.reduce(
      (p, match) =>
        fx.opponentsInclude({ match, ids: opponent_ids }) ? match : p,
      undefined
    );
    if (match && match.schedule) match.schedule = {};
    if (match && match.match && match.match.schedule) match.match.schedule = {};
  };

  // Returns NEW objects; modifications don't change originals
  // if 'source' is true, then source object is included...
  fx.tournamentEventMatches = tournamentEventMatches;
  function tournamentEventMatches({ tournament, source, env }) {
    if (!tournament.events)
      return {
        completed_matches: [],
        pending_matches: [],
        upcoming_matches: [],
        total_matches: 0,
      };

    let total_matches = 0;
    var completed_matches = [];
    var pending_matches = [];
    var upcoming_matches = [];

    // don't sort tournament.events ... sort map of tournament draw types
    function drawTypeSort(draw_type) {
      return ["R", "Q"].indexOf(draw_type) >= 0 ? 0 : 1;
    }
    var ordered_events = tournament.events
      .map((e, index) => ({ draw_type: e.draw_type, index }))
      .sort((a, b) => drawTypeSort(a.draw_type) - drawTypeSort(b.draw_type));

    ordered_events.forEach((oe) => {
      let e = tournament.events[oe.index];
      if (tc.isRoundRobin({ e })) dfx.roundRobinRounds({ event: e });
      let { complete, incomplete, upcoming } = eventMatchStorageObjects({
        tournament,
        e,
        source,
        env,
      });

      if (tc.isRoundRobin({ e })) {
        complete.sort(
          (a, b) =>
            a.round_name &&
            b.round_name &&
            a.round_name.localeCompare(b.round_name)
        );
        incomplete.sort(
          (a, b) =>
            a.round_name &&
            b.round_name &&
            a.round_name.localeCompare(b.round_name)
        );
        upcoming.sort(
          (a, b) =>
            a.round_name &&
            b.round_name &&
            a.round_name.localeCompare(b.round_name)
        );
      }
      completed_matches = completed_matches.concat(...complete);
      pending_matches = pending_matches.concat(...incomplete);
      upcoming_matches = upcoming_matches.concat(...upcoming);
    });

    total_matches = completed_matches.length + pending_matches.length;

    return {
      completed_matches,
      pending_matches,
      upcoming_matches,
      total_matches,
    };
  }

  function eventMatchStorageObjects({ tournament, e, source, env }) {
    if (!e.draw) return { complete: [], incomplete: [], upcoming: [] };

    let event_matches = eventMatches(e, tournament, false, env);

    // for Round Robin Draw to be considered qualification it needs to be linked to an Elimination Draw
    let draw_format = e.draw.brackets ? "round_robin" : "tree";
    if (draw_format === "round_robin" && (!e.links || !e.links["E"])) {
      event_matches.forEach((match) => {
        if (match.round_name)
          match.round_name = match.round_name.replace("Q", "");
      });
    }

    let complete = event_matches
      .filter((f) => f.match && f.match.winner && f.match.loser)
      .map((m) => matchStorageObject({ tournament, e, match: m, source }))
      .filter((f) => f);

    let incomplete = event_matches
      .filter((f) => f.match && !f.match.winner && !f.match.loser)
      .map((m) => matchStorageObject({ tournament, e, match: m, source }))
      .filter(
        (m) =>
          (m.players && m.players.filter((f) => f).length) ||
          (m.potentials && m.potentials.length)
      );

    let upcoming =
      upcomingEventMatches({ e, tournament, env })
        .map((m) => matchStorageObject({ tournament, e, match: m, source }))
        .filter((f) => f) || [];

    return { complete, incomplete, upcoming };
  }

  function matchStorageObject({ tournament, e, match, source }) {
    if (!match.match) return;

    let players = [];
    let team_players;
    let match_teams = safeArr(match.teams);

    if (!match_teams.length) {
      players = [];
      team_players = [];
    } else if (match.match.winner && match.match.winner[0]) {
      let team0 = safeArr(match_teams[0]);
      let team1 = safeArr(match_teams[1]);
      players = [].concat(...team0, ...team1);
      team_players = [
        team0.map((p, i) => i),
        team1.map((p, i) => team0.length + i),
      ];
    } else {
      players = [].concat(...match_teams);
      team_players = match_teams.map((t, i) =>
        !t ? [null] : t.map((m, j) => i * t.length + j)
      );
    }

    let coords;
    let schedule = match.match.schedule;
    if (schedule && schedule.luid && tournament.locations) {
      let loc = tournament.locations.reduce(
        (p, c) => (c.luid === schedule.luid ? c : p),
        undefined
      );
      if (loc) coords = { latitude: loc.latitude, longitude: loc.longitude };
    }

    let matchFormat = match.match.matchFormat || e.matchFormat;

    let obj = {
      consolation: tc.isConsolation({ e }),
      draw_positions: e.draw_size,
      date: match.match.date,
      schedule,
      location: coords,
      format:
        tc.isDoubles({ match }) || tc.isDoubles({ e }) ? "doubles" : "singles",
      gender: e.gender,
      muid: match.match.muid,
      ids: players.filter((p) => p).map((p) => p.id),

      // TODO: These need object copy
      players,
      teams: match.teams,
      set_scores: match.match.set_scores,

      // TODO: should be => teams: team_players,
      team_players,

      dependent: match.dependent,
      dependencies: match.dependencies,

      // potential opponents for upcoming matches
      potentials: match.potentials,

      result_order: match.result_order,
      round: match.round || match.match.round,
      round_name: match.round_name || match.match.round_name,
      calculated_round_name: match.calculated_round_name,

      // all score related details should be stored in an object...
      score: match.match.score,

      matchFormat,
      delegated_score: match.match.delegated_score,

      status: match.match.status,
      tournament: {
        name: tournament.name,
        tuid: tournament.tuid,
        org: tournament.org,
        start: tournament.start,
        end: tournament.end,
        rank: tournament.rank,
      },
      event: {
        name: e.name,
        rank: e.rank,
        euid: e.euid,
        surface: e.surface,
        category: e.category,
        draw_type: e.draw_type,
        custom_category: e.custom_category,
      },
      dual_match: match.dual_match,
      sequence: match.sequence,
      umpire: match.match.umpire,

      // TODO: can this be removed?
      winner: match.match.winner_index,

      winner_index: match.match.winner_index,
    };

    if (source) obj.source = match.match;
    return obj;
  }

  fx.matchOutcome = matchOutcome;
  function matchOutcome(match, id) {
    let player_won = null;
    let winning_ids = [];
    let winning_team;
    let losing_team;
    let losing_ids = [];

    // TODO: this is a patch for matches from database
    // .teams needs to be updated to .team_players
    if (!match.team_players) match.team_players = match.teams;

    if (match.winner !== undefined) {
      winning_team = match.team_players[match.winner]
        .map((pindex) => {
          let player = match.players[pindex];
          winning_ids.push(player.id);
          if (player.id === id) player_won = true;
          return `${fullName(player)}${
            player.rank ? " [" + player.rank + "]" : ""
          }`;
        })
        .join("; ");

      losing_team = match.team_players[1 - match.winner]
        .map((pindex) => {
          let player = match.players[pindex];
          if (!player) return "Undefined";
          losing_ids.push(player.id);
          if (player.id === id) player_won = false;
          return `${fullName(player)}${
            player.rank ? " [" + player.rank + "]" : ""
          }`;
        })
        .join("; ");
    }

    return { player_won, winning_team, losing_team, winning_ids, losing_ids };
  }

  function fullName(p) {
    return `${p.last_name.toUpperCase()}, ${p.first_name}`;
  }

  fx.scheduledMatches = scheduledMatches;
  function scheduledMatches({ tournament, env }) {
    let {
      completed_matches,
      pending_matches,
      upcoming_matches,
    } = tournamentEventMatches({ tournament, source: true, env });
    let all_matches = completed_matches.concat(
      ...pending_matches,
      ...upcoming_matches
    );
    let scheduled = all_matches.filter((m) => m.schedule && m.schedule.day);
    let days = unique(scheduled.map((m) => m.schedule.day));
    return { scheduled, days };
  }

  function upcomingEventMatches({ e, tournament, env }) {
    if (!e.draw) return [];
    if (tc.isTeam({ tournament, e })) return [];
    let round_names = roundNames(tournament, e);
    let matches = dfx.upcomingMatches(
      e.draw,
      round_names.names,
      round_names.calculated_names
    );
    return checkScheduledMatches({ e, tournament, matches, env });
  }

  fx.dualMatchMatches = (e, muid) => {
    if (!e.draw) return [];
    if (!e.draw.dual_matches) return [];
    if (muid && e.draw.dual_matches[muid]) {
      return e.draw.dual_matches[muid].matches || [];
    } else {
      let matches = [];
      Object.keys(e.draw.dual_matches || {}).forEach((key) => {
        let dual_matches = e.draw.dual_matches[key].matches || [];
        dual_matches.forEach((dm) => (dm.dual_match = key));
        matches = matches.concat(...dual_matches);
      });
      return matches;
    }
  };

  fx.eventMatches = eventMatches;
  function eventMatches(e, tournament, all, env) {
    let matches = [];
    if (!e || !e.draw) {
      return matches;
    }
    if (tc.isAdHoc({ e })) {
      matches = safeArr(e.draw && e.draw.matches);
    } else if (tc.isTeam({ tournament, e })) {
      Object.keys(e.draw.dual_matches || {}).forEach((key) => {
        let dual_matches = e.draw.dual_matches[key].matches || [];
        dual_matches.forEach((dm) => (dm.dual_match = key));
        matches = matches.concat(...dual_matches);
      });
    } else {
      let round_names = roundNames(tournament, e);
      matches = dfx.matches(
        e.draw,
        round_names.names,
        round_names.calculated_names,
        all
      );
    }
    checkScheduledMatches({ e, tournament, matches, env });
    return matches;
  }

  fx.containsGUIDplayer = (match) => {
    let players =
      match &&
      ((match.match && match.match.players) ||
        (match.teams && [].concat(...match.teams)));
    let GUIDplayers =
      players &&
      players.reduce(
        (p, c) =>
          c && c.id && c.id.length >= 36 && c.id.split("-").length === 5
            ? true
            : p,
        false
      );
    return GUIDplayers;
  };

  function findEventByID(tournament, id) {
    if (!tournament || !tournament.events || tournament.events.length < 1)
      return;
    return tournament.events.reduce(
      (p, c) => (c.euid === id ? c : p),
      undefined
    );
  }

  fx.roundNames = roundNames;
  function roundNames(tournament, e) {
    var names = [];
    var calculated_names = [];
    if (tc.hasRoundNames({ e })) {
      if (tc.isFeedIn({ e })) {
        names = ["F", "SF", "QF"];
        let depth = dfx.drawInfo(e.draw).depth;
        if (depth > 3) {
          let rounds = numArr(depth - 3)
            .map((d) => `R${d + 1}`)
            .reverse();
          names = names.concat(...rounds);
        }
      } else {
        names = ["F", "SF", "QF", "R16", "R32", "R64", "R128", "R256", "R512"];
      }
    }
    if (tc.isQualifying({ e })) {
      names = ["Q", "Q1", "Q2", "Q3", "Q4", "Q5"];
      let qlink = e.links && findEventByID(tournament, e.links["E"]);
      if (qlink && qlink.draw) {
        let info = dfx.drawInfo(qlink.draw);
        if (info)
          calculated_names = [
            "F",
            "SF",
            "QF",
            "R16",
            "R32",
            "R64",
            "R128",
            "R256",
            "R512",
            "R1024",
          ].slice(info.depth);
      }
    }
    if (tc.isPlayoff({ e })) {
      names = ["PO3"];
    }
    return { names, calculated_names };
  }

  fx.checkScheduledMatches = checkScheduledMatches;
  function checkScheduledMatches({ e, tournament, matches, env }) {
    addMUIDs(e);

    let court_names = {};
    let max_matches_per_court =
      (env && env.schedule.max_matches_per_court) || 14;
    safeArr(tournament.locations)
      .map((l) => l.luid)
      .forEach((luid) =>
        courtData(tournament, luid, max_matches_per_court).forEach(
          (ct) => (court_names[ctuuid(ct)] = ct.name)
        )
      );
    let check_names = Object.keys(court_names).length;

    matches.forEach((match) => {
      let schedule = match.match && match.match.schedule;
      if (schedule) {
        if (check_names) schedule.court = court_names[ctuuid(schedule)];
        if (schedule && schedule.oop_round && schedule.luid) {
          let court_matches = matches
            .filter(
              (m) =>
                m.match &&
                m.match.schedule &&
                ctuuid(m.match.schedule) === ctuuid(schedule)
            )
            .filter(
              (m) =>
                m.match.schedule.oop_round < schedule.oop_round &&
                m.match.winner === undefined
            );
          schedule.after = court_matches.length;
        }
        if (schedule.time) {
          schedule.time = dateFx.convertTime(schedule.time, env);
        }
      }
    });

    return matches || [];
  }

  fx.eventRoundConsolationReady = ({ draw, round }) => {
    let info = draw && dfx.drawInfo(draw);
    if (!info || !round || isNaN(round)) return;
    let round_matches = safeArr(info.all_matches).filter(
      (f) => +f.height === +round
    );
    let with_team = round_matches.filter((m) => m && m.data && m.data.team);

    return round_matches.length === with_team.length;
  };

  fx.getLuckyLosers = ({ tournament, evnt, env }) => {
    let all_rounds = env.drawFx.ll_all_rounds;
    let completed_matches =
      (tournament &&
        fx
          .eventMatches(evnt, tournament, false, env)
          .filter((m) => m.match.winner)) ||
      [];
    if (!all_rounds && tc.isQualifying({ e: evnt }))
      completed_matches = completed_matches.filter(
        (m) => m.match.round_name === "Q"
      );
    let losing_ids = [].concat(
      ...completed_matches.map((match) =>
        match.match.loser.map((team) => team.id)
      )
    );
    let qualifying_ids =
      (evnt &&
        evnt.qualified &&
        evnt.qualified.length &&
        evnt.qualified.map((q) => q[0].id)) ||
      [];
    let losing_players =
      (tournament &&
        tournament.players.filter(
          (p) =>
            losing_ids.indexOf(p.id) >= 0 && qualifying_ids.indexOf(p.id) < 0
        )) ||
      [];
    console.log({ qualifying_ids, losing_ids, losing_players });
    return { losing_ids, losing_players };
  };

  fx.addMUIDs = addMUIDs;
  function addMUIDs(e) {
    if (!e.draw) return;
    let current_draw = e.draw.compass ? e.draw[e.draw.compass] : e.draw;
    if (!current_draw) return;

    if (e.draw.compass) {
      dfx.compassInfo(e.draw).all_matches.forEach(addMUID);
    } else if (e.draw.brackets) {
      e.draw.brackets.forEach((bracket) =>
        bracket.matches.forEach((match) => {
          if (!match.muid) match.muid = UUID.new();
          match.euid = e.euid;
        })
      );
    } else {
      let info = dfx.drawInfo(current_draw);
      if (info && info.nodes) info.nodes.forEach(addMUID);
    }

    function addMUID(node) {
      let muid = (node.data && node.data.nuid) || UUID.new();
      if (node.children) {
        if (!node.data.match) node.data.match = {};
        if (!node.data.match.muid) node.data.match.muid = muid;
        if (!node.data.match.euid) node.data.match.euid = e.euid;
      }
    }
  }

  fx.determineGender = (match) => {
    let genders = match.players
      ? match.players
          .filter((f) => f)
          .map((p) => p.sex)
          .filter((f) => f)
          .filter((item, i, s) => s.lastIndexOf(item) === i)
      : [];
    return !genders.length ? "" : genders.length > 1 ? "X" : genders[0];
  };

  fx.matchTime = (match, env) =>
    (match.schedule &&
      match.schedule.time &&
      dateFx.convertTime(match.schedule.time, env)) ||
    "";
  fx.matchRound = (match) => match.round_name || match.round;
  fx.matchDate = (match) => {
    if (match.schedule && match.schedule.day)
      return datePDF(new Date(match.schedule.day));
    if (match.date) return datePDF(match.date);
    return "";
  };

  fx.matchDesignator = ({ tournament, match }) => {
    let evt =
      match && match.event && findEventByID(tournament, match.event.euid);
    let category = (evt && evt.category && evt.category.slice(0, 4)) || "";
    return `${evt.gender}${evt.format}${category}`;
  };

  fx.matchDateDisplay = (match) => {
    if (match.schedule && match.schedule.day)
      return displayDate(new Date(match.schedule.day));
    if (match.date) return displayDate(match.date);
    return "";
  };

  fx.matchDuration = (match) => {
    if (match.schedule && match.schedule.start && match.schedule.end) {
      let d = duration(match.schedule.start, match.schedule.end);
      return `<b>${d}</b>`;
    }
    return "";

    function duration(start, end) {
      var seconds = getSeconds(end) - getSeconds(start);
      if (seconds <= 0) seconds = getSeconds(end, 12) - getSeconds(start);
      if (seconds <= 0) seconds = getSeconds(end, 12) - getSeconds(start, -12);
      var hours = Math.floor(seconds / (60 * 60));
      var minutes = Math.floor(seconds - hours * 60 * 60) / 60;
      return `${zeroPad(hours)}:${zeroPad(minutes)}`;
    }
    function getSeconds(hm, mod = 0) {
      var a = hm.split(":");
      var getNum = (x) => (x && !isNaN(x) ? +x : 0);
      var hours = getNum(a[0]) + mod;
      var minutes = getNum(a[1]);
      return hours * 60 * 60 + minutes * 60;
    }
  };

  fx.roundPosition = ({ match, info, backdrawTarget }) => {
    let all_matches = info && info.all_matches;
    let match_node =
      all_matches &&
      all_matches.reduce(
        (p, n) => (n.data?.match?.muid === match?.muid ? n : p),
        undefined
      );
    let match_round =
      all_matches &&
      all_matches.filter((n) => match_node && match_node.depth === n.depth);
    let backdraw_target =
      all_matches &&
      all_matches.filter(
        (n) => match_node && !dfx.byeNode(n) && match_node.depth === n.depth
      );

    let round = backdrawTarget ? backdraw_target : match_round;

    let muids =
      round &&
      round
        .map((n) => n && n.data && n.data.match && n.data.match.muid)
        .filter((f) => f);
    let index = muids && muids.indexOf(match?.muid);
    return index >= 0 ? (index + 1).toString() : "";
  };

  fx.roundNumber = ({ match, info, DrawStructure }) => {
    let all_matches = info && info.all_matches;
    let match_node =
      all_matches &&
      all_matches.reduce(
        (p, n) => (n.data?.match?.muid === match?.muid ? n : p),
        undefined
      );
    let match_node_depth = (match_node && match_node.depth) || 0;
    let round = info && info.depth ? info.depth - match_node_depth : "";
    let rr_round = DrawStructure === "ROUND-ROBIN" ? match.round : "";
    return (round || rr_round || "").toString();
  };

  fx.matchFinish = (match) => {
    return match.schedule && match.schedule.end ? match.schedule.end : "";
  };
  fx.matchCourt = (match) => {
    return (match.schedule && match.schedule.court) || "";
  };

  fx.matchScore = (match, non_breaking) => {
    let scr = match.score || match.delegated_score || "";
    if (match.winner_index === 1) scr = scoreFx.reverseScore(scr);
    // eslint-disable-next-line no-useless-escape
    return scr && non_breaking ? scr.replace(/\-/g, "&#8209;") : scr;
  };

  fx.isByeMatch = (match) =>
    match &&
    match.players &&
    match.players
      .filter((f) => f)
      .reduce((p, c) => (c.bye ? true : p), undefined);
  fx.idInMatch = ({ match, id }) =>
    match &&
    match.players &&
    match.players.reduce((p, c) => (c.id === id ? true : p), undefined);

  function datePDF(timestamp) {
    console.log({ timestamp });
    let date = dateFx.offsetDate(timestamp);
    return [zeroPad(date.getMonth() + 1), zeroPad(date.getDate())].join("-");
  }

  function displayDate(timestamp) {
    let date = dateFx.offsetDate(timestamp);
    return [zeroPad(date.getMonth() + 1), zeroPad(date.getDate())].join(
      "&#8209;"
    );
  }

  return fx;
})();

function numArr(count) {
  return [...Array(count)].map((_, i) => i);
}
function zeroPad(number) {
  return number.toString()[1] ? number : "0" + number;
}
function unique(arr) {
  return arr.filter((item, i, s) => s.lastIndexOf(item) === i);
}
function safeArr(x) {
  return (
    (Array.isArray(x) && x) ||
    (typeof x === "object" && Object.keys(x).map((k) => x[k])) ||
    []
  );
}
function flatten(arr) {
  return arr.reduce(
    (flat, toFlatten) =>
      flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten),
    []
  );
}
