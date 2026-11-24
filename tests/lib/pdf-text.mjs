// The text of each page of a PDF, without a dependency: enough of the format to read what Chromium prints
// (scenario S3's annual report now, the report's footer from version 0.4.0). It parses the objects (object
// streams included), walks the page tree in order, inflates each page's content streams and decodes the
// text-showing operators through each font's ToUnicode map. Spacing is approximate: a positioning operator
// or a wide kerning gap becomes a space, so compare texts with their white space normalised or removed.

import zlib from "node:zlib";

const WS = /[\0\t\n\f\r ]/;
const DELIM = /[()<>[\]{}/%]/;

/** A tokenizer over a latin1 string of PDF syntax (an object or a content stream). */
function tokens(src) {
  const out = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (WS.test(c)) { i += 1; continue; }
    if (c === "%") { while (i < n && src[i] !== "\n" && src[i] !== "\r") i += 1; continue; }
    if (c === "(") {
      let depth = 1;
      let s = "";
      i += 1;
      while (i < n && depth) {
        const d = src[i];
        if (d === "\\") {
          const e = src[i + 1];
          const map = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "(": "(", ")": ")", "\\": "\\" };
          if (e in map) { s += map[e]; i += 2; continue; }
          if (/[0-7]/.test(e)) {
            let oct = "";
            let j = i + 1;
            while (j < n && oct.length < 3 && /[0-7]/.test(src[j])) oct += src[j++];
            s += String.fromCharCode(parseInt(oct, 8) & 0xff);
            i = j;
            continue;
          }
          if (e === "\r" || e === "\n") { i += 2; if (e === "\r" && src[i] === "\n") i += 1; continue; }
          i += 1;
          continue;
        }
        if (d === "(") depth += 1;
        if (d === ")") { depth -= 1; if (!depth) { i += 1; break; } }
        s += d;
        i += 1;
      }
      out.push({ t: "str", v: s });
      continue;
    }
    if (c === "<" && src[i + 1] === "<") { out.push({ t: "<<" }); i += 2; continue; }
    if (c === ">" && src[i + 1] === ">") { out.push({ t: ">>" }); i += 2; continue; }
    if (c === "<") {
      const end = src.indexOf(">", i);
      const hex = src.slice(i + 1, end).replace(/\s+/g, "");
      let s = "";
      for (let k = 0; k < hex.length; k += 2) s += String.fromCharCode(parseInt((hex.slice(k, k + 2) + "0").slice(0, 2), 16));
      out.push({ t: "str", v: s, hex: true });
      i = end + 1;
      continue;
    }
    if (c === "[" || c === "]" || c === "{" || c === "}") { out.push({ t: c }); i += 1; continue; }
    if (c === "/") {
      let j = i + 1;
      while (j < n && !WS.test(src[j]) && !DELIM.test(src[j])) j += 1;
      out.push({ t: "name", v: src.slice(i + 1, j) });
      i = j;
      continue;
    }
    let j = i;
    while (j < n && !WS.test(src[j]) && !DELIM.test(src[j])) j += 1;
    if (j === i) { i += 1; continue; }
    const word = src.slice(i, j);
    out.push(/^[+-]?(\d+\.?\d*|\.\d+)$/.test(word) ? { t: "num", v: Number(word) } : { t: "op", v: word });
    i = j;
  }
  return out;
}

/** A PDF value from tokens at position p: { value, next }. Refs become { ref: n }. */
function parseValue(tk, p) {
  const x = tk[p];
  if (!x) return { value: null, next: p + 1 };
  if (x.t === "<<") {
    const dict = {};
    let q = p + 1;
    while (q < tk.length && tk[q].t !== ">>") {
      const key = tk[q].v;
      const r = parseValue(tk, q + 1);
      dict[key] = r.value;
      q = r.next;
    }
    return { value: dict, next: q + 1 };
  }
  if (x.t === "[") {
    const arr = [];
    let q = p + 1;
    while (q < tk.length && tk[q].t !== "]") {
      const r = parseValue(tk, q);
      arr.push(r.value);
      q = r.next;
    }
    return { value: arr, next: q + 1 };
  }
  if (x.t === "num" && tk[p + 1]?.t === "num" && tk[p + 2]?.t === "op" && tk[p + 2].v === "R") return { value: { ref: x.v }, next: p + 3 };
  if (x.t === "name") return { value: { name: x.v }, next: p + 1 };
  return { value: x.v, next: p + 1 };
}

/** Every object of the file: number → { dict, stream (Buffer, inflated where FlateDecode) }. */
function objects(buf) {
  const src = buf.toString("latin1");
  const objs = new Map();
  const re = /(\d+)\s+(\d+)\s+obj\b/g;
  let m;
  while ((m = re.exec(src))) {
    const start = m.index + m[0].length;
    const end = src.indexOf("endobj", start);
    if (end < 0) break;
    const body = src.slice(start, end);
    const at = body.search(/\bstream(\r\n|\n|\r)/);
    let dict;
    let stream = null;
    if (at >= 0) {
      dict = parseValue(tokens(body.slice(0, at)), 0).value;
      const eol = body.slice(at).match(/^stream(\r\n|\n|\r)/)[0].length;
      const from = start + at + eol;
      let to = src.indexOf("endstream", from);
      const len = typeof dict?.Length === "number" ? dict.Length : null;
      if (len !== null && from + len <= to) to = from + len;
      stream = buf.subarray(from, to);
      const filter = dict?.Filter;
      const names = Array.isArray(filter) ? filter.map((f) => f?.name) : [filter?.name];
      if (names.includes("FlateDecode")) {
        try { stream = zlib.inflateSync(stream); } catch { stream = zlib.inflateSync(stream, { finishFlush: zlib.constants.Z_SYNC_FLUSH }); }
      }
    } else {
      dict = parseValue(tokens(body), 0).value;
    }
    objs.set(Number(m[1]), { dict, stream });
    re.lastIndex = end;
  }
  // Objects packed in object streams.
  for (const [, o] of [...objs]) {
    if (o.dict?.Type?.name !== "ObjStm" || !o.stream) continue;
    const s = o.stream.toString("latin1");
    const first = o.dict.First;
    const head = tokens(s.slice(0, first)).map((x) => x.v);
    for (let k = 0; k + 1 < head.length; k += 2) {
      const num = head[k];
      const off = first + head[k + 1];
      const nextOff = k + 3 < head.length ? first + head[k + 3] : s.length;
      if (!objs.has(num)) objs.set(num, { dict: parseValue(tokens(s.slice(off, nextOff)), 0).value, stream: null });
    }
  }
  return objs;
}

/** A font's ToUnicode map: { bytes (code length), map (code → text) }. */
function toUnicode(cmapText) {
  const map = new Map();
  const hexToText = (h) => {
    let s = "";
    for (let k = 0; k + 4 <= h.length; k += 4) s += String.fromCharCode(parseInt(h.slice(k, k + 4), 16));
    return s;
  };
  let bytes = 1;
  const space = cmapText.match(/begincodespacerange\s*<([0-9a-fA-F]+)>/);
  if (space) bytes = space[1].length / 2;
  for (const block of cmapText.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const p of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g)) map.set(parseInt(p[1], 16), hexToText(p[2]));
  }
  for (const block of cmapText.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const p of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<([0-9a-fA-F]+)>|\[([^\]]*)\])/g)) {
      const lo = parseInt(p[1], 16);
      const hi = parseInt(p[2], 16);
      if (p[4] !== undefined) {
        const base = p[4];
        const last = parseInt(base.slice(-4), 16);
        for (let c = lo; c <= hi; c++) map.set(c, hexToText(base.slice(0, -4) + (last + c - lo).toString(16).padStart(4, "0")));
      } else {
        const list = [...p[5].matchAll(/<([0-9a-fA-F]+)>/g)].map((x) => hexToText(x[1]));
        for (let c = lo; c <= hi; c++) map.set(c, list[c - lo] ?? "");
      }
    }
  }
  return { bytes, map };
}

/** The pages of a PDF in order, each { text }. */
export function pdfPages(buf) {
  const objs = objects(Buffer.isBuffer(buf) ? buf : Buffer.from(buf));
  const get = (v) => (v && typeof v === "object" && "ref" in v ? objs.get(v.ref)?.dict ?? null : v);
  const streamOf = (v) => (v && typeof v === "object" && "ref" in v ? objs.get(v.ref)?.stream ?? null : null);
  const catalog = [...objs.values()].find((o) => o.dict?.Type?.name === "Catalog")?.dict;
  const pages = [];
  const walk = (node, inherited) => {
    const d = get(node);
    if (!d) return;
    const res = d.Resources ?? inherited;
    if (d.Type?.name === "Pages") for (const kid of d.Kids || []) walk(kid, res);
    else if (d.Type?.name === "Page") pages.push({ dict: d, resources: get(res) });
  };
  walk(catalog?.Pages, null);
  const fontCache = new Map();
  const fontOf = (ref) => {
    const key = ref?.ref ?? JSON.stringify(ref);
    if (fontCache.has(key)) return fontCache.get(key);
    const f = get(ref);
    const cm = streamOf(f?.ToUnicode);
    const u = cm ? toUnicode(cm.toString("latin1")) : { bytes: f?.Subtype?.name === "Type0" ? 2 : 1, map: new Map() };
    fontCache.set(key, u);
    return u;
  };
  return pages.map(({ dict, resources }) => {
    const contents = Array.isArray(dict.Contents) ? dict.Contents : [dict.Contents];
    const content = contents.map((c) => streamOf(c)?.toString("latin1") || "").join("\n");
    const fonts = get(resources?.Font) || {};
    let font = { bytes: 1, map: new Map() };
    let text = "";
    const show = (s) => {
      for (let k = 0; k + font.bytes <= s.length; k += font.bytes) {
        let code = 0;
        for (let b = 0; b < font.bytes; b++) code = (code << 8) | s.charCodeAt(k + b);
        text += font.map.has(code) ? font.map.get(code) : font.bytes === 1 ? String.fromCharCode(code) : "";
      }
    };
    const tk = tokens(content);
    const stack = [];
    for (let p = 0; p < tk.length; p++) {
      const x = tk[p];
      if (x.t !== "op") {
        if (x.t === "[") {
          const r = parseValue(tk, p);
          stack.push({ arr: r.value });
          p = r.next - 1;
        } else stack.push(x);
        continue;
      }
      const op = x.v;
      if (op === "Tf") {
        const name = stack[stack.length - 2]?.v;
        if (name && fonts[name]) font = fontOf(fonts[name]);
      } else if (op === "Tj" || op === "'" || op === "\"") {
        if (op !== "Tj") text += " ";
        const s = stack[stack.length - 1];
        if (s?.t === "str") show(s.v);
      } else if (op === "TJ") {
        const arr = stack[stack.length - 1]?.arr || [];
        for (const e of arr) {
          if (typeof e === "string") show(e);
          else if (typeof e === "number" && e < -200) text += " ";
        }
      } else if (op === "Td" || op === "TD" || op === "Tm" || op === "T*" || op === "ET") {
        if (!text.endsWith(" ")) text += " ";
      }
      stack.length = 0;
    }
    return { text: text.replace(/\s+/g, " ").trim() };
  });
}

/** Text with all white space removed, for comparing a quote with a page whatever the spacing. */
export const squash = (s) => String(s ?? "").replace(/\s+/gu, "");
