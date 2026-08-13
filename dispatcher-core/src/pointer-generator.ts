import { randomBytes } from 'node:crypto';
import type { SiiDocument } from './sii-types.ts';

export type RandomBytes = (size: number) => Uint8Array;

export class PointerGenerator {
  private readonly occupied: Set<string>;
  private readonly randomBytes: RandomBytes;

  constructor(existingIds: Iterable<string>, random: RandomBytes = randomBytes) {
    this.occupied = new Set([...existingIds].map((id) => id.toLowerCase()));
    this.randomBytes = random;
  }

  static fromDocument(document: SiiDocument, random?: RandomBytes): PointerGenerator {
    return new PointerGenerator(document.units.map((unit) => unit.id), random);
  }

  next(): string {
    for (let attempt = 0; attempt < 1024; attempt++) {
      const bytes = this.randomBytes(6);
      if (bytes.length !== 6) throw new Error('Pointer-Zufallsquelle muss genau sechs Bytes liefern');
      const hex = Buffer.from(bytes).toString('hex');
      const pointer = `_nameless.${hex.slice(0, 4)}.${hex.slice(4, 8)}.${hex.slice(8, 12)}`;
      if (this.occupied.has(pointer)) continue;
      this.occupied.add(pointer);
      return pointer;
    }
    throw new Error('Nach 1024 Versuchen konnte keine eindeutige _nameless-ID erzeugt werden');
  }
}

