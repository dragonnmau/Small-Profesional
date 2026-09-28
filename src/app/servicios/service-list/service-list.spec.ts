import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ServiceList } from './service-list';
import { DbService } from '../../services/db';

describe('ServiceList', () => {
  let component: ServiceList;
  let fixture: ComponentFixture<ServiceList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ServiceList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ServiceList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
  it('muestra el comentario solo en edición y lo coloca después de la descripción', async () => {
    component.openForm(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[name="internalComment"]')).toBeNull();
    component.openEditForm({ ...component.serviceForm, id: 1, clientId: 1, client: 'Cliente', company: '', assignedUserName: '', internalComment: 'Nota privada' } as DbService);
    fixture.detectChanges(); await fixture.whenStable();
    const field = fixture.nativeElement.querySelector('[name="internalComment"]');
    expect(field.value).toBe('Nota privada');
    expect(field.closest('label').previousElementSibling.querySelector('[name="description"]')).not.toBeNull();
    component.closeForm(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Nota privada');
    component.openForm(); expect(component.serviceForm.internalComment).toBeUndefined();
  });
  it('incluye evidencias solo al editar y bloquea el cierre durante una carga', () => {
    component.openForm(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-service-evidence')).toBeNull();
    component.openEditForm({ ...component.serviceForm, id: 1, clientId: 1, client: 'Cliente', company: '', assignedUserName: '' } as DbService);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-service-evidence details').open).toBeFalse();
    component.uploadingEvidence = true; component.closeForm();
    expect(component.isFormOpen).toBeTrue();
    component.uploadingEvidence = false; component.closeForm();
    expect(component.isFormOpen).toBeFalse();
  });
});
