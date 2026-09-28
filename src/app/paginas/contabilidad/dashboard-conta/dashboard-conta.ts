import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Db, DbExpense, DbPayment } from '../../../services/db';

interface PeriodSummary {
  key: string;
  label: string;
  incomeCents: number;
  expenseCents: number;
  paymentCount: number;
  expenseCount: number;
}

@Component({
  selector: 'app-dashboard-conta',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dashboard-conta.html',
  styleUrl: './dashboard-conta.scss'
})
export class DashboardConta implements OnInit {
  readonly months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    .map((label, index) => ({ label, value: String(index + 1).padStart(2, '0') }));
  filterYear = String(new Date().getFullYear());
  filterMonth = '';
  payments: DbPayment[] = [];
  expenses: DbExpense[] = [];
  error = '';
  hoveredIndex: number | null = null;

  constructor(private readonly db: Db) {}
  ngOnInit(): void { this.load(); }
  load(): void {
    this.error = ''; this.hoveredIndex = null;
    try {
      const payments = this.db.listPayments();
      const expenses = this.db.listExpenses();
      this.payments = payments; this.expenses = expenses;
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No se pudo cargar el resumen contable.';
    }
  }
  get years(): string[] {
    return [...new Set([String(new Date().getFullYear()), this.filterYear,
      ...this.payments.map(item => item.paymentDate.slice(0, 4)),
      ...this.expenses.map(item => item.expenseDate.slice(0, 4))])].sort().reverse();
  }
  get periodLabel(): string {
    return `${this.months.find(month => month.value === this.filterMonth)?.label || 'Todos los meses'} · ${this.filterYear}`;
  }
  private inPeriod(date: string): boolean {
    return date.slice(0, 4) === this.filterYear && (!this.filterMonth || date.slice(5, 7) === this.filterMonth);
  }
  get filteredPayments(): DbPayment[] {
    return this.payments.filter(item => item.status === 'Activo' && this.inPeriod(item.paymentDate));
  }
  get filteredExpenses(): DbExpense[] { return this.expenses.filter(item => this.inPeriod(item.expenseDate)); }

  private summarize(periods: { key: string; label: string }[], daily = false): PeriodSummary[] {
    const groups = new Map(periods.map(period => [period.key, { ...period, incomeCents: 0, expenseCents: 0, paymentCount: 0, expenseCount: 0 }]));
    for (const payment of this.filteredPayments) {
      const group = groups.get(payment.paymentDate.slice(0, daily ? 10 : 7));
      if (group) { group.incomeCents += Math.round(payment.amount * 100); group.paymentCount++; }
    }
    for (const expense of this.filteredExpenses) {
      const group = groups.get(expense.expenseDate.slice(0, daily ? 10 : 7));
      if (group) { group.expenseCents += Math.round(expense.total * 100); group.expenseCount++; }
    }
    return [...groups.values()];
  }
  get monthlySummaries(): PeriodSummary[] {
    return this.summarize(this.months.filter(month => !this.filterMonth || month.value === this.filterMonth)
      .map(month => ({ key: `${this.filterYear}-${month.value}`, label: `${month.label} ${this.filterYear}` })));
  }
  get totals() {
    return this.monthlySummaries.reduce((total, month) => ({
      incomeCents: total.incomeCents + month.incomeCents, expenseCents: total.expenseCents + month.expenseCents,
      paymentCount: total.paymentCount + month.paymentCount, expenseCount: total.expenseCount + month.expenseCount
    }), { incomeCents: 0, expenseCents: 0, paymentCount: 0, expenseCount: 0 });
  }
  get chartData() {
    let periods = this.monthlySummaries;
    if (this.filterMonth) {
      const days = new Date(Number(this.filterYear), Number(this.filterMonth), 0).getDate();
      periods = this.summarize(Array.from({ length: days }, (_, index) => ({
        key: `${this.filterYear}-${this.filterMonth}-${String(index + 1).padStart(2, '0')}`, label: String(index + 1)
      })), true);
    }
    const max = Math.max(100, ...periods.flatMap(period => [period.incomeCents, period.expenseCents]));
    const scale = 10 ** Math.floor(Math.log10(max));
    const ceiling = Math.ceil(max / scale) * scale;
    const points = periods.map((period, index) => ({ ...period,
      label: this.filterMonth ? period.label : this.months[index].label.slice(0, 3),
      x: 100 + index * 820 / Math.max(1, periods.length - 1),
      incomeY: 290 - period.incomeCents / ceiling * 240,
      expenseY: 290 - period.expenseCents / ceiling * 240
    }));
    return {
      points,
      incomeLine: points.map(point => `${point.x},${point.incomeY}`).join(' '),
      expenseLine: points.map(point => `${point.x},${point.expenseY}`).join(' '),
      ticks: Array.from({ length: 5 }, (_, index) => ({ y: 290 - index * 60, amount: ceiling * index / 4 / 100 }))
    };
  }
  axisLabel(amount: number): string {
    return new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 }).format(amount);
  }

}
