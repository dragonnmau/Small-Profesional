const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { ClientDatabase } = require('./database');
const { validateExpense } = require('./expense-validation');
const request = { accountId: 1, expenseDate: '2026-09-17', billingMonth: '10', concept: 'Papelería', category: 'Materiales', cfdiUse: '', amount: 100, ivaMode: 'none', hasInvoice: false, createdBy: 'Prueba' };

test('Gastos: IVA, importes, fechas y archivos opcionales', () => {
  assert.equal(validateExpense(request, 16).total, 100);
  for (const billingMonth of ['', '00', '13', '1', 1, null]) assert.throws(() => validateExpense({ ...request, billingMonth }, 16), /mes de facturación/);
  assert.throws(() => validateExpense({ ...request, category: ' ' }, 16), /categoría/);
  assert.throws(() => validateExpense({ ...request, hasInvoice: true, cfdiUse: 'P01' }, 16), /CFDI/);
  assert.throws(() => validateExpense({ ...request, hasInvoice: true }, 16), /CFDI/);
  assert.equal(validateExpense({ ...request, cfdiUse: 'G03' }, 16).cfdiUse, '');
  assert.equal(validateExpense({ ...request, ivaMode: 'added' }, 16).total, 116);
  const included = validateExpense({ ...request, amount: 116, ivaMode: 'included' }, 16);
  assert.equal(included.subtotal, 100); assert.equal(included.iva, 16);
  assert.equal(validateExpense({ ...request, amount: 0.03, ivaMode: 'included' }, 16).total, 0.03);
  for (const amount of [0, -1, NaN, Infinity, 1.001]) assert.throws(() => validateExpense({ ...request, amount }, 16));
  assert.throws(() => validateExpense({ ...request, expenseDate: '2026-02-30' }, 16));
  assert.throws(() => validateExpense({ ...request, concept: ' ' }, 16));
  assert.throws(() => validateExpense({ ...request, ticket: { name: 'a.exe', data: 'YQ==' } }, 16));
  assert.throws(() => validateExpense({ ...request, ticket: { name: 'a.png', data: '?' } }, 16));
  assert.throws(() => validateExpense({ ...request, ticket: { name: 'a.png', data: Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64') } }, 16));
  assert.throws(() => validateExpense({ ...request, invoice: { name: 'a.pdf', data: 'YQ==' } }, 16));
});

test('Gastos: persistencia, adjuntos, saldo y rollback atómico', () => {
  const store = Object.create(ClientDatabase.prototype);
  store.db = new Database(':memory:');
  try {
    store.setupDatabase();
    const account = store.createBankAccount({ name: 'Operación', bank: 'Banco', accountNumber: '123', initialBalance: 1000, createdBy: 'Prueba' });
    const expense = store.createExpense({ ...request, accountId: account.id, ivaMode: 'added', hasInvoice: true, cfdiUse: 'G03',
      ticket: { name: 'ticket.png', data: 'YQ==' }, invoice: { name: 'factura.pdf', data: 'Yg==' } });
    assert.equal(expense.total, 116);
    assert.equal(expense.billingMonth, '10');
    assert.equal(expense.category, 'Materiales');
    assert.equal(expense.cfdiUse, 'G03');
    assert.equal(expense.ticketName, 'ticket.png');
    assert.equal(store.getExpenseAttachment({ id: expense.id, kind: 'invoice' }).data, 'Yg==');
    assert.equal(store.listBankAccounts()[0].balance, 884);
    assert.equal(store.listBankAccounts()[0].movements[0].type, 'Egreso');
    assert.equal(store.listBankAccounts()[0].movements[0].amount, 116);
    store.setupDatabase();
    assert.equal(store.listExpenses().length, 1);
    assert.equal(store.listExpenses()[0].billingMonth, '10');
    assert.throws(() => store.createExpense({ ...request, accountId: 99999 }));
    store.db.exec("CREATE TRIGGER fail_expense_movement BEFORE INSERT ON bank_movements BEGIN SELECT RAISE(ABORT, 'forced failure'); END");
    assert.throws(() => store.createExpense({ ...request, accountId: account.id }), /forced failure/);
    assert.equal(store.listExpenses().length, 1);
    assert.equal(store.listBankAccounts()[0].balance, 884);
    store.deactivateBankAccount({ accountId: account.id, updatedBy: 'Prueba' });
    assert.throws(() => store.createExpense({ ...request, accountId: account.id }), /activa/);
    assert.equal(store.listExpenses().length, 1);
  } finally { store.db.close(); }
});

test('Categorías: altas persistentes, duplicados y migración de gastos anteriores', () => {
  const store = Object.create(ClientDatabase.prototype);
  store.db = new Database(':memory:');
  try {
    store.setupDatabase();
    const account = store.createBankAccount({ name: 'Prueba', bank: 'Banco', accountNumber: '', initialBalance: 1000, createdBy: 'Prueba' });
    store.createExpense({ ...request, accountId: account.id });
    store.db.exec('ALTER TABLE expenses DROP COLUMN category; ALTER TABLE expenses DROP COLUMN cfdi_use; ALTER TABLE expenses DROP COLUMN billing_month');
    store.setupDatabase();
    assert.equal(store.listExpenses()[0].category, '');
    assert.equal(store.listExpenses()[0].cfdiUse, '');
    assert.equal(store.listExpenses()[0].billingMonth, '');
    assert.equal(store.listBankAccounts()[0].balance, 900);
    assert.equal(store.createExpenseCategory('  Hospedaje  '), 'Hospedaje');
    assert.equal(store.createExpenseCategory('hOSPEDAJE'), 'Hospedaje');
    assert.throws(() => store.createExpenseCategory('  '));
    store.setupDatabase();
    assert.equal(store.listExpenseCategories().filter(name => name === 'Hospedaje').length, 1);
    const expense = store.createExpense({ ...request, accountId: account.id, category: 'Hospedaje', hasInvoice: true, cfdiUse: 'G03' });
    assert.equal(expense.category, 'Hospedaje'); assert.equal(expense.cfdiUse, 'G03');
    assert.throws(() => store.createExpense({ ...request, accountId: account.id, category: 'No existe' }), /categoría/);
  } finally { store.db.close(); }
});
