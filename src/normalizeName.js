export function normalizeName(name) {
  if (!name) return '';
  const particles = ['del', 'de', 'di', 'du', 'van', 'von', 'ten'];
  name = name.replace(/\s+/g, ' ').trim();
  const nNames = name.split(' ').map(m => m.toLowerCase());

  const nName = nNames
    .map(function(m, i) {
      if (
        i === 0 ||
        i === nNames.length - 1 ||
        particles.indexOf(m.toLowerCase()) < 0
      )
        m = m ? m[0].toUpperCase() + m.slice(1) : '';
      return m;
    })
    .join(' ');

  return upperAfterDash(supportApostrophe(nName));

  function supportApostrophe(name) {
    const s_name = name.split(' ');
    const mod_name = s_name.map(n => {
      if (n.length > 2 && n[1] === "'") {
        n = replaceAt(n, 2, n[2].toUpperCase());
        if (n[0] === 'D') {
          n = replaceAt(n, 0, 'd');
        }
      }
      return n;
    });
    return mod_name.join(' ');
  }

  function replaceAt(s, n, t) {
    return s.substring(0, n) + t + s.substring(n + 1);
  }
}

function upperAfterDash(name, allSegments) {
  return name
    .split('-')
    .map(afterDash)
    .join('-');

  function afterDash(segment, i) {
    let modified = segment.slice(0, 1).toUpperCase() + segment.slice(1);
    return allSegments || i ? modified : segment;
  }
}
