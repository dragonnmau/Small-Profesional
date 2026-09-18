const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { ClientDatabase } = require('./database');

test('Tarjetas: límite de crédito persistente, validación y compatibilidad con tarjetas anteriores', () => {
  const store = Object.create(ClientDatabase.prototype);
  store.db = new Database(':memory:');
  try {
    store.setupDatabase();
    const account = store.createBankAccount({ name: 'Prueba', bank: 'Banco', accountNumber: '', initialBalance: 1000, createdBy: 'Prueba' });
    const request = { accountId: account.id, cardType: 'Credito', lastFour: '1234', holderName: 'Titular' };
    const credit = store.createBankCard({ ...request, creditLimit: 50000.50 });
    assert.equal(credit.creditLimit, 50000.50);
    assert.equal(store.createBankCard(request).creditLimit, null);
    assert.equal(store.createBankCard({ ...request, cardType: 'Debito', creditLimit: 100 }).creditLimit, null);
    for (const creditLimit of [-1, 0, NaN, Infinity, '100', 1.001, 1000000000]) {
      assert.throws(() => store.createBankCard({ ...request, creditLimit }), /límite de crédito/);
    }
    store.setupDatabase();
    assert.equal(store.listBankAccounts()[0].cards.find(card => card.id === credit.id).creditLimit, 50000.50);
    assert.equal(store.listBankAccounts()[0].balance, 1000);
    assert.equal(store.listBankAccounts()[0].movements.length, 0);
    store.db.exec('ALTER TABLE bank_cards DROP COLUMN credit_limit');
    store.setupDatabase();
    assert.equal(store.listBankAccounts()[0].cards.length, 3);
    assert.ok(store.listBankAccounts()[0].cards.every(card => card.creditLimit === null));
  } finally { store.db.close(); }
});
