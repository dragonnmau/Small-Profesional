import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { bankOptions } from '../../../services/bank-options';
import { Db, DbAccountInformation, DbBankAccount, DbPayment, DbPaymentClient, DbPaymentService, DbPaidService, NewDbPayment } from '../../../services/db';

interface PaymentForm { accountId: number | null; cardId?: number | null; clientId: number | null; companyId: number | null; paymentDate: string; serviceIds: number[]; }

@Component({
  selector: 'app-pagos',
  imports: [CommonModule, FormsModule],
  templateUrl: './pagos.html',
  styleUrl: './pagos.scss'
})
export class Pagos implements OnInit {
  accountInformation: DbAccountInformation | null = null;
  clients: DbPaymentClient[] = [];
  services: DbPaymentService[] = [];
  payments: DbPayment[] = [];
  filterYear = new Date().getFullYear();
  filterMonth: number | null = null;
  filterClientId: number | null = null;
  isDetailModalOpen = false;
  paidServices: DbPaidService[] = [];

  get availableYears(): number[] { return [...new Set([new Date().getFullYear(), ...this.payments.map(payment => Number(payment.paymentDate.slice(0, 4)))])].sort((a, b) => b - a); }
  get filterClients(): Array<{ id: number; name: string }> {
    return [...new Map(this.payments.map(payment => [payment.clientId, { id: payment.clientId, name: payment.client }])).values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  get filteredPayments(): DbPayment[] {
    return this.payments.filter(payment => Number(payment.paymentDate.slice(0, 4)) === this.filterYear
      && (this.filterMonth === null || Number(payment.paymentDate.slice(5, 7)) === this.filterMonth)
      && (this.filterClientId === null || payment.clientId === this.filterClientId));
  }
  openDetails(payment: DbPayment): void {
    this.selectedPayment = payment; this.paidServices = []; this.errorMessage = ''; this.isDetailModalOpen = true;
    try { this.paidServices = this.dbService.listPaidServices(payment.id); }
    catch (error) { this.errorMessage = error instanceof Error ? error.message : 'No se pudo cargar el detalle del pago.'; }
  }
  accounts: DbBankAccount[] = [];
  get accountOptions() { return bankOptions(this.accounts); }
  get accountSelection(): string { return this.paymentForm.cardId ? `card:${this.paymentForm.cardId}` : this.paymentForm.accountId ? `account:${this.paymentForm.accountId}` : ''; }
  set accountSelection(key: string) {
    const option = this.accountOptions.find(item => item.key === key);
    this.paymentForm.accountId = option?.accountId ?? null; this.paymentForm.cardId = option?.cardId ?? null;
  }
  companyOptions: Array<{ id: number; name: string }> = [];
  paymentForm = this.emptyPaymentForm();
  isModalOpen = false;
  isEditModalOpen = false;
  isRevertModalOpen = false;
  selectedPayment: DbPayment | null = null;
  editForm = { paymentDate: '' };
  reversalReason = '';
  errorMessage = '';
  exportFormat: 'pdf' | 'xlsx' = 'pdf';
  isExporting = false;
  exportMessage = '';
  readonly monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  constructor(private readonly dbService: Db) {}

  ngOnInit(): void {
    this.accountInformation = this.dbService.getAccountInformation();
    this.clients = this.dbService.listPaymentClients();
    this.payments = this.dbService.listPayments();
    this.accounts = this.dbService.listBankAccounts();
  }

  get currentUserName(): string { return this.accountInformation?.user.name || 'Administrador'; }
  get canManagePayments(): boolean { const type = this.accountInformation?.user.userType || 'admin'; return type === 'admin' || type === 'contabilidad'; }
  get selectedTotal(): number { return this.services.filter(service => this.paymentForm.serviceIds.includes(service.id)).reduce((total, service) => total + service.amount, 0); }
  get generatedFolio(): string {
    const client = this.clients.find(item => item.id === this.paymentForm.clientId);
    const prefix = ((client?.rfc || '').match(/[A-Za-zÑñ&]/g) || []).join('').slice(0, 4).toUpperCase().padEnd(4, 'X');
    return client ? (prefix + '-' + this.paymentForm.paymentDate.replaceAll('-', '').slice(2, 6) + '-[consecutivo]') : 'Selecciona un cliente';
  }
  get monthlyIncomeCards(): Array<{ key: string; label: string; amount: number; count: number }> {
    const grouped = new Map<string, { amount: number; count: number }>();
    this.filteredPayments.filter(payment => payment.status === 'Activo').forEach(payment => { const key = payment.paymentDate.slice(0, 7); const current = grouped.get(key) ?? { amount: 0, count: 0 }; current.amount += payment.amount; current.count++; grouped.set(key, current); });
    return [...grouped.entries()].sort((first, second) => second[0].localeCompare(first[0])).map(([key, value]) => { const [year, month] = key.split('-'); return { key, label: `${this.monthNames[Number(month) - 1]} ${year}`, ...value }; });
  }

  openModal(): void { this.accounts = this.dbService.listBankAccounts(); this.exportMessage = ''; this.paymentForm = this.emptyPaymentForm(); this.services = []; this.companyOptions = []; this.errorMessage = ''; this.isModalOpen = true; }
  openEditModal(payment: DbPayment): void { this.selectedPayment = payment; this.editForm = { paymentDate: payment.paymentDate }; this.errorMessage = ''; this.isEditModalOpen = true; }
  openRevertModal(payment: DbPayment): void { this.selectedPayment = payment; this.reversalReason = ''; this.errorMessage = ''; this.isRevertModalOpen = true; }
  closeModal(): void { this.isModalOpen = false; this.isEditModalOpen = false; this.isRevertModalOpen = false; this.isDetailModalOpen = false; this.selectedPayment = null; this.paidServices = []; }
  onClientChange(): void { this.paymentForm.companyId = null; this.paymentForm.serviceIds = []; this.loadServices(); }
  onCompanyChange(): void { this.paymentForm.serviceIds = []; }
  loadServices(): void {
    if (!this.paymentForm.clientId) { this.services = []; this.companyOptions = []; return; }
    this.services = this.dbService.listPaymentServices(this.paymentForm.clientId);
    this.companyOptions = [...new Map(this.services.filter(service => service.companyId !== null).map(service => [service.companyId as number, { id: service.companyId as number, name: service.company }])).values()];
  }
  visibleServices(): DbPaymentService[] { return this.paymentForm.companyId === null ? this.services : this.services.filter(service => service.companyId === this.paymentForm.companyId); }
  isSelected(serviceId: number): boolean { return this.paymentForm.serviceIds.includes(serviceId); }
  toggleService(serviceId: number): void { this.paymentForm.serviceIds = this.isSelected(serviceId) ? this.paymentForm.serviceIds.filter(id => id !== serviceId) : [...this.paymentForm.serviceIds, serviceId]; }
  savePayment(): void {
    if (!this.paymentForm.clientId || !this.paymentForm.paymentDate || !this.paymentForm.serviceIds.length) { this.errorMessage = 'Selecciona cliente, fecha y al menos un servicio.'; return; }
    if (!this.paymentForm.accountId) { this.errorMessage = 'Selecciona la cuenta bancaria que recibira el ingreso.'; return; }
    const payment: NewDbPayment = { ...this.paymentForm, accountId: this.paymentForm.accountId, clientId: this.paymentForm.clientId, createdBy: this.currentUserName };
    try { this.dbService.createPayment(payment); this.payments = this.dbService.listPayments(); this.clients = this.dbService.listPaymentClients(); this.closeModal(); }
    catch (error) { this.errorMessage = error instanceof Error ? error.message : 'No se pudo registrar el ingreso.'; }
  }
  async exportSelectedServices(): Promise<void> {
    if (this.isExporting) return;
    this.exportMessage = ''; this.errorMessage = '';
    const ids = this.visibleServices().filter(service => this.isSelected(service.id)).map(service => service.id);
    if (!this.paymentForm.clientId || !ids.length) {
      this.errorMessage = 'Selecciona al menos un servicio pendiente para exportar.'; return;
    }
    this.isExporting = true;
    try {
      const filePath = await this.dbService.exportPendingServices(this.paymentForm.clientId, ids, this.exportFormat);
      if (filePath) this.exportMessage = `Archivo guardado en: ${filePath}`;
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'No se pudieron exportar los servicios.';
    } finally { this.isExporting = false; }
  }
  saveEdit(): void {
    if (!this.selectedPayment || !this.editForm.paymentDate) { this.errorMessage = 'Completa la fecha del pago.'; return; }
    try { this.dbService.updatePayment(this.selectedPayment.id, this.editForm.paymentDate); this.payments = this.dbService.listPayments(); this.closeModal(); }
    catch (error) { this.errorMessage = error instanceof Error ? error.message : 'No se pudo editar el ingreso.'; }
  }
  saveReversal(): void {
    if (!this.selectedPayment || !this.reversalReason.trim()) { this.errorMessage = 'Indica el motivo de la reversión.'; return; }
    try { this.dbService.revertPayment(this.selectedPayment.id, this.currentUserName, this.reversalReason.trim()); this.payments = this.dbService.listPayments(); this.clients = this.dbService.listPaymentClients(); this.accounts = this.dbService.listBankAccounts(); this.closeModal(); }
    catch (error) { this.errorMessage = error instanceof Error ? error.message : 'No se pudo revertir el ingreso.'; }
  }
  private emptyPaymentForm(): PaymentForm { return { accountId: null, clientId: null, companyId: null, paymentDate: new Date().toISOString().slice(0, 10), serviceIds: [] }; }

}
