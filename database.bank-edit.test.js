const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { ClientDatabase } = require('./database');

test('Edición conserva saldos e historial y recalcula el crédito con todos los movimientos', () => {
  const store = Object.create(ClientDatabase.prototype);
  store.db = new Database(':memory:');
  try {
    store.setupDatabase();
    const account = store.createBankAccount({ name: 'Original', bank: 'Banco', accountNumber: '123', initialBalance: 1000, createdBy: 'Prueba' });
    const cardData = { accountId: account.id, cardType: 'Credito', lastFour: '1234', holderName: 'Titular', creditLimit: 500 };
    const card = store.createBankCard(cardData);
    const movement = { accountId: account.id, cardId: card.id, type: 'Egreso', description: 'Compra', amount: 10, createdBy: 'Prueba' };
    for (let i = 0; i < 12; i++) store.createBankMovement(movement);
    store.createBankMovement({ ...movement, type: 'Ingreso', amount: 20 });
    const edited = store.updateBankAccount({ id: account.id, account: { name: 'Editada', bank: 'Otro', accountNumber: '456', balance: 0 } });
    assert.equal(edited.balance, 900); assert.equal(edited.name, 'Editada'); assert.equal(edited.accountNumber, '456');
    assert.equal(edited.cards[0].availableCredit, 400);
    assert.equal(edited.movements.length, 10);
    const changed = store.updateBankCard({ id: card.id, card: { ...cardData, creditLimit: 800, lastFour: '5678', holderName: 'Nuevo' } });
    assert.equal(changed.availableCredit, 700); assert.equal(changed.lastFour, '5678'); assert.equal(changed.holderName, 'Nuevo');
    assert.equal(store.updateBankCard({ id: card.id, card: { ...cardData, creditLimit: 800, availableCredit: 450 } }).availableCredit, 450);
    assert.equal(store.listBankAccounts()[0].balance, 900);
    assert.throws(() => store.updateBankCard({ id: card.id, card: { ...cardData, availableCredit: 501 } }), /disponible/);
    assert.throws(() => store.updateBankCard({ id: card.id, card: { ...cardData, availableCredit: 1.001 } }), /disponible/);
    store.setupDatabase();
    assert.equal(store.listBankAccounts()[0].cards[0].availableCredit, 450);
    store.createBankMovement({ ...movement, amount: 50 });
    assert.equal(store.listBankAccounts()[0].cards[0].availableCredit, 400);
    store.createBankMovement({ ...movement, type: 'Ingreso', amount: 50 });
    assert.equal(store.listBankAccounts()[0].cards[0].availableCredit, 450);
    store.updateBankCard({ id: card.id, card: { ...cardData, creditLimit: 800, availableCredit: 700 } });
    assert.equal(store.db.prepare('SELECT COUNT(*) AS count FROM bank_movements').get().count, 15);
    assert.throws(() => store.updateBankCard({ id: card.id, card: { ...cardData, creditLimit: -1 } }));
    assert.throws(() => store.updateBankCard({ id: card.id, card: { ...cardData, accountId: 999 } }));
    assert.throws(() => store.updateBankAccount({ id: account.id, account: { name: '', bank: 'Banco', accountNumber: '' } }));
    assert.equal(store.updateBankCard({ id: card.id, card: { ...cardData, creditLimit: 50 } }).availableCredit, -50);
    store.createBankMovement({ ...movement, type: 'Ingreso', amount: 200 });
    assert.equal(store.listBankAccounts()[0].cards[0].availableCredit, 50);
    assert.equal(store.updateBankCard({ id: card.id, card: { ...cardData, creditLimit: null } }).availableCredit, null);
    assert.equal(store.updateBankCard({ id: card.id, card: { ...cardData, cardType: 'Debito' } }).availableCredit, null);
    store.setupDatabase();
    assert.equal(store.listBankAccounts()[0].name, 'Editada');
  } finally { store.db.close(); }
});
