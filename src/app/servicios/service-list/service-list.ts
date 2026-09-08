import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Db, DbClient, DbLinkedCompany, DbService, NewDbService, ServiceExportOptions } from '../../services/db';

type ServiceStatus = 'Completado' | 'Cancelado en transito' | 'Cancelado' | 'Pendiente';
type TravelDeposit = 'Si' | 'No' | 'N/A';
interface ServiceForm extends Omit<DbService, 'id' | 'client' | 'company' | 'clientId' | 'companyId' | 'materialsCost'> { clientId: number | null; companyId: number | null; materialsCost: number; }
interface CalendarDay { date: string; day: number; services: DbService[]; }
interface ExportCostField { key: string; label: string; }

@Component({ selector: 'app-service-list', imports: [CommonModule, FormsModule], templateUrl: './service-list.html', styleUrl: './service-list.scss' })
export class ServiceList implements OnInit {
    services: DbService[] = [];
    clients: DbClient[] = [];
    linkedCompanies: DbLinkedCompany[] = [];
    cities: string[] = [];
    materialNames: string[] = [];
    selectedMonth = this.currentDate().slice(0, 7);
    isFormOpen = false;
    editingServiceId: number | null = null;
    search = '';
    selectedClientId: number | null = null;
    selectedCompanyId: number | null = null;
    serviceForm: ServiceForm = this.emptyForm();
    isExportOpen = false;
    exportMonth = 'all';
    exportClientId: number | null = null;
    exportCompanyId: number | null = null;
    exportFields: Record<string, boolean> = {};
    readonly exportCostFields: ExportCostField[] = [
        { key: 'Costo de servicio', label: 'Costo de servicio' },
        { key: 'Viático', label: 'Viático' },
        { key: 'Costo de materiales', label: 'Costo de materiales' },
        { key: 'Costo de transporte', label: 'Costo de transporte' },
        { key: 'Costo de gasolina', label: 'Costo de gasolina' },
        { key: 'Costo final', label: 'Costo final' }
    ];

    constructor(private readonly db: Db) { }

    ngOnInit(): void { this.loadData(); }

    get filteredServices(): DbService[] {
        const term = this.search.trim().toLocaleLowerCase();
        return this.services.filter(service => service.date.startsWith(this.selectedMonth)
            && (this.selectedClientId === null || service.clientId === this.selectedClientId)
            && (this.selectedCompanyId === null || service.companyId === this.selectedCompanyId)
            && (!term || [service.folio, service.client, service.city, service.site, service.status].some(value => value.toLocaleLowerCase().includes(term))));
    }

    get availableCompanies(): DbLinkedCompany[] {
        return this.serviceForm.clientId === null ? [] : this.linkedCompanies.filter(company => company.clientId === this.serviceForm.clientId);
    }

    get exportCompanies(): DbLinkedCompany[] { return this.exportClientId === null ? this.linkedCompanies : this.linkedCompanies.filter(company => company.clientId === this.exportClientId); }
    get serviceListCompanies(): DbLinkedCompany[] { return this.selectedClientId === null ? this.linkedCompanies : this.linkedCompanies.filter(company => company.clientId === this.selectedClientId); }
    get exportMonths(): string[] { return [...new Set(this.services.map(service => service.date.slice(0, 7)))].sort().reverse(); }
    get canExport(): boolean { return this.exportCostFields.some(field => this.exportFields[field.key]); }
    get monthApproxTotal(): number { return this.filteredServices.reduce((total, service) => total + (Number(service.serviceCost) || 0) + (Number(service.travelAllowance) || 0) + (Number(service.materialsCost) || 0), 0); }

    get formTotal(): number { return this.totalFor(this.serviceForm); }
    get formCostsWithoutService(): number { return (Number(this.serviceForm.travelAllowance) || 0) + (Number(this.serviceForm.materialsCost) || 0) + (Number(this.serviceForm.transportCost) || 0) + (Number(this.serviceForm.gasolineCost) || 0); }
    get calendarTitle(): string { const [year, month] = this.selectedMonth.split('-').map(Number); return new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1)); }

    get calendarDays(): Array<CalendarDay | null> {
        const [year, month] = this.selectedMonth.split('-').map(Number);
        const firstDay = new Date(year, month - 1, 1);
        const cells: Array<CalendarDay | null> = Array((firstDay.getDay() + 6) % 7).fill(null);
        for (let day = 1; day <= new Date(year, month, 0).getDate(); day++) {
            const date = `${this.selectedMonth}-${String(day).padStart(2, '0')}`;
            cells.push({ date, day, services: this.services.filter(service => service.date === date) });
        }
        while (cells.length % 7) cells.push(null);
        return cells;
    }

    openForm(): void { this.editingServiceId = null; this.serviceForm = this.emptyForm(); this.isFormOpen = true; }
    openEditForm(service: DbService): void { this.editingServiceId = service.id; this.serviceForm = { ...service, materials: service.materials.map(material => ({ ...material })) }; this.isFormOpen = true; }
    closeForm(): void { this.isFormOpen = false; }
    openExport(): void {
        this.exportMonth = this.selectedMonth || 'all'; this.exportClientId = null; this.exportCompanyId = null;
        this.exportFields = Object.fromEntries(this.exportCostFields.map(field => [field.key, true])); this.isExportOpen = true;
    }
    closeExport(): void { this.isExportOpen = false; }
    onExportClientChange(): void { if (!this.exportCompanies.some(company => company.id === this.exportCompanyId)) this.exportCompanyId = null; }
    setExportField(key: string, selected: boolean): void { this.exportFields[key] = selected; }
    exportServices(): void {
        const options: ServiceExportOptions = { month: this.exportMonth === 'all' ? '' : this.exportMonth, clientId: this.exportClientId, companyId: this.exportCompanyId, fields: this.exportCostFields.filter(field => this.exportFields[field.key]).map(field => field.key) };
        if (!options.fields.length) return;
        const filePath = this.db.exportServices(options);
        if (filePath) { this.closeExport(); alert(`Servicios exportados correctamente:\n${filePath}`); }
    }
    onClientChange(): void { if (!this.availableCompanies.some(company => company.id === this.serviceForm.companyId)) this.serviceForm.companyId = null; }
    onServiceListClientChange(): void { if (!this.serviceListCompanies.some(company => company.id === this.selectedCompanyId)) this.selectedCompanyId = null; }
    addMaterial(): void { this.serviceForm.materials.push({ name: '', cost: 0 }); }
    removeMaterial(index: number): void { this.serviceForm.materials.splice(index, 1); this.updateMaterialsCost(); }
    updateMaterialsCost(): void { this.serviceForm.materialsCost = this.serviceForm.materials.reduce((total, material) => total + (Number(material.cost) || 0), 0); }

    totalFor(service: Pick<DbService, 'serviceCost' | 'travelAllowance' | 'materialsCost' | 'transportCost' | 'gasolineCost'>): number {
        return (Number(service.serviceCost) || 0) + (Number(service.travelAllowance) || 0) + (Number(service.materialsCost) || 0) + (Number(service.transportCost) || 0) + (Number(service.gasolineCost) || 0);
    }

    saveService(): void {
        if (this.serviceForm.clientId === null) return;
        this.updateMaterialsCost();
        const values: NewDbService = {
            date: this.serviceForm.date, time: this.serviceForm.time, clientId: this.serviceForm.clientId, companyId: this.serviceForm.companyId,
            city: this.serviceForm.city.trim(), site: this.serviceForm.site.trim(), description: this.serviceForm.description.trim(), folio: this.serviceForm.folio.trim(), status: this.serviceForm.status, servicePaid: this.serviceForm.servicePaid,
            serviceCost: Number(this.serviceForm.serviceCost) || 0, travelAllowance: Number(this.serviceForm.travelAllowance) || 0, travelDeposit: this.serviceForm.travelDeposit,
            transportCost: Number(this.serviceForm.transportCost) || 0, gasolineCost: Number(this.serviceForm.gasolineCost) || 0,
            materials: this.serviceForm.materials.filter(material => material.name.trim() || Number(material.cost) > 0).map(material => ({ name: material.name.trim(), cost: Number(material.cost) || 0 }))
        };
        if (this.editingServiceId === null) this.db.createService(values); else this.db.updateService(this.editingServiceId, values);
        this.loadData();
        this.selectedMonth = values.date.slice(0, 7);
        this.closeForm();
    }

    deleteService(service: DbService): void {
        if (confirm(`¿Eliminar el servicio ${service.folio || 'sin folio'} de ${service.client}? Esta acción no se puede deshacer.`)) { this.db.deleteService(service.id); this.loadData(); }
    }

    private loadData(): void {
        this.services = this.db.listServices(); this.clients = this.db.listClients(); this.linkedCompanies = this.db.listLinkedCompanies();
        this.cities = this.db.listServiceCities(); this.materialNames = this.db.listServiceMaterials();
    }

    private emptyForm(): ServiceForm {
        const date = this.currentDate();
        return { date, time: this.currentTime(), clientId: null, companyId: null, city: '', site: '', description: '', folio: '', status: 'Pendiente', servicePaid: 'No', serviceCost: 0, travelAllowance: 0, travelDeposit: 'N/A', materialsCost: 0, transportCost: 0, gasolineCost: 0, materials: [] };
    }

    private currentDate(): string {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    private currentTime(): string {
        const now = new Date();
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
}
