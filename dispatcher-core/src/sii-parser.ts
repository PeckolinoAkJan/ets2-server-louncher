import { SiiSyntaxError, scalar } from './sii-types.js';
import type { SiiDocument, SiiProperty, SiiUnit } from './sii-types.js';

export class SiiParser {
  private source = '';
  private offset = 0;
  private line = 1;
  private column = 1;

  parse(input: string): SiiDocument {
    this.source = input.replace(/^\uFEFF/, '');
    this.offset = 0;
    this.line = 1;
    this.column = 1;
    this.skipTrivia();
    this.expectWord('SiiNunit');
    this.skipTrivia();
    this.expect('{');
    const units: SiiUnit[] = [];
    for (;;) {
      this.skipTrivia();
      if (this.peek() === '}') {
        this.advance();
        break;
      }
      if (this.eof()) this.fail('Abschließende Dokumentklammer fehlt');
      units.push(this.parseUnit());
    }
    this.skipTrivia();
    if (!this.eof()) this.fail('Unerwartete Daten nach dem SII-Dokument');
    return { kind: 'document', units };
  }

  serialize(document: SiiDocument): string {
    const lines: string[] = ['SiiNunit', '{'];
    for (const unit of document.units) {
      lines.push(`${unit.unitType} : ${unit.id} {`);
      for (const property of unit.properties) {
        const suffix = property.index === null ? '' : `[${property.index}]`;
        lines.push(` ${property.key}${suffix}: ${property.value.raw}`);
      }
      lines.push('}');
    }
    lines.push('}', '');
    return lines.join('\n');
  }

  private parseUnit(): SiiUnit {
    const unitType = this.readAtom('Unit-Typ');
    this.skipInlineWhitespace();
    this.expect(':');
    this.skipInlineWhitespace();
    const id = this.readAtom('Unit-ID');
    this.skipTrivia();
    this.expect('{');
    const properties: SiiProperty[] = [];
    for (;;) {
      this.skipTrivia();
      if (this.peek() === '}') {
        this.advance();
        break;
      }
      if (this.eof()) this.fail(`Unit ${id} wurde nicht geschlossen`);
      properties.push(this.parseProperty());
    }
    return { kind: 'unit', unitType, id, properties };
  }

  private parseProperty(): SiiProperty {
    const key = this.readPropertyKey();
    this.skipInlineWhitespace();
    let index: number | null = null;
    if (this.peek() === '[') {
      this.advance();
      const rawIndex = this.readUntil(']').trim();
      if (!/^\d+$/.test(rawIndex)) this.fail(`Ungültiger Array-Index ${rawIndex}`);
      index = Number(rawIndex);
      this.expect(']');
      this.skipInlineWhitespace();
    }
    this.expect(':');
    this.skipInlineWhitespace();
    const raw = this.readScalar();
    if (!raw) this.fail(`Wert für ${key} fehlt`);
    return { kind: 'property', key, index, value: scalar(raw) };
  }

  private readScalar(): string {
    const start = this.offset;
    let quoted = false;
    let escaped = false;
    let roundDepth = 0;
    while (!this.eof()) {
      const char = this.peek();
      if (quoted) {
        this.advance();
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') quoted = false;
        continue;
      }
      if (char === '"') { quoted = true; this.advance(); continue; }
      if (char === '(') { roundDepth++; this.advance(); continue; }
      if (char === ')') { roundDepth--; if (roundDepth < 0) this.fail('Unerwartete schließende Klammer'); this.advance(); continue; }
      if (roundDepth === 0 && (char === '\r' || char === '\n' || char === '}')) break;
      if (roundDepth === 0 && char === '/' && this.peek(1) === '/') break;
      this.advance();
    }
    if (quoted) this.fail('Nicht abgeschlossener String');
    if (roundDepth !== 0) this.fail('Nicht abgeschlossener Tupelwert');
    const raw = this.source.slice(start, this.offset).trimEnd();
    this.skipLineComment();
    return raw.trim();
  }

  private readPropertyKey(): string {
    const start = this.offset;
    while (!this.eof()) {
      const char = this.peek();
      if (/\s/.test(char) || char === ':' || char === '[' || char === '}' || char === '{') break;
      this.advance();
    }
    if (start === this.offset) this.fail('Property-Name erwartet');
    return this.source.slice(start, this.offset);
  }

  private readAtom(label: string): string {
    const start = this.offset;
    while (!this.eof()) {
      const char = this.peek();
      if (/\s/.test(char) || char === ':' || char === '{' || char === '}') break;
      this.advance();
    }
    if (start === this.offset) this.fail(`${label} erwartet`);
    return this.source.slice(start, this.offset);
  }

  private skipTrivia(): void {
    for (;;) {
      while (!this.eof() && /\s/.test(this.peek())) this.advance();
      if (this.peek() === '/' && this.peek(1) === '/') this.skipLineComment();
      else if (this.peek() === '#') this.skipLineComment();
      else break;
    }
  }

  private skipInlineWhitespace(): void {
    while (!this.eof() && (this.peek() === ' ' || this.peek() === '\t')) this.advance();
  }

  private skipLineComment(): void {
    while (!this.eof() && this.peek() !== '\n') this.advance();
  }

  private readUntil(char: string): string {
    const start = this.offset;
    while (!this.eof() && this.peek() !== char) this.advance();
    if (this.eof()) this.fail(`${char} fehlt`);
    return this.source.slice(start, this.offset);
  }

  private expectWord(word: string): void {
    if (this.source.slice(this.offset, this.offset + word.length) !== word) this.fail(`${word} erwartet`);
    for (let index = 0; index < word.length; index++) this.advance();
  }

  private expect(char: string): void {
    if (this.peek() !== char) this.fail(`${char} erwartet`);
    this.advance();
  }

  private peek(ahead = 0): string { return this.source[this.offset + ahead] ?? ''; }
  private eof(): boolean { return this.offset >= this.source.length; }
  private advance(): void {
    const char = this.source[this.offset++];
    if (char === '\n') { this.line++; this.column = 1; }
    else this.column++;
  }
  private fail(message: string): never { throw new SiiSyntaxError(message, this.line, this.column); }
}

export function quoteSiiString(value: string): string {
  if (value.includes('\0') || /[\r\n]/.test(value)) throw new Error('SII-Strings dürfen keine Zeilenumbrüche oder NUL-Zeichen enthalten');
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
