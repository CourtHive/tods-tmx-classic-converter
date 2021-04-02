/*
 * TODO: if the final set is NOT different then don't include in string
 */

const SET = "SET";
const NOAD = "NOAD";
const TIMED = "timed";
const FINAL = "final";
const NORMAL = "normal";
const setTypes = {
  S: NORMAL,
  F: FINAL,
};

export const matchFormatCode = (function () {
  let fx = {};

  fx.stringify = (matchformatobject) => {
    if (matchformatobject && typeof matchformatobject === "object") {
      if (matchformatobject.timed && !isNaN(matchformatobject.minutes))
        return timedFormat(matchformatobject);
      if (matchformatobject.bestOf && matchformatobject.setFormat)
        return setFormat(matchformatobject);
    }
  };

  function timedFormat(matchformatobject) {
    return `T${matchformatobject.minutes}`;
  }

  function setFormat(matchformatobject) {
    let best_of = getNumber(matchformatobject.bestOf);
    let bestOf = (best_of && `${SET}${best_of}`) || "";
    let normal_set = stringifySet(matchformatobject.setFormat);
    let normalSet = (normal_set && `S:${normal_set}`) || "";
    let final_set = stringifySet(matchformatobject.finalSetFormat);
    let finalSet =
      (best_of > 1 && final_set && !final_set.invalid && `F:${final_set}`) ||
      "";
    let valid =
      bestOf &&
      normal_set &&
      !normal_set.invalid &&
      (!final_set || !final_set.invalid);
    if (valid) {
      return [bestOf, normalSet, finalSet].filter((f) => f).join("-");
    }
  }

  function stringifySet(setobject) {
    if (setobject) {
      if (typeof setobject === "object") {
        if (setobject.tiebreakSet) return tiebreakFormat(setobject.tiebreakSet);
        let setTo = getNumber(setobject.setTo);
        if (setTo) {
          let NoAD = (setobject.NoAD && NOAD) || "";
          let set_tiebreak = tiebreakFormat(setobject.tiebreakFormat);
          let setTiebreak =
            (set_tiebreak && !set_tiebreak.invalid && `/${set_tiebreak}`) || "";
          let tiebreak_at = getNumber(setobject.tiebreakAt);
          let tiebreakAt =
            (tiebreak_at && tiebreak_at !== setTo && `@${tiebreak_at}`) || "";
          let valid = !set_tiebreak || !set_tiebreak.invalid;
          if (valid) {
            return `${setTo}${NoAD}${setTiebreak}${tiebreakAt}`;
          } else {
            return { invalid: true };
          }
        } else {
          return { invalid: true };
        }
      }
    }
  }

  function tiebreakFormat(tieobject) {
    if (tieobject) {
      if (typeof tieobject === "object" && getNumber(tieobject.tiebreakTo)) {
        return `TB${tieobject.tiebreakTo}${tieobject.NoAD ? NOAD : ""}`;
      } else {
        return { invalid: true };
      }
    }
  }

  fx.parse = (matchformatcode) => {
    if (matchformatcode && typeof matchformatcode === "string") {
      let type =
        matchformatcode.indexOf("T") === 0
          ? "timed"
          : matchformatcode.indexOf(SET) === 0
          ? SET
          : "";
      if (type === TIMED) return timedMatch(matchformatcode);
      if (type === SET) return setsMatch(matchformatcode);
    }
  };

  function setsMatch(formatstring) {
    let parts = formatstring.split("-");

    let bestOf = getNumber(parts[0].slice(3));
    let setFormat = parts && parseSetFormat(parts[1]);
    let finalSetFormat = parts && parseSetFormat(parts[2]);

    let validBestOf = bestOf && bestOf < 6;
    let validFinalSet =
      !parts[2] || (finalSetFormat && !finalSetFormat.invalid);
    let validSetsFormat = setFormat && !setFormat.invalid;

    let result = { bestOf, setFormat };
    if (finalSetFormat) result.finalSetFormat = finalSetFormat;
    if (validBestOf && validSetsFormat && validFinalSet) return result;
  }

  function parseSetFormat(formatstring) {
    if (formatstring && formatstring[1] === ":") {
      let parts = formatstring.split(":");
      let set_type = setTypes[parts[0]];
      let set_format = parts[1];
      if (set_type && set_format) {
        let tiebreakSet = set_format.indexOf("TB") === 0;
        if (tiebreakSet)
          return { tiebreakSet: parseTiebreakFormat(set_format) };
        let parts = formatstring.match(/^[FS]{1}:(\d+)([A-Za-z]*)/);
        let NoAD = (parts && isNoAD(parts[2])) || false;
        let validNoAD = !parts || !parts[2] || NoAD;
        let setTo = parts && getNumber(parts[1]);
        let tiebreak_at = parseTiebreakAt(set_format);
        let validTiebreakAt =
          !tiebreak_at || (tiebreak_at && !tiebreak_at.invalid);
        let tiebreakAt = (validTiebreakAt && tiebreak_at) || setTo;
        let tiebreakFormat = parseTiebreakFormat(set_format.split("/")[1]);
        let validTiebreak = !tiebreakFormat || !tiebreakFormat.invalid;
        let result = { setTo };
        if (NoAD) result.NoAD = true;
        if (tiebreakFormat) {
          result.tiebreakFormat = tiebreakFormat;
          result.tiebreakAt = tiebreakAt;
        } else {
          result.noTiebreak = true;
        }
        return (
          (setTo &&
            validNoAD &&
            validTiebreak &&
            validTiebreakAt &&
            result) || { invalid: true }
        );
      }
    }
  }

  function parseTiebreakAt(set_format) {
    let tiebreak_at =
      set_format && set_format.indexOf("@") > 0 && set_format.split("@");
    if (tiebreak_at) {
      let tiebreakAt = getNumber(tiebreak_at[1]);
      return tiebreakAt || { invalid: true };
    }
  }

  function parseTiebreakFormat(formatstring) {
    if (formatstring) {
      if (formatstring.indexOf("TB") === 0) {
        let parts = formatstring.match(/^TB(\d+)([A-Za-z]*)/);
        let tiebreak_to = parts && parts[1];
        let NoAD = parts && isNoAD(parts[2]);
        let validNoAD = !parts || !parts[2] || NoAD;
        let tiebreakTo = getNumber(tiebreak_to);
        if (tiebreakTo && validNoAD) {
          let result = { tiebreakTo };
          if (NoAD) result.NoAD = true;
          return result;
        } else {
          return { invalid: true };
        }
      } else {
        return { invalid: true };
      }
    }
  }

  function timedMatch(formatstring) {
    let timestring = formatstring.slice(1);
    let minutes = getNumber(timestring);
    if (minutes) return { timed: true, minutes };
  }

  function isNoAD(formatstring) {
    return formatstring && formatstring.indexOf(NOAD) >= 0;
  }

  function getNumber(formatstring) {
    return !isNaN(Number(formatstring)) && Number(formatstring);
  }

  return fx;
})();
