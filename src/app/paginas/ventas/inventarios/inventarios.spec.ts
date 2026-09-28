import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Inventarios } from './inventarios';

describe('Inventarios', () => {
  let component: Inventarios;
  let fixture: ComponentFixture<Inventarios>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Inventarios]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Inventarios);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
