import { Account, Category, CategoryType, ExtractedLine, TransactionRequest, today } from '../../core/models';
import { Cell, SheetSpec, buildXlsx, toCsv } from '../../shared/spreadsheet';

/** Colonnes du modèle (identiques à l'export CSV, pour pouvoir réimporter un export). */
export const COLUMNS = ['Date', 'Type', 'Catégorie', 'Compte', 'Montant', 'Description'];
const MAX_ROWS = 500;
const EXAMPLE = 'Exemple';

export interface ImportedLine { line: TransactionRequest; warning?: string; }
export interface ImportResult { lines: ImportedLine[]; skipped: number; }

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

function exampleRows(categories: Category[], accounts: Account[]): Cell[][] {
  const exp = categories.find(c => c.type === 'EXPENSE')?.name ?? '';
  const inc = categories.find(c => c.type === 'INCOME')?.name ?? '';
  const acc = accounts[0]?.name ?? '';
  return [
    [today(), 'Dépense', exp, acc, 2500, `${EXAMPLE} : à remplacer (ligne ignorée)`],
    [today(), 'Revenu', inc, acc, 150000, `${EXAMPLE} : à remplacer (ligne ignorée)`],
  ];
}

export function csvTemplate(categories: Category[], accounts: Account[]): Blob {
  return new Blob([toCsv([COLUMNS, ...exampleRows(categories, accounts)])], { type: 'text/csv;charset=utf-8' });
}

export function xlsxTemplate(categories: Category[], accounts: Account[]): Blob {
  const exp = categories.filter(c => c.type === 'EXPENSE').map(c => c.name);
  const inc = categories.filter(c => c.type === 'INCOME').map(c => c.name);
  const catList = [...exp, ...inc];
  const accList = accounts.map(a => a.name);
  const height = Math.max(catList.length, accList.length, exp.length, inc.length);
  const listRows: Cell[][] = [['Catégories (toutes)', 'Dépenses', 'Revenus', 'Comptes']];
  for (let i = 0; i < height; i++) listRows.push([catList[i] ?? null, exp[i] ?? null, inc[i] ?? null, accList[i] ?? null]);
  const last = MAX_ROWS + 1;

  const sheets: SheetSpec[] = [
    {
      name: 'Opérations', freezeHeader: true, widths: [13, 11, 24, 22, 13, 40],
      rows: [COLUMNS, ...exampleRows(categories, accounts)],
      lists: [
        { range: `B2:B${last}`, formula: '"Dépense,Revenu"' },
        { range: `C2:C${last}`, formula: `Listes!$A$2:$A$${Math.max(2, catList.length + 1)}` },
        { range: `D2:D${last}`, formula: `Listes!$D$2:$D$${Math.max(2, accList.length + 1)}` },
      ],
    },
    { name: 'Listes', freezeHeader: true, widths: [26, 24, 24, 24], rows: listRows },
    {
      name: "Mode d'emploi", widths: [110],
      rows: [
        ['Comment remplir ce modèle'],
        ['1. Remplissez une ligne par opération dans la feuille « Opérations » (les 2 lignes « Exemple » sont ignorées à l\'import).'],
        ['2. Date : AAAA-MM-JJ ou JJ/MM/AAAA. Laissez vide pour la date du jour.'],
        ['3. Type : « Dépense » ou « Revenu » (liste déroulante).'],
        ['4. Catégorie et Compte : choisissez dans les listes (elles reprennent vos catégories et comptes).'],
        ['5. Montant : en FCFA, sans signe (ex. 2500).'],
        ['6. Description : facultative.'],
        ['7. Dans Kit Budgétaire : Dépenses & revenus → Fichier → Importer. Vérifiez les lignes puis enregistrez.'],
        [`Maximum ${MAX_ROWS} opérations par fichier. Le fichier peut aussi être enregistré en CSV.`],
      ],
    },
  ];
  return buildXlsx(sheets);
}

function parseDate(raw: string): string | null {
  const v = raw.trim();
  if (!v) return today();
  if (/^\d{4,5}(\.\d+)?$/.test(v)) {
    // Numéro de série Excel (jours depuis le 30/12/1899).
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(v)) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  let m = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) return iso(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  return null;
}

function iso(y: number, mo: number, d: number): string | null {
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

function parseAmount(raw: string): number | null {
  let v = raw.replace(/[\s  ]/g, '').replace(/fcfa|cfa|xof|f$/i, '');
  if (!v) return null;
  // « 2.500,50 » ou « 2,500.50 » : le dernier séparateur est la décimale.
  const lastComma = v.lastIndexOf(','), lastDot = v.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    v = lastComma > lastDot ? v.replace(/\./g, '').replace(',', '.') : v.replace(/,/g, '');
  } else if (lastComma > -1) {
    v = v.replace(',', '.');
  } else if (/^\-?\d{1,3}(\.\d{3})+$/.test(v)) {
    v = v.replace(/\./g, '');
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseType(raw: string): CategoryType | null {
  const v = norm(raw);
  if (!v) return null;
  if (['depense', 'depenses', 'd', 'expense', 'sortie', '-', 'debit'].includes(v)) return 'EXPENSE';
  if (['revenu', 'revenus', 'r', 'income', 'entree', '+', 'credit'].includes(v)) return 'INCOME';
  return null;
}

/** Transforme les lignes d'un tableur en opérations à vérifier dans la saisie multiple. */
export function toTransactions(rows: string[][], categories: Category[], accounts: Account[]): ImportResult {
  const active = accounts.filter(a => !a.archived);
  const cells = rows.map(r => r.map(c => (c ?? '').toString().trim()));
  // Ordre des colonnes : lu depuis l'en-tête s'il existe, sinon ordre du modèle.
  let order = [0, 1, 2, 3, 4, 5];
  let start = 0;
  const header = cells[0]?.map(norm) ?? [];
  if (header.some(h => h === 'date' || h === 'montant')) {
    const keys = ['date', 'type', 'categorie', 'compte', 'montant', 'description'];
    order = keys.map((k, i) => { const idx = header.findIndex(h => h.startsWith(k)); return idx >= 0 ? idx : (i === 5 ? -1 : i); });
    start = 1;
  }

  const lines: ImportedLine[] = [];
  let skipped = 0;
  for (const r of cells.slice(start)) {
    if (!r.some(Boolean)) continue;
    const get = (i: number) => (order[i] >= 0 ? r[order[i]] ?? '' : '');
    const description = get(5);
    if (description.startsWith(EXAMPLE)) { skipped++; continue; }
    if (lines.length >= MAX_ROWS) { skipped++; continue; }

    const problems: string[] = [];
    let amount = parseAmount(get(4));
    let type = parseType(get(1));
    const catName = norm(get(2));
    // Type absent : on le déduit de la catégorie, puis du signe du montant.
    if (!type) type = categories.find(c => norm(c.name) === catName)?.type ?? (amount !== null && amount < 0 ? 'EXPENSE' : null);
    if (!type) { type = 'EXPENSE'; if (get(1)) problems.push(`type « ${get(1)} » inconnu`); }
    if (amount === null || amount === 0) { problems.push('montant manquant'); amount = null; }
    else amount = Math.abs(amount);

    const category = categories.find(c => c.type === type && norm(c.name) === catName);
    if (!category) problems.push(get(2) ? `catégorie « ${get(2)} » introuvable` : 'catégorie à choisir');
    const accName = norm(get(3));
    const account = active.find(a => norm(a.name) === accName);
    if (get(3) && !account) problems.push(`compte « ${get(3)} » introuvable`);
    const date = parseDate(get(0));
    if (!date) problems.push(`date « ${get(0)} » invalide`);

    lines.push({
      line: {
        type, amount: amount as number, date: date ?? today(), description: description.slice(0, 255),
        categoryId: category?.id ?? 0, accountId: account?.id ?? active[0]?.id ?? 0,
      },
      warning: problems.length ? problems.join(', ') : undefined,
    });
  }
  return { lines, skipped };
}

/** Convertit les lignes lues par Claude sur une copie manuscrite, avec les mêmes contrôles qu'un import de fichier. */
export function fromExtraction(extracted: ExtractedLine[], categories: Category[], accounts: Account[]): ImportedLine[] {
  return extracted.flatMap(e => {
    const row = [e.date ?? '', e.type === 'INCOME' ? 'Revenu' : 'Dépense', e.category ?? '', e.account ?? '',
      String(e.amount ?? ''), (e.description || e.rawText || '').replace(new RegExp(`^${EXAMPLE}`, 'i'), '')];
    const imported = toTransactions([COLUMNS, row], categories, accounts).lines[0];
    if (!imported) return [];
    const notes = [imported.warning];
    if (!e.date) notes.push('date non lue, mise à aujourd\'hui');
    if (e.uncertain) notes.push(`lecture incertaine${e.rawText ? ` — écrit : « ${e.rawText} »` : ''}`);
    const warning = notes.filter(Boolean).join(' · ');
    return [{ line: imported.line, warning: warning || undefined }];
  });
}
