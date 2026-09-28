import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Db, DbCatalogCategory, DbCatalogItem, DbClient } from '../../../services/db';

interface QuoteLine { item: DbCatalogItem; quantity: number; cost: number; }

@Component({
  selector: 'app-cotizador',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './cotizador.html',
  styleUrl: './cotizador.scss'
})
export class Cotizador implements OnInit {
  items: DbCatalogItem[] = [];
  categories: DbCatalogCategory[] = [];
  categoryFilter: number | 'all' | 'none' = 'all';
  clients: DbClient[] = [];
  lines: QuoteLine[] = [];
  clientId: number | null = null;
  temporaryName = '';
  search = '';
  kind = '';
  selectedItemId: number | null = null;
  payment = 'Contado';
  delivery = '3 a 5 días';
  warranty = 'Sin garantía';
  validityDays = 3;
  tax: '16' | 'exempt' | 'none' = '16';
  hideTax = false;
  serviceDetails = '';
  margin = 0;
  loadError = '';
  exportFormat: 'pdf' | 'png' = 'pdf';
  exporting = false;
  exportError = '';
  exportMessage = '';

  get canExport(): boolean { return this.lines.length > 0 && this.validAmounts && this.validValidity && !this.loadError; }
  async exportQuotation(): Promise<void> {
    if (this.exporting) return;
    this.exportError = ''; this.exportMessage = '';
    if (!this.canExport) { this.exportError = 'Agrega al menos un concepto y revisa los importes y la validez.'; return; }
    this.exporting = true;
    try {
      const path = await this.db.exportQuotation({
        format: this.exportFormat, clientId: this.clientId, temporaryName: this.temporaryName,
        lines: this.lines.map(line => ({ itemId: line.item.id, quantity: line.quantity, cost: line.cost })),
        payment: this.payment, delivery: this.delivery, warranty: this.warranty, validityDays: this.validityDays,
        tax: this.tax, hideTax: this.hideTax, serviceDetails: this.serviceDetails, margin: this.margin
      });
      this.exportMessage = path ? `Cotización exportada: ${path}` : 'Exportación cancelada.';
    } catch (error) { this.exportError = error instanceof Error ? error.message : 'No se pudo exportar la cotización.'; }
    finally { this.exporting = false; }
  }
  readonly paymentOptions = ['Contado', 'Anticipo de 50%', 'Contra entrega', 'Plazos a 3 meses', 'Plazos a 6 meses'];
  readonly deliveryOptions = ['3 a 5 días', '15 días', '30 días'];
  readonly warrantyOptions = ['Sin garantía', '1 mes', '2 meses'];

  constructor(private readonly db: Db) {}
  ngOnInit(): void {
    try {
      this.items = this.db.listCatalogItems();
      this.categories = this.db.listCatalogCategories();
      this.clients = this.db.listClients().filter(client => client.status === 'Activo');
    } catch (error) { this.loadError = error instanceof Error ? error.message : 'No se pudieron cargar los catálogos.'; }
  }
  private normalize(value: string): string { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-MX'); }
  get filteredItems(): DbCatalogItem[] {
    const query = this.normalize(this.search.trim());
    return this.items.filter(item => (!this.kind || item.kind === this.kind)
      && (this.categoryFilter === 'all' || (this.categoryFilter === 'none' ? item.categoryId === null : item.categoryId === this.categoryFilter))
      && this.normalize(`${item.name} ${item.sku ?? ''} ${item.description}`).includes(query));
  }
  get isGeneralPublic(): boolean {
    return this.clientId === null || this.normalize(this.clients.find(client => client.id === this.clientId)?.name.trim() ?? '') === 'publico en general';
  }
  get clientName(): string {
    return this.isGeneralPublic ? this.temporaryName.trim() || 'Público en General' : this.clients.find(client => client.id === this.clientId)?.name ?? '';
  }
  addItem(): void {
    const item = this.filteredItems.find(item => item.id === this.selectedItemId);
    if (!item) return;
    const existing = this.lines.find(line => line.item.id === item.id);
    if (existing) existing.quantity = this.validQuantity(existing.quantity) ? Math.min(999999, existing.quantity + 1) : 1;
    else this.lines.push({ item, quantity: 1, cost: item.price });
    this.selectedItemId = null;
  }
  removeLine(line: QuoteLine): void { this.lines = this.lines.filter(current => current !== line); }
  validQuantity(value: number): boolean { return Number.isFinite(value) && value > 0 && value <= 999999; }
  validCost(value: number): boolean { return Number.isFinite(value) && value >= 0 && value <= 999999999; }
  get validMargin(): boolean { return Number.isFinite(this.margin) && this.margin >= 0 && this.margin <= 99.99; }
  get validValidity(): boolean { return Number.isInteger(this.validityDays) && this.validityDays >= 1 && this.validityDays <= 365; }
  get validAmounts(): boolean { return this.validMargin && this.lines.every(line => this.validQuantity(line.quantity) && this.validCost(line.cost)); }
  private round(value: number): number { return Math.round((value + Number.EPSILON) * 100) / 100; }
  lineCost(line: QuoteLine): number { return this.validQuantity(line.quantity) && this.validCost(line.cost) ? this.round(line.quantity * line.cost) : 0; }
  linePrice(line: QuoteLine): number { return this.validMargin ? this.round(this.lineCost(line) / (1 - this.margin / 100)) : 0; }
  get baseCost(): number { return this.round(this.lines.reduce((sum, line) => sum + this.lineCost(line), 0)); }
  get subtotal(): number { return this.round(this.lines.reduce((sum, line) => sum + this.linePrice(line), 0)); }
  get profit(): number { return this.round(this.subtotal - this.baseCost); }
  get taxAmount(): number { return this.tax === '16' ? this.round(this.subtotal * 0.16) : 0; }
  get total(): number { return this.round(this.subtotal + this.taxAmount); }
  get advancePayment(): number { return this.round(this.total / 2); }
  get installmentMonths(): number {
    return this.payment === 'Plazos a 3 meses' ? 3 : this.payment === 'Plazos a 6 meses' ? 6 : 0;
  }
  get installments(): { month: number; amount: number }[] {
    const months = this.installmentMonths;
    if (!months || !this.validAmounts) return [];
    const totalCents = Math.round(this.total * 100);
    const monthlyCents = Math.floor(totalCents / months);
    return Array.from({ length: months }, (_, index) => ({
      month: index + 1,
      amount: (index === months - 1 ? totalCents - monthlyCents * (months - 1) : monthlyCents) / 100
    }));
  }
  get expirationDate(): Date | null {
    if (!this.validValidity) return null;
    const date = new Date(); date.setDate(date.getDate() + this.validityDays); return date;
  }

}
