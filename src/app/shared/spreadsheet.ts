/**
 * Lecture / écriture de tableurs sans dépendance externe :
 *  - CSV (séparateur ; , ou tabulation, UTF-8 ou Windows-1252 comme Excel en français) ;
 *  - XLSX minimal (feuilles, largeur de colonnes, listes déroulantes).
 */

export type Cell = string | number | null;

// ---------------------------------------------------------------- CSV

export function toCsv(rows: Cell[][]): string {
  const esc = (v: Cell) => {
    const s = v == null ? '' : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map(r => r.map(esc).join(';')).join('\r\n') + '\r\n';
}

export function parseCsv(text: string): string[][] {
  text = text.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const sep = [';', '\t', ','].map(c => ({ c, n: firstLine.split(c).length })).sort((a, b) => b.n - a.n)[0].c;
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** Décode un CSV : UTF-8 si possible, sinon Windows-1252 (CSV enregistré par Excel FR). */
export function decodeText(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('windows-1252').decode(buf);
  }
}

// ---------------------------------------------------------------- ZIP

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const b of data) crc = CRC_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Archive ZIP non compressée (suffisant pour un petit classeur). */
function zip(files: { name: string; data: string }[]): Blob {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = enc.encode(f.data);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
    local.setUint32(14, crc, true); local.setUint32(18, data.length, true); local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    parts.push(new Uint8Array(local.buffer), name, data);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true);
    cd.setUint32(16, crc, true); cd.setUint32(20, data.length, true); cd.setUint32(24, data.length, true);
    cd.setUint16(28, name.length, true); cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)] as BlobPart[],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

async function unzip(buf: ArrayBuffer): Promise<Map<string, string>> {
  const view = new DataView(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Fichier Excel illisible.');
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out = new Map<string, string>();
  for (let i = 0; i < count; i++) {
    const method = view.getUint16(p + 10, true);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true), extraLen = view.getUint16(p + 30, true), commentLen = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (!name.endsWith('.xml') && !name.endsWith('.rels')) continue;
    const start = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
    const raw = new Uint8Array(buf, start, size);
    let data: Uint8Array;
    if (method === 0) data = raw;
    else if (method === 8) {
      const stream = new Blob([raw as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      data = new Uint8Array(await new Response(stream).arrayBuffer());
    } else continue;
    out.set(name, dec.decode(data));
  }
  return out;
}

// ---------------------------------------------------------------- XLSX

export interface SheetSpec {
  name: string;
  rows: Cell[][];
  widths?: number[];
  /** Listes déroulantes : plage (ex. « B2:B500 ») et formule (ex. « "Dépense,Revenu" » ou « Listes!$A$2:$A$20 »). */
  lists?: { range: string; formula: string }[];
  freezeHeader?: boolean;
}

const xmlEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function colName(i: number): string {
  let s = '';
  for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}

function sheetXml(sheet: SheetSpec): string {
  const rows = sheet.rows.map((r, ri) => {
    const cells = r.map((v, ci) => {
      if (v == null || v === '') return '';
      const ref = `${colName(ci)}${ri + 1}`;
      const style = ri === 0 ? ' s="1"' : '';
      return typeof v === 'number'
        ? `<c r="${ref}"${style}><v>${v}</v></c>`
        : `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
    }).join('');
    return `<row r="${ri + 1}">${cells}</row>`;
  }).join('');
  const pane = sheet.freezeHeader
    ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    : '';
  const cols = sheet.widths?.length
    ? `<cols>${sheet.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
  const lists = sheet.lists?.length
    ? `<dataValidations count="${sheet.lists.length}">${sheet.lists.map(l =>
      `<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${l.range}"><formula1>${xmlEsc(l.formula)}</formula1></dataValidation>`).join('')}</dataValidations>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${pane}${cols}<sheetData>${rows}</sheetData>${lists}</worksheet>`;
}

export function buildXlsx(sheets: SheetSpec[]): Blob {
  const ns = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  return zip([
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
</Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${ns}/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${ns}"><sheets>${sheets.map((s, i) =>
      `<sheet name="${xmlEsc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) =>
      `<Relationship Id="rId${i + 1}" Type="${ns}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="${ns}/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8833A"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>` },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s) })),
  ]);
}

/** Lit la première feuille d'un classeur .xlsx (valeurs brutes ; les dates Excel restent des nombres). */
export async function readXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const files = await unzip(buf);
  const parse = (xml?: string) => xml ? new DOMParser().parseFromString(xml, 'application/xml') : null;
  const RNS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

  let sheetPath = 'xl/worksheets/sheet1.xml';
  const wb = parse(files.get('xl/workbook.xml'));
  const rels = parse(files.get('xl/_rels/workbook.xml.rels'));
  const firstSheet = wb?.getElementsByTagName('sheet')[0];
  const rid = firstSheet?.getAttributeNS(RNS, 'id') ?? firstSheet?.getAttribute('r:id');
  const target = rid && Array.from(rels?.getElementsByTagName('Relationship') ?? []).find(r => r.getAttribute('Id') === rid)?.getAttribute('Target');
  if (target) sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target}`;

  const shared = Array.from(parse(files.get('xl/sharedStrings.xml'))?.getElementsByTagName('si') ?? [])
    .map(si => Array.from(si.getElementsByTagName('t')).map(t => t.textContent ?? '').join(''));
  const sheet = parse(files.get(sheetPath));
  if (!sheet) throw new Error('Feuille introuvable dans le fichier Excel.');

  const rows: string[][] = [];
  for (const row of Array.from(sheet.getElementsByTagName('row'))) {
    const r = Number(row.getAttribute('r')) - 1;
    const values: string[] = [];
    for (const c of Array.from(row.getElementsByTagName('c'))) {
      const ref = c.getAttribute('r') ?? '';
      const letters = ref.replace(/\d+/g, '');
      const col = letters.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
      const type = c.getAttribute('t');
      const v = c.getElementsByTagName('v')[0]?.textContent ?? '';
      values[col < 0 ? values.length : col] =
        type === 's' ? shared[Number(v)] ?? ''
          : type === 'inlineStr' ? Array.from(c.getElementsByTagName('t')).map(t => t.textContent ?? '').join('')
            : v;
    }
    rows[r] = Array.from(values, v => v ?? '');
  }
  return Array.from(rows, r => r ?? []);
}

/** Lit un fichier .xlsx, .csv ou .txt choisi par l'utilisateur. */
export async function readSpreadsheet(file: File): Promise<string[][]> {
  const buf = await file.arrayBuffer();
  const head = new Uint8Array(buf, 0, Math.min(4, buf.byteLength));
  const isZip = head[0] === 0x50 && head[1] === 0x4b;
  if (isZip) return readXlsx(buf);
  if (/\.xls$/i.test(file.name)) throw new Error('Ancien format .xls non pris en charge : enregistrez le fichier en .xlsx ou .csv.');
  return parseCsv(decodeText(buf));
}
