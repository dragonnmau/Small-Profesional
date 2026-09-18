const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { ClientDatabase } = require('./database');

test('Gastos y pagos conservan la tarjeta y rechazan tarjetas bloqueadas o de otra cuenta', () => {
  const store = Object.create(ClientDatabase.prototype);
  store.db = new Database(':memory:');
  try {
    store.setupDatabase();
    const account = store.createBankAccount({ name: 'Cuenta', bank: 'Banco', accountNumber: '', initialBalance: 1000, createdBy: 'Prueba' });
    const card = store.createBankCard({ accountId: account.id, cardType: 'Credito', lastFour: '1234', holderName: 'Titular', creditLimit: 5000 });
    const other = store.createBankAccount({ name: 'Otra', bank: 'Banco', accountNumber: '', initialBalance: 0, createdBy: 'Prueba' });
    const clientId = Number(store.db.prepare("INSERT INTO clients (name, rfc) VALUES ('Cliente', 'AAA010101AAA')").run().lastInsertRowid);
    const serviceId = Number(store.db.prepare("INSERT INTO services (date, client_id, service_cost) VALUES ('2026-09-17', ?, 100)").run(clientId).lastInsertRowid);
    const expense = { accountId: account.id, cardId: card.id, expenseDate: '2026-09-17', billingMonth: '09', category: 'Comida', concept: 'Comida', amount: 50, ivaMode: 'none', hasInvoice: false, createdBy: 'Prueba' };
    const payment = { accountId: account.id, cardId: card.id, clientId, serviceIds: [serviceId], paymentDate: '2026-09-17', createdBy: 'Prueba' };
    for (const cardId of [9999, '1', -1]) {
      assert.throws(() => store.createExpense({ ...expense, cardId }), /tarjeta/);
      assert.throws(() => store.createPayment({ ...payment, cardId }), /tarjeta/);
    }
    assert.throws(() => store.createExpense({ ...expense, accountId: other.id }), /tarjeta/);
    assert.throws(() => store.createPayment({ ...payment, accountId: other.id }), /tarjeta/);
    store.db.prepare("UPDATE bank_cards SET status = 'Bloqueada' WHERE id = ?").run(card.id);
    assert.throws(() => store.createExpense(expense), /tarjeta/);
    assert.throws(() => store.createPayment(payment), /tarjeta/);
    assert.equal(store.listExpenses().length, 0); assert.equal(store.listPayments().length, 0);
    store.db.prepare("UPDATE bank_cards SET status = 'Activa' WHERE id = ?").run(card.id);
    const savedExpense = store.createExpense(expense);
    const savedPayment = store.createPayment(payment);
    assert.equal(savedExpense.cardId, card.id); assert.equal(savedExpense.cardLastFour, '1234');
    assert.equal(savedPayment.cardId, card.id); assert.equal(savedPayment.cardLastFour, '1234');
    store.revertPayment({ id: savedPayment.id, revertedBy: 'Prueba', reason: 'Corrección' });
    assert.equal(store.listBankAccounts().find(item => item.id === account.id).balance, 950);
    assert.ok(store.db.prepare('SELECT card_id FROM bank_movements').all().every(row => row.card_id === card.id));
    store.setupDatabase();
    assert.equal(store.listPayments()[0].cardId, card.id);
    assert.equal(store.listExpenses()[0].cardId, card.id);
  } finally { store.db.close(); }
});
