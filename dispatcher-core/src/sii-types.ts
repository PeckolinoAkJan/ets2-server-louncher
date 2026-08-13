export type SiiValue = {
  kind: 'scalar';
  raw: string;
};

export type SiiProperty = {
  kind: 'property';
  key: string;
  index: number | null;
  value: SiiValue;
};

export type SiiUnit = {
  kind: 'unit';
  unitType: string;
  id: string;
  properties: SiiProperty[];
};

export type SiiDocument = {
  kind: 'document';
  units: SiiUnit[];
};

export class SiiSyntaxError extends Error {
  readonly line: number;
  readonly column: number;

  constructor(message: string, line: number, column: number) {
    super(`${message} (Zeile ${line}, Spalte ${column})`);
    this.name = 'SiiSyntaxError';
    this.line = line;
    this.column = column;
  }
}

export function scalar(raw: string): SiiValue {
  return { kind: 'scalar', raw };
}

export function cloneUnit(unit: SiiUnit): SiiUnit {
  return {
    kind: 'unit',
    unitType: unit.unitType,
    id: unit.id,
    properties: unit.properties.map((property) => ({
      kind: 'property',
      key: property.key,
      index: property.index,
      value: scalar(property.value.raw),
    })),
  };
}

