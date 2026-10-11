import { ValidationError } from '@bemmoly/shared';

/*
 * CSV as RFC 4180 writes it: comma or semicolon separated (whichever the header uses more),
 * double quotes around fields that hold separators, quotes or line breaks, a doubled quote
 * for a quote. A byte order mark and CRLF line ends are accepted. Blank lines are skipped.
 */

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

export const CSV_MAX_ROWS = 50_000;

function separatorOf(text: string): string {
  const firstLine = text.slice(0, text.search(/\r?\n|$/));
  const count = (char: string) => firstLine.split(char).length - 1;
  return count(';') > count(',') ? ';' : count('\t') > count(',') ? '\t' : ',';
}

export function parseCsv(input: string): ParsedCsv {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const separator = separatorOf(text);
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else field += char;
      continue;
    }
    if (char === '"' && field === '') quoted = true;
    else if (char === separator) {
      record.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      record.push(field);
      if (record.some((value) => value.trim() !== '')) records.push(record);
      record = [];
      field = '';
      if (records.length > CSV_MAX_ROWS + 1) {
        throw new ValidationError(`The file has more than ${CSV_MAX_ROWS} rows`);
      }
    } else field += char;
  }
  if (quoted) throw new ValidationError('The file ends inside a quoted field');
  record.push(field);
  if (record.some((value) => value.trim() !== '')) records.push(record);
  const [headers, ...rows] = records;
  if (!headers?.length || headers.every((header) => !header.trim())) {
    throw new ValidationError('The file has no header row');
  }
  return { headers: headers.map((header) => header.trim()), rows };
}
