import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CuentasBancarias } from './cuentas-bancarias';

describe('CuentasBancarias', () => {
  let component: CuentasBancarias;
  let fixture: ComponentFixture<CuentasBancarias>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CuentasBancarias]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CuentasBancarias);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
