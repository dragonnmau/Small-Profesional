import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardConta } from './dashboard-conta';
import { provideRouter } from '@angular/router';
import { Db, DbExpense, DbPayment } from '../../../services/db';

describe('DashboardConta', () => {
  let component: DashboardConta;
  let fixture: ComponentFixture<DashboardConta>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardConta],
      providers: [provideRouter([]), { provide: Db, useValue: { listPayments: () => [], listExpenses: () => [] } }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardConta);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.monthlySummaries.length).toBe(12);
    expect(component.chartData.incomeLine).not.toContain('NaN');
    expect(fixture.nativeElement.textContent).toContain('No hay ingresos ni egresos');
  });

  const payment = (paymentDate: string, amount: number, status = 'Activo') => ({ paymentDate, amount, status } as DbPayment);
  const expense = (expenseDate: string, total: number) => ({ expenseDate, total, billingMonth: '12' } as DbExpense);

  it('suma por fecha, excluye pagos revertidos y conserva centavos y meses vacíos', () => {
    component.filterYear = '2026';
    component.payments = [payment('2026-01-01', 0.1), payment('2026-01-02', 0.2), payment('2026-01-03', 100, 'Revertido'), payment('2025-01-01', 500)];
    component.expenses = [expense('2026-01-04', 0.4), expense('2026-02-01', 10), expense('2024-01-01', 60)];
    expect(component.monthlySummaries[0]).toEqual({ key: '2026-01', label: 'Enero 2026', incomeCents: 30, expenseCents: 40, paymentCount: 2, expenseCount: 1 });
    expect(component.totals).toEqual({ incomeCents: 30, expenseCents: 1040, paymentCount: 2, expenseCount: 2 });
    expect(component.monthlySummaries[2].expenseCents).toBe(0);
    expect(component.years).toContain('2024');
    expect(component.years).toContain('2025');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(12);
    expect(fixture.nativeElement.querySelector('.balance-card .negative')).toBeTruthy();
  });

  it('filtra año y mes en totales, listado y gráfica diaria con años bisiestos', () => {
    component.filterYear = '2024'; component.filterMonth = '02';
    component.payments = [payment('2024-02-29', 120), payment('2024-03-01', 50), payment('2025-02-01', 100)];
    component.expenses = [expense('2024-02-28', 30)];
    expect(component.monthlySummaries.length).toBe(1);
    expect(component.totals.incomeCents).toBe(12000);
    expect(component.chartData.points.length).toBe(29);
    expect(component.chartData.points[28].incomeCents).toBe(12000);
    expect(component.chartData.points[27].expenseCents).toBe(3000);
    component.filterMonth = '';
    expect(component.chartData.points.length).toBe(12);
    expect(component.totals.incomeCents).toBe(17000);
    component.filterYear = '2025'; component.filterMonth = '02';
    expect(component.chartData.points.length).toBe(28);
    expect(component.totals.incomeCents).toBe(10000);
  });

  it('muestra errores de carga sin presentar totales incompletos y permite reintentar', () => {
    const db = TestBed.inject(Db);
    const load = spyOn(db, 'listExpenses').and.throwError('No se pudo leer gastos');
    component.load(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('No se pudo leer gastos');
    expect(fixture.nativeElement.querySelector('.summary')).toBeNull();
    load.and.returnValue([]);
    component.load(); fixture.detectChanges();
    expect(component.error).toBe('');
    expect(fixture.nativeElement.querySelector('.summary')).toBeTruthy();
  });
});
