import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Informacion } from './informacion';

describe('Informacion', () => {
  let component: Informacion;
  let fixture: ComponentFixture<Informacion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Informacion]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Informacion);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
