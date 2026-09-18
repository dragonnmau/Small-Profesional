import { Injectable } from '@angular/core';
import expenseCatalogs from './expense-catalogs.json';

export interface DbClient {
  id: number;
  kind: 'Cliente' | 'Empresa';
  name: string;
  businessName: string;
  rfc: string;
  personType: 'Fisica' | 'Moral' | null;
  taxRegime: string;
  address: string;
  postalCode: string;
  contact: string;
  phone: string;
  email: string;
  status: 'Activo' | 'Baja';
}

export type NewDbClient = Omit<DbClient, 'id'>;

export interface DbLinkedCompany {
  id: number;
  clientId: number;
  name: string;
  businessName: string;
  contact: string;
  phone: string;
  email: string;
}

export type NewDbLinkedCompany = Omit<DbLinkedCompany, 'id'>;

export interface TaxRegime {
  id: number;
  satCode: string;
  name: string;
  personType: string;
}

export interface TaxSettings {
  ivaRate: number;
  isrRate: number;
}

export type UserType = 'admin' | 'contabilidad';
export type CollaboratorRole = 'Admin' | 'Contabilidad' | 'Colaborador' | 'Subcontratado';

export interface DbCollaborator {
  id: number;
  name: string;
  rfc: string;
  password: string;
  email: string;
  phone: string;
  extension: string;
  mobile: string;
  image: string;
  userType: CollaboratorRole;
  status: 'Activo' | 'Baja';
}

export type NewDbCollaborator = Omit<DbCollaborator, 'id' | 'status'>;

export interface DbBankCard {
  availableCredit?: number | null;
  creditAdjustment?: number;
  creditLimit: number | null;
  id: number;
  accountId: number;
  cardType: 'Debito' | 'Credito';
  lastFour: string;
  holderName: string;
  status: 'Activa' | 'Bloqueada';
}

export interface DbBankMovement {
  id: number;
  accountId: number;
  cardId: number | null;
  type: 'Ingreso' | 'Egreso';
  description: string;
  amount: number;
  balanceAfter: number;
  createdBy: string;
  createdAt: string;
}

export interface DbBankAccount {
  id: number;
  name: string;
  bank: string;
  accountNumber: string;
  balance: number;
  balanceUpdatedBy: string;
  balanceUpdatedAt: string;
  status: 'Activa' | 'Baja';
  cards: DbBankCard[];
  movements: DbBankMovement[];
}

export type NewDbBankAccount = Pick<DbBankAccount, 'name' | 'bank' | 'accountNumber'> & { initialBalance: number; createdBy: string };
export type NewDbBankCard = Pick<DbBankCard, 'accountId' | 'cardType' | 'lastFour' | 'holderName' | 'creditLimit'>;
export type NewDbBankMovement = Pick<DbBankMovement, 'accountId' | 'cardId' | 'type' | 'description' | 'amount' | 'createdBy'>;

export interface DbAccountInformation {
  business: {
    commercialName: string;
    personType: 'Fisica' | 'Moral';
    companyRfc: string;
    address: string;
    image: string;
  };
  user: {
    name: string;
    rfc: string;
    password: string;
    email: string;
    phone: string;
    extension: string;
    mobile: string;
    image: string;
    userType: UserType;
  };
}

export interface DbServiceMaterial {
  name: string;
  cost: number;
}

export interface DbService {
  id: number;
  date: string;
  time: string;
  clientId: number;
  client: string;
  companyId: number | null;
  company: string;
  city: string;
  site: string;
  description: string;
  folio: string;
  status: string;
  servicePaid: string;
  serviceCost: number;
  travelAllowance: number;
  travelDeposit: string;
  materialsCost: number;
  transportCost: number;
  gasolineCost: number;
  materials: DbServiceMaterial[];
  assignedUserId: number | null;
  assignedUserName: string;
}

export interface ExpenseAttachment { name: string; type: string; data: string; }
export interface NewDbExpense {
  cardId?: number | null;
  category: string; cfdiUse: string; billingMonth: string;
  accountId: number; expenseDate: string; concept: string; amount: number;
  ivaMode: 'none' | 'added' | 'included'; hasInvoice: boolean;
  ticket: ExpenseAttachment | null; invoice: ExpenseAttachment | null; createdBy: string;
}
export interface DbExpense extends Omit<NewDbExpense, 'amount' | 'ticket' | 'invoice'> {
  cardType: string | null; cardLastFour: string | null;
  id: number; accountName: string; bank: string; ivaRate: number;
  subtotal: number; iva: number; total: number; ticketName: string | null; invoiceName: string | null; createdAt: string;
}

export interface DbPaymentClient { id: number; name: string; businessName: string; rfc: string; }
export interface DbPaymentService { id: number; date: string; time: string; clientId: number; companyId: number | null; company: string; site: string; description: string; folio: string; status: string; amount: number; }
export interface DbPayment { cardId?: number | null; cardType?: string | null; cardLastFour?: string | null; id: number; clientId: number; client: string; accountId: number; accountName: string; bank: string; paymentDate: string; invoiceNumber: string; invoiceId: number | null; invoiceFolio: string | null; folio: string; amount: number; status: 'Activo' | 'Revertido'; createdBy: string; createdAt: string; revertedBy: string | null; revertedAt: string | null; }
export interface DbPaidService { id: number; folio: string; description: string; date: string; site: string; company: string; amount: number; }
export interface NewDbPayment { cardId?: number | null; clientId: number; accountId: number; paymentDate: string; serviceIds: number[]; createdBy: string; }
export interface NewDbInvoice { clientId: number; invoiceDate: string; ivaMode: 'added' | 'included'; paymentIds: number[]; createdBy: string; note?: string; }
export interface DbInvoice extends Omit<NewDbInvoice, 'paymentIds'> {
  id: number; folio: string; client: string; rfc: string; ivaRate: number;
  subtotal: number; iva: number; ivaWithheld: number; personType: 'Fisica' | 'Moral' | null; total: number; createdAt: string;
  payments: Array<Pick<DbPayment, 'id' | 'folio' | 'paymentDate' | 'amount'>>;
}

export type NewDbService = Omit<DbService, 'id' | 'client' | 'company' | 'materialsCost' | 'assignedUserName'>;

export interface ServiceExportOptions {
  month: string;
  clientId: number | null;
  companyId: number | null;
  fields: string[];
}

interface ElectronWindow extends Window {
  electronDb?: ElectronDbBridge;
}

interface ElectronDbBridge {
  exportPendingServices(options: { clientId: number; serviceIds: number[]; format: 'pdf' | 'xlsx' }): Promise<{ value?: string | null; error?: string }>;
  sendSync<T>(channel: string, payload?: unknown): T;
}

@Injectable({ providedIn: 'root' })
export class Db {
  private readonly ipcRenderer = (window as ElectronWindow).electronDb;
  private fallbackClients: DbClient[] = [];
  private fallbackLinkedCompanies: DbLinkedCompany[] = [];
  private fallbackTaxSettings: TaxSettings = { ivaRate: 16, isrRate: 30 };
  private fallbackServices: DbService[] = [];
  private fallbackAccountInformation: DbAccountInformation | null = null;
  private fallbackBankAccounts: DbBankAccount[] = [];
  private fallbackCollaborators: DbCollaborator[] = [];

  listCollaborators(): DbCollaborator[] {
    if (!this.ipcRenderer) return [...this.fallbackCollaborators];
    return this.request<DbCollaborator[]>('collaborators:list');
  }

  createCollaborator(collaborator: NewDbCollaborator): DbCollaborator {
    if (!this.ipcRenderer) {
      const created = { ...collaborator, id: Math.max(0, ...this.fallbackCollaborators.map(item => item.id)) + 1, status: 'Activo' as const };
      this.fallbackCollaborators = [created, ...this.fallbackCollaborators];
      return created;
    }
    return this.request<DbCollaborator>('collaborators:create', collaborator);
  }

  updateCollaborator(id: number, collaborator: NewDbCollaborator): DbCollaborator {
    if (!this.ipcRenderer) {
      const updated = { ...collaborator, id, status: this.fallbackCollaborators.find(item => item.id === id)?.status ?? 'Activo' as const };
      this.fallbackCollaborators = this.fallbackCollaborators.map(item => item.id === id ? updated : item);
      return updated;
    }
    return this.request<DbCollaborator>('collaborators:update', { id, collaborator });
  }

  updateCollaboratorStatus(id: number, status: DbCollaborator['status']): void {
    if (!this.ipcRenderer) { this.fallbackCollaborators = this.fallbackCollaborators.map(item => item.id === id ? { ...item, status } : item); return; }
    this.request<boolean>('collaborators:status', { id, status });
  }

  listBankAccounts(): DbBankAccount[] {
    if (!this.ipcRenderer) return this.fallbackBankAccounts.filter(account => account.status === 'Activa').map(account => ({ ...account, cards: account.cards.map(card => ({ ...card, availableCredit: card.cardType === 'Credito' && card.creditLimit !== null
      ? (Math.round(card.creditLimit * 100) - Math.max(0, Math.round((card.creditAdjustment ?? 0) * 100) + account.movements.filter(movement => movement.cardId === card.id).reduce((sum, movement) => sum + (movement.type === 'Egreso' ? 1 : -1) * Math.round(movement.amount * 100), 0))) / 100 : null })), movements: [...account.movements] }));
    return this.request<DbBankAccount[]>('bank-accounts:list');
  }

  deactivateBankAccount(accountId: number, updatedBy: string): void {
    if (!this.ipcRenderer) {
      this.fallbackBankAccounts = this.fallbackBankAccounts.map(account => account.id === accountId ? { ...account, status: 'Baja', balanceUpdatedBy: updatedBy } : account);
      return;
    }
    this.request<boolean>('bank-accounts:deactivate', { accountId, updatedBy });
  }

  updateBankAccount(id: number, account: Pick<DbBankAccount, 'name' | 'bank' | 'accountNumber'>): DbBankAccount {
    if (!this.ipcRenderer) {
      const existing = this.fallbackBankAccounts.find(item => item.id === id && item.status === 'Activa');
      if (!existing) throw new Error('Cuenta bancaria no encontrada.');
      Object.assign(existing, account); return existing;
    }
    const result = this.request<{ value: DbBankAccount; error?: string }>('bank-accounts:update', { id, account });
    if (result.error) throw new Error(result.error);
    return result.value;
  }

  updateBankCard(id: number, card: NewDbBankCard & { availableCredit?: number }): DbBankCard {
    if (!this.ipcRenderer) {
      const existing = this.fallbackBankAccounts.find(item => item.id === card.accountId && item.status === 'Activa')?.cards.find(item => item.id === id);
      if (!existing) throw new Error('Tarjeta no encontrada.');
      if (card.creditLimit !== null && (!Number.isFinite(card.creditLimit) || card.creditLimit <= 0 || card.creditLimit > 999999999.99 || Math.abs(card.creditLimit * 100 - Math.round(card.creditLimit * 100)) > 0.0001)) throw new Error('Ingresa un límite de crédito positivo con máximo dos decimales.');
      let adjustment = card.cardType === 'Credito' ? existing.creditAdjustment ?? 0 : 0;
      if (card.cardType === 'Credito' && card.availableCredit !== undefined) {
        const available = card.availableCredit;
        if (card.creditLimit === null || !Number.isFinite(available) || available > card.creditLimit || available < -999999999.99 || Math.abs(available * 100 - Math.round(available * 100)) > 0.0001) throw new Error('El disponible no debe superar el límite y debe tener máximo dos decimales.');
        const usedCents = this.fallbackBankAccounts.find(item => item.id === card.accountId)!.movements.filter(item => item.cardId === id)
          .reduce((sum, item) => sum + (item.type === 'Egreso' ? 1 : -1) * Math.round(item.amount * 100), 0);
        adjustment = (Math.round(card.creditLimit * 100) - Math.round(available * 100) - usedCents) / 100;
      }
      Object.assign(existing, card, { creditLimit: card.cardType === 'Credito' ? card.creditLimit : null, creditAdjustment: adjustment }); return existing;
    }
    const result = this.request<{ value: DbBankCard; error?: string }>('bank-cards:update', { id, card });
    if (result.error) throw new Error(result.error);
    return result.value;
  }

  createBankAccount(account: NewDbBankAccount): DbBankAccount {
    if (!this.ipcRenderer) {
      const id = Math.max(0, ...this.fallbackBankAccounts.map(item => item.id)) + 1;
      const created: DbBankAccount = { id, name: account.name, bank: account.bank, accountNumber: account.accountNumber, balance: account.initialBalance, balanceUpdatedBy: account.createdBy, balanceUpdatedAt: new Date().toISOString(), status: 'Activa', cards: [], movements: [] };
      this.fallbackBankAccounts = [created, ...this.fallbackBankAccounts];
      return created;
    }
    return this.request<DbBankAccount>('bank-accounts:create', account);
  }

  addBankCard(card: NewDbBankCard): DbBankCard {
    const creditLimit = card.cardType === 'Credito' ? card.creditLimit ?? null : null;
    if (creditLimit !== null && (!Number.isFinite(creditLimit) || creditLimit <= 0 || creditLimit > 999999999.99 || Math.abs(creditLimit * 100 - Math.round(creditLimit * 100)) > 0.0001)) throw new Error('Ingresa un límite de crédito positivo con máximo dos decimales.');
    card = { ...card, creditLimit };
    if (!this.ipcRenderer) {
      const account = this.fallbackBankAccounts.find(item => item.id === card.accountId);
      const created: DbBankCard = { id: Math.max(0, ...this.fallbackBankAccounts.flatMap(item => item.cards.map(current => current.id))) + 1, ...card, status: 'Activa' };
      account?.cards.push(created);
      return created;
    }
    const result = this.request<{ value: DbBankCard; error?: string }>('bank-cards:create', card);
    if (result.error) throw new Error(result.error);
    return result.value;
  }

  updateBankBalance(accountId: number, balance: number, updatedBy: string): DbBankAccount {
    if (!this.ipcRenderer) {
      const account = this.fallbackBankAccounts.find(item => item.id === accountId);
      if (!account) throw new Error('Cuenta bancaria no encontrada.');
      account.balance = balance; account.balanceUpdatedBy = updatedBy; account.balanceUpdatedAt = new Date().toISOString();
      return account;
    }
    return this.request<DbBankAccount>('bank-accounts:balance', { accountId, balance, updatedBy });
  }

  createBankMovement(movement: NewDbBankMovement): DbBankAccount {
    if (!this.ipcRenderer) {
      const account = this.fallbackBankAccounts.find(item => item.id === movement.accountId);
      if (!account) throw new Error('Cuenta bancaria no encontrada.');
      account.balance += movement.type === 'Ingreso' ? movement.amount : -movement.amount;
      account.balanceUpdatedBy = movement.createdBy; account.balanceUpdatedAt = new Date().toISOString();
      account.movements.unshift({ id: Math.max(0, ...this.fallbackBankAccounts.flatMap(item => item.movements.map(current => current.id))) + 1, ...movement, balanceAfter: account.balance, createdAt: new Date().toISOString() });
      return account;
    }
    return this.request<DbBankAccount>('bank-movements:create', movement);
  }

  listExpenseCategories(): string[] {
    if (!this.ipcRenderer) return [...expenseCatalogs.categories];
    return this.expenseRequest<string[]>('expenses:categories');
  }

  createExpenseCategory(name: string): string {
    return this.expenseRequest<string>('expenses:create-category', name);
  }

  listExpenses(): DbExpense[] {
    if (!this.ipcRenderer) return [];
    return this.expenseRequest<DbExpense[]>('expenses:list');
  }

  createExpense(expense: NewDbExpense): DbExpense {
    return this.expenseRequest<DbExpense>('expenses:create', expense);
  }

  getExpenseAttachment(id: number, kind: 'ticket' | 'invoice'): ExpenseAttachment {
    return this.expenseRequest<ExpenseAttachment>('expenses:attachment', { id, kind });
  }

  private expenseRequest<T>(channel: string, payload?: unknown): T {
    if (!this.ipcRenderer) throw new Error('Abre la aplicación de escritorio para guardar gastos y consultar archivos.');
    const result = this.request<{ value: T; error?: string }>(channel, payload);
    if (result.error) throw new Error(result.error);
    return result.value;
  }

  listPaymentClients(): DbPaymentClient[] {
    if (!this.ipcRenderer) return [...new Set(this.fallbackServices.filter(service => !this.isUnavailableForPayment(service)).map(service => service.clientId))].map(clientId => ({ id: clientId, name: this.fallbackServices.find(service => service.clientId === clientId)?.client ?? '', businessName: '', rfc: '' }));
    return this.request<DbPaymentClient[]>('payments:clients');
  }

  listPaymentServices(clientId: number): DbPaymentService[] {
    if (!this.ipcRenderer) return this.fallbackServices.filter(service => service.clientId === clientId && !this.isUnavailableForPayment(service)).map(service => ({ ...service, site: service.site, amount: service.serviceCost + service.travelAllowance + service.materialsCost }));
    return this.request<DbPaymentService[]>('payments:services', clientId);
  }

  listPayments(): DbPayment[] {
    if (!this.ipcRenderer) return [];
    return this.request<DbPayment[]>('payments:list');
  }

  listPaidServices(paymentId: number): DbPaidService[] {
    if (!this.ipcRenderer) return [];
    const result = this.request<{ value: DbPaidService[]; error?: string }>('payments:details', paymentId);
    if (result.error) throw new Error(result.error);
    return result.value;
  }

  listInvoices(): DbInvoice[] {
    if (!this.ipcRenderer) return [];
    return this.request<DbInvoice[]>('invoices:list');
  }

  createInvoice(invoice: NewDbInvoice): DbInvoice {
    if (!this.ipcRenderer) throw new Error('Abre la aplicación de escritorio para guardar facturas.');
    const result = this.request<{ value: DbInvoice; error?: string }>('invoices:create', invoice);
    if (result.error) throw new Error(result.error);
    return result.value;
  }

  updatePayment(id: number, paymentDate: string): DbPayment {
    if (!this.ipcRenderer) throw new Error('La edicion de pagos solo esta disponible dentro de Electron.');
    const result = this.request<{ value: DbPayment; error?: string }>('payments:update', { id, paymentDate });
    if (result.error) throw new Error(result.error);
    return result.value;
  }

  updateInvoiceNote(id: number, note: string): DbInvoice {
    if (!this.ipcRenderer) throw new Error('Abre la aplicación de escritorio para guardar la nota.');
    const result = this.request<{ value: DbInvoice; error?: string }>('invoices:update-note', { id, note });
    if (result.error) throw new Error(result.error);
    return result.value;
  }

  revertPayment(id: number, revertedBy: string, reason: string): DbPayment {
    if (!this.ipcRenderer) throw new Error('La reversión de pagos solo esta disponible dentro de Electron.');
    const result = this.request<{ value: DbPayment; error?: string }>('payments:revert', { id, revertedBy, reason });
    if (result.error) throw new Error(result.error);
    return result.value;
  }

  createPayment(payment: NewDbPayment): DbPayment {
    if (!this.ipcRenderer) throw new Error('Abre la aplicación de escritorio para registrar pagos con folio automático.');
    const result = this.request<{ value: DbPayment; error?: string }>('payments:create', payment);
    if (result.error) throw new Error(result.error);
    return result.value;
  }

  getAccountInformation(): DbAccountInformation | null {
    if (!this.ipcRenderer) return this.fallbackAccountInformation;
    return this.request<DbAccountInformation | null>('account-information:get');
  }

  saveAccountInformation(information: DbAccountInformation): DbAccountInformation {
    if (!this.ipcRenderer) {
      this.fallbackAccountInformation = information;
      return information;
    }
    return this.request<DbAccountInformation>('account-information:save', information);
  }

  listClients(): DbClient[] {
    if (!this.ipcRenderer) return [...this.fallbackClients];
    return this.request<DbClient[]>('clients:list');
  }

  listTaxRegimes(): TaxRegime[] {
    if (!this.ipcRenderer) {
        console.log('listTaxRegimes: ipcRenderer is not available. Returning empty array.',this.ipcRenderer);
        return [];
    }
    return this.request<TaxRegime[]>('tax-regimes:list');
  }

  getTaxSettings(): TaxSettings {
    if (!this.ipcRenderer) return { ...this.fallbackTaxSettings };
    return this.request<TaxSettings>('tax-settings:get');
  }

  updateTaxSettings(settings: TaxSettings): TaxSettings {
    if (!this.ipcRenderer) {
      this.fallbackTaxSettings = { ...settings };
      return { ...this.fallbackTaxSettings };
    }
    return this.request<TaxSettings>('tax-settings:update', settings);
  }

  listServices(): DbService[] {
    if (!this.ipcRenderer) return this.fallbackServices.map(service => ({ ...service, assignedUserName: service.assignedUserName || 'Administrador', materials: service.materials.map(material => ({ ...material })) }));
    return this.request<DbService[]>('services:list');
  }

  createService(service: NewDbService): DbService {
    if (!this.ipcRenderer) {
      const client = this.fallbackClients.find(item => item.id === service.clientId);
      const company = this.fallbackLinkedCompanies.find(item => item.id === service.companyId);
      const created = { ...service, id: Math.max(0, ...this.fallbackServices.map(item => item.id)) + 1, client: client?.name ?? '', company: company?.name ?? '', assignedUserName: service.assignedUserId === null ? 'Administrador' : this.fallbackCollaborators.find(item => item.id === service.assignedUserId)?.name ?? 'Usuario no encontrado', materialsCost: service.materials.reduce((total, material) => total + Number(material.cost || 0), 0) };
      this.fallbackServices = [created, ...this.fallbackServices];
      return created;
    }
    return this.request<DbService>('services:create', service);
  }

  updateService(id: number, service: NewDbService): DbService {
    if (!this.ipcRenderer) {
      const client = this.fallbackClients.find(item => item.id === service.clientId);
      const company = this.fallbackLinkedCompanies.find(item => item.id === service.companyId);
      const updated = { ...service, id, client: client?.name ?? '', company: company?.name ?? '', assignedUserName: service.assignedUserId === null ? 'Administrador' : this.fallbackCollaborators.find(item => item.id === service.assignedUserId)?.name ?? 'Usuario no encontrado', materialsCost: service.materials.reduce((total, material) => total + Number(material.cost || 0), 0) };
      this.fallbackServices = this.fallbackServices.map(item => item.id === id ? updated : item);
      return updated;
    }
    return this.request<DbService>('services:update', { id, service });
  }

  deleteService(id: number): void {
    if (!this.ipcRenderer) {
      this.fallbackServices = this.fallbackServices.filter(service => service.id !== id);
      return;
    }
    this.request<boolean>('services:delete', id);
  }

  listServiceCities(): string[] {
    if (!this.ipcRenderer) return [...new Set(this.fallbackServices.map(service => service.city).filter(Boolean))].sort();
    return this.request<string[]>('service-cities:list');
  }

  listServiceMaterials(): string[] {
    if (!this.ipcRenderer) return [...new Set(this.fallbackServices.flatMap(service => service.materials.map(material => material.name)).filter(Boolean))].sort();
    return this.request<string[]>('service-materials:list');
  }

  exportServices(options: ServiceExportOptions): string | null {
    if (!this.ipcRenderer) return null;
    const result = this.request<{ value?: string | null; error?: string }>('services:export', options);
    if (result.error) throw new Error(result.error);
    return result.value ?? null;
  }

  async exportPendingServices(clientId: number, serviceIds: number[], format: 'pdf' | 'xlsx'): Promise<string | null> {
    if (!this.ipcRenderer) throw new Error('La exportación está disponible en la aplicación de escritorio.');
    const result = await this.ipcRenderer.exportPendingServices({ clientId, serviceIds, format });
    if (result.error) throw new Error(result.error);
    return result.value ?? null;
  }

  listLinkedCompanies(): DbLinkedCompany[] {
    if (!this.ipcRenderer) return [...this.fallbackLinkedCompanies];
    return this.request<DbLinkedCompany[]>('linked-companies:list');
  }

  createLinkedCompany(company: NewDbLinkedCompany): DbLinkedCompany {
    if (!this.ipcRenderer) {
      const createdCompany = { ...company, id: Math.max(0, ...this.fallbackLinkedCompanies.map(item => item.id)) + 1 };
      this.fallbackLinkedCompanies = [createdCompany, ...this.fallbackLinkedCompanies];
      return createdCompany;
    }
    return this.request<DbLinkedCompany>('linked-companies:create', company);
  }

  updateLinkedCompany(id: number, company: NewDbLinkedCompany): DbLinkedCompany {
    if (!this.ipcRenderer) {
      const updatedCompany = { ...company, id };
      this.fallbackLinkedCompanies = this.fallbackLinkedCompanies.map(item => item.id === id ? updatedCompany : item);
      return updatedCompany;
    }
    return this.request<DbLinkedCompany>('linked-companies:update', { id, company });
  }

  createClient(client: NewDbClient): DbClient {
    if (!this.ipcRenderer) {
      const createdClient = { ...client, id: Math.max(0, ...this.fallbackClients.map(item => item.id)) + 1 };
      this.fallbackClients = [createdClient, ...this.fallbackClients];
      return createdClient;
    }
    const result = this.request<{ value: DbClient; error?: string }>('clients:create', client);
    if (result.error) throw new Error(result.error);
    return result.value;
  }

  updateClient(id: number, client: NewDbClient): DbClient {
    if (!this.ipcRenderer) {
      const updatedClient = { ...client, id };
      this.fallbackClients = this.fallbackClients.map(item => item.id === id ? updatedClient : item);
      return updatedClient;
    }
    const result = this.request<{ value: DbClient; error?: string }>('clients:update', { id, client });
    if (result.error) throw new Error(result.error);
    return result.value;
  }

  updateClientStatus(id: number, status: DbClient['status']): void {
    if (!this.ipcRenderer) {
      this.fallbackClients = this.fallbackClients.map(item => item.id === id ? { ...item, status } : item);
      return;
    }
    this.request<boolean>('clients:update-status', { id, status });
  }

  private request<T>(channel: string, payload?: unknown): T {
    if (!this.ipcRenderer) {
      throw new Error('La base de datos solo está disponible dentro de Electron.');
    }
    return this.ipcRenderer.sendSync<T>(channel, payload);
  }

  private isUnavailableForPayment(service: DbService): boolean {
    const status = service.status.trim().toLowerCase();
    return service.servicePaid === 'Si' || status.startsWith('cancelad') || status.startsWith('canceled') || status.startsWith('cancelled') || status === 'pagado';
  }

}
