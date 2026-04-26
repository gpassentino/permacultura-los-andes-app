import { TestBed } from '@angular/core/testing';
import { CsvExportService, CsvColumn } from './csv-export.service';

describe('CsvExportService', () => {
  let service: CsvExportService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CsvExportService);
  });

  describe('formatValue', () => {
    it('returns empty string for null and undefined', () => {
      expect(service.formatValue(null)).toBe('');
      expect(service.formatValue(undefined)).toBe('');
    });

    it('formats booleans as Sí / No', () => {
      expect(service.formatValue(true)).toBe('Sí');
      expect(service.formatValue(false)).toBe('No');
    });

    it('joins arrays with semicolons', () => {
      expect(service.formatValue(['paisajismo', 'academia'])).toBe('paisajismo;academia');
    });

    it('returns empty for empty array', () => {
      expect(service.formatValue([])).toBe('');
    });

    it('formats dates in dd/MM/yyyy HH:mm', () => {
      const d = new Date(2026, 3, 26, 9, 5); // 26 Apr 2026 09:05 local
      expect(service.formatValue(d)).toBe('26/04/2026 09:05');
    });

    it('returns empty string for invalid Date', () => {
      expect(service.formatValue(new Date('not-a-date'))).toBe('');
    });
  });

  describe('exportToCsv', () => {
    let createdBlob: Blob | null;
    let downloadedName: string | null;
    let originalCreate: typeof URL.createObjectURL;
    let originalRevoke: typeof URL.revokeObjectURL;

    beforeEach(() => {
      createdBlob = null;
      downloadedName = null;
      originalCreate = URL.createObjectURL;
      originalRevoke = URL.revokeObjectURL;
      URL.createObjectURL = (blob: Blob) => {
        createdBlob = blob;
        return 'blob:mock';
      };
      URL.revokeObjectURL = () => {};

      // Capture the filename when an anchor is clicked
      const origCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = origCreateElement(tag) as HTMLElement;
        if (tag === 'a') {
          (el as HTMLAnchorElement).click = () => {
            downloadedName = (el as HTMLAnchorElement).download;
          };
        }
        return el;
      });
    });

    afterEach(() => {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
      vi.restoreAllMocks();
    });

    async function readBlob(blob: Blob): Promise<string> {
      return await blob.text();
    }

    async function readBlobRaw(blob: Blob): Promise<Uint8Array> {
      return new Uint8Array(await blob.arrayBuffer());
    }

    it('writes UTF-8 BOM (EF BB BF) as first three bytes', async () => {
      const cols: CsvColumn<{ a: string }>[] = [{ header: 'A', value: r => r.a }];
      service.exportToCsv('test.csv', cols, [{ a: 'x' }]);
      const bytes = await readBlobRaw(createdBlob!);
      expect(bytes[0]).toBe(0xEF);
      expect(bytes[1]).toBe(0xBB);
      expect(bytes[2]).toBe(0xBF);
    });

    it('uses provided filename', () => {
      const cols: CsvColumn<{ a: string }>[] = [{ header: 'A', value: r => r.a }];
      service.exportToCsv('contactos_2026-04-26.csv', cols, []);
      expect(downloadedName).toBe('contactos_2026-04-26.csv');
    });

    it('escapes cells containing commas, quotes, and embedded newlines', async () => {
      const cols: CsvColumn<{ notas: string }>[] = [
        { header: 'Notas', value: r => r.notas },
      ];
      service.exportToCsv('x.csv', cols, [
        { notas: 'simple' },
        { notas: 'has, comma' },
        { notas: 'has "quote"' },
        { notas: 'has\nnewline' },
      ]);
      const text = await readBlob(createdBlob!);
      // Rows are separated by \r\n; an embedded \n inside a quoted cell stays put.
      const rows = text.split('\r\n');
      expect(rows[0]).toBe('Notas');
      expect(rows[1]).toBe('simple');
      expect(rows[2]).toBe('"has, comma"');
      expect(rows[3]).toBe('"has ""quote"""');
      expect(rows[4]).toBe('"has\nnewline"');
    });

    it('renders header row first, then body rows in order', async () => {
      type Row = { name: string; phone: string };
      const cols: CsvColumn<Row>[] = [
        { header: 'Nombre',   value: r => r.name },
        { header: 'Teléfono', value: r => r.phone },
      ];
      service.exportToCsv('x.csv', cols, [
        { name: 'Ana',  phone: '300' },
        { name: 'Beto', phone: '301' },
      ]);
      const text = await readBlob(createdBlob!);
      const lines = text.replace(/^﻿/, '').split('\r\n');
      expect(lines).toEqual(['Nombre,Teléfono', 'Ana,300', 'Beto,301']);
    });

    it('handles array, date, boolean, and null values via formatValue', async () => {
      type Row = {
        types: string[];
        when: Date | null;
        paid: boolean;
        nada: null;
      };
      const cols: CsvColumn<Row>[] = [
        { header: 'Tipos',  value: r => r.types },
        { header: 'Fecha',  value: r => r.when },
        { header: 'Pagó',   value: r => r.paid },
        { header: 'Nada',   value: r => r.nada },
      ];
      service.exportToCsv('x.csv', cols, [
        { types: ['paisajismo', 'academia'], when: new Date(2026, 3, 26, 9, 5), paid: true,  nada: null },
        { types: [],                          when: null,                       paid: false, nada: null },
      ]);
      const text = await readBlob(createdBlob!);
      const lines = text.replace(/^﻿/, '').split('\r\n');
      expect(lines[1]).toBe('paisajismo;academia,26/04/2026 09:05,Sí,');
      expect(lines[2]).toBe(',,No,');
    });

    it('preserves Spanish accented characters', async () => {
      const cols: CsvColumn<{ city: string }>[] = [{ header: 'Ciudad', value: r => r.city }];
      service.exportToCsv('x.csv', cols, [{ city: 'Medellín' }]);
      const text = await readBlob(createdBlob!);
      expect(text).toContain('Medellín');
    });
  });
});
