import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { Db } from '../services/db';

import { Sidemenu } from './sidemenu';

describe('Sidemenu', () => {
  let component: Sidemenu;
  let fixture: ComponentFixture<Sidemenu>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Sidemenu],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: Db, useValue: { getAccountInformation: () => null, databaseChallenge: async () => 'A T K 0 9 8',
          exportDatabase: async () => null, importDatabase: async () => null, deleteDatabase: async () => false } }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Sidemenu);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('opens the database modal and requires the exact challenge to enable deletion', async () => {
    await component.openDatabase(); fixture.detectChanges();
    expect(component.databaseDialog?.nativeElement.open).toBeTrue();
    expect(component.canDeleteDatabase).toBeFalse();
    component.deleteText = 'ATK098'; expect(component.canDeleteDatabase).toBeFalse();
    component.deleteText = 'A T K 0 9 8'; expect(component.canDeleteDatabase).toBeTrue();
    component.databaseBusy = true; expect(component.canDeleteDatabase).toBeFalse();
  });

  it('never calls deletion without the challenge and keeps data unchanged on cancellation', async () => {
    await component.openDatabase();
    const remove = spyOn(TestBed.inject(Db), 'deleteDatabase').and.resolveTo(false);
    await component.manageDatabase('delete'); expect(remove).not.toHaveBeenCalled();
    component.deleteText = component.deleteChallenge;
    await component.manageDatabase('delete');
    expect(remove).toHaveBeenCalledOnceWith('A T K 0 9 8');
    expect(component.databaseDialog?.nativeElement.open).toBeTrue();
    expect(component.databaseBusy).toBeFalse();
  });

  it('shows the backup location and operation errors', async () => {
    await component.openDatabase();
    spyOn(TestBed.inject(Db), 'exportDatabase').and.resolveTo('C:/respaldo.db');
    await component.manageDatabase('export');
    expect(component.databaseMessage).toContain('C:/respaldo.db');
    spyOn(TestBed.inject(Db), 'importDatabase').and.rejectWith(new Error('Respaldo inválido'));
    await component.manageDatabase('import');
    expect(component.databaseError).toBe('Respaldo inválido');
    expect(component.databaseBusy).toBeFalse();
  });

  it('opens and closes sections independently', () => {
    const headers: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll(
      '.sidebar-navigation .p-panelmenu-header'
    );

    headers[0].click();
    fixture.detectChanges();
    expect(headers[0].getAttribute('aria-expanded')).toBe('true');

    headers[1].click();
    fixture.detectChanges();
    expect(headers[0].getAttribute('aria-expanded')).toBe('true');
    expect(headers[1].getAttribute('aria-expanded')).toBe('true');

    headers[0].click();
    fixture.detectChanges();
    expect(headers[0].getAttribute('aria-expanded')).toBe('false');
    expect(headers[1].getAttribute('aria-expanded')).toBe('true');
  });
});
