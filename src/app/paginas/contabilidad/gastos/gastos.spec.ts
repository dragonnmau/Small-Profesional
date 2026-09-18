import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Gastos } from './gastos';
import { provideRouter } from '@angular/router';
import { Db, DbExpense } from '../../../services/db';

describe('Gastos', () => {
  let component: Gastos;
  let fixture: ComponentFixture<Gastos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Gastos],
      providers: [provideRouter([]), { provide: Db, useValue: {
        listBankAccounts: () => [], listExpenses: () => [], getTaxSettings: () => ({ ivaRate: 16 }),
        getAccountInformation: () => null,
        listExpenseCategories: () => ['Transporte', 'Comida', 'Materiales', 'Herramienta', 'Hospedaje'],
        createExpenseCategory: (name: string) => name.trim(),
        createExpense: () => { throw new Error('No se pudo guardar'); }
      } }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Gastos);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('agrupa por mes facturado y año, conserva gastos sin mes y respeta filtros', () => {
    const expense = (id: number, expenseDate: string, billingMonth: string, total: number, accountId = 1) => ({
      id, expenseDate, billingMonth, total, iva: 0, accountId, concept: 'Compra', category: 'Materiales', accountName: 'Banco'
    } as DbExpense);
    component.expenses = [expense(1, '2026-09-01', '10', 0.1), expense(2, '2026-09-02', '10', 0.2),
      expense(3, '2025-09-01', '10', 50), expense(4, '2026-09-03', '', 20), expense(5, '2026-08-01', '08', 100, 2)];
    expect(component.monthlyExpenses.find(month => month.key === '2026-10')?.total).toBe(0.3);
    expect(component.monthlyExpenses.find(month => month.key === '2026-10')?.count).toBe(2);
    expect(component.monthlyExpenses.length).toBe(4);
    expect(component.monthlyExpenses.find(month => month.key === '2026-00')?.total).toBe(20);
    component.filterMonth = '2026-09'; component.filterAccount = 1;
    expect(component.monthlyExpenses.length).toBe(2);
    component.search = 'inexistente';
    expect(component.monthlyExpenses).toEqual([]);
  });

  it('desglosa el IVA incluido sin aumentar el total', () => {
    component.form.amount = 116;
    component.form.ivaMode = 'included';
    expect(component.totals).toEqual({ subtotal: 100, iva: 16, total: 116 });
  });

  it('conserva el formulario cuando falla el guardado', () => {
    component.openModal();
    component.form.accountId = 1;
    component.form.concept = 'Papelería';
    component.form.amount = 100;
    component.form.category = 'Materiales';
    component.save();
    expect(component.isModalOpen).toBeTrue();
    expect(component.form.concept).toBe('Papelería');
    expect(component.error).toBe('No se pudo guardar');
    expect(component.saving).toBeFalse();
  });

  it('permite indicar factura sin adjuntar archivo y limpia el archivo al desmarcarla', () => {
    component.form.hasInvoice = true;
    component.invoiceChanged();
    expect(component.form.invoice).toBeNull();
    component.form.invoice = { name: 'factura.pdf', type: 'application/pdf', data: 'YQ==' };
    component.form.hasInvoice = false;
    component.form.cfdiUse = 'G03';
    component.invoiceChanged();
    expect(component.form.invoice).toBeNull();
    expect(component.form.cfdiUse).toBe('');
  });

  it('agrega una categoría y la selecciona en el formulario', () => {
    component.openModal();
    component.form.category = '__new__'; component.categoryChanged();
    expect(component.addingCategory).toBeTrue();
    component.newCategory = ' Hospedaje '; component.addCategory();
    expect(component.form.category).toBe('Hospedaje');
    expect(component.addingCategory).toBeFalse();
  });

  it('muestra el selector CFDI solo cuando hay factura', () => {
    component.openModal(); component.form.hasInvoice = true; fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('select[name="cfdiUse"]').options.length).toBe(25);
    component.form.hasInvoice = false; component.invoiceChanged(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('select[name="cfdiUse"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('select[name="category"]')).toBeTruthy();
  });
});
