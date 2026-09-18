const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { ClientDatabase } = require('./database');

test('Clientes: tipo de persona persistido y régimen compatible al crear y editar', () => {
  const store = Object.create(ClientDatabase.prototype);
  store.db = new Database(':memory:');
  try {
    store.setupDatabase();
    const regime = code => store.db.prepare('SELECT nombre FROM regimenes_fiscales WHERE clave_sat = ?').get(code).nombre;
    const values = { kind: 'Cliente', name: 'Persona prueba', businessName: '', rfc: '', personType: 'Fisica', taxRegime: regime('612'), address: '', postalCode: '', contact: '', phone: '', email: '', status: 'Activo' };
    const client = store.createClient(values);
    assert.equal(client.personType, 'Fisica');
    assert.throws(() => store.updateClient(client.id, { ...values, personType: 'Moral' }), /compatible/);
    assert.equal(store.getClient(client.id).personType, 'Fisica');
    const moral = store.updateClient(client.id, { ...values, personType: 'Moral', taxRegime: regime('601') });
    assert.equal(moral.personType, 'Moral');
    for (const personType of ['Fisica', 'Moral']) {
      assert.equal(store.updateClient(client.id, { ...values, personType, taxRegime: regime('626') }).personType, personType);
    }
    assert.throws(() => store.createClient({ ...values, name: 'Sin tipo', personType: null }), /tipo de persona/);
    assert.throws(() => store.createClient({ ...values, name: 'Incompatible', taxRegime: regime('601') }), /compatible/);
    store.setupDatabase();
    assert.equal(store.listClients()[0].personType, 'Moral');
    const legacyId = Number(store.db.prepare("INSERT INTO clients (name) VALUES ('Cliente previo')").run().lastInsertRowid);
    assert.equal(store.getClient(legacyId).personType, null);
  } finally { store.db.close(); }
});

test('El formulario filtra regímenes y limpia selecciones incompatibles', () => {
  const ts = require('typescript');
  const fs = require('node:fs');
  const vm = require('node:vm');
  const source = fs.readFileSync('src/app/clientes/client-list/client-list.ts', 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true } }).outputText;
  const context = { exports: {}, require: () => ({ Component: () => type => type, CommonModule: {}, FormsModule: {} }), console: { log: () => {} } };
  vm.runInNewContext(compiled, context);
  const page = new context.exports.ClientList({ listClients: () => [], listLinkedCompanies: () => [], listTaxRegimes: () => [
    { name: 'Física', personType: 'Personas físicas' }, { name: 'Moral', personType: 'Personas morales' }, { name: 'Ambas', personType: 'Personas físicas y morales' }
  ] });
  assert.equal(page.availableTaxRegimes.length, 0);
  page.clientForm.personType = 'Fisica';
  assert.equal(page.availableTaxRegimes.map(item => item.name).join(','), 'Física,Ambas');
  page.clientForm.taxRegime = 'Física'; page.clientForm.personType = 'Moral'; page.onPersonTypeChange();
  assert.equal(page.clientForm.taxRegime, '');
  assert.equal(page.availableTaxRegimes.map(item => item.name).join(','), 'Moral,Ambas');
  page.clientForm.taxRegime = 'Ambas'; page.clientForm.personType = 'Fisica'; page.onPersonTypeChange();
  assert.equal(page.clientForm.taxRegime, 'Ambas');
});
