import { typeCheck as tc } from './typeCheck';
import { courtData, ctuuid } from './courtFx';
import { scoreFx } from './scoreFx';
import { dateFx } from './dateFx';
import { drawFx } from './drawFx';
import { UUID } from './UUID';

export const matchFx = (function() {
  let fx = {};
  let dfx = drawFx();

  fx.eventMatches = eventMatches;
  function eventMatches(e, tournament, all, env) {
    let matches = [];
    if (!e || !e.draw) {
      return matches;
    }
    if (tc.isAdHoc({ e })) {
      matches = safeArr(e.draw && e.draw.matches);
    } else if (tc.isTeam({ tournament, e })) {
      Object.keys(e.draw.dual_matches || {}).forEach(key => {
        let dual_matches = e.draw.dual_matches[key].matches || [];
        dual_matches.forEach(dm => (dm.dual_match = key));
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

  // KEEP
  function findEventByID(tournament, id) {
    if (!tournament || !tournament.events || tournament.events.length < 1)
      return;
    return tournament.events.reduce(
      (p, c) => (c.euid === id ? c : p),
      undefined
    );
  }

  // KEEP
  fx.roundNames = roundNames;
  function roundNames(tournament, e) {
    var names = [];
    var calculated_names = [];
    if (tc.hasRoundNames({ e })) {
      if (tc.isFeedIn({ e })) {
        names = ['F', 'SF', 'QF'];
        let depth = dfx.drawInfo(e.draw).depth;
        if (depth > 3) {
          let rounds = numArr(depth - 3)
            .map(d => `R${d + 1}`)
            .reverse();
          names = names.concat(...rounds);
        }
      } else {
        names = ['F', 'SF', 'QF', 'R16', 'R32', 'R64', 'R128', 'R256', 'R512'];
      }
    }
    if (tc.isQualifying({ e })) {
      names = ['Q', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5'];
      let qlink = e.links && findEventByID(tournament, e.links['E']);
      if (qlink && qlink.draw) {
        let info = dfx.drawInfo(qlink.draw);
        if (info)
          calculated_names = [
            'F',
            'SF',
            'QF',
            'R16',
            'R32',
            'R64',
            'R128',
            'R256',
            'R512',
            'R1024',
          ].slice(info.depth);
      }
    }
    if (tc.isPlayoff({ e })) {
      names = ['PO3'];
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
      .map(l => l.luid)
      .forEach(luid =>
        courtData(tournament, luid, max_matches_per_court).forEach(
          ct => (court_names[ctuuid(ct)] = ct.name)
        )
      );
    let check_names = Object.keys(court_names).length;

    matches.forEach(match => {
      let schedule = match.match && match.match.schedule;
      if (schedule) {
        if (check_names) schedule.court = court_names[ctuuid(schedule)];
        if (schedule && schedule.oop_round && schedule.luid) {
          let court_matches = matches
            .filter(
              m =>
                m.match &&
                m.match.schedule &&
                ctuuid(m.match.schedule) === ctuuid(schedule)
            )
            .filter(
              m =>
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

  fx.addMUIDs = addMUIDs;
  function addMUIDs(e) {
    if (!e.draw) return;
    let current_draw = e.draw.compass ? e.draw[e.draw.compass] : e.draw;
    if (!current_draw) return;

    if (e.draw.compass) {
      dfx.compassInfo(e.draw).all_matches.forEach(addMUID);
    } else if (e.draw.brackets) {
      e.draw.brackets.forEach(bracket =>
        bracket.matches.forEach(match => {
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

  fx.roundPosition = ({ match, matches }) => {
    let matchNode = matches?.reduce(
      (p, n) => (n.data?.match?.muid === match?.muid ? n : p),
      undefined
    );
    let roundMatches = matches?.filter(n => matchNode?.depth === n.depth);
    let muids = roundMatches?.map(n => n?.data?.match?.muid).filter(f => f);
    let index = muids && muids.indexOf(match?.muid);
    const roundPosition = index >= 0 ? (index + 1).toString() : '';
    return roundPosition;
  };

  return fx;
})();

function numArr(count) {
  return [...Array(count)].map((_, i) => i);
}
function safeArr(x) {
  return (
    (Array.isArray(x) && x) ||
    (typeof x === 'object' && Object.keys(x).map(k => x[k])) ||
    []
  );
}
