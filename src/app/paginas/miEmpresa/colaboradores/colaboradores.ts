import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CollaboratorRole, Db, DbAccountInformation, DbCollaborator, NewDbCollaborator } from '../../../services/db';

interface CollaboratorForm extends Omit<NewDbCollaborator, 'image'> { image: string; }

@Component({
  selector: 'app-colaboradores',
  imports: [CommonModule, FormsModule],
  templateUrl: './colaboradores.html',
  styleUrl: './colaboradores.scss'
})
export class Colaboradores implements OnInit {
  accountInformation: DbAccountInformation | null = null;
  collaborators: DbCollaborator[] = [];
  selected: DbCollaborator | null = null;
  isModalOpen = false;
  editingId: number | null = null;
  errorMessage = '';
  readonly roles: CollaboratorRole[] = ['Admin', 'Contabilidad', 'Colaborador', 'Subcontratado'];
  form = this.emptyForm();

  constructor(private readonly dbService: Db) {}

  ngOnInit(): void {
    this.accountInformation = this.dbService.getAccountInformation();
    this.loadCollaborators();
  }

  get isAdmin(): boolean { return (this.accountInformation?.user.userType || 'admin') === 'admin'; }
  get activeCount(): number { return this.collaborators.filter(item => item.status === 'Activo').length; }

  openNew(): void { this.editingId = null; this.form = this.emptyForm(); this.errorMessage = ''; this.isModalOpen = true; }
  openEdit(collaborator: DbCollaborator): void { this.editingId = collaborator.id; this.form = { ...collaborator }; this.errorMessage = ''; this.isModalOpen = true; }
  closeModal(): void { this.isModalOpen = false; this.selected = null; }

  save(): void {
    if (!this.form.name.trim() || !this.form.email.trim() || !this.form.userType) { this.errorMessage = 'Completa nombre, correo y tipo de usuario.'; return; }
    const values: NewDbCollaborator = { ...this.form, name: this.form.name.trim(), email: this.form.email.trim(), rfc: this.form.rfc.trim().toUpperCase() };
    try {
      if (this.editingId === null) this.dbService.createCollaborator(values); else this.dbService.updateCollaborator(this.editingId, values);
      this.loadCollaborators(); this.closeModal();
    } catch (error) { this.errorMessage = error instanceof Error ? error.message : 'No se pudo guardar el colaborador.'; }
  }

  toggleStatus(collaborator: DbCollaborator): void {
    if (collaborator.id === 0) return;
    const status = collaborator.status === 'Activo' ? 'Baja' : 'Activo';
    if (!confirm(`¿Deseas ${status === 'Baja' ? 'dar de baja' : 'reactivar'} a ${collaborator.name}?`)) return;
    this.dbService.updateCollaboratorStatus(collaborator.id, status); this.loadCollaborators();
  }

  selectImage(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader(); reader.onload = () => this.form.image = String(reader.result ?? ''); reader.readAsDataURL(file);
  }

  private loadCollaborators(): void { this.collaborators = this.dbService.listCollaborators(); }
  private emptyForm(): CollaboratorForm { return { name: '', rfc: '', password: '', email: '', phone: '', extension: '', mobile: '', image: '', userType: 'Colaborador' }; }

}
