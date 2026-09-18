const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const XLSX = require('xlsx');
const { prepareReport, reportHtml, exportPendingServices } = require('./pending-services-export');

const database = {
  listServices: () => [
    { id: 10, clientId: 1, serviceCost: 100, travelAllowance: 10, materialsCost: 15.5, transportCost: 20, gasolineCost: 5,
      materials: [{ name: 'Cable <UTP>', cost: 12 }, { name: 'Conectores', cost: 3.5 }] },
    { id: 11, clientId: 1, serviceCost: 80, travelAllowance: 0, materialsCost: 0, transportCost: 0, gasolineCost: 0, materials: [] }
  ],
  getAccountInformation: () => ({
    business: { commercialName: 'Paredes & Asociados', image: 'data:image/png;base64,aGVsbG8=' },
    user: { name: 'Ana <Pérez>' }
  }),
  listPaymentClients: () => [{ id: 1, name: 'Cliente <uno>', businessName: 'Empresa', rfc: 'ABC' }],
  listPaymentServices: clientId => clientId === 1 ? [
    { id: 10, folio: 'S-10', date: '2026-09-16', company: 'Empresa', site: 'Sitio', description: '<script>alert(1)</script>', status: 'Pendiente', amount: 125.5 },
    { id: 11, folio: 'S-11', date: '2026-09-16', company: 'Empresa', site: 'Sitio', description: 'Otro', status: 'Pendiente', amount: 80 }
  ] : []
};
const options = { clientId: 1, serviceIds: [10], format: 'xlsx' };

test('includes only selected pending services and rejects stale or foreign IDs', () => {
  const report = prepareReport(database, options);
  assert.equal(report.rows.length, 1);
  assert.equal(report.total, 125.5);
  assert.throws(() => prepareReport(database, { ...options, serviceIds: [10, 99] }), /ya no están pendientes/);
  assert.throws(() => prepareReport(database, { ...options, serviceIds: [] }), /Selecciona/);
  assert.throws(() => prepareReport(database, { ...options, format: 'csv' }), /formato/);
  const html = reportHtml(report);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
});

test('writes Excel with numeric amounts and total, and cancellation writes nothing', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pending-export-'));
  try {
    const filePath = path.join(directory, 'report.xlsx');
    const result = await exportPendingServices(database, options, { dialog: { showSaveDialog: async () => ({ filePath }) } });
    assert.equal(result, filePath);
    const sheet = XLSX.readFile(filePath).Sheets['Servicios pendientes'];
    assert.equal(sheet.A8.v, 'S-10');
    assert.equal(sheet.G8.t, 'n');
    assert.equal(sheet.G8.v, 125.5);
    assert.equal(sheet.G9.v, 125.5);
    assert.equal(await exportPendingServices(database, options, { dialog: { showSaveDialog: async () => ({ canceled: true }) } }), null);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('PDF exports selected report and always closes its hidden window', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pending-pdf-'));
  let destroyed = false;
  class PrintWindow {
    async loadURL(url) {
      const html = decodeURIComponent(url);
      assert.ok(html.includes('S-10'));
      assert.ok(html.includes('Paredes &amp; Asociados'));
      assert.ok(html.includes('Exportado por: Ana &lt;Pérez&gt;'));
      assert.ok(html.includes('<img class="company-logo"'));
      assert.ok(html.includes('<tr class="materials-row">'));
      assert.ok(html.includes('Cable &lt;UTP&gt;'));
      assert.ok(html.includes('Conectores'));
      assert.ok(html.includes('Viáticos'));
    }
    webContents = { printToPDF: async () => Buffer.from('%PDF-test') };
    destroy() { destroyed = true; }
  }
  try {
    const filePath = path.join(directory, 'report.pdf');
    await exportPendingServices(database, { ...options, format: 'pdf' }, {
      dialog: { showSaveDialog: async () => ({ filePath }) }, BrowserWindow: PrintWindow
    });
    assert.equal(await fs.readFile(filePath, 'utf8'), '%PDF-test');
    assert.equal(destroyed, true);
    destroyed = false;
    class FailingWindow extends PrintWindow { async loadURL() { throw new Error('PDF failed'); } }
    await assert.rejects(exportPendingServices(database, { ...options, format: 'pdf' }, {
      dialog: { showSaveDialog: async () => ({ filePath }) }, BrowserWindow: FailingWindow
    }), /PDF failed/);
    assert.equal(destroyed, true);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('PDF breaks down only selected services with itemized materials and preserves the pending amount', () => {
  const report = prepareReport(database, { ...options, format: 'pdf' });
  assert.equal(report.details.length, 1);
  const detail = report.details[0];
  assert.equal(detail.serviceCost + detail.travelAllowance + detail.materialsCost, detail.amount);
  assert.equal(detail.materials.reduce((total, material) => total + material.cost, 0), detail.materialsCost);
  assert.equal(report.total, 125.5);
  const html = reportHtml(report);
  assert.match(html, /<li><span>Cable &lt;UTP&gt;<\/span><strong>\$12\.00<\/strong><\/li>/);
  assert.match(html, /<li><span>Conectores<\/span><strong>\$3\.50<\/strong><\/li>/);
  assert.match(html, /<th>Viáticos \(MXN\)<\/th><th>Importe \(MXN\)<\/th>/);
  assert.match(html, /<td class="money">\$10\.00<\/td>\s*<td class="money">\$125\.50<\/td><\/tr><tr class="materials-row"><td colspan="8">/);
  assert.ok(!html.includes('Transporte'));
  assert.ok(!html.includes('Gasolina'));
  assert.ok(!html.includes('service-breakdown'));
  assert.ok(!html.includes('S-11'));
});

test('PDF omits materials list and extra costs when the service has none', () => {
  const html = reportHtml(prepareReport(database, { ...options, serviceIds: [11], format: 'pdf' }));
  assert.ok(!html.includes('<ul>'));
  assert.ok(!html.includes('<div class="other-costs">'));
  assert.ok(!html.includes('Viáticos'));
  assert.ok(!html.includes('<tr class="materials-row">'));
  assert.ok(html.includes('$80.00'));
});

test('PDF keeps materials directly after the matching row when selecting multiple services', () => {
  const html = reportHtml(prepareReport(database, { ...options, serviceIds: [10, 11], format: 'pdf' }));
  const tableBody = html.match(/<tbody>([\s\S]*?)<\/tbody>/)[1];
  assert.equal((tableBody.match(/class="materials-row"/g) || []).length, 1);
  assert.ok(tableBody.indexOf('S-10') < tableBody.indexOf('Cable &lt;UTP&gt;'));
  assert.ok(tableBody.indexOf('Conectores') < tableBody.indexOf('S-11'));
  assert.match(tableBody, /<td class="money">—<\/td>\s*<td class="money">\$80\.00<\/td>/);
  assert.ok(html.includes('Total pendiente: $205.50'));
});
