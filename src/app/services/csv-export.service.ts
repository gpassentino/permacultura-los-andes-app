import { Injectable } from '@angular/core';

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

@Injectable({ providedIn: 'root' })
export class CsvExportService {

  exportToCsv<T>(filename: string, columns: CsvColumn<T>[], rows: T[]): void {
    const headerLine = columns.map(c => this.escapeCell(c.header)).join(',');
    const bodyLines = rows.map(row =>
      columns.map(c => this.escapeCell(this.formatValue(c.value(row)))).join(',')
    );
    const csv = '﻿' + [headerLine, ...bodyLines].join('\r\n');
    this.download(filename, csv);
  }

  formatValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return this.formatDate(value);
    if (Array.isArray(value)) return value.map(v => this.formatValue(v)).join(';');
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    return String(value);
  }

  formatDate(date: Date): string {
    if (isNaN(date.getTime())) return '';
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  }

  private escapeCell(cell: string): string {
    if (/[",\r\n]/.test(cell)) {
      return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
  }

  private download(filename: string, csv: string): void {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
