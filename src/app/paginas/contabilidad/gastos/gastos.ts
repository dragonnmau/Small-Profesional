import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import { RouterLink } from '@angular/router';
import { Db, DbBankAccount, DbExpense, NewDbExpense } from '../../../services/db';
import expenseCatalogs from '../../../services/expense-catalogs.json';
import { bankOptions } from '../../../services/bank-options';

@Component({
  selector: 'app-gastos',
  imports: [CommonModule, FormsModule, A11yModule, RouterLink],
  templateUrl: './gastos.html',
  styleUrl: './gastos.scss'
})
export class Gastos implements OnInit {
  accounts: DbBankAccount[] = [];
  expenses: DbExpense[] = [];
  categories: string[] = [];
  readonly cfdiUses = expenseCatalogs.cfdiUses;
  readonly billingMonths = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    .map((label, index) => ({ value: String(index + 1).padStart(2, '0'), label }));
  addingCategory = false;
  newCategory = '';
  categoryError = '';
  form = this.emptyForm();
  ivaRate = 0;
  isModalOpen = false;
  saving = false;
  readingFiles = 0;
  error = '';
  fileError = '';
  success = '';
  search = '';
  filterMonth = '';
  filterAccount: number | null = null;
  constructor(private readonly db: Db) {}
  ngOnInit(): void { this.load(); }
  get accountOptions() { return bankOptions(this.accounts); }
  get accountSelection(): string { return this.form.cardId ? `card:${this.form.cardId}` : this.form.accountId ? `account:${this.form.accountId}` : ''; }
  set accountSelection(key: string) {
    const option = this.accountOptions.find(item => item.key === key);
    this.form.accountId = option?.accountId ?? 0; this.form.cardId = option?.cardId ?? null;
  }
  get filteredExpenses(): DbExpense[] {
    const search = this.search.trim().toLocaleLowerCase();
    return this.expenses.filter(item => (!this.filterAccount || item.accountId === this.filterAccount)
      && (!this.filterMonth || item.expenseDate.startsWith(this.filterMonth))
      && (!search || `${item.concept} ${item.category} ${item.accountName}`.toLocaleLowerCase().includes(search)));
  }
  get filterAccounts(): Array<{ id: number; name: string }> {
    return [...new Map([...this.accounts.map(item => ({ id: item.id, name: item.name })),
      ...this.expenses.map(item => ({ id: item.accountId, name: item.accountName }))].map(item => [item.id, item])).values()];
  }
  get summary() {
    return this.filteredExpenses.reduce((sum, item) => ({ total: sum.total + item.total, iva: sum.iva + item.iva,
      invoices: sum.invoices + (item.hasInvoice ? 1 : 0) }), { total: 0, iva: 0, invoices: 0 });
  }
  get monthlyExpenses() {
    const groups = new Map<string, { key: string; label: string; count: number; totalCents: number; ivaCents: number }>();
    for (const expense of this.filteredExpenses) {
      const year = expense.expenseDate.slice(0, 4);
      const month = this.billingMonths.find(item => item.value === expense.billingMonth);
      const key = `${year}-${month?.value || '00'}`;
      const group = groups.get(key) || { key, label: `${month?.label || 'Sin mes de facturación'} ${year}`, count: 0, totalCents: 0, ivaCents: 0 };
      group.count++;
      group.totalCents += Math.round(expense.total * 100);
      group.ivaCents += Math.round(expense.iva * 100);
      groups.set(key, group);
    }
    return [...groups.values()].sort((first, second) => second.key.localeCompare(first.key))
      .map(group => ({ ...group, total: group.totalCents / 100, iva: group.ivaCents / 100 }));
  }
  get totals() {
    const cents = Math.round(Number(this.form.amount || 0) * 100);
    const rate = this.form.ivaMode === 'none' ? 0 : this.ivaRate;
    const subtotal = this.form.ivaMode === 'included' ? Math.round(cents / (1 + rate / 100)) : cents;
    const iva = this.form.ivaMode === 'included' ? cents - subtotal : Math.round(subtotal * rate / 100);
    return { subtotal: subtotal / 100, iva: iva / 100, total: (subtotal + iva) / 100 };
  }
  openModal(): void {
    this.error = ''; this.fileError = ''; this.success = ''; this.load();
    this.form = this.emptyForm(); this.isModalOpen = true;
    this.addingCategory = false; this.newCategory = ''; this.categoryError = '';
  }
  closeModal(): void { if (!this.saving && !this.readingFiles) this.isModalOpen = false; }
  invoiceChanged(): void { if (!this.form.hasInvoice) { this.form.invoice = null; this.form.cfdiUse = ''; } }
  categoryChanged(): void {
    this.categoryError = '';
    this.addingCategory = this.form.category === '__new__';
    if (this.addingCategory) { this.form.category = ''; this.newCategory = ''; }
  }
  addCategory(): void {
    this.categoryError = '';
    if (!this.newCategory.trim() || this.newCategory.trim().length > 80) {
      this.categoryError = 'Escribe una categoría de hasta 80 caracteres.'; return;
    }
    try {
      const category = this.db.createExpenseCategory(this.newCategory);
      this.categories = this.db.listExpenseCategories();
      this.form.category = category; this.addingCategory = false; this.newCategory = '';
    } catch (error) { this.categoryError = this.message(error); }
  }
  cfdiLabel(code: string): string {
    const use = this.cfdiUses.find(item => item.code === code);
    return use ? `${use.code} · ${use.label}` : 'Uso no registrado';
  }
  billingMonthLabel(value: string): string {
    return this.billingMonths.find(month => month.value === value)?.label || 'Sin registrar';
  }
  async selectFile(event: Event, kind: 'ticket' | 'invoice'): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.fileError = '';
    const allowed = kind === 'ticket' ? /\.(jpe?g|png|webp)$/i : /\.(pdf|xml|jpe?g|png|webp)$/i;
    if (!allowed.test(file.name) || !file.size || file.size > 5 * 1024 * 1024) {
      this.fileError = 'Selecciona un archivo del formato indicado, no vacío y de máximo 5 MB.'; input.value = ''; return;
    }
    this.readingFiles++;
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
        reader.onabort = () => reject(new Error('La lectura del archivo se canceló.'));
        reader.readAsDataURL(file);
      });
      if (kind === 'ticket' || this.form.hasInvoice) this.form[kind] = { name: file.name, type: file.type, data };
    } catch (error) { this.fileError = this.message(error); }
    finally { this.readingFiles--; input.value = ''; }
  }
  save(): void {
    if (this.saving || this.readingFiles) return;
    this.error = '';
    if (!this.form.accountId || !this.form.expenseDate || !this.form.concept.trim() || !Number.isFinite(this.form.amount) || this.form.amount <= 0) {
      this.error = 'Completa la cuenta, fecha, concepto e importe positivo.'; return;
    }
    if (this.addingCategory || !this.categories.includes(this.form.category)) { this.error = 'Selecciona una categoría o termina de agregarla.'; return; }
    if (this.form.hasInvoice && !this.cfdiUses.some(use => use.code === this.form.cfdiUse)) { this.error = 'Selecciona el uso de CFDI.'; return; }
    if (!this.billingMonths.some(month => month.value === this.form.billingMonth)) { this.error = 'Selecciona el mes de facturación.'; return; }
    this.saving = true;
    try {
      const expense = this.db.createExpense({ ...this.form, createdBy: this.db.getAccountInformation()?.user.name || 'Administrador' });
      this.isModalOpen = false;
      this.success = `Gasto #${expense.id} registrado. Se actualizó el saldo de ${expense.accountName}.`;
      this.load();
    } catch (error) { this.error = this.message(error); }
    finally { this.saving = false; }
  }
  download(expense: DbExpense, kind: 'ticket' | 'invoice'): void {
    this.error = '';
    try {
      const file = this.db.getExpenseAttachment(expense.id, kind);
      const bytes = Uint8Array.from(atob(file.data), char => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: file.type }));
      const link = document.createElement('a'); link.href = url; link.download = file.name;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { this.error = this.message(error); }
  }
  private load(): void {
    try { this.accounts = this.db.listBankAccounts(); this.expenses = this.db.listExpenses(); this.categories = this.db.listExpenseCategories(); this.ivaRate = this.db.getTaxSettings().ivaRate; }
    catch (error) { this.error = this.message(error); }
  }
  private emptyForm(): NewDbExpense {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return { accountId: 0, expenseDate: date, billingMonth: String(now.getMonth() + 1).padStart(2, '0'), concept: '', category: '', cfdiUse: '', amount: 0, ivaMode: 'none', hasInvoice: false, ticket: null, invoice: null, createdBy: '' };
  }
  private message(error: unknown): string { return error instanceof Error ? error.message : 'No se pudo completar la operación.'; }

}
