import { aFirestore, deFirestore } from './firestore-fechas';

class FakeTs {
  constructor(public d: Date) {}
  toDate() { return this.d; }
}

describe('firestore-fechas', () => {
  const d = new Date(2026, 10, 17);

  it('convierte Date anidadas a Timestamp y quita undefined', () => {
    const out = aFirestore(
      { a: d, b: undefined, c: [{ desde: d, hasta: undefined }], e: { fecha: d, n: 1 }, f: null },
      x => new FakeTs(x),
    ) as any;
    expect(out.a).toBeInstanceOf(FakeTs);
    expect('b' in out).toBe(false);
    expect(out.c[0].desde).toBeInstanceOf(FakeTs);
    expect('hasta' in out.c[0]).toBe(false);
    expect(out.e).toEqual({ fecha: new FakeTs(d), n: 1 });
    expect(out.f).toBeNull();
  });

  it('deja pasar objetos que no son planos (p. ej. FieldValue)', () => {
    const fv = new (class FieldValue {})();
    expect((aFirestore({ x: fv }, x => x) as any).x).toBe(fv);
  });

  it('convierte Timestamp anidados a Date', () => {
    const out = deFirestore<any>({ a: new FakeTs(d), h: [{ desde: new FakeTs(d) }], s: 'x' });
    expect(out).toEqual({ a: d, h: [{ desde: d }], s: 'x' });
  });
});
