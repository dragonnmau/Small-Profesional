import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CalculoImpuestos } from './calculo-impuestos';
import { calculateRetention, RETENTION_PROFILES, RetentionInput } from './retention-calculator';

describe('CalculoImpuestos', () => {
  let component: CalculoImpuestos;
  let fixture: ComponentFixture<CalculoImpuestos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalculoImpuestos]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CalculoImpuestos);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses the selected profile instead of the general ISR setting', () => {
    component.settings.isrRate = 30;
    component.profileId = 'resico-profesional';
    component.applyProfile();
    component.moralBase = 1000;
    fixture.detectChanges();
    expect(component.retentionCalculation.result?.isr).toBe(12.5);
    expect(fixture.nativeElement.querySelector('.retention-results').textContent).toContain('1.25%');
    expect(component.settings.isrRate).toBe(30);
  });

  it('changes to custom mode when a rate changes and displays invalid input errors', () => {
    component.retentionIsrRate = 5;
    component.useCustomRates();
    expect(component.profileId).toBe('custom');
    component.moralBase = -1;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.retention-results')).toBeNull();
  });
});

describe('Retention calculations', () => {
  const defaults: RetentionInput = { amount: 1000, mode: 'subtotal', ivaRate: 16, isrRate: 10, ivaRetention: 'two-thirds', decimals: 2 };

  it('calculates honorarios with exact two-thirds IVA and a reconciling total', () => {
    expect(calculateRetention(defaults)).toEqual({ subtotal: 1000, iva: 160, isr: 100, retainedIva: 106.67, total: 953.33, roundingDifference: 0 });
  });

  for (const [id, total, isr, retainedIva] of [
    ['resico-profesional', 1040.83, 12.5, 106.67], ['resico-empresarial', 1147.5, 12.5, 0],
    ['transporte', 1120, 0, 40], ['resico-transporte', 1107.5, 12.5, 40],
    ['arrendamiento', 953.33, 100, 106.67], ['resico-arrendamiento', 1040.83, 12.5, 106.67],
    ['comisiones', 1053.33, 0, 106.67], ['sin-retenciones', 1160, 0, 0]
  ] as const) {
    it(`applies the ${id} profile`, () => {
      const profile = RETENTION_PROFILES.find(item => item.id === id)!;
      const result = calculateRetention({ ...defaults, isrRate: profile.isrRate, ivaRetention: profile.ivaRetention });
      expect(result.total).toBe(total);
      expect(result.isr).toBe(isr);
      expect(result.retainedIva).toBe(retainedIva);
    });
  }

  it('supports IVA 8%, zero IVA and custom ISR', () => {
    expect(calculateRetention({ ...defaults, ivaRate: 8 }).retainedIva).toBe(53.33);
    const exempt = calculateRetention({ ...defaults, ivaRate: 0, isrRate: 1.25 });
    expect(exempt.iva).toBe(0);
    expect(exempt.retainedIva).toBe(0);
    expect(exempt.total).toBe(987.5);
    expect(calculateRetention({ ...defaults, isrRate: 5, ivaRetention: 'none' }).total).toBe(1110);
  });

  it('calculates backwards from the net total and reconciles displayed rounded amounts', () => {
    const result = calculateRetention({ ...defaults, amount: 953.33, mode: 'net' });
    expect(result.subtotal).toBe(1000);
    expect(result.total).toBe(953.33);
    expect(result.roundingDifference).toBe(0);
    const fine = calculateRetention({ ...defaults, decimals: 6 });
    expect(fine.retainedIva).toBe(106.666667);
    expect(fine.total).toBe(953.333333);
    const approximate = calculateRetention({ ...defaults, amount: .04, mode: 'net', isrRate: 0, ivaRetention: 'none' });
    expect(approximate.roundingDifference).not.toBe(0);
  });

  it('rejects invalid amounts, rates, precision and impossible net calculations', () => {
    for (const amount of [-1, NaN, Infinity, 1e13]) expect(() => calculateRetention({ ...defaults, amount })).toThrowError();
    expect(() => calculateRetention({ ...defaults, isrRate: 101 })).toThrowError();
    expect(() => calculateRetention({ ...defaults, ivaRate: -1 })).toThrowError();
    expect(() => calculateRetention({ ...defaults, ivaRate: 0, isrRate: 100 })).toThrowError();
    expect(() => calculateRetention({ ...defaults, ivaRate: 1, ivaRetention: 'four-percent' })).toThrowError();
    expect(() => calculateRetention({ ...defaults, decimals: 3 })).toThrowError();
    expect(calculateRetention({ ...defaults, amount: 0 }).total).toBe(0);
  });
});
