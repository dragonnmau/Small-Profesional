import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Productos } from './productos';
import { Db, DbCatalogItem } from '../../../services/db';
import { NgForm } from '@angular/forms';

describe('Productos', () => {
  let component: Productos;
  let fixture: ComponentFixture<Productos>;
  let db: jasmine.SpyObj<Db>;

  beforeEach(async () => {
    db = jasmine.createSpyObj('Db', ['listCatalogItems', 'listCatalogCategories', 'createCatalogItem', 'createCatalogCategory', 'updateCatalogItem', 'generateCatalogSku', 'listCatalogUnits', 'createCatalogUnit']);
    db.listCatalogUnits.and.returnValue(['pieza', 'mts', 'bobina']);
    db.listCatalogItems.and.returnValue([]);
    db.listCatalogCategories.and.returnValue([]);
    await TestBed.configureTestingModule({
      imports: [Productos], providers: [{ provide: Db, useValue: db }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Productos);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  const product: DbCatalogItem = { id: 1, kind: 'Producto', name: 'Conexión eléctrica', description: '', categoryId: 2, category: 'Materiales', sku: 'ELEC-01', price: 20, quantity: 5, unit: 'mts', products: [] };

  it('agrega una unidad y la selecciona conservando los datos de la edicion', () => {
    component.openEdit(product);
    expect(component.packageForm.unit).toBe('mts');
    component.openUnit(component.packageForm);
    component.unitName = 'caja';
    db.createCatalogUnit.and.returnValue('caja');
    component.saveUnit();
    expect(component.units).toContain('caja');
    expect(component.packageForm.unit).toBe('caja');
    expect(component.packageForm.name).toBe(product.name);
    expect(component.unitOpen).toBeFalse();
    component.openUnit(component.forms[0]); component.saveUnit();
    expect(component.units.filter(unit => unit === 'caja').length).toBe(1);
  });

  it('pagina los resultados filtrados y mantiene la pagina dentro del rango', () => {
    component.items = Array.from({ length: 26 }, (_, index) => ({ ...product, id: index + 1, name: `Producto ${index + 1}` }));
    expect(component.pagedItems.length).toBe(10);
    component.changePage(1);
    expect(component.pagedItems[0].id).toBe(11);
    component.changePage(1);
    expect(component.pagedItems.length).toBe(6);
    component.search = 'Producto 26';
    expect(component.currentPage).toBe(1);
    expect(component.pagedItems.map(item => item.id)).toEqual([26]);
  });

  it('edita una copia y guarda sin crear otro producto', () => {
    component.items = [product];
    component.openEdit(product);
    component.packageForm.quantity = 9;
    expect(product.quantity).toBe(5);
    db.updateCatalogItem.and.returnValue({ ...product, quantity: 9 });
    const form = { invalid: false, resetForm: jasmine.createSpy('resetForm') } as unknown as NgForm;
    component.save(component.packageForm, form);
    expect(db.updateCatalogItem).toHaveBeenCalledWith(1, jasmine.objectContaining({ quantity: 9, sku: 'ELEC-01' }));
    expect(db.createCatalogItem).not.toHaveBeenCalled();
    expect(component.items.length).toBe(1);
    expect(component.items[0].quantity).toBe(9);
    expect(component.packageOpen).toBeFalse();
  });

  it('conserva la edicion si falla y genera el SKU desde el nombre', () => {
    component.openEdit(product);
    db.generateCatalogSku.and.returnValue('CON-0001');
    component.generateSku(component.packageForm);
    expect(db.generateCatalogSku).toHaveBeenCalledWith(product.name);
    expect(component.packageForm.sku).toBe('CON-0001');
    db.updateCatalogItem.and.throwError('SKU duplicado');
    component.save(component.packageForm, { invalid: false } as NgForm);
    expect(component.packageOpen).toBeTrue();
    expect(component.errors['Producto']).toBe('SKU duplicado');
  });

  it('combina busqueda sin acentos, SKU y categoria', () => {
    component.items = [product, { ...product, id: 2, categoryId: null, sku: null }];
    component.search = 'conexion'; component.categoryFilter = 2;
    expect(component.filteredItems.map(item => item.id)).toEqual([1]);
    component.search = 'elec-01';
    expect(component.filteredItems.length).toBe(1);
    component.categoryFilter = 'none';
    expect(component.filteredItems.length).toBe(0);
    component.search = '';
    expect(component.filteredItems.map(item => item.id)).toEqual([2]);
  });

  it('conserva productos seleccionados al buscar y valida cantidades ocultas', () => {
    component.items = [product, { ...product, id: 2, kind: 'Servicio' }];
    component.openPackage(); component.selected[1] = true; component.toggleProduct(1);
    component.productSearch = 'sin coincidencias';
    expect(component.packageProducts.length).toBe(0);
    expect(component.selectedCount).toBe(1);
    expect(component.validQuantities).toBeTrue();
    component.quantities[1] = 1.5;
    expect(component.validQuantities).toBeFalse();
  });

  it('selecciona la categoria nueva sin perder el formulario', () => {
    component.forms[0].name = 'Instalación';
    component.openCategory(component.forms[0]);
    component.categoryName = 'Servicios';
    db.createCatalogCategory.and.returnValue({ id: 3, name: 'Servicios' });
    component.saveCategory();
    expect(component.forms[0].categoryId).toBe(3);
    expect(component.forms[0].name).toBe('Instalación');
    expect(component.categoryOpen).toBeFalse();
  });
});
