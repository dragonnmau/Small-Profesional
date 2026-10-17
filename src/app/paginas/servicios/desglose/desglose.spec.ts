import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Db, DbService } from '../../../services/db';

import { Desglose } from './desglose';

describe('Desglose', () => {
  let component: Desglose;
  let fixture: ComponentFixture<Desglose>;
  let db: { listServices: jasmine.Spy };
  const service = (id: number, date: string, costs: Partial<DbService> = {}): DbService => ({
    id, date, time: '10:00', clientId: 1, client: 'Cliente', companyId: null, company: '', city: '', site: '', description: '', folio: '',
    status: 'Pendiente', servicePaid: 'No', serviceCost: 0, travelAllowance: 0, travelDeposit: 'No', materialsCost: 0,
    transportCost: 0, gasolineCost: 0, materials: [], assignedUserId: null, assignedUserName: '', ...costs
  });

  beforeEach(async () => {
    db = { listServices: jasmine.createSpy().and.returnValue([
      service(1, '2026-01-01', { serviceCost: 100, travelAllowance: 20, materialsCost: 200, transportCost: 40, gasolineCost: 10 }),
      service(2, '2026-01-31', { serviceCost: 50, travelAllowance: 30, status: 'Cancelado en transito' }),
      service(3, '2026-12-31', { serviceCost: 100, gasolineCost: 5 }),
      service(4, '2025-12-31', { serviceCost: 900 }), service(5, '2027-01-01', { materialsCost: 800 })
    ]) };
    await TestBed.configureTestingModule({
      imports: [Desglose],
      providers: [provideRouter([]), { provide: Db, useValue: db }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Desglose);
    component = fixture.componentInstance;
    fixture.detectChanges();
    component.selectedYear = 2026;
    component.updateYear();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('groups all registered costs into 12 months and excludes other years', () => {
    expect(component.months.length).toBe(12);
    expect(component.months[0].costs).toEqual({ serviceCost: 150, travelAllowance: 50, materialsCost: 200, transportCost: 40, gasolineCost: 10 });
    expect(component.months[0].total).toBe(450);
    expect(component.months[11].total).toBe(105);
    expect(component.months[1].total).toBe(0);
    expect(component.annualTotal).toBe(555);
    expect(component.annualCount).toBe(3);
    expect(component.monthlyAverage).toBe(555 / 12);
  });

  it('ranks annual categories from highest to lowest', () => {
    expect(component.ranking.map(category => category.key)).toEqual(['serviceCost', 'materialsCost', 'travelAllowance', 'transportCost', 'gasolineCost']);
    expect(component.ranking.map(category => category.amount)).toEqual([250, 200, 50, 40, 15]);
    expect(component.rankingAmount('gasolineCost')).toBe(15);
    expect(component.maxMonthTotal).toBe(450);
    expect(component.percentage(225, 450)).toBe(50);
  });

  it('changes year and recalculates totals and ranking', () => {
    component.selectedYear = 2027; component.updateYear(); fixture.detectChanges();
    expect(component.annualTotal).toBe(800);
    expect(component.ranking[0].key).toBe('materialsCost');
    expect(component.years).toContain(2025);
    expect(component.years).toContain(2027);
  });

  it('selects a monthly bar to show its category breakdown', () => {
    const bars: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.month-bar');
    expect(bars.length).toBe(12);
    bars[11].click(); fixture.detectChanges();
    expect(component.selectedMonth).toBe(11);
    expect(fixture.nativeElement.querySelector('.month-detail').textContent).toContain('diciembre 2026');
    expect(fixture.nativeElement.querySelectorAll('.ranking li').length).toBe(5);
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(12);
  });

  it('handles a year without services or chart division by zero', () => {
    component.selectedYear = 2024; component.updateYear(); fixture.detectChanges();
    expect(component.annualTotal).toBe(0);
    expect(component.percentage(0, 0)).toBe(0);
    expect(component.maxCategoryTotal).toBe(0);
    expect(fixture.nativeElement.querySelector('.empty').textContent).toContain('No hay servicios');
  });

  it('refreshes changed costs and reports loading failures', () => {
    db.listServices.and.returnValue([service(7, '2026-05-10', { serviceCost: 75 })]);
    component.refresh();
    expect(component.annualTotal).toBe(75);
    db.listServices.and.throwError('Error'); component.refresh(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
  });
});
