import { Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, ViewChild, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Db, FiscalDocument, FiscalDocumentKind } from '../../../services/db';

@Component({
  selector: 'app-fiscal-documents',
  templateUrl: './fiscal-documents.html',
  styleUrl: './fiscal-documents.scss'
})
export class FiscalDocuments implements OnChanges, OnDestroy {
  @Input({ required: true }) year!: number;
  @Input({ required: true }) month!: number;
  @Output() busyChange = new EventEmitter<boolean>();
  @ViewChild('viewer') private viewer?: ElementRef<HTMLDialogElement>;
  private readonly sanitizer = inject(DomSanitizer);
  readonly sections: { kind: FiscalDocumentKind; label: string }[] = [
    { kind: 'declaration', label: 'Comprobante de declaración' }, { kind: 'payment', label: 'Comprobante de pago' }
  ];
  files: FiscalDocument[] = [];
  busy = false;
  error = '';
  success = '';
  previewFile: FiscalDocument | null = null;
  previewUrl = '';
  pdfUrl: SafeResourceUrl | null = null;
  confirmingDelete = false;
  viewerError = '';
  private loaded = false;
  private generation = 0;
  constructor(private readonly db: Db) {}
  ngOnChanges(): void { this.generation++; this.closePreview(); this.files = []; this.loaded = false; this.error = ''; this.success = ''; }
  ngOnDestroy(): void { this.generation++; this.closePreview(); }
  toggle(event: Event): void { if ((event.target as HTMLDetailsElement).open) this.load(); }
  load(): void {
    if (this.loaded) return;
    this.error = '';
    try { this.files = this.db.listFiscalDocuments(this.year, this.month); this.loaded = true; }
    catch (error) { this.error = this.message(error); }
  }
  fileFor(kind: FiscalDocumentKind): FiscalDocument | undefined { return this.files.find(file => file.kind === kind); }
  async upload(event: Event, kind: FiscalDocumentKind): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || this.busy) return;
    this.error = ''; this.success = '';
    if (!/\.pdf$/i.test(file.name) || !file.size || file.size > 5 * 1024 * 1024 || file.name.length > 200) {
      this.error = 'Selecciona un PDF no vacío de máximo 5 MB.'; input.value = ''; return;
    }
    const generation = this.generation;
    const year = this.year, month = this.month;
    this.busy = true; this.busyChange.emit(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = reader.onabort = () => reject(new Error('No se pudo leer el comprobante.'));
        reader.readAsDataURL(file);
      });
      if (generation !== this.generation) return;
      this.files = this.db.saveFiscalDocument(year, month, kind, { name: file.name, type: 'application/pdf', data });
      this.loaded = true; this.success = 'Comprobante guardado.';
    } catch (error) { if (generation === this.generation) this.error = this.message(error); }
    finally { input.value = ''; this.busy = false; if (generation === this.generation) this.busyChange.emit(false); }
  }
  preview(file: FiscalDocument): void {
    this.closePreview(); this.error = '';
    try {
      const attachment = this.db.getFiscalDocument(this.year, this.month, file.kind);
      const bytes = Uint8Array.from(atob(attachment.data), char => char.charCodeAt(0));
      this.previewUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      // Only a PDF blob generated locally is used as an embedded resource.
      this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.previewUrl);
      this.previewFile = file;
      this.viewer?.nativeElement.showModal();
    } catch (error) { this.closePreview(); this.error = this.message(error); }
  }
  closePreview(): void {
    this.viewer?.nativeElement.close();
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewFile = null; this.previewUrl = ''; this.pdfUrl = null; this.confirmingDelete = false; this.viewerError = '';
  }
  remove(): void {
    if (!this.previewFile || !this.confirmingDelete || this.busy) return;
    this.viewerError = ''; this.success = '';
    try {
      this.files = this.db.deleteFiscalDocument(this.year, this.month, this.previewFile.kind);
      this.closePreview(); this.success = 'Comprobante eliminado.';
    } catch (error) { this.viewerError = this.message(error); }
  }
  private message(error: unknown): string { return error instanceof Error ? error.message : 'No se pudo completar la operación.'; }
}
