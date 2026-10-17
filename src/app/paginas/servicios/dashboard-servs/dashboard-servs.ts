import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Db, DbService } from '../../../services/db';

type StatusGroup = 'pending' | 'completed' | 'cancelled';
interface Week { start: Date; end: Date; label: string; }

@Component({
  selector: 'app-dashboard-servs',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dashboard-servs.html',
  styleUrl: './dashboard-servs.scss'
})
export class DashboardServs implements OnInit {
  services: DbService[] = [];
  selectedMonth = this.dateKey(new Date()).slice(0, 7);
  weekIndex = 0;
  statusFilter: StatusGroup | '' = '';
  selectedService: DbService | null = null;
  error = '';
  exportFormat: 'png' | 'pdf' = 'pdf';
  exporting = false;
  exportMessage = '';
  exportError = '';
  @ViewChild('exportDialog') exportDialog?: ElementRef<HTMLDialogElement>;
  @ViewChild('detailDialog') detailDialog?: ElementRef<HTMLDialogElement>;

  constructor(private readonly db: Db, private readonly changeDetector: ChangeDetectorRef) {}

  ngOnInit(): void { this.refresh(); this.selectMonth(); }

  refresh(): void {
    try { this.services = this.db.listServices(); this.error = ''; }
    catch { this.error = 'No se pudieron cargar los servicios. Intenta actualizar nuevamente.'; }
  }

  get monthServices(): DbService[] { return this.services.filter(service => service.date.startsWith(this.selectedMonth)); }
  get summary() {
    return {
      pending: this.monthServices.filter(service => this.statusGroup(service) === 'pending').length,
      completed: this.monthServices.filter(service => this.statusGroup(service) === 'completed').length,
      cancelled: this.monthServices.filter(service => this.statusGroup(service) === 'cancelled').length
    };
  }
  get completionRate(): number { return this.monthServices.length ? Math.round(this.summary.completed / this.monthServices.length * 100) : 0; }
  get monthTitle(): string { return this.monthDate().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }); }
  get weeks(): Week[] {
    const first = this.monthDate();
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    const weeks: Week[] = [];
    let start = first;
    while (start <= last) {
      const end = new Date(start);
      end.setDate(start.getDate() + (7 - start.getDay()) % 7);
      if (end > last) end.setTime(last.getTime());
      weeks.push({ start: new Date(start), end: new Date(end), label: `${this.shortDate(start)} — ${this.shortDate(end)}` });
      start = new Date(end); start.setDate(end.getDate() + 1);
    }
    return weeks;
  }
  get activeWeek(): Week { return this.weeks[this.weekIndex] ?? this.weeks[0]; }
  get weekServices(): DbService[] {
    return this.monthServices.filter(service => service.date >= this.dateKey(this.activeWeek.start) && service.date <= this.dateKey(this.activeWeek.end))
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  }
  get weekDays(): { date: string; label: string; services: DbService[] }[] {
    const days = [];
    const day = new Date(this.activeWeek.start);
    while (day <= this.activeWeek.end) {
      const date = this.dateKey(day);
      days.push({ date, label: day.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' }),
        services: this.weekServices.filter(service => service.date === date && (!this.statusFilter || this.statusGroup(service) === this.statusFilter)) });
      day.setDate(day.getDate() + 1);
    }
    return days;
  }
  get visibleCount(): number { return this.weekDays.reduce((total, day) => total + day.services.length, 0); }

  selectMonth(): void {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(this.selectedMonth)) this.selectedMonth = this.dateKey(new Date()).slice(0, 7);
    const today = this.dateKey(new Date());
    this.weekIndex = Math.max(0, this.weeks.findIndex(week => today >= this.dateKey(week.start) && today <= this.dateKey(week.end)));
    this.selectedService = null;
  }
  moveMonth(offset: number): void {
    const month = this.monthDate(); month.setMonth(month.getMonth() + offset);
    this.selectedMonth = this.dateKey(month).slice(0, 7); this.selectMonth();
  }
  toggleFilter(status: StatusGroup): void { this.statusFilter = this.statusFilter === status ? '' : status; }
  openExport(): void {
    this.exportError = '';
    this.exportMessage = '';
    this.exportDialog?.nativeElement.showModal();
  }
  async exportCalendar(): Promise<void> {
    if (this.exporting) return;
    const week = this.activeWeek;
    this.exporting = true;
    this.exportError = '';
    this.exportMessage = '';
    try {
      const path = await this.db.exportServiceCalendar(this.dateKey(week.start), this.dateKey(week.end), this.exportFormat);
      if (path) {
        this.exportMessage = `Calendario guardado en: ${path}`;
        this.exportDialog?.nativeElement.close();
      }
    } catch (error) {
      this.exportError = error instanceof Error ? error.message : 'No se pudo exportar el calendario. Intenta nuevamente.';
    } finally {
      this.exporting = false;
      this.changeDetector.detectChanges();
    }
  }
  openDetail(service: DbService): void {
    this.selectedService = service;
    this.changeDetector.detectChanges();
    this.detailDialog?.nativeElement.showModal();
  }
  statusGroup(service: DbService): StatusGroup {
    const status = service.status.trim().toLocaleLowerCase('es-MX');
    if (status.startsWith('cancelado')) return 'cancelled';
    return status === 'completado' || status === 'pagado' ? 'completed' : 'pending';
  }
  isPaid(service: DbService): boolean { return ['si', 'sí'].includes(service.servicePaid.trim().toLocaleLowerCase('es-MX')) || service.status.trim().toLocaleLowerCase('es-MX') === 'pagado'; }
  total(service: DbService): number { return [service.serviceCost, service.travelAllowance, service.materialsCost, service.transportCost, service.gasolineCost].reduce((sum, value) => sum + (Number(value) || 0), 0); }
  private monthDate(): Date { const [year, month] = this.selectedMonth.split('-').map(Number); return new Date(year, month - 1, 1); }
  private shortDate(date: Date): string { return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }); }
  private dateKey(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }

}
