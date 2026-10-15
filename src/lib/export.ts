export type CsvCell = string | number | null;
export function escapeCsvCell(value: CsvCell): string {
  if (value === null) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  let text = value;
  // Protect text fields, retaining numeric negative values as actual numbers.
  if (/^[\s\u0000-\u001f]*[=+@-]/u.test(text) || /^[\t\r\n]/u.test(text)) text = "'" + text;
  return /[",\r\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
}
export function csvText(headers: string[], rows: readonly (readonly CsvCell[])[]): string {
  return (
    '\uFEFF' +
    [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\r\n') +
    '\r\n'
  );
}
export function downloadText(
  filename: string,
  text: string,
  type = 'text/plain;charset=utf-8',
): void {
  downloadBlob(filename, new Blob([text], { type }));
}
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/[\\/:*?"<>|]/g, '-');
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: readonly (readonly CsvCell[])[],
): void {
  downloadText(filename, csvText(headers, rows), 'text/csv;charset=utf-8');
}
