import { utilities, mocksEngine, participantConstants, participantRoles, entryStatusConstants, matchUpStatusConstants, eventConstants, genderConstants, drawDefinitionConstants, tournamentEngine, matchUpTypes, factoryConstants, errorConditionConstants, scaleConstants, penaltyConstants } from 'tods-competition-factory';
import { tree, hierarchy, range as range$1, shuffle } from 'd3';
import { normalizeName } from 'normalize-text';
import { format } from 'date-fns';

function _extends() {
  _extends = Object.assign || function (target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];

      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }

    return target;
  };

  return _extends.apply(this, arguments);
}

function convertTieFormat(matchorder) {
  var matchUpTypes = utilities.unique(matchorder.map(function (_ref) {
    var format = _ref.format;
    return format.toUpperCase();
  }));
  var collectionDefinitions = matchUpTypes.map(function (matchUpType) {
    var collectionMatchUps = matchorder.filter(function (order) {
      return order.format.toUpperCase() === matchUpType;
    });
    var collectionValue = (collectionMatchUps == null ? void 0 : collectionMatchUps.map(function (_ref2) {
      var value = _ref2.value;
      return parseFloat(value);
    }).filter(function (value) {
      return !isNaN(value);
    }).reduce(function (a, b) {
      return a + b;
    }, 0)) || 0;
    var collectionValueProfile = (collectionMatchUps || []).map(function (matchUp, index) {
      return {
        collectionPosition: index + 1,
        matchUpValue: parseFloat(matchUp.value)
      };
    });
    var collectionDefinition = {
      matchUpsCount: collectionMatchUps.length,
      collectionName: matchUpType,
      collectionId: utilities.UUID(),
      collectionValue: collectionValue,
      matchUpType: matchUpType
    };
    var valuesDiffer = utilities.unique(collectionValueProfile.map(function (_ref3) {
      var matchUpValue = _ref3.matchUpValue;
      return matchUpValue;
    })).length > 1;

    if (valuesDiffer) {
      // if not all collection matchUpValues are equal, add collectionValueProfile...
      collectionDefinition.collectionValueProfile = collectionValueProfile;
    } else {
      // ...otherwise just add matchUpValue
      collectionDefinition.matchUpValue = collectionValueProfile[0].matchUpValue;
    }

    return collectionDefinition;
  });
  var totalTieValue = collectionDefinitions.map(function (_ref4) {
    var collectionValue = _ref4.collectionValue;
    return collectionValue;
  }).reduce(function (a, b) {
    return a + b;
  }); // TMX 1.9 valueGoals were always 1 more than half

  var valueGoal = Math.floor(totalTieValue / 2) + 1;
  var winCriteria = {
    valueGoal: valueGoal
  };
  return {
    collectionDefinitions: collectionDefinitions,
    winCriteria: winCriteria
  };
}

/*
 * TODO: if the final set is NOT different then don't include in string
 */
var SET = "SET";
var NOAD = "NOAD";
var TIMED = "timed";
var FINAL = "final";
var NORMAL = "normal";
var setTypes = {
  S: NORMAL,
  F: FINAL
};
var matchFormatCode = /*#__PURE__*/function () {
  var fx = {};

  fx.stringify = function (matchformatobject) {
    if (matchformatobject && typeof matchformatobject === "object") {
      if (matchformatobject.timed && !isNaN(matchformatobject.minutes)) return timedFormat(matchformatobject);
      if (matchformatobject.bestOf && matchformatobject.setFormat) return setFormat(matchformatobject);
    }
  };

  function timedFormat(matchformatobject) {
    return "T" + matchformatobject.minutes;
  }

  function setFormat(matchformatobject) {
    var best_of = getNumber(matchformatobject.bestOf);
    var bestOf = best_of && "" + SET + best_of || "";
    var normal_set = stringifySet(matchformatobject.setFormat);
    var normalSet = normal_set && "S:" + normal_set || "";
    var final_set = stringifySet(matchformatobject.finalSetFormat);
    var finalSet = best_of > 1 && final_set && !final_set.invalid && "F:" + final_set || "";
    var valid = bestOf && normal_set && !normal_set.invalid && (!final_set || !final_set.invalid);

    if (valid) {
      return [bestOf, normalSet, finalSet].filter(function (f) {
        return f;
      }).join("-");
    }
  }

  function stringifySet(setobject) {
    if (setobject) {
      if (typeof setobject === "object") {
        if (setobject.tiebreakSet) return tiebreakFormat(setobject.tiebreakSet);
        var setTo = getNumber(setobject.setTo);

        if (setTo) {
          var NoAD = setobject.NoAD && NOAD || "";
          var set_tiebreak = tiebreakFormat(setobject.tiebreakFormat);
          var setTiebreak = set_tiebreak && !set_tiebreak.invalid && "/" + set_tiebreak || "";
          var tiebreak_at = getNumber(setobject.tiebreakAt);
          var tiebreakAt = tiebreak_at && tiebreak_at !== setTo && "@" + tiebreak_at || "";
          var valid = !set_tiebreak || !set_tiebreak.invalid;

          if (valid) {
            return "" + setTo + NoAD + setTiebreak + tiebreakAt;
          } else {
            return {
              invalid: true
            };
          }
        } else {
          return {
            invalid: true
          };
        }
      }
    }
  }

  function tiebreakFormat(tieobject) {
    if (tieobject) {
      if (typeof tieobject === "object" && getNumber(tieobject.tiebreakTo)) {
        return "TB" + tieobject.tiebreakTo + (tieobject.NoAD ? NOAD : "");
      } else {
        return {
          invalid: true
        };
      }
    }
  }

  fx.parse = function (matchformatcode) {
    if (matchformatcode && typeof matchformatcode === "string") {
      var type = matchformatcode.indexOf("T") === 0 ? "timed" : matchformatcode.indexOf(SET) === 0 ? SET : "";
      if (type === TIMED) return timedMatch(matchformatcode);
      if (type === SET) return setsMatch(matchformatcode);
    }
  };

  function setsMatch(formatstring) {
    var parts = formatstring.split("-");
    var bestOf = getNumber(parts[0].slice(3));
    var setFormat = parts && parseSetFormat(parts[1]);
    var finalSetFormat = parts && parseSetFormat(parts[2]);
    var validBestOf = bestOf && bestOf < 6;
    var validFinalSet = !parts[2] || finalSetFormat && !finalSetFormat.invalid;
    var validSetsFormat = setFormat && !setFormat.invalid;
    var result = {
      bestOf: bestOf,
      setFormat: setFormat
    };
    if (finalSetFormat) result.finalSetFormat = finalSetFormat;
    if (validBestOf && validSetsFormat && validFinalSet) return result;
  }

  function parseSetFormat(formatstring) {
    if (formatstring && formatstring[1] === ":") {
      var parts = formatstring.split(":");
      var set_type = setTypes[parts[0]];
      var set_format = parts[1];

      if (set_type && set_format) {
        var tiebreakSet = set_format.indexOf("TB") === 0;
        if (tiebreakSet) return {
          tiebreakSet: parseTiebreakFormat(set_format)
        };

        var _parts = formatstring.match(/^[FS]{1}:(\d+)([A-Za-z]*)/);

        var NoAD = _parts && isNoAD(_parts[2]) || false;
        var validNoAD = !_parts || !_parts[2] || NoAD;

        var setTo = _parts && getNumber(_parts[1]);

        var tiebreak_at = parseTiebreakAt(set_format);
        var validTiebreakAt = !tiebreak_at || tiebreak_at && !tiebreak_at.invalid;
        var tiebreakAt = validTiebreakAt && tiebreak_at || setTo;

        var _tiebreakFormat = parseTiebreakFormat(set_format.split("/")[1]);

        var validTiebreak = !_tiebreakFormat || !_tiebreakFormat.invalid;
        var result = {
          setTo: setTo
        };
        if (NoAD) result.NoAD = true;

        if (_tiebreakFormat) {
          result.tiebreakFormat = _tiebreakFormat;
          result.tiebreakAt = tiebreakAt;
        } else {
          result.noTiebreak = true;
        }

        return setTo && validNoAD && validTiebreak && validTiebreakAt && result || {
          invalid: true
        };
      }
    }
  }

  function parseTiebreakAt(set_format) {
    var tiebreak_at = set_format && set_format.indexOf("@") > 0 && set_format.split("@");

    if (tiebreak_at) {
      var tiebreakAt = getNumber(tiebreak_at[1]);
      return tiebreakAt || {
        invalid: true
      };
    }
  }

  function parseTiebreakFormat(formatstring) {
    if (formatstring) {
      if (formatstring.indexOf("TB") === 0) {
        var parts = formatstring.match(/^TB(\d+)([A-Za-z]*)/);
        var tiebreak_to = parts && parts[1];
        var NoAD = parts && isNoAD(parts[2]);
        var validNoAD = !parts || !parts[2] || NoAD;
        var tiebreakTo = getNumber(tiebreak_to);

        if (tiebreakTo && validNoAD) {
          var result = {
            tiebreakTo: tiebreakTo
          };
          if (NoAD) result.NoAD = true;
          return result;
        } else {
          return {
            invalid: true
          };
        }
      } else {
        return {
          invalid: true
        };
      }
    }
  }

  function timedMatch(formatstring) {
    var timestring = formatstring.slice(1);
    var minutes = getNumber(timestring);
    if (minutes) return {
      timed: true,
      minutes: minutes
    };
  }

  function isNoAD(formatstring) {
    return formatstring && formatstring.indexOf(NOAD) >= 0;
  }

  function getNumber(formatstring) {
    return !isNaN(Number(formatstring)) && Number(formatstring);
  }

  return fx;
}();

/*
   Convert legacy TMX score_format into JSON representation of TODS MatchFormatCode
*/
var scoreFormat = /*#__PURE__*/function () {
  var fx = {};

  fx.jsonTODS = function (score_format) {
    var tods = {
      bestOf: getNumber(score_format.max_sets)
    };

    if (score_format.max_sets && parseInt(score_format.max_sets) === 1 && score_format.final_set_supertiebreak) {
      tods.setFormat = {
        tiebreakSet: {
          tiebreakTo: score_format.supertiebreak_to
        }
      };
    } else {
      var setTo = getNumber(score_format.games_for_set);
      var tiebreaks_at = getNumber(score_format.tiereaks_at);
      var tiebreakAt = tiebreaks_at > setTo ? setTo : tiebreaks_at;
      tods.setFormat = {
        setTo: setTo,
        tiebreakAt: tiebreakAt,
        tiebreakFormat: {
          tiebreakTo: getNumber(score_format.tiebreak_to)
        }
      };

      if (score_format.final_set_supertiebreak) {
        tods.finalSetFormat = {
          tiebreakSet: {
            tiebreakTo: score_format.supertiebreak_to
          }
        };
      }
    }

    return tods;
  };

  function getNumber(formatstring) {
    return !isNaN(Number(formatstring)) && Number(formatstring);
  }

  return fx;
}();

var dateFx = /*#__PURE__*/function () {
  var fx = {};

  fx.localizeDate = function (date, date_localization, locale) {
    var default_localization = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    };
    return date.toLocaleDateString(locale, date_localization || default_localization);
  };

  fx.timeSort = timeSort;

  function timeSort(a, b) {
    var as = splitTime(a);
    var bs = splitTime(b);
    if (parseInt(as.hours) < parseInt(bs.hours)) return -1;
    if (parseInt(as.hours) > parseInt(bs.hours)) return 1;

    if (as.hours === bs.hours) {
      if (parseInt(as.minutes) < parseInt(bs.minutes)) return -1;
      if (parseInt(as.minutes) > parseInt(bs.minutes)) return 1;
    }

    return 0;
  }

  function splitTime(value) {
    value = value || "00:00";
    var o = {},
        time = {};

    var _ref = value && value.split(" ") || "";

    o.time = _ref[0];
    o.ampm = _ref[1];

    var _ref2 = o.time && o.time.split(":") || "";

    time.hours = _ref2[0];
    time.minutes = _ref2[1];
    time.ampm = o.ampm;
    return time;
  }

  fx.militaryTime = function (value, env) {
    var time = splitTime(value || env.schedule.default_time);

    if (time.ampm && time.hours) {
      if (time.ampm.toLowerCase() === "pm" && parseInt(time.hours) < 12) time.hours = (time.hours && parseInt(time.hours) || 0) + 12;
      if (time.ampm.toLowerCase() === "am" && time.hours === "12") time.hours = "00";
    }

    return (time.hours || "12") + ":" + (time.minutes || "00");
  };

  fx.regularTime = function (value, env) {
    var time = splitTime(value || env.schedule.default_time);
    if (time.ampm) return value;

    if (time.hours > 12) {
      time.hours -= 12;
      time.ampm = "PM";
    } else if (time.hours === "12") {
      time.ampm = "PM";
    } else if (time.hours === "00") {
      time.hours = "12";
      time.ampm = "AM";
    } else {
      time.ampm = "AM";
    }

    return (time.hours || "12") + ":" + (time.minutes || "00") + " " + time.ampm;
  };

  fx.convertTime = function (value, env) {
    return !env || env.schedule.time24 ? fx.militaryTime(value, env) : fx.regularTime(value, env);
  };

  fx.addWeek = function (date) {
    var now = new Date(date);
    return now.setDate(now.getDate() + 7);
  };

  fx.subtractWeek = function (date) {
    var now = new Date(date);
    return now.setDate(now.getDate() - 7);
  };

  fx.getDateByWeek = getDateByWeek;

  function getDateByWeek(week, year) {
    var d = new Date(year, 0, 1);
    var dayNum = d.getDay();
    var requiredDate = --week * 7;
    if (dayNum !== 0 || dayNum > 4) requiredDate += 7;
    d.setDate(1 - d.getDay() + ++requiredDate);
    return d;
  } // scoreboard


  fx.HHMMSS = function (s, format) {
    var sec_num = parseInt(s, 10); // don't forget the second param

    var hours = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - hours * 3600) / 60);
    var seconds = sec_num - hours * 3600 - minutes * 60;
    var display_seconds = !format || format && format.display_seconds;
    var pad_hours = !format || format && format.pad_hours;

    if (hours < 10 && pad_hours) {
      hours = "0" + hours;
    }

    if (minutes < 10) {
      minutes = "0" + minutes;
    }

    if (seconds < 10) {
      seconds = "0" + seconds;
    }

    return display_seconds ? hours + ":" + minutes + ":" + seconds : hours + ":" + minutes;
  }; // unused


  fx.weekDays = function (date) {
    var dates = [0, 1, 2, 3, 4, 5, 6].map(function (i) {
      return dayOfWeek(date, i);
    });
    return dates;

    function dayOfWeek(date, index) {
      var d = new Date(date);
      var day = d.getDay();
      var diff = index - day;
      return new Date(d.setDate(d.getDate() + diff));
    }
  }; // exportFx


  fx.ymd2date = ymd2date;

  function ymd2date(ymd) {
    var parts = ymd.split("-");
    if (!parts || parts.length !== 3) return new Date(ymd);
    if (isNaN(parseInt(parts[1]))) return new Date(ymd);
    return new Date(parts[0], parseInt(parts[1]) - 1, parts[2]);
  } // ** used frequently


  fx.formatDate = formatDate;

  function formatDate(date, separator, format) {
    if (separator === void 0) {
      separator = "-";
    }

    if (format === void 0) {
      format = "YMD";
    }

    if (!date) return "";
    if (!isNaN(date)) date = fx.offsetTime(date);
    var d = new Date(date);
    var month = "" + (d.getMonth() + 1);
    var day = "" + d.getDate();
    var year = d.getFullYear();
    if (month.length < 2) month = "0" + month;
    if (day.length < 2) day = "0" + day;
    if (format === "DMY") return [day, month, year].join(separator);
    if (format === "MDY") return [month, day, year].join(separator);
    if (format === "YDM") return [year, day, month].join(separator);
    if (format === "DYM") return [day, year, month].join(separator);
    if (format === "MYD") return [month, year, day].join(separator);
    return [year, month, day].join(separator);
  }

  fx.offsetDate = function (date) {
    var targetTime = date ? new Date(date) : new Date();
    var tzDifference = targetTime.getTimezoneOffset();
    return new Date(targetTime.getTime() + tzDifference * 60 * 1000);
  };

  fx.offsetTime = function (date) {
    return fx.offsetDate(date).getTime();
  };

  fx.validDate = function (datestring, range) {
    if (!datestring) return false;
    var dateparts = formatDate(datestring).split("-");
    if (isNaN(dateparts.join(""))) return false;
    if (dateparts.length !== 3) return false;
    if (dateparts[0].length !== 4) return false;
    if (+dateparts[1] > 12 || +dateparts[1] < 1) return false;
    if (+dateparts[2] > 31 || +dateparts[2] < 1) return false;

    if (range && range.start) {
      if (fx.offsetDate(datestring) < fx.offsetDate(range.start)) return false;
    }

    if (range && range.end) {
      if (fx.offsetDate(datestring) > fx.offsetDate(range.end)) return false;
    }

    if (new Date(datestring) === "Invalid Date") return false;
    return true;
  };

  fx.isDate = function (dateArg) {
    if (typeof dateArg == "boolean") return false;
    var t = dateArg instanceof Date ? dateArg : !isNaN(dateArg) ? new Date(dateArg) : false;
    return t && !isNaN(t.valueOf());
  };

  function isValidDateRange(minDate, maxDate) {
    return fx.offsetDate(minDate) <= fx.offsetDate(maxDate);
  }

  fx.timeUTC = function (date) {
    var dateDate = new Date(date);
    return Date.UTC(dateDate.getFullYear(), dateDate.getMonth(), dateDate.getDate());
  };

  fx.dateFromDay = function (year, day) {
    var date = new Date(year, 0); // initialize a date in `year-01-01`

    return new Date(date.setDate(day)); // add the number of days
  };

  fx.randomDate = function (start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  };

  fx.dateRange = function (startDt, endDt) {
    var error = fx.isDate(endDt) && fx.isDate(startDt) && isValidDateRange(startDt, endDt) ? false : true;
    var between = [];
    var iterations = 0;
    var keep_looping = true;

    if (error) {
      console.log("error occured!!!... Please Enter Valid Dates");
    } else {
      var currentDate = fx.offsetDate(startDt);
      var end = fx.offsetDate(endDt);

      while (currentDate <= end && keep_looping) {
        iterations += 1;

        if (iterations > 300) {
          console.log("excessive while loop");
          keep_looping = false;
        } // must be a *new* Date otherwise it is an array of the same object


        between.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    return between;
  }; // unused


  fx.sameDay = function (d1, d2) {
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
  };

  fx.futureDate = function (days) {
    if (days === void 0) {
      days = 1;
    }

    var currentDate = new Date();
    currentDate.setDate(currentDate.getDate() + days);
    return currentDate;
  };

  return fx;
}();

function extractMatchUp(_ref) {
  var _legacyMatch$match, _legacyMatch$format, _legacyMatch$match2, _legacyMatch$match3, _legacyMatch$match4, _legacyMatch$match5;

  var eventType = _ref.eventType,
      seedLimit = _ref.seedLimit,
      tieFormat = _ref.tieFormat,
      entryStage = _ref.entryStage,
      legacyMatch = _ref.legacyMatch,
      participants = _ref.participants,
      matchUpFormat = _ref.matchUpFormat,
      participantIds = _ref.participantIds,
      _ref$drawPositionOffs = _ref.drawPositionOffset,
      drawPositionOffset = _ref$drawPositionOffs === void 0 ? 0 : _ref$drawPositionOffs,
      tournamentEngine = _ref.tournamentEngine;
  var matchUpId = ((_legacyMatch$match = legacyMatch.match) == null ? void 0 : _legacyMatch$match.muid) || legacyMatch.muid;
  var sides = [];
  var entries = [];
  var seedAssignments = [];
  var missingParticipants = [];
  var positionAssignments = [];
  var isBye = false;

  if (Array.isArray(legacyMatch.teams)) {
    legacyMatch.teams.forEach(function (team, index) {
      if (!(team != null && team.length)) return;
      var participantId;
      var individualParticipantIds = team.map(function (player) {
        return player == null ? void 0 : player.id;
      }).filter(function (f) {
        return f;
      });
      var player1 = team && team[0] && typeof team[0] === "object" && team[0];
      var player2 = team && team[1] && typeof team[1] === "object" && team[1];
      var drawPosition = ((player1 == null ? void 0 : player1.draw_position) || (player2 == null ? void 0 : player2.draw_position)) + drawPositionOffset;
      var seed = player1 == null ? void 0 : player1.seed;
      var bye = player1 == null ? void 0 : player1.bye;

      if (individualParticipantIds.length === 1) {
        participantId = individualParticipantIds[0];
      }

      if (individualParticipantIds.length === 2) {
        var _participant;

        var _tournamentEngine$get = tournamentEngine.getPairedParticipant({
          participantIds: individualParticipantIds
        }),
            participant = _tournamentEngine$get.participant;

        if (!participant) {
          var _tournamentEngine$add = tournamentEngine.addParticipant({
            participant: {
              participantType: "PAIR",
              participantRole: "COMPETITOR",
              individualParticipantIds: [player1.id, player2.id]
            }
          });

          participant = _tournamentEngine$add.participant;
          missingParticipants.push(participant);
        }

        participantId = (_participant = participant) == null ? void 0 : _participant.participantId;
      }

      var side = {
        sideNumber: index + 1
      };
      if (drawPosition) side.drawPosition = drawPosition;

      if (bye) {
        side.bye = bye;
        isBye = true;
      }

      if (participantId) {
        side.participantId = participantId;
      }

      sides.push(side);

      if (participantId && !participantIds.includes(participantId)) {
        participantIds.push(participantId);
        var entry = {
          entryStage: entryStage,
          participantId: participantId,
          entryStatus: entryStatusConstants.DIRECT_ACCEPTANCE
        };
        entries.push(entry);
        var positionAssignment = {
          drawPosition: drawPosition,
          participantId: participantId
        };
        positionAssignments.push(positionAssignment);

        if (seed && seed <= seedLimit) {
          var seedAssignment = {
            seedNumber: seed,
            seedValue: seed,
            // TODO: check whether there is a seed display value in TMX 1.9
            participantId: participantId
          };
          seedAssignments.push(seedAssignment);
        }
      } else if (bye) {
        var _positionAssignment = {
          drawPosition: drawPosition,
          bye: bye
        };
        positionAssignments.push(_positionAssignment);
      }
    });
  }

  var matchUpType = eventType === "TEAM" ? (_legacyMatch$format = legacyMatch.format) == null ? void 0 : _legacyMatch$format.toUpperCase() : eventType;
  var collectionDefinition = tieFormat == null ? void 0 : tieFormat.collectionDefinitions.find(function (collectionDefinition) {
    return collectionDefinition.matchUpType === matchUpType;
  });
  var collectionId = collectionDefinition == null ? void 0 : collectionDefinition.collectionId;
  var scoreString = ((_legacyMatch$match2 = legacyMatch.match) == null ? void 0 : _legacyMatch$match2.score) || legacyMatch.score || "";
  var reversedScoreString = reverseScore(scoreString) || "";
  var winner_index = ((_legacyMatch$match3 = legacyMatch.match) == null ? void 0 : _legacyMatch$match3.winner_index) !== undefined && legacyMatch.match.winner_index;
  if (![0, 1].includes(parseInt(winner_index))) winner_index = legacyMatch.winner_index;
  var winner = [0, 1].includes(parseInt(winner_index));
  var winningSide = winner && winner_index + 1 || undefined;
  var scoreStringSide1 = matchTiebreakTODS(!winner || winningSide === 1 ? scoreString : reversedScoreString);
  var scoreStringSide2 = matchTiebreakTODS(!winner || winningSide === 1 ? reversedScoreString : scoreString);
  var sets = mocksEngine.parseScoreString({
    scoreString: scoreStringSide1
  });
  var score = {
    scoreStringSide1: scoreStringSide1,
    scoreStringSide2: scoreStringSide2,
    sets: sets
  };
  var time = scoreString.indexOf("TIME") > 0;
  var live = scoreString.indexOf("LIVE") > 0;
  var interrupted = scoreString.indexOf("INT") > 0;
  var incomplete = scoreString.indexOf("INC") > 0;
  var walkover = scoreString.indexOf("W.O.") >= 0;
  var cancelled = scoreString.indexOf("CCL") >= 0;
  var abandoned = scoreString.indexOf("ABD") >= 0;
  var defaulted = scoreString.indexOf("DEF") >= 0;
  var retired = scoreString.indexOf("RET") > 0;
  var matchUpStatus = live && matchUpStatusConstants.IN_PROGRESS || interrupted && matchUpStatusConstants.SUSPENDED || incomplete && matchUpStatusConstants.INCOMPLETE || walkover && matchUpStatusConstants.WALKOVER || cancelled && matchUpStatusConstants.NOT_PLAYED || abandoned && matchUpStatusConstants.ABANDONED || defaulted && matchUpStatusConstants.DEFAULTED || retired && matchUpStatusConstants.RETIRED || isBye && matchUpStatusConstants.BYE || winningSide && matchUpStatusConstants.COMPLETED || time && matchUpStatusConstants.COMPLETED || !winningSide && matchUpStatusConstants.TO_BE_PLAYED;
  var timeItems = getTimeItems({
    participants: participants,
    legacyMatch: legacyMatch
  });
  var matchUp = {
    matchUpId: matchUpId,
    score: score
  };
  var drawPositions = sides == null ? void 0 : sides.map(function (side) {
    return side.drawPosition;
  }).filter(function (f) {
    return f;
  });
  if (drawPositions != null && drawPositions.length) matchUp.drawPositions = drawPositions;
  if (sides != null && sides.length) matchUp.sides = sides;
  if (matchUpType) matchUp.matchUpType = matchUpType;
  if (winningSide) matchUp.winningSide = winningSide;
  if (timeItems != null && timeItems.length) matchUp.timeItems = timeItems;
  if (collectionId) matchUp.collectionId = collectionId;
  if (matchUpStatus) matchUp.matchUpStatus = matchUpStatus;
  var format = ((_legacyMatch$match4 = legacyMatch.match) == null ? void 0 : _legacyMatch$match4.score_format) || legacyMatch.score_format;
  var formatCode = format && matchFormatCode.stringify(scoreFormat.jsonTODS(format));
  matchUpFormat = ((_legacyMatch$match5 = legacyMatch.match) == null ? void 0 : _legacyMatch$match5.matchFormat) || matchUpFormat;
  if (formatCode || matchUpFormat) matchUp.matchUpFormat = formatCode || matchUpFormat;
  var collectionPosition = legacyMatch.sequence;

  if (collectionPosition) {
    matchUp.collectionPosition = collectionPosition;
  }

  return {
    matchUp: matchUp,
    entries: entries,
    seedAssignments: seedAssignments,
    positionAssignments: positionAssignments,
    missingParticipants: missingParticipants
  };
}

function getTimeItems(_ref2) {
  var _legacyMatch$match6, _legacyMatch$match7;

  var participants = _ref2.participants,
      legacyMatch = _ref2.legacyMatch;
  var timeItems = [];
  var schedule = ((_legacyMatch$match6 = legacyMatch.match) == null ? void 0 : _legacyMatch$match6.schedule) || legacyMatch.schedule || {};
  var umpire = ((_legacyMatch$match7 = legacyMatch.match) == null ? void 0 : _legacyMatch$match7.umpire) || legacyMatch.umpire;

  if (schedule.luid && schedule.index) {
    var timeItem = {
      itemType: "SCHEDULE.ASSIGNMENT.VENUE",
      itemValue: schedule.luid,
      timeStamp: new Date().toISOString() // TODO: should be the start date of the tournament

    };
    timeItems.push(timeItem);
    timeItem = {
      itemType: "SCHEDULE.ASSIGNMENT.COURT",
      itemValue: schedule.luid + "|" + (parseInt(schedule.index) - 1),
      timeStamp: new Date().toISOString() // TODO: should be the start date of the tournament

    };
    timeItems.push(timeItem);
  }

  if (schedule.day) {
    var _timeItem = {
      itemType: "SCHEDULED.DATE",
      itemValue: schedule.day,
      timeStamp: new Date().toISOString() // TODO: should be the start date of the tournament

    };
    timeItems.push(_timeItem);

    if (schedule.start) {
      var startTime = properTime(schedule.start);
      var startDateTime = dateFx.formatDate(schedule.day) + "T" + startTime;
      var _timeItem2 = {
        itemType: "SCHEDULE.TIME.START",
        itemValue: new Date(startDateTime).toISOString(),
        timeStamp: new Date().toISOString() // TODO: should be the start date of the tournament

      };
      timeItems.push(_timeItem2);
    }

    if (schedule.end) {
      var endTime = properTime(schedule.end);
      var endDateTime = dateFx.formatDate(schedule.day) + "T" + endTime;
      var _timeItem3 = {
        itemType: "SCHEDULE.TIME.END",
        itemValue: new Date(endDateTime).toISOString(),
        timeStamp: new Date().toISOString() // TODO: should be the start date of the tournament

      };
      timeItems.push(_timeItem3);
    }
  }

  if (schedule.time) {
    var itemValue = properTime(schedule.time);
    var _timeItem4 = {
      itemType: "SCHEDULE.TIME.SCHEDULED",
      itemValue: itemValue,
      timeStamp: new Date().toISOString() // TODO: should be the start date of the tournament

    };
    timeItems.push(_timeItem4);
  }

  if (umpire) {
    var tournamentOfficials = participants == null ? void 0 : participants.filter(function (participant) {
      return participant.participantType === participantConstants.INDIVIDUAL && participant.participantRole === participantRoles.OFFICIAL;
    });
    var official = tournamentOfficials.find(function (official) {
      return official.name === umpire;
    });

    var _itemValue = official == null ? void 0 : official.participantId;

    var _timeItem5 = {
      itemType: "SCHEDULE.ASSIGNMENT.OFFICIAL",
      itemValue: _itemValue,
      timeStamp: new Date().toISOString() // TODO: should be the start date of the tournament

    };
    if (_itemValue) timeItems.push(_timeItem5);
  }

  return timeItems;
}

function properTime(time) {
  var military = dateFx.militaryTime(time);

  var zeroPad = function zeroPad(number) {
    return number.toString()[1] ? number : "0" + number;
  };

  return military.split(":").map(function (part) {
    return zeroPad(part);
  }).join(":");
}

function matchTiebreakTODS(score) {
  if (score === void 0) {
    score = "";
  }

  return score.split(" ").map(function (set) {
    return set.includes("/") ? matchTiebreak(set) : set;
  }).join(" ");

  function matchTiebreak(set) {
    return "[" + set.split("/").join("-") + "]";
  }
}

function reverseScore(score, split) {
  if (split === void 0) {
    split = " ";
  }

  var irreversible = null;

  if (score) {
    var reversed = score.split(split).map(parseSet).join(split);
    var result = irreversible ? irreversible + " " + reversed : reversed;
    return result;
  }

  function parseSet(set) {
    var divider = set.indexOf("/") > 0 ? "/" : "-";
    var set_scores = set.split(divider).map(parseSetScore).reverse().filter(function (f) {
      return f;
    });
    var set_games = set_scores.map(function (s) {
      return s.games;
    });
    var tb_scores = set_scores.map(function (s) {
      return s.tiebreak;
    }).filter(function (f) {
      return f;
    });
    var tiebreak = tb_scores.length === 1 ? "(" + tb_scores[0] + ")" : "";
    var set_score = tb_scores.length < 2 ? set_games.join(divider) : set_games.map(function (s, i) {
      return s + "(" + tb_scores[i] + ")";
    }).join(divider);
    return "" + set_score + tiebreak;
  }

  function parseSetScore(set) {
    var ss = /(\d+)/;
    var sst = /(\d+)\((\d+)\)/;
    if (sst.test(set)) return {
      games: sst.exec(set)[1],
      tiebreak: sst.exec(set)[2]
    };
    if (ss.test(set)) return {
      games: ss.exec(set)[1]
    };
    irreversible = set;
    return undefined;
  }
}

var surfaceCategoryMap = {
  C: "CLAY",
  H: "HARD",
  G: "GRASS",
  R: "CARPET"
};
function getSurface(element) {
  return surfaceCategoryMap[element == null ? void 0 : element.surface];
}
function getIndoorOutdoor(element) {
  return (element == null ? void 0 : element.inout) === "o" && "OUTDOOR" || (element == null ? void 0 : element.inout) === "i" && "INDOOR";
}
function intersection(a, b) {
  return a.filter(function (n) {
    return b.indexOf(n) !== -1;
  }).filter(function (e, i, c) {
    return c.indexOf(e) === i;
  });
}
function getAgeCategoryCode(category) {
  var categoryCodeMap = {
    U10: "10U",
    U12: "12U",
    U14: "14U",
    U16: "16U",
    U18: "18U",
    10: "10U",
    12: "12U",
    14: "14U",
    16: "16U",
    18: "18U",
    Senior: "O18"
  };
  return categoryCodeMap[category];
}
function getMatchUpType(format) {
  return ["S", "SINGLES"].includes(format.toUpperCase()) && eventConstants.SINGLES || ["D", "DOUBLES"].includes(format.toUpperCase()) && eventConstants.DOUBLES;
}
function getGender(value) {
  if (!value) return genderConstants.MIXED;
  if (["F", "FEMALE", "W", "WOMAN"].includes(value.toUpperCase())) return genderConstants.FEMALE;
  if (["M", "MALE", "MAN"].includes(value.toUpperCase())) return genderConstants.MALE;
  return genderConstants.MIXED;
}
function getStage(_ref) {
  var legacyEvent = _ref.legacyEvent;
  var stageMap = {
    E: drawDefinitionConstants.MAIN,
    Q: drawDefinitionConstants.QUALIFYING,
    S: drawDefinitionConstants.MAIN,
    C: drawDefinitionConstants.CONSOLATION,
    P: drawDefinitionConstants.PLAY_OFF,
    A: drawDefinitionConstants.MAIN
  };

  if (legacyEvent.draw_type === "R") {
    if (Object.keys(legacyEvent.links || {}).includes("E")) {
      return drawDefinitionConstants.QUALIFYING;
    } else {
      return drawDefinitionConstants.MAIN;
    }
  }

  return stageMap[legacyEvent.draw_type];
}

var typeCheck = /*#__PURE__*/function () {
  var tc = {};
  var FEED = "feed";
  var SINGLES = "singles";
  var DOUBLES = "doubles";
  var BACKDRAW = "backdraw";

  tc.isActiveEvent = function (_ref) {
    var e = _ref.e;
    return e && e.active;
  };

  tc.isAdHoc = function (_ref2) {
    var e = _ref2.e;
    return e && e.draw_type && e.draw_type === "A";
  };

  tc.isPlayoff = function (_ref3) {
    var e = _ref3.e;
    return e && e.draw_type && e.draw_type === "P";
  };

  tc.isQualifying = function (_ref4) {
    var e = _ref4.e;
    return e && e.draw_type && e.draw_type === "Q";
  };

  tc.isRoundRobin = function (_ref5) {
    var e = _ref5.e;
    return e && e.draw_type && e.draw_type === "R";
  };

  tc.isConsolation = function (_ref6) {
    var e = _ref6.e;
    return e && e.draw_type && e.draw_type === "C";
  };

  tc.isElimination = function (_ref7) {
    var e = _ref7.e;
    return e && e.draw_type && e.draw_type === "E";
  };

  tc.hasEliminationStructure = function (_ref8) {
    var e = _ref8.e;
    return e && e.draw_type && ["E", "Q", "C", "P", "S"].indexOf(e.draw_type) >= 0;
  };

  tc.isCompass = function (_ref9) {
    var e = _ref9.e;
    return e && (e.draw_type && ["S", "O"].indexOf(e.draw_type) >= 0 || e.direction || e.draw && e.draw.compass);
  };

  tc.isFeedIn = function (_ref10) {
    var e = _ref10.e,
        value = _ref10.value;
    return value && value === FEED || e && e.structure && e.structure === FEED;
  };

  tc.isBackdraw = function (_ref11) {
    var e = _ref11.e,
        value = _ref11.value;
    return value && value === BACKDRAW || e && e.structure && e.structure === BACKDRAW;
  };

  tc.hasRoundNames = function (_ref12) {
    var e = _ref12.e;
    return e && e.draw_type && ["E", "S", "C", "O"].indexOf(e.draw_type) >= 0;
  };

  tc.isConsolationFeedIn = function (_ref13) {
    var e = _ref13.e;
    return tc.isConsolation({
      e: e
    }) && tc.isFeedIn({
      e: e
    });
  };

  tc.isConsolationBackdraw = function (_ref14) {
    var e = _ref14.e;
    return tc.isConsolation({
      e: e
    }) && tc.isBackdraw({
      e: e
    });
  };

  tc.isConsolationFixed = function (_ref15) {
    var e = _ref15.e;
    return tc.isConsolation({
      e: e
    }) && (tc.isFeedIn({
      e: e
    }) || tc.isBackdraw({
      e: e
    }));
  };

  tc.isSingles = function (_ref16) {
    var e = _ref16.e,
        match = _ref16.match;
    if (e) return e.format && (e.format === "S" || e.format.toLowerCase() === SINGLES);
    if (match) return match.format && (match.format === "S" || match.format.toLowerCase() === SINGLES);
  };

  tc.isDoubles = function (_ref17) {
    var e = _ref17.e,
        match = _ref17.match;
    if (e) return e.format && (e.format === "D" || e.format.toLowerCase() === DOUBLES);
    if (match) return match.format && (match.format === "D" || match.format.toLowerCase() === DOUBLES);
  };

  tc.isTeam = function (_ref18) {
    var tournament = _ref18.tournament,
        e = _ref18.e;
    if (tournament && tournament.type) return ["team", "dual"].indexOf(tournament.type) >= 0;
    var dual_draw = e && e.draw && e.draw.dual_matches;
    return e && (dual_draw || e.event_type === "dual");
  };

  tc.isPreRound = function (_ref19) {
    var env = _ref19.env,
        e = _ref19.e;
    var qualifying_bracket_seeding = env && env.drawFx && env.drawFx.qualifying_bracket_seeding;
    return tc.isQualifying({
      e: e
    }) && e.approved && e.approved.length && +e.qualifiers === e.draw_size / 2 && qualifying_bracket_seeding;
  };

  return tc;
}();

function courtData(tournament, luid, max_matches_per_court) {
  if (max_matches_per_court === void 0) {
    max_matches_per_court = 14;
  }

  var courts = [];
  safeArr(tournament.locations).forEach(function (l) {
    var identifiers = l.identifiers ? l.identifiers.split(",") : [];

    if (!luid || luid === l.luid) {
      range(1, +l.courts + 1).forEach(function (index) {
        var identifier = identifiers[index - 1] || index;
        var court = {
          luid: l.luid,
          name: l.abbreviation + " " + identifier,
          availability: range(1, max_matches_per_court + 1),
          index: index
        };
        courts.push(court);
      });
    }
  });
  return courts;
}
function ctuuid(schedule) {
  return schedule ? schedule.luid + "|" + schedule.index : "";
}

function safeArr(x) {
  return Array.isArray(x) && x || typeof x === "object" && Object.keys(x).map(function (k) {
    return x[k];
  }) || [];
}

function range(start, end) {
  return Array.from({
    length: end - start
  }, function (v, k) {
    return k + start;
  });
}

var scoreFx = /*#__PURE__*/function () {
  var fx = {};

  function validInt(value, invalid) {
    var result = parseInt(value);
    return isNaN(result) ? invalid : result;
  } // target is an object which *must* have all keys defined.
  // preference is given to the *first* object processed


  function assignKeys(_ref) {
    var _ref$source = _ref.source,
        source = _ref$source === void 0 ? {} : _ref$source,
        _ref$objects = _ref.objects,
        objects = _ref$objects === void 0 ? [] : _ref$objects;
    var target = Object.assign({}, source);
    if (objects && !Array.isArray(objects)) objects = [objects];
    objects = objects.filter(function (f) {
      return f;
    });
    objects.forEach(function (o) {
      if (typeof o !== "object") return;
      var keys = Object.keys(o);
      keys.forEach(function (k) {
        return target[k] = target[k] !== undefined ? target[k] : o[k];
      });
    });
    return target;
  }

  fx.setsToWin = function (best_of) {
    return best_of && Math.ceil(best_of / 2) || 1;
  };

  fx.tiebreakTo = function (o, isFinalSet) {
    var setTiebreakTo = o && o.setFormat && o.setFormat.tiebreakFormat && o.setFormat.tiebreakFormat.tiebreakTo;
    var finalSetTiebreakTo = o && o.finalSetFormat && o.finalSetFormat.tiebreakFormat && o.finalSetFormat.tiebreakFormat.tiebreakTo;
    return isFinalSet ? finalSetTiebreakTo : setTiebreakTo;
  };

  fx.matchFormat = matchFormat;

  function matchFormat(matchFormat) {
    return (matchFormat || "SET3-S:6/TB7").slice(3);
  }

  fx.getExistingScores = function (_ref2) {
    var match = _ref2.match;
    if (!match || !match.score) return undefined;
    var es = convertStringScore({
      string_score: match.score,
      winner_index: match.winner_index,
      matchFormat: match.matchFormat
    });
    return es;
  };

  fx.generateMatchFormat = function (_ref3) {
    var cfg_obj = _ref3.cfg_obj;
    var bestof = cfg_obj.bestof.ddlb.getValue();
    var max_sets = validInt(bestof);
    var sets_to_win = scoreFx.setsToWin(max_sets);
    var score_format = {
      max_sets: max_sets,
      sets_to_win: sets_to_win,
      games_for_set: validInt(cfg_obj.setsto.ddlb.getValue()),
      tiebreaks_at: validInt(cfg_obj.tiebreaksat.ddlb.getValue()) || "",
      // only option that can be 'none'
      tiebreak_to: validInt(cfg_obj.tiebreaksto.ddlb.getValue()),
      supertiebreak_to: validInt(cfg_obj.supertiebreakto.ddlb.getValue()),
      final_set_supertiebreak: cfg_obj.finalset.ddlb.getValue() === "N" ? false : true
    };
    var matchFormat = matchFormatCode.stringify(scoreFormat.jsonTODS(score_format));
    return {
      matchFormat: matchFormat,
      score_format: score_format
    };
  };

  fx.getScoringFormat = function (_ref4) {
    var e = _ref4.e,
        match = _ref4.match;
    var format = match && match.format || (e.format === "D" ? "doubles" : "singles");
    var objects = [match && match.score_format, match && match.match && match.match.score_format, e.scoring_format && e.scoring_format[format], e.score_format];
    var score_format = assignKeys({
      objects: objects
    });
    return score_format;
  };

  fx.defaultMatchFormat = function (_ref5) {
    var format = _ref5.format,
        category = _ref5.category,
        env = _ref5.env;
    var matchFormats = env.scoreboard.matchFormats;
    var formats = {
      S: "singles",
      D: "doubles"
    };
    if (Object.keys(formats).indexOf(format) >= 0) format = formats[format];
    if (format && category && matchFormats.categories[category] && matchFormats.categories[category][format]) return matchFormats.categories[category][format];
    if (format && matchFormats[format]) return matchFormats[format];
    return matchFormats.singles;
  };

  fx.convertStringScore = convertStringScore;

  function convertStringScore(_ref6) {
    var string_score = _ref6.string_score,
        winner_index = _ref6.winner_index,
        _ref6$split = _ref6.split,
        split = _ref6$split === void 0 ? " " : _ref6$split,
        matchFormat = _ref6.matchFormat;
    if (!string_score) return [];
    string_score = winner_index ? reverseScore(string_score) : string_score;
    var outcome = null;
    var ss = /(\d+)/;
    var sst = /(\d+)\((\d+)\)/;
    var match_format = matchFormatCode.parse(matchFormat);
    var sets = string_score.split(split).filter(function (f) {
      return f;
    }).map(function (set) {
      if (set.indexOf("/") > 0) {
        // look for supertiebreak scores using #/# format
        var _scores = set.split("/").map(function (m) {
          return ss.exec(m) ? {
            games: +ss.exec(m)[1]
          } : undefined;
        }).filter(function (f) {
          return f;
        });

        if (_scores.length === 2) return _scores;
      } // uglifier doesn't work if variable is undefined


      var tbscore = null;
      var scores = set.split("-").map(function (m) {
        var score;

        if (sst.test(m)) {
          tbscore = +sst.exec(m)[2];
          score = {
            games: +sst.exec(m)[1]
          };
        } else if (ss.test(m)) {
          score = {
            games: +ss.exec(m)[1]
          };
        } else {
          outcome = m;
        }

        return score || undefined;
      }); // filter out undefined scores

      scores = scores.filter(function (f) {
        return f;
      }); // add spacer for score without tiebreak score

      if (tbscore !== null) {
        var min_games = Math.min.apply(Math, scores.map(function (s) {
          return s.games;
        }));
        scores.forEach(function (sf) {
          if (+sf.games === +min_games) {
            sf.tiebreak = tbscore;
          } else {
            sf.spacer = tbscore;
          }
        });
      }

      return scores;
    }); // filter out sets without two scores

    sets = sets.filter(function (scores) {
      return scores && scores.length === 2;
    }); // determine if set is supertiebreak

    sets.forEach(function (st, i) {
      var set_format = match_format && (match_format.finalSetFormat || match_format.setFormat);
      var supertiebreak_to = set_format && set_format.tiebreakSet && set_format.tiebreakSet.tiebreakTo;

      if (st[0].games >= supertiebreak_to || st[1].games >= supertiebreak_to) {
        st[0].supertiebreak = st[0].games;
        st[1].supertiebreak = st[1].games;
        delete st[0].games;
        delete st[1].games;
      }
    });

    if (winner_index !== undefined) {
      sets.winner_index = winner_index;
    }

    if (outcome) {
      if (outcome === "Cancelled") sets.cancelled = true;
      if (outcome === "Abandoned") sets.abandoned = true;
      if (outcome === "INC.") sets.incomplete = true;
      if (outcome === "INT.") sets.interrupted = true;
      if (outcome === "LIVE") sets.live = true;
      if (outcome === "TIME") sets.time = true;
      if (outcome === "DEF.") sets["default"] = true;
      if (outcome === "W.O.") sets.walkover = true;
      if (!sets.length) return sets; // passing additional detail from string parse...

      if (winner_index !== undefined) {
        // outcomes are attributed to loser...
        sets[sets.length - 1][1 - winner_index].outcome = outcome; // and set as attribute on set

        sets[sets.length - 1].outcome = outcome;
        sets.outome = outcome;
      }
    }

    return sets;
  }

  fx.reverseScore = reverseScore;

  function reverseScore(score, split) {
    if (split === void 0) {
      split = " ";
    }

    var irreversible = null;

    if (score) {
      var reversed = score.split(split).map(parseSet).join(split);
      var result = irreversible ? irreversible + " " + reversed : reversed;
      return result;
    }

    function parseSet(set) {
      var divider = set.indexOf("/") > 0 ? "/" : "-";
      var set_scores = set.split(divider).map(parseSetScore).reverse().filter(function (f) {
        return f;
      });
      var set_games = set_scores.map(function (s) {
        return s.games;
      });
      var tb_scores = set_scores.map(function (s) {
        return s.tiebreak;
      }).filter(function (f) {
        return f;
      });
      var tiebreak = tb_scores.length === 1 ? "(" + tb_scores[0] + ")" : "";
      var set_score = tb_scores.length < 2 ? set_games.join(divider) : set_games.map(function (s, i) {
        return s + "(" + tb_scores[i] + ")";
      }).join(divider);
      return "" + set_score + tiebreak;
    }

    function parseSetScore(set) {
      var ss = /(\d+)/;
      var sst = /(\d+)\((\d+)\)/;
      if (sst.test(set)) return {
        games: sst.exec(set)[1],
        tiebreak: sst.exec(set)[2]
      };
      if (ss.test(set)) return {
        games: ss.exec(set)[1]
      };
      irreversible = set;
      return undefined;
    }
  }

  return fx;
}();

/**
 * Fast UUID generator, RFC4122 version 4 compliant.
 * @author Jeff Ward (jcward.com).
 * @license MIT license
 * @link http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript/21963136#21963136
 * ... and ...
 * https://codepen.io/avesus/pen/wgQmaV
 **/
var UUID = /*#__PURE__*/function () {
  var self = {};
  var lut = [];

  for (var i = 0; i < 256; i++) {
    lut[i] = (i < 16 ? "0" : "") + /*#__PURE__*/i.toString(16);
  }

  var getWindow = function getWindow() {
    try {
      return window;
    } catch (e) {
      return undefined;
    }
  };

  var formatUuid = function formatUuid(_ref) {
    var d0 = _ref.d0,
        d1 = _ref.d1,
        d2 = _ref.d2,
        d3 = _ref.d3;
    return (// eslint-disable-next-line no-mixed-operators
      lut[d0 & 0xff] + lut[d0 >> 8 & 0xff] + lut[d0 >> 16 & 0xff] + lut[d0 >> 24 & 0xff] + "-" + // eslint-disable-next-line no-mixed-operators
      lut[d1 & 0xff] + lut[d1 >> 8 & 0xff] + "-" + // eslint-disable-next-line no-mixed-operators
      lut[d1 >> 16 & 0x0f | 0x40] + lut[d1 >> 24 & 0xff] + "-" + // eslint-disable-next-line no-mixed-operators
      lut[d2 & 0x3f | 0x80] + lut[d2 >> 8 & 0xff] + "-" + // eslint-disable-next-line no-mixed-operators
      lut[d2 >> 16 & 0xff] + lut[d2 >> 24 & 0xff] + // eslint-disable-next-line no-mixed-operators
      lut[d3 & 0xff] + lut[d3 >> 8 & 0xff] + // eslint-disable-next-line no-mixed-operators
      lut[d3 >> 16 & 0xff] + lut[d3 >> 24 & 0xff]
    );
  };

  var getRandomValuesFunc = /*#__PURE__*/getWindow() && /*#__PURE__*/getWindow().crypto && /*#__PURE__*/getWindow().crypto.getRandomValues ? function () {
    var dvals = new Uint32Array(4);
    getWindow().crypto.getRandomValues(dvals);
    return {
      d0: dvals[0],
      d1: dvals[1],
      d2: dvals[2],
      d3: dvals[3]
    };
  } : function () {
    return {
      d0: Math.random() * 0x100000000 >>> 0,
      d1: Math.random() * 0x100000000 >>> 0,
      d2: Math.random() * 0x100000000 >>> 0,
      d3: Math.random() * 0x100000000 >>> 0
    };
  };

  self["new"] = function () {
    return formatUuid(getRandomValuesFunc());
  };

  self.idGen = function () {
    return "u_" + self.generate();
  };

  self.generate = function () {
    var d0 = Math.random() * 0xffffffff | 0;
    var d1 = Math.random() * 0xffffffff | 0;
    var d2 = Math.random() * 0xffffffff | 0;
    var d3 = Math.random() * 0xffffffff | 0; // eslint-disable-next-line no-mixed-operators

    return lut[d0 & 0xff] + lut[d0 >> 8 & 0xff] + lut[d0 >> 16 & 0xff] + lut[d0 >> 24 & 0xff] + "-" + // eslint-disable-next-line no-mixed-operators
    lut[d1 & 0xff] + lut[d1 >> 8 & 0xff] + "-" + lut[d1 >> 16 & 0x0f | 0x40] + lut[d1 >> 24 & 0xff] + "-" + // eslint-disable-next-line no-mixed-operators
    lut[d2 & 0x3f | 0x80] + lut[d2 >> 8 & 0xff] + "-" + lut[d2 >> 16 & 0xff] + lut[d2 >> 24 & 0xff] + // eslint-disable-next-line no-mixed-operators
    lut[d3 & 0xff] + lut[d3 >> 8 & 0xff] + lut[d3 >> 16 & 0xff] + lut[d3 >> 24 & 0xff];
  };

  return self;
}();

/* To convert tmx 1.0 draw into tmx 2.0 draw nuids need to be added to all
 * nodes and array of opponent ids needs to be added to deepest nodes.
 */

function playersHash(players) {
  return players.map(function (p) {
    return p && p.id;
  }).filter(function (f) {
    return f;
  }).sort().join("-");
}

function drawFx(opts) {
  var fx = {};

  var numArr = function numArr(count) {
    return [].concat(Array(count)).map(function (_, i) {
      return i;
    });
  };

  var unique = function unique(arr) {
    return arr.filter(function (item, i, s) {
      return s.lastIndexOf(item) === +i;
    });
  };

  var range = function range(start, end) {
    return Array.from({
      length: end - start
    }, function (v, k) {
      return k + start;
    });
  };

  var indices = function indices(val, arr) {
    return arr.reduce(function (a, e, i) {
      if (e === val) a.push(i);
      return a;
    }, []);
  };

  var occurrences = function occurrences(val, arr) {
    return arr.reduce(function (r, val) {
      r[val] = 1 + r[val] || 1;
      return r;
    }, {})[val] || 0;
  };

  var intersection = function intersection(a, b) {
    return a.filter(function (n) {
      return b.indexOf(n) !== -1;
    }).filter(function (e, i, c) {
      return c.indexOf(e) === i;
    });
  };

  var randomPop = function randomPop(array) {
    return array.length ? array.splice(Math.floor(Math.random() * array.length), 1)[0] : undefined;
  };

  var subSort = function subSort(arr, i, n, sortFx) {
    var _ref;

    return (_ref = []).concat.apply(_ref, arr.slice(0, i).concat(arr.slice(i, i + n).sort(sortFx), arr.slice(i + n, arr.length)));
  };

  var standard_draws = [2, 4, 8, 16, 32, 64, 128, 256, 512]; // removed 224 because compressed draws blowing up beyond 128

  var draw_sizes = [2, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 256, 512];

  var validDrawSize = function validDrawSize(players) {
    return draw_sizes.indexOf(players) >= 0;
  };

  var o = {
    rr_h2h_priority: false,
    compressed_draw_formats: true,
    compressed: {
      byes_adjacent_to_seeds: false
    },
    seedBlocks: [[1], [2], [3, 4], [5, 8], [9, 16], [17, 32], [33, 64]],
    seed_limits: [[0, 0], [4, 2], [11, 4], [21, 8], [41, 16], [97, 32], [193, 64]],
    bye_placement: {
      8: [2, 7, 5],
      16: [2, 15, 11, 6, 7, 10, 14],
      32: [2, 31, 23, 10, 15, 18, 26, 7, 6, 27, 19, 14, 11, 22, 30],
      64: [2, 63, 47, 18, 31, 34, 50, 15, 10, 55, 39, 26, 23, 42, 58, 7, 5, 60, 44, 21, 28, 37, 53, 12, 13, 52, 36, 29, 20, 45, 61],
      128: [2, 127, 31, 34, 63, 66, 95, 98, 15, 18, 47, 50, 79, 82, 111, 114, 7, 10, 23, 26, 39, 42, 55, 58, 71, 74, 87, 90, 103, 106, 119, 122],
      256: [2, 255, 63, 66, 127, 130, 191, 194, 31, 34, 95, 98, 159, 162, 223, 226, 15, 18, 47, 50, 79, 82, 111, 114, 143, 146, 175, 178, 207, 210, 239, 242, 7, 10, 23, 26, 39, 42, 55, 58, 71, 74, 87, 90, 103, 106, 119, 122, 135, 138, 151, 154, 167, 170, 183, 186, 199, 202, 215, 218, 231, 234, 247, 250]
    },
    seedPositions: {
      1: [["1", "0"]],
      2: [["0", "1"]],
      3: [["1", ".250"], ["0", ".750"]],
      5: [["0", ".250"], ["0", ".500"], ["1", ".500"], ["1", ".750"]],
      9: [["1", ".125"], ["0", ".375"], ["1", ".625"], ["0", ".875"], ["0", ".125"], ["1", ".375"], ["0", ".625"], ["1", ".875"]],
      13: [],
      17: [["1", ".0625"], ["0", ".1875"], ["1", ".3125"], ["0", ".4375"], ["1", ".5625"], ["0", ".6875"], ["1", ".8125"], ["0", ".9375"], ["0", ".0625"], ["1", ".1875"], ["0", ".3125"], ["1", ".4375"], ["0", ".5625"], ["1", ".6875"], ["0", ".8125"], ["1", ".9375"]],
      25: [],
      33: [["1", ".03125"], ["0", ".09375"], ["1", ".15625"], ["0", ".21875"], ["1", ".28125"], ["0", ".34375"], ["1", ".40625"], ["0", ".46875"], ["1", ".53125"], ["0", ".59375"], ["1", ".65625"], ["0", ".71875"], ["1", ".78125"], ["0", ".84375"], ["1", ".90625"], ["0", ".96875"], ["0", ".03125"], ["1", ".09375"], ["0", ".15625"], ["1", ".21875"], ["0", ".28125"], ["1", ".34375"], ["0", ".40625"], ["1", ".46875"], ["0", ".53125"], ["1", ".59375"], ["0", ".65625"], ["1", ".71875"], ["0", ".78125"], ["1", ".84375"], ["0", ".90625"], ["1", ".96875"]],
      49: []
    },
    separation: {
      team: true
    }
  };
  if (opts) keyWalk(opts, o);

  fx.options = function (options) {
    if (!options) return o;
    keyWalk(options, o);
  };

  fx.acceptedDrawSizes = acceptedDrawSizes;

  function acceptedDrawSizes(_ref2) {
    var num_players = _ref2.num_players,
        standardSizes = _ref2.standardSizes,
        forceCompressed = _ref2.forceCompressed;
    if (!num_players || num_players < 2) return 0;
    var d = 0;

    while (draw_sizes[d] < num_players) {
      d += 1;
    }

    var s = 0;

    while (standard_draws[s] < num_players) {
      s += 1;
    }

    if (standardSizes) return standard_draws[s]; // otherwise check the settings for desired draw structure
    // added 128 limit because compressed draws > 128 blowing up

    return (forceCompressed || o.compressed_draw_formats) && num_players <= 128 ? draw_sizes[d] : standard_draws[s];
  }

  fx.standardDrawSize = standardDrawSize;

  function standardDrawSize(num_players) {
    var i = 0;

    while (standard_draws[i] < num_players) {
      i += 1;
    }

    return standard_draws[i];
  }

  fx.treeDrawMatchOrder = treeDrawMatchOrder;

  function treeDrawMatchOrder(draw) {
    var mtz = matches(draw);
    return mtz.filter(function (m) {
      return m.match;
    }).sort(function (a, b) {
      return drawPosition(a) - drawPosition(b);
    }).map(function (m) {
      return m.match.muid;
    });

    function drawPosition(match) {
      if (!match.teams || !Array.isArray(match.teams) || !match.teams.length) return 1000;
      var draw_position = match.teams.reduce(function (p, c) {
        return c && c[0] && c[0].draw_position || p;
      }, undefined);
      return draw_position || 1000;
    }
  }

  fx.bracketMatches = bracketMatches;

  function bracketMatches(draw, bracket_index) {
    if (!draw || !draw.brackets) return [];
    var bracket = draw.brackets[bracket_index];

    var teamsHash = function teamsHash(teams) {
      return teams.map(function (team) {
        return team.map(function (p) {
          return p.id;
        }).sort().join("-");
      }).sort().join("-");
    };

    var uniqueTeam = function uniqueTeam(arr, m) {
      if (arr.map(teamsHash).indexOf(teamsHash(m)) < 0) arr.push(m);
      return arr;
    };

    pruneDefunctMatches();
    findMissingMatches();
    return bracket.matches;

    function pruneDefunctMatches() {
      var _ref3;

      // to support legacy brackets
      if (!bracket.teams) {
        bracket.teams = bracket.players.map(function (p) {
          return [p];
        });
      } // get an array of all match_ups:


      var match_ups = (_ref3 = []).concat.apply(_ref3, bracket.teams.map(function (team) {
        return teamMatchups(team);
      }).map(function (matchup) {
        return matchup.map(function (teams) {
          return teams.map(playersHash);
        });
      }));

      var existing_match_ups = bracket.matches.map(function (match) {
        return match.teams ? match.teams.map(playersHash) : [];
      });
      var defunct = existing_match_ups.filter(function (emu) {
        return !match_ups.reduce(function (p, c) {
          return emu && c && intersection(emu, c).length === 2 || p;
        }, false);
      });
      bracket.matches = bracket.matches.filter(function (match) {
        var pairing = match.teams ? match.teams.map(playersHash) : [];
        var obsolete = defunct.reduce(function (p, c) {
          return intersection(pairing, c).length === 2 || p;
        }, false);
        return !obsolete;
      });
    }

    function findMissingMatches() {
      var _ref4;

      (_ref4 = []).concat.apply(_ref4, bracket.teams.map(teamMissingMatches)).reduce(uniqueTeam, []).forEach(addTeamMatch);
    }

    function addTeamMatch(teams) {
      var _ref5;

      var players = (_ref5 = []).concat.apply(_ref5, teams);

      var match = {
        teams: teams,
        players: players,
        round_name: "RR",
        bracket: bracket_index,
        ids: players.map(function (p) {
          return p.id || p.id;
        })
      };
      bracket.matches.push(match);
    }

    function teamMissingMatches(team) {
      var team_matchups = teamMatchups(team);
      var matches_hash = bracket.matches.filter(function (m) {
        return m.teams;
      }).map(function (m) {
        return teamsHash(m.teams);
      });
      var missing = team_matchups.filter(function (tm) {
        var index = matches_hash.indexOf(teamsHash(tm));
        return index < 0;
      });
      return missing;
    }

    function teamMatchups(team) {
      var opponents = bracket.teams.filter(function (t) {
        return playersHash(t) !== playersHash(team);
      });
      var matchups = opponents.map(function (o) {
        return [team, o];
      });
      return matchups;
    }
  }

  fx.roundRobinRounds = roundRobinRounds;

  function roundRobinRounds(_ref6) {
    var event = _ref6.event;
    var draw = event && event.draw;
    if (!draw || !draw.brackets || !draw.brackets.length) return;
    var rounds = [];
    var rrbr = draw.brackets.map(bracketRounds);
    var qualifying = event && event.links && event.links.E;
    var max_rounds = Math.max.apply(Math, rrbr.map(function (r) {
      return r.length;
    }));

    var _loop = function _loop(r) {
      rounds.push(rrbr.map(function (br, b) {
        return {
          bracket: b,
          matchups: bracketMatchups(b, br[r])
        };
      }).filter(function (f) {
        return f.matchups;
      }));
    };

    for (var r = 0; r < max_rounds; r++) {
      _loop(r);
    }

    rounds.forEach(function (round, i) {
      round.forEach(function (bracket) {
        bracket.matchups.forEach(function (matchup) {
          matchup.round = i + 1;
          matchup.round_name = "RR" + (qualifying ? "Q" : "") + (i + 1);
        });
      });
    });
    return rounds;

    function bracketMatchups(bracket_index, matchups
    /*, round*/
    ) {
      if (!matchups) return;
      var matches = draw.brackets[bracket_index].matches;
      var matchhashes = matchups.map(function (m) {
        return m.sort().join("|");
      });
      var result = matches.filter(function (m) {
        return matchhashes.indexOf(m.players.map(function (p) {
          return p.draw_position;
        }).sort().join("|")) >= 0;
      });
      return result;
    }
  }

  fx.bracketRounds = bracketRounds;

  function bracketRounds(bracket) {
    if (!bracket || !bracket.matches || !bracket.matches.length) return [];
    return calcBracketRounds(bracket);
  } // calculate rounds for a given number of round robin opponents


  function calcBracketRounds(bracket) {
    var opponents = bracket.players.length;

    var numArr = function numArr(count) {
      return [].concat(Array(count)).map(function (_, i) {
        return i;
      });
    };

    var positions = numArr(2 * Math.round(opponents / 2) + 1).slice(1);
    var rounds = numArr(positions.length - 1).map(function () {
      return [];
    });
    var a_row = positions.slice(0, positions.length / 2);
    var b_row = positions.slice(positions.length / 2);
    positions.slice(1).forEach(function (p, i) {
      var _ref7, _ref8;

      a_row.forEach(function (a, j) {
        rounds[i].push([a_row[j], b_row[j]]);
      });
      var a_head = a_row.shift();
      var a_down = a_row.pop();
      var b_up = b_row.shift();
      a_row = (_ref7 = []).concat.apply(_ref7, [a_head, b_up].concat(a_row));
      b_row = (_ref8 = []).concat.apply(_ref8, b_row.concat([a_down]));
    });
    return rounds.reverse();
  }

  function bracketDrawPositions(draw) {
    var _ref9;

    return (_ref9 = []).concat.apply(_ref9, draw.brackets.map(function (b, i) {
      return range$1(draw.bracket_size).map(function (p, j) {
        return {
          bracket: i,
          position: j + 1
        };
      });
    }));
  }

  function rrInfo(draw) {
    var _ref10, _ref11;

    if (!draw.brackets) draw.brackets = [];
    var draw_positions = bracketDrawPositions(draw);
    var byes = draw.brackets.length * draw.bracket_size - draw.opponents.length;

    var matches = (_ref10 = []).concat.apply(_ref10, draw.brackets.map(function (b) {
      return b.matches;
    }));

    var total = function total(a, b) {
      return a + b;
    };

    var total_matches = draw.brackets.map(function (b) {
      return range(0, b.players.length).reduce(total, 0);
    }).reduce(total, 0);

    var seed_placements = (_ref11 = []).concat.apply(_ref11, draw.seed_placements.map(function (s) {
      return s.placements;
    })).map(function (p) {
      return p.position;
    });

    var unfinished_seed_placements = draw.seed_placements.filter(function (s) {
      return s.range.length !== s.placements.length;
    });
    var unseeded_placements = draw.unseeded_placements ? draw.unseeded_placements.map(function (u) {
      return u.position;
    }) : [];
    var placements = [].concat(seed_placements, draw.bye_placements || [], unseeded_placements);

    var hashFx = function hashFx(h) {
      return [h.bracket, h.position].join("|");
    };

    var p_hash = placements.map(hashFx);
    var unfilled_positions = draw_positions.filter(function (p) {
      return p_hash.indexOf(hashFx(p)) < 0;
    });
    var completed_brackets = draw.brackets.map(bracketComplete);
    var complete = completed_brackets && completed_brackets.reduce(function (a, b) {
      return a && b;
    });
    var positions_filled = unseeded_placements && unseeded_placements.length && draw.unseeded_placements.length === draw.unseeded_teams.length;
    var unplaced_seeds = [];
    var open_seed_positions = [];

    if (unfinished_seed_placements.length) {
      var placed_seeds = unfinished_seed_placements[0].placements.map(function (p) {
        return p.seed;
      });
      unplaced_seeds = unfinished_seed_placements[0].range.filter(function (s) {
        return placed_seeds.indexOf(s) < 0;
      }).map(function (r) {
        return draw.seeded_teams[r];
      });

      var _p_hash = unfinished_seed_placements[0].placements.map(function (p) {
        return hashFx(p.position);
      });

      open_seed_positions = unfinished_seed_placements[0].positions.filter(function (p) {
        return _p_hash.indexOf(hashFx(p)) < 0;
      });
    }

    return {
      draw_type: "roundrobin",
      draw_positions: draw_positions,
      matches: matches,
      positions_filled: positions_filled,
      complete: complete,
      byes: byes,
      placements: placements,
      unfilled_positions: unfilled_positions,
      total_matches: total_matches,
      unfinished_seed_placements: unfinished_seed_placements,
      unplaced_seeds: unplaced_seeds,
      open_seed_positions: open_seed_positions
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
    var directions = ["east", "west", "north", "south", "northeast", "northwest", "southeast", "southwest"];
    directions.filter(function (d) {
      return draw[d];
    }).forEach(function (direction) {
      var _all_matches, _match_nodes, _upcoming_match_nodes, _unassigned;

      var info = treeInfo(draw[direction]);
      complete = complete || info.complete;
      total_matches += info.total_matches;
      all_matches = (_all_matches = all_matches).concat.apply(_all_matches, info.all_matches);
      match_nodes = (_match_nodes = match_nodes).concat.apply(_match_nodes, info.match_nodes);
      upcoming_match_nodes = (_upcoming_match_nodes = upcoming_match_nodes).concat.apply(_upcoming_match_nodes, info.upcoming_match_nodes);
      unassigned = (_unassigned = unassigned).concat.apply(_unassigned, info.unassigned);
    });
    return {
      complete: complete,
      total_matches: total_matches,
      all_matches: all_matches,
      match_nodes: match_nodes,
      upcoming_match_nodes: upcoming_match_nodes,
      unassigned: unassigned
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
    node.children.forEach(function (c) {
      return collapseHierarchy(c, depth);
    });
  }

  fx.expandHierarchy = expandHierarchy;

  function expandHierarchy(node) {
    node.children = node.children || node._children;
    node.height = node.height || node._height;
    node._children = null;
    node._height = null;
    if (!node.children) return;
    node.children.forEach(function (c) {
      return expandHierarchy(c);
    });
  }

  function treeInfo(draw, collapse) {
    var _ref12;

    if (!draw) return {};
    var calc_tree = tree();
    var draw_hierarchy = hierarchy(draw);
    var maxTreeDepth = draw.maxTreeDepth || collapse;
    if (maxTreeDepth) collapseHierarchy(draw_hierarchy, maxTreeDepth);
    var nodes = calc_tree(draw_hierarchy).descendants();
    var depth = Math.max.apply(Math, nodes.map(function (n) {
      return n.depth;
    }));
    var byes = nodes.filter(function (n) {
      return !n.height && n.data.bye;
    });
    var structural_byes = nodes.filter(function (f) {
      return +f.height === 0 && f.depth !== depth;
    });
    var match_nodes = nodes && nodes.filter(function (n) {
      return matchNode(n);
    }) || [];
    var bye_nodes = match_nodes.filter(function (n) {
      return !teamMatch(n, false);
    });
    var double_bye_nodes = match_nodes.filter(function (n) {
      return byeNode(n) > 1;
    });
    var all_matches = nodes.filter(function (n) {
      return n && n.children && n.children.length === 2 && (!draw.max_round || n.height <= draw.max_round);
    });
    var upcoming_match_nodes = all_matches.filter(function (n) {
      return n && n.children && (qualifierChild(n) || !matchNode(n));
    });
    var doubles = nodes.map(function (n) {
      return n.data.team ? n.data.team.length > 1 : false;
    }).reduce(function (a, b) {
      return a || b;
    });
    var draw_positions = unique(nodes.map(function (n) {
      return n.data.dp;
    })).filter(function (f) {
      return f;
    });
    var qualifiers = nodes.filter(function (n) {
      return !n.height && n.data.qualifier;
    });
    var seeds = nodes.filter(function (n) {
      return !n.height && n.data.team && n.data.team[0] && n.data.team[0].seed;
    }).sort(function (a, b) {
      return a.data.team[0].seed - b.data.team[0].seed;
    });
    var final_round = draw.max_round ? nodes.filter(function (f) {
      return +f.height === +draw.max_round;
    }) : nodes.filter(function (f) {
      return +f.depth === 0;
    });
    var final_round_players = match_nodes.filter(function (m) {
      return draw.max_round ? +m.height === +draw.max_round : !m.depth;
    }).map(function (m) {
      return m.data.team;
    });
    var unassigned = nodes.filter(function (n) {
      return !maxTreeDepth && !n.height && !n.data.team && !n.data.bye && !n.data.qualifier;
    });

    var assignments = (_ref12 = []).concat.apply(_ref12, nodes.filter(function (f) {
      return !f.height && f.data.team && !f.data.qualifier && !f.data.bye;
    }).map(function (node) {
      return node.data.team.map(function (p) {
        var _ref13;

        return _ref13 = {}, _ref13[p.id] = node.data.dp, _ref13;
      });
    }));

    var assigned_positions = assignments.length ? Object.assign.apply(Object, assignments) : {};
    var total_matches = all_matches.length - byes.length;
    var complete = match_nodes.length && match_nodes.filter(validMatch).map(function (n) {
      return byeChild(n) || n.data.match && n.data.match.complete;
    }).reduce(function (p, c) {
      return c && p;
    }, true);

    function byeChild(n) {
      return n && n.children && n.children.map(function (c) {
        return c.data.bye;
      }).reduce(function (p, c) {
        return c || p;
      }, false);
    }

    function qualifierChild(n) {
      return n && n.children && !byeChild(n) && n.children.map(function (c) {
        return c.data.qualifier;
      }).reduce(function (p, c) {
        return c || p;
      }, false);
    }

    function validMatch(n) {
      return !draw.max_round || n.height <= draw.max_round;
    } // function isStructuralBye(child) { return structural_byes.map(s=>s.data.dp).indexOf(child.data.dp) >= 0; }
    // function upcomingChild(n) { return n.children && n.children.map(c=>ucmatch(c)).filter(f=>f).length === 2; }
    // function ucmatch(c) { return matchNode(c) || ( isStructuralBye(c) && !c.data.children); }


    return {
      draw_type: "tree",
      complete: complete,
      draw_positions: draw_positions,
      assigned_positions: assigned_positions,
      seeds: seeds,
      doubles: doubles,
      nodes: nodes,
      depth: depth,
      total_matches: total_matches,
      all_matches: all_matches,
      match_nodes: match_nodes,
      upcoming_match_nodes: upcoming_match_nodes,
      byes: byes,
      bye_nodes: bye_nodes,
      double_bye_nodes: double_bye_nodes,
      structural_byes: structural_byes,
      qualifiers: qualifiers,
      final_round: final_round,
      final_round_players: final_round_players,
      unassigned: unassigned
    };
  }

  fx.replaceDrawPlayer = replaceDrawPlayer;

  function replaceDrawPlayer(draw, existing_player, new_player_data) {
    if (!draw || !existing_player || !new_player_data || typeof new_player_data !== "object") return; // Replace attributes in event.draw.opponents

    if (draw.opponents) draw.opponents.forEach(function (opponent_team) {
      opponent_team.forEach(checkReplacePlayer);
    }); // Replace attributes in event.draw.seeded_teams

    if (draw.seeded_teams) Object.keys(draw.seeded_teams).forEach(function (key) {
      return draw.seeded_teams[key].forEach(checkReplacePlayer);
    }); // Replace attributes in event.draw.unseeded_teams

    if (draw.unseeded_teams) draw.unseeded_teams.forEach(function (opponent_team) {
      opponent_team.forEach(checkReplacePlayer);
    }); // Replace attributes in event.draw.unseeded_placements

    if (draw.unseeded_placements) draw.unseeded_placements.forEach(function (placement) {
      if (placement.id === existing_player.id) placement.id = new_player_data.id;
    }); // Replace players in all draw matches

    var matches = [];

    if (draw.dual_matches) {
      Object.keys(draw.dual_matches || {}).forEach(function (key) {
        var _matches;

        var dual_matches = draw.dual_matches[key].matches || [];
        dual_matches.forEach(function (dm) {
          return dm.dual_match = key;
        });
        matches = (_matches = matches).concat.apply(_matches, dual_matches);
      });
    } else {
      matches = fx.matches(draw).filter(function (m) {
        return m.match && m.match.muid;
      });
    }

    matches.forEach(function (match) {
      if (match.teams) match.teams.filter(function (f) {
        return f;
      }).forEach(function (team) {
        return team.forEach(checkReplacePlayer);
      });
      if (match.winner) match.winner.forEach(checkReplacePlayer);
      if (match.loser) match.loser.forEach(checkReplacePlayer);
      if (match.players) match.players.forEach(checkReplacePlayer);
      if (match.ids) match.ids = match.players.map(function (p) {
        return p.id;
      });

      if (match.match) {
        if (match.match.teams) match.match.teams.forEach(function (team) {
          return team.forEach(checkReplacePlayer);
        });
        if (match.match.winner && Array.isArray(match.match.winner)) match.match.winner.forEach(checkReplacePlayer);
        if (match.match.loser && Array.isArray * match.match.loser) match.match.loser.forEach(checkReplacePlayer);
        if (match.match.players) match.match.players.forEach(checkReplacePlayer);
        if (match.match.ids) match.match.ids = match.match.players.map(function (p) {
          return p.id;
        });
      }
    });

    if (draw.brackets) {
      draw.brackets.forEach(function (bracket) {
        return bracket.players.forEach(checkReplacePlayer);
      });
    }

    function checkReplacePlayer(player) {
      if (player && (player.id === existing_player.id || player.id === existing_player.id)) {
        Object.keys(new_player_data).forEach(function (key) {
          return player[key] = new_player_data[key];
        });
      }
    }
  }

  fx.bracketComplete = bracketComplete;

  function bracketComplete(bracket) {
    return bracket.matches && bracket.matches.length && bracket.matches.filter(function (m) {
      return m.winner;
    }).length === bracket.matches.length;
  }

  fx.drawRounds = drawRounds;

  function drawRounds(num_players) {
    if (!num_players) return; // get the binary representation of the number of players

    var bin = d2b(num_players); // result is length of binary string - 1 + 1 if there are any 1s after first digit

    return bin.slice(1).length + (bin.slice(1).indexOf(1) >= 0 ? 1 : 0);

    function d2b(dec) {
      return (dec >>> 0).toString(2);
    }
  }

  fx.calcFeedBase = function (_ref14) {
    var draw_positions = _ref14.draw_positions;
    var positions = draw_positions && draw_positions.length;

    if (!p2(positions)) {
      positions += sByes(positions);
    }

    if (positions && p2(positions)) return positions / 2;
  };

  fx.feedDrawSize = feedDrawSize;

  function feedDrawSize(_ref15) {
    var num_players = _ref15.num_players,
        skip_rounds = _ref15.skip_rounds,
        feed_rounds = _ref15.feed_rounds;
    var s = 0;
    var burn = 0;

    while (calcFeedSize({
      first_round_size: standard_draws[s],
      skip_rounds: skip_rounds,
      feed_rounds: feed_rounds
    }) < num_players && burn < 10) {
      burn += 1;
      s += 1;
    }

    if (burn >= 10) {
      console.log("BOOM!", num_players, skip_rounds, feed_rounds);
      return standard_draws[1];
    }

    return standard_draws[s];
  }

  fx.calcFeedSize = calcFeedSize;

  function calcFeedSize(_ref16) {
    var first_round_size = _ref16.first_round_size,
        skip_rounds = _ref16.skip_rounds,
        feed_rounds = _ref16.feed_rounds;
    if (!first_round_size) return 0;
    var feed_capacity = first_round_size * 2 - 1;
    var skip_reduce = skip_rounds && skip_rounds > 0 ? first_round_size / (skip_rounds * 2) : 0;
    var draw_rounds = drawRounds(first_round_size);
    var possible_feed_rounds = draw_rounds - (skip_rounds || 0);
    var feed_diff = feed_rounds !== undefined ? possible_feed_rounds - feed_rounds : 0;
    var feed_reduce = feed_rounds !== undefined && feed_diff > 0 ? numArr(feed_diff).map(function (d) {
      return Math.pow(2, d);
    }).reduce(function (a, b) {
      return (a || 0) + (b || 0);
    }) : 0;
    return feed_capacity - skip_reduce - feed_reduce;
  }

  fx.drawInfo = drawInfo;

  function drawInfo(draw, collapse) {
    if (!draw) return;
    if (draw.brackets) return rrInfo(draw);

    if (draw.compass) {
      var info = treeInfo(draw[draw.compass]);
      if (info) info.compass = true;
      return info;
    }

    if (draw.children) return treeInfo(draw, collapse);
  }

  fx.blankDraw = blankDraw;

  function blankDraw(players, offset) {
    if (offset === void 0) {
      offset = 0;
    }

    if (isNaN(players) || !validDrawSize(players)) return undefined; // function dp(x) { return { dp: offset + x }; }

    var dp = function dp(x) {
      return {
        dp: offset + x
      };
    };

    var positions = Array.from(new Array(players), function (val, index) {
      return index + 1;
    });
    return positions.map(dp);
  }

  fx.addByes = addByes;

  function addByes(draw) {
    var info = drawInfo(draw);
    var draw_positions = info.draw_positions;
    var max_draw_position = draw_positions.length ? Math.max.apply(Math, draw_positions) : 0; // let missing_draw_positions = max_draw_position ? Array.from(new Array(max_draw_position),(val,index)=>index+1).filter(p=>draw_positions.indexOf(p) < 0) : [];

    /*
      let chooseDrawPosition = (dp) => {
         let np = missing_draw_positions.filter(p => Math.abs(dp - p) === 1)[0];
         return np || '';
      };
      */

    walkNode(draw);

    function walkNode(node, descent) {
      if (descent === void 0) {
        descent = 0;
      }

      if (descent < info.depth && !node.children) {
        var position = node.team && node.team[0].draw_position >= max_draw_position / 2 ? 0 : 1;
        addBye(node, position);
      }

      if (node.children) node.children.forEach(function (child) {
        return walkNode(child, descent + 1);
      });
    }

    function addBye(node, position) {
      if (position === void 0) {
        position = 1;
      }

      var team = node.team;
      var bye = {
        bye: true,
        team: [{
          draw_position: "",
          bye: true
        }]
      };
      var player = {
        dp: node.dp,
        id: node.id,
        team: team
      };
      node.children = position ? [player, bye] : [bye, player];
      node.match = {
        score: ""
      };
    }
  } // return positions of structural byes


  fx.structuralByes = structuralByes;

  function structuralByes(players, bit_flip) {
    var s = sByes(players);
    var cluster_size = players / s;
    var clusters = players / cluster_size;
    var cluster = 1;
    var bye_positions = [];

    while (cluster <= clusters) {
      var odd = cluster % 2;
      if (bit_flip && cluster > 1 && cluster < clusters) odd = 1 - odd;

      if (odd) {
        bye_positions.push((cluster - 1) * cluster_size + 1);
      } else {
        bye_positions.push(cluster * cluster_size);
      }

      cluster += 1;
    }

    return bye_positions;
  } // number of structural byes


  fx.sByes = sByes;

  function sByes(players) {
    if (p2(players)) return 0;
    var b = 1;

    while (b < players && !p2(players - b)) {
      b += 1;
    }

    return b;
  } // check for power of 2


  function p2(n) {
    if (isNaN(n)) return false;
    return n && (n & n - 1) === 0;
  } // WHAT WAS THIS?


  fx.dispersion = dispersion;

  function dispersion(num_players, depth) {
    var values = [];
    var p = num_players;

    while (div2(p)) {
      values.push(p);
      p = p / 2;
    }

    var d = 0;
    var positions = [];
    values.forEach(function (value) {
      if (+d === +depth) {
        positions.push(value);
        positions.push(num_players - value + 1);
      }

      d += 1;
    });
    positions.sort(function (a, b) {
      return a - b;
    });
    return positions;

    function div2(n) {
      if (isNaN(n)) return false;
      return n / 2 === Math.floor(n / 2);
    }
  }

  function buildRound(_ref17) {
    var tree = _ref17.tree,
        _ref17$byes = _ref17.byes,
        byes = _ref17$byes === void 0 ? [] : _ref17$byes,
        fed = _ref17.fed,
        rounds = _ref17.rounds;
    var round = [];
    var pos = 0;

    while (pos < tree.length) {
      if (byes.indexOf(pos + 1) >= 0) {
        var node = tree[pos];
        round.push(node);
        pos += 1;
      } else {
        var child1 = tree[pos];
        child1.fed = fed;
        child1.round = rounds;
        var child2 = tree[pos + 1];

        if (child2) {
          child2.fed = fed;
          child2.round = rounds;
        }

        var _node = {
          children: [child1, child2],
          nuid: UUID["new"]()
        };
        round.push(_node);
        pos += 2;
      }
    }

    return round;
  }

  fx.feedRound = feedRound;

  function feedRound(draw, remaining, fed, rounds) {
    var round = [];
    var pos = 0;

    while (pos < draw.length) {
      var feed_arm = remaining.pop();
      feed_arm.feed = true;
      feed_arm.fed = fed + 1;
      feed_arm.round = rounds;
      var position = draw[pos];
      position.round = rounds;
      position.fed = fed + 1;
      var match = {
        children: [position, feed_arm]
      };
      round.push(match);
      pos += 1;
    }

    return {
      round: round,
      remaining: remaining
    };
  } // TODO: Total Mess unless treeDraw() is configured properly
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

  function feedInDraw(_ref18) {
    var e = _ref18.e,
        teams = _ref18.teams,
        _ref18$skip_rounds = _ref18.skip_rounds,
        skip_rounds = _ref18$skip_rounds === void 0 ? 0 : _ref18$skip_rounds,
        _ref18$feed_rounds = _ref18.feed_rounds,
        feed_rounds = _ref18$feed_rounds === void 0 ? 0 : _ref18$feed_rounds,
        offset = _ref18.offset;
    var team_count = Array.isArray(teams) ? teams.length : teams;
    if (team_count < 2) return;
    var total_rounds = drawRounds(teams);
    if (skip_rounds >= total_rounds) feed_rounds = 0;

    var up2 = function up2(x) {
      return Math.pow(2, Math.ceil(Math.log(x) / Math.log(2)));
    };

    var players = up2(team_count + 1);
    var positions = blankDraw(players, offset);
    var remaining = positions.slice(positions.length / 2).reverse();
    var round = buildRound({
      e: e,
      tree: positions.slice(0, positions.length / 2)
    });
    var rounds = 0;

    while (round.length > 1 && skip_rounds > 0) {
      round = buildRound({
        e: e,
        tree: round
      });
      skip_rounds -= 1;
      rounds += 1;
    } // if (sequentials && sequentials > 1) feed_rounds = sequentials;


    var fed = 0; // let sequenced = 0;

    if (round.length > 1 && fed < feed_rounds) {
      var _feedRound = feedRound(round, remaining, fed, rounds);

      round = _feedRound.round;
      remaining = _feedRound.remaining;
      fed += 1; // sequenced += 1;
    }
    /*
      while(round.length > 1 && sequentials < sequenced) {
         ({round, remaining} = feedRound(round, remaining, fed, rounds));
         fed += 1;
         sequenced += 1;
      }
      */


    while (round.length > 1) {
      round = buildRound({
        e: e,
        tree: round,
        fed: fed,
        rounds: rounds
      });
      rounds += 1;

      if (round.length > 1 && fed < feed_rounds) {
        if (fed >= skip_rounds) {
          var _feedRound2 = feedRound(round, remaining, fed, rounds);

          round = _feedRound2.round;
          remaining = _feedRound2.remaining;
        }

        fed += 1;
      }
    }

    if (fed < feed_rounds) {
      var _feedRound3 = feedRound(round, remaining, fed, rounds);

      round = _feedRound3.round;
      remaining = _feedRound3.remaining;
    }

    return round && round.length ? round[0] : round;
  }

  fx.buildDraw = buildDraw;

  function buildDraw(_ref19) {
    var e = _ref19.e,
        teams = _ref19.teams,
        structural_byes = _ref19.structural_byes,
        _ref19$offset = _ref19.offset,
        offset = _ref19$offset === void 0 ? 0 : _ref19$offset,
        direction = _ref19.direction;
    var round;

    if (Array.isArray(teams)) {
      round = teams.map(function (t, i) {
        return {
          dp: offset + i + 1,
          team: t
        };
      });
    } else {
      if (isNaN(teams) || !validDrawSize(teams)) return undefined;
      round = blankDraw(teams, offset);
    }

    structural_byes = structural_byes || structuralByes(round.length);
    round = buildRound({
      e: e,
      tree: round,
      byes: structural_byes
    });

    while (round.length > 1) {
      round = buildRound({
        e: e,
        tree: round
      });
    }

    if (direction) round[0].direction = direction;
    return round[0];
  }

  fx.buildQualDraw = buildQualDraw;

  function buildQualDraw(_ref20) {
    var e = _ref20.e,
        num_players = _ref20.num_players,
        num_qualifiers = _ref20.num_qualifiers;
    var group_size = Math.ceil(num_players / num_qualifiers);
    var section_size = standardDrawSize(group_size);
    var sections = Array.from(new Array(num_qualifiers), function (val, i) {
      return i;
    });
    var children = sections.map(function (u, i) {
      return buildDraw({
        e: e,
        teams: section_size,
        offset: i * section_size
      });
    });
    var max_round = hierarchy(children[0]).height;
    return {
      children: children,
      max_round: max_round
    };
  }

  fx.assignPosition = assignPosition;

  function assignPosition(_ref21) {
    var node = _ref21.node,
        position = _ref21.position,
        _ref21$team = _ref21.team,
        team = _ref21$team === void 0 ? [{}] : _ref21$team,
        bye = _ref21.bye,
        qualifier = _ref21.qualifier,
        propagate = _ref21.propagate,
        assigned = _ref21.assigned;
    if (!node || !position) return assigned;

    if (+node.dp === +position) {
      node.team = team;
      node.team.forEach(function (player) {
        player.draw_position = position;
        player.bye = bye;
        player.qualifier = qualifier;
        player.entry = player.entry ? player.entry : qualifier ? "Q" : "";
      });
      node.bye = bye;
      node.qualifier = qualifier;
      assigned = true;
      if (!propagate) return assigned;
    }

    if (node.children) {
      var result = node.children.map(function (child) {
        return assignPosition({
          node: child,
          position: position,
          team: team,
          bye: bye,
          qualifier: qualifier,
          propagate: propagate,
          assigned: assigned
        });
      });
      return result.reduce(function (a, b) {
        return a || b;
      });
    }

    return assigned;
  }

  fx.findPositionNode = findPositionNode;

  function findPositionNode(_ref22) {
    var node = _ref22.node,
        position = _ref22.position;
    if (+node.dp === +position) return node;
    if (!node.children) return; // if position in node children, get index;

    var cdpi = node.children.map(function (c) {
      return c.dp;
    }).indexOf(position);

    if (cdpi >= 0) {
      return node;
    } else {
      var _ref23;

      return (_ref23 = []).concat.apply(_ref23, node.children.map(function (child) {
        return findPositionNode({
          node: child,
          position: position
        });
      })).filter(function (f) {
        return f;
      })[0];
    }
  }

  fx.advancePosition = advancePosition;

  function advancePosition(_ref24) {
    var draw = _ref24.draw,
        position = _ref24.position,
        score = _ref24.score,
        set_scores = _ref24.set_scores,
        matchFormat = _ref24.matchFormat,
        bye = _ref24.bye,
        onlyIfBye = _ref24.onlyIfBye,
        winner = _ref24.winner;
    var position_node = findPositionNode({
      node: draw,
      position: position
    }); // don't advance if position_node already contains player

    if (!position_node || position_node.dp) return;
    return advanceToNode({
      draw: draw,
      node: position_node,
      position: position,
      score: score,
      set_scores: set_scores,
      matchFormat: matchFormat,
      bye: bye,
      onlyIfBye: onlyIfBye,
      winner: winner
    });
  }

  fx.teamIsBye = function (team) {
    return team.map(function (p) {
      return p.bye;
    }).reduce(function (a, b) {
      return a && b;
    });
  };

  function matchDrawPositions(match) {
    return match.players && match.players.reduce(function (p, c) {
      return c && p.indexOf(c.draw_position) < 0 ? p.concat(c.draw_position) : p;
    }, []) || [];
  }

  fx.advanceToNode = advanceToNode;

  function advanceToNode(_ref25) {
    var draw = _ref25.draw,
        node = _ref25.node,
        position = _ref25.position,
        score = _ref25.score,
        set_scores = _ref25.set_scores,
        complete = _ref25.complete,
        matchFormat = _ref25.matchFormat,
        bye = _ref25.bye,
        onlyIfBye = _ref25.onlyIfBye;
    // cannot advance if no position node
    if (!node) return {
      advanced: false
    };
    if (!node.match) node.match = {};
    var current_match = node.match;
    var round = current_match && current_match.round;

    if (node.dp && round) {
      var draw_matches = Array.isArray(draw.matches) && draw.matches;

      var _matches2 = draw_matches || fx.matches(draw) || [];

      var match_draw_positions = matchDrawPositions(current_match);

      var next_round_match = _matches2.filter(function (m) {
        return m.round && m.round === round + 1 || m.match && m.match.round && m.match.round === round + 1;
      }).reduce(function (p, m) {
        return m.match && intersection(matchDrawPositions(m.match), match_draw_positions).length ? m : p;
      }, undefined);

      var next_round_score = next_round_match && next_round_match.match && next_round_match.match.score;
      var next_round_draw_positions = next_round_match && matchDrawPositions(next_round_match.match); // if there is an existing position assigned to node AND if there is a subsequent match winner
      // THEN: if the attempted assignment is not the same, fail

      if (next_round_score && next_round_draw_positions.indexOf(+position) < 0) {
        return {
          advanced: false,
          error: "Cannot change match outcome with subsequent match(es)"
        };
      }

      if (next_round_score && !complete) {
        return {
          advanced: false,
          error: "Cannot enter an incomplete match score with subsequent matche(es)"
        };
      }
    } // if position in node children, get index;


    var cdpi = node.children.map(function (c) {
      return c.dp;
    }).indexOf(position);
    var teams = node.children.map(function (c) {
      return c.team;
    }).filter(function (f) {
      return f;
    });
    var containsByeTeam = teams.reduce(function (p, c) {
      return fx.teamIsBye(c) || p;
    }, false);

    if (teams.length === 2 && cdpi >= 0) {
      if (onlyIfBye && !containsByeTeam) {
        // condition don't advance the position *unless* there is a ByeTeam
        return {
          advanced: false
        };
      } else if (!bye && fx.teamIsBye(teams[cdpi])) {
        return {
          advanced: false
        };
      } else {
        var opponent_is_bye = fx.teamIsBye(teams[1 - cdpi]);
        advance(opponent_is_bye, bye);
        return {
          advanced: true
        };
      }
    }

    return {
      advanced: false
    };

    function advance(opponent_is_bye, bye) {
      node.children.forEach(function (child, i) {
        if (+child.dp === +position) {
          node.bye = bye;
          node.dp = position; // draw position shouldn't really be assigned if not a winner
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

  function modifyPositionScore(_ref26) {
    var node = _ref26.node,
        positions = _ref26.positions,
        score = _ref26.score,
        set_scores = _ref26.set_scores,
        complete = _ref26.complete,
        matchFormat = _ref26.matchFormat;
    var target_node = findMatchNodeByTeamPositions(node, positions);
    if (!target_node) return;
    if (!target_node.match) target_node.match = {};
    target_node.match.score = score;
    target_node.match.set_scores = set_scores;
    target_node.match.matchFormat = matchFormat;
    if (complete !== undefined) target_node.match.complete = complete; // if match is incomplete remove any outdated attributes

    if (!complete) {
      delete target_node.team;
      delete target_node.match.loser;
      delete target_node.match.winner;
      delete target_node.match.winner_index;
    }
  }

  fx.schedulePosition = schedulePosition;

  function schedulePosition(_ref27) {
    var node = _ref27.node,
        position = _ref27.position,
        schedule = _ref27.schedule,
        venue = _ref27.venue;
    var target_node = findPositionNode({
      node: node,
      position: position
    });
    if (!target_node.match) target_node.match = {};
    target_node.match.schedule = schedule;
    target_node.match.venue = venue;
  }

  fx.seedBlock = function (seed) {
    var seed_block = o.seedBlocks.reduce(inSeedBlock, undefined);
    return seed_block && seed_block.join("-");

    function inSeedBlock(p, c) {
      if (c) {
        var lower = c[0];
        var higher = c[1] || c[0];
        return seed >= lower && seed <= higher ? c : p;
      }
    }
  };

  fx.seedLimit = seedLimit;

  function seedLimit(_ref28) {
    var total_players = _ref28.total_players,
        evt = _ref28.evt;
    var limit = 0; // let event_seed_limit = evt && evt.seed_limit && (evt.seed_limit < total_players) && evt.seed_limit;

    var event_seed_limit = evt && evt.seeds && evt.seeds < total_players && evt.seeds;
    if (event_seed_limit === 0) return 0;
    o.seed_limits.forEach(function (threshold) {
      if (total_players >= threshold[0]) limit = threshold[1];
    });
    return event_seed_limit || limit;
  }

  fx.roundrobinSeedPlacements = roundrobinSeedPlacements;

  function roundrobinSeedPlacements(_ref29) {
    var draw = _ref29.draw,
        bracket_size = _ref29.bracket_size;
    var placements = [];
    var bracket_count = draw.brackets.length;
    var seeded_team_keys = Object.keys(draw.seeded_teams);
    var auto_placed_seeds = seeded_team_keys.slice(0, bracket_count);
    var random_placed_seeds = seeded_team_keys.slice(bracket_count); // Minimum one seed in first position for each bracket

    range$1(auto_placed_seeds.length).forEach(function (s) {
      // let bracket = draw.brackets[s % bracket_count];
      placements.push({
        range: [s + 1],
        positions: [{
          bracket: s % bracket_count,
          position: 1
        }],
        placements: []
      });
    }); // final position of each bracket is available for other seeds to be placed randomly

    var range = [];
    var positions = [];
    range$1(bracket_count).forEach(function (s) {
      var seed_index = auto_placed_seeds.length + s; // let bracket = draw.brackets[seed_index % bracket_count];
      // the range is restricted by the number of remaining seeds

      if (s < random_placed_seeds.length) range.push(seed_index + 1); // but the positiosn are available in each bracket

      positions.push({
        bracket: seed_index % bracket_count,
        position: bracket_size
      });
    }); // randomize the order

    shuffle(positions);
    placements.push({
      range: range,
      positions: positions,
      placements: []
    });
    return placements;
  }

  fx.qualifyingBracketSeeding = qualifyingBracketSeeding;

  function qualifyingBracketSeeding(_ref30) {
    var draw = _ref30.draw,
        num_players = _ref30.num_players,
        qualifiers = _ref30.qualifiers;
    var group_size = Math.ceil(num_players / qualifiers);
    var section_size = standardDrawSize(group_size); // let sections = Array.from(new Array(qualifiers),(val,i)=>i);

    var placements = [];
    var seeded_team_keys = Object.keys(draw.seeded_teams);
    var auto_placed_seeds = seeded_team_keys.slice(0, qualifiers);
    var random_placed_seeds = seeded_team_keys.slice(qualifiers); // Minimum one seed in first position for each section

    range$1(auto_placed_seeds.length).forEach(function (s) {
      var position = s % qualifiers * section_size + 1;
      placements.push({
        range: [s + 1],
        placements: [],
        positions: [position]
      });
    });
    var range = [];
    var positions = [];
    range$1(random_placed_seeds.length).forEach(function (s) {
      var seed_index = auto_placed_seeds.length + s;
      range.push(seed_index + 1);
    }); // with some qualification draws there are more placement options than seeds to be placed

    range$1(auto_placed_seeds.length).forEach(function (s) {
      var position = s % qualifiers * section_size + section_size;
      positions.push(position);
    });
    shuffle(positions);
    placements.push({
      range: range,
      positions: positions,
      placements: []
    });
    return placements;
  }

  fx.validSeedPlacements = validSeedPlacements;

  function validSeedPlacements(_ref31) {
    var num_players = _ref31.num_players,
        _ref31$random_sort = _ref31.random_sort,
        random_sort = _ref31$random_sort === void 0 ? false : _ref31$random_sort,
        seed_limit = _ref31.seed_limit,
        qualifying_draw = _ref31.qualifying_draw;
    var i = 1;
    var placements = [];
    var draw_size = acceptedDrawSizes({
      num_players: num_players,
      standardSizes: qualifying_draw
    });
    seed_limit = seed_limit || seedLimit({
      total_players: num_players || draw_size
    });

    while (i <= seed_limit) {
      // array of possible placement positions
      var p = seedPositions(o.seedPositions, i, draw_size); // if sort then sort seed groupings
      // if (random_sort) p = p.sort(() => 0.5 - Math.random());

      if (random_sort) shuffle(p);
      placements.push({
        range: playerPositions(i, p.length),
        positions: p,
        placements: []
      });
      i += p.length || draw_size;
    }

    return placements;
  } // range of player positions


  function playerPositions(s, n) {
    return Array.from(new Array(n), function (val, i) {
      return i + s;
    });
  }

  function seedPositions(seed_positions, i, draw_size) {
    return seed_positions[i].map(function (d) {
      return +d[0] + draw_size * d[1];
    });
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

  function distributeByes(_ref32) {
    var draw = _ref32.draw,
        num_players = _ref32.num_players,
        target_byes = _ref32.target_byes;
    var current_draw = draw.compass ? draw[draw.compass] : draw;
    var info = drawInfo(current_draw);
    var seed_positions = info.seeds.map(function (m) {
      return m.data.dp;
    });

    var randomBinary = function randomBinary() {
      return Math.floor(Math.random() * 2);
    };

    num_players = num_players || (current_draw.opponents ? current_draw.opponents.length : 0) + (current_draw.qualifiers || 0); // bye_positions is an array of UNDEFINED with length = # of byes
    // constructed by slicing from array number of actual teams/players

    var bye_positions = info.draw_positions.map(function () {
      return undefined;
    }).slice(num_players); // all draw positions which have a first-round opponent (no structural bye);

    var paired_positions = info.nodes.filter(function (f) {
      return +f.height === 1 && f.children;
    }).map(function (m) {
      var _ref33;

      return (_ref33 = []).concat.apply(_ref33, m.children.map(function (c) {
        return c.data.dp;
      }));
    }); // first round matches with no seeded position

    var pairs_no_seed = paired_positions.filter(function (f) {
      return intersection(seed_positions, f).length < 1;
    }); // first round matches with seeded position

    var pairs_with_seed = paired_positions.filter(function (f) {
      return intersection(seed_positions, f).length > 0;
    });
    var draw_size = info.draw_positions.length;
    var bp = o.bye_placement && draw_size && o.bye_placement[draw_size] || {};
    var prescribed = target_byes || bp;

    if (!info.structural_byes.length) {
      // if there are not emough prescribed bye_positions then skip priscribed (!!)
      if (prescribed && prescribed.length >= bye_positions.length) {
        bye_positions = bye_positions.map(function (p, i) {
          return prescribed[i];
        });
      } else {
        var _ref34, _ref35;

        var seed_placements = current_draw.seed_placements ? (_ref34 = []).concat.apply(_ref34, current_draw.seed_placements.map(function (m) {
          return m.placements;
        })).map(function (m) {
          return m.position;
        }) : []; // if there are structural byes, then no seed should need bye
        // if there are not structural byes, distribute byes to seeds first, by seed order
        // First select pairs that match the seed_positions, which are already in order, with seed groups shuffled
        // if there are more bye_positions than seed_positions, bye_positions remain undefined

        var filtered_pairs = bye_positions.map(function (b, i) {
          return pairs_with_seed.filter(function (p) {
            return p.indexOf(seed_positions[i]) >= 0;
          })[0];
        });
        bye_positions = (_ref35 = []).concat.apply(_ref35, filtered_pairs).filter(function (f) {
          return seed_placements.indexOf(f) < 0;
        });
      }
    } else {
      var _ref36;

      // find pairs of positions which are adjacent to structural byes
      var adjacent_pairs = info.structural_byes.map(function (sb) {
        return sb.parent.children.filter(function (c) {
          return c.data.children;
        });
      }).map(function (m) {
        return m[0].data.children.map(function (c) {
          return c.dp;
        });
      });
      var structural_seed_order = info.structural_byes.map(function (s) {
        return s.data && s.data.team ? s.data.team[0].seed : undefined;
      });
      var adjacent_to_seeds = [];

      if (o.compressed.byes_adjacent_to_seeds) {
        // only used this feature if enabled in drawFx options
        structural_seed_order.filter(function (f) {
          return f;
        }).forEach(function (o, i) {
          return adjacent_to_seeds[o - 1] = adjacent_pairs[i];
        });
      }

      adjacent_to_seeds.filter(function (f) {
        return f;
      });
      var assignment = bye_positions.map(function (b, i) {
        return adjacent_to_seeds[i] ? adjacent_to_seeds[i][randomBinary()] : undefined;
      }); // keep track of pairs with no seed or bye

      var pairs_no_seed_or_bye = pairs_no_seed.filter(function (pair) {
        return !intersection(pair, assignment).length;
      });

      var flat_pairs = (_ref36 = []).concat.apply(_ref36, pairs_no_seed_or_bye);

      if (target_byes) {
        // prescribed can't be fixed bye positions because these may create double-bye situations
        bye_positions = bye_positions.map(function (p, i) {
          return target_byes[i];
        });
      } else {
        // redefined undefined bye_positions to either be those asigned to adjacent pairs or pairs_no_seed_or_bye
        bye_positions = assignment.map(function (b) {
          if (b) return b; // if (pairs_no_seed_or_bye.length) return randomPop(pairs_no_seed_or_bye)[Math.floor(Math.random() * 2)];

          if (pairs_no_seed_or_bye.length) return getBye(pairs_no_seed_or_bye);
          return false;
        }).filter(function (f) {
          return f;
        });
      } // redefine pairs_no_seed to filter out pairs_no_seed_or_bye


      pairs_no_seed = pairs_no_seed.filter(function (pair) {
        return !intersection(pair, flat_pairs);
      });
    } // if any bye positions are still undefined, randomly distribute to unseeded players
    // TODO: randomPop need to be replaced with something that chooses quarters/eights
    // let bye_placements = bye_positions.map(b => b || randomPop(pairs_no_seed)[Math.floor(Math.random() * 2)]);


    var bye_placements = bye_positions.map(function (b) {
      return b || getBye(pairs_no_seed);
    });
    bye_placements.forEach(function (position, i) {
      // bye is a boolean which also signifies bye order (order in which byes were assigned)
      assignPosition({
        node: current_draw,
        position: position,
        bye: i + 1
      });
    });
    current_draw.bye_placements = bye_placements;
    return bye_placements;

    function getBye(source) {
      var item = randomPop(source);
      var rand = Math.floor(Math.random() * 2);
      if (item) return item[rand];
      console.log({
        error: "unable to pop",
        source: source
      });
    }
  }

  fx.rrByeDistribution = rrByeDistribution;

  function rrByeDistribution(_ref37) {
    var draw = _ref37.draw;
    var byes = draw.brackets.length * draw.bracket_size - draw.opponents.length;

    if (byes > draw.brackets.length) {
      // console.log('ERROR: There should never be more byes than brackets');
      // Should only occur when too few players have been added to generate
      return false;
    }

    draw.bye_placements = range$1(byes).map(function (b, i) {
      draw.brackets[i].byes = [{
        position: 2
      }];
      return {
        bracket: i,
        position: 2
      };
    });
  }

  function unplacedTeams(draw) {
    var _ref38;

    /*
      let seeds = (draw.seeded_teams && Object.keys(draw.seeded_teams)) || [];
      let placed_seeds = [].concat(...(draw.seed_placements && draw.seed_placements.map(s=>s.placements.map(p=>p.seed))) || []);
      let unplaced_seeds = seeds.map(s=>+s).filter(s => placed_seeds.indexOf(s) < 0);
      let unplaced_seed_teams = draw.seeded_teams && unplaced_seeds.map(s=>draw.seeded_teams[s]);
      */
    var unseeded_placements = draw.unseeded_placements ? (_ref38 = []).concat.apply(_ref38, draw.unseeded_placements.map(function (p) {
      return p.team.map(function (m) {
        return m.id;
      });
    })) : [];
    var unplaced_unseeded = draw.unseeded_teams.filter(function (team) {
      return unseeded_placements.indexOf(team[0].id) < 0;
    });
    return unplaced_unseeded;
  }

  fx.rrUnseededPlacements = rrUnseededPlacements;

  function rrUnseededPlacements(_ref39) {
    var draw = _ref39.draw;

    if (o.separation.team) {
      randomRRunseededSeparation({
        draw: draw
      });
    } else {
      randomRRunseededDistribution({
        draw: draw
      });
    }
  } // Avoidance / Separation


  function randomRRunseededSeparation(_ref40) {
    var draw = _ref40.draw;
    var exit = false;
    var unfilled_positions = fx.drawInfo(draw).unfilled_positions;
    if (!draw.unseeded_placements) draw.unseeded_placements = [];
    /**
     * for each unfilled_position find the team of all other players in the
     * bracket, then get array of all unplaced players who don't share the same team,
     * then random pop from this group to make assignment...
     * if there are no unplaced players with different team, then random pop from all unplaced players
     */

    var _loop2 = function _loop2() {
      var position = randomPop(unfilled_positions);
      var teams = bracketTeams(draw.brackets[position.bracket]);
      var unplaced_teams = unplacedTeams(draw);
      var team_diff = unplaced_teams.filter(function (team) {
        return teams.indexOf(team[0].team) < 0;
      });

      if (o.separation.team && team_diff.length) {
        var team = randomPop(team_diff);
        placeTeam(team, position);
      } else if (unplaced_teams.length) {
        var _team = randomPop(unplaced_teams);

        placeTeam(_team, position);
      } else {
        console.log("ERROR");
        exit = true;
      }
    };

    while (unfilled_positions.length && !exit) {
      _loop2();
    }

    function placeTeam(team, position) {
      fx.pushBracketTeam({
        draw: draw,
        team: team,
        bracket_index: position.bracket,
        position: position.position
      });
      draw.unseeded_placements.push({
        team: team,
        position: position
      });
    }

    function bracketTeams(bracket) {
      if (!bracket || !bracket.players) return [];
      return bracket.players.map(function (player) {
        return player.team;
      });
    }
  }

  function randomRRunseededDistribution(_ref41) {
    var draw = _ref41.draw;
    var unfilled_positions = fx.drawInfo(draw).unfilled_positions;
    draw.unseeded_placements = draw.unseeded_teams.map(function (team) {
      var position = randomPop(unfilled_positions);
      fx.pushBracketTeam({
        draw: draw,
        team: team,
        bracket_index: position.bracket,
        position: position.position
      });
      return {
        team: team,
        position: position
      };
    });
  }

  fx.distributeQualifiers = distributeQualifiers;

  function distributeQualifiers(_ref42) {
    var draw = _ref42.draw,
        num_qualifiers = _ref42.num_qualifiers;
    var current_draw = draw.compass ? draw[draw.compass] : draw;
    var info = drawInfo(current_draw);
    var total = info.draw_positions.length; // let bye_positions = info.byes.map(b=>b.data.dp);

    var unassigned_positions = info.unassigned.map(function (u) {
      return u.data.dp;
    });

    var randomBinary = function randomBinary() {
      return Math.floor(Math.random() * 2);
    };

    num_qualifiers = num_qualifiers || current_draw.qualifiers || 0; // reverse qualifiers so that popping returns in numerical order

    var qualifiers = range$1(0, num_qualifiers).map(function () {
      return [{
        entry: "Q",
        qualifier: true
      }];
    }).reverse();
    var section_size = Math.floor(total / num_qualifiers);
    var sections = range$1(0, Math.floor(total / section_size)); // all draw positions which have a first-round opponent (no structural bye);
    // let paired_positions = info.nodes.filter(f=>+f.height === 1 && f.children).map(m=>[].concat(...m.children.map(c=>c.data.dp)));
    // paired positions which have no byes
    // TODO: don't place qualifiers with BYEs unless there is no alternative
    // let pairs_no_byes = paired_positions.filter(f=>intersection(bye_positions, f).length > 0);

    range$1(0, num_qualifiers).forEach(function () {
      var section = randomPop(sections);
      var dprange = range$1(section * section_size + 1, section * section_size + section_size + 1);
      var available_positions = intersection(dprange, unassigned_positions);
      var position = randomBinary() ? available_positions.shift() : available_positions.pop();

      if (position) {
        var team = qualifiers.pop();
        assignPosition({
          node: current_draw,
          position: position,
          team: team,
          qualifier: true
        });
      }
    });
    qualifiers.forEach(function (team) {
      info = drawInfo(current_draw);
      var available_positions = info.unassigned.map(function (u) {
        return u.data.dp;
      });
      var position = available_positions.pop();
      assignPosition({
        node: current_draw,
        position: position,
        team: team,
        qualifier: true
      });
    });
  }

  fx.seededTeams = seededTeams;

  function seededTeams(_ref43) {
    var teams = _ref43.teams;
    // this is an object that acts like an array... because there is no '0' seed
    return Object.assign.apply(Object, [{}].concat(teams.filter(function (f) {
      return f[0].seed;
    }).sort(function (a, b) {
      return a[0].seed - b[0].seed;
    }).map(function (t) {
      var _ref44;

      return _ref44 = {}, _ref44[t[0].seed] = t, _ref44;
    })));
  }

  fx.placeSeedGroups = placeSeedGroups;

  function placeSeedGroups(_ref45) {
    var draw = _ref45.draw,
        count = _ref45.count;
    var current_draw = draw.compass ? draw[draw.compass] : draw;
    if (!current_draw.seed_placements || !current_draw.seeded_teams) return; // if no count is specified, place all seed groups

    count = count || current_draw.seed_placements.length;
    range$1(0, count).forEach(function () {
      return placeSeedGroup({
        draw: current_draw
      });
    });
  }

  fx.placeSeedGroup = placeSeedGroup;

  function placeSeedGroup(_ref46) {
    var draw = _ref46.draw,
        group_index = _ref46.group_index;
    var current_draw = draw.compass ? draw[draw.compass] : draw;
    if (!current_draw.seed_placements || !current_draw.seeded_teams) return;
    var seed_group = group_index !== undefined ? current_draw.seed_placements[group_index] : nextSeedGroup({
      draw: current_draw
    });
    if (!seed_group) return; // make a copy so original is not diminshed by pop()

    var positions = seed_group.positions.slice(); // pre-round draws place byes before remaining seeds... because all ranked players are seedeed

    if (current_draw.bye_placements) positions = positions.filter(function (p) {
      return current_draw.bye_placements.indexOf(p) < 0;
    });
    var missing_seeds = [];
    seed_group.range.forEach(function (seed) {
      // positions should already be randomized
      var position = positions.pop();
      var team = current_draw.seeded_teams[seed];

      if (!team) {
        seed_group.positions = seed_group.positions.filter(function (p) {
          return +p !== +position;
        });
        missing_seeds.push(seed);
        return;
      }

      if (current_draw.brackets) {
        // procesing a round robin
        fx.pushBracketTeam({
          draw: current_draw,
          team: team,
          bracket_index: position.bracket,
          position: position.position
        });
      } else {
        // processing a tree draw
        assignPosition({
          node: current_draw,
          position: position,
          team: team
        });
      }

      seed_group.placements.push({
        seed: seed,
        position: position
      });
    });

    if (missing_seeds.length) {
      missing_seeds.forEach(function (s) {
        return seed_group.range = seed_group.range.filter(function (r) {
          return r !== s;
        });
      });
    }
  }

  fx.pushBracketTeam = function (_ref47) {
    var draw = _ref47.draw,
        team = _ref47.team,
        bracket_index = _ref47.bracket_index,
        position = _ref47.position;
    var player = team[0];
    player.draw_position = position;
    draw.brackets[bracket_index].players.push(player);
    team.forEach(function (opponent) {
      return opponent.draw_position = position;
    });
    draw.brackets[bracket_index].teams.push(team);
  };

  fx.nextSeedGroup = nextSeedGroup;

  function nextSeedGroup(_ref48) {
    var draw = _ref48.draw;
    var current_draw = draw.compass ? draw[draw.compass] : draw;
    var unplaced = unplacedSeedGroups({
      draw: current_draw
    });
    return unplaced ? unplaced[0] : undefined;
  }

  fx.unplacedSeedGroups = unplacedSeedGroups;

  function unplacedSeedGroups(_ref49) {
    var draw = _ref49.draw;
    var current_draw = draw.compass ? draw[draw.compass] : draw;
    if (!current_draw.seed_placements || !Array.isArray(current_draw.seed_placements)) return;
    return current_draw.seed_placements.filter(function (sp) {
      return sp.range.length !== sp.placements.length;
    });
  }

  fx.roundMatches = function (_ref50) {
    var info = _ref50.info,
        round = _ref50.round;
    var all_matches = info && info.all_matches;
    var round_matches = round !== undefined && all_matches && all_matches.filter(function (n) {
      return n.height === round && !byeNode(n);
    }).length || 0;
    return round_matches;
  };

  fx.placeUnseededTeams = placeUnseededTeams;

  function placeUnseededTeams(_ref51) {
    var draw = _ref51.draw;
    var current_draw = draw.compass ? draw[draw.compass] : draw;
    if (!current_draw.unseeded_teams) return;

    if (o.separation.team && draw.opponents) {
      randomUnseededSeparation({
        draw: current_draw
      });
    } else {
      randomUnseededDistribution({
        draw: current_draw
      });
    }
  }

  function randomUnseededDistribution(_ref52) {
    var draw = _ref52.draw;
    var unfilled_positions = drawInfo(draw).unassigned.map(function (u) {
      return u.data.dp;
    });
    unfilled_positions.forEach(function (position) {
      var team = randomPop(draw.unseeded_teams);
      if (team) assignPosition({
        node: draw,
        position: position,
        team: team
      });
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


  function findCandidate(_ref53) {
    var _ref54;

    var draw = _ref53.draw;
    var info = fx.drawInfo(draw);
    var draw_positions = info.draw_positions.sort(sortNumber);
    var structural_bye_positions = info.structural_byes.map(function (b) {
      return b.data.dp;
    });
    var draw_size = draw_positions.concat.apply(draw_positions, structural_bye_positions).length;
    var unassigned_positions = info.unassigned.map(function (u) {
      return u.data.dp;
    }).sort(sortNumber);
    var remaining = unassigned_positions && unassigned_positions.length || 0;
    if (!remaining) return {};
    var largestGroup = unpairedPositions(unassigned_positions);

    var _findOpponent = findOpponent({
      largestGroup: largestGroup
    }),
        opponent = _findOpponent.opponent; // console.log({opponent, largestGroup});


    var opponent_teams = Object.assign.apply(Object, [{}].concat((_ref54 = []).concat.apply(_ref54, draw.opponents).map(function (o) {
      var _ref55;

      return _ref55 = {}, _ref55[o.id] = o.team, _ref55;
    })));
    var grouping_positions = Object.keys(info.assigned_positions).map(groupingPosition);
    var opponent_groupings = opponent.map(function (o) {
      return o.team;
    });
    var opponent_grouping_positions = grouping_positions.filter(function (gp) {
      return opponent_groupings.indexOf(gp.name) >= 0;
    }).map(function (gp) {
      return gp.position;
    });
    var all_positions = range(1, draw_size + 1);
    var chunk_sizes = range(2, draw_size).filter(function (f) {
      return f === nearestPow2(f);
    }).reverse();
    var chunks = chunk_sizes.map(function (size) {
      return chunkArray(all_positions, size);
    });
    var vetted = chunks.map(chunkRow);
    var group_not_present = vetted.map(function (row) {
      return row.filter(function (r) {
        return !r.group_present;
      });
    }).filter(function (f) {
      return f;
    });
    var no_group_unpaired = group_not_present.map(function (row) {
      return row.filter(function (r) {
        return r.unpaired.length;
      }).map(function (m) {
        return m.unpaired;
      });
    }).filter(function (f) {
      return f && f.length;
    });
    var no_group_unassigned = group_not_present.map(function (row) {
      return row.filter(function (r) {
        return r.unassigned.length;
      }).map(function (m) {
        return m.unassigned;
      });
    }).filter(function (f) {
      return f && f.length;
    });
    var viable_sections = no_group_unpaired.length && no_group_unpaired[0] || no_group_unassigned.length && no_group_unassigned[0];
    var position;

    if (viable_sections) {
      var section = randomPop(viable_sections);
      position = randomPop(section);
    } else {
      position = randomPop(unassigned_positions);
    }

    return {
      opponent: opponent,
      position: position,
      remaining: remaining
    };

    function findOpponent(_temp) {
      var _ref56 = _temp === void 0 ? {} : _temp,
          _ref56$largestGroup = _ref56.largestGroup,
          largestGroup = _ref56$largestGroup === void 0 ? true : _ref56$largestGroup;

      var assigned = Object.keys(info.assigned_positions);
      var unplaced_opponents = draw.opponents.filter(function (o) {
        return assigned.indexOf(o[0].id) < 0;
      });
      var groupings = {};
      unplaced_opponents.forEach(function (team) {
        var grouping = teamGrouping(team);
        groupings[grouping] = groupings[grouping] ? groupings[grouping].concat([team]) : [team];
      });
      var max_length = Object.keys(groupings).reduce(function (p, c) {
        return groupings[c].length > p ? groupings[c].length : p;
      }, 0);
      var min_length = Object.keys(groupings).reduce(function (p, c) {
        return groupings[c].length < p ? groupings[c].length : p;
      }, max_length);
      var groupings_meets_max = Object.keys(groupings).filter(function (f) {
        return groupings[f].length === max_length;
      });
      var groupings_meets_min = Object.keys(groupings).filter(function (f) {
        return groupings[f].length === min_length;
      });
      var random_group = largestGroup ? randomPop(groupings_meets_max) : randomPop(groupings_meets_min);
      var random_opponent = randomPop(groupings[random_group]); // console.log({ groupings, max_length, groupings_meets_max, random_group, random_opponent, unplaced_opponents });

      return {
        opponent: random_opponent
      };

      function teamGrouping(team) {
        return team.map(function (t) {
          return t.team;
        }).sort().join("|");
      }
    }

    function unpairedPositions(positions) {
      var true_positions = positions.map(truePosition);
      return positions.filter(function (u) {
        return !pairAssigned(u);
      });

      function pairAssigned(u) {
        var true_position = truePosition(u);
        var true_pair = true_position % 2 ? true_position + 1 : true_position - 1;
        return true_positions.indexOf(true_pair) < 0;
      }
    }

    function checkChunk(chunk) {
      var unassigned = unassigned_positions.filter(function (u) {
        return chunk.indexOf(truePosition(u)) >= 0;
      });
      var unpaired = unpairedPositions(unassigned);
      var group_present = opponent_grouping_positions.reduce(function (p, g) {
        return chunk.indexOf(truePosition(g)) >= 0 ? true : p;
      }, false);
      return {
        unassigned: unassigned,
        unpaired: unpaired,
        group_present: group_present
      };
    }

    function chunkArray(arr, chunksize) {
      return arr.reduce(function (all, one, i) {
        var ch = Math.floor(i / chunksize);
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
      var isEven = function isEven(x) {
        return !(x & 1);
      };

      var position = p + structural_bye_positions.filter(function (s) {
        return s < p;
      }).length;
      return structural_bye_positions.indexOf(p) >= 0 && isEven(p) ? position + 1 : position;
    }

    function nearestPow2(val) {
      return Math.pow(2, Math.round(Math.log(val) / Math.log(2)));
    }

    function range(start, end) {
      return Array.from({
        length: end - start
      }, function (v, k) {
        return k + start;
      });
    }

    function randomPop(array) {
      return array.length ? array.splice(Math.floor(Math.random() * array.length), 1)[0] : undefined;
    }

    function groupingPosition(opponent_id) {
      return {
        name: opponent_teams[opponent_id],
        position: info.assigned_positions[opponent_id]
      };
    }
  } // Avoidance / Separation


  function randomUnseededSeparation(_ref57) {
    var draw = _ref57.draw;

    var _findCandidate = findCandidate({
      draw: draw
    }),
        opponent = _findCandidate.opponent,
        position = _findCandidate.position,
        remaining = _findCandidate.remaining;

    for (var count = 0; count < remaining; count++) {
      if (opponent) assignPosition({
        node: draw,
        position: position,
        team: opponent
      });

      var _findCandidate2 = findCandidate({
        draw: draw
      });

      opponent = _findCandidate2.opponent;
      position = _findCandidate2.position;
    }
  }

  fx.matchNodes = matchNodes;

  function matchNodes(data) {
    return drawInfo(data).match_nodes;
  }

  fx.matchNode = matchNode;

  function matchNode(node) {
    var teams = matchTeams(node);
    return teams.length === 2 ? teams : false;
  }

  fx.matchTeams = matchTeams;

  function matchTeams(node) {
    if (!node || !node.data || !node.data.children) return false;
    node.data.children.forEach(function (child) {
      if (child && child.team && child.dp && child.team[0] && child.team[0].draw_position !== child.dp) {
        child.team.forEach(function (team) {
          return team.draw_position = child.dp;
        });
      }
    });
    var teams = node.data.children.map(function (m) {
      return m.team;
    }).filter(function (f) {
      return f;
    });
    return teams;
  }

  fx.feedNode = feedNode;

  function feedNode(node) {
    if (!node || !node.data || !node.data.children) return false;
    var feed_arms = node.data.children.map(function (m) {
      return m.feed;
    }).filter(function (f) {
      return f;
    });
    return feed_arms.length === 1 ? true : false;
  }

  fx.feedNodes = feedNodes;

  function feedNodes(nodes) {
    return nodes.filter(feedNode);
  }

  fx.byeTeams = byeTeams;

  function byeTeams(node) {
    if (!node.data.children) return false;
    var teams = matchNode(node);
    if (!teams) return false;
    var test = node.data.children.map(function (d) {
      return d.bye;
    }).filter(function (f) {
      return f;
    });
    if (!test.length) return false;
    return test.reduce(function (a, b) {
      return a && b;
    }) ? teams : false;
  }

  fx.byeNode = byeNode;

  function byeNode(node) {
    if (!node.children) return false;
    var test = node.data.children.map(function (d) {
      return d.bye;
    }).filter(function (f) {
      return f;
    });
    if (test.length) return test.length;
  }

  fx.teamMatch = teamMatch;

  function teamMatch(node, includeQualifiers) {
    if (includeQualifiers === void 0) {
      includeQualifiers = true;
    }

    if (!node.children) return false;
    var teams = matchNode(node);
    if (!teams) return false;
    var test = node.data.children.map(isAteam).filter(function (f) {
      return f;
    });
    if (test.length < 2) return false;
    return test.reduce(function (a, b) {
      return a && b;
    }) ? teams : false;

    function isAteam(d) {
      if (d.bye) return false;
      if (d.qualifier && includeQualifiers) return false;
      return true;
    }
  }

  fx.drawPositionsWithBye = drawPositionsWithBye;

  function drawPositionsWithBye(teams) {
    var _ref58;

    return unique((_ref58 = []).concat.apply(_ref58, teams.map(function (node) {
      var _ref59;

      return (_ref59 = []).concat.apply(_ref59, node.map(function (team) {
        return team.map(function (player) {
          return !player.bye ? player.draw_position : undefined;
        });
      }));
    }))).filter(function (f) {
      return f;
    });
  }

  fx.replaceEmptiesWithByes = replaceEmptiesWithByes;

  function replaceEmptiesWithByes(_ref60) {
    var draw = _ref60.draw;
    var info = drawInfo(draw);
    var assigned_positions = info && Object.keys(info.assigned_positions).map(function (k) {
      return info.assigned_positions[k];
    }) || [];
    var bye_positions = (info && info.draw_positions || []).filter(function (p) {
      return assigned_positions.indexOf(p) < 0;
    });
    bye_positions.forEach(function (position) {
      assignPosition({
        node: draw,
        position: position,
        bye: true
      });
    });
  }

  fx.advanceTeamsWithByes = advanceTeamsWithByes;

  function advanceTeamsWithByes(_ref61) {
    var _ref62;

    var draw = _ref61.draw;
    var info = drawInfo(draw); // let winner_positions = (info && info.match_nodes && info.match_nodes.filter(n=>n.data.match && n.data.match.winner).map(n=>n.data.dp)) || [];
    // let bye_teams = info.nodes.filter(f=>byeTeams(f)).map(m=>matchNode(m));
    // let team_positions = drawPositionsWithBye(bye_teams).filter(p=>winner_positions.indexOf(p) < 0);
    // team_positions.forEach(p => advancePosition({ draw, position: p, onlyIfBye: true }));

    var match_nodes = info.match_nodes.filter(function (n) {
      return !n.data.team;
    });
    var unadvanced = match_nodes.filter(function (m) {
      return m.children.reduce(function (p, c) {
        return c.data.bye || p;
      }, undefined);
    });

    var unadvanced_dp = (_ref62 = []).concat.apply(_ref62, unadvanced.map(function (u) {
      return u.children.map(function (c) {
        return c.data.dp;
      });
    }));

    var bye_dp = info.byes.map(function (b) {
      return b.data.dp;
    });
    var unadvanced_player_dp = unadvanced_dp.filter(function (u) {
      return bye_dp.indexOf(u) < 0;
    });
    unadvanced_player_dp.forEach(function (p) {
      return advancePosition({
        draw: draw,
        position: p,
        onlyIfBye: true
      });
    });
    if (info.bye_nodes) info.bye_nodes.forEach(function (b) {
      if (b.data && b.data.match) {
        delete b.data.match.schedule;
      }
    });
    var unadvanced_double_byes = info.double_bye_nodes.filter(function (n) {
      return !hasBye(n);
    }).map(function (n) {
      return n.data.children[0].dp;
    });
    unadvanced_double_byes.forEach(function (p) {
      advancePosition({
        draw: draw,
        position: p,
        bye: true,
        onlyIfBye: true
      });
    });
    if (unadvanced_double_byes.length) return advanceTeamsWithByes({
      draw: draw
    });
  }

  function hasBye(node) {
    return node.data && node.data.team && node.data.team.reduce(function (p, c) {
      return c.bye || p;
    }, undefined);
  }

  fx.findDualMatchNodeByMatch = function (draw, muid) {
    var dual_match_muid = fx.findDualMatchMuid(draw, muid);
    return fx.findDualMatchNode(draw, dual_match_muid);
  };

  fx.findDualMatchNode = function (draw, dual_match_muid) {
    var info = draw && drawInfo(draw);
    return info && info.match_nodes && info.match_nodes.reduce(function (p, c) {
      return c.data.match && c.data.match.muid === dual_match_muid ? c : p;
    }, undefined);
  };

  fx.findDualMatchMuid = function (draw, muid) {
    return draw.dual_matches && Object.keys(draw.dual_matches).reduce(function (p, c) {
      return draw.dual_matches[c].matches.reduce(function (x, y) {
        return y.match.muid === muid ? y : x;
      }, undefined) ? c : p;
    }, undefined);
  };

  fx.findRRDualMatch = function (draw, muid) {
    var dual_match_muid = fx.findDualMatchMuid(draw, muid);
    var dual_matches = fx.matches(draw);
    var dual_match = dual_matches.reduce(function (p, c) {
      return c.match.muid === dual_match_muid ? c : p;
    }, undefined);
    return dual_match;
  };

  fx.findMatchNodeByTeamPositions = findMatchNodeByTeamPositions;

  function findMatchNodeByTeamPositions(draw, positions) {
    var info = drawInfo(draw);
    var match_nodes = info && info.match_nodes || [];
    var nodes = match_nodes.filter(function (f) {
      return fx.teamMatch(f);
    }).filter(function (match_node) {
      var match_positions = match_node.data.children.map(function (c) {
        return c.team ? c.team[0].draw_position : undefined;
      });
      return intersection(positions, match_positions).length === 2;
    });
    return nodes.length ? nodes[0].data : undefined;
  }

  fx.upcomingMatches = upcomingMatches;

  function upcomingMatches(data, round_names, calculated_round_names) {
    if (round_names === void 0) {
      round_names = [];
    }

    if (calculated_round_names === void 0) {
      calculated_round_names = [];
    }

    if (!data) return [];
    if (data.compass) return upcomingCompassMatches(data);
    var info = drawInfo(data);
    if (!info) return [];

    if (info.draw_type === "tree") {
      var round_offset = data.max_round ? info.depth - data.max_round : 0;
      return treeMatches({
        match_nodes: info.upcoming_match_nodes,
        max_round: data.max_round,
        round_offset: round_offset,
        round_names: round_names,
        calculated_round_names: calculated_round_names,
        potentials: true
      });
    }

    return [];
  }

  fx.treeMatches = treeMatches;

  function treeMatches(_ref63) {
    var match_nodes = _ref63.match_nodes,
        max_round = _ref63.max_round,
        _ref63$round_offset = _ref63.round_offset,
        round_offset = _ref63$round_offset === void 0 ? 0 : _ref63$round_offset,
        _ref63$round_names = _ref63.round_names,
        round_names = _ref63$round_names === void 0 ? [] : _ref63$round_names,
        _ref63$calculated_rou = _ref63.calculated_round_names,
        calculated_round_names = _ref63$calculated_rou === void 0 ? [] : _ref63$calculated_rou,
        potentials = _ref63.potentials,
        draw = _ref63.draw;
    var matches = match_nodes.filter(function (n) {
      return potentials || teamMatch(n);
    }).filter(function (n) {
      return max_round ? n.height <= max_round : true;
    }).map(function (node) {
      var round_name = round_names.length ? round_names[node.depth - round_offset] : undefined;
      if (round_name) node.data.round_name = round_name;
      var calculated_round_name = calculated_round_names.length ? calculated_round_names[node.depth - round_offset] : undefined;
      if (calculated_round_name) node.data.calculated_round_name = calculated_round_name;
      if (node.data.match && round_name) node.data.match.round_name = round_name;
      var potentials = node.data.children.filter(function (c) {
        return !c.team;
      }).map(function (p) {
        return p.children ? p.children.map(function (l) {
          return l.team;
        }) : undefined;
      });
      var dependencies = node.data.children.filter(function (c) {
        return !c.team;
      }).map(function (d) {
        return d.match && d.match.muid;
      });
      var dependent = node.parent && node.parent.data && node.parent.data.match && node.parent.data.match.muid;
      var this_match = {
        dependent: dependent,
        round_name: round_name,
        potentials: potentials,
        dependencies: dependencies,
        source: node,
        round: node.height,
        calculated_round_name: calculated_round_name,
        match: node.data.match,
        teams: node.data.children.map(function (c) {
          return c.team;
        }).filter(function (f) {
          return f;
        })
      };
      if (draw) this_match.draw = draw;
      return this_match;
    });
    return matches;
  }

  var compass_data = {
    pre: {
      east: "E",
      west: "W",
      north: "N",
      south: "S",
      northeast: "NE",
      northwest: "NW",
      southeast: "SE",
      southwest: "SW"
    },
    names: ["F", "SF", "QF", "R16", "R32", "R64", "R128", "R256", "R512"]
  };

  function upcomingCompassMatches(data) {
    var _ref64;

    var matches = (_ref64 = []).concat.apply(_ref64, Object.keys(compass_data.pre).filter(function (key) {
      return data[key];
    }).map(function (key) {
      var info = drawInfo(data[key]);
      var max_round = data[key].max_round;
      var round_offset = max_round ? info.depth - max_round : 0;
      var round_names = compass_data.names.map(function (n) {
        return compass_data.pre[key] + "-" + n;
      });
      return treeMatches({
        match_nodes: info.upcoming_match_nodes,
        max_round: max_round,
        round_offset: round_offset,
        round_names: round_names,
        potentials: true
      });
    })).filter(function (m) {
      return m && m.match;
    });

    return matches;
  }

  function compassMatches(data, all) {
    var _ref65;

    var matches = (_ref65 = []).concat.apply(_ref65, Object.keys(compass_data.pre).filter(function (key) {
      return data[key];
    }).map(function (key) {
      var info = drawInfo(data[key]);
      var max_round = data[key].max_round;
      var round_offset = max_round ? info.depth - max_round : 0;
      var round_names = compass_data.names.map(function (n) {
        return compass_data.pre[key] + "-" + n;
      });
      var match_nodes = all ? info.all_matches : info.match_nodes;
      return treeMatches({
        match_nodes: match_nodes,
        max_round: max_round,
        round_offset: round_offset,
        round_names: round_names,
        potentials: all,
        draw: key
      });
    }));

    return matches;
  }

  fx.extractDrawPlayers = function (draw) {
    var _ref66;

    var players = [];
    var draw_positions = [];

    (_ref66 = []).concat.apply(_ref66, fx.drawInfo(draw).nodes.map(function (n) {
      return n.data && n.data.team;
    })).forEach(function (p) {
      if (draw_positions.indexOf(p.draw_position) < 0) {
        draw_positions.push(p.draw_position);
        players.push(p);
      }
    });

    return players;
  }; // will be replaced by drawMatches module


  fx.matches = matches;

  function matches(data, round_names, calculated_round_names, all) {
    if (round_names === void 0) {
      round_names = [];
    }

    if (calculated_round_names === void 0) {
      calculated_round_names = [];
    }

    if (!data) return [];
    if (data.compass) return compassMatches(data, all);
    var info = drawInfo(data);
    if (!info) return data.matches || [];

    if (info.draw_type === "tree") {
      var round_offset = data.max_round ? info.depth - data.max_round : 0;
      var match_nodes = all ? info.all_matches : info.match_nodes;
      return treeMatches({
        match_nodes: match_nodes,
        max_round: data.max_round,
        round_offset: round_offset,
        round_names: round_names,
        calculated_round_names: calculated_round_names,
        potentials: all
      });
    }

    if (info.draw_type === "roundrobin") {
      var _ref67;

      data.brackets.forEach(function (b, i) {
        return bracketMatches(data, i);
      });

      var _matches3 = (_ref67 = []).concat.apply(_ref67, data.brackets.map(function (bracket) {
        return bracket.matches;
      })).map(function (match) {
        return {
          teams: match.teams || match.players.map(function (p) {
            return [p];
          }),
          round_name: match.round_name,
          result_order: match.result_order,
          match: match
        };
      });

      return _matches3;
    }

    return [];
  }

  fx.tallyBracketAndModifyPlayers = function (_ref68) {
    var matches = _ref68.matches,
        teams = _ref68.teams,
        per_player = _ref68.per_player,
        reset = _ref68.reset,
        qualifying = _ref68.qualifying,
        matchFormat = _ref68.matchFormat;
    if (!matches || !matches.length) return;
    per_player = per_player || teams && teams.length - 1 || 1;
    var tbr = tallyBracket({
      matches: matches,
      per_player: per_player,
      qualifying: qualifying,
      matchFormat: matchFormat
    });

    var instanceCount = function instanceCount(values) {
      return values.reduce(function (a, c) {
        // eslint-disable-next-line
        a[c]++ ? 0 : a[c] = 1;
        return a;
      }, {});
    };

    var qordz = Object.keys(tbr.team_results).map(function (t) {
      return tbr.team_results[t].qorder;
    });
    var ic = instanceCount(qordz);
    var valid_for_suborder = Object.keys(ic).reduce(function (p, c) {
      return ic[c] > 1 ? p.concat(parseInt(c)) : p;
    }, []);
    matches.forEach(function (match) {
      return match.results_order = tbr.match_result_order[match.muid];
    });
    teams.forEach(function (team) {
      var phash = playersHash(team);

      if (tbr.team_results[phash]) {
        team.forEach(function (player) {
          player.qorder = tbr.team_results[phash].qorder;

          if (reset) {
            // in this case sub_order is overridden
            player.sub_order = tbr.team_results[phash].sub_order;
          } else {
            // in this context sub_order give preference to existing value
            player.sub_order = valid_for_suborder.indexOf(player.qorder) >= 0 && player.sub_order || tbr.team_results[phash].sub_order;
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
            ratio_hash: tbr.team_results[phash].ratio_hash
          };
          player.result = tbr.team_results[phash].result;
          player.games = tbr.team_results[phash].games;
        });
      }
    });
    return true;
  };

  fx.tallyBracket = tallyBracket;

  function tallyBracket(_ref69) {
    var matches = _ref69.matches,
        per_player = _ref69.per_player,
        qualifying = _ref69.qualifying,
        matchFormat = _ref69.matchFormat;
    var bracket_match_format = matchFormatCode.parse(matchFormat) || {}; // if bracket is incomplete don't use expected matches per_player for calculating

    var bracket_complete = matches && matches.length && matches.filter(function (m) {
      return m.winner;
    }).length === matches.length;
    if (!bracket_complete) per_player = 0;
    var disqualified = [];
    var team_results = {};
    var match_result_order = {};
    var h2h = o.rr_h2h_priority;
    if (!matches) return; // for all matches winner score comes first!

    matches.filter(function (f) {
      return f;
    }).forEach(function (match) {
      var match_format = matchFormatCode.parse(match.matchFormat || matchFormat) || {};

      if (match.winner && match.loser) {
        var wH = getIdentifier(match.winner);
        var lH = getIdentifier(match.loser);

        if (!wH || !lH) {
          // if there is an undefined winner/loser then the match was cancelled
          var team1 = match.teams && match.teams[0] && getIdentifier(match.teams[0]);
          var team2 = match.teams && match.teams[1] && getIdentifier(match.teams[1]);

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
        if (match.score && disqualifyingScore(match.score)) disqualified.push(lH);
        team_results[wH].matches_won += 1;
        team_results[lH].matches_lost += 1;
        team_results[lH].defeats.push(wH);
        team_results[wH].victories.push(lH);
        var sets_tally = countSets(match.score, 0, match_format);
        team_results[wH].sets_won += sets_tally[0];
        team_results[wH].sets_lost += sets_tally[1];
        team_results[lH].sets_won += sets_tally[1];
        team_results[lH].sets_lost += sets_tally[0];
        var games_tally = countGames(match.score, 0, match_format);
        team_results[wH].games_won += games_tally[0];
        team_results[wH].games_lost += games_tally[1];
        team_results[lH].games_won += games_tally[1];
        team_results[lH].games_lost += games_tally[0];
        var points_tally = countPoints(match.score);
        team_results[wH].points_won += points_tally[0];
        team_results[wH].points_lost += points_tally[1];
        team_results[lH].points_won += points_tally[1];
        team_results[lH].points_lost += points_tally[0];
      } else {
        if (match.teams) match.teams.forEach(function (team) {
          return checkTeam(getIdentifier(team));
        });
      }
    });

    function getIdentifier(opponent) {
      if (!Array.isArray(opponent) && opponent.players && opponent.id) {
        return opponent.id;
      }

      return playersHash(opponent);
    }

    function checkTeam(phash) {
      if (!team_results[phash]) team_results[phash] = {
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
        points_lost: 0
      };
    } // the difference here is totlas must be calcuulated using the expected
    // match scoring format for the bracket, not the inidivudal match formats


    var bracket_sets_to_win = scoreFx.setsToWin(bracket_match_format.bestOf);
    var bracket_games_for_set = bracket_match_format.setFormat && bracket_match_format.setFormat.setTo;
    Object.keys(team_results).forEach(function (phash) {
      var sets_numerator = team_results[phash].sets_won;
      var sets_denominator = team_results[phash].sets_lost;
      var sets_total = per_player * (bracket_sets_to_win || 0) || sets_numerator;
      var sets_ratio = Math.round(sets_numerator / sets_denominator * 1000) / 1000;
      if (sets_ratio === Infinity || isNaN(sets_ratio)) sets_ratio = sets_total;
      var matches_numerator = team_results[phash].matches_won;
      var matches_denominator = team_results[phash].matches_lost;
      var matches_ratio = Math.round(matches_numerator / matches_denominator * 1000) / 1000;
      if (matches_ratio === Infinity || isNaN(matches_ratio)) matches_ratio = matches_numerator;
      var games_numerator = team_results[phash].games_won;
      var games_denominator = team_results[phash].games_lost;
      var games_total = per_player * (bracket_sets_to_win || 0) * (bracket_games_for_set || 0) || games_numerator;
      var games_ratio = Math.round(games_numerator / games_denominator * 1000) / 1000;

      if (games_ratio === Infinity || isNaN(games_ratio)) {
        games_ratio = games_total;
      }

      var games_difference = games_denominator >= games_numerator ? 0 : games_numerator - games_denominator;
      var points_ratio = Math.round(team_results[phash].points_won / team_results[phash].points_lost * 1000) / 1000;
      if (points_ratio === Infinity || isNaN(points_ratio)) points_ratio = 0;
      team_results[phash].sets_ratio = sets_ratio;
      team_results[phash].matches_ratio = matches_ratio;
      team_results[phash].games_ratio = games_ratio;
      team_results[phash].games_difference = games_difference;
      team_results[phash].points_ratio = points_ratio;
      team_results[phash].result = team_results[phash].matches_won + "/" + team_results[phash].matches_lost;
      team_results[phash].games = team_results[phash].games_won + "/" + team_results[phash].games_lost;
    });
    var order = determineTeamOrder(team_results);

    if (order) {
      var ro_list = order.map(function (o) {
        return o.rank_order;
      });
      order.forEach(function (o) {
        team_results[o.id].ratio_hash = o.ratio_hash;

        if (o !== undefined && o.rank_order !== undefined) {
          team_results[o.id].qorder = o.rank_order;

          if (occurrences(o.rank_order, ro_list) > 1 && team_results[o.id].sub_order === undefined) {
            team_results[o.id].sub_order = 0;
          } else if (occurrences(o.rank_order, ro_list) === 1) {
            team_results[o.id].sub_order = undefined;
          }
        } // calculate order for awarding points


        if (o !== undefined && o.points_order !== undefined) {
          team_results[o.id].points_order = o.points_order;
        } else {
          team_results[o.id].points_order = undefined;
        }
      });
    } // create an object mapping id to order


    var id_order = Object.keys(team_results).reduce(function (o, t) {
      o[t] = team_results[t].points_order;
      return o;
    }, {});
    matches.forEach(function (match) {
      var order = match.winner_index === undefined ? "" : id_order[getIdentifier(match.winner)];
      match_result_order[match.muid] = "RR" + (qualifying ? "Q" : "") + (order || "");
    });
    return {
      team_results: team_results,
      match_result_order: match_result_order
    };

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
      var sets_to_win = scoreFx.setsToWin(match_format.bestOf);
      var sets_tally = [0, 0];
      if (!score) return sets_tally;

      if (disqualifyingScore(score)) {
        if (winner !== undefined && sets_to_win) sets_tally[winner] = sets_to_win;
      } else {
        var set_scores = score.split(" ");
        set_scores.forEach(function (set_score) {
          var divider = set_score.indexOf("-") > 0 ? "-" : set_score.indexOf("/") > 0 ? "/" : undefined;
          var scores = // eslint-disable-next-line no-useless-escape
          /\d+[\(\)\-\/]*/.test(set_score) && divider ? set_score.split(divider).map(function (s) {
            return /\d+/.exec(s)[0];
          }) : undefined;

          if (scores) {
            sets_tally[parseInt(scores[0]) > parseInt(scores[1]) ? 0 : 1] += 1;
          }
        });
      }

      if (retired(score) && winner !== undefined && sets_to_win) {
        // if the loser has sets_to_win then last set was incomplete and needs to be subtracted from loser
        if (+sets_tally[1 - winner] === sets_to_win) sets_tally[1 - winner] -= 1;
        sets_tally[winner] = sets_to_win;
      }

      return sets_tally;
    }

    function countPoints(score) {
      var points_tally = [0, 0];
      if (!score) return points_tally;
      var set_scores = score.split(" ");
      set_scores.forEach(function (set_score) {
        var scores = /\d+\/\d+/.test(set_score) ? set_score.split("/").map(function (s) {
          return /\d+/.exec(s)[0];
        }) : [0, 0];

        if (scores) {
          points_tally[0] += parseInt(scores[0]);
          points_tally[1] += parseInt(scores[1]);
        }
      });
      return points_tally;
    }

    function countGames(score, winner, match_format) {
      var sets_to_win = scoreFx.setsToWin(match_format.bestOf);
      var games_for_set = match_format.setFormat && match_format.setFormat.setTo;
      var tiebreaks_at = match_format.setFormat && match_format.setFormat.tiebreakAt;
      if (!score) return [0, 0];
      var min_winning_games = sets_to_win * games_for_set;
      var games_tally = [[], []];

      if (disqualifyingScore(score)) {
        if (winner !== undefined && sets_to_win && games_for_set) {
          games_tally[winner].push(min_winning_games);
        }
      } else {
        var set_scores = score.split(" ");
        set_scores.forEach(function (set_score) {
          var scores = // eslint-disable-next-line no-useless-escape
          /\d+[\(\)\-\/]*/.test(set_score) && set_score.indexOf("-") > 0 ? set_score.split("-").map(function (s) {
            return /\d+/.exec(s)[0];
          }) : undefined;

          if (scores) {
            games_tally[0].push(parseInt(scores[0]));
            games_tally[1].push(parseInt(scores[1]));
          }
        });
      }

      if (retired(score) && winner !== undefined && sets_to_win && games_for_set) {
        var sets_tally = countSets(score, winner, match_format);
        var total_sets = sets_tally.reduce(function (a, b) {
          return a + b;
        }, 0);
        var loser_lead_set = games_tally.map(function (g) {
          return g[winner] <= g[1 - winner];
        }).reduce(function (a, b) {
          return a + b;
        }, 0); // if sets where loser lead > awarded sets, adjust last game to winner

        if (loser_lead_set > sets_tally[1 - winner]) {
          var tallied_games = games_tally[winner].length;
          var complement = getComplement(games_tally[1 - winner][tallied_games - 1]);
          if (complement) games_tally[winner][tallied_games - 1] = complement;
        } // if the total # of sets is less than games_tally[x].length award games_for_set to winner


        if (total_sets > games_tally[winner].length) {
          games_tally[winner].push(games_for_set);
        }
      }

      var result = [games_tally[0].reduce(function (a, b) {
        return a + b;
      }, 0), games_tally[1].reduce(function (a, b) {
        return a + b;
      }, 0)];
      if (winner !== undefined && result[winner] < min_winning_games) result[winner] = min_winning_games;
      return result;

      function getComplement(value) {
        if (!match_format || value === "") return;
        if (+value === tiebreaks_at - 1 || +value === tiebreaks_at) return parseInt(tiebreaks_at || 0) + 1;
        if (+value < tiebreaks_at) return games_for_set;
        return tiebreaks_at;
      }
    }

    function determineTeamOrder(team_results) {
      var team_ids = Object.keys(team_results);
      var total_opponents = team_ids.length; // order is an array of objects formatted for processing by ties()

      var order = team_ids.reduce(function (arr, team_id, i) {
        arr.push({
          id: team_id,
          i: i,
          results: team_results[team_id]
        });
        return arr;
      }, []);
      var complete = order.filter(function (o) {
        return total_opponents - 1 === o.results.matches_won + o.results.matches_lost + o.results.matches_cancelled;
      }); // if not all opponents have completed their matches, no orders are assigned

      if (total_opponents !== complete.length) {
        return;
      }

      complete.forEach(function (p) {
        return p.order_hash = orderHash(p);
      });
      complete.forEach(function (p) {
        return p.ratio_hash = ratioHash(p);
      }); // START ORDER HASH

      if (h2h) {
        complete.sort(function (a, b) {
          return (b.results.matches_won || 0) - (a.results.matches_won || 0);
        });
        var wins = complete.map(function (p) {
          return p.results.matches_won;
        });
        var counts = unique(wins);
        counts.forEach(function (count) {
          var i = indices(count, wins);

          if (i.length && i.length > 1) {
            var start = Math.min.apply(Math, i);
            var end = Math.max.apply(Math, i);
            var n = end - start + 1;

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

      var hash_order = unique(complete.map(function (c) {
        return c.order_hash;
      }));
      complete.forEach(function (p) {
        return p.hash_order = hash_order.indexOf(p.order_hash) + 1;
      }); // now account for equivalent hash_order

      var rank_order = 0;
      var rank_hash = undefined;
      complete.forEach(function (p, i) {
        if (p.order_hash !== rank_hash) {
          rank_order = i + 1;
          rank_hash = p.order_hash;
        }

        p.rank_order = rank_order;
      }); // END ORDER HASH
      // START RATIO HASH

      if (h2h) {
        complete.sort(function (a, b) {
          return (b.results.matches_won || 0) - (a.results.matches_won || 0);
        });

        var _wins = complete.map(function (p) {
          return p.results.matches_won;
        });

        var _counts = unique(_wins);

        _counts.forEach(function (count) {
          var i = indices(count, _wins);

          if (i.length && i.length > 1) {
            var start = Math.min.apply(Math, i);
            var end = Math.max.apply(Math, i);
            var n = end - start + 1;

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

      var ratio_order = unique(complete.map(function (c) {
        return c.ratio_hash;
      }));
      complete.forEach(function (p) {
        return p.ratio_order = ratio_order.indexOf(p.ratio_hash) + 1;
      }); // points_order is used for awarding points and may differ from
      // rank_order if a player unable to advance due to walkover

      var points_order = 0;
      var ratio_hash = undefined;
      complete.forEach(function (p, i) {
        if (p.ratio_hash !== ratio_hash) {
          points_order = i + 1;
          ratio_hash = p.ratio_hash;
        }

        p.points_order = points_order;
      }); // END RATIO HASH

      return complete;

      function ratioHashSort(a, b) {
        return b.ratio_hash - a.ratio_hash;
      }

      function orderHashSort(a, b) {
        return b.order_hash - a.order_hash;
      }

      function h2hRatio(a, b) {
        var h2h_a = a.results.victories.indexOf(b.id) >= 0;
        var h2h_b = b.results.victories.indexOf(a.id) >= 0;

        if (h2h_a || h2h_b) {
          return h2h_b ? 1 : -1;
        }

        return b.ratio_hash - a.ratio_hash;
      }

      function h2hOrder(a, b) {
        var h2h_a = a.results.victories.indexOf(b.id) >= 0;
        var h2h_b = b.results.victories.indexOf(a.id) >= 0;

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
        var rh;

        if (h2h) {
          rh = p.results.matches_ratio * Math.pow(10, 16) + p.results.sets_ratio * Math.pow(10, 12) + p.results.games_difference * Math.pow(10, 8) + p.results.points_ratio * Math.pow(10, 3);
        } else {
          rh = p.results.matches_ratio * Math.pow(10, 16) + p.results.sets_ratio * Math.pow(10, 12) + p.results.games_ratio * Math.pow(10, 8) + p.results.points_ratio * Math.pow(10, 3);
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

        if (oo && typeof oo === "object" && typeof vo !== "function" && oo.constructor !== Array) {
          keyWalk(valuesObject[vKeys[k]], optionsObject[vKeys[k]]);
        } else {
          optionsObject[vKeys[k]] = valuesObject[vKeys[k]];
        }
      }
    }
  }

  return fx;
}

var matchFx = /*#__PURE__*/function () {
  var fx = {};
  var dfx = /*#__PURE__*/drawFx(); // create an array of ids of all players who are selected for any event
  // used to prevent sign-out of approved players
  // if dual matches then get a list of all players who are part of any defined match

  fx.activeTeamPlayers = function (_ref) {
    var _ref2, _ref3;

    var tournament = _ref.tournament;
    if (!typeCheck.isTeam({
      tournament: tournament
    }) || !tournament.events) return [];

    var _fx$tournamentEventMa = fx.tournamentEventMatches({
      tournament: tournament
    }),
        completed_matches = _fx$tournamentEventMa.completed_matches,
        pending_matches = _fx$tournamentEventMa.pending_matches,
        upcoming_matches = _fx$tournamentEventMa.upcoming_matches;

    var all_matches = (_ref2 = []).concat.apply(_ref2, pending_matches.concat(upcoming_matches, [completed_matches]));

    return (_ref3 = []).concat.apply(_ref3, all_matches.map(function (m) {
      return m.players;
    })).map(function (p) {
      return p && p.id;
    }).filter(function (f) {
      return f;
    });
  };

  fx.matchPlayers = function (_ref4) {
    var match = _ref4.match,
        potentials = _ref4.potentials;
    if (!match) return [];
    var pc = !potentials ? [] : flatten(match.potentials || match.match && match.match.potentials || []).filter(function (f) {
      return f && f.id;
    });
    var teams = flatten(match.teams || match.match && match.match.teams || []).filter(function (f) {
      return f.id;
    });

    if (teams.length) {
      return flatten(teams.concat.apply(teams, pc));
    }

    var players = flatten(match.players || match.match && match.match.players || []).filter(function (f) {
      return f && f.id;
    });

    if (players.length) {
      return flatten(players.concat.apply(players, pc));
    }

    var winners = flatten(match.winner || match.match && match.match.winner || []).filter(function (f) {
      return f && f.id;
    });
    var losers = flatten(match.loser || match.match && match.match.loser || []).filter(function (f) {
      return f && f.id;
    });
    var match_players = pc.concat.apply(pc, winners.concat(losers));
    console.log({
      match_players: match_players
    });
    return match_players;
  };

  fx.opponentsInclude = function (_ref5) {
    var match = _ref5.match,
        potentials = _ref5.potentials,
        ids = _ref5.ids;
    var opponents = fx.matchPlayers({
      match: match,
      potentials: potentials
    }).filter(function (f) {
      return f;
    });
    var include_ids = opponents.reduce(function (p, c) {
      return ids.indexOf(c.id) >= 0 || p;
    }, false);
    return include_ids;
  };

  fx.removeMatchSchedule = function (_ref6) {
    var e = _ref6.e,
        tournament = _ref6.tournament,
        opponent_ids = _ref6.opponent_ids,
        env = _ref6.env;
    if (!e || !tournament || !opponent_ids) return;
    var event_matches = eventMatches(e, tournament, false, env);
    var match = event_matches.reduce(function (p, match) {
      return fx.opponentsInclude({
        match: match,
        ids: opponent_ids
      }) ? match : p;
    }, undefined);
    if (match && match.schedule) match.schedule = {};
    if (match && match.match && match.match.schedule) match.match.schedule = {};
  }; // Returns NEW objects; modifications don't change originals
  // if 'source' is true, then source object is included...


  fx.tournamentEventMatches = tournamentEventMatches;

  function tournamentEventMatches(_ref7) {
    var tournament = _ref7.tournament,
        source = _ref7.source,
        env = _ref7.env;
    if (!tournament.events) return {
      completed_matches: [],
      pending_matches: [],
      upcoming_matches: [],
      total_matches: 0
    };
    var total_matches = 0;
    var completed_matches = [];
    var pending_matches = [];
    var upcoming_matches = []; // don't sort tournament.events ... sort map of tournament draw types

    function drawTypeSort(draw_type) {
      return ["R", "Q"].indexOf(draw_type) >= 0 ? 0 : 1;
    }

    var ordered_events = tournament.events.map(function (e, index) {
      return {
        draw_type: e.draw_type,
        index: index
      };
    }).sort(function (a, b) {
      return drawTypeSort(a.draw_type) - drawTypeSort(b.draw_type);
    });
    ordered_events.forEach(function (oe) {
      var _completed_matches, _pending_matches, _upcoming_matches;

      var e = tournament.events[oe.index];
      if (typeCheck.isRoundRobin({
        e: e
      })) dfx.roundRobinRounds({
        event: e
      });

      var _eventMatchStorageObj = eventMatchStorageObjects({
        tournament: tournament,
        e: e,
        source: source,
        env: env
      }),
          complete = _eventMatchStorageObj.complete,
          incomplete = _eventMatchStorageObj.incomplete,
          upcoming = _eventMatchStorageObj.upcoming;

      if (typeCheck.isRoundRobin({
        e: e
      })) {
        complete.sort(function (a, b) {
          return a.round_name && b.round_name && a.round_name.localeCompare(b.round_name);
        });
        incomplete.sort(function (a, b) {
          return a.round_name && b.round_name && a.round_name.localeCompare(b.round_name);
        });
        upcoming.sort(function (a, b) {
          return a.round_name && b.round_name && a.round_name.localeCompare(b.round_name);
        });
      }

      completed_matches = (_completed_matches = completed_matches).concat.apply(_completed_matches, complete);
      pending_matches = (_pending_matches = pending_matches).concat.apply(_pending_matches, incomplete);
      upcoming_matches = (_upcoming_matches = upcoming_matches).concat.apply(_upcoming_matches, upcoming);
    });
    total_matches = completed_matches.length + pending_matches.length;
    return {
      completed_matches: completed_matches,
      pending_matches: pending_matches,
      upcoming_matches: upcoming_matches,
      total_matches: total_matches
    };
  }

  function eventMatchStorageObjects(_ref8) {
    var tournament = _ref8.tournament,
        e = _ref8.e,
        source = _ref8.source,
        env = _ref8.env;
    if (!e.draw) return {
      complete: [],
      incomplete: [],
      upcoming: []
    };
    var event_matches = eventMatches(e, tournament, false, env); // for Round Robin Draw to be considered qualification it needs to be linked to an Elimination Draw

    var draw_format = e.draw.brackets ? "round_robin" : "tree";

    if (draw_format === "round_robin" && (!e.links || !e.links["E"])) {
      event_matches.forEach(function (match) {
        if (match.round_name) match.round_name = match.round_name.replace("Q", "");
      });
    }

    var complete = event_matches.filter(function (f) {
      return f.match && f.match.winner && f.match.loser;
    }).map(function (m) {
      return matchStorageObject({
        tournament: tournament,
        e: e,
        match: m,
        source: source
      });
    }).filter(function (f) {
      return f;
    });
    var incomplete = event_matches.filter(function (f) {
      return f.match && !f.match.winner && !f.match.loser;
    }).map(function (m) {
      return matchStorageObject({
        tournament: tournament,
        e: e,
        match: m,
        source: source
      });
    }).filter(function (m) {
      return m.players && m.players.filter(function (f) {
        return f;
      }).length || m.potentials && m.potentials.length;
    });
    var upcoming = upcomingEventMatches({
      e: e,
      tournament: tournament,
      env: env
    }).map(function (m) {
      return matchStorageObject({
        tournament: tournament,
        e: e,
        match: m,
        source: source
      });
    }).filter(function (f) {
      return f;
    }) || [];
    return {
      complete: complete,
      incomplete: incomplete,
      upcoming: upcoming
    };
  }

  function matchStorageObject(_ref9) {
    var tournament = _ref9.tournament,
        e = _ref9.e,
        match = _ref9.match,
        source = _ref9.source;
    if (!match.match) return;
    var players = [];
    var team_players;
    var match_teams = safeArr$1(match.teams);

    if (!match_teams.length) {
      players = [];
      team_players = [];
    } else if (match.match.winner && match.match.winner[0]) {
      var _ref10;

      var team0 = safeArr$1(match_teams[0]);
      var team1 = safeArr$1(match_teams[1]);
      players = (_ref10 = []).concat.apply(_ref10, team0.concat(team1));
      team_players = [team0.map(function (p, i) {
        return i;
      }), team1.map(function (p, i) {
        return team0.length + i;
      })];
    } else {
      var _ref11;

      players = (_ref11 = []).concat.apply(_ref11, match_teams);
      team_players = match_teams.map(function (t, i) {
        return !t ? [null] : t.map(function (m, j) {
          return i * t.length + j;
        });
      });
    }

    var coords;
    var schedule = match.match.schedule;

    if (schedule && schedule.luid && tournament.locations) {
      var loc = tournament.locations.reduce(function (p, c) {
        return c.luid === schedule.luid ? c : p;
      }, undefined);
      if (loc) coords = {
        latitude: loc.latitude,
        longitude: loc.longitude
      };
    }

    var matchFormat = match.match.matchFormat || e.matchFormat;
    var obj = {
      consolation: typeCheck.isConsolation({
        e: e
      }),
      draw_positions: e.draw_size,
      date: match.match.date,
      schedule: schedule,
      location: coords,
      format: typeCheck.isDoubles({
        match: match
      }) || typeCheck.isDoubles({
        e: e
      }) ? "doubles" : "singles",
      gender: e.gender,
      muid: match.match.muid,
      ids: players.filter(function (p) {
        return p;
      }).map(function (p) {
        return p.id;
      }),
      // TODO: These need object copy
      players: players,
      teams: match.teams,
      set_scores: match.match.set_scores,
      // TODO: should be => teams: team_players,
      team_players: team_players,
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
      matchFormat: matchFormat,
      delegated_score: match.match.delegated_score,
      status: match.match.status,
      tournament: {
        name: tournament.name,
        tuid: tournament.tuid,
        org: tournament.org,
        start: tournament.start,
        end: tournament.end,
        rank: tournament.rank
      },
      event: {
        name: e.name,
        rank: e.rank,
        euid: e.euid,
        surface: e.surface,
        category: e.category,
        draw_type: e.draw_type,
        custom_category: e.custom_category
      },
      dual_match: match.dual_match,
      sequence: match.sequence,
      umpire: match.match.umpire,
      // TODO: can this be removed?
      winner: match.match.winner_index,
      winner_index: match.match.winner_index
    };
    if (source) obj.source = match.match;
    return obj;
  }

  fx.matchOutcome = matchOutcome;

  function matchOutcome(match, id) {
    var player_won = null;
    var winning_ids = [];
    var winning_team;
    var losing_team;
    var losing_ids = []; // TODO: this is a patch for matches from database
    // .teams needs to be updated to .team_players

    if (!match.team_players) match.team_players = match.teams;

    if (match.winner !== undefined) {
      winning_team = match.team_players[match.winner].map(function (pindex) {
        var player = match.players[pindex];
        winning_ids.push(player.id);
        if (player.id === id) player_won = true;
        return "" + fullName(player) + (player.rank ? " [" + player.rank + "]" : "");
      }).join("; ");
      losing_team = match.team_players[1 - match.winner].map(function (pindex) {
        var player = match.players[pindex];
        if (!player) return "Undefined";
        losing_ids.push(player.id);
        if (player.id === id) player_won = false;
        return "" + fullName(player) + (player.rank ? " [" + player.rank + "]" : "");
      }).join("; ");
    }

    return {
      player_won: player_won,
      winning_team: winning_team,
      losing_team: losing_team,
      winning_ids: winning_ids,
      losing_ids: losing_ids
    };
  }

  function fullName(p) {
    return p.last_name.toUpperCase() + ", " + p.first_name;
  }

  fx.scheduledMatches = scheduledMatches;

  function scheduledMatches(_ref12) {
    var tournament = _ref12.tournament,
        env = _ref12.env;

    var _tournamentEventMatch = tournamentEventMatches({
      tournament: tournament,
      source: true,
      env: env
    }),
        completed_matches = _tournamentEventMatch.completed_matches,
        pending_matches = _tournamentEventMatch.pending_matches,
        upcoming_matches = _tournamentEventMatch.upcoming_matches;

    var all_matches = completed_matches.concat.apply(completed_matches, pending_matches.concat(upcoming_matches));
    var scheduled = all_matches.filter(function (m) {
      return m.schedule && m.schedule.day;
    });
    var days = unique(scheduled.map(function (m) {
      return m.schedule.day;
    }));
    return {
      scheduled: scheduled,
      days: days
    };
  }

  function upcomingEventMatches(_ref13) {
    var e = _ref13.e,
        tournament = _ref13.tournament,
        env = _ref13.env;
    if (!e.draw) return [];
    if (typeCheck.isTeam({
      tournament: tournament,
      e: e
    })) return [];
    var round_names = roundNames(tournament, e);
    var matches = dfx.upcomingMatches(e.draw, round_names.names, round_names.calculated_names);
    return checkScheduledMatches({
      e: e,
      tournament: tournament,
      matches: matches,
      env: env
    });
  }

  fx.dualMatchMatches = function (e, muid) {
    if (!e.draw) return [];
    if (!e.draw.dual_matches) return [];

    if (muid && e.draw.dual_matches[muid]) {
      return e.draw.dual_matches[muid].matches || [];
    } else {
      var matches = [];
      Object.keys(e.draw.dual_matches || {}).forEach(function (key) {
        var _matches;

        var dual_matches = e.draw.dual_matches[key].matches || [];
        dual_matches.forEach(function (dm) {
          return dm.dual_match = key;
        });
        matches = (_matches = matches).concat.apply(_matches, dual_matches);
      });
      return matches;
    }
  };

  fx.eventMatches = eventMatches;

  function eventMatches(e, tournament, all, env) {
    var matches = [];

    if (!e || !e.draw) {
      return matches;
    }

    if (typeCheck.isAdHoc({
      e: e
    })) {
      matches = safeArr$1(e.draw && e.draw.matches);
    } else if (typeCheck.isTeam({
      tournament: tournament,
      e: e
    })) {
      Object.keys(e.draw.dual_matches || {}).forEach(function (key) {
        var _matches2;

        var dual_matches = e.draw.dual_matches[key].matches || [];
        dual_matches.forEach(function (dm) {
          return dm.dual_match = key;
        });
        matches = (_matches2 = matches).concat.apply(_matches2, dual_matches);
      });
    } else {
      var round_names = roundNames(tournament, e);
      matches = dfx.matches(e.draw, round_names.names, round_names.calculated_names, all);
    }

    checkScheduledMatches({
      e: e,
      tournament: tournament,
      matches: matches,
      env: env
    });
    return matches;
  }

  fx.containsGUIDplayer = function (match) {
    var _ref14;

    var players = match && (match.match && match.match.players || match.teams && (_ref14 = []).concat.apply(_ref14, match.teams));

    var GUIDplayers = players && players.reduce(function (p, c) {
      return c && c.id && c.id.length >= 36 && c.id.split("-").length === 5 ? true : p;
    }, false);
    return GUIDplayers;
  };

  function findEventByID(tournament, id) {
    if (!tournament || !tournament.events || tournament.events.length < 1) return;
    return tournament.events.reduce(function (p, c) {
      return c.euid === id ? c : p;
    }, undefined);
  }

  fx.roundNames = roundNames;

  function roundNames(tournament, e) {
    var names = [];
    var calculated_names = [];

    if (typeCheck.hasRoundNames({
      e: e
    })) {
      if (typeCheck.isFeedIn({
        e: e
      })) {
        names = ["F", "SF", "QF"];
        var depth = dfx.drawInfo(e.draw).depth;

        if (depth > 3) {
          var _names;

          var rounds = numArr(depth - 3).map(function (d) {
            return "R" + (d + 1);
          }).reverse();
          names = (_names = names).concat.apply(_names, rounds);
        }
      } else {
        names = ["F", "SF", "QF", "R16", "R32", "R64", "R128", "R256", "R512"];
      }
    }

    if (typeCheck.isQualifying({
      e: e
    })) {
      names = ["Q", "Q1", "Q2", "Q3", "Q4", "Q5"];
      var qlink = e.links && findEventByID(tournament, e.links["E"]);

      if (qlink && qlink.draw) {
        var info = dfx.drawInfo(qlink.draw);
        if (info) calculated_names = ["F", "SF", "QF", "R16", "R32", "R64", "R128", "R256", "R512", "R1024"].slice(info.depth);
      }
    }

    if (typeCheck.isPlayoff({
      e: e
    })) {
      names = ["PO3"];
    }

    return {
      names: names,
      calculated_names: calculated_names
    };
  }

  fx.checkScheduledMatches = checkScheduledMatches;

  function checkScheduledMatches(_ref15) {
    var e = _ref15.e,
        tournament = _ref15.tournament,
        matches = _ref15.matches,
        env = _ref15.env;
    addMUIDs(e);
    var court_names = {};
    var max_matches_per_court = env && env.schedule.max_matches_per_court || 14;
    safeArr$1(tournament.locations).map(function (l) {
      return l.luid;
    }).forEach(function (luid) {
      return courtData(tournament, luid, max_matches_per_court).forEach(function (ct) {
        return court_names[ctuuid(ct)] = ct.name;
      });
    });
    var check_names = Object.keys(court_names).length;
    matches.forEach(function (match) {
      var schedule = match.match && match.match.schedule;

      if (schedule) {
        if (check_names) schedule.court = court_names[ctuuid(schedule)];

        if (schedule && schedule.oop_round && schedule.luid) {
          var court_matches = matches.filter(function (m) {
            return m.match && m.match.schedule && ctuuid(m.match.schedule) === ctuuid(schedule);
          }).filter(function (m) {
            return m.match.schedule.oop_round < schedule.oop_round && m.match.winner === undefined;
          });
          schedule.after = court_matches.length;
        }

        if (schedule.time) {
          schedule.time = dateFx.convertTime(schedule.time, env);
        }
      }
    });
    return matches || [];
  }

  fx.eventRoundConsolationReady = function (_ref16) {
    var draw = _ref16.draw,
        round = _ref16.round;
    var info = draw && dfx.drawInfo(draw);
    if (!info || !round || isNaN(round)) return;
    var round_matches = safeArr$1(info.all_matches).filter(function (f) {
      return +f.height === +round;
    });
    var with_team = round_matches.filter(function (m) {
      return m && m.data && m.data.team;
    });
    return round_matches.length === with_team.length;
  };

  fx.getLuckyLosers = function (_ref17) {
    var _ref18;

    var tournament = _ref17.tournament,
        evnt = _ref17.evnt,
        env = _ref17.env;
    var all_rounds = env.drawFx.ll_all_rounds;
    var completed_matches = tournament && fx.eventMatches(evnt, tournament, false, env).filter(function (m) {
      return m.match.winner;
    }) || [];
    if (!all_rounds && typeCheck.isQualifying({
      e: evnt
    })) completed_matches = completed_matches.filter(function (m) {
      return m.match.round_name === "Q";
    });

    var losing_ids = (_ref18 = []).concat.apply(_ref18, completed_matches.map(function (match) {
      return match.match.loser.map(function (team) {
        return team.id;
      });
    }));

    var qualifying_ids = evnt && evnt.qualified && evnt.qualified.length && evnt.qualified.map(function (q) {
      return q[0].id;
    }) || [];
    var losing_players = tournament && tournament.players.filter(function (p) {
      return losing_ids.indexOf(p.id) >= 0 && qualifying_ids.indexOf(p.id) < 0;
    }) || [];
    console.log({
      qualifying_ids: qualifying_ids,
      losing_ids: losing_ids,
      losing_players: losing_players
    });
    return {
      losing_ids: losing_ids,
      losing_players: losing_players
    };
  };

  fx.addMUIDs = addMUIDs;

  function addMUIDs(e) {
    if (!e.draw) return;
    var current_draw = e.draw.compass ? e.draw[e.draw.compass] : e.draw;
    if (!current_draw) return;

    if (e.draw.compass) {
      dfx.compassInfo(e.draw).all_matches.forEach(addMUID);
    } else if (e.draw.brackets) {
      e.draw.brackets.forEach(function (bracket) {
        return bracket.matches.forEach(function (match) {
          if (!match.muid) match.muid = UUID["new"]();
          match.euid = e.euid;
        });
      });
    } else {
      var info = dfx.drawInfo(current_draw);
      if (info && info.nodes) info.nodes.forEach(addMUID);
    }

    function addMUID(node) {
      var muid = node.data && node.data.nuid || UUID["new"]();

      if (node.children) {
        if (!node.data.match) node.data.match = {};
        if (!node.data.match.muid) node.data.match.muid = muid;
        if (!node.data.match.euid) node.data.match.euid = e.euid;
      }
    }
  }

  fx.determineGender = function (match) {
    var genders = match.players ? match.players.filter(function (f) {
      return f;
    }).map(function (p) {
      return p.sex;
    }).filter(function (f) {
      return f;
    }).filter(function (item, i, s) {
      return s.lastIndexOf(item) === i;
    }) : [];
    return !genders.length ? "" : genders.length > 1 ? "X" : genders[0];
  };

  fx.matchTime = function (match, env) {
    return match.schedule && match.schedule.time && dateFx.convertTime(match.schedule.time, env) || "";
  };

  fx.matchRound = function (match) {
    return match.round_name || match.round;
  };

  fx.matchDate = function (match) {
    if (match.schedule && match.schedule.day) return datePDF(new Date(match.schedule.day));
    if (match.date) return datePDF(match.date);
    return "";
  };

  fx.matchDesignator = function (_ref19) {
    var tournament = _ref19.tournament,
        match = _ref19.match;
    var evt = match && match.event && findEventByID(tournament, match.event.euid);
    var category = evt && evt.category && evt.category.slice(0, 4) || "";
    return "" + evt.gender + evt.format + category;
  };

  fx.matchDateDisplay = function (match) {
    if (match.schedule && match.schedule.day) return displayDate(new Date(match.schedule.day));
    if (match.date) return displayDate(match.date);
    return "";
  };

  fx.matchDuration = function (match) {
    if (match.schedule && match.schedule.start && match.schedule.end) {
      var d = duration(match.schedule.start, match.schedule.end);
      return "<b>" + d + "</b>";
    }

    return "";

    function duration(start, end) {
      var seconds = getSeconds(end) - getSeconds(start);
      if (seconds <= 0) seconds = getSeconds(end, 12) - getSeconds(start);
      if (seconds <= 0) seconds = getSeconds(end, 12) - getSeconds(start, -12);
      var hours = Math.floor(seconds / (60 * 60));
      var minutes = Math.floor(seconds - hours * 60 * 60) / 60;
      return zeroPad(hours) + ":" + zeroPad(minutes);
    }

    function getSeconds(hm, mod) {
      if (mod === void 0) {
        mod = 0;
      }

      var a = hm.split(":");

      var getNum = function getNum(x) {
        return x && !isNaN(x) ? +x : 0;
      };

      var hours = getNum(a[0]) + mod;
      var minutes = getNum(a[1]);
      return hours * 60 * 60 + minutes * 60;
    }
  };

  fx.roundPosition = function (_ref20) {
    var match = _ref20.match,
        info = _ref20.info,
        backdrawTarget = _ref20.backdrawTarget;
    var all_matches = info && info.all_matches;
    var match_node = all_matches && all_matches.reduce(function (p, n) {
      var _n$data, _n$data$match;

      return ((_n$data = n.data) == null ? void 0 : (_n$data$match = _n$data.match) == null ? void 0 : _n$data$match.muid) === (match == null ? void 0 : match.muid) ? n : p;
    }, undefined);
    var match_round = all_matches && all_matches.filter(function (n) {
      return match_node && match_node.depth === n.depth;
    });
    var backdraw_target = all_matches && all_matches.filter(function (n) {
      return match_node && !dfx.byeNode(n) && match_node.depth === n.depth;
    });
    var round = backdrawTarget ? backdraw_target : match_round;
    var muids = round && round.map(function (n) {
      return n && n.data && n.data.match && n.data.match.muid;
    }).filter(function (f) {
      return f;
    });
    var index = muids && muids.indexOf(match == null ? void 0 : match.muid);
    return index >= 0 ? (index + 1).toString() : "";
  };

  fx.roundNumber = function (_ref21) {
    var match = _ref21.match,
        info = _ref21.info,
        DrawStructure = _ref21.DrawStructure;
    var all_matches = info && info.all_matches;
    var match_node = all_matches && all_matches.reduce(function (p, n) {
      var _n$data2, _n$data2$match;

      return ((_n$data2 = n.data) == null ? void 0 : (_n$data2$match = _n$data2.match) == null ? void 0 : _n$data2$match.muid) === (match == null ? void 0 : match.muid) ? n : p;
    }, undefined);
    var match_node_depth = match_node && match_node.depth || 0;
    var round = info && info.depth ? info.depth - match_node_depth : "";
    var rr_round = DrawStructure === "ROUND-ROBIN" ? match.round : "";
    return (round || rr_round || "").toString();
  };

  fx.matchFinish = function (match) {
    return match.schedule && match.schedule.end ? match.schedule.end : "";
  };

  fx.matchCourt = function (match) {
    return match.schedule && match.schedule.court || "";
  };

  fx.matchScore = function (match, non_breaking) {
    var scr = match.score || match.delegated_score || "";
    if (match.winner_index === 1) scr = scoreFx.reverseScore(scr); // eslint-disable-next-line no-useless-escape

    return scr && non_breaking ? scr.replace(/\-/g, "&#8209;") : scr;
  };

  fx.isByeMatch = function (match) {
    return match && match.players && match.players.filter(function (f) {
      return f;
    }).reduce(function (p, c) {
      return c.bye ? true : p;
    }, undefined);
  };

  fx.idInMatch = function (_ref22) {
    var match = _ref22.match,
        id = _ref22.id;
    return match && match.players && match.players.reduce(function (p, c) {
      return c.id === id ? true : p;
    }, undefined);
  };

  function datePDF(timestamp) {
    console.log({
      timestamp: timestamp
    });
    var date = dateFx.offsetDate(timestamp);
    return [zeroPad(date.getMonth() + 1), zeroPad(date.getDate())].join("-");
  }

  function displayDate(timestamp) {
    var date = dateFx.offsetDate(timestamp);
    return [zeroPad(date.getMonth() + 1), zeroPad(date.getDate())].join("&#8209;");
  }

  return fx;
}();

function numArr(count) {
  return [].concat(Array(count)).map(function (_, i) {
    return i;
  });
}

function zeroPad(number) {
  return number.toString()[1] ? number : "0" + number;
}

function unique(arr) {
  return arr.filter(function (item, i, s) {
    return s.lastIndexOf(item) === i;
  });
}

function safeArr$1(x) {
  return Array.isArray(x) && x || typeof x === "object" && Object.keys(x).map(function (k) {
    return x[k];
  }) || [];
}

function flatten(arr) {
  return arr.reduce(function (flat, toFlatten) {
    return flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten);
  }, []);
}

var CONTAINER = drawDefinitionConstants.CONTAINER,
    ITEM = drawDefinitionConstants.ITEM,
    ROUND_OUTCOME = drawDefinitionConstants.ROUND_OUTCOME,
    WIN_RATIO = drawDefinitionConstants.WIN_RATIO;
var dfx = /*#__PURE__*/drawFx();
function getStructureContent(_ref) {
  var _legacyEvent$draw;

  var eventType = _ref.eventType,
      tieFormat = _ref.tieFormat,
      tournament = _ref.tournament,
      legacyEvent = _ref.legacyEvent,
      participants = _ref.participants;
  var legacyDual = tournament.type === "dual";
  var totalPlayers = legacyEvent.approved.length + (legacyEvent.qualifiers || 0) || legacyEvent.feed_base || legacyEvent.draw_size;
  var seedLimit = dfx.seedLimit({
    total_players: totalPlayers,
    evt: legacyEvent
  });
  var entryStage = getStage({
    legacyEvent: legacyEvent
  });
  var info = dfx.drawInfo(legacyEvent.draw);
  var props = {
    participants: participants,
    legacyEvent: legacyEvent,
    tournament: tournament,
    legacyDual: legacyDual,
    seedLimit: seedLimit,
    entryStage: entryStage,
    tieFormat: tieFormat,
    eventType: eventType,
    info: info
  };
  var result = legacyEvent != null && (_legacyEvent$draw = legacyEvent.draw) != null && _legacyEvent$draw.brackets ? roundRobinStructure(props) : eliminationStructure(props);
  return result;
}

function eliminationStructure(_ref2) {
  var legacyEvent = _ref2.legacyEvent,
      tournament = _ref2.tournament,
      tieFormat = _ref2.tieFormat,
      legacyDual = _ref2.legacyDual,
      seedLimit = _ref2.seedLimit,
      entryStage = _ref2.entryStage,
      participants = _ref2.participants,
      eventType = _ref2.eventType,
      info = _ref2.info;
  // logic for elmination structures
  var eventMatches = matchFx.eventMatches(legacyEvent, tournament, true); // if tournament type is dual then matches need to be retrieved differently

  var roundNames = matchFx.roundNames(tournament, legacyEvent);
  var dfxMatches = dfx.matches(legacyEvent.draw, roundNames.names, roundNames.calculated_names, true);
  var matches = legacyDual ? dfxMatches : eventMatches;
  var tieMatches = legacyDual && eventMatches || [];
  var positionAssignments = [];
  var seedAssignments = [];
  var participantIds = [];
  var entries = [];
  var matchUpFormat = legacyEvent.matchFormat;
  var matchUps = matches.map(function (legacyMatch) {
    var result = processLegacyMatch({
      entries: entries,
      tieFormat: tieFormat,
      eventType: eventType,
      matchUpFormat: matchUpFormat,
      seedAssignments: seedAssignments,
      tieMatches: tieMatches,
      legacyMatch: legacyMatch,
      participantIds: participantIds,
      participants: participants,
      entryStage: entryStage,
      seedLimit: seedLimit,
      info: info
    });

    if (result) {
      var matchUp = result.matchUp,
          matchUpAssignments = result.positionAssignments;
      if (matchUpAssignments) positionAssignments.push.apply(positionAssignments, matchUpAssignments);
      return matchUp;
    }

    return undefined;
  }).filter(function (f) {
    return f;
  });
  positionAssignments.sort(function (a, b) {
    return a.drawPosition > b.drawPosition ? 1 : -1;
  });
  seedAssignments.sort(function (a, b) {
    return a.seedNumber > b.seedNumber ? 1 : -1;
  });
  return {
    entries: entries,
    matchUps: matchUps,
    seedLimit: seedLimit,
    positionAssignments: positionAssignments,
    seedAssignments: seedAssignments,
    finishingPosition: ROUND_OUTCOME
  };
}

function roundRobinStructure(_ref3) {
  var tournament = _ref3.tournament,
      legacyEvent = _ref3.legacyEvent,
      legacyDual = _ref3.legacyDual,
      participants = _ref3.participants,
      entryStage = _ref3.entryStage,
      seedLimit = _ref3.seedLimit,
      tieFormat = _ref3.tieFormat,
      eventType = _ref3.eventType,
      info = _ref3.info;
  var eventMatches = matchFx.eventMatches(legacyEvent, tournament, true);
  var tieMatches = legacyDual && eventMatches || [];
  var structures = [];
  var seedAssignments = [];
  var participantIds = [];
  var entries = [];
  var matchUpFormat = legacyEvent.matchFormat;
  legacyEvent.draw.brackets.forEach(function (bracket, index) {
    var drawPositionOffset = index * (legacyEvent.draw.bracket_size || 0);
    var positionAssignments = [];
    var matchUps = bracket.matches.map(function (legacyMatch) {
      var result = processLegacyMatch({
        seedAssignments: seedAssignments,
        entries: entries,
        eventType: eventType,
        tieFormat: tieFormat,
        matchUpFormat: matchUpFormat,
        drawPositionOffset: drawPositionOffset,
        participantIds: participantIds,
        participants: participants,
        legacyMatch: legacyMatch,
        tieMatches: tieMatches,
        entryStage: entryStage,
        seedLimit: seedLimit,
        info: info
      });

      if (result) {
        var matchUp = result.matchUp,
            matchUpAssignments = result.positionAssignments;
        if (matchUpAssignments) positionAssignments.push.apply(positionAssignments, matchUpAssignments);
        return matchUp;
      }

      return undefined;
    }).filter(function (f) {
      return f;
    });
    var structureName = bracket.name || "Group " + (index + 1);
    var structure = {
      structureType: ITEM,
      structureId: UUID.generate(),
      stageSequence: 1,
      positionAssignments: positionAssignments,
      structureName: structureName,
      matchUps: matchUps
    };
    structures.push(structure);
  });
  return {
    entries: entries,
    seedLimit: seedLimit,
    structures: structures,
    seedAssignments: [],
    structureType: CONTAINER,
    finishingPosition: WIN_RATIO
  };
}

function processLegacyMatch(_ref4) {
  var _legacyMatch$match, _legacyMatch$match2, _legacyMatch$match3, _legacyMatch$match4;

  var seedAssignments = _ref4.seedAssignments,
      matchUpFormat = _ref4.matchUpFormat,
      tieFormat = _ref4.tieFormat,
      eventType = _ref4.eventType,
      entries = _ref4.entries,
      drawPositionOffset = _ref4.drawPositionOffset,
      participantIds = _ref4.participantIds,
      participants = _ref4.participants,
      legacyMatch = _ref4.legacyMatch,
      tieMatches = _ref4.tieMatches,
      entryStage = _ref4.entryStage,
      seedLimit = _ref4.seedLimit,
      info = _ref4.info;
  var positionAssignments = [];
  var isDualMatch = !!legacyMatch.dual_match;
  var matchUpId = ((_legacyMatch$match = legacyMatch.match) == null ? void 0 : _legacyMatch$match.muid) || legacyMatch.muid;

  if (!legacyMatch.teams || isDualMatch) {
    return {};
  }

  var roundNumberString = matchFx.roundNumber({
    match: legacyMatch.match,
    info: info
  }) || ((_legacyMatch$match2 = legacyMatch.match) == null ? void 0 : _legacyMatch$match2.round) || (legacyMatch == null ? void 0 : legacyMatch.round);
  var roundNumber = !isNaN(parseInt(roundNumberString)) ? parseInt(roundNumberString) : undefined;
  var roundPositionString = matchFx.roundPosition({
    match: legacyMatch.match,
    info: info
  });
  var roundPosition = !isNaN(parseInt(roundPositionString)) ? parseInt(roundPositionString) : undefined;
  var roundName = ((_legacyMatch$match3 = legacyMatch.match) == null ? void 0 : _legacyMatch$match3.calculated_round_name) || ((_legacyMatch$match4 = legacyMatch.match) == null ? void 0 : _legacyMatch$match4.round_name) || (legacyMatch == null ? void 0 : legacyMatch.round_name) || "";
  var tieMatchUps = tieMatches.filter(function (tieMatch) {
    return tieMatch.dual_match === matchUpId;
  }).map(function (tieMatch) {
    var _extractMatchUp = extractMatchUp({
      info: info,
      tieFormat: tieFormat,
      eventType: eventType,
      seedLimit: seedLimit,
      entryStage: entryStage,
      participants: participants,
      participantIds: participantIds,
      tournamentEngine: tournamentEngine,
      legacyMatch: tieMatch
    }),
        matchUp = _extractMatchUp.matchUp,
        missingParticipants = _extractMatchUp.missingParticipants;

    Object.assign(matchUp, {
      roundName: roundName,
      roundNumber: roundNumber,
      roundPosition: roundPosition
    });
    if (missingParticipants.length) console.log({
      missingParticipants: missingParticipants
    });
    return matchUp;
  });

  var _extractMatchUp2 = extractMatchUp({
    info: info,
    eventType: eventType,
    seedLimit: seedLimit,
    entryStage: entryStage,
    legacyMatch: legacyMatch,
    participants: participants,
    matchUpFormat: matchUpFormat,
    participantIds: participantIds,
    tournamentEngine: tournamentEngine,
    drawPositionOffset: drawPositionOffset
  }),
      matchUp = _extractMatchUp2.matchUp,
      missingParticipants = _extractMatchUp2.missingParticipants,
      matchUpPositionAssignments = _extractMatchUp2.positionAssignments,
      matchUpSeedAssignments = _extractMatchUp2.seedAssignments,
      matchUpEntries = _extractMatchUp2.entries;

  if (missingParticipants != null && missingParticipants.filter(function (f) {
    return f;
  }).length) console.log({
    missingParticipants: missingParticipants
  });

  if (tieMatchUps) {
    tieMatchUps.forEach(function (tieMatchUp) {
      var collectionPosition = tieMatchUp.collectionPosition,
          matchUpType = tieMatchUp.matchUpType,
          sides = tieMatchUp.sides;
      var collectionDefinition = tieFormat == null ? void 0 : tieFormat.collectionDefinitions.find(function (collectionDefinition) {
        return collectionDefinition.matchUpType === matchUpType;
      });
      var collectionId = collectionDefinition == null ? void 0 : collectionDefinition.collectionId;

      if (sides != null && sides.length) {
        sides.forEach(function (_ref5) {
          var participantId = _ref5.participantId,
              sideNumber = _ref5.sideNumber;
          var side = matchUp.sides.find(function (side) {
            return side.sideNumber === sideNumber;
          });
          if (!side.lineUp) side.lineUp = [];
          var competitor = side.lineUp.find(function (competitor) {
            return competitor.participantId === participantId;
          });

          if (competitor) {
            competitor.collectionAssignments.push({
              collectionId: collectionId,
              collectionPosition: collectionPosition
            });
          } else {
            var _competitor = {
              participantId: participantId,
              collectionAssignments: [{
                collectionId: collectionId,
                collectionPosition: collectionPosition
              }]
            };
            side.lineUp.push(_competitor);
          }
        });
      }
    });
  }

  matchUpPositionAssignments.forEach(function (positionAssignment) {
    return positionAssignments.push(positionAssignment);
  });
  matchUpSeedAssignments.forEach(function (seedAssignment) {
    return seedAssignments.push(seedAssignment);
  });
  matchUpEntries.forEach(function (entry) {
    return entries.push(entry);
  });
  Object.assign(matchUp, {
    roundName: roundName,
    roundNumber: roundNumber,
    roundPosition: roundPosition
  });

  if (tieMatchUps.length) {
    Object.assign(matchUp, {
      tieMatchUps: tieMatchUps
    });
  }

  return {
    matchUp: matchUp,
    positionAssignments: positionAssignments
  };
}

function extractStructures(_ref) {
  var eventType = _ref.eventType,
      tieFormat = _ref.tieFormat,
      tournament = _ref.tournament,
      participants = _ref.participants,
      legacyEvents = _ref.legacyEvents,
      matchUpFormat = _ref.matchUpFormat,
      mainStructureId = _ref.mainStructureId;
  var entriesAccumulator = {};
  var structures = legacyEvents.map(function (legacyEvent) {
    var _getStructureContent = getStructureContent({
      eventType: eventType,
      tieFormat: tieFormat,
      tournament: tournament,
      legacyEvent: legacyEvent,
      participants: participants
    }),
        entries = _getStructureContent.entries,
        matchUps = _getStructureContent.matchUps,
        seedLimit = _getStructureContent.seedLimit,
        structures = _getStructureContent.structures,
        structureType = _getStructureContent.structureType,
        finishingPosition = _getStructureContent.finishingPosition,
        seedAssignments = _getStructureContent.seedAssignments,
        positionAssignments = _getStructureContent.positionAssignments;

    entries.forEach(function (entry) {
      entriesAccumulator[entry.participantId] = entry;
    });
    var stage = legacyEvent.euid === mainStructureId ? drawDefinitionConstants.MAIN : getStage({
      legacyEvent: legacyEvent
    });
    var structure = {
      stage: stage,
      matchUps: matchUps,
      seedLimit: seedLimit,
      finishingPosition: finishingPosition,
      seedAssignments: seedAssignments,
      positionAssignments: positionAssignments,
      stageSequence: 1,
      structureId: legacyEvent.euid,
      structureName: legacyEvent.name
    };
    if (structures) structure.structures = structures;
    if (structureType) structure.structureType = structureType;
    var format = legacyEvent.score_format;
    var formatCode = legacyEvent.matchFormat || format && matchFormatCode.stringify(scoreFormat.jsonTODS(format));
    if (formatCode || matchUpFormat) structure.matchUpFormat = formatCode || matchUpFormat;
    return structure;
  });
  var drawEntries = Object.values(entriesAccumulator);
  return {
    structures: structures,
    drawEntries: drawEntries
  };
}

function extractEvents(_ref) {
  var tournament = _ref.tournament,
      participants = _ref.participants;
  var eventCategories = {};
  var legacyEvents = tournament.events || [];
  var tournamentRecord = {
    participants: participants,
    tournamentId: "foo"
  };
  tournamentEngine.setState(tournamentRecord); // linkedStructures are events which have explicit links

  var linkedStructures = {};
  legacyEvents.forEach(function (legacyEvent) {
    var euid = legacyEvent.euid;
    var eventIds = [euid];
    legacyEvent.links && Object.keys(legacyEvent.links).forEach(function (key) {
      var linkedEuid = legacyEvent.links[key];
      eventIds.push(linkedEuid);
    });
    var groupEuid = intersection(Object.keys(linkedStructures), eventIds);

    if (groupEuid.length) {
      linkedStructures[groupEuid[0]][euid] = legacyEvent;
    } else {
      var _linkedStructures$eui;

      linkedStructures[euid] = (_linkedStructures$eui = {}, _linkedStructures$eui[euid] = legacyEvent, _linkedStructures$eui);
    }
  });
  Object.keys(linkedStructures).forEach(function (key) {
    var structureGroup = linkedStructures[key];
    var structureGroupIds = Object.keys(structureGroup);
    var groupStructures = structureGroupIds.map(function (id) {
      return structureGroup[id];
    });
    var structureGroupDrawTypes = groupStructures.map(function (event) {
      return event.draw_type;
    });
    var mainDrawTypes = ["E", "S"];

    if (!intersection(mainDrawTypes, structureGroupDrawTypes).length) {
      if (structureGroupDrawTypes.includes("R")) mainDrawTypes.push("R");else if (structureGroupDrawTypes.includes("A")) mainDrawTypes.push("A");else if (structureGroupDrawTypes.includes("C")) mainDrawTypes.push("C");else if (structureGroupDrawTypes.includes("Q")) mainDrawTypes.push("Q");else if (structureGroupDrawTypes.includes("P")) mainDrawTypes.push("P");else console.log("unlinked event", {
        structureGroup: structureGroup
      });
    }

    var mainLegacyEvent = groupStructures.find(function (legacyEvent) {
      return mainDrawTypes.includes(legacyEvent.draw_type);
    });
    var eventType = getMatchUpType(mainLegacyEvent.format) || (mainLegacyEvent.matchorder || tournament.type === "dual") && matchUpTypes.TEAM;
    var ageCategoryCode = getAgeCategoryCode(mainLegacyEvent.category);
    var category = {
      categoryName: mainLegacyEvent.category
    };
    if (ageCategoryCode) category.ageCategoryCode = ageCategoryCode;
    var name = mainLegacyEvent.name,
        automated = mainLegacyEvent.automated,
        draw_size = mainLegacyEvent.draw_size,
        matchorder = mainLegacyEvent.matchorder,
        draw_created = mainLegacyEvent.draw_created,
        broadcast_name = mainLegacyEvent.broadcast_name,
        custom_category = mainLegacyEvent.custom_category,
        legacyCategory = mainLegacyEvent.category;
    var tieFormat = mainLegacyEvent.matchorder && convertTieFormat(matchorder);
    var format = mainLegacyEvent.score_format;
    var matchUpFormat = mainLegacyEvent.matchFormat || format && matchFormatCode.stringify(scoreFormat.jsonTODS(format));

    var _extractStructures = extractStructures({
      eventType: eventType,
      tieFormat: tieFormat,
      tournament: tournament,
      participants: participants,
      matchUpFormat: matchUpFormat,
      mainStructureId: mainLegacyEvent.euid,
      legacyEvents: groupStructures
    }),
        structures = _extractStructures.structures,
        entries = _extractStructures.drawEntries;

    var drawDefinition = {
      // entries for a drawDefinition needs to be aggregated from structures
      drawId: utilities.UUID(),
      drawName: custom_category || broadcast_name || name || factoryConstants.drawDefinitionConstants.MAIN,
      createdAt: draw_created && new Date(draw_created).toISOString(),
      structures: structures,
      entries: entries
    };
    if (matchUpFormat) drawDefinition.matchUpFormat = matchUpFormat;
    var drawProfile = {
      automated: automated,
      drawSize: draw_size,
      category: {
        categoryName: legacyCategory
      }
    };

    if (tieFormat) {
      drawDefinition.tieFormat = tieFormat;
      drawProfile.tieFormat = tieFormat;
    }

    var extension = {
      name: "drawProfile",
      value: drawProfile
    };
    tournamentEngine.addDrawDefinitionExtension({
      drawDefinition: drawDefinition,
      extension: extension
    });
    var eventId = utilities.UUID();
    var surfaceCategory = getSurface(mainLegacyEvent);
    var indoorOutdoor = getIndoorOutdoor(mainLegacyEvent);
    var gender = getGender(mainLegacyEvent.gender);
    var eventRank = mainLegacyEvent.rank;
    var categoryName = category.categoryName + "-" + gender + "-" + eventType;

    if (!eventCategories[categoryName]) {
      eventCategories[categoryName] = {
        gender: gender,
        eventId: eventId,
        category: category,
        eventType: eventType,
        eventRank: eventRank,
        eventName: categoryName,
        drawDefinitions: [drawDefinition]
      };
      if (indoorOutdoor) eventCategories[categoryName].indoorOutdoor = indoorOutdoor;
      if (surfaceCategory) eventCategories[categoryName].surfaceCategory = surfaceCategory;
    } else {
      eventCategories[categoryName].drawDefinitions.push(drawDefinition);
      if (indoorOutdoor && !eventCategories[categoryName].indoorOutdoor) eventCategories[categoryName].indoorOutdoor = indoorOutdoor;
      if (surfaceCategory && !eventCategories[categoryName].surfaceCategory) eventCategories[categoryName].surfaceCategory = surfaceCategory;
    }
  });
  var events = Object.values(eventCategories);
  events.forEach(function (event) {
    var entriesAccumulator = {};
    event.drawDefinitions.forEach(function (drawDefinition) {
      drawDefinition.entries.forEach(function (entry) {
        entriesAccumulator[entry.participantId] = entry;
      });
    });
    event.entries = Object.values(entriesAccumulator);
  });
  return {
    events: events
  };
}

var dfx$1 = /*#__PURE__*/drawFx();
function extractParticipants(_ref) {
  var tournament = _ref.tournament,
      file = _ref.file;
  var individualParticipants = extractIndividualParticipants({
    tournament: tournament
  });
  var pairParticipants = extractPairParticipants({
    participants: individualParticipants,
    tournament: tournament,
    file: file
  });
  var teamParticipants = extractTeamParticipants({
    tournament: tournament,
    file: file
  });
  var competitorParticipants = individualParticipants.concat.apply(individualParticipants, pairParticipants.concat(teamParticipants));
  return {
    competitorParticipants: competitorParticipants
  };
}

function extractTeamParticipants(_ref2) {
  var tournament = _ref2.tournament;
  var teamParticipants = (tournament.teams || []).map(function (team) {
    var individualParticipantIds = Object.keys(team.players);
    var teamParticipant = {
      participantId: team.id,
      participantType: participantConstants.TEAM,
      participantRole: participantRoles.COMPETITOR,
      individualParticipantIds: individualParticipantIds,
      participantName: team.name
    };
    return teamParticipant;
  });
  return teamParticipants;
}

function extractPairParticipants(_ref3) {
  var tournament = _ref3.tournament,
      participants = _ref3.participants;
  var pairParticipants = [];
  var legacyEvents = tournament.events || [];
  var legacyDual = tournament.type === "dual";
  var relevantEvents = legacyEvents.filter(function (legacyEvent) {
    return legacyEvent.format === "D" || legacyDual;
  });
  relevantEvents.forEach(function (legacyEvent) {
    var matches = matchFx.eventMatches(legacyEvent, tournament, true);
    var teams = matches.map(function (match) {
      return match.teams;
    }).flat();
    teams.filter(function (team) {
      return Array.isArray(team) && team.length === 2;
    }).forEach(function (team) {
      var individualParticipants = team.map(function (player) {
        return participants.find(function (participant) {
          var _participant$person, _participant$person$p;

          var matchingParticipantId = participant.participantId === (player == null ? void 0 : player.id);
          var foundInOtherIds = participant == null ? void 0 : (_participant$person = participant.person) == null ? void 0 : (_participant$person$p = _participant$person.personOtherIds) == null ? void 0 : _participant$person$p.find(function (otherId) {
            return otherId.personId === (player == null ? void 0 : player.id);
          });
          return matchingParticipantId || foundInOtherIds;
        });
      }).filter(function (f) {
        return f;
      });

      if (individualParticipants.length === 2) {
        var participantName = individualParticipants.map(function (participant) {
          return participant.person.standardFamilyName;
        }).join("/");
        var individualParticipantIds = individualParticipants.map(function (participant) {
          return participant.participantId;
        });
        var pairParticipant = {
          participantId: utilities.UUID(),
          participantType: participantConstants.PAIR,
          participantRole: participantRoles.COMPETITOR,
          individualParticipantIds: individualParticipantIds,
          participantName: participantName
        };
        pairParticipants.push(pairParticipant);
      }
    });
  });
  return pairParticipants;
}

function extractIndividualParticipants(_ref4) {
  var _tournament$org, _tournament$events;

  var tournament = _ref4.tournament;
  var individualParticipants = [];
  var individualParticipantIds = [];
  var players = tournament.players || [];
  var tournamentStartDate = tournament.start && format(new Date(tournament.start), "yyyy-MM-dd");
  var tournamentCategory = tournament.category;
  var organisationId = (_tournament$org = tournament.org) == null ? void 0 : _tournament$org.ouid;

  function addParticipant(player) {
    var participantId = player.id || player.puid;
    var standardFamilyName = getName(player.last_name);
    var standardGivenName = getName(player.first_name);
    var participantName = standardFamilyName.toUpperCase() + ", " + standardGivenName;
    var birthDate = isValidDate(player.birth) && format(new Date(player.birth), "yyyy-MM-dd");
    var participant = {
      participantName: participantName,
      participantId: participantId,
      participantType: participantConstants.INDIVIDUAL,
      participantRole: participantRoles.COMPETITOR,
      timeItems: [],
      person: {
        personId: participantId,
        standardFamilyName: standardFamilyName,
        standardGivenName: standardGivenName,
        sex: getGender(player.sex),
        nationalityCode: player.ioc,
        birthDate: birthDate,
        otherNames: []
      }
    };
    addSignInStatus({
      player: player,
      participant: participant,
      tournamentStartDate: tournamentStartDate
    });
    addOtherNames({
      player: player,
      participant: participant
    });
    addOtherIds({
      player: player,
      participant: participant,
      organisationId: organisationId
    });
    addRankings({
      player: player,
      participant: participant,
      tournamentStartDate: tournamentStartDate,
      tournamentCategory: tournamentCategory
    });
    addRatings({
      player: player,
      participant: participant,
      tournamentStartDate: tournamentStartDate
    });
    addPenalties({
      player: player,
      participant: participant,
      tournamentStartDate: tournamentStartDate
    });

    if (!individualParticipantIds.includes(participant.participantId)) {
      individualParticipants.push(participant);
      individualParticipantIds.push(participantId);
    }
  }

  players.forEach(addParticipant);
  var relevantEvents = ((_tournament$events = tournament.events) == null ? void 0 : _tournament$events.filter(function (event) {
    return event.draw;
  })) || []; // check that there are no individual participants in draws that are not in tournament.players

  relevantEvents.forEach(function (event) {
    var matches = dfx$1.matches(event.draw);
    var players = matches.map(function (matchUp) {
      return matchUp.teams;
    }).flat(Infinity); // players which have .players are team participants

    players.filter(function (f) {
      return f && !f.players;
    }).forEach(addParticipant);
  });
  return individualParticipants;
}

function isValidDate(date) {
  if (!date) return;

  try {
    var dateObject = new Date(date);

    if (dateObject.trim() === errorConditionConstants.INVALID_DATE) {
      return false;
    }

    return true;
  } catch (err) {
    return false;
  }
}

function getName(text) {
  return normalizeName(text || "", ["de", "la", "da"]);
}

function addOtherNames(_ref5) {
  var player = _ref5.player,
      participant = _ref5.participant;
  if (player.nickname) participant.person.otherNames.push(player.nickname);
}

function addOtherIds(_ref6) {
  var player = _ref6.player,
      participant = _ref6.participant,
      organisationId = _ref6.organisationId;

  if (player.cropin) {
    var personOtherIds = [{
      organisationId: organisationId,
      uniqueOrganisationName: "HTS",
      personId: player.cropin
    }];
    participant.person.personOtherIds = personOtherIds;
  }

  if (player.id && player.puid && player.puid !== player.id) {
    if (!participant.person.personOtherIds) participant.person.personOtherIds = [];
    var otherId = {
      organisationId: organisationId,
      uniqueOrganisationName: "System",
      personId: player.puid
    };
    participant.person.personOtherIds.push(otherId);
  }
}

function addRankings(_ref7) {
  var player = _ref7.player,
      participant = _ref7.participant,
      tournamentStartDate = _ref7.tournamentStartDate,
      tournamentCategory = _ref7.tournamentCategory;

  if (player.rankings) {
    Object.keys(player.rankings).forEach(function (key) {
      var itemType = scaleConstants.SCALE + "." + scaleConstants.RANKING + ".SINGLES." + key;
      var timeItem = {
        itemType: itemType,
        itemValue: player.rankings[key],
        timestamp: tournamentStartDate
      };
      participant.timeItems.push(timeItem);
    });
  }

  if (player.category_dbls && tournamentCategory) {
    var itemType = scaleConstants.SCALE + "." + scaleConstants.RANKING + ".SINGLES." + tournamentCategory;
    var timeItem = {
      itemType: itemType,
      itemValue: player.category_dbls,
      timestamp: tournamentStartDate
    };
    participant.timeItems.push(timeItem);
  }
}

function addRatings(_ref8) {
  var player = _ref8.player,
      participant = _ref8.participant,
      tournamentStartDate = _ref8.tournamentStartDate;

  if (player.ratings) {
    Object.keys(player.ratings).forEach(function (key) {
      Object.keys(player.ratings[key]).forEach(function (ratingType) {
        var itemType = scaleConstants.SCALE + "." + scaleConstants.RATING + "." + ratingType.toUpperCase() + "." + key.toUpperCase();
        var timeItem = {
          itemType: itemType,
          itemValue: player.ratings[key][ratingType].value,
          timestamp: tournamentStartDate
        };
        if (timeItem.itemValue) participant.timeItems.push(timeItem);
      });
    });
  }
}

function addSignInStatus(_ref9) {
  var player = _ref9.player,
      participant = _ref9.participant,
      tournamentStartDate = _ref9.tournamentStartDate;
  var itemValue = player.signed_in ? participantConstants.SIGNED_IN : participantConstants.SIGNED_OUT;
  var timeItem = {
    itemSubject: participantConstants.SIGN_IN_STATUS,
    timeStamp: tournamentStartDate,
    itemValue: itemValue
  };
  participant.timeItems.push(timeItem);
}

function addPenalties(_ref10) {
  var player = _ref10.player,
      participant = _ref10.participant,
      tournamentStartDate = _ref10.tournamentStartDate;

  if (player.penalties) {
    participant.penalties = [];
    player.penalties.forEach(function (penalty) {
      var _penalty$penalty;

      var penaltyTime = isValidDate(penalty.time) && penalty.time || tournamentStartDate;
      var penaltyId = utilities.UUID();
      var penaltyItem = {
        penaltyId: penaltyId,
        matchUpId: penalty.muid,
        penaltyType: getPenaltyType(penalty),
        notes: (_penalty$penalty = penalty.penalty) == null ? void 0 : _penalty$penalty.label,
        createdAt: new Date(penaltyTime).toISOString()
      };
      participant.penalties.push(penaltyItem); // TODO: add to matchUp.timeItems

      /*
      const timeItem = {
        itemSubject: "PENALTY",
        itemValue: penaltyItem.penaltyId,
        timeStamp: penaltyItem.createdAt
      };
      */
    });
  }

  function getPenaltyType(penalty) {
    var _penalty$penalty2, _penalty$penalty3, _penalty$penalty4, _penalty$penalty5, _penalty$penalty6, _penalty$penalty7, _penalty$penalty8, _penalty$penalty9, _penalty$penalty10, _penalty$penalty11, _penalty$penalty12;

    if (((_penalty$penalty2 = penalty.penalty) == null ? void 0 : _penalty$penalty2.value) === "unsporting") return penaltyConstants.UNSPORTSMANLIKE_CONDUCT;
    if (((_penalty$penalty3 = penalty.penalty) == null ? void 0 : _penalty$penalty3.value) === "fail2signout") return penaltyConstants.FAILURE_TO_COMPLETE;
    if (((_penalty$penalty4 = penalty.penalty) == null ? void 0 : _penalty$penalty4.value) === "illegalcoaching") return penaltyConstants.COACHING;
    if (((_penalty$penalty5 = penalty.penalty) == null ? void 0 : _penalty$penalty5.value) === "ballabuse") return penaltyConstants.BALL_ABUSE;
    if (((_penalty$penalty6 = penalty.penalty) == null ? void 0 : _penalty$penalty6.value) === "racquetabuse") return penaltyConstants.RACKET_ABUSE;
    if (((_penalty$penalty7 = penalty.penalty) == null ? void 0 : _penalty$penalty7.value) === "equipmentabuse") return penaltyConstants.EQUIMENT_VIOLATION;
    if (((_penalty$penalty8 = penalty.penalty) == null ? void 0 : _penalty$penalty8.value) === "cursing") return penaltyConstants.UNSPORTSMANLIKE_CONDUCT;
    if (((_penalty$penalty9 = penalty.penalty) == null ? void 0 : _penalty$penalty9.value) === "rudegestures") return penaltyConstants.UNSPORTSMANLIKE_CONDUCT;
    if (((_penalty$penalty10 = penalty.penalty) == null ? void 0 : _penalty$penalty10.value) === "foullanguage") return penaltyConstants.UNSPORTSMANLIKE_CONDUCT;
    if (((_penalty$penalty11 = penalty.penalty) == null ? void 0 : _penalty$penalty11.value) === "timeviolation") return penaltyConstants.PUNCTUALITY;
    if (((_penalty$penalty12 = penalty.penalty) == null ? void 0 : _penalty$penalty12.value) === "latearrival") return penaltyConstants.PUNCTUALITY;
  }
}

/*
organisation = club
organizers
location
*/

function extractTournamentInfo(_ref) {
  var _tournament$org, _tournament$org2, _tournament$org3;

  var tournament = _ref.tournament;
  var tournamentId = tournament.tuid;
  var organisationId = (_tournament$org = tournament.org) == null ? void 0 : _tournament$org.ouid;
  var venues = getLocations(tournament);
  var surfaceCategory = getSurface(tournament);
  var indoorOutdoor = getIndoorOutdoor(tournament);
  var onlineResources = getOnlineResources(tournament);
  var tournamentInfo = {
    tournamentId: tournamentId,
    tournamentName: tournament.name,
    startDate: tournament.start && new Date(format(new Date(tournament.start), "yyyy-MM-dd")).toISOString(),
    endDate: tournament.end && new Date(format(new Date(tournament.end), "yyyy-MM-dd")).toISOString(),
    parentOrganisationId: organisationId,
    unifiedTournamentId: {
      tournamentId: tournamentId,
      organisationId: organisationId,
      organisationName: (_tournament$org2 = tournament.org) == null ? void 0 : _tournament$org2.name,
      organisationAbbreviation: (_tournament$org3 = tournament.org) == null ? void 0 : _tournament$org3.abbr
    }
  };
  if (venues) tournamentInfo.venues = venues;
  if (tournament.notes) tournamentInfo.notes = tournament.notes;
  if (indoorOutdoor) tournamentInfo.indoorOutdoor = indoorOutdoor;
  if (onlineResources) tournamentInfo.onlineResources = onlineResources;
  if (surfaceCategory) tournamentInfo.surfaceCategory = surfaceCategory;
  var organisationParticipants = [getRefereeParticipant(tournament.judge), (tournament.umpires || []).map(function (umpire) {
    return getRefereeParticipant(umpire);
  })].filter(function (f) {
    return f;
  });
  return {
    tournamentInfo: tournamentInfo,
    organisationParticipants: organisationParticipants
  };
}

function getOnlineResources(tournament) {
  var _tournament$media, _tournament$publishin;

  var social = ((_tournament$media = tournament.media) == null ? void 0 : _tournament$media.social) || {};
  var sponsorImages = ((_tournament$publishin = tournament.publishing) == null ? void 0 : _tournament$publishin.sponsors) || [];
  var onlineResources = Object.keys(social).map(function (provider) {
    var identifier = social[provider];
    var onlineResource = {
      provider: provider,
      identifier: identifier,
      type: "SOCIAL_MEDIA"
    };
    return onlineResource;
  });
  sponsorImages.forEach(function (identifier) {
    var onlineResource = {
      identifier: identifier,
      type: "SPONSOR",
      subType: "LOGO"
    };
    onlineResources.push(onlineResource);
  });
  return onlineResources;
}

function getLocations(tournament) {
  var range = function range(start, end) {
    return Array.from({
      length: end - start
    }, function (v, k) {
      return k + start;
    });
  };

  var venues = (tournament.locations || []).map(function (location) {
    var venueId = location.luid;
    var venueAbbreviation = location.abbreviation;
    var courts = range(0, parseInt(location.courts)).map(function (index) {
      var identifier = location.identifiers && location.identifiers[index] || index + 1;
      var courtName = venueAbbreviation + " " + identifier;
      var court = {
        courtName: courtName,
        courtId: venueId + "-" + index
      };
      return court;
    });
    var venue = {
      courts: courts,
      venueId: venueId,
      venueAbbreviation: venueAbbreviation,
      venueName: location.name,
      addresses: [{
        addressType: "VENUE",
        latitude: location.latitide,
        longitude: location.longitude,
        addressLine1: location.address
      }]
    };
    return venue;
  });
  return venues;
}

function getRefereeParticipant(referee) {
  if (!referee) return;

  var _referee$split = referee.split(" "),
      standardGivenName = _referee$split[0],
      standardFamilyName = _referee$split[1];

  var participantId = utilities.UUID();
  return {
    name: referee,
    participantId: participantId,
    participantType: participantConstants.INDIVIDUAL,
    participantRole: participantRoles.OFFICIAL,
    person: {
      personId: participantId,
      standardFamilyName: standardFamilyName,
      standardGivenName: standardGivenName
    }
  };
}

// player Representatives
// Compressed draw structures... with D3 visualizations works fine... may not work with React-draws
// drawEngine.buildDrawHierarchy is not handling pre-round structures which have only one children[] attribute rather than true hierarchy

function getTournamentRecordTODS(_ref) {
  var tournament = _ref.tournament;

  var _extractTournamentInf = extractTournamentInfo({
    tournament: tournament
  }),
      tournamentInfo = _extractTournamentInf.tournamentInfo,
      organisationParticipants = _extractTournamentInf.organisationParticipants;

  var _extractParticipants = extractParticipants({
    tournament: tournament
  }),
      competitorParticipants = _extractParticipants.competitorParticipants;

  var participants = competitorParticipants.concat.apply(competitorParticipants, organisationParticipants);

  var _extractEvents = extractEvents({
    tournament: tournament,
    participants: participants
  }),
      events = _extractEvents.events;

  var tournamentRecord = _extends({}, tournamentInfo, {
    participants: participants,
    events: events
  });

  return {
    tournamentRecord: tournamentRecord
  };
}

export default getTournamentRecordTODS;
export { getTournamentRecordTODS };
//# sourceMappingURL=tods-tmx-legacy-converter.esm.js.map
