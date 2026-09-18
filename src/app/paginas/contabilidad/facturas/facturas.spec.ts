import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Facturas } from './facturas';
import { Db, DbInvoice } from '../../../services/db';

describe('Facturas', () => {
  let component: Facturas;
  let fixture: ComponentFixture<Facturas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Facturas]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Facturas);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('Resumen mensual y filtros de facturas', () => {
  let component: Facturas;
  const invoice = (id: number, invoiceDate: string, clientId: number, subtotal: number, iva: number, total: number, ivaWithheld = 0): DbInvoice => ({
    id, invoiceDate, clientId, client: `Cliente ${clientId}`, subtotal, iva, total, ivaWithheld,
    folio: String(id), rfc: 'AAA010101AAA', ivaMode: 'added', ivaRate: 16,
    personType: null, createdAt: '', createdBy: 'Prueba', payments: []
  });
  beforeEach(() => {
    component = new Facturas({} as Db);
    component.invoices = [
      invoice(1, '2026-01-01', 1, 100, 16, 116),
      invoice(2, '2026-01-31', 2, 50, 8, 54, 4),
      invoice(3, '2025-01-15', 1, 200, 32, 232),
      invoice(4, '2026-02-01', 1, 0.1, 0.02, 0.12),
      invoice(5, '2026-02-28', 1, 0.2, 0.03, 0.23)
    ];
  });
  it('separa los años y suma importes guardados con precisión de centavos', () => {
    expect(component.monthlySummaries.map(summary => summary.key)).toEqual(['2026-02', '2026-01', '2025-01']);
    expect(component.monthlySummaries[0]).toEqual({ key: '2026-02', label: 'Febrero 2026', count: 2, subtotal: 0.3, iva: 0.05, ivaWithheld: 0, total: 0.35 });
    expect(component.monthlySummaries[1].total).toBe(170);
    expect(component.monthlySummaries[1].iva).toBe(24);
    expect(component.monthlySummaries[1].ivaWithheld).toBe(4);
  });
  it('combina año, mes y cliente en tarjetas y listado y permite limpiar filtros', () => {
    component.filterMonth = '01';
    expect(component.filteredInvoices.length).toBe(3);
    component.filterYear = '2026';
    component.filterClientId = 2;
    expect(component.filteredInvoices.map(invoice => invoice.id)).toEqual([2]);
    expect(component.monthlySummaries[0].total).toBe(54);
    component.filterMonth = '02';
    expect(component.filteredInvoices).toEqual([]);
    expect(component.monthlySummaries).toEqual([]);
    component.clearFilters();
    expect(component.filteredInvoices.length).toBe(5);
    expect(component.invoiceYears).toEqual(['2026', '2025']);
    expect(component.invoiceClients.length).toBe(2);
  });
});
