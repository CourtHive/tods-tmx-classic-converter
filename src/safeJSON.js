export function parse({ note, data, maxTilde }) {
  if (!data) return undefined;
  if (typeof data !== 'string') return data;
  return parseNormal({ note, data });
}

function parseNormal({ note, data }) {
  try {
    return JSON.parse(data);
  } catch (err) {
    console.log({
      message: '-------------------------> falied normal parse',
      note,
    });
  }
}

export function stringify(data) {
  if (!data) return undefined;
  if (typeof data === 'string') return data;
  try {
    return JSON.stringify(data);
  } catch (e) {
    return cStringify(data);
  }
}
