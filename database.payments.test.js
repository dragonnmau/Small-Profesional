const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { ClientDatabase } = require('./database');

test('El detalle consulta solo los servicios del pago y conserva el importe cobrado', () => {
  const store = Object.create(ClientDatabase.prototype);
  store.db = new Database(':memory:');
  try {
    store.setupDatabase();
    const clientId = Number(store.db.prepare("INSERT INTO clients (name, rfc) VALUES ('Detalle prueba', 'AAA010101AAA')").run().lastInsertRowid);
    const accountId = Number(store.db.prepare("INSERT INTO bank_accounts (name, bank, account_number) VALUES ('Detalle', 'Banco', '123')").run().lastInsertRowid);
    const serviceId = Number(store.db.prepare("INSERT INTO services (date, client_id, folio, description, site, service_cost) VALUES ('2026-09-12', ?, 'S-001', 'Mantenimiento', 'Oficina', 100)").run(clientId).lastInsertRowid);
    const otherServiceId = Number(store.db.prepare("INSERT INTO services (date, client_id, folio, service_cost) VALUES ('2026-09-12', ?, 'S-002', 250)").run(clientId).lastInsertRowid);
    const request = { clientId, accountId, paymentDate: '2026-09-12', invoiceNumber: '1', folio: 'P-001', serviceIds: [serviceId], createdBy: 'Prueba' };
    const payment = store.createPayment(request);
    assert.equal(payment.folio, 'AAAA-2609-1');
    assert.equal(payment.invoiceNumber, '');
    assert.equal(payment.invoiceFolio, null);
    const second = store.createPayment({ ...request, folio: 'P-002', serviceIds: [otherServiceId] });
    assert.equal(second.folio, 'AAAA-2609-2');
    const invoice = store.createInvoice({ clientId, invoiceDate: '2026-09-12', ivaMode: 'included', paymentIds: [second.id], createdBy: 'Prueba' });
    const linked = store.listPayments().find(item => item.id === second.id);
    assert.equal(linked.invoiceId, invoice.id);
    assert.equal(linked.invoiceFolio, invoice.folio);
    assert.equal(store.listPayments().find(item => item.id === payment.id).invoiceFolio, null);
    store.updatePayment({ id: second.id, paymentDate: '2026-09-13', invoiceNumber: 'MANUAL' });
    assert.equal(store.listPayments().find(item => item.id === second.id).invoiceFolio, invoice.folio);
    assert.equal(store.listPayments().find(item => item.id === second.id).folio, second.folio);
    store.db.prepare('UPDATE services SET service_cost = 999 WHERE id = ?').run(serviceId);
    const details = store.listPaidServices(payment.id);
    assert.equal(details.length, 1);
    assert.equal(details[0].id, serviceId);
    assert.equal(details[0].description, 'Mantenimiento');
    assert.equal(details[0].site, 'Oficina');
    assert.equal(details[0].amount, 100);
    store.revertPayment({ id: payment.id, revertedBy: 'Prueba', reason: 'Prueba' });
    assert.deepEqual(store.listPaidServices(payment.id), details);
    const third = store.createPayment({ ...request, paymentDate: '2026-10-01' });
    assert.equal(third.folio, 'AAAA-2610-3');
    assert.deepEqual(store.listPaidServices(-1), []);
  } finally { store.db.close(); }
});

// Run the component's filter logic without a browser or an Angular renderer.
test('Los filtros combinan año, mes y cliente; el resumen excluye reversiones', () => {
  const ts = require('typescript');
  const fs = require('node:fs');
  const vm = require('node:vm');
  const source = fs.readFileSync('src/app/paginas/contabilidad/pagos/pagos.ts', 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true } }).outputText;
  const context = { exports: {}, require: () => ({ Component: () => type => type, CommonModule: {}, FormsModule: {} }), Date, Map, Set };
  vm.runInNewContext(compiled, context);
  const page = new context.exports.Pagos({ listPaidServices: () => [] });
  const year = new Date().getFullYear();
  assert.equal(page.filterYear, year);
  assert.equal(page.filterMonth, null);
  page.payments = [
    { id: 1, clientId: 1, client: 'Uno', paymentDate: `${year}-01-10`, amount: 100, status: 'Activo' },
    { id: 2, clientId: 2, client: 'Dos', paymentDate: `${year}-01-11`, amount: 200, status: 'Activo' },
    { id: 3, clientId: 1, client: 'Uno', paymentDate: `${year}-02-10`, amount: 300, status: 'Activo' },
    { id: 4, clientId: 1, client: 'Uno', paymentDate: `${year}-01-12`, amount: 400, status: 'Revertido' },
    { id: 5, clientId: 1, client: 'Uno', paymentDate: `${year - 1}-01-12`, amount: 500, status: 'Activo' }
  ];
  assert.equal(page.filteredPayments.length, 4);
  page.filterMonth = 1; page.filterClientId = 1;
  assert.equal(page.filteredPayments.map(payment => payment.id).join(','), '1,4');
  assert.equal(page.monthlyIncomeCards[0].amount, 100);
  assert.equal(page.monthlyIncomeCards[0].count, 1);
  page.filterYear = year - 1;
  assert.equal(page.filteredPayments[0].id, 5);
  page.filterClientId = 2;
  assert.equal(page.filteredPayments.length, 0);
  assert.equal(page.monthlyIncomeCards.length, 0);
  assert.equal(page.filterClients.length, 2);
});
