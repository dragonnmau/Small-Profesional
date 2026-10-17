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

  const categorizedExpense = (date: string, total: number, category: string) => ({ ...expense(date, total), category });

  const clientPayment = (date: string, amount: number, clientId: number, client: string, status = 'Activo') => ({ ...payment(date, amount, status), clientId, client });

  it('agrupa ingresos por ID de cliente, conserva centavos y excluye pagos revertidos', () => {
    component.filterYear = '2026';
    component.payments = [clientPayment('2026-01-01', .1, 1, 'Cliente'), clientPayment('2026-01-02', .2, 1, 'Cliente'),
      clientPayment('2026-02-01', 1.2, 2, 'Cliente'), clientPayment('2026-01-03', 100, 1, 'Cliente', 'Revertido'),
      clientPayment('2025-01-01', 50, 3, 'Otro cliente')];
    const chart = component.incomeClientChart;
    expect(chart.clients.map(client => client.clientId)).toEqual([2, 1]);
    expect(chart.clients.map(client => client.totalCents)).toEqual([120, 30]);
    expect(chart.clients.map(client => client.count)).toEqual([1, 2]);
    expect(chart.clients.map(client => client.percentage)).toEqual([80, 20]);
    expect(chart.clients.map(client => client.offset)).toEqual([0, 80]);
    expect(chart.totalCents).toBe(component.totals.incomeCents);
    expect(chart.count).toBe(component.totals.paymentCount);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.income-clients-panel .category-bars li').length).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('.income-clients-panel circle[stroke-dasharray]').length).toBe(2);
  });

  it('filtra ingresos por año y mes manteniendo colores por cliente', () => {
    component.filterYear = '2026'; component.filterMonth = '02';
    component.payments = [clientPayment('2026-01-01', 100, 1, 'Uno'), clientPayment('2026-02-01', 20, 2, 'Dos'), clientPayment('2025-02-01', 50, 3, 'Tres')];
    expect(component.incomeClientChart.clients.map(client => client.client)).toEqual(['Dos']);
    expect(component.incomeClientChart.totalCents).toBe(2000);
    const color = component.incomeClientChart.clients[0].color;
    component.filterMonth = '';
    expect(component.incomeClientChart.clients.length).toBe(2);
    expect(component.incomeClientChart.clients.find(client => client.clientId === 2)?.color).toBe(color);
    component.filterYear = '2025';
    expect(component.incomeClientChart.clients[0].client).toBe('Tres');
  });

  it('muestra ingresos vacíos y totales cero sin porcentajes inválidos', () => {
    expect(component.incomeClientChart.clients).toEqual([]);
    expect(fixture.nativeElement.querySelector('.income-clients-panel').textContent).toContain('No hay ingresos registrados');
    component.payments = [clientPayment(`${component.filterYear}-01-01`, 0, 1, '')];
    fixture.detectChanges();
    expect(component.incomeClientChart.clients[0].client).toBe('Sin cliente');
    expect(component.incomeClientChart.clients[0].percentage).toBe(0);
    expect(component.incomeClientChart.clients[0].barWidth).toBe(0);
    expect(fixture.nativeElement.querySelector('.income-clients-panel').textContent).toContain('total de cero');
  });

  it('agrupa gastos por categoría, conserva centavos y ordena por mayor importe', () => {
    component.filterYear = '2026';
    component.expenses = [
      categorizedExpense('2026-01-01', 0.1, ' Materiales '), categorizedExpense('2026-01-02', 0.2, 'Materiales'),
      categorizedExpense('2026-02-01', 1.2, 'Transporte'), categorizedExpense('2026-02-02', 0.5, ''),
      categorizedExpense('2025-01-01', 900, 'Otro año')
    ];
    const chart = component.expenseCategoryChart;
    expect(chart.categories.map(category => category.category)).toEqual(['Transporte', 'Sin categoría', 'Materiales']);
    expect(chart.categories.map(category => category.totalCents)).toEqual([120, 50, 30]);
    expect(chart.categories.map(category => category.count)).toEqual([1, 1, 2]);
    expect(chart.totalCents).toBe(component.totals.expenseCents);
    expect(chart.totalCents).toBe(200);
    expect(chart.count).toBe(4);
    expect(chart.categories.map(category => category.percentage)).toEqual([60, 25, 15]);
    expect(chart.categories.map(category => category.offset)).toEqual([0, 60, 85]);
    expect(chart.categories[0].barWidth).toBe(100);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.category-bars li').length).toBe(3);
    expect(fixture.nativeElement.querySelectorAll('.category-donut circle[stroke-dasharray]').length).toBe(3);
    expect(fixture.nativeElement.querySelector('.category-bars li').textContent).toContain('Transporte');
  });

  it('aplica los filtros de año y mes a ambos gráficos de categorías', () => {
    component.filterYear = '2026'; component.filterMonth = '02';
    component.expenses = [categorizedExpense('2026-01-01', 100, 'Materiales'), categorizedExpense('2026-02-01', 20, 'Gasolina'), categorizedExpense('2025-02-01', 50, 'Transporte')];
    expect(component.expenseCategoryChart.categories.map(category => category.category)).toEqual(['Gasolina']);
    expect(component.expenseCategoryChart.totalCents).toBe(2000);
    const color = component.expenseCategoryChart.categories[0].color;
    component.filterMonth = '';
    expect(component.expenseCategoryChart.categories.length).toBe(2);
    expect(component.expenseCategoryChart.categories.find(category => category.category === 'Gasolina')?.color).toBe(color);
    component.filterYear = '2025';
    expect(component.expenseCategoryChart.categories[0].category).toBe('Transporte');
    expect(component.expenseCategoryChart.totalCents).toBe(5000);
  });

  it('muestra estados vacíos y evita divisiones por cero en los gráficos de gastos', () => {
    expect(component.expenseCategoryChart.categories).toEqual([]);
    expect(fixture.nativeElement.querySelector('.category-panel').textContent).toContain('No hay gastos registrados');
    component.expenses = [categorizedExpense(`${component.filterYear}-01-01`, 0, 'Materiales')];
    fixture.detectChanges();
    expect(component.expenseCategoryChart.categories[0].percentage).toBe(0);
    expect(component.expenseCategoryChart.categories[0].barWidth).toBe(0);
    expect(component.expenseCategoryChart.categories[0].offset).toBe(0);
    expect(fixture.nativeElement.querySelector('.category-panel').textContent).toContain('total de cero');
  });
});
