import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import { Db, DbInvoice, FiscalMonth } from '../../../services/db';
import { FiscalDocuments } from './fiscal-documents';

@Component({
  selector: 'app-ano-fiscal',
  imports: [CommonModule, FormsModule, A11yModule, FiscalDocuments],
  templateUrl: './ano-fiscal.html',
  styleUrl: './ano-fiscal.scss'
})
export class AnoFiscal implements OnInit {
  readonly monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  selectedYear = new Date().getFullYear();
  invoices: DbInvoice[] = [];
  records: FiscalMonth[] = [];
  detail: FiscalMonth | null = null;
  error = '';
  formError = '';
  success = '';
  saving = false;
  uploadingDocument = false;
  constructor(private readonly db: Db) {}
  ngOnInit(): void { this.load(); }
  load(): void {
    this.error = '';
    try {
      const invoices = this.db.listInvoices();
      const records = this.db.listFiscalMonths();
      this.invoices = invoices; this.records = records;
    } catch (error) { this.error = this.message(error); }
  }
  get years(): number[] {
    const current = new Date().getFullYear();
    return [...new Set([this.selectedYear, ...Array.from({ length: 7 }, (_, index) => current + 1 - index),
      ...this.invoices.map(invoice => Number(invoice.invoiceDate.slice(0, 4))), ...this.records.map(record => record.year)])].sort((a, b) => b - a);
  }
  private invoicesFor(year: number, month: number): DbInvoice[] {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    return this.invoices.filter(invoice => invoice.invoiceDate.slice(0, 7) === key);
  }
  private invoiceTotals(invoices: DbInvoice[]) {
    return invoices.reduce((sum, invoice) => ({ total: sum.total + Math.round(invoice.total * 100),
      subtotal: sum.subtotal + Math.round(invoice.subtotal * 100), iva: sum.iva + Math.round(invoice.iva * 100),
      withheld: sum.withheld + Math.round((invoice.ivaWithheld || 0) * 100)
    }), { total: 0, subtotal: 0, iva: 0, withheld: 0 });
  }
  get months() {
    return this.monthNames.map((label, index) => {
      const month = index + 1;
      const invoices = this.invoicesFor(this.selectedYear, month);
      const record = this.records.find(item => item.year === this.selectedYear && item.month === month);
      return { month, label, count: invoices.length, ...this.invoiceTotals(invoices),
        isr: record?.isr ?? null, deductions: record?.deductions ?? null };
    });
  }
  get annualTotals() {
    return this.months.reduce((sum, month) => ({ total: sum.total + month.total, iva: sum.iva + month.iva,
      isr: sum.isr + Math.round((month.isr ?? 0) * 100), deductions: sum.deductions + Math.round((month.deductions ?? 0) * 100),
      isrMonths: sum.isrMonths + (month.isr === null ? 0 : 1), deductionMonths: sum.deductionMonths + (month.deductions === null ? 0 : 1)
    }), { total: 0, iva: 0, isr: 0, deductions: 0, isrMonths: 0, deductionMonths: 0 });
  }
  get detailInvoices(): DbInvoice[] { return this.detail ? this.invoicesFor(this.detail.year, this.detail.month) : []; }
  get detailTotals() { return this.invoiceTotals(this.detailInvoices); }
  get ivaPaidCents(): number | null {
    const deductions = this.detail?.deductions;
    const surcharge = this.detail?.ivaSurcharge ?? 0;
    if (deductions == null || !this.validAmount(deductions) || !this.validAmount(surcharge)) return null;
    return this.detailTotals.iva - Math.round(deductions * 100) + Math.round(surcharge * 100);
  }
  get isrPaidCents(): number | null {
    const isr = this.detail?.isr;
    const surcharge = this.detail?.isrSurcharge ?? 0;
    if (isr == null || !this.validAmount(isr) || !this.validAmount(surcharge)) return null;
    return Math.round(isr * 100) + Math.round(surcharge * 100);
  }
  get monthlyPaymentCents(): number | null {
    const iva = this.ivaPaidCents;
    const isr = this.isrPaidCents;
    return iva === null || isr === null ? null : iva + isr;
  }
  private validAmount(value: number | null): boolean {
    return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 999999999.99 && Math.abs(value * 100 - Math.round(value * 100)) < 0.0001);
  }
  openMonth(month: number): void {
    const record = this.records.find(item => item.year === this.selectedYear && item.month === month);
    this.detail = record ? { ...record } : { year: this.selectedYear, month, isr: null, deductions: null, note: '' };
    this.detail.ivaSurcharge = record?.ivaSurcharge ?? null;
    this.detail.isrSurcharge = record?.isrSurcharge ?? null;
    this.formError = ''; this.success = '';
  }
  closeDetail(): void { if (!this.saving && !this.uploadingDocument) this.detail = null; }
  saveMonth(): void {
    if (!this.detail || this.saving || this.uploadingDocument) return;
    this.formError = '';
    if (![this.detail.isr, this.detail.deductions, this.detail.ivaSurcharge ?? null, this.detail.isrSurcharge ?? null].every(value => this.validAmount(value))) {
      this.formError = 'Ingresa importes no negativos con máximo dos decimales, o deja el campo vacío si está pendiente.'; return;
    }
    this.saving = true;
    try {
      const saved = this.db.saveFiscalMonth({ ...this.detail });
      this.records = [...this.records.filter(item => item.year !== saved.year || item.month !== saved.month), saved];
      this.success = `Importes de ${this.monthNames[saved.month - 1]} ${saved.year} guardados.`;
      this.detail = null;
    } catch (error) { this.formError = this.message(error); }
    finally { this.saving = false; }
  }
  private message(error: unknown): string { return error instanceof Error ? error.message : 'No se pudo cargar o guardar el año fiscal.'; }

}
