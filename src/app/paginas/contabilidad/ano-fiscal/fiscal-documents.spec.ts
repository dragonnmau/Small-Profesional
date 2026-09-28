import { TestBed } from '@angular/core/testing';
import { Db, FiscalDocument } from '../../../services/db';
import { FiscalDocuments } from './fiscal-documents';

describe('Comprobantes del mes fiscal', () => {
  const saved: FiscalDocument[] = [{ kind: 'declaration', name: 'declaracion.pdf', size: 10 }];
  let db: jasmine.SpyObj<Db>;
  beforeEach(() => {
    db = jasmine.createSpyObj('Db', ['listFiscalDocuments', 'saveFiscalDocument', 'getFiscalDocument', 'deleteFiscalDocument']);
    db.listFiscalDocuments.and.returnValue(saved);
    db.saveFiscalDocument.and.returnValue(saved);
    db.getFiscalDocument.and.returnValue({ name: 'declaracion.pdf', type: 'application/pdf', data: btoa('%PDF-1.4') });
    db.deleteFiscalDocument.and.returnValue([]);
    TestBed.configureTestingModule({ imports: [FiscalDocuments], providers: [{ provide: Db, useValue: db }] });
  });
  const setup = () => {
    const fixture = TestBed.createComponent(FiscalDocuments);
    fixture.componentRef.setInput('year', 2026); fixture.componentRef.setInput('month', 9); fixture.detectChanges();
    return fixture;
  };
  const eventFor = (file: File) => ({ target: { files: [file], value: '' } } as unknown as Event);
  it('muestra dos espacios compactos en una sección cerrada y carga por periodo al abrir', () => {
    const fixture = setup();
    const details = fixture.nativeElement.querySelector('details');
    expect(details.open).toBeFalse();
    expect(db.listFiscalDocuments).not.toHaveBeenCalled();
    details.open = true; details.dispatchEvent(new Event('toggle')); fixture.detectChanges();
    expect(db.listFiscalDocuments).toHaveBeenCalledWith(2026, 9);
    expect(fixture.nativeElement.querySelectorAll('.documents-grid section').length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('declaracion.pdf');
  });
  it('guarda únicamente PDF y mantiene el archivo anterior cuando falla una carga', async () => {
    const component = setup().componentInstance;
    component.load();
    await component.upload(eventFor(new File(['imagen'], 'foto.jpg')), 'declaration');
    expect(db.saveFiscalDocument).not.toHaveBeenCalled();
    await component.upload(eventFor(new File(['%PDF-1.4'], 'pago.pdf')), 'payment');
    expect(db.saveFiscalDocument).toHaveBeenCalledWith(2026, 9, 'payment', { name: 'pago.pdf', type: 'application/pdf', data: btoa('%PDF-1.4') });
    db.saveFiscalDocument.and.throwError('Error al guardar');
    await component.upload(eventFor(new File(['%PDF-1.4'], 'nuevo.pdf')), 'declaration');
    expect(component.error).toBe('Error al guardar');
    expect(component.files).toEqual(saved);
    expect(component.busy).toBeFalse();
  });
  it('previsualiza, permite cancelar el borrado y elimina solo al confirmar', () => {
    const fixture = setup(); const component = fixture.componentInstance;
    const revoke = spyOn(URL, 'revokeObjectURL').and.callThrough();
    component.load(); component.preview(saved[0]); fixture.detectChanges();
    const url = component.previewUrl;
    expect(fixture.nativeElement.querySelector('iframe').getAttribute('src')).toBe(url);
    expect(fixture.nativeElement.querySelector('dialog').open).toBeTrue();
    component.remove(); expect(db.deleteFiscalDocument).not.toHaveBeenCalled();
    fixture.nativeElement.querySelector('.delete-action').click(); fixture.detectChanges();
    fixture.nativeElement.querySelector('.delete-confirmation button').click(); fixture.detectChanges();
    expect(component.confirmingDelete).toBeFalse();
    expect(db.deleteFiscalDocument).not.toHaveBeenCalled();
    fixture.nativeElement.querySelector('.delete-action').click(); fixture.detectChanges();
    fixture.nativeElement.querySelector('.delete-confirmation .danger').click(); fixture.detectChanges();
    expect(db.deleteFiscalDocument).toHaveBeenCalledOnceWith(2026, 9, 'declaration');
    expect(component.files).toEqual([]);
    expect(revoke).toHaveBeenCalledWith(url);
    expect(fixture.nativeElement.querySelector('dialog').open).toBeFalse();
  });
  it('conserva el visor y el comprobante si falla el borrado', () => {
    const fixture = setup(); const component = fixture.componentInstance;
    component.load(); component.preview(saved[0]); component.confirmingDelete = true;
    db.deleteFiscalDocument.and.throwError('No se pudo borrar');
    component.remove(); fixture.detectChanges();
    expect(component.files).toEqual(saved);
    expect(fixture.nativeElement.querySelector('dialog').open).toBeTrue();
    expect(fixture.nativeElement.querySelector('.delete-confirmation [role="alert"]').textContent).toBe('No se pudo borrar');
  });
});
