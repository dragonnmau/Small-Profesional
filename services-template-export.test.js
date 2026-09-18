const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const XLSX = require('xlsx');
const { createServicesWorkbook, exportServices } = require('./services-template-export');

const templatePath = path.join(__dirname, 'public', 'Servicios Del Mes 2026 Plantilla.xlsx');
const fields = ['Costo de servicio', 'Viático', 'Costo de materiales', 'Costo de transporte', 'Costo de gasolina', 'Costo final'];
const options = { month: '2026-09', clientId: 1, companyId: null, fields };
const service = { id: 1, date: '2026-09-16', clientId: 1, client: 'Cliente de prueba', companyId: 2,
  company: 'Empresa & Asociados', city: 'Cancún', site: 'Sitio', description: '=Una descripción <larga>', folio: 'S-1',
  status: 'Completado', travelDeposit: 'Si', serviceCost: 100, travelAllowance: 20, materialsCost: 30, transportCost: 40, gasolineCost: 50 };
const archive = buffer => XLSX.CFB.read(buffer, { type: 'buffer' });
const part = (zip, name) => XLSX.CFB.find(zip, name).content.toString('utf8');
const sheetFrom = buffer => XLSX.read(buffer, { type: 'buffer', cellStyles: true }).Sheets.Servicios;

test('preserves template styling and layout while replacing sample data and calculating totals', () => {
  const buffer = createServicesWorkbook(templatePath, [service], options, 'Cliente de prueba');
  const sheet = sheetFrom(buffer);
  const zip = archive(buffer);
  const original = archive(fs.readFileSync(templatePath));
  assert.equal(part(zip, '/xl/styles.xml'), part(original, '/xl/styles.xml'));
  assert.equal(part(zip, '/xl/theme/theme1.xml'), part(original, '/xl/theme/theme1.xml'));
  assert.equal(sheet.B2.v, 'Control de Servicios en Campo');
  assert.match(sheet.B3.v, /Cliente de prueba.*2026-09/);
  assert.equal(sheet.B5.v, 1);
  assert.equal(sheet.D5.v, 1);
  assert.equal(sheet.F5.v, 240);
  assert.equal(sheet.J5.v, 20);
  assert.equal(sheet.M5.v, 120);
  assert.equal(sheet.B8.w, '16/9/2026');
  assert.equal(sheet.C8.v, service.company);
  assert.equal(sheet.F8.v, service.description);
  assert.equal(sheet.F8.t, 's');
  assert.equal(sheet.I8.v, 'Si');
  assert.equal(sheet.M8.v, 90);
  assert.equal(sheet.N8.v, 240);
  assert.equal(sheet.N8.f, 'SUM(J8:M8)');
  assert.equal(sheet.H9.v, 'Total General');
  assert.equal(sheet.N9.f, 'SUM(N8:N8)');
  assert.equal(sheet['!merges'].length, 12);
  assert.equal(sheet.B7.s.fgColor.rgb, '425D90');
  assert.match(part(zip, '/xl/worksheets/sheet1.xml'), /state="frozen"/);
  assert.match(part(zip, '/xl/worksheets/sheet1.xml'), /'Servicios'!J9:M9/);
  assert.match(part(zip, '/xl/tables/table1.xml'), /autoFilter ref="B7:N8"/);
  assert.ok(!part(zip, '/xl/sharedStrings.xml').includes('Jare'));
});

test('grows beyond template sample rows and updates all totals and print ranges', () => {
  const services = Array.from({ length: 40 }, (_, index) => ({ ...service, folio: `S-${index}`, status: index < 12 ? 'Completado' : 'Pendiente' }));
  const buffer = createServicesWorkbook(templatePath, services, options, 'Cliente');
  const sheet = sheetFrom(buffer);
  assert.equal(sheet.B5.v, 40);
  assert.equal(sheet.D5.v, 12);
  assert.equal(sheet.G47.v, 'S-39');
  assert.equal(sheet.N48.v, 9600);
  assert.equal(sheet.N48.f, 'SUM(N8:N47)');
  assert.equal(sheet.F5.f, 'N48');
  assert.match(part(archive(buffer), '/xl/workbook.xml'), /\$B\$2:\$N\$48/);
  assert.match(part(archive(buffer), '/xl/tables/table1.xml'), /ref="B7:N48"/);
});

test('empty export contains zero summaries and no template examples', () => {
  const sheet = sheetFrom(createServicesWorkbook(templatePath, [], options, 'Cliente'));
  assert.equal(sheet.B5.v, 0);
  assert.equal(sheet.D5.v, 0);
  assert.equal(sheet.F5.v, 0);
  assert.ok(!sheet.B8 || sheet.B8.v === undefined);
  assert.equal(sheet.N9.v, 0);
});

test('unselected costs are not exported and selected final total remains complete', () => {
  const sheet = sheetFrom(createServicesWorkbook(templatePath, [service], { ...options, fields: ['Costo de gasolina', 'Costo final'] }, 'Cliente'));
  assert.ok(!sheet.J8?.v);
  assert.ok(!sheet.K8?.v);
  assert.ok(!sheet.L8?.v);
  assert.equal(sheet.M8.v, 50);
  assert.equal(sheet.N8.v, 240);
  assert.equal(sheet.N8.f, undefined);
  assert.equal(sheet.N9.v, 240);
  const noFinal = sheetFrom(createServicesWorkbook(templatePath, [service], { ...options, fields: ['Costo de servicio'] }, 'Cliente'));
  assert.ok(!noFinal.N8?.v);
  assert.ok(!noFinal.F5?.v);
});

test('filters month, client and company before building export; cancellation writes nothing', () => {
  const database = {
    listServices: () => [service, { ...service, clientId: 3 }, { ...service, date: '2026-08-01' }, { ...service, companyId: 4 }],
    listClients: () => [{ id: 1, name: 'Cliente' }]
  };
  assert.equal(exportServices(database, { ...options, companyId: 2 }, {
    templatePath, dialog: { showSaveDialogSync: () => undefined }
  }), null);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'services-template-'));
  try {
    const filePath = path.join(directory, 'filtered.xlsx');
    assert.equal(exportServices(database, { ...options, companyId: 2 }, {
      templatePath, dialog: { showSaveDialogSync: () => filePath }
    }), filePath);
    const sheet = sheetFrom(fs.readFileSync(filePath));
    assert.equal(sheet.B5.v, 1);
    assert.equal(sheet.N9.v, 240);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
