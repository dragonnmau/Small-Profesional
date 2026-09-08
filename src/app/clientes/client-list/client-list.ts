import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Db, DbLinkedCompany, NewDbClient, TaxRegime } from '../../services/db';

type ClientKind = 'Cliente' | 'Empresa';
type ClientStatus = 'Activo' | 'Baja';
interface Client { id: number; kind: ClientKind; name: string; businessName: string; rfc: string; taxRegime: string; address: string; postalCode: string; contact: string; phone: string; email: string; status: ClientStatus; }
interface ClientForm extends Omit<Client, 'id' | 'kind' | 'status'> {}
interface CompanyForm { name: string; businessName: string; contact: string; phone: string; email: string; }

const initialClients: NewDbClient[] = [];

@Component({ selector: 'app-client-list', imports: [CommonModule, FormsModule], templateUrl: './client-list.html', styleUrl: './client-list.scss' })
export class ClientList {
  clients: Client[] = [];
  taxRegimes:TaxRegime[] = [];
  search = '';
  isFormOpen = false;
  editingClientId: number | null = null;
  formKind: ClientKind = 'Cliente';
  clientForm: ClientForm = this.emptyForm();
  linkedCompanies: DbLinkedCompany[] = [];
  isCompanyFormOpen = false;
  editingCompanyId: number | null = null;
  isLinkedCompaniesOpen = false;
  selectedClient: Client | null = null;
  companyForm: CompanyForm = this.emptyCompanyForm();
  private nextId = 4;

  constructor(private readonly dbService: Db) {
    this.loadClients();
    this.loadLinkedCompanies();
    this.taxRegimes = this.dbService.listTaxRegimes();

    console.log('Initial clients loaded:', this.clients);
    console.log('Initial tax regimes loaded:', this.taxRegimes);
  }

  loadtaxRegimes(): void {
    this.taxRegimes = this.dbService.listTaxRegimes();
    console.log('Initial tax regimes loaded:', this.taxRegimes);
  }

  get filteredClients(): Client[] {
    const term = this.search.trim().toLocaleLowerCase();
    return !term ? this.clients : this.clients.filter(client => [client.name, client.businessName, client.contact, client.email, client.status].some(value => value.toLocaleLowerCase().includes(term)));
  }
  get activeClients(): number { return this.clients.filter(client => client.status === 'Activo').length; }
  openNew(kind: ClientKind): void { this.editingClientId = null; this.formKind = kind; this.clientForm = this.emptyForm(); this.isFormOpen = true; this.loadtaxRegimes(); }
  openEdit(client: Client): void { this.editingClientId = client.id; this.formKind = client.kind; const { id, kind, status, ...form } = client; this.clientForm = { ...form }; this.isFormOpen = true; }
  closeForm(): void { this.isFormOpen = false; }
  openCompanyForm(client: Client): void { this.selectedClient = client; this.editingCompanyId = null; this.companyForm = this.emptyCompanyForm(); this.isCompanyFormOpen = true; }
  openCompanyEdit(company: DbLinkedCompany): void { this.editingCompanyId = company.id; this.companyForm = { name: company.name, businessName: company.businessName, contact: company.contact, phone: company.phone, email: company.email }; this.isLinkedCompaniesOpen = false; this.isCompanyFormOpen = true; }
  closeCompanyForm(): void { this.isCompanyFormOpen = false; this.editingCompanyId = null; this.selectedClient = null; }
  openLinkedCompanies(client: Client): void { this.selectedClient = client; this.isLinkedCompaniesOpen = true; }
  closeLinkedCompanies(): void { this.isLinkedCompaniesOpen = false; this.selectedClient = null; }
  addLinkedCompany(): void {
    const client = this.selectedClient;
    this.closeLinkedCompanies();
    if (client) this.openCompanyForm(client);
  }
  companiesFor(clientId: number): DbLinkedCompany[] { return this.linkedCompanies.filter(company => company.clientId === clientId); }
  saveClient(): void {
    if (!this.clientForm.name.trim()) return;
    const values = { ...this.clientForm, name: this.clientForm.name.trim() };
    if (this.editingClientId === null) {
      this.dbService.createClient({ ...values, kind: this.formKind, status: 'Activo' });
    } else {
      const currentClient = this.clients.find(client => client.id === this.editingClientId);
      if (currentClient) this.dbService.updateClient(this.editingClientId, { ...values, kind: this.formKind, status: currentClient.status });
    }
    this.loadClients();
    this.closeForm();
  }
  toggleStatus(client: Client): void {
    const isActive = client.status === 'Activo';
    const action = isActive ? 'dar de baja' : 'reactivar';
    if (confirm(`¿Deseas ${action} a ${client.name}? El registro se conservará en la lista.`)) {
      this.dbService.updateClientStatus(client.id, isActive ? 'Baja' : 'Activo');
      this.loadClients();
    }
  }
  saveCompany(): void {
    if (!this.selectedClient || !this.companyForm.name.trim()) return;
    const company = { ...this.companyForm, name: this.companyForm.name.trim(), clientId: this.selectedClient.id };
    if (this.editingCompanyId === null) this.dbService.createLinkedCompany(company);
    else this.dbService.updateLinkedCompany(this.editingCompanyId, company);
    this.loadLinkedCompanies();
    this.closeCompanyForm();
  }
  private loadClients(): void {
    let clients = this.dbService.listClients();
    if (!clients.length) {
      initialClients.forEach(client => this.dbService.createClient(client));
      clients = this.dbService.listClients();
    }
    this.clients = clients;
  }
  private loadLinkedCompanies(): void { this.linkedCompanies = this.dbService.listLinkedCompanies(); }
  private emptyForm(): ClientForm { return { name: '', businessName: '', rfc: '', taxRegime: '', address: '', postalCode: '', contact: '', phone: '', email: '' }; }
  private emptyCompanyForm(): CompanyForm { return { name: '', businessName: '', contact: '', phone: '', email: '' }; }
}
