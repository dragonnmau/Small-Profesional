import { Injectable } from '@angular/core';

export interface DbClient {
  id: number;
  kind: 'Cliente' | 'Empresa';
  name: string;
  businessName: string;
  rfc: string;
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
}

export type NewDbService = Omit<DbService, 'id' | 'client' | 'company' | 'materialsCost'>;

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
  sendSync<T>(channel: string, payload?: unknown): T;
}

@Injectable({ providedIn: 'root' })
export class Db {
  private readonly ipcRenderer = (window as ElectronWindow).electronDb;
  private fallbackClients: DbClient[] = [];
  private fallbackLinkedCompanies: DbLinkedCompany[] = [];
  private fallbackTaxSettings: TaxSettings = { ivaRate: 16, isrRate: 30 };
  private fallbackServices: DbService[] = [];

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
    if (!this.ipcRenderer) return this.fallbackServices.map(service => ({ ...service, materials: service.materials.map(material => ({ ...material })) }));
    return this.request<DbService[]>('services:list');
  }

  createService(service: NewDbService): DbService {
    if (!this.ipcRenderer) {
      const client = this.fallbackClients.find(item => item.id === service.clientId);
      const company = this.fallbackLinkedCompanies.find(item => item.id === service.companyId);
      const created = { ...service, id: Math.max(0, ...this.fallbackServices.map(item => item.id)) + 1, client: client?.name ?? '', company: company?.name ?? '', materialsCost: service.materials.reduce((total, material) => total + Number(material.cost || 0), 0) };
      this.fallbackServices = [created, ...this.fallbackServices];
      return created;
    }
    return this.request<DbService>('services:create', service);
  }

  updateService(id: number, service: NewDbService): DbService {
    if (!this.ipcRenderer) {
      const client = this.fallbackClients.find(item => item.id === service.clientId);
      const company = this.fallbackLinkedCompanies.find(item => item.id === service.companyId);
      const updated = { ...service, id, client: client?.name ?? '', company: company?.name ?? '', materialsCost: service.materials.reduce((total, material) => total + Number(material.cost || 0), 0) };
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
    return this.request<string | null>('services:export', options);
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
    return this.request<DbClient>('clients:create', client);
  }

  updateClient(id: number, client: NewDbClient): DbClient {
    if (!this.ipcRenderer) {
      const updatedClient = { ...client, id };
      this.fallbackClients = this.fallbackClients.map(item => item.id === id ? updatedClient : item);
      return updatedClient;
    }
    return this.request<DbClient>('clients:update', { id, client });
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
}
