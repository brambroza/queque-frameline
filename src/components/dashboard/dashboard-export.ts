import { guardFormula, safeSheetName, sheetToCsv, type ExportSheet } from '@/lib/dashboard/export';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Hand a blob to the browser as a file download. */
function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after the click has been handled, otherwise Safari cancels the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Download one sheet as a UTF-8 CSV file. */
export function downloadCsv(sheet: ExportSheet, filename: string): void {
  saveBlob(new Blob([sheetToCsv(sheet)], { type: 'text/csv;charset=utf-8' }), filename);
}

/**
 * Build one `.xlsx` workbook from the sheets. `exceljs` is loaded on demand
 * so it stays out of the dashboard bundle until someone exports.
 */
export async function buildXlsx(sheets: ExportSheet[]): Promise<ArrayBuffer> {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  workbook.created = new Date();

  const used = new Set<string>();
  for (const sheet of sheets) {
    let name = safeSheetName(sheet.name);
    for (let n = 2; used.has(name.toLowerCase()); n += 1) name = safeSheetName(`${sheet.name.slice(0, 28)} ${n}`);
    used.add(name.toLowerCase());

    const ws = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.addRow(sheet.header);
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F3EC' } };
    for (const row of sheet.rows) ws.addRow(row.map((cell) => (typeof cell === 'string' ? guardFormula(cell) : cell)));

    sheet.header.forEach((head, i) => {
      const longest = sheet.rows.reduce((max, row) => Math.max(max, String(row[i] ?? '').length), head.length);
      ws.getColumn(i + 1).width = Math.min(40, Math.max(10, longest + 2));
    });
  }

  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

/** Download every sheet as one `.xlsx` workbook. */
export async function downloadXlsx(sheets: ExportSheet[], filename: string): Promise<void> {
  saveBlob(new Blob([await buildXlsx(sheets)], { type: XLSX_MIME }), filename);
}

/**
 * Download several files as one `.zip`. Browsers block a burst of separate
 * downloads, so "one file per branch" ships as a single archive.
 */
export async function downloadZip(files: Array<{ name: string; data: ArrayBuffer | string }>, filename: string): Promise<void> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const used = new Set<string>();
  for (const file of files) {
    let name = file.name;
    for (let n = 2; used.has(name.toLowerCase()); n += 1) name = file.name.replace(/(\.[^.]+)?$/, ` (${n})$1`);
    used.add(name.toLowerCase());
    zip.file(name, file.data);
  }
  saveBlob(await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }), filename);
}
