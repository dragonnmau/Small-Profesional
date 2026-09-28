import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SeguimientoClientes } from './seguimiento-clientes';

describe('SeguimientoClientes', () => {
  let component: SeguimientoClientes;
  let fixture: ComponentFixture<SeguimientoClientes>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SeguimientoClientes]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SeguimientoClientes);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
