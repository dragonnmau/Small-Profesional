import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Cotizador } from './cotizador';
import { provideRouter } from '@angular/router';
import { Db, DbCatalogItem } from '../../../services/db';

describe('Cotizador', () => {
  let component: Cotizador;
  let fixture: ComponentFixture<Cotizador>;
  let exportSpy: jasmine.Spy;
  const items: DbCatalogItem[] = ['Producto', 'Servicio', 'Paquete'].map((kind, index) => ({
    id: index + 1, kind: kind as DbCatalogItem['kind'], name: `Concepto ${index}`, description: '',
    categoryId: null, category: null, sku: null, price: 100, quantity: 0, unit: 'Pieza', products: []
  }));

  beforeEach(async () => {
    exportSpy = jasmine.createSpy('exportQuotation').and.resolveTo('cotizacion.pdf');
    await TestBed.configureTestingModule({
      imports: [Cotizador],
      providers: [provideRouter([]), { provide: Db, useValue: { listCatalogItems: () => items, listCatalogCategories: () => [], listClients: () => [], exportQuotation: exportSpy } }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Cotizador);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows expandable monthly amounts for 3 and 6 months and reconciles cents', () => {
    component.selectedItemId = 1; component.addItem();
    component.tax = 'none'; component.payment = 'Plazos a 3 meses';
    fixture.detectChanges();
    const details = fixture.nativeElement.querySelector('.installment-plan');
    expect(details.open).toBeFalse();
    expect(details.querySelector('summary').textContent).toContain('Mensualidad de $33.33');
    details.querySelector('summary').click();
    expect(details.open).toBeTrue();
    expect(component.installments.map(item => item.amount)).toEqual([33.33, 33.33, 33.34]);
    component.payment = 'Plazos a 6 meses'; component.hideTax = true; component.tax = '16';
    fixture.detectChanges();
    expect(details.querySelectorAll('dl > div').length).toBe(6);
    expect(component.installments.reduce((sum, item) => sum + Math.round(item.amount * 100), 0)).toBe(11600);
    component.lines[0].cost = .01; component.tax = 'none';
    expect(component.installments.every(item => item.amount >= 0)).toBeTrue();
    expect(component.installments[5].amount).toBe(.01);
    component.payment = 'Contado'; fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.installment-plan')).toBeNull();
    component.payment = 'Plazos a 3 meses'; component.lines[0].cost = -1; fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.installment-plan')).toBeNull();
  });

  it('shows the advance below the total only for the 50% payment option', () => {
    component.selectedItemId = 1; component.addItem();
    component.payment = 'Anticipo de 50%'; component.hideTax = true;
    fixture.detectChanges();
    const advance = fixture.nativeElement.querySelector('.advance-payment');
    expect(advance.textContent).toContain('$58.00');
    expect(advance.previousElementSibling.classList.contains('grand-total')).toBeTrue();
    component.lines[0].cost = 100.01; component.tax = 'none';
    expect(component.advancePayment).toBe(50.01);
    component.payment = 'Contado'; fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.advance-payment')).toBeNull();
  });

  it('exports the selected format and current quote with its hidden-tax setting', async () => {
    component.selectedItemId = 1; component.addItem();
    component.exportFormat = 'png'; component.hideTax = true;
    await component.exportQuotation();
    expect(exportSpy).toHaveBeenCalledWith(jasmine.objectContaining({ format: 'png', hideTax: true, lines: [{ itemId: 1, quantity: 1, cost: 100 }] }));
    expect(component.exporting).toBeFalse();
    expect(component.exportMessage).toContain('cotizacion.pdf');
  });

  it('blocks empty exports and reports failures and cancellation', async () => {
    await component.exportQuotation(); expect(exportSpy).not.toHaveBeenCalled();
    component.selectedItemId = 1; component.addItem();
    exportSpy.and.rejectWith(new Error('No se pudo guardar'));
    await component.exportQuotation();
    expect(component.exportError).toBe('No se pudo guardar'); expect(component.exporting).toBeFalse();
    exportSpy.and.resolveTo(null); await component.exportQuotation();
    expect(component.exportMessage).toBe('Exportación cancelada.'); expect(component.exportError).toBe('');
  });

  it('adds all catalog types, edits quote costs independently and removes concepts', () => {
    for (const item of items) { component.selectedItemId = item.id; component.addItem(); }
    expect(component.lines.length).toBe(3);
    component.lines[0].cost = 80;
    component.lines[0].quantity = 2;
    component.margin = 20;
    expect(component.baseCost).toBe(360);
    expect(component.subtotal).toBe(450);
    expect(component.profit).toBe(90);
    expect(component.taxAmount).toBe(72);
    expect(component.total).toBe(522);
    expect(items[0].price).toBe(100);
    component.removeLine(component.lines[0]);
    expect(component.lines.length).toBe(2);
  });

  it('hides the tax breakdown without changing the total and supports both untaxed modes', () => {
    component.selectedItemId = 1; component.addItem();
    expect(component.total).toBe(116);
    component.hideTax = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.totals').textContent).not.toContain('IVA');
    expect(component.total).toBe(116);
    component.tax = 'exempt'; expect(component.total).toBe(100);
    component.tax = 'none'; expect(component.total).toBe(100);
  });

  it('rejects invalid numbers and validity periods', () => {
    component.selectedItemId = 1; component.addItem();
    component.margin = 100; expect(component.validAmounts).toBeFalse();
    component.margin = 0; component.lines[0].quantity = 0; expect(component.validAmounts).toBeFalse();
    component.lines[0].quantity = 1; component.lines[0].cost = -1; expect(component.validAmounts).toBeFalse();
    component.lines[0].cost = NaN; expect(component.validAmounts).toBeFalse();
    component.validityDays = 1.5; expect(component.expirationDate).toBeNull();
    component.validityDays = 15; expect(component.expirationDate).not.toBeNull();
  });

  it('uses the optional temporary name only for the general public', () => {
    component.temporaryName = ' Ana ';
    expect(component.clientName).toBe('Ana');
    component.clients = [{ id: 7, name: 'Cliente registrado' } as any];
    component.clientId = 7;
    expect(component.isGeneralPublic).toBeFalse();
    expect(component.clientName).toBe('Cliente registrado');
    component.clientId = null; component.temporaryName = ' ';
    expect(component.clientName.toLocaleLowerCase('es-MX')).toBe('público en general');
  });
});
