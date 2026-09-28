import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnoFiscal } from './ano-fiscal';
import { Db, DbInvoice } from '../../../services/db';

describe('AnoFiscal', () => {
  let component: AnoFiscal;
  let fixture: ComponentFixture<AnoFiscal>;
  let db: jasmine.SpyObj<Db>;

  beforeEach(async () => {
    db = jasmine.createSpyObj('Db', ['listInvoices', 'listFiscalMonths', 'saveFiscalMonth']);
    db.listInvoices.and.returnValue([]); db.listFiscalMonths.and.returnValue([]);
    await TestBed.configureTestingModule({
      imports: [AnoFiscal], providers: [{ provide: Db, useValue: db }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AnoFiscal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('.month-card').length).toBe(12);
    expect(component.months.every(month => month.isr === null && month.deductions === null)).toBeTrue();
  });
  it('agrupa facturación e IVA por fecha y conserva los importes manuales sin calcularlos', () => {
    component.selectedYear = 2026;
    const invoice = (invoiceDate: string, total: number, iva: number) => ({ invoiceDate, total, iva, subtotal: total - iva, ivaWithheld: 0 } as DbInvoice);
    component.invoices = [invoice('2026-01-01', 0.1, 0.01), invoice('2026-01-31', 0.2, 0.02), invoice('2025-01-01', 100, 16)];
    component.records = [{ year: 2026, month: 1, isr: 25.32, deductions: 8.76, note: '' }, { year: 2025, month: 1, isr: 800, deductions: 100, note: '' }];
    expect(component.months[0].total).toBe(30);
    expect(component.months[0].iva).toBe(3);
    expect(component.months[0].isr).toBe(25.32);
    expect(component.months[1].isr).toBeNull();
    expect(component.annualTotals.isr).toBe(2532);
    expect(component.annualTotals.deductions).toBe(876);
    expect(component.annualTotals.isrMonths).toBe(1);
    component.openMonth(1);
    expect(component.detailInvoices.length).toBe(2);
    component.selectedYear = 2025;
    expect(component.annualTotals.isr).toBe(80000);
  });
  it('permite capturar un mes sin facturas, distingue cero de pendiente y conserva al reabrir', () => {
    component.selectedYear = 2026; component.openMonth(2);
    expect(component.detailInvoices.length).toBe(0);
    component.detail!.isr = 0; component.detail!.deductions = 150.45;
    db.saveFiscalMonth.and.callFake(month => ({ ...month }));
    component.saveMonth();
    expect(db.saveFiscalMonth).toHaveBeenCalledWith({ year: 2026, month: 2, isr: 0, deductions: 150.45, ivaSurcharge: null, isrSurcharge: null, note: '' });
    expect(component.detail).toBeNull();
    component.openMonth(2);
    expect(component.detail!.isr).toBe(0);
    expect(component.detail!.deductions).toBe(150.45);
    component.detail!.isr = 500; component.closeDetail();
    expect(component.months[1].isr).toBe(0);
  });
  it('rechaza importes inválidos y mantiene los datos cuando falla el guardado', () => {
    component.openMonth(1); component.detail!.isr = -1;
    component.saveMonth();
    expect(db.saveFiscalMonth).not.toHaveBeenCalled();
    expect(component.formError).toContain('no negativos');
    component.detail!.isr = 10;
    db.saveFiscalMonth.and.throwError('No se pudo guardar');
    component.saveMonth();
    expect(component.detail!.isr).toBe(10);
    expect(component.formError).toBe('No se pudo guardar');
    expect(component.saving).toBeFalse();
    expect(component.records.length).toBe(0);
  });
  it('muestra un error de carga sin presentar importes incompletos', () => {
    db.listFiscalMonths.and.throwError('Error de lectura');
    component.load(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Error de lectura');
    expect(fixture.nativeElement.querySelector('.month-grid')).toBeNull();
  });
  it('suma recargos al IVA pagado y al ISR capturado, y conserva los importes al reabrir', () => {
    component.selectedYear = 2026;
    component.invoices = [{ invoiceDate: '2026-01-01', iva: 160.3, subtotal: 1000, total: 1160.3, ivaWithheld: 10 } as DbInvoice];
    component.openMonth(1);
    expect(component.ivaPaidCents).toBeNull();
    component.detail!.deductions = 60.2;
    component.detail!.isr = 80.1;
    component.detail!.ivaSurcharge = 5.5; component.detail!.isrSurcharge = 7.25;
    expect(component.ivaPaidCents).toBe(10560);
    expect(component.isrPaidCents).toBe(8735);
    expect(component.monthlyPaymentCents).toBe(19295);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.iva-paid').textContent).toContain('105.60');
    expect(fixture.nativeElement.querySelector('.isr-paid').textContent).toContain('87.35');
    expect(fixture.nativeElement.querySelector('.monthly-payment').textContent).toContain('192.95');
    db.saveFiscalMonth.and.callFake(month => ({ ...month }));
    component.saveMonth(); component.openMonth(1);
    expect(component.detail!.ivaSurcharge).toBe(5.5);
    expect(component.detail!.isrSurcharge).toBe(7.25);
    component.detail!.deductions = 200;
    expect(component.ivaPaidCents).toBe(-3420);
    component.detail!.deductions = 0;
    expect(component.ivaPaidCents).toBe(16580);
    component.detail!.ivaSurcharge = null; component.detail!.isrSurcharge = null;
    expect(component.ivaPaidCents).toBe(16030);
    expect(component.isrPaidCents).toBe(8010);
    component.detail!.isr = null;
    expect(component.isrPaidCents).toBeNull();
    expect(component.monthlyPaymentCents).toBeNull();
    component.detail!.ivaSurcharge = -1;
    expect(component.ivaPaidCents).toBeNull();
  });
  it('rechaza recargos negativos o con más de dos decimales', () => {
    component.openMonth(1);
    component.detail!.ivaSurcharge = -1; component.saveMonth();
    expect(db.saveFiscalMonth).not.toHaveBeenCalled();
    component.detail!.ivaSurcharge = 0; component.detail!.isrSurcharge = 0.001; component.saveMonth();
    expect(db.saveFiscalMonth).not.toHaveBeenCalled();
    expect(component.formError).toContain('dos decimales');
  });
});
