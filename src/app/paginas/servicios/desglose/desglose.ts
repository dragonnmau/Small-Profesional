import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Db, DbService } from '../../../services/db';

type CostKey = 'serviceCost' | 'travelAllowance' | 'materialsCost' | 'transportCost' | 'gasolineCost';
interface CostCategory { key: CostKey; label: string; color: string; }
interface CostRow { month: number; label: string; shortLabel: string; count: number; costs: Record<CostKey, number>; total: number; }

@Component({
  selector: 'app-desglose',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './desglose.html',
  styleUrl: './desglose.scss'
})
export class Desglose implements OnInit {
  selectedYear = new Date().getFullYear();
  selectedMonth = new Date().getMonth();
  services: DbService[] = [];
  months: CostRow[] = [];
  error = '';
  readonly categories: CostCategory[] = [
    { key: 'serviceCost', label: 'Servicio', color: '#6366f1' },
    { key: 'travelAllowance', label: 'Viáticos', color: '#0d9488' },
    { key: 'materialsCost', label: 'Materiales', color: '#d99119' },
    { key: 'transportCost', label: 'Transporte', color: '#db5563' },
    { key: 'gasolineCost', label: 'Gasolina', color: '#8b5cf6' }
  ];

  constructor(private readonly db: Db) {}
  ngOnInit(): void { this.refresh(); }

  get years(): number[] {
    return [...new Set([new Date().getFullYear(), this.selectedYear, ...this.services
      .filter(service => /^\d{4}-\d{2}-\d{2}$/.test(service.date)).map(service => Number(service.date.slice(0, 4)))])].sort((a, b) => b - a);
  }
  get annualCount(): number { return this.months.reduce((sum, month) => sum + month.count, 0); }
  get annualTotal(): number { return this.months.reduce((sum, month) => sum + month.total, 0); }
  get monthlyAverage(): number { return this.annualTotal / 12; }
  get maxMonthTotal(): number { return Math.max(0, ...this.months.map(month => month.total)); }
  get ranking() {
    return this.categories.map(category => ({ ...category, amount: this.months.reduce((sum, month) => sum + month.costs[category.key], 0) }))
      .sort((a, b) => b.amount - a.amount);
  }
  get maxCategoryTotal(): number { return Math.max(0, ...this.ranking.map(category => category.amount)); }
  get activeMonth(): CostRow { return this.months[this.selectedMonth]; }

  refresh(): void {
    try { this.services = this.db.listServices(); this.error = ''; }
    catch { this.error = 'No se pudieron cargar los costos de servicios. Intenta actualizar nuevamente.'; }
    this.updateYear();
  }
  updateYear(): void {
    const services = this.services.filter(service => service.date.startsWith(`${this.selectedYear}-`));
    this.months = Array.from({ length: 12 }, (_, month) => {
      const date = new Date(this.selectedYear, month, 1);
      const prefix = `${this.selectedYear}-${String(month + 1).padStart(2, '0')}-`;
      const monthlyServices = services.filter(service => service.date.startsWith(prefix));
      const costs: Record<CostKey, number> = { serviceCost: 0, travelAllowance: 0, materialsCost: 0, transportCost: 0, gasolineCost: 0 };
      for (const service of monthlyServices) for (const category of this.categories) costs[category.key] += this.amount(service[category.key]);
      return { month, label: date.toLocaleDateString('es-MX', { month: 'long' }), shortLabel: date.toLocaleDateString('es-MX', { month: 'short' }),
        count: monthlyServices.length, costs, total: this.categories.reduce((sum, category) => sum + costs[category.key], 0) };
    });
  }
  percentage(amount: number, total: number): number { return total > 0 ? amount / total * 100 : 0; }
  rankingAmount(key: CostKey): number { return this.months.reduce((sum, month) => sum + month.costs[key], 0); }
  private amount(value: number): number { const amount = Number(value); return Number.isFinite(amount) ? amount : 0; }

}
