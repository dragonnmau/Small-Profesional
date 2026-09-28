import { TestBed } from '@angular/core/testing';
import { InvoiceAttachment } from './invoice-attachment';

describe('Vista previa del archivo de factura', () => {
  it('muestra XML como texto sin ejecutar su contenido y libera el archivo al cerrar', () => {
    const fixture = TestBed.createComponent(InvoiceAttachment);
    const revoke = spyOn(URL, 'revokeObjectURL').and.callThrough();
    const xml = '<Comprobante><script>alert(1)</script></Comprobante>';
    fixture.componentRef.setInput('file', { name: 'factura.xml', type: 'application/xml', data: btoa(xml) });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('pre').textContent).toBe(xml);
    expect(fixture.nativeElement.querySelector('script')).toBeNull();
    const url = fixture.componentInstance.url;
    fixture.destroy();
    expect(revoke).toHaveBeenCalledWith(url);
  });

  it('previsualiza PDF y libera su URL al reemplazarlo por XML', () => {
    const fixture = TestBed.createComponent(InvoiceAttachment);
    const revoke = spyOn(URL, 'revokeObjectURL').and.callThrough();
    fixture.componentRef.setInput('file', { name: 'factura.pdf', type: 'application/pdf', data: btoa('%PDF-1.4') });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('iframe').getAttribute('src')).toMatch(/^blob:/);
    const url = fixture.componentInstance.url;
    fixture.componentRef.setInput('file', { name: 'factura.xml', type: 'application/xml', data: btoa('<Comprobante/>') });
    fixture.detectChanges();
    expect(revoke).toHaveBeenCalledWith(url);
    expect(fixture.nativeElement.querySelector('iframe')).toBeNull();
    fixture.destroy();
  });

  it('lee el archivo seleccionado y rechaza formatos no permitidos', async () => {
    const fixture = TestBed.createComponent(InvoiceAttachment);
    const component = fixture.componentInstance;
    const emit = spyOn(component.fileChange, 'emit');
    const select = (file: File) => component.selectFile({ target: { files: [file], value: '' } } as unknown as Event);
    await select(new File(['<Comprobante/>'], 'factura.xml'));
    expect(emit).toHaveBeenCalledWith({ name: 'factura.xml', type: 'application/xml', data: btoa('<Comprobante/>') });
    emit.calls.reset();
    await select(new File(['contenido'], 'archivo.html'));
    expect(emit).not.toHaveBeenCalled();
    expect(component.error).toContain('PDF o XML');
    expect(component.reading).toBeFalse();
    fixture.destroy();
  });
});
