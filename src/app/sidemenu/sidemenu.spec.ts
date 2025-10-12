import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Sidemenu } from './sidemenu';

describe('Sidemenu', () => {
  let component: Sidemenu;
  let fixture: ComponentFixture<Sidemenu>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Sidemenu]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Sidemenu);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
