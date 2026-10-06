/** Finale CSV cells retain quoted descriptions, embedded commas and escaped quotes. */
const MAX_INPUT_LENGTH_CHARACTERS = 1_000_000; // Import text budget, characters; bounds browser parsing work.
/** Encodes CSV records without changing Finale's literal field values. */
export function writeCsv(rows: readonly (readonly (string | number)[])[]): string {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const cell = String(value);
          return /[",\r\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
        })
        .join(','),
    )
    .join('\n');
}
/** Reads bounded RFC-style CSV, including CRLF and quoted multiline fields; rejects broken quotes. */
export function readCsv(text: string): string[][] {
  if (text.length > MAX_INPUT_LENGTH_CHARACTERS) throw new Error('The CSV is too large.');
  const reader = new CsvReader();
  for (let index = 0; index < text.length; index++) {
    const skip = reader.consume(text[index], text[index + 1]);
    if (skip) index++;
  }
  return reader.finish();
}
class CsvReader {
  private rows: string[][] = [];
  private row: string[] = [];
  private cell = '';
  private quoted = false;
  private closed = false;
  consume(char: string, next: string | undefined): boolean {
    if (this.quoted) return this.quotedCharacter(char, next);
    if (char === ',' || char === '\n' || char === '\r') {
      this.row.push(this.cell);
      this.cell = '';
      this.closed = false;
      if (char !== ',') {
        this.rows.push(this.row);
        this.row = [];
      }
      return char === '\r' && next === '\n';
    }
    if (char === '"' && this.cell === '' && !this.closed) this.quoted = true;
    else this.plainCharacter(char);
    return false;
  }
  private plainCharacter(char: string) {
    if (this.closed || char === '"') throw new Error('Invalid CSV quoting.');
    this.cell += char;
  }
  private quotedCharacter(char: string, next: string | undefined): boolean {
    if (char !== '"') this.cell += char;
    else if (next === '"') {
      this.cell += '"';
      return true;
    } else {
      this.quoted = false;
      this.closed = true;
    }
    return false;
  }
  finish(): string[][] {
    if (this.quoted) throw new Error('Unclosed CSV quote.');
    if (this.cell !== '' || this.row.length > 0) this.rows.push([...this.row, this.cell]);
    return this.rows.filter((record) => record.some((value) => value !== ''));
  }
}
