import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Db, DbClient, DbInvoice, DbPayment } from '../../../services/db';

@Component({
  selector: 'app-facturas',
  imports: [CommonModule, FormsModule],
  templateUrl: './facturas.html',
  styleUrl: './facturas.scss'
})
export class Facturas implements OnInit {
  clients: DbClient[] = [];
  payments: DbPayment[] = [];
  invoices: DbInvoice[] = [];
  filterYear = '';
  filterMonth = '';
  filterClientId: number | null = null;
  readonly months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    .map((label, index) => ({ label, value: String(index + 1).padStart(2, '0') }));
  get invoiceYears(): string[] {
    return [...new Set(this.invoices.map(invoice => invoice.invoiceDate.slice(0, 4)))].sort().reverse();
  }
  get invoiceClients(): { id: number; name: string }[] {
    const clients = new Map<number, string>();
    this.invoices.forEach(invoice => { if (!clients.has(invoice.clientId)) clients.set(invoice.clientId, invoice.client); });
    return [...clients].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }
  get filteredInvoices(): DbInvoice[] {
    return this.invoices.filter(invoice =>
      (!this.filterYear || invoice.invoiceDate.slice(0, 4) === this.filterYear) &&
      (!this.filterMonth || invoice.invoiceDate.slice(5, 7) === this.filterMonth) &&
      (this.filterClientId === null || invoice.clientId === this.filterClientId));
  }
  get monthlySummaries() {
    const summaries = new Map<string, { key: string; label: string; count: number; subtotal: number; iva: number; ivaWithheld: number; total: number }>();
    for (const invoice of this.filteredInvoices) {
      const key = invoice.invoiceDate.slice(0, 7);
      const summary = summaries.get(key) || {
        key, label: `${this.months[Number(key.slice(5, 7)) - 1].label} ${key.slice(0, 4)}`,
        count: 0, subtotal: 0, iva: 0, ivaWithheld: 0, total: 0
      };
      summary.count++;
      summary.subtotal += Math.round(invoice.subtotal * 100);
      summary.iva += Math.round(invoice.iva * 100);
      summary.ivaWithheld += Math.round((invoice.ivaWithheld || 0) * 100);
      summary.total += Math.round(invoice.total * 100);
      summaries.set(key, summary);
    }
    return [...summaries.values()].sort((a, b) => b.key.localeCompare(a.key)).map(summary => ({
      ...summary, subtotal: summary.subtotal / 100, iva: summary.iva / 100,
      ivaWithheld: summary.ivaWithheld / 100, total: summary.total / 100
    }));
  }
  clearFilters(): void { this.filterYear = ''; this.filterMonth = ''; this.filterClientId = null; }
  clientId: number | null = null;
  invoiceDate = this.today();
  note = '';
  ivaMode: 'added' | 'included' = 'added';
  ivaRate = 0;
  paymentIds: number[] = [];
  isModalOpen = false;
  detail: DbInvoice | null = null;
  detailNote = '';
  noteError = '';
  noteSuccess = '';
  savingNote = false;
  errorMessage = '';
  successMessage = '';
  saving = false;
  constructor(private readonly db: Db) {}
  ngOnInit(): void { try { this.reload(); } catch (error) { this.showError(error); } }
  private reload(): void {
    this.clients = this.db.listClients(); this.payments = this.db.listPayments();
    this.invoices = this.db.listInvoices(); this.ivaRate = this.db.getTaxSettings().ivaRate;
  }
  get selectedClient(): DbClient | undefined { return this.clients.find(client => client.id === this.clientId); }
  get availablePayments(): DbPayment[] {
    const used = new Set(this.invoices.flatMap(invoice => invoice.payments.map(payment => payment.id)));
    return this.payments.filter(payment => payment.clientId === this.clientId && payment.status === 'Activo' && !used.has(payment.id));
  }
  get amountCents(): number { return this.availablePayments.filter(payment => this.paymentIds.includes(payment.id)).reduce((sum, payment) => sum + Math.round(payment.amount * 100), 0); }
  get subtotalCents(): number { return this.ivaMode === 'included' ? Math.round(this.amountCents / (1 + this.ivaRate / 100)) : this.amountCents; }
  get ivaCents(): number { return this.ivaMode === 'included' ? this.amountCents - this.subtotalCents : Math.round(this.subtotalCents * this.ivaRate / 100); }
  get total(): number { return (this.subtotalCents + this.ivaCents) / 100; }
  openModal(): void {
    this.errorMessage = ''; this.successMessage = '';
    try { this.reload(); } catch (error) { this.showError(error); return; }
    this.clientId = null; this.paymentIds = []; this.invoiceDate = this.today(); this.note = ''; this.ivaMode = 'added'; this.isModalOpen = true;
  }
  onClientChange(): void { this.paymentIds = []; this.errorMessage = ''; }
  openDetail(invoice: DbInvoice): void {
    this.detail = invoice; this.detailNote = invoice.note || '';
    this.noteError = ''; this.noteSuccess = '';
  }
  saveNote(): void {
    if (!this.detail || this.savingNote) return;
    this.savingNote = true; this.noteError = ''; this.noteSuccess = '';
    try {
      const updated = this.db.updateInvoiceNote(this.detail.id, this.detailNote);
      this.detail = updated; this.detailNote = updated.note || '';
      this.invoices = this.invoices.map(invoice => invoice.id === updated.id ? updated : invoice);
      this.noteSuccess = 'Nota guardada correctamente.';
    } catch (error) {
      this.noteError = error instanceof Error ? error.message : 'No se pudo guardar la nota.';
    } finally { this.savingNote = false; }
  }
  togglePayment(id: number): void { this.paymentIds = this.paymentIds.includes(id) ? this.paymentIds.filter(value => value !== id) : [...this.paymentIds, id]; }
  save(): void {
    if (this.saving) return;
    if (!this.clientId || !this.selectedClient?.rfc?.trim() || !this.invoiceDate || !this.paymentIds.length) {
      this.errorMessage = 'Selecciona un cliente con RFC, una fecha y al menos un pago.'; return;
    }
    this.saving = true;
    try {
      const invoice = this.db.createInvoice({ clientId: this.clientId, invoiceDate: this.invoiceDate, ivaMode: this.ivaMode,
        paymentIds: [...this.paymentIds], note: this.note, createdBy: this.db.getAccountInformation()?.user.name || 'Administrador' });
      this.isModalOpen = false; this.openDetail(invoice); this.successMessage = `Factura ${invoice.folio} generada correctamente.`;
      this.reload();
    } catch (error) { this.showError(error); }
    finally { this.saving = false; }
  }
  private showError(error: unknown): void { this.errorMessage = error instanceof Error ? error.message : 'No se pudo cargar o guardar la factura.'; }
  private today(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
}
