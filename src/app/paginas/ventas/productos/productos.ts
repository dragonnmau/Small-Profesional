import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { Component, HostListener, OnInit } from '@angular/core';
import { FormsModule, NgForm, NgModel } from '@angular/forms';
import { Db, DbCatalogCategory, DbCatalogItem, NewDbCatalogItem } from '../../../services/db';

@Component({
  selector: 'app-productos',
  imports: [CommonModule, FormsModule, A11yModule],
  templateUrl: './productos.html',
  styleUrl: './productos.scss'
})
export class Productos implements OnInit {
  items: DbCatalogItem[] = [];
  categories: DbCatalogCategory[] = [];
  search = '';
  categoryFilter: number | 'all' | 'none' = 'all';
  kindFilter = '';
  page = 1;
  pageSize = 10;
  editingId: number | null = null;
  forms = [this.empty('Servicio'), this.empty('Producto')];
  packageForm = this.empty('Paquete');
  errors: Record<string, string> = {};
  success = '';
  loadError = '';
  packageOpen = false;
  productSearch = '';
  selected: Record<number, boolean> = {};
  quantities: Record<number, number> = {};
  categoryName = '';
  categoryTarget: NewDbCatalogItem | null = null;
  categoryError = '';
  categoryOpen = false;
  editingCategory = false;
  editingCategoryId: number | null = null;
  units: string[] = [];
  unitOpen = false;
  unitName = '';
  unitError = '';
  unitTarget: NewDbCatalogItem | null = null;

  constructor(private readonly db: Db) {}
  ngOnInit(): void {
    try { this.items = this.db.listCatalogItems(); this.categories = this.db.listCatalogCategories(); this.units = this.db.listCatalogUnits(); }
    catch (error) { this.loadError = this.message(error); }
  }
  private normalize(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-MX');
  }
  get filteredItems(): DbCatalogItem[] {
    const query = this.normalize(this.search.trim());
    return this.items.filter(item => (this.categoryFilter === 'all' || (this.categoryFilter === 'none' ? item.categoryId === null : item.categoryId === this.categoryFilter))
      && (!this.kindFilter || item.kind === this.kindFilter)
      && this.normalize(`${item.name} ${item.sku ?? ''} ${item.description}`).includes(query));
  }
  get products(): DbCatalogItem[] { return this.items.filter(item => item.kind === 'Producto'); }
  get totalPages(): number { return Math.max(1, Math.ceil(this.filteredItems.length / this.pageSize)); }
  get currentPage(): number { return Math.min(this.page, this.totalPages); }
  get pagedItems(): DbCatalogItem[] { return this.filteredItems.slice((this.currentPage - 1) * this.pageSize, this.currentPage * this.pageSize); }
  changePage(delta: number): void { this.page = Math.max(1, Math.min(this.totalPages, this.currentPage + delta)); }
  get packageProducts(): DbCatalogItem[] {
    const query = this.normalize(this.productSearch.trim());
    return this.products.filter(item => this.normalize(`${item.name} ${item.sku ?? ''}`).includes(query));
  }
  get selectedCount(): number { return this.products.filter(item => this.selected[item.id]).length; }
  get validQuantities(): boolean {
    return this.products.filter(item => this.selected[item.id]).every(item => Number.isSafeInteger(this.quantities[item.id]) && this.quantities[item.id] > 0 && this.quantities[item.id] <= 999999);
  }
  save(form: NewDbCatalogItem, ngForm: NgForm): void {
    if (ngForm.invalid) return;
    this.errors[form.kind] = ''; this.success = '';
    try {
      const products = form.kind === 'Paquete' ? this.products.filter(item => this.selected[item.id])
        .map(item => ({ productId: item.id, quantity: this.quantities[item.id] })) : [];
      const editing = form === this.packageForm && this.editingId !== null;
      const saved = editing ? this.db.updateCatalogItem(this.editingId!, { ...form, products }) : this.db.createCatalogItem({ ...form, products });
      this.items = editing ? this.items.map(item => item.id === saved.id ? saved : {
        ...item, products: item.products.map(part => part.productId === saved.id ? { ...part, name: saved.name, sku: saved.sku, unit: saved.unit } : part)
      }) : [saved, ...this.items];
      this.success = `${saved.kind} «${saved.name}» ${editing ? 'actualizado' : 'registrado'}.`;
      if (!editing) this.page = 1;
      const empty = this.empty(form.kind);
      Object.assign(form, empty); ngForm.resetForm(empty);
      if (form === this.packageForm) { this.packageOpen = false; this.editingId = null; }
    } catch (error) { this.errors[form.kind] = this.message(error); }
  }
  openPackage(): void {
    this.editingId = null;
    this.packageForm = this.empty('Paquete'); this.selected = {}; this.quantities = {};
    this.productSearch = ''; this.errors['Paquete'] = ''; this.packageOpen = true;
  }
  openEdit(item: DbCatalogItem): void {
    this.editingId = item.id;
    this.packageForm = { kind: item.kind, name: item.name, description: item.description, categoryId: item.categoryId,
      sku: item.sku ?? '', price: item.price, quantity: item.quantity, unit: item.unit, products: item.products.map(part => ({ productId: part.productId, quantity: part.quantity })) };
    this.selected = {}; this.quantities = {};
    for (const part of item.products) { this.selected[part.productId] = true; this.quantities[part.productId] = part.quantity; }
    this.productSearch = ''; this.errors[item.kind] = ''; this.packageOpen = true;
  }
  generateSku(form: NewDbCatalogItem): void {
    this.errors[form.kind] = '';
    try { form.sku = this.db.generateCatalogSku(form.name); }
    catch (error) { this.errors[form.kind] = this.message(error); }
  }
  toggleProduct(id: number): void { if (this.selected[id] && !this.quantities[id]) this.quantities[id] = 1; }
  openCategory(target: NewDbCatalogItem | null = null): void {
    this.editingCategory = false; this.editingCategoryId = null;
    this.categoryTarget = target; this.categoryName = ''; this.categoryError = ''; this.categoryOpen = true;
  }
  selectCategory(target: NewDbCatalogItem, value: number | null | 'new', field: NgModel): void {
    if (value === 'new') {
      field.control.setValue(target.categoryId, { emitViewToModelChange: false });
      this.openCategory(target);
    } else target.categoryId = value;
  }
  selectUnit(target: NewDbCatalogItem, value: string | null, field: NgModel): void {
    if (value === null) {
      field.control.setValue(target.unit, { emitViewToModelChange: false });
      this.openUnit(target);
    } else target.unit = value;
  }
  saveCategory(): void {
    this.categoryError = '';
    try {
      if (this.editingCategory && this.editingCategoryId === null) { this.categoryError = 'Selecciona una categoría.'; return; }
      const category = this.editingCategory ? this.db.updateCatalogCategory(this.editingCategoryId!, this.categoryName) : this.db.createCatalogCategory(this.categoryName);
      if (this.editingCategory) {
        this.categories = this.categories.map(item => item.id === category.id ? category : item).sort((a, b) => a.name.localeCompare(b.name, 'es'));
        this.items = this.items.map(item => item.categoryId === category.id ? { ...item, category: category.name } : item);
        this.success = `Categoría actualizada: ${category.name}.`;
      }
      if (!this.categories.some(item => item.id === category.id)) this.categories = [...this.categories, category].sort((a, b) => a.name.localeCompare(b.name, 'es'));
      if (this.categoryTarget) this.categoryTarget.categoryId = category.id;
      this.categoryOpen = false;
    } catch (error) { this.categoryError = this.message(error); }
  }
  @HostListener('document:keydown.escape') closeDialog(): void {
    if (this.unitOpen) this.unitOpen = false;
    else if (this.categoryOpen) this.categoryOpen = false;
    else this.packageOpen = false;
  }
  openCategoryEditor(): void {
    this.openCategory(); this.editingCategory = true;
  }
  selectCategoryToEdit(): void {
    this.categoryName = this.categories.find(category => category.id === this.editingCategoryId)?.name ?? '';
    this.categoryError = '';
  }
  private empty(kind: NewDbCatalogItem['kind']): NewDbCatalogItem {
    return { kind, name: '', description: '', categoryId: null, sku: '', price: 0, quantity: 0, unit: 'Pieza', products: [] };
  }
  openUnit(target: NewDbCatalogItem): void {
    this.unitTarget = target; this.unitName = ''; this.unitError = ''; this.unitOpen = true;
  }
  saveUnit(): void {
    this.unitError = '';
    try {
      const unit = this.db.createCatalogUnit(this.unitName);
      if (!this.units.includes(unit)) this.units = [...this.units, unit];
      if (this.unitTarget) this.unitTarget.unit = unit;
      this.unitOpen = false;
    } catch (error) { this.unitError = this.message(error); }
  }
  private message(error: unknown): string { return error instanceof Error ? error.message : 'No se pudo guardar. Intenta nuevamente.'; }
}
