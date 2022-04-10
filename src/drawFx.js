import * as d3 from 'd3';

// CourtHive-common-core
import { UUID } from './UUID';
import { scoreFx } from './scoreFx';
import { matchFormatCode } from './matchFormatCode';

/* To convert tmx 1.0 draw into tmx 2.0 draw nuids need to be added to all
 * nodes and array of opponent ids needs to be added to deepest nodes.
 */

function playersHash(players) {
  return players
    .map(p => p && p.id)
    .filter(f => f)
    .sort()
    .join('-');
}

export function drawFx(opts) {
  var fx = {};

  let numArr = count => [...Array(count)].map((_, i) => i);
  let unique = arr => arr.filter((item, i, s) => s.lastIndexOf(item) === +i);
  let range = (start, end) =>
    Array.from({ length: end - start }, (v, k) => k + start);
  let indices = (val, arr) =>
    arr.reduce((a, e, i) => {
      if (e === val) a.push(i);
      return a;
    }, []);
  let occurrences = (val, arr) =>
    arr.reduce((r, val) => {
      r[val] = 1 + r[val] || 1;
      return r;
    }, {})[val] || 0;
  let intersection = (a, b) =>
    a.filter(n => b.indexOf(n) !== -1).filter((e, i, c) => c.indexOf(e) === i);
  let randomPop = array =>
    array.length
      ? array.splice(Math.floor(Math.random() * array.length), 1)[0]
      : undefined;
  let subSort = (arr, i, n, sortFx) =>
    [].concat(
      ...arr.slice(0, i),
      ...arr.slice(i, i + n).sort(sortFx),
      ...arr.slice(i + n, arr.length)
    );

  var standard_draws = [2, 4, 8, 16, 32, 64, 128, 256, 512];
  // removed 224 because compressed draws blowing up beyond 128
  var draw_sizes = [2, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 256, 512];
  var validDrawSize = players => draw_sizes.indexOf(players) >= 0;

  var o = {
    rr_h2h_priority: false,
    compressed_draw_formats: true,
    compressed: { byes_adjacent_to_seeds: false },
    seedBlocks: [[1], [2], [3, 4], [5, 8], [9, 16], [17, 32], [33, 64]],
    seed_limits: [
      [0, 0],
      [4, 2],
      [11, 4],
      [21, 8],
      [41, 16],
      [97, 32],
      [193, 64],
    ],
    bye_placement: {
      8: [2, 7, 5],
      16: [2, 15, 11, 6, 7, 10, 14],
      32: [2, 31, 23, 10, 15, 18, 26, 7, 6, 27, 19, 14, 11, 22, 30],
      64: [
        2,
        63,
        47,
        18,
        31,
        34,
        50,
        15,
        10,
        55,
        39,
        26,
        23,
        42,
        58,
        7,
        5,
        60,
        44,
        21,
        28,
        37,
        53,
        12,
        13,
        52,
        36,
        29,
        20,
        45,
        61,
      ],
      128: [
        2,
        127,
        31,
        34,
        63,
        66,
        95,
        98,
        15,
        18,
        47,
        50,
        79,
        82,
        111,
        114,
        7,
        10,
        23,
        26,
        39,
        42,
        55,
        58,
        71,
        74,
        87,
        90,
        103,
        106,
        119,
        122,
      ],
      256: [
        2,
        255,
        63,
        66,
        127,
        130,
        191,
        194,
        31,
        34,
        95,
        98,
        159,
        162,
        223,
        226,
        15,
        18,
        47,
        50,
        79,
        82,
        111,
        114,
        143,
        146,
        175,
        178,
        207,
        210,
        239,
        242,
        7,
        10,
        23,
        26,
        39,
        42,
        55,
        58,
        71,
        74,
        87,
        90,
        103,
        106,
        119,
        122,
        135,
        138,
        151,
        154,
        167,
        170,
        183,
        186,
        199,
        202,
        215,
        218,
        231,
        234,
        247,
        250,
      ],
    },
    seedPositions: {
      1: [['1', '0']],
      2: [['0', '1']],
      3: [
        ['1', '.250'],
        ['0', '.750'],
      ],
      5: [
        ['0', '.250'],
        ['0', '.500'],
        ['1', '.500'],
        ['1', '.750'],
      ],
      9: [
        ['1', '.125'],
        ['0', '.375'],
        ['1', '.625'],
        ['0', '.875'],
        ['0', '.125'],
        ['1', '.375'],
        ['0', '.625'],
        ['1', '.875'],
      ],
      13: [],
      17: [
        ['1', '.0625'],
        ['0', '.1875'],
        ['1', '.3125'],
        ['0', '.4375'],
        ['1', '.5625'],
        ['0', '.6875'],
        ['1', '.8125'],
        ['0', '.9375'],
        ['0', '.0625'],
        ['1', '.1875'],
        ['0', '.3125'],
        ['1', '.4375'],
        ['0', '.5625'],
        ['1', '.6875'],
        ['0', '.8125'],
        ['1', '.9375'],
      ],
      25: [],
      33: [
        ['1', '.03125'],
        ['0', '.09375'],
        ['1', '.15625'],
        ['0', '.21875'],
        ['1', '.28125'],
        ['0', '.34375'],
        ['1', '.40625'],
        ['0', '.46875'],
        ['1', '.53125'],
        ['0', '.59375'],
        ['1', '.65625'],
        ['0', '.71875'],
        ['1', '.78125'],
        ['0', '.84375'],
        ['1', '.90625'],
        ['0', '.96875'],
        ['0', '.03125'],
        ['1', '.09375'],
        ['0', '.15625'],
        ['1', '.21875'],
        ['0', '.28125'],
        ['1', '.34375'],
        ['0', '.40625'],
        ['1', '.46875'],
        ['0', '.53125'],
        ['1', '.59375'],
        ['0', '.65625'],
        ['1', '.71875'],
        ['0', '.78125'],
        ['1', '.84375'],
        ['0', '.90625'],
        ['1', '.96875'],
      ],
      49: [],
    },
    separation: { team: true },
  };

  if (opts) keyWalk(opts, o);

  fx.options = options => {
    if (!options) return o;
    keyWalk(options, o);
  };

  fx.acceptedDrawSizes = acceptedDrawSizes;
  function acceptedDrawSizes({ num_players, standardSizes, forceCompressed }) {
    if (!num_players || num_players < 2) return 0;

    let d = 0;
    while (draw_sizes[d] < num_players) d += 1;

    let s = 0;
    while (standard_draws[s] < num_players) s += 1;

    if (standardSizes) return standard_draws[s];

    // otherwise check the settings for desired draw structure
    // added 128 limit because compressed draws > 128 blowing up
    return (forceCompressed || o.compressed_draw_formats) && num_players <= 128
      ? draw_sizes[d]
      : standard_draws[s];
  }

  fx.standardDrawSize = standardDrawSize;
  function standardDrawSize(num_players) {
    let i = 0;
    while (standard_draws[i] < num_players) i += 1;
    return standard_draws[i];
  }

  fx.treeDrawMatchOrder = treeDrawMatchOrder;
  function treeDrawMatchOrder(draw) {
    let mtz = matches(draw);
    return mtz
      .filter(m => m.match)
      .sort((a, b) => drawPosition(a) - drawPosition(b))
      .map(m => m.match.muid);
    function drawPosition(match) {
      if (!match.teams || !Array.isArray(match.teams) || !match.teams.length)
        return 1000;
      let draw_position = match.teams.reduce(
        (p, c) => (c && c[0] && c[0].draw_position) || p,
        undefined
      );
      return draw_position || 1000;
    }
  }

  fx.bracketMatches = bracketMatches;
  function bracketMatches(draw, bracket_index) {
    if (!draw || !draw.brackets) return [];
    let bracket = draw.brackets[bracket_index];

    let teamsHash = teams => {
      return teams
        .map(team =>
          team
            .map(p => p.id)
            .sort()
            .join('-')
        )
        .sort()
        .join('-');
    };
    let uniqueTeam = (arr, m) => {
      if (arr.map(teamsHash).indexOf(teamsHash(m)) < 0) arr.push(m);
      return arr;
    };

    pruneDefunctMatches();
    findMissingMatches();

    return bracket.matches;

    function pruneDefunctMatches() {
      // to support legacy brackets
      if (!bracket.teams) {
        bracket.teams = bracket.players.map(p => [p]);
      }

      // get an array of all match_ups:
      let match_ups = [].concat(
        ...bracket.teams
          .map(team => teamMatchups(team))
          .map(matchup => matchup.map(teams => teams.map(playersHash)))
      );

      let existing_match_ups = bracket.matches.map(match =>
        match.teams ? match.teams.map(playersHash) : []
      );
      let defunct = existing_match_ups.filter(
        emu =>
          !match_ups.reduce(
            (p, c) => (emu && c && intersection(emu, c).length === 2) || p,
            false
          )
      );

      bracket.matches = bracket.matches.filter(match => {
        let pairing = match.teams ? match.teams.map(playersHash) : [];
        let obsolete = defunct.reduce(
          (p, c) => intersection(pairing, c).length === 2 || p,
          false
        );
        return !obsolete;
      });
    }

    function findMissingMatches() {
      []
        .concat(...bracket.teams.map(teamMissingMatches))
        .reduce(uniqueTeam, [])
        ?.forEach(addTeamMatch);
    }

    function addTeamMatch(teams) {
      let players = [].concat(...teams);
      let match = {
        teams,
        players,
        round_name: 'RR',
        bracket: bracket_index,
        ids: players.map(p => p.id || p.id),
      };
      bracket.matches.push(match);
    }

    function teamMissingMatches(team) {
      let team_matchups = teamMatchups(team);
      let matches_hash = bracket.matches
        .filter(m => m.teams)
        .map(m => teamsHash(m.teams));
      let missing = team_matchups.filter(tm => {
        let index = matches_hash.indexOf(teamsHash(tm));
        return index < 0;
      });
      return missing;
    }

    function teamMatchups(team) {
      let opponents = bracket.teams.filter(
        t => playersHash(t) !== playersHash(team)
      );
      let matchups = opponents.map(o => [team, o]);
      return matchups;
    }
  }

  fx.roundRobinRounds = roundRobinRounds;
  function roundRobinRounds({ event }) {
    let draw = event && event.draw;
    if (!draw || !draw.brackets || !draw.brackets.length) return;

    let rounds = [];
    let rrbr = draw.brackets.map(bracketRounds);
    let qualifying = event && event.links && event.links.E;

    let max_rounds = Math.max(...rrbr.map(r => r.length));
    for (let r = 0; r < max_rounds; r++) {
      rounds.push(
        rrbr
          .map((br, b) => ({
            bracket: b,
            matchups: bracketMatchups(b, br[r], r),
          }))
          .filter(f => f.matchups)
      );
    }
    rounds?.forEach((round, i) => {
      round?.forEach(bracket => {
        bracket.matchups?.forEach(matchup => {
          matchup.round = i + 1;
          matchup.round_name = `RR${qualifying ? 'Q' : ''}${i + 1}`;
        });
      });
    });

    return rounds;

    function bracketMatchups(bracket_index, matchups /*, round*/) {
      if (!matchups) return;
      let matches = draw.brackets[bracket_index].matches;
      let matchhashes = matchups.map(m => m.sort().join('|'));
      let result = matches.filter(
        m =>
          matchhashes.indexOf(
            m.players
              .map(p => p.draw_position)
              .sort()
              .join('|')
          ) >= 0
      );
      return result;
    }
  }

  fx.bracketRounds = bracketRounds;
  function bracketRounds(bracket) {
    if (!bracket || !bracket.matches || !bracket.matches.length) return [];
    return calcBracketRounds(bracket);
  }

  // calculate rounds for a given number of round robin opponents
  function calcBracketRounds(bracket) {
    let opponents = bracket.players.length;
    let numArr = count => [...Array(count)].map((_, i) => i);
    let positions = numArr(2 * Math.round(opponents / 2) + 1).slice(1);
    let rounds = numArr(positions.length - 1).map(() => []);
    let a_row = positions.slice(0, positions.length / 2);
    let b_row = positions.slice(positions.length / 2);
    positions.slice(1).forEach((p, i) => {
      a_row?.forEach((a, j) => {
        rounds[i].push([a_row[j], b_row[j]]);
      });
      let a_head = a_row.shift();
      let a_down = a_row.pop();
      let b_up = b_row.shift();
      a_row = [].concat(a_head, b_up, ...a_row);
      b_row = [].concat(...b_row, a_down);
    });
    return rounds.reverse();
  }

  function bracketDrawPositions(draw) {
    return [].concat(
      ...draw.brackets.map((b, i) =>
        d3
          .range(draw.bracket_size)
          .map((p, j) => ({ bracket: i, position: j + 1 }))
      )
    );
  }

  function rrInfo(draw) {
    if (!draw.brackets) draw.brackets = [];
    let draw_positions = bracketDrawPositions(draw);
    let byes = draw.brackets.length * draw.bracket_size - draw.opponents.length;
    let matches = [].concat(...draw.brackets.map(b => b.matches));

    let total = (a, b) => a + b;
    let total_matches = draw.brackets
      .map(b => range(0, b.players.length).reduce(total, 0))
      .reduce(total, 0);

    let seed_placements = []
      .concat(...draw.seed_placements.map(s => s.placements))
      .map(p => p.position);
    let unfinished_seed_placements = draw.seed_placements.filter(
      s => s.range.length !== s.placements.length
    );

    let unseeded_placements = draw.unseeded_placements
      ? draw.unseeded_placements.map(u => u.position)
      : [];
    let placements = [].concat(
      seed_placements,
      draw.bye_placements || [],
      unseeded_placements
    );
    let hashFx = h => [h.bracket, h.position].join('|');
    let p_hash = placements.map(hashFx);
    let unfilled_positions = draw_positions.filter(
      p => p_hash.indexOf(hashFx(p)) < 0
    );
    let completed_brackets = draw.brackets.map(bracketComplete);
    let complete =
      completed_brackets && completed_brackets.reduce((a, b) => a && b);
    let positions_filled =
      unseeded_placements &&
      unseeded_placements.length &&
      draw.unseeded_placements.length === draw.unseeded_teams.length;

    let unplaced_seeds = [];
    let open_seed_positions = [];
    if (unfinished_seed_placements.length) {
      let placed_seeds = unfinished_seed_placements[0].placements.map(
        p => p.seed
      );
      unplaced_seeds = unfinished_seed_placements[0].range
        .filter(s => placed_seeds.indexOf(s) < 0)
        .map(r => draw.seeded_teams[r]);
      let p_hash = unfinished_seed_placements[0].placements.map(p =>
        hashFx(p.position)
      );
      open_seed_positions = unfinished_seed_placements[0].positions.filter(
        p => p_hash.indexOf(hashFx(p)) < 0
      );
    }

    return {
      draw_type: 'roundrobin',
      draw_positions,
      matches,
      positions_filled,
      complete,
      byes,
      placements,
      unfilled_positions,
      total_matches,
      unfinished_seed_placements,
      unplaced_seeds,
      open_seed_positions,
    };
  }

  fx.compassInfo = compassInfo;
  function compassInfo(draw) {
    var complete,
      total_matches = 0,
      all_matches = [],
      match_nodes = [],
      upcoming_match_nodes = [],
      unassigned = [];
    let directions = [
      'east',
      'west',
      'north',
      'south',
      'northeast',
      'northwest',
      'southeast',
      'southwest',
    ];
    directions
      .filter(d => draw[d])
      ?.forEach(direction => {
        let info = treeInfo(draw[direction]);
        complete = complete || info.complete;
        total_matches += info.total_matches;
        all_matches = all_matches.concat(...info.all_matches);
        match_nodes = match_nodes.concat(...info.match_nodes);
        upcoming_match_nodes = upcoming_match_nodes.concat(
          ...info.upcoming_match_nodes
        );
        unassigned = unassigned.concat(...info.unassigned);
      });

    return {
      complete,
      total_matches,
      all_matches,
      match_nodes,
      upcoming_match_nodes,
      unassigned,
    };
  }

  fx.collapseHierarchy = collapseHierarchy;
  function collapseHierarchy(node, depth) {
    /*
      if (node.depth <= depth) {
         node._height = node.height;
         node.height = node.height = node.height + 1 - depth;
      }
      */
    if (node.depth >= depth) {
      node._height = node.height;
      node.height = node.height = 0;
    }
    if (node.depth === depth) {
      node._children = node.children || node._children;
      node.children = null;
      return;
    }
    if (node.depth < depth) node.children = node.children || node._children;
    if (!node.children) return;
    node.children?.forEach(c => collapseHierarchy(c, depth));
  }

  fx.expandHierarchy = expandHierarchy;
  function expandHierarchy(node) {
    node.children = node.children || node._children;
    node.height = node.height || node._height;
    node._children = null;
    node._height = null;
    if (!node.children) return;
    node.children?.forEach(c => expandHierarchy(c));
  }

  function treeInfo(draw, collapse) {
    if (!draw) return {};
    let calc_tree = d3.tree();
    let draw_hierarchy = d3.hierarchy(draw);
    let maxTreeDepth = draw.maxTreeDepth || collapse;
    if (maxTreeDepth) collapseHierarchy(draw_hierarchy, maxTreeDepth);
    let nodes = calc_tree(draw_hierarchy).descendants();

    let depth = Math.max(...nodes.map(n => n.depth));
    let byes = nodes.filter(n => !n.height && n.data.bye);
    let structural_byes = nodes.filter(
      f => +f.height === 0 && f.depth !== depth
    );

    let match_nodes = (nodes && nodes.filter(n => matchNode(n))) || [];

    let bye_nodes = match_nodes.filter(n => !teamMatch(n, false));
    let double_bye_nodes = match_nodes.filter(n => byeNode(n) > 1);

    let all_matches = nodes.filter(
      n =>
        n &&
        n.children &&
        n.children.length === 2 &&
        (!draw.max_round || n.height <= draw.max_round)
    );
    var upcoming_match_nodes = all_matches.filter(
      n => n && n.children && (qualifierChild(n) || !matchNode(n))
    );
    let doubles = nodes
      .map(n => (n.data.team ? n.data.team.length > 1 : false))
      .reduce((a, b) => a || b);
    let draw_positions = unique(nodes.map(n => n.data.dp)).filter(f => f);
    let qualifiers = nodes.filter(n => !n.height && n.data.qualifier);
    let seeds = nodes
      .filter(
        n => !n.height && n.data.team && n.data.team[0] && n.data.team[0].seed
      )
      .sort((a, b) => a.data.team[0].seed - b.data.team[0].seed);
    let final_round = draw.max_round
      ? nodes.filter(f => +f.height === +draw.max_round)
      : nodes.filter(f => +f.depth === 0);
    let final_round_players = match_nodes
      .filter(m => (draw.max_round ? +m.height === +draw.max_round : !m.depth))
      .map(m => m.data.team);
    let unassigned = nodes.filter(
      n =>
        !maxTreeDepth &&
        !n.height &&
        !n.data.team &&
        !n.data.bye &&
        !n.data.qualifier
    );

    let assignments = [].concat(
      ...nodes
        .filter(
          f => !f.height && f.data.team && !f.data.qualifier && !f.data.bye
        )
        .map(node => node.data.team.map(p => ({ [p.id]: node.data.dp })))
    );
    let assigned_positions = assignments.length
      ? Object.assign(...assignments)
      : {};

    let total_matches = all_matches.length - byes.length;
    let complete =
      match_nodes.length &&
      match_nodes
        .filter(validMatch)
        .map(n => byeChild(n) || (n.data.match && n.data.match.complete))
        .reduce((p, c) => c && p, true);

    function byeChild(n) {
      return (
        n &&
        n.children &&
        n.children.map(c => c.data.bye).reduce((p, c) => c || p, false)
      );
    }
    function qualifierChild(n) {
      return (
        n &&
        n.children &&
        !byeChild(n) &&
        n.children.map(c => c.data.qualifier).reduce((p, c) => c || p, false)
      );
    }
    function validMatch(n) {
      return !draw.max_round || n.height <= draw.max_round;
    }

    // function isStructuralBye(child) { return structural_byes.map(s=>s.data.dp).indexOf(child.data.dp) >= 0; }
    // function upcomingChild(n) { return n.children && n.children.map(c=>ucmatch(c)).filter(f=>f).length === 2; }
    // function ucmatch(c) { return matchNode(c) || ( isStructuralBye(c) && !c.data.children); }

    return {
      draw_type: 'tree',
      complete,
      draw_positions,
      assigned_positions,
      seeds,
      doubles,
      nodes,
      depth,
      total_matches,
      all_matches,
      match_nodes,
      upcoming_match_nodes,
      byes,
      bye_nodes,
      double_bye_nodes,
      structural_byes,
      qualifiers,
      final_round,
      final_round_players,
      unassigned,
    };
  }

  fx.replaceDrawPlayer = replaceDrawPlayer;
  function replaceDrawPlayer(draw, existing_player, new_player_data) {
    if (
      !draw ||
      !existing_player ||
      !new_player_data ||
      typeof new_player_data !== 'object'
    )
      return;
    // Replace attributes in event.draw.opponents
    if (draw.opponents)
      draw.opponents?.forEach(opponent_team => {
        opponent_team?.forEach(checkReplacePlayer);
      });
    // Replace attributes in event.draw.seeded_teams
    if (draw.seeded_teams)
      Object.keys(draw.seeded_teams).forEach(key =>
        draw.seeded_teams[key]?.forEach(checkReplacePlayer)
      );
    // Replace attributes in event.draw.unseeded_teams
    if (draw.unseeded_teams)
      draw.unseeded_teams?.forEach(opponent_team => {
        opponent_team?.forEach(checkReplacePlayer);
      });
    // Replace attributes in event.draw.unseeded_placements
    if (draw.unseeded_placements)
      draw.unseeded_placements?.forEach(placement => {
        if (placement.id === existing_player.id)
          placement.id = new_player_data.id;
      });
    // Replace players in all draw matches
    let matches = [];
    if (draw.dual_matches) {
      Object.keys(draw.dual_matches || {}).forEach(key => {
        let dual_matches = draw.dual_matches[key].matches || [];
        dual_matches?.forEach(dm => (dm.dual_match = key));
        matches = matches.concat(...dual_matches);
      });
    } else {
      matches = fx.matches(draw).filter(m => m.match && m.match.muid);
    }
    matches?.forEach(match => {
      if (match.teams)
        match.teams
          .filter(f => f)
          ?.forEach(team => team?.forEach(checkReplacePlayer));
      if (match.winner) match.winner?.forEach(checkReplacePlayer);
      if (match.loser) match.loser?.forEach(checkReplacePlayer);
      if (match.players) match.players?.forEach(checkReplacePlayer);
      if (match.ids) match.ids = match.players.map(p => p.id);
      if (match.match) {
        if (match.match.teams)
          match.match.teams?.forEach(team => team?.forEach(checkReplacePlayer));
        if (match.match.winner && Array.isArray(match.match.winner))
          match.match.winner?.forEach(checkReplacePlayer);
        if (match.match.loser && Array.isArray * match.match.loser)
          match.match.loser?.forEach(checkReplacePlayer);
        if (match.match.players)
          match.match.players?.forEach(checkReplacePlayer);
        if (match.match.ids)
          match.match.ids = match.match.players.map(p => p.id);
      }
    });
    if (draw.brackets) {
      draw.brackets?.forEach(bracket =>
        bracket.players?.forEach(checkReplacePlayer)
      );
    }

    function checkReplacePlayer(player) {
      if (
        player &&
        (player.id === existing_player.id || player.id === existing_player.id)
      ) {
        Object.keys(new_player_data).forEach(
          key => (player[key] = new_player_data[key])
        );
      }
    }
  }

  fx.bracketComplete = bracketComplete;
  function bracketComplete(bracket) {
    return (
      bracket.matches &&
      bracket.matches.length &&
      bracket.matches.filter(m => m.winner).length === bracket.matches.length
    );
  }

  fx.drawRounds = drawRounds;
  function drawRounds(num_players) {
    if (!num_players) return;
    // get the binary representation of the number of players
    let bin = d2b(num_players);
    // result is length of binary string - 1 + 1 if there are any 1s after first digit
    return bin.slice(1).length + (bin.slice(1).indexOf(1) >= 0 ? 1 : 0);
    function d2b(dec) {
      return (dec >>> 0).toString(2);
    }
  }

  fx.calcFeedBase = ({ draw_positions }) => {
    let positions = draw_positions && draw_positions.length;
    if (!p2(positions)) {
      positions += sByes(positions);
    }
    if (positions && p2(positions)) return positions / 2;
  };

  fx.feedDrawSize = feedDrawSize;
  function feedDrawSize({ num_players, skip_rounds, feed_rounds }) {
    let s = 0;
    let burn = 0;
    while (
      calcFeedSize({
        first_round_size: standard_draws[s],
        skip_rounds,
        feed_rounds,
      }) < num_players &&
      burn < 10
    ) {
      burn += 1;
      s += 1;
    }
    if (burn >= 10) {
      console.log('BOOM!', num_players, skip_rounds, feed_rounds);
      return standard_draws[1];
    }
    return standard_draws[s];
  }

  fx.calcFeedSize = calcFeedSize;
  function calcFeedSize({ first_round_size, skip_rounds, feed_rounds }) {
    if (!first_round_size) return 0;
    let feed_capacity = first_round_size * 2 - 1;
    let skip_reduce =
      skip_rounds && skip_rounds > 0 ? first_round_size / (skip_rounds * 2) : 0;
    let draw_rounds = drawRounds(first_round_size);
    let possible_feed_rounds = draw_rounds - (skip_rounds || 0);
    let feed_diff =
      feed_rounds !== undefined ? possible_feed_rounds - feed_rounds : 0;
    let feed_reduce =
      feed_rounds !== undefined && feed_diff > 0
        ? numArr(feed_diff)
            .map(d => Math.pow(2, d))
            .reduce((a, b) => (a || 0) + (b || 0))
        : 0;
    return feed_capacity - skip_reduce - feed_reduce;
  }

  fx.drawInfo = drawInfo;
  function drawInfo(draw, collapse) {
    if (!draw) return;
    if (draw.brackets) return rrInfo(draw);
    if (draw.compass) {
      let info = treeInfo(draw[draw.compass]);
      if (info) info.compass = true;
      return info;
    }
    if (draw.children) return treeInfo(draw, collapse);
  }

  fx.blankDraw = blankDraw;
  function blankDraw(players, offset = 0) {
    if (isNaN(players) || !validDrawSize(players)) return undefined;

    // function dp(x) { return { dp: offset + x }; }
    let dp = x => ({ dp: offset + x });
    let positions = Array.from(new Array(players), (val, index) => index + 1);

    return positions.map(dp);
  }

  fx.addByes = addByes;
  function addByes(draw) {
    let info = drawInfo(draw);
    let draw_positions = info.draw_positions;
    let max_draw_position = draw_positions.length
      ? Math.max(...draw_positions)
      : 0;
    // let missing_draw_positions = max_draw_position ? Array.from(new Array(max_draw_position),(val,index)=>index+1).filter(p=>draw_positions.indexOf(p) < 0) : [];
    /*
      let chooseDrawPosition = (dp) => {
         let np = missing_draw_positions.filter(p => Math.abs(dp - p) === 1)[0];
         return np || '';
      };
      */

    walkNode(draw);

    function walkNode(node, descent = 0) {
      if (descent < info.depth && !node.children) {
        let position =
          node.team && node.team[0].draw_position >= max_draw_position / 2
            ? 0
            : 1;
        addBye(node, position);
      }
      if (node.children)
        node.children?.forEach(child => walkNode(child, descent + 1));
    }

    function addBye(node, position = 1) {
      let team = node.team;
      let bye = { bye: true, team: [{ draw_position: '', bye: true }] };
      let player = { dp: node.dp, id: node.id, team };
      node.children = position ? [player, bye] : [bye, player];
      node.match = { score: '' };
    }
  }

  // return positions of structural byes
  fx.structuralByes = structuralByes;
  function structuralByes(players, bit_flip) {
    let s = sByes(players);
    let cluster_size = players / s;
    let clusters = players / cluster_size;
    let cluster = 1;
    let bye_positions = [];
    while (cluster <= clusters) {
      let odd = cluster % 2;
      if (bit_flip && cluster > 1 && cluster < clusters) odd = 1 - odd;
      if (odd) {
        bye_positions.push((cluster - 1) * cluster_size + 1);
      } else {
        bye_positions.push(cluster * cluster_size);
      }
      cluster += 1;
    }
    return bye_positions;
  }

  // number of structural byes
  fx.sByes = sByes;
  function sByes(players) {
    if (p2(players)) return 0;
    let b = 1;
    while (b < players && !p2(players - b)) {
      b += 1;
    }
    return b;
  }

  // check for power of 2
  function p2(n) {
    if (isNaN(n)) return false;
    return n && (n & (n - 1)) === 0;
  }

  // WHAT WAS THIS?
  fx.dispersion = dispersion;
  function dispersion(num_players, depth) {
    let values = [];
    let p = num_players;
    while (div2(p)) {
      values.push(p);
      p = p / 2;
    }

    let d = 0;
    let positions = [];
    values?.forEach(value => {
      if (+d === +depth) {
        positions.push(value);
        positions.push(num_players - value + 1);
      }
      d += 1;
    });
    positions.sort((a, b) => a - b);
    return positions;

    function div2(n) {
      if (isNaN(n)) return false;
      return n / 2 === Math.floor(n / 2);
    }
  }

  function buildRound({ e, tree, byes = [], fed, rounds }) {
    let round = [];
    let pos = 0;
    while (pos < tree.length) {
      if (byes.indexOf(pos + 1) >= 0) {
        let node = tree[pos];
        round.push(node);
        pos += 1;
      } else {
        let child1 = tree[pos];
        child1.fed = fed;
        child1.round = rounds;
        let child2 = tree[pos + 1];
        if (child2) {
          child2.fed = fed;
          child2.round = rounds;
        }

        let node = { children: [child1, child2], nuid: UUID.new() };
        round.push(node);
        pos += 2;
      }
    }
    return round;
  }

  fx.feedRound = feedRound;
  function feedRound(draw, remaining, fed, rounds) {
    let round = [];
    let pos = 0;
    while (pos < draw.length) {
      let feed_arm = remaining.pop();
      feed_arm.feed = true;
      feed_arm.fed = fed + 1;
      feed_arm.round = rounds;

      let position = draw[pos];
      position.round = rounds;
      position.fed = fed + 1;

      let match = { children: [position, feed_arm] };
      round.push(match);
      pos += 1;
    }
    return { round, remaining };
  }

  // TODO: Total Mess unless treeDraw() is configured properly
  // which means (for now) options({ draw: { feed_in: true }});
  /*
   fx.doubleElimination = doubleElimination;
   function doubleElimination(e, teams) {
      let total_positions = Array.isArray(teams) ? teams.length : teams;
      let main = buildDraw({ e, teams: total_positions });
      let feed = feedInDraw({ e, teams: acceptedDrawSizes({ num_players: total_positions / 2 }), offset: total_positions });
      let children = [main, feed];
      return { children };
   }
   */

  fx.feedInDraw = feedInDraw;
  function feedInDraw({
    e,
    teams,
    skip_rounds = 0,
    /*sequentials=0, */ feed_rounds = 0,
    offset,
  }) {
    let team_count = Array.isArray(teams) ? teams.length : teams;
    if (team_count < 2) return;
    let total_rounds = drawRounds(teams);
    if (skip_rounds >= total_rounds) feed_rounds = 0;

    let up2 = x => Math.pow(2, Math.ceil(Math.log(x) / Math.log(2)));
    let players = up2(team_count + 1);
    let positions = blankDraw(players, offset);

    let remaining = positions.slice(positions.length / 2).reverse();
    let round = buildRound({
      e,
      tree: positions.slice(0, positions.length / 2),
    });

    let rounds = 0;
    while (round.length > 1 && skip_rounds > 0) {
      round = buildRound({ e, tree: round });
      skip_rounds -= 1;
      rounds += 1;
    }

    // if (sequentials && sequentials > 1) feed_rounds = sequentials;

    let fed = 0;
    // let sequenced = 0;
    if (round.length > 1 && fed < feed_rounds) {
      ({ round, remaining } = feedRound(round, remaining, fed, rounds));
      fed += 1;
      // sequenced += 1;
    }

    /*
      while(round.length > 1 && sequentials < sequenced) {
         ({round, remaining} = feedRound(round, remaining, fed, rounds));
         fed += 1;
         sequenced += 1;
      }
      */

    while (round.length > 1) {
      round = buildRound({ e, tree: round, fed, rounds });
      rounds += 1;
      if (round.length > 1 && fed < feed_rounds) {
        if (fed >= skip_rounds)
          ({ round, remaining } = feedRound(round, remaining, fed, rounds));
        fed += 1;
      }
    }

    if (fed < feed_rounds) {
      ({ round, remaining } = feedRound(round, remaining, fed, rounds));
    }

    return round && round.length ? round[0] : round;
  }

  fx.buildDraw = buildDraw;
  function buildDraw({ e, teams, structural_byes, offset = 0, direction }) {
    let round;
    if (Array.isArray(teams)) {
      round = teams.map((t, i) => ({ dp: offset + i + 1, team: t }));
    } else {
      if (isNaN(teams) || !validDrawSize(teams)) return undefined;
      round = blankDraw(teams, offset);
    }

    structural_byes = structural_byes || structuralByes(round.length);

    round = buildRound({ e, tree: round, byes: structural_byes });
    while (round.length > 1) {
      round = buildRound({ e, tree: round });
    }
    if (direction) round[0].direction = direction;
    return round[0];
  }

  fx.buildQualDraw = buildQualDraw;
  function buildQualDraw({ e, num_players, num_qualifiers }) {
    let group_size = Math.ceil(num_players / num_qualifiers);
    let section_size = standardDrawSize(group_size);
    let sections = Array.from(new Array(num_qualifiers), (val, i) => i);
    let children = sections.map((u, i) =>
      buildDraw({ e, teams: section_size, offset: i * section_size })
    );
    let max_round = d3.hierarchy(children[0]).height;
    return { children, max_round };
  }

  fx.assignPosition = assignPosition;
  function assignPosition({
    node,
    position,
    team = [{}],
    bye,
    qualifier,
    propagate,
    assigned,
  }) {
    if (!node || !position) return assigned;
    if (+node.dp === +position) {
      node.team = team;
      node.team?.forEach(player => {
        player.draw_position = position;
        player.bye = bye;
        player.qualifier = qualifier;
        player.entry = player.entry ? player.entry : qualifier ? 'Q' : '';
      });
      node.bye = bye;
      node.qualifier = qualifier;
      assigned = true;

      if (!propagate) return assigned;
    }
    if (node.children) {
      let result = node.children.map(child =>
        assignPosition({
          node: child,
          position,
          team,
          bye,
          qualifier,
          propagate,
          assigned,
        })
      );
      return result.reduce((a, b) => a || b);
    }
    return assigned;
  }

  fx.findPositionNode = findPositionNode;
  function findPositionNode({ node, position }) {
    if (+node.dp === +position) return node;
    if (!node.children) return;

    // if position in node children, get index;
    let cdpi = node.children.map(c => c.dp).indexOf(position);

    if (cdpi >= 0) {
      return node;
    } else {
      return []
        .concat(
          ...node.children.map(child =>
            findPositionNode({ node: child, position })
          )
        )
        .filter(f => f)[0];
    }
  }

  fx.advancePosition = advancePosition;
  function advancePosition({
    draw,
    position,
    score,
    set_scores,
    matchFormat,
    bye,
    onlyIfBye,
    winner,
  }) {
    let position_node = findPositionNode({ node: draw, position });

    // don't advance if position_node already contains player
    if (!position_node || position_node.dp) return;

    return advanceToNode({
      draw,
      node: position_node,
      position,
      score,
      set_scores,
      matchFormat,
      bye,
      onlyIfBye,
      winner,
    });
  }

  fx.teamIsBye = team => team.map(p => p.bye).reduce((a, b) => a && b);

  function matchDrawPositions(match) {
    return (
      (match.players &&
        match.players.reduce(
          (p, c) =>
            c && p.indexOf(c.draw_position) < 0 ? p.concat(c.draw_position) : p,
          []
        )) ||
      []
    );
  }

  fx.advanceToNode = advanceToNode;
  function advanceToNode({
    draw,
    node,
    position,
    score,
    set_scores,
    complete,
    matchFormat,
    bye,
    onlyIfBye,
    winner,
  }) {
    // cannot advance if no position node
    if (!node) return { advanced: false };
    if (!node.match) node.match = {};

    let current_match = node.match;
    let round = current_match && current_match.round;
    if (node.dp && round) {
      let draw_matches = Array.isArray(draw.matches) && draw.matches;
      let matches = draw_matches || fx.matches(draw) || [];
      let match_draw_positions = matchDrawPositions(current_match);

      let next_round_match = matches
        .filter(
          m =>
            (m.round && m.round === round + 1) ||
            (m.match && m.match.round && m.match.round === round + 1)
        )
        .reduce(
          (p, m) =>
            m.match &&
            intersection(matchDrawPositions(m.match), match_draw_positions)
              .length
              ? m
              : p,
          undefined
        );

      let next_round_score =
        next_round_match &&
        next_round_match.match &&
        next_round_match.match.score;
      let next_round_draw_positions =
        next_round_match && matchDrawPositions(next_round_match.match);

      // if there is an existing position assigned to node AND if there is a subsequent match winner
      // THEN: if the attempted assignment is not the same, fail
      if (
        next_round_score &&
        next_round_draw_positions.indexOf(+position) < 0
      ) {
        return {
          advanced: false,
          error: 'Cannot change match outcome with subsequent match(es)',
        };
      }
      if (next_round_score && !complete) {
        return {
          advanced: false,
          error:
            'Cannot enter an incomplete match score with subsequent matche(es)',
        };
      }
    }

    // if position in node children, get index;
    let cdpi = node.children.map(c => c.dp).indexOf(position);
    let teams = node.children.map(c => c.team).filter(f => f);
    let containsByeTeam = teams.reduce((p, c) => fx.teamIsBye(c) || p, false);

    if (teams.length === 2 && cdpi >= 0) {
      if (onlyIfBye && !containsByeTeam) {
        // condition don't advance the position *unless* there is a ByeTeam
        return { advanced: false };
      } else if (!bye && fx.teamIsBye(teams[cdpi])) {
        return { advanced: false };
      } else {
        let opponent_is_bye = fx.teamIsBye(teams[1 - cdpi]);
        advance(opponent_is_bye, bye);
        return { advanced: true };
      }
    }

    return { advanced: false };

    function advance(opponent_is_bye, bye) {
      node.children?.forEach((child, i) => {
        if (+child.dp === +position) {
          node.bye = bye;
          node.dp = position;
          // draw position shouldn't really be assigned if not a winner
          // but this needs to be thoroughly tested before changed...
          // if (winner) node.dp = position;
          node.team = child.team;
          if (!opponent_is_bye) {
            node.match.score = score;
            node.match.winner_index = i;
            node.match.winner = child.team;
            node.match.set_scores = set_scores;
            node.match.matchFormat = matchFormat;
          }
        } else {
          if (!opponent_is_bye) node.match.loser = child.team;
        }
      });
    }
  }

  /*
   fx.findMatchNodeByPosition = findMatchNodeByPosition;
   function findMatchNodeByPosition({ node, position }) {
      let position_node = findPositionNode({ node, position });
      if (!position_node) return;

      let target_node;
      if (+position_node.dp === +position) {
         target_node = position_node;
      } else {
         // if position in node children, get index;
         let cdpi = position_node.children.map(c => c.dp).indexOf(position);
         target_node = position_node.children[cdpi];
      }
      if (!target_node.children) return;

      let teams = target_node.children.map(c => c.team).filter(f=>f);
      // let teamIsBye = (team) => team.map(p => p.bye).reduce((a, b) => a && b);
      let byeTeam = teams.map(t => fx.teamIsBye(t)).reduce((a, b) => a && b);

      if (teams.length === 2 && !byeTeam) return target_node;
   }
   */

  fx.modifyPositionScore = modifyPositionScore;
  function modifyPositionScore({
    node,
    positions,
    score,
    set_scores,
    complete,
    matchFormat,
  }) {
    let target_node = findMatchNodeByTeamPositions(node, positions);

    if (!target_node) return;
    if (!target_node.match) target_node.match = {};
    target_node.match.score = score;
    target_node.match.set_scores = set_scores;
    target_node.match.matchFormat = matchFormat;
    if (complete !== undefined) target_node.match.complete = complete;

    // if match is incomplete remove any outdated attributes
    if (!complete) {
      delete target_node.team;
      delete target_node.match.loser;
      delete target_node.match.winner;
      delete target_node.match.winner_index;
    }
  }

  fx.schedulePosition = schedulePosition;
  function schedulePosition({ node, position, schedule, venue }) {
    let target_node = findPositionNode({ node, position });
    if (!target_node.match) target_node.match = {};
    target_node.match.schedule = schedule;
    target_node.match.venue = venue;
  }

  fx.seedBlock = seed => {
    let seed_block = o.seedBlocks.reduce(inSeedBlock, undefined);
    return seed_block && seed_block.join('-');
    function inSeedBlock(p, c) {
      if (c) {
        let lower = c[0];
        let higher = c[1] || c[0];
        return seed >= lower && seed <= higher ? c : p;
      }
    }
  };

  fx.seedLimit = seedLimit;
  function seedLimit({ total_players, evt }) {
    let limit = 0;
    // let event_seed_limit = evt && evt.seed_limit && (evt.seed_limit < total_players) && evt.seed_limit;
    let event_seed_limit =
      evt && evt.seeds && evt.seeds < total_players && evt.seeds;
    if (event_seed_limit === 0) return 0;
    o.seed_limits?.forEach(threshold => {
      if (total_players >= threshold[0]) limit = threshold[1];
    });
    return event_seed_limit || limit;
  }

  fx.roundrobinSeedPlacements = roundrobinSeedPlacements;
  function roundrobinSeedPlacements({ draw, bracket_size }) {
    let placements = [];
    let bracket_count = draw.brackets.length;
    let seeded_team_keys = Object.keys(draw.seeded_teams);
    let auto_placed_seeds = seeded_team_keys.slice(0, bracket_count);
    let random_placed_seeds = seeded_team_keys.slice(bracket_count);

    // Minimum one seed in first position for each bracket
    d3.range(auto_placed_seeds.length).forEach(s => {
      // let bracket = draw.brackets[s % bracket_count];
      placements.push({
        range: [s + 1],
        positions: [{ bracket: s % bracket_count, position: 1 }],
        placements: [],
      });
    });

    // final position of each bracket is available for other seeds to be placed randomly
    let range = [];
    let positions = [];
    d3.range(bracket_count).forEach(s => {
      let seed_index = auto_placed_seeds.length + s;
      // let bracket = draw.brackets[seed_index % bracket_count];

      // the range is restricted by the number of remaining seeds
      if (s < random_placed_seeds.length) range.push(seed_index + 1);
      // but the positiosn are available in each bracket
      positions.push({
        bracket: seed_index % bracket_count,
        position: bracket_size,
      });
    });

    // randomize the order
    d3.shuffle(positions);
    placements.push({ range, positions, placements: [] });

    return placements;
  }

  fx.qualifyingBracketSeeding = qualifyingBracketSeeding;
  function qualifyingBracketSeeding({
    draw,
    num_players,
    qualifiers /*, seed_limit*/,
  }) {
    let group_size = Math.ceil(num_players / qualifiers);
    let section_size = standardDrawSize(group_size);
    // let sections = Array.from(new Array(qualifiers),(val,i)=>i);

    let placements = [];
    let seeded_team_keys = Object.keys(draw.seeded_teams);

    let auto_placed_seeds = seeded_team_keys.slice(0, qualifiers);
    let random_placed_seeds = seeded_team_keys.slice(qualifiers);

    // Minimum one seed in first position for each section
    d3.range(auto_placed_seeds.length).forEach(s => {
      let position = (s % qualifiers) * section_size + 1;
      placements.push({
        range: [s + 1],
        placements: [],
        positions: [position],
      });
    });

    let range = [];
    let positions = [];

    d3.range(random_placed_seeds.length).forEach(s => {
      let seed_index = auto_placed_seeds.length + s;
      range.push(seed_index + 1);
    });

    // with some qualification draws there are more placement options than seeds to be placed
    d3.range(auto_placed_seeds.length).forEach(s => {
      let position = (s % qualifiers) * section_size + section_size;
      positions.push(position);
    });

    d3.shuffle(positions);
    placements.push({ range, positions, placements: [] });

    return placements;
  }

  fx.validSeedPlacements = validSeedPlacements;
  function validSeedPlacements({
    num_players,
    random_sort = false,
    seed_limit,
    qualifying_draw,
  }) {
    let i = 1;
    let placements = [];
    let draw_size = acceptedDrawSizes({
      num_players,
      standardSizes: qualifying_draw,
    });
    seed_limit =
      seed_limit || seedLimit({ total_players: num_players || draw_size });

    while (i <= seed_limit) {
      // array of possible placement positions
      let p = seedPositions(o.seedPositions, i, draw_size);

      // if sort then sort seed groupings
      // if (random_sort) p = p.sort(() => 0.5 - Math.random());
      if (random_sort) d3.shuffle(p);

      placements.push({
        range: playerPositions(i, p.length),
        positions: p,
        placements: [],
      });
      i += p.length || draw_size;
    }
    return placements;
  }

  // range of player positions
  function playerPositions(s, n) {
    return Array.from(new Array(n), (val, i) => i + s);
  }
  function seedPositions(seed_positions, i, draw_size) {
    return seed_positions[i].map(d => +d[0] + draw_size * d[1]);
  }

  /*
      Byes drawn to the top half of the draw shall be positioned on even-numbered lines; byes drawn to the bottom half
      of the draw shall be positioned on odd-numbered lines.

      If group seeding is used and there are fewer byes available than there are players in the group, then a drawing
      is used to determine which seeds within the group get the available byes. 

      TODO: Byes should have a bye-order attribute for this...
      The Referee should note the order in which the remaining byes are placed in the draw in the event that this information is
      needed later for placing an omitted player in the draw

      • First, distribute byes to all the seeds.
      • Second, distribute byes so that the seeded players who receive byes will be playing other players who have
        also received byes. If there are not enough byes so that every seeded player is playing another player who has
        received a bye, then position these byes adjacent to the seeded players starting with the lowest seeded player.
      • Third, distribute a pair of byes in the fourth quarter of
        the draw starting from the bottom up; distribute a pair of byes in the first quarter of the draw starting from
        the top down; distribute a pair of byes in the third quarter of the draw starting from the bottom up; distribute
        a pair of byes in the second quarter of the draw starting from the top down; and repeat the cycle
        (fourth quarter, first quarter, third quarter, and second quarter) until all the byes have been distributed.A
   */

  // distributeByes must occur after seed_positions have been determined
  // EXCEPT for pre-rounds where all ranked players are seeded...
  // seed_positions is an array of positions which has been sorted by seed #'s
  // such that byes are handed out to seeds in order: 1, 2, 3...
  fx.distributeByes = distributeByes;
  function distributeByes({ draw, num_players, target_byes }) {
    let current_draw = draw.compass ? draw[draw.compass] : draw;

    let info = drawInfo(current_draw);
    let seed_positions = info.seeds.map(m => m.data.dp);
    let randomBinary = () => Math.floor(Math.random() * 2);

    num_players =
      num_players ||
      (current_draw.opponents ? current_draw.opponents.length : 0) +
        (current_draw.qualifiers || 0);

    // bye_positions is an array of UNDEFINED with length = # of byes
    // constructed by slicing from array number of actual teams/players
    let bye_positions = info.draw_positions
      .map(() => undefined)
      .slice(num_players);

    // all draw positions which have a first-round opponent (no structural bye);
    let paired_positions = info.nodes
      .filter(f => +f.height === 1 && f.children)
      .map(m => [].concat(...m.children.map(c => c.data.dp)));

    // first round matches with no seeded position
    let pairs_no_seed = paired_positions.filter(
      f => intersection(seed_positions, f).length < 1
    );

    // first round matches with seeded position
    let pairs_with_seed = paired_positions.filter(
      f => intersection(seed_positions, f).length > 0
    );

    let draw_size = info.draw_positions.length;
    let bp = (o.bye_placement && draw_size && o.bye_placement[draw_size]) || {};
    let prescribed = target_byes || bp;

    if (!info.structural_byes.length) {
      // if there are not emough prescribed bye_positions then skip priscribed (!!)
      if (prescribed && prescribed.length >= bye_positions.length) {
        bye_positions = bye_positions.map((p, i) => prescribed[i]);
      } else {
        let seed_placements = current_draw.seed_placements
          ? []
              .concat(...current_draw.seed_placements.map(m => m.placements))
              .map(m => m.position)
          : [];

        // if there are structural byes, then no seed should need bye
        // if there are not structural byes, distribute byes to seeds first, by seed order
        // First select pairs that match the seed_positions, which are already in order, with seed groups shuffled
        // if there are more bye_positions than seed_positions, bye_positions remain undefined
        let filtered_pairs = bye_positions.map(
          (b, i) =>
            pairs_with_seed.filter(p => p.indexOf(seed_positions[i]) >= 0)[0]
        );

        bye_positions = []
          .concat(...filtered_pairs)
          .filter(f => seed_placements.indexOf(f) < 0);
      }
    } else {
      // find pairs of positions which are adjacent to structural byes
      let adjacent_pairs = info.structural_byes
        .map(sb => sb.parent.children.filter(c => c.data.children))
        .map(m => m[0].data.children.map(c => c.dp));

      let structural_seed_order = info.structural_byes.map(s =>
        s.data && s.data.team ? s.data.team[0].seed : undefined
      );
      let adjacent_to_seeds = [];
      if (o.compressed.byes_adjacent_to_seeds) {
        // only used this feature if enabled in drawFx options
        structural_seed_order
          .filter(f => f)
          ?.forEach((o, i) => (adjacent_to_seeds[o - 1] = adjacent_pairs[i]));
      }
      adjacent_to_seeds.filter(f => f);

      let assignment = bye_positions.map((b, i) =>
        adjacent_to_seeds[i] ? adjacent_to_seeds[i][randomBinary()] : undefined
      );

      // keep track of pairs with no seed or bye
      let pairs_no_seed_or_bye = pairs_no_seed.filter(
        pair => !intersection(pair, assignment).length
      );
      let flat_pairs = [].concat(...pairs_no_seed_or_bye);

      if (target_byes) {
        // prescribed can't be fixed bye positions because these may create double-bye situations
        bye_positions = bye_positions.map((p, i) => target_byes[i]);
      } else {
        // redefined undefined bye_positions to either be those asigned to adjacent pairs or pairs_no_seed_or_bye
        bye_positions = assignment
          .map(b => {
            if (b) return b;
            // if (pairs_no_seed_or_bye.length) return randomPop(pairs_no_seed_or_bye)[Math.floor(Math.random() * 2)];
            if (pairs_no_seed_or_bye.length)
              return getBye(pairs_no_seed_or_bye);
            return false;
          })
          .filter(f => f);
      }

      // redefine pairs_no_seed to filter out pairs_no_seed_or_bye
      pairs_no_seed = pairs_no_seed.filter(
        pair => !intersection(pair, flat_pairs)
      );
    }

    // if any bye positions are still undefined, randomly distribute to unseeded players
    // TODO: randomPop need to be replaced with something that chooses quarters/eights
    // let bye_placements = bye_positions.map(b => b || randomPop(pairs_no_seed)[Math.floor(Math.random() * 2)]);
    let bye_placements = bye_positions.map(b => b || getBye(pairs_no_seed));

    bye_placements?.forEach((position, i) => {
      // bye is a boolean which also signifies bye order (order in which byes were assigned)
      assignPosition({ node: current_draw, position, bye: i + 1 });
    });

    current_draw.bye_placements = bye_placements;
    return bye_placements;

    function getBye(source) {
      let item = randomPop(source);
      let rand = Math.floor(Math.random() * 2);
      if (item) return item[rand];
      console.log({ error: 'unable to pop', source });
    }
  }

  fx.rrByeDistribution = rrByeDistribution;
  function rrByeDistribution({ draw }) {
    let byes = draw.brackets.length * draw.bracket_size - draw.opponents.length;

    if (byes > draw.brackets.length) {
      // console.log('ERROR: There should never be more byes than brackets');
      // Should only occur when too few players have been added to generate
      return false;
    }

    draw.bye_placements = d3.range(byes).map((b, i) => {
      draw.brackets[i].byes = [{ position: 2 }];
      return { bracket: i, position: 2 };
    });
  }

  function unplacedTeams(draw) {
    /*
      let seeds = (draw.seeded_teams && Object.keys(draw.seeded_teams)) || [];
      let placed_seeds = [].concat(...(draw.seed_placements && draw.seed_placements.map(s=>s.placements.map(p=>p.seed))) || []);
      let unplaced_seeds = seeds.map(s=>+s).filter(s => placed_seeds.indexOf(s) < 0);
      let unplaced_seed_teams = draw.seeded_teams && unplaced_seeds.map(s=>draw.seeded_teams[s]);
      */

    let unseeded_placements = draw.unseeded_placements
      ? [].concat(...draw.unseeded_placements.map(p => p.team.map(m => m.id)))
      : [];
    let unplaced_unseeded = draw.unseeded_teams.filter(
      team => unseeded_placements.indexOf(team[0].id) < 0
    );

    return unplaced_unseeded;
  }

  fx.rrUnseededPlacements = rrUnseededPlacements;
  function rrUnseededPlacements({ draw }) {
    if (o.separation.team) {
      randomRRunseededSeparation({ draw });
    } else {
      randomRRunseededDistribution({ draw });
    }
  }

  // Avoidance / Separation
  function randomRRunseededSeparation({ draw }) {
    let exit = false;
    let unfilled_positions = fx.drawInfo(draw).unfilled_positions;
    if (!draw.unseeded_placements) draw.unseeded_placements = [];

    /**
     * for each unfilled_position find the team of all other players in the
     * bracket, then get array of all unplaced players who don't share the same team,
     * then random pop from this group to make assignment...
     * if there are no unplaced players with different team, then random pop from all unplaced players
     */

    while (unfilled_positions.length && !exit) {
      let position = randomPop(unfilled_positions);

      let teams = bracketTeams(draw.brackets[position.bracket]);
      let unplaced_teams = unplacedTeams(draw);

      let team_diff = unplaced_teams.filter(
        team => teams.indexOf(team[0].team) < 0
      );

      if (o.separation.team && team_diff.length) {
        let team = randomPop(team_diff);
        placeTeam(team, position);
      } else if (unplaced_teams.length) {
        let team = randomPop(unplaced_teams);
        placeTeam(team, position);
      } else {
        console.log('ERROR');
        exit = true;
      }
    }

    function placeTeam(team, position) {
      fx.pushBracketTeam({
        draw,
        team,
        bracket_index: position.bracket,
        position: position.position,
      });
      draw.unseeded_placements.push({ team, position });
    }

    function bracketTeams(bracket) {
      if (!bracket || !bracket.players) return [];
      return bracket.players.map(player => player.team);
    }
  }

  function randomRRunseededDistribution({ draw }) {
    let unfilled_positions = fx.drawInfo(draw).unfilled_positions;

    draw.unseeded_placements = draw.unseeded_teams.map(team => {
      let position = randomPop(unfilled_positions);

      fx.pushBracketTeam({
        draw,
        team,
        bracket_index: position.bracket,
        position: position.position,
      });

      return { team, position };
    });
  }

  fx.distributeQualifiers = distributeQualifiers;
  function distributeQualifiers({ draw, num_qualifiers }) {
    let current_draw = draw.compass ? draw[draw.compass] : draw;
    let info = drawInfo(current_draw);
    let total = info.draw_positions.length;
    // let bye_positions = info.byes.map(b=>b.data.dp);
    let unassigned_positions = info.unassigned.map(u => u.data.dp);
    let randomBinary = () => Math.floor(Math.random() * 2);
    num_qualifiers = num_qualifiers || current_draw.qualifiers || 0;

    // reverse qualifiers so that popping returns in numerical order
    let qualifiers = d3
      .range(0, num_qualifiers)
      .map(() => {
        return [{ entry: 'Q', qualifier: true }];
      })
      .reverse();

    let section_size = Math.floor(total / num_qualifiers);
    let sections = d3.range(0, Math.floor(total / section_size));

    // all draw positions which have a first-round opponent (no structural bye);
    // let paired_positions = info.nodes.filter(f=>+f.height === 1 && f.children).map(m=>[].concat(...m.children.map(c=>c.data.dp)));

    // paired positions which have no byes
    // TODO: don't place qualifiers with BYEs unless there is no alternative
    // let pairs_no_byes = paired_positions.filter(f=>intersection(bye_positions, f).length > 0);

    d3.range(0, num_qualifiers).forEach(() => {
      let section = randomPop(sections);
      let dprange = d3.range(
        section * section_size + 1,
        section * section_size + section_size + 1
      );
      let available_positions = intersection(dprange, unassigned_positions);
      let position = randomBinary()
        ? available_positions.shift()
        : available_positions.pop();
      if (position) {
        let team = qualifiers.pop();
        assignPosition({ node: current_draw, position, team, qualifier: true });
      }
    });

    qualifiers?.forEach(team => {
      info = drawInfo(current_draw);
      let available_positions = info.unassigned.map(u => u.data.dp);
      let position = available_positions.pop();
      assignPosition({ node: current_draw, position, team, qualifier: true });
    });
  }

  fx.seededTeams = seededTeams;
  function seededTeams({ teams }) {
    // this is an object that acts like an array... because there is no '0' seed
    return Object.assign(
      {},
      ...teams
        .filter(f => f[0].seed)
        .sort((a, b) => a[0].seed - b[0].seed)
        .map(t => ({ [t[0].seed]: t }))
    );
  }

  fx.placeSeedGroups = placeSeedGroups;
  function placeSeedGroups({ draw, count }) {
    let current_draw = draw.compass ? draw[draw.compass] : draw;
    if (!current_draw.seed_placements || !current_draw.seeded_teams) return;

    // if no count is specified, place all seed groups
    count = count || current_draw.seed_placements.length;
    d3.range(0, count).forEach(() => placeSeedGroup({ draw: current_draw }));
  }

  fx.placeSeedGroup = placeSeedGroup;
  function placeSeedGroup({ draw, group_index }) {
    let current_draw = draw.compass ? draw[draw.compass] : draw;
    if (!current_draw.seed_placements || !current_draw.seeded_teams) return;
    let seed_group =
      group_index !== undefined
        ? current_draw.seed_placements[group_index]
        : nextSeedGroup({ draw: current_draw });

    if (!seed_group) return;

    // make a copy so original is not diminshed by pop()
    let positions = seed_group.positions.slice();

    // pre-round draws place byes before remaining seeds... because all ranked players are seedeed
    if (current_draw.bye_placements)
      positions = positions.filter(
        p => current_draw.bye_placements.indexOf(p) < 0
      );

    let missing_seeds = [];

    seed_group.range?.forEach(seed => {
      // positions should already be randomized
      let position = positions.pop();
      let team = current_draw.seeded_teams[seed];

      if (!team) {
        seed_group.positions = seed_group.positions.filter(
          p => +p !== +position
        );
        missing_seeds.push(seed);
        return;
      }

      if (current_draw.brackets) {
        // procesing a round robin
        fx.pushBracketTeam({
          draw: current_draw,
          team,
          bracket_index: position.bracket,
          position: position.position,
        });
      } else {
        // processing a tree draw
        assignPosition({ node: current_draw, position, team });
      }
      seed_group.placements.push({ seed, position });
    });

    if (missing_seeds.length) {
      missing_seeds?.forEach(
        s => (seed_group.range = seed_group.range.filter(r => r !== s))
      );
    }
  }

  fx.pushBracketTeam = ({ draw, team, bracket_index, position }) => {
    let player = team[0];
    player.draw_position = position;
    draw.brackets[bracket_index].players.push(player);

    team?.forEach(opponent => (opponent.draw_position = position));
    draw.brackets[bracket_index].teams.push(team);
  };

  fx.nextSeedGroup = nextSeedGroup;
  function nextSeedGroup({ draw }) {
    let current_draw = draw.compass ? draw[draw.compass] : draw;
    let unplaced = unplacedSeedGroups({ draw: current_draw });
    return unplaced ? unplaced[0] : undefined;
  }

  fx.unplacedSeedGroups = unplacedSeedGroups;
  function unplacedSeedGroups({ draw }) {
    let current_draw = draw.compass ? draw[draw.compass] : draw;
    if (
      !current_draw.seed_placements ||
      !Array.isArray(current_draw.seed_placements)
    )
      return;
    return current_draw.seed_placements.filter(
      sp => sp.range.length !== sp.placements.length
    );
  }

  fx.roundMatches = ({ info, round }) => {
    let all_matches = info && info.all_matches;
    let round_matches =
      (round !== undefined &&
        all_matches &&
        all_matches.filter(n => n.height === round && !byeNode(n)).length) ||
      0;
    return round_matches;
  };

  fx.placeUnseededTeams = placeUnseededTeams;
  function placeUnseededTeams({ draw }) {
    let current_draw = draw.compass ? draw[draw.compass] : draw;
    if (!current_draw.unseeded_teams) return;
    if (o.separation.team && draw.opponents) {
      randomUnseededSeparation({ draw: current_draw });
    } else {
      randomUnseededDistribution({ draw: current_draw });
    }
  }

  function randomUnseededDistribution({ draw }) {
    let unfilled_positions = drawInfo(draw).unassigned.map(u => u.data.dp);
    unfilled_positions?.forEach(position => {
      let team = randomPop(draw.unseeded_teams);
      if (team) assignPosition({ node: draw, position, team });
    });
  }

  /*
   After seeds have been placed...
   For each iteration:
   * 1) sort all teams by number of unplaced players and select team with most unplaced or randomly choose one of the teams which has the same/greatest number of unplaced members 
   * 2) randomly select a member of selected team
   3) find the half/quarter/eighth or sixteenth with open positions and the fewest members of the same team
   4) randomly place the selected member in one of the open positions in the selected fractional 
   Repeat
   */

  function findCandidate({ draw }) {
    let info = fx.drawInfo(draw);

    let draw_positions = info.draw_positions.sort(sortNumber);
    let structural_bye_positions = info.structural_byes.map(b => b.data.dp);
    let draw_size = draw_positions.concat(...structural_bye_positions).length;
    let unassigned_positions = info.unassigned
      .map(u => u.data.dp)
      .sort(sortNumber);

    let remaining = (unassigned_positions && unassigned_positions.length) || 0;
    if (!remaining) return {};

    let largestGroup = unpairedPositions(unassigned_positions);
    let { opponent } = findOpponent({ largestGroup });
    // console.log({opponent, largestGroup});

    let opponent_teams = Object.assign(
      {},
      ...[].concat(...draw.opponents).map(o => ({ [o.id]: o.team }))
    );
    let grouping_positions = Object.keys(info.assigned_positions).map(
      groupingPosition
    );
    let opponent_groupings = opponent.map(o => o.team);
    let opponent_grouping_positions = grouping_positions
      .filter(gp => opponent_groupings.indexOf(gp.name) >= 0)
      .map(gp => gp.position);

    let all_positions = range(1, draw_size + 1);
    let chunk_sizes = range(2, draw_size)
      .filter(f => f === nearestPow2(f))
      .reverse();
    let chunks = chunk_sizes.map(size => chunkArray(all_positions, size));
    let vetted = chunks.map(chunkRow);

    let group_not_present = vetted
      .map(row => row.filter(r => !r.group_present))
      .filter(f => f);
    let no_group_unpaired = group_not_present
      .map(row => row.filter(r => r.unpaired.length).map(m => m.unpaired))
      .filter(f => f && f.length);
    let no_group_unassigned = group_not_present
      .map(row => row.filter(r => r.unassigned.length).map(m => m.unassigned))
      .filter(f => f && f.length);

    let viable_sections =
      (no_group_unpaired.length && no_group_unpaired[0]) ||
      (no_group_unassigned.length && no_group_unassigned[0]);

    let position;
    if (viable_sections) {
      let section = randomPop(viable_sections);
      position = randomPop(section);
    } else {
      position = randomPop(unassigned_positions);
    }

    return { opponent, position, remaining };

    function findOpponent({ largestGroup = true } = {}) {
      let assigned = Object.keys(info.assigned_positions);
      let unplaced_opponents = draw.opponents.filter(
        o => assigned.indexOf(o[0].id) < 0
      );

      let groupings = {};
      unplaced_opponents?.forEach(team => {
        let grouping = teamGrouping(team);
        groupings[grouping] = groupings[grouping]
          ? groupings[grouping].concat([team])
          : [team];
      });
      let max_length = Object.keys(groupings).reduce(
        (p, c) => (groupings[c].length > p ? groupings[c].length : p),
        0
      );
      let min_length = Object.keys(groupings).reduce(
        (p, c) => (groupings[c].length < p ? groupings[c].length : p),
        max_length
      );

      let groupings_meets_max = Object.keys(groupings).filter(
        f => groupings[f].length === max_length
      );
      let groupings_meets_min = Object.keys(groupings).filter(
        f => groupings[f].length === min_length
      );

      let random_group = largestGroup
        ? randomPop(groupings_meets_max)
        : randomPop(groupings_meets_min);
      let random_opponent = randomPop(groupings[random_group]);

      // console.log({ groupings, max_length, groupings_meets_max, random_group, random_opponent, unplaced_opponents });
      return { opponent: random_opponent };

      function teamGrouping(team) {
        return team
          .map(t => t.team)
          .sort()
          .join('|');
      }
    }

    function unpairedPositions(positions) {
      let true_positions = positions.map(truePosition);
      return positions.filter(u => !pairAssigned(u));

      function pairAssigned(u) {
        let true_position = truePosition(u);
        let true_pair =
          true_position % 2 ? true_position + 1 : true_position - 1;
        return true_positions.indexOf(true_pair) < 0;
      }
    }

    function checkChunk(chunk) {
      let unassigned = unassigned_positions.filter(
        u => chunk.indexOf(truePosition(u)) >= 0
      );
      let unpaired = unpairedPositions(unassigned);
      let group_present = opponent_grouping_positions.reduce(
        (p, g) => (chunk.indexOf(truePosition(g)) >= 0 ? true : p),
        false
      );
      return { unassigned, unpaired, group_present };
    }

    function chunkArray(arr, chunksize) {
      return arr.reduce((all, one, i) => {
        const ch = Math.floor(i / chunksize);
        all[ch] = [].concat(all[ch] || [], one);
        return all;
      }, []);
    }
    function sortNumber(a, b) {
      return a - b;
    }
    function chunkRow(row) {
      return row.map(checkChunk);
    }
    function truePosition(p) {
      let isEven = x => !(x & 1);
      let position = p + structural_bye_positions.filter(s => s < p).length;
      return structural_bye_positions.indexOf(p) >= 0 && isEven(p)
        ? position + 1
        : position;
    }
    function nearestPow2(val) {
      return Math.pow(2, Math.round(Math.log(val) / Math.log(2)));
    }
    function range(start, end) {
      return Array.from({ length: end - start }, (v, k) => k + start);
    }
    function randomPop(array) {
      return array.length
        ? array.splice(Math.floor(Math.random() * array.length), 1)[0]
        : undefined;
    }
    function groupingPosition(opponent_id) {
      return {
        name: opponent_teams[opponent_id],
        position: info.assigned_positions[opponent_id],
      };
    }
  }

  // Avoidance / Separation
  function randomUnseededSeparation({ draw }) {
    let { opponent, position, remaining } = findCandidate({ draw });

    for (let count = 0; count < remaining; count++) {
      if (opponent) assignPosition({ node: draw, position, team: opponent });
      ({ opponent, position } = findCandidate({ draw }));
    }
  }

  fx.matchNodes = matchNodes;
  function matchNodes(data) {
    return drawInfo(data).match_nodes;
  }

  fx.matchNode = matchNode;
  function matchNode(node) {
    let teams = matchTeams(node);
    return teams.length === 2 ? teams : false;
  }

  fx.matchTeams = matchTeams;
  function matchTeams(node) {
    if (!node || !node.data || !node.data.children) return false;
    node.data.children?.forEach(child => {
      if (
        child &&
        child.team &&
        child.dp &&
        child.team[0] &&
        child.team[0].draw_position !== child.dp
      ) {
        child.team?.forEach(team => (team.draw_position = child.dp));
      }
    });
    let teams = node.data.children.map(m => m.team).filter(f => f);
    return teams;
  }

  fx.feedNode = feedNode;
  function feedNode(node) {
    if (!node || !node.data || !node.data.children) return false;
    let feed_arms = node.data.children.map(m => m.feed).filter(f => f);
    return feed_arms.length === 1 ? true : false;
  }

  fx.feedNodes = feedNodes;
  function feedNodes(nodes) {
    return nodes.filter(feedNode);
  }

  fx.byeTeams = byeTeams;
  function byeTeams(node) {
    if (!node.data.children) return false;
    let teams = matchNode(node);
    if (!teams) return false;
    let test = node.data.children.map(d => d.bye).filter(f => f);
    if (!test.length) return false;
    return test.reduce((a, b) => a && b) ? teams : false;
  }

  fx.byeNode = byeNode;
  function byeNode(node) {
    if (!node.children) return false;
    let test = node.data.children.map(d => d.bye).filter(f => f);
    if (test.length) return test.length;
  }

  fx.teamMatch = teamMatch;
  function teamMatch(node, includeQualifiers = true) {
    if (!node.children) return false;
    let teams = matchNode(node);
    if (!teams) return false;
    let test = node.data.children.map(isAteam).filter(f => f);
    if (test.length < 2) return false;
    return test.reduce((a, b) => a && b) ? teams : false;

    function isAteam(d) {
      if (d.bye) return false;
      if (d.qualifier && includeQualifiers) return false;
      return true;
    }
  }

  fx.drawPositionsWithBye = drawPositionsWithBye;
  function drawPositionsWithBye(teams) {
    return unique(
      [].concat(
        ...teams.map(node =>
          [].concat(
            ...node.map(team =>
              team.map(player =>
                !player.bye ? player.draw_position : undefined
              )
            )
          )
        )
      )
    ).filter(f => f);
  }

  fx.replaceEmptiesWithByes = replaceEmptiesWithByes;
  function replaceEmptiesWithByes({ draw }) {
    let info = drawInfo(draw);
    let assigned_positions =
      (info &&
        Object.keys(info.assigned_positions).map(
          k => info.assigned_positions[k]
        )) ||
      [];
    let bye_positions = ((info && info.draw_positions) || []).filter(
      p => assigned_positions.indexOf(p) < 0
    );
    bye_positions?.forEach(position => {
      assignPosition({ node: draw, position, bye: true });
    });
  }

  fx.advanceTeamsWithByes = advanceTeamsWithByes;
  function advanceTeamsWithByes({ draw }) {
    let info = drawInfo(draw);
    // let winner_positions = (info && info.match_nodes && info.match_nodes.filter(n=>n.data.match && n.data.match.winner).map(n=>n.data.dp)) || [];
    // let bye_teams = info.nodes.filter(f=>byeTeams(f)).map(m=>matchNode(m));
    // let team_positions = drawPositionsWithBye(bye_teams).filter(p=>winner_positions.indexOf(p) < 0);
    // team_positions?.forEach(p => advancePosition({ draw, position: p, onlyIfBye: true }));

    let match_nodes = info.match_nodes.filter(n => !n.data.team);
    let unadvanced = match_nodes.filter(m =>
      m.children.reduce((p, c) => c.data.bye || p, undefined)
    );
    let unadvanced_dp = [].concat(
      ...unadvanced.map(u => u.children.map(c => c.data.dp))
    );
    let bye_dp = info.byes.map(b => b.data.dp);
    let unadvanced_player_dp = unadvanced_dp.filter(u => bye_dp.indexOf(u) < 0);
    unadvanced_player_dp?.forEach(p =>
      advancePosition({ draw, position: p, onlyIfBye: true })
    );

    if (info.bye_nodes)
      info.bye_nodes?.forEach(b => {
        if (b.data && b.data.match) {
          delete b.data.match.schedule;
        }
      });
    let unadvanced_double_byes = info.double_bye_nodes
      .filter(n => !hasBye(n))
      .map(n => n.data.children[0].dp);
    unadvanced_double_byes?.forEach(p => {
      advancePosition({ draw, position: p, bye: true, onlyIfBye: true });
    });
    if (unadvanced_double_byes.length) return advanceTeamsWithByes({ draw });
  }

  function hasBye(node) {
    return (
      node.data &&
      node.data.team &&
      node.data.team.reduce((p, c) => c.bye || p, undefined)
    );
  }

  fx.findDualMatchNodeByMatch = (draw, muid) => {
    let dual_match_muid = fx.findDualMatchMuid(draw, muid);
    return fx.findDualMatchNode(draw, dual_match_muid);
  };

  fx.findDualMatchNode = (draw, dual_match_muid) => {
    let info = draw && drawInfo(draw);
    return (
      info &&
      info.match_nodes &&
      info.match_nodes.reduce(
        (p, c) =>
          c.data.match && c.data.match.muid === dual_match_muid ? c : p,
        undefined
      )
    );
  };

  fx.findDualMatchMuid = (draw, muid) => {
    return (
      draw.dual_matches &&
      Object.keys(draw.dual_matches).reduce(
        (p, c) =>
          draw.dual_matches[c].matches.reduce(
            (x, y) => (y.match.muid === muid ? y : x),
            undefined
          )
            ? c
            : p,
        undefined
      )
    );
  };

  fx.findRRDualMatch = (draw, muid) => {
    let dual_match_muid = fx.findDualMatchMuid(draw, muid);
    let dual_matches = fx.matches(draw);
    let dual_match = dual_matches.reduce(
      (p, c) => (c.match.muid === dual_match_muid ? c : p),
      undefined
    );
    return dual_match;
  };

  fx.findMatchNodeByTeamPositions = findMatchNodeByTeamPositions;
  function findMatchNodeByTeamPositions(draw, positions) {
    let info = drawInfo(draw);

    let match_nodes = (info && info.match_nodes) || [];
    let nodes = match_nodes
      .filter(f => fx.teamMatch(f))
      .filter(match_node => {
        let match_positions = match_node.data.children.map(c =>
          c.team ? c.team[0].draw_position : undefined
        );
        return intersection(positions, match_positions).length === 2;
      });
    return nodes.length ? nodes[0].data : undefined;
  }

  fx.upcomingMatches = upcomingMatches;
  function upcomingMatches(
    data,
    round_names = [],
    calculated_round_names = []
  ) {
    if (!data) return [];
    if (data.compass) return upcomingCompassMatches(data);

    let info = drawInfo(data);
    if (!info) return [];

    if (info.draw_type === 'tree') {
      let round_offset = data.max_round ? info.depth - data.max_round : 0;
      return treeMatches({
        match_nodes: info.upcoming_match_nodes,
        max_round: data.max_round,
        round_offset,
        round_names,
        calculated_round_names,
        potentials: true,
      });
    }

    return [];
  }

  fx.treeMatches = treeMatches;
  function treeMatches({
    match_nodes,
    max_round,
    round_offset = 0,
    round_names = [],
    calculated_round_names = [],
    potentials,
    draw,
  }) {
    let matches = match_nodes
      .filter(n => potentials || teamMatch(n))
      .filter(n => (max_round ? n.height <= max_round : true))
      .map(node => {
        let round_name = round_names.length
          ? round_names[node.depth - round_offset]
          : undefined;
        if (round_name) node.data.round_name = round_name;

        let calculated_round_name = calculated_round_names.length
          ? calculated_round_names[node.depth - round_offset]
          : undefined;
        if (calculated_round_name)
          node.data.calculated_round_name = calculated_round_name;

        if (node.data.match && round_name)
          node.data.match.round_name = round_name;
        let potentials = node.data.children
          .filter(c => !c.team)
          .map(p => (p.children ? p.children.map(l => l.team) : undefined));
        let dependencies = node.data.children
          .filter(c => !c.team)
          .map(d => d.match && d.match.muid);
        let dependent =
          node.parent &&
          node.parent.data &&
          node.parent.data.match &&
          node.parent.data.match.muid;
        let this_match = {
          dependent,
          round_name,
          potentials,
          dependencies,
          source: node,
          round: node.height,
          calculated_round_name,
          match: node.data.match,
          teams: node.data.children.map(c => c.team).filter(f => f),
        };
        if (draw) this_match.draw = draw;
        return this_match;
      });
    return matches;
  }

  let compass_data = {
    pre: {
      east: 'E',
      west: 'W',
      north: 'N',
      south: 'S',
      northeast: 'NE',
      northwest: 'NW',
      southeast: 'SE',
      southwest: 'SW',
    },
    names: ['F', 'SF', 'QF', 'R16', 'R32', 'R64', 'R128', 'R256', 'R512'],
  };

  function upcomingCompassMatches(data) {
    let matches = []
      .concat(
        ...Object.keys(compass_data.pre)
          .filter(key => data[key])
          .map(key => {
            let info = drawInfo(data[key]);
            let max_round = data[key].max_round;
            let round_offset = max_round ? info.depth - max_round : 0;
            let round_names = compass_data.names.map(
              n => `${compass_data.pre[key]}-${n}`
            );
            return treeMatches({
              match_nodes: info.upcoming_match_nodes,
              max_round,
              round_offset,
              round_names,
              potentials: true,
            });
          })
      )
      .filter(m => m && m.match);

    return matches;
  }

  function compassMatches(data, all) {
    let matches = [].concat(
      ...Object.keys(compass_data.pre)
        .filter(key => data[key])
        .map(key => {
          let info = drawInfo(data[key]);
          let max_round = data[key].max_round;
          let round_offset = max_round ? info.depth - max_round : 0;
          let round_names = compass_data.names.map(
            n => `${compass_data.pre[key]}-${n}`
          );
          let match_nodes = all ? info.all_matches : info.match_nodes;
          return treeMatches({
            match_nodes,
            max_round,
            round_offset,
            round_names,
            potentials: all,
            draw: key,
          });
        })
    );

    return matches;
  }

  fx.extractDrawPlayers = draw => {
    let players = [];
    let draw_positions = [];
    []
      .concat(...fx.drawInfo(draw).nodes.map(n => n.data && n.data.team))
      ?.forEach(p => {
        if (draw_positions.indexOf(p.draw_position) < 0) {
          draw_positions.push(p.draw_position);
          players.push(p);
        }
      });
    return players;
  };

  // will be replaced by drawMatches module
  fx.matches = matches;
  function matches(data, round_names = [], calculated_round_names = [], all) {
    if (!data) return [];
    if (data.compass) return compassMatches(data, all);

    let info = drawInfo(data);
    if (!info) return data.matches || [];

    if (info.draw_type === 'tree') {
      let round_offset = data.max_round ? info.depth - data.max_round : 0;
      let match_nodes = all ? info.all_matches : info.match_nodes;
      return treeMatches({
        match_nodes,
        max_round: data.max_round,
        round_offset,
        round_names,
        calculated_round_names,
        potentials: all,
      });
    }

    if (info.draw_type === 'roundrobin') {
      data.brackets?.forEach((b, i) => bracketMatches(data, i));

      let matches = []
        .concat(...data.brackets.map(bracket => bracket.matches))
        .map(match => {
          return {
            teams: match.teams || match.players.map(p => [p]),
            round_name: match.round_name,
            result_order: match.result_order,
            match,
          };
        });
      return matches;
    }

    return [];
  }

  fx.tallyBracketAndModifyPlayers = ({
    matches,
    teams,
    per_player,
    reset,
    qualifying,
    matchFormat,
  }) => {
    if (!matches || !matches.length) return;

    per_player = per_player || (teams && teams.length - 1) || 1;
    let tbr = tallyBracket({ matches, per_player, qualifying, matchFormat });

    let instanceCount = values =>
      values.reduce((a, c) => {
        // eslint-disable-next-line
        a[c]++ ? 0 : (a[c] = 1);
        return a;
      }, {});
    let qordz = Object.keys(tbr.team_results).map(
      t => tbr.team_results[t].qorder
    );
    let ic = instanceCount(qordz);

    let valid_for_suborder = Object.keys(ic).reduce(
      (p, c) => (ic[c] > 1 ? p.concat(parseInt(c)) : p),
      []
    );
    matches?.forEach(
      match => (match.results_order = tbr.match_result_order[match.muid])
    );

    teams?.forEach(team => {
      let phash = playersHash(team);
      if (tbr.team_results[phash]) {
        team?.forEach(player => {
          player.qorder = tbr.team_results[phash].qorder;

          if (reset) {
            // in this case sub_order is overridden
            player.sub_order = tbr.team_results[phash].sub_order;
          } else {
            // in this context sub_order give preference to existing value
            player.sub_order =
              (valid_for_suborder.indexOf(player.qorder) >= 0 &&
                player.sub_order) ||
              tbr.team_results[phash].sub_order;
          }

          player.points_order = tbr.team_results[phash].points_order;
          player.results = {
            matches_won: tbr.team_results[phash].matches_won,
            matches_lost: tbr.team_results[phash].matches_lost,
            sets_won: tbr.team_results[phash].sets_won,
            sets_lost: tbr.team_results[phash].sets_lost,
            games_won: tbr.team_results[phash].games_won,
            games_lost: tbr.team_results[phash].games_lost,
            points_won: tbr.team_results[phash].points_won,
            points_lost: tbr.team_results[phash].points_lost,

            matches_ratio: tbr.team_results[phash].matches_ratio,
            sets_ratio: tbr.team_results[phash].sets_ratio,
            games_ratio: tbr.team_results[phash].games_ratio,
            points_ratio: tbr.team_results[phash].points_ratio,

            ratio_hash: tbr.team_results[phash].ratio_hash,
          };
          player.result = tbr.team_results[phash].result;
          player.games = tbr.team_results[phash].games;
        });
      }
    });

    return true;
  };

  fx.tallyBracket = tallyBracket;
  function tallyBracket({ matches, per_player, qualifying, matchFormat }) {
    let bracket_match_format = matchFormatCode.parse(matchFormat) || {};
    // if bracket is incomplete don't use expected matches per_player for calculating
    let bracket_complete =
      matches &&
      matches.length &&
      matches.filter(m => m.winner).length === matches.length;
    if (!bracket_complete) per_player = 0;

    let disqualified = [];
    let team_results = {};
    let match_result_order = {};
    let h2h = o.rr_h2h_priority;

    if (!matches) return;

    // for all matches winner score comes first!
    matches
      .filter(f => f)
      ?.forEach(match => {
        let match_format =
          matchFormatCode.parse(match.matchFormat || matchFormat) || {};
        if (match.winner && match.loser) {
          let wH = getIdentifier(match.winner);
          let lH = getIdentifier(match.loser);

          if (!wH || !lH) {
            // if there is an undefined winner/loser then the match was cancelled
            let team1 =
              match.teams && match.teams[0] && getIdentifier(match.teams[0]);
            let team2 =
              match.teams && match.teams[1] && getIdentifier(match.teams[1]);
            if (team1) {
              checkTeam(team1);
              team_results[team1].matches_cancelled += 1;
            }
            if (team2) {
              checkTeam(team2);
              team_results[team2].matches_cancelled += 1;
            }
            return;
          }

          checkTeam(wH);
          checkTeam(lH);
          if (match.score && disqualifyingScore(match.score))
            disqualified.push(lH);

          team_results[wH].matches_won += 1;
          team_results[lH].matches_lost += 1;
          team_results[lH].defeats.push(wH);
          team_results[wH].victories.push(lH);

          let sets_tally = countSets(match.score, 0, match_format);
          team_results[wH].sets_won += sets_tally[0];
          team_results[wH].sets_lost += sets_tally[1];
          team_results[lH].sets_won += sets_tally[1];
          team_results[lH].sets_lost += sets_tally[0];

          let games_tally = countGames(match.score, 0, match_format);
          team_results[wH].games_won += games_tally[0];
          team_results[wH].games_lost += games_tally[1];
          team_results[lH].games_won += games_tally[1];
          team_results[lH].games_lost += games_tally[0];

          let points_tally = countPoints(match.score);
          team_results[wH].points_won += points_tally[0];
          team_results[wH].points_lost += points_tally[1];
          team_results[lH].points_won += points_tally[1];
          team_results[lH].points_lost += points_tally[0];
        } else {
          if (match.teams)
            match.teams?.forEach(team => checkTeam(getIdentifier(team)));
        }
      });

    function getIdentifier(opponent) {
      if (!Array.isArray(opponent) && opponent.players && opponent.id) {
        return opponent.id;
      }
      return playersHash(opponent);
    }

    function checkTeam(phash) {
      if (!team_results[phash])
        team_results[phash] = {
          matches_won: 0,
          matches_lost: 0,
          victories: [],
          defeats: [],
          matches_cancelled: 0,
          sets_won: 0,
          sets_lost: 0,
          games_won: 0,
          games_lost: 0,
          points_won: 0,
          points_lost: 0,
        };
    }

    // the difference here is totlas must be calcuulated using the expected
    // match scoring format for the bracket, not the inidivudal match formats
    let bracket_sets_to_win = scoreFx.setsToWin(bracket_match_format.bestOf);
    let bracket_games_for_set =
      bracket_match_format.setFormat && bracket_match_format.setFormat.setTo;

    Object.keys(team_results).forEach(phash => {
      let sets_numerator = team_results[phash].sets_won;
      let sets_denominator = team_results[phash].sets_lost;
      let sets_total =
        per_player * (bracket_sets_to_win || 0) || sets_numerator;
      let sets_ratio =
        Math.round((sets_numerator / sets_denominator) * 1000) / 1000;
      if (sets_ratio === Infinity || isNaN(sets_ratio)) sets_ratio = sets_total;

      let matches_numerator = team_results[phash].matches_won;
      let matches_denominator = team_results[phash].matches_lost;
      let matches_ratio =
        Math.round((matches_numerator / matches_denominator) * 1000) / 1000;
      if (matches_ratio === Infinity || isNaN(matches_ratio))
        matches_ratio = matches_numerator;

      let games_numerator = team_results[phash].games_won;
      let games_denominator = team_results[phash].games_lost;
      let games_total =
        per_player *
          (bracket_sets_to_win || 0) *
          (bracket_games_for_set || 0) || games_numerator;
      let games_ratio =
        Math.round((games_numerator / games_denominator) * 1000) / 1000;
      if (games_ratio === Infinity || isNaN(games_ratio)) {
        games_ratio = games_total;
      }
      let games_difference =
        games_denominator >= games_numerator
          ? 0
          : games_numerator - games_denominator;

      let points_ratio =
        Math.round(
          (team_results[phash].points_won / team_results[phash].points_lost) *
            1000
        ) / 1000;
      if (points_ratio === Infinity || isNaN(points_ratio)) points_ratio = 0;

      team_results[phash].sets_ratio = sets_ratio;
      team_results[phash].matches_ratio = matches_ratio;
      team_results[phash].games_ratio = games_ratio;
      team_results[phash].games_difference = games_difference;
      team_results[phash].points_ratio = points_ratio;
      team_results[
        phash
      ].result = `${team_results[phash].matches_won}/${team_results[phash].matches_lost}`;
      team_results[
        phash
      ].games = `${team_results[phash].games_won}/${team_results[phash].games_lost}`;
    });

    let order = determineTeamOrder(team_results);

    if (order) {
      let ro_list = order.map(o => o.rank_order);

      order?.forEach(o => {
        team_results[o.id].ratio_hash = o.ratio_hash;
        if (o !== undefined && o.rank_order !== undefined) {
          team_results[o.id].qorder = o.rank_order;
          if (
            occurrences(o.rank_order, ro_list) > 1 &&
            team_results[o.id].sub_order === undefined
          ) {
            team_results[o.id].sub_order = 0;
          } else if (occurrences(o.rank_order, ro_list) === 1) {
            team_results[o.id].sub_order = undefined;
          }
        }

        // calculate order for awarding points
        if (o !== undefined && o.points_order !== undefined) {
          team_results[o.id].points_order = o.points_order;
        } else {
          team_results[o.id].points_order = undefined;
        }
      });
    }

    // create an object mapping id to order
    let id_order = Object.keys(team_results).reduce((o, t) => {
      o[t] = team_results[t].points_order;
      return o;
    }, {});

    matches?.forEach(match => {
      let order =
        match.winner_index === undefined
          ? ''
          : id_order[getIdentifier(match.winner)];
      match_result_order[match.muid] = `RR${qualifying ? 'Q' : ''}${order ||
        ''}`;
    });

    return { team_results, match_result_order };

    function walkedOver(score) {
      return /W/.test(score) && /O/.test(score);
    }
    function defaulted(score) {
      return /DEF/.test(score);
    }
    function retired(score) {
      return /RET/.test(score);
    }
    function disqualifyingScore(score) {
      return walkedOver(score) || defaulted(score);
    }

    function countSets(score, winner, match_format) {
      let sets_to_win = scoreFx.setsToWin(match_format.bestOf);

      let sets_tally = [0, 0];
      if (!score) return sets_tally;
      if (disqualifyingScore(score)) {
        if (winner !== undefined && sets_to_win)
          sets_tally[winner] = sets_to_win;
      } else {
        let set_scores = score.split(' ');
        set_scores?.forEach(set_score => {
          let divider =
            set_score.indexOf('-') > 0
              ? '-'
              : set_score.indexOf('/') > 0
              ? '/'
              : undefined;
          let scores =
            // eslint-disable-next-line no-useless-escape
            /\d+[\(\)\-\/]*/.test(set_score) && divider
              ? set_score.split(divider).map(s => /\d+/.exec(s)[0])
              : undefined;
          if (scores) {
            sets_tally[parseInt(scores[0]) > parseInt(scores[1]) ? 0 : 1] += 1;
          }
        });
      }
      if (retired(score) && winner !== undefined && sets_to_win) {
        // if the loser has sets_to_win then last set was incomplete and needs to be subtracted from loser
        if (+sets_tally[1 - winner] === sets_to_win)
          sets_tally[1 - winner] -= 1;
        sets_tally[winner] = sets_to_win;
      }
      return sets_tally;
    }

    function countPoints(score) {
      let points_tally = [0, 0];
      if (!score) return points_tally;
      let set_scores = score.split(' ');
      set_scores?.forEach(set_score => {
        let scores = /\d+\/\d+/.test(set_score)
          ? set_score.split('/').map(s => /\d+/.exec(s)[0])
          : [0, 0];
        if (scores) {
          points_tally[0] += parseInt(scores[0]);
          points_tally[1] += parseInt(scores[1]);
        }
      });
      return points_tally;
    }

    function countGames(score, winner, match_format) {
      let sets_to_win = scoreFx.setsToWin(match_format.bestOf);
      let games_for_set =
        match_format.setFormat && match_format.setFormat.setTo;
      let tiebreaks_at =
        match_format.setFormat && match_format.setFormat.tiebreakAt;
      if (!score) return [0, 0];
      let min_winning_games = sets_to_win * games_for_set;
      let games_tally = [[], []];
      if (disqualifyingScore(score)) {
        if (winner !== undefined && sets_to_win && games_for_set) {
          games_tally[winner].push(min_winning_games);
        }
      } else {
        let set_scores = score.split(' ');
        set_scores?.forEach(set_score => {
          let scores =
            // eslint-disable-next-line no-useless-escape
            /\d+[\(\)\-\/]*/.test(set_score) && set_score.indexOf('-') > 0
              ? set_score.split('-').map(s => /\d+/.exec(s)[0])
              : undefined;
          if (scores) {
            games_tally[0].push(parseInt(scores[0]));
            games_tally[1].push(parseInt(scores[1]));
          }
        });
      }
      if (
        retired(score) &&
        winner !== undefined &&
        sets_to_win &&
        games_for_set
      ) {
        let sets_tally = countSets(score, winner, match_format);
        let total_sets = sets_tally.reduce((a, b) => a + b, 0);
        let loser_lead_set = games_tally
          .map(g => g[winner] <= g[1 - winner])
          .reduce((a, b) => a + b, 0);
        // if sets where loser lead > awarded sets, adjust last game to winner
        if (loser_lead_set > sets_tally[1 - winner]) {
          let tallied_games = games_tally[winner].length;
          let complement = getComplement(
            games_tally[1 - winner][tallied_games - 1]
          );
          if (complement) games_tally[winner][tallied_games - 1] = complement;
        }
        // if the total # of sets is less than games_tally[x].length award games_for_set to winner
        if (total_sets > games_tally[winner].length) {
          games_tally[winner].push(games_for_set);
        }
      }
      let result = [
        games_tally[0].reduce((a, b) => a + b, 0),
        games_tally[1].reduce((a, b) => a + b, 0),
      ];
      if (winner !== undefined && result[winner] < min_winning_games)
        result[winner] = min_winning_games;
      return result;

      function getComplement(value) {
        if (!match_format || value === '') return;
        if (+value === tiebreaks_at - 1 || +value === tiebreaks_at)
          return parseInt(tiebreaks_at || 0) + 1;
        if (+value < tiebreaks_at) return games_for_set;
        return tiebreaks_at;
      }
    }

    function determineTeamOrder(team_results) {
      let team_ids = Object.keys(team_results);
      let total_opponents = team_ids.length;

      // order is an array of objects formatted for processing by ties()
      let order = team_ids.reduce((arr, team_id, i) => {
        arr.push({ id: team_id, i, results: team_results[team_id] });
        return arr;
      }, []);
      let complete = order.filter(
        o =>
          total_opponents - 1 ===
          o.results.matches_won +
            o.results.matches_lost +
            o.results.matches_cancelled
      );

      // if not all opponents have completed their matches, no orders are assigned
      if (total_opponents !== complete.length) {
        return;
      }

      complete?.forEach(p => (p.order_hash = orderHash(p)));
      complete?.forEach(p => (p.ratio_hash = ratioHash(p)));

      // START ORDER HASH
      if (h2h) {
        complete.sort(
          (a, b) => (b.results.matches_won || 0) - (a.results.matches_won || 0)
        );
        let wins = complete.map(p => p.results.matches_won);
        let counts = unique(wins);
        counts?.forEach(count => {
          let i = indices(count, wins);
          if (i.length && i.length > 1) {
            let start = Math.min(...i);
            let end = Math.max(...i);
            let n = end - start + 1;
            if (n === 2) {
              complete = subSort(complete, start, n, h2hOrder);
            } else {
              complete = subSort(complete, start, n, orderHashSort);
            }
          }
        });
      } else {
        complete.sort(orderHashSort);
      }

      let hash_order = unique(complete.map(c => c.order_hash));
      complete?.forEach(
        p => (p.hash_order = hash_order.indexOf(p.order_hash) + 1)
      );

      // now account for equivalent hash_order
      let rank_order = 0;
      let rank_hash = undefined;
      complete?.forEach((p, i) => {
        if (p.order_hash !== rank_hash) {
          rank_order = i + 1;
          rank_hash = p.order_hash;
        }
        p.rank_order = rank_order;
      });
      // END ORDER HASH

      // START RATIO HASH
      if (h2h) {
        complete.sort(
          (a, b) => (b.results.matches_won || 0) - (a.results.matches_won || 0)
        );
        let wins = complete.map(p => p.results.matches_won);
        let counts = unique(wins);
        counts?.forEach(count => {
          let i = indices(count, wins);
          if (i.length && i.length > 1) {
            let start = Math.min(...i);
            let end = Math.max(...i);
            let n = end - start + 1;
            if (n === 2) {
              complete = subSort(complete, start, n, h2hRatio);
            } else {
              complete = subSort(complete, start, n, ratioHashSort);
            }
          }
        });
      } else {
        complete.sort(ratioHashSort);
      }

      let ratio_order = unique(complete.map(c => c.ratio_hash));
      complete?.forEach(
        p => (p.ratio_order = ratio_order.indexOf(p.ratio_hash) + 1)
      );

      // points_order is used for awarding points and may differ from
      // rank_order if a player unable to advance due to walkover
      let points_order = 0;
      let ratio_hash = undefined;
      complete?.forEach((p, i) => {
        if (p.ratio_hash !== ratio_hash) {
          points_order = i + 1;
          ratio_hash = p.ratio_hash;
        }
        p.points_order = points_order;
      });
      // END RATIO HASH

      return complete;

      function ratioHashSort(a, b) {
        return b.ratio_hash - a.ratio_hash;
      }
      function orderHashSort(a, b) {
        return b.order_hash - a.order_hash;
      }
      function h2hRatio(a, b) {
        let h2h_a = a.results.victories.indexOf(b.id) >= 0;
        let h2h_b = b.results.victories.indexOf(a.id) >= 0;
        if (h2h_a || h2h_b) {
          return h2h_b ? 1 : -1;
        }
        return b.ratio_hash - a.ratio_hash;
      }

      function h2hOrder(a, b) {
        let h2h_a = a.results.victories.indexOf(b.id) >= 0;
        let h2h_b = b.results.victories.indexOf(a.id) >= 0;
        if (h2h_a || h2h_b) {
          return h2h_b ? 1 : -1;
        }
        return b.order_hash - a.order_hash;
      }

      function orderHash(p) {
        if (disqualified.indexOf(p.id) >= 0) return 0;
        return ratioHash(p);
      }
      function ratioHash(p) {
        let rh;
        if (h2h) {
          rh =
            p.results.matches_ratio * Math.pow(10, 16) +
            p.results.sets_ratio * Math.pow(10, 12) +
            p.results.games_difference * Math.pow(10, 8) +
            p.results.points_ratio * Math.pow(10, 3);
        } else {
          rh =
            p.results.matches_ratio * Math.pow(10, 16) +
            p.results.sets_ratio * Math.pow(10, 12) +
            p.results.games_ratio * Math.pow(10, 8) +
            p.results.points_ratio * Math.pow(10, 3);
        }
        return rh;
      }
    }
  }

  function keyWalk(valuesObject, optionsObject) {
    if (!valuesObject || !optionsObject) return;
    var vKeys = Object.keys(valuesObject);
    var oKeys = Object.keys(optionsObject);
    for (var k = 0; k < vKeys.length; k++) {
      if (oKeys.indexOf(vKeys[k]) >= 0) {
        var oo = optionsObject[vKeys[k]];
        var vo = valuesObject[vKeys[k]];
        if (
          oo &&
          typeof oo === 'object' &&
          typeof vo !== 'function' &&
          oo.constructor !== Array
        ) {
          keyWalk(valuesObject[vKeys[k]], optionsObject[vKeys[k]]);
        } else {
          optionsObject[vKeys[k]] = valuesObject[vKeys[k]];
        }
      }
    }
  }

  return fx;
}
