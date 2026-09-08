import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CalculoImpuestos } from './calculo-impuestos';

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
});
