import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Db, DbAccountInformation, DbBankAccount, DbBankCard, DbBankMovement, NewDbBankMovement } from '../../../services/db';

interface AccountForm { name: string; bank: string; accountNumber: string; initialBalance: number; }
interface CardForm { cardType: 'Debito' | 'Credito'; lastFour: string; holderName: string; creditLimit: number | null; }
interface BalanceForm { balance: number; }
interface MovementForm { cardId: number | null; type: 'Ingreso' | 'Egreso'; description: string; amount: number; }

@Component({
  selector: 'app-cuentas-bancarias',
  imports: [CommonModule, FormsModule],
  templateUrl: './cuentas-bancarias.html',
  styleUrl: './cuentas-bancarias.scss'
})
export class CuentasBancarias implements OnInit {
  accountInformation: DbAccountInformation | null = null;
  accounts: DbBankAccount[] = [];
  selectedAccount: DbBankAccount | null = null;
  editingAccountId: number | null = null;
  editingCardId: number | null = null;
  availableCredit: number | null = null;
  availableCreditChanged = false;
  private originalCreditLimit = 0;
  private originalAvailableCredit = 0;
  actionError = '';
  isAccountModalOpen = false;
  isCardModalOpen = false;
  isBalanceModalOpen = false;
  isMovementModalOpen = false;
  accountForm = this.emptyAccountForm();
  cardForm = this.emptyCardForm();
  balanceForm = this.emptyBalanceForm();
  movementForm = this.emptyMovementForm();
  readonly banks = ['BBVA', 'Banorte', 'Santander', 'Citibanamex', 'HSBC', 'Scotiabank', 'Banco Azteca', 'Banregio', 'Hey Banco', 'NU', 'Otro'];

  constructor(private readonly dbService: Db) {}

  ngOnInit(): void {
    this.accountInformation = this.dbService.getAccountInformation();
    this.loadAccounts();
  }

  get currentUserName(): string { return this.accountInformation?.user.name || 'Administrador'; }
  get userType(): string { return this.accountInformation?.user.userType || 'admin'; }
  get canManageAccounts(): boolean { return this.userType === 'admin' || this.userType === 'contabilidad'; }
  get totalBalance(): number { return this.accounts.reduce((total, account) => total + account.balance, 0); }
  get totalCards(): number { return this.accounts.reduce((total, account) => total + account.cards.length, 0); }
  get selectedCards() { return this.selectedAccount?.cards ?? []; }
  get latestMovements(): Array<DbBankMovement & { accountName: string; bank: string }> {
    return this.accounts.flatMap(account => account.movements.map(movement => ({ ...movement, accountName: account.name, bank: account.bank })))
      .sort((first, second) => second.id - first.id).slice(0, 8);
  }

  openAccountModal(): void { this.editingAccountId = null; this.actionError = ''; this.accountForm = this.emptyAccountForm(); this.isAccountModalOpen = true; }
  openEditAccount(account: DbBankAccount): void {
    this.openAccountModal(); this.editingAccountId = account.id;
    this.accountForm = { name: account.name, bank: account.bank, accountNumber: account.accountNumber, initialBalance: account.balance };
  }
  openCardModal(account: DbBankAccount): void { this.editingCardId = null; this.actionError = ''; this.selectedAccount = account; this.cardForm = this.emptyCardForm(); this.isCardModalOpen = true; }
  openEditCard(account: DbBankAccount, card: DbBankCard): void {
    this.openCardModal(account); this.editingCardId = card.id;
    this.cardForm = { cardType: card.cardType, lastFour: card.lastFour, holderName: card.holderName, creditLimit: card.creditLimit };
    this.availableCredit = card.availableCredit ?? null; this.availableCreditChanged = false;
    this.originalCreditLimit = card.creditLimit ?? 0; this.originalAvailableCredit = card.availableCredit ?? 0;
  }
  creditLimitChanged(): void {
    if (!this.availableCreditChanged) this.availableCredit = this.cardForm.creditLimit === null ? null
      : Math.round((this.cardForm.creditLimit - this.originalCreditLimit + this.originalAvailableCredit) * 100) / 100;
  }
  openBalanceModal(account: DbBankAccount): void { this.actionError = ''; this.selectedAccount = account; this.balanceForm = { balance: account.balance }; this.isBalanceModalOpen = true; }
  openMovementModal(account: DbBankAccount): void { this.actionError = ''; this.selectedAccount = account; this.movementForm = this.emptyMovementForm(); this.isMovementModalOpen = true; }
  deactivateAccount(account: DbBankAccount): void {
    if (!confirm(`¿Deseas dar de baja la cuenta ${account.name}? Se conservaran sus movimientos.`)) return;
    try { this.dbService.deactivateBankAccount(account.id, this.currentUserName); this.loadAccounts(); }
    catch (error) { this.actionError = this.errorMessage(error); }
  }
  closeModals(): void { this.isAccountModalOpen = false; this.isCardModalOpen = false; this.isBalanceModalOpen = false; this.isMovementModalOpen = false; this.selectedAccount = null; }

  saveAccount(): void {
    this.actionError = '';
    if (!this.accountForm.name.trim() || !this.accountForm.bank || (!this.editingAccountId && this.accountForm.initialBalance < 0)) return;
    try {
      if (this.editingAccountId) this.dbService.updateBankAccount(this.editingAccountId, { name: this.accountForm.name.trim(), bank: this.accountForm.bank, accountNumber: this.accountForm.accountNumber });
      else this.dbService.createBankAccount({ ...this.accountForm, name: this.accountForm.name.trim(), createdBy: this.currentUserName });
      this.loadAccounts(); this.closeModals();
    } catch (error) { this.actionError = this.errorMessage(error); }
  }

  saveCard(): void {
    this.actionError = '';
    if (!this.selectedAccount || !/^\d{4}$/.test(this.cardForm.lastFour) || !this.cardForm.holderName.trim()) return;
    try {
      const card = { accountId: this.selectedAccount.id, ...this.cardForm, holderName: this.cardForm.holderName.trim() };
      if (this.editingCardId) {
        if (card.cardType === 'Credito' && this.availableCreditChanged && this.availableCredit === null) throw new Error('Ingresa el crédito disponible.');
        this.dbService.updateBankCard(this.editingCardId, { ...card, ...(card.cardType === 'Credito' && this.availableCreditChanged ? { availableCredit: this.availableCredit! } : {}) });
      }
      else this.dbService.addBankCard(card);
      this.loadAccounts(); this.closeModals();
    } catch (error) { this.actionError = this.errorMessage(error); }
  }

  cardTypeChanged(): void {
    this.actionError = '';
    if (this.cardForm.cardType !== 'Credito') { this.cardForm.creditLimit = null; this.availableCredit = null; this.availableCreditChanged = false; }
  }

  saveBalance(): void {
    if (!this.selectedAccount || this.balanceForm.balance < 0) return;
    try {
      this.dbService.updateBankBalance(this.selectedAccount.id, Number(this.balanceForm.balance), this.currentUserName);
      this.loadAccounts(); this.closeModals();
    } catch (error) { this.actionError = this.errorMessage(error); }
  }

  saveMovement(): void {
    if (!this.selectedAccount || !this.movementForm.description.trim() || this.movementForm.amount <= 0) return;
    const movement: NewDbBankMovement = { ...this.movementForm, accountId: this.selectedAccount.id, description: this.movementForm.description.trim(), createdBy: this.currentUserName };
    try {
      this.dbService.createBankMovement(movement); this.loadAccounts(); this.closeModals();
    } catch (error) { this.actionError = this.errorMessage(error); }
  }

  private loadAccounts(): void { this.accounts = this.dbService.listBankAccounts(); }
  private emptyAccountForm(): AccountForm { return { name: '', bank: '', accountNumber: '', initialBalance: 0 }; }
  private emptyCardForm(): CardForm { return { cardType: 'Debito', lastFour: '', holderName: '', creditLimit: null }; }
  private emptyBalanceForm(): BalanceForm { return { balance: 0 }; }
  private emptyMovementForm(): MovementForm { return { cardId: null, type: 'Ingreso', description: '', amount: 0 }; }
  private errorMessage(error: unknown): string { return error instanceof Error ? error.message : 'No se pudo guardar la informacion.'; }

}
