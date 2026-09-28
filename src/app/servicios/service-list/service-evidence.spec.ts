import { TestBed } from '@angular/core/testing';
import { Db, ServiceEvidence } from '../../services/db';
import { ServiceEvidencePanel } from './service-evidence';

describe('Evidencias de servicio', () => {
  const saved: ServiceEvidence[] = [{ id: 1, kind: 'report', name: 'reporte.pdf', type: 'application/pdf', size: 10 }];
  let db: jasmine.SpyObj<Db>;
  beforeEach(() => {
    db = jasmine.createSpyObj('Db', ['listServiceEvidence', 'addServiceEvidence', 'getServiceEvidence', 'deleteServiceEvidence']);
    db.listServiceEvidence.and.returnValue(saved);
    db.addServiceEvidence.and.returnValue(saved);
    TestBed.configureTestingModule({ imports: [ServiceEvidencePanel], providers: [{ provide: Db, useValue: db }] });
  });
  const setup = () => {
    const fixture = TestBed.createComponent(ServiceEvidencePanel);
    fixture.componentRef.setInput('serviceId', 4);
    fixture.detectChanges();
    return fixture;
  };
  const selection = (files: File[]) => ({ target: { files, value: '' } } as unknown as Event);

  it('inicia cerrado, carga solo al abrir y muestra tres secciones compactas', () => {
    const fixture = setup();
    const details = fixture.nativeElement.querySelector('details') as HTMLDetailsElement;
    expect(details.open).toBeFalse();
    expect(db.listServiceEvidence).not.toHaveBeenCalled();
    details.open = true; details.dispatchEvent(new Event('toggle')); fixture.detectChanges();
    expect(db.listServiceEvidence).toHaveBeenCalledWith(4);
    expect(fixture.nativeElement.querySelectorAll('.evidence-grid section').length).toBe(3);
    expect(fixture.nativeElement.textContent).toContain('reporte.pdf');
    expect(fixture.nativeElement.textContent).toContain('Reemplazar PDF');
  });
  it('guarda varias fotos con el servicio correcto y señala el fin de la carga', async () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    const busy = spyOn(component.busyChange, 'emit');
    await component.upload(selection([new File(['foto 1'], 'uno.jpg'), new File(['foto 2'], 'dos.png')]), 'photos');
    expect(db.addServiceEvidence).toHaveBeenCalledWith(4, 'photos', [
      { name: 'uno.jpg', type: '', data: btoa('foto 1') }, { name: 'dos.png', type: '', data: btoa('foto 2') }
    ]);
    expect(busy.calls.allArgs()).toEqual([[true], [false]]);
    expect(component.success).toBe('2 archivos guardados.');
  });
  it('rechaza formatos cruzados y conserva archivos previos si falla el guardado', async () => {
    const component = setup().componentInstance;
    component.load();
    await component.upload(selection([new File(['foto'], 'foto.jpg')]), 'report');
    expect(db.addServiceEvidence).not.toHaveBeenCalled();
    expect(component.error).toContain('formato');
    db.addServiceEvidence.and.throwError('No se pudo guardar');
    await component.upload(selection([new File(['PDF'], 'nuevo.pdf')]), 'report');
    expect(component.files).toEqual(saved);
    expect(component.error).toBe('No se pudo guardar');
    expect(component.busy).toBeFalse();
  });
  it('abre el visor PDF y libera su archivo al cerrarlo', () => {
    const fixture = setup();
    db.getServiceEvidence.and.returnValue({ name: 'reporte.pdf', type: 'application/pdf', data: btoa('%PDF-1.4') });
    const revoke = spyOn(URL, 'revokeObjectURL').and.callThrough();
    fixture.componentInstance.preview(saved[0]); fixture.detectChanges();
    const url = fixture.componentInstance.previewUrl;
    expect(db.getServiceEvidence).toHaveBeenCalledWith(4, 1);
    expect(fixture.nativeElement.querySelector('dialog').open).toBeTrue();
    expect(fixture.nativeElement.querySelector('iframe').getAttribute('src')).toBe(url);
    fixture.componentInstance.closePreview(); fixture.detectChanges();
    expect(revoke).toHaveBeenCalledWith(url);
    expect(fixture.nativeElement.querySelector('dialog').open).toBeFalse();
  });
  it('previsualiza imágenes y muestra XML como texto sin ejecutar contenido', () => {
    const fixture = setup();
    const file = { ...saved[0], name: 'foto.png' };
    db.getServiceEvidence.and.returnValue({ name: file.name, type: 'image/png', data: btoa('imagen') });
    fixture.componentInstance.preview(file); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img').alt).toBe(file.name);
    const xml = '<documento><script>alert(1)</script></documento>';
    db.getServiceEvidence.and.returnValue({ name: 'extra.xml', type: 'application/xml', data: btoa(xml) });
    fixture.componentInstance.preview({ ...file, name: 'extra.xml' }); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('pre').textContent).toBe(xml);
    expect(fixture.nativeElement.querySelector('script')).toBeNull();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
  });
  it('ofrece descarga para documentos sin visor y maneja errores de lectura', () => {
    const fixture = setup();
    db.getServiceEvidence.and.returnValue({ name: 'extra.docx', type: '', data: btoa('documento') });
    fixture.componentInstance.preview({ ...saved[0], name: 'extra.docx' }); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.unsupported').textContent).toContain('Descarga');
    db.getServiceEvidence.and.throwError('Archivo no encontrado');
    fixture.componentInstance.preview(saved[0]); fixture.detectChanges();
    expect(fixture.componentInstance.error).toBe('Archivo no encontrado');
    expect(fixture.nativeElement.querySelector('dialog').open).toBeFalse();
  });
  it('exige confirmar el borrado, permite cancelar y actualiza la lista al borrar', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    db.getServiceEvidence.and.returnValue({ name: 'reporte.pdf', type: 'application/pdf', data: btoa('%PDF-1.4') });
    db.deleteServiceEvidence.and.returnValue([]);
    component.load(); component.preview(saved[0]); fixture.detectChanges();
    component.deleteEvidence();
    expect(db.deleteServiceEvidence).not.toHaveBeenCalled();
    fixture.nativeElement.querySelector('.delete-action').click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.delete-confirmation').textContent).toContain('reporte.pdf');
    expect(db.deleteServiceEvidence).not.toHaveBeenCalled();
    fixture.nativeElement.querySelector('.delete-confirmation button').click(); fixture.detectChanges();
    expect(component.confirmingDelete).toBeFalse();
    expect(component.files).toEqual(saved);
    fixture.nativeElement.querySelector('.delete-action').click(); fixture.detectChanges();
    fixture.nativeElement.querySelector('.delete-confirmation .danger-button').click(); fixture.detectChanges();
    expect(db.deleteServiceEvidence).toHaveBeenCalledOnceWith(4, 1);
    expect(component.files).toEqual([]);
    expect(fixture.nativeElement.querySelector('dialog').open).toBeFalse();
    expect(component.success).toContain('eliminada');
  });
  it('mantiene el visor y el archivo cuando falla el borrado', () => {
    const fixture = setup();
    const component = fixture.componentInstance;
    db.getServiceEvidence.and.returnValue({ name: 'reporte.pdf', type: 'application/pdf', data: btoa('%PDF-1.4') });
    db.deleteServiceEvidence.and.throwError('No se pudo borrar');
    component.load(); component.preview(saved[0]); component.confirmingDelete = true;
    component.deleteEvidence(); fixture.detectChanges();
    expect(component.files).toEqual(saved);
    expect(fixture.nativeElement.querySelector('dialog').open).toBeTrue();
    expect(fixture.nativeElement.querySelector('.delete-confirmation [role="alert"]').textContent).toBe('No se pudo borrar');
  });
});
