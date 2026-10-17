import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Db, DbService } from '../../../services/db';

import { DashboardServs } from './dashboard-servs';

describe('DashboardServs', () => {
  let component: DashboardServs;
  let fixture: ComponentFixture<DashboardServs>;
  const service = (id: number, date: string, status: string, time = '10:00'): DbService => ({
    id, date, status, time, clientId: 1, client: 'Cliente de prueba', companyId: null, company: '', city: 'Cancún', site: 'Sucursal',
    description: 'Mantenimiento', folio: `S-${id}`, servicePaid: 'No', serviceCost: 100, travelAllowance: 20, travelDeposit: 'No',
    materialsCost: 30, transportCost: 40, gasolineCost: 10, materials: [], assignedUserId: null, assignedUserName: ''
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardServs],
      providers: [provideRouter([]), { provide: Db, useValue: { listServices: () => [
        service(1, '2026-10-01', 'Pendiente', '11:00'), service(2, '2026-10-01', 'Completado', '09:00'),
        service(3, '2026-10-04', 'Cancelado en transito'), service(4, '2026-10-05', 'Cancelado'),
        service(5, '2026-09-30', 'Pendiente'), service(6, '2026-11-01', 'Completado')
      ] } }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardServs);
    component = fixture.componentInstance;
    fixture.detectChanges();
    component.selectedMonth = '2026-10';
    component.selectMonth();
    component.weekIndex = 0;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('counts only the selected month and combines both cancellation states', () => {
    expect(component.monthServices.length).toBe(4);
    expect(component.summary).toEqual({ pending: 1, completed: 1, cancelled: 2 });
    expect(component.completionRate).toBe(25);
  });

  it('clips weeks at month boundaries and sorts services by date and time', () => {
    expect(component.weeks.length).toBe(5);
    expect(component.weekDays.map(day => day.date)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(component.weekServices.map(item => item.id)).toEqual([2, 1, 3]);
    component.weekIndex = 4;
    expect(component.weekDays.at(-1)?.date).toBe('2026-10-31');
  });

  it('filters the weekly agenda without changing monthly counts', () => {
    const cards: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.summary-card');
    cards[2].click(); fixture.detectChanges();
    expect(component.visibleCount).toBe(1);
    expect(component.summary.cancelled).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('.service-card').length).toBe(1);
    cards[2].click(); fixture.detectChanges();
    expect(component.visibleCount).toBe(3);
  });

  it('shows an empty month without invalid percentages', () => {
    component.selectedMonth = '2027-02'; component.selectMonth(); fixture.detectChanges();
    expect(component.completionRate).toBe(0);
    expect(component.visibleCount).toBe(0);
    expect(fixture.nativeElement.querySelector('.empty-month')).toBeTruthy();
    expect(component.total(service(7, '2027-02-01', 'Pendiente'))).toBe(200);
  });

  it('opens a modal with service details and cost breakdown', () => {
    fixture.nativeElement.querySelector('.service-card').click(); fixture.detectChanges();
    const dialog: HTMLDialogElement = fixture.nativeElement.querySelector('dialog[aria-labelledby="service-detail-title"]');
    expect(dialog.open).toBeTrue();
    expect(dialog.textContent).toContain('Desglose de costos');
    dialog.querySelector<HTMLButtonElement>('[aria-label="Cerrar detalle"]')!.click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('dialog[aria-labelledby="service-detail-title"]')).toBeNull();
  });

  it('exports the selected week independently of the status filter', async () => {
    const db = TestBed.inject(Db);
    const exportSpy = jasmine.createSpy().and.resolveTo('C:/Calendario.pdf');
    db.exportServiceCalendar = exportSpy;
    component.weekIndex = 1;
    component.statusFilter = 'pending';
    component.exportFormat = 'pdf';
    component.openExport();
    await component.exportCalendar();
    expect(exportSpy).toHaveBeenCalledOnceWith('2026-10-05', '2026-10-11', 'pdf');
    expect(component.exportMessage).toContain('C:/Calendario.pdf');
    expect(component.exporting).toBeFalse();
    expect(component.exportDialog?.nativeElement.open).toBeFalse();
  });

  it('offers PNG and keeps the dialog open when saving is cancelled or fails', async () => {
    const db = TestBed.inject(Db);
    const exportSpy = jasmine.createSpy().and.resolveTo(null);
    db.exportServiceCalendar = exportSpy;
    component.exportFormat = 'png';
    component.openExport();
    await component.exportCalendar();
    expect(exportSpy).toHaveBeenCalledOnceWith('2026-10-01', '2026-10-04', 'png');
    expect(component.exportMessage).toBe('');
    expect(component.exportDialog?.nativeElement.open).toBeTrue();
    exportSpy.and.rejectWith(new Error('Error al guardar'));
    await component.exportCalendar();
    expect(component.exportError).toBe('Error al guardar');
    expect(component.exporting).toBeFalse();
  });
});
