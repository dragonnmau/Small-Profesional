import { Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, ViewChild, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Db, ExpenseAttachment, ServiceEvidence, ServiceEvidenceKind } from '../../services/db';
import catalog from '../../services/service-evidence-catalog.json';

@Component({
  selector: 'app-service-evidence',
  templateUrl: './service-evidence.html',
  styleUrl: './service-evidence.scss'
})
export class ServiceEvidencePanel implements OnChanges, OnDestroy {
  @Input({ required: true }) serviceId!: number;
  @Output() busyChange = new EventEmitter<boolean>();
  readonly sections = (Object.keys(catalog) as ServiceEvidenceKind[]).map(kind => ({
    kind, ...catalog[kind], accept: catalog[kind].extensions.map(extension => `.${extension}`).join(',')
  }));
  files: ServiceEvidence[] = [];
  busy = false;
  error = '';
  success = '';
  @ViewChild('previewDialog') private previewDialog?: ElementRef<HTMLDialogElement>;
  private readonly sanitizer = inject(DomSanitizer);
  previewFile: ServiceEvidence | null = null;
  previewUrl = '';
  previewPdf: SafeResourceUrl | null = null;
  previewKind: 'image' | 'pdf' | 'text' | 'unsupported' = 'unsupported';
  previewText = '';
  confirmingDelete = false;
  deleteError = '';
  private loaded = false;
  private generation = 0;
  constructor(private readonly db: Db) {}
  ngOnChanges(): void { this.closePreview(); this.generation++; this.files = []; this.loaded = false; this.error = ''; this.success = ''; }
  ngOnDestroy(): void { this.closePreview(); this.generation++; }
  load(): void {
    if (this.loaded) return;
    this.error = '';
    try { this.files = this.db.listServiceEvidence(this.serviceId); this.loaded = true; }
    catch (error) { this.error = this.message(error); }
  }
  toggle(event: Event): void { if ((event.target as HTMLDetailsElement).open) this.load(); }
  filesFor(kind: ServiceEvidenceKind): ServiceEvidence[] { return this.files.filter(file => file.kind === kind); }
  async upload(event: Event, kind: ServiceEvidenceKind): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (!files.length || this.busy) return;
    this.error = ''; this.success = '';
    if (files.length > 10 || (kind === 'report' && files.length !== 1)) {
      this.error = 'Selecciona un reporte o hasta 10 archivos por carga.'; input.value = ''; return;
    }
    if (files.some(file => !catalog[kind].extensions.includes(file.name.split('.').pop()?.toLowerCase() || '') || !file.size || file.size > 5 * 1024 * 1024 || file.name.length > 200)) {
      this.error = 'Revisa el formato de los archivos. Cada archivo debe ser no vacío y de máximo 5 MB.'; input.value = ''; return;
    }
    const generation = this.generation;
    const serviceId = this.serviceId;
    this.busy = true; this.busyChange.emit(true);
    try {
      const attachments: ExpenseAttachment[] = [];
      for (const file of files) {
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1]);
          reader.onerror = reader.onabort = () => reject(new Error('No se pudo leer el archivo.'));
          reader.readAsDataURL(file);
        });
        if (generation !== this.generation) return;
        attachments.push({ name: file.name, type: file.type, data });
      }
      this.files = this.db.addServiceEvidence(serviceId, kind, attachments);
      this.loaded = true;
      this.success = files.length === 1 ? 'Archivo guardado.' : `${files.length} archivos guardados.`;
    } catch (error) { if (generation === this.generation) this.error = this.message(error); }
    finally { input.value = ''; this.busy = false; if (generation === this.generation) this.busyChange.emit(false); }
  }
  preview(file: ServiceEvidence): void {
    this.closePreview(); this.error = '';
    try {
      const attachment = this.db.getServiceEvidence(this.serviceId, file.id);
      const bytes = Uint8Array.from(atob(attachment.data), char => char.charCodeAt(0));
      const extension = attachment.name.split('.').pop()?.toLowerCase() || '';
      const imageTypes: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
      if (imageTypes[extension]) {
        this.previewKind = 'image';
        this.previewUrl = URL.createObjectURL(new Blob([bytes], { type: imageTypes[extension] }));
      } else if (extension === 'pdf') {
        this.previewKind = 'pdf';
        this.previewUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        // Trust only the PDF blob created here, never a URL supplied by the attachment.
        this.previewPdf = this.sanitizer.bypassSecurityTrustResourceUrl(this.previewUrl);
      } else if (['txt', 'csv', 'xml'].includes(extension)) {
        this.previewKind = 'text'; this.previewText = new TextDecoder().decode(bytes);
      }
      this.previewFile = file;
      this.previewDialog?.nativeElement.showModal();
    } catch (error) { this.closePreview(); this.error = this.message(error); }
  }
  closePreview(): void {
    this.confirmingDelete = false; this.deleteError = '';
    this.previewDialog?.nativeElement.close();
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewFile = null; this.previewUrl = ''; this.previewPdf = null; this.previewText = ''; this.previewKind = 'unsupported';
  }
  deleteEvidence(): void {
    if (!this.previewFile || !this.confirmingDelete || this.busy) return;
    this.deleteError = ''; this.success = '';
    try {
      this.files = this.db.deleteServiceEvidence(this.serviceId, this.previewFile.id);
      this.error = ''; this.closePreview();
      this.success = 'Evidencia eliminada correctamente.';
    } catch (error) { this.deleteError = this.message(error); }
  }
  download(file: ServiceEvidence): void {
    this.error = '';
    try {
      const attachment = this.db.getServiceEvidence(this.serviceId, file.id);
      const bytes = Uint8Array.from(atob(attachment.data), char => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: attachment.type }));
      const link = document.createElement('a'); link.href = url; link.download = attachment.name;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { this.error = this.message(error); }
  }
  private message(error: unknown): string { return error instanceof Error ? error.message : 'No se pudo completar la operación.'; }
}
