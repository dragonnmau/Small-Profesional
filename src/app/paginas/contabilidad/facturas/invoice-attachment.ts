import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ExpenseAttachment } from '../../../services/db';

@Component({
  selector: 'app-invoice-attachment',
  template: `
    <label>Archivo de factura (PDF o XML)
      <input type="file" accept=".pdf,.xml" [disabled]="reading || disabled" (change)="selectFile($event)">
      <small>Opcional · Máximo 5 MB. Selecciona otro archivo para reemplazarlo.</small>
    </label>
    @if (reading) { <p role="status">Leyendo archivo…</p> }
    @if (error) { <p class="error" role="alert">{{ error }}</p> }
    @if (file) {
      <div class="file-info"><strong>{{ file.name }}</strong>
        @if (url) { <a [href]="url" [download]="file.name">Descargar archivo</a> }
      </div>
      @if (pdfUrl) { <iframe [src]="pdfUrl" title="Vista previa de la factura PDF"></iframe> }
      @if (xml) { <pre aria-label="Vista previa de la factura XML">{{ xml }}</pre> }
    } @else { <p class="hint">Sin archivo adjunto.</p> }
  `,
  styles: `
    :host { display:grid; gap:.8rem; min-width:0; }
    label { display:grid; gap:.5rem; font-size:.85rem; font-weight:600; }
    input { width:100%; box-sizing:border-box; font:inherit; }
    small,.hint { color:var(--p-text-muted-color); font-size:.8rem; }
    .file-info { display:flex; flex-wrap:wrap; justify-content:space-between; gap:.6rem; font-size:.85rem; overflow-wrap:anywhere; }
    a { color:var(--p-primary-color); }
    iframe { width:100%; height:55vh; min-height:300px; border:1px solid var(--p-content-border-color); border-radius:6px; }
    pre { max-height:55vh; overflow:auto; margin:0; padding:1rem; background:var(--p-content-hover-background); white-space:pre-wrap; overflow-wrap:anywhere; font-size:.8rem; }
    .error { color:#dc2626; font-size:.85rem; }
  `
})
export class InvoiceAttachment implements OnChanges, OnDestroy {
  @Input() file: ExpenseAttachment | null = null;
  @Input() disabled = false;
  @Output() fileChange = new EventEmitter<ExpenseAttachment>();
  @Output() busyChange = new EventEmitter<boolean>();
  private readonly sanitizer = inject(DomSanitizer);
  private destroyed = false;
  reading = false;
  error = '';
  url = '';
  pdfUrl: SafeResourceUrl | null = null;
  xml = '';

  ngOnChanges(): void {
    this.clearPreview();
    if (!this.file) return;
    try {
      const bytes = Uint8Array.from(atob(this.file.data), char => char.charCodeAt(0));
      const pdf = /\.pdf$/i.test(this.file.name);
      this.url = URL.createObjectURL(new Blob([bytes], { type: pdf ? 'application/pdf' : 'application/xml' }));
      // Only a locally created PDF blob is trusted as an embedded resource.
      if (pdf) this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.url);
      else this.xml = new TextDecoder().decode(bytes);
    } catch { this.error = 'No se pudo previsualizar el archivo.'; }
  }
  private clearPreview(): void {
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = ''; this.pdfUrl = null; this.xml = '';
  }
  ngOnDestroy(): void { this.destroyed = true; this.clearPreview(); }
  async selectFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || this.reading || this.disabled) return;
    this.error = '';
    if (!/\.(pdf|xml)$/i.test(file.name) || !file.size || file.size > 5 * 1024 * 1024) {
      this.error = 'Selecciona un PDF o XML no vacío de máximo 5 MB.';
      input.value = ''; return;
    }
    this.reading = true; this.busyChange.emit(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
        reader.onabort = () => reject(new Error('Se canceló la lectura del archivo.'));
        reader.readAsDataURL(file);
      });
      if (!this.destroyed) this.fileChange.emit({ name: file.name, type: /\.pdf$/i.test(file.name) ? 'application/pdf' : 'application/xml', data });
    } catch { if (!this.destroyed) this.error = 'No se pudo leer el archivo.'; }
    finally { this.reading = false; input.value = ''; if (!this.destroyed) this.busyChange.emit(false); }
  }
}
