import { DbBankAccount } from './db';

export function bankOptions(accounts: DbBankAccount[]) {
  return accounts.flatMap(account => [
    { key: `account:${account.id}`, accountId: account.id, cardId: null as number | null, label: `${account.name} · ${account.bank}` },
    ...account.cards.filter(card => card.status === 'Activa').map(card => ({
      key: `card:${card.id}`, accountId: account.id, cardId: card.id,
      label: `${account.name} · ${card.cardType === 'Credito' ? 'Crédito' : 'Débito'} **** ${card.lastFour} · ${card.holderName}`
    }))
  ]);
}
