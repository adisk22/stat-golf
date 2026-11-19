/**
 * Minimal RFC 4180 CSV parser: quoted fields, escaped quotes (""), commas and
 * newlines inside quotes, CRLF/LF line endings, and a leading UTF-8 BOM.
 * Blank lines are skipped.
 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    if (!(row.length === 1 && row[0]!.trim() === "")) rows.push(row);
    row = [];
  };

  while (i < src.length) {
    const c = src[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
      } else {
        field += c;
      }
      i++;
      continue;
    }
    if (c === '"' && field.trim() === "") {
      field = "";
      inQuotes = true;
    } else if (c === ",") {
      endField();
    } else if (c === "\n" || c === "\r") {
      endRow();
      if (c === "\r" && src[i + 1] === "\n") i++;
    } else {
      field += c;
    }
    i++;
  }
  if (inQuotes) throw new CsvSyntaxError("Unclosed quote at end of file.");
  if (field !== "" || row.length > 0) endRow();
  return rows;
}

export class CsvSyntaxError extends Error {}
