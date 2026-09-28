// Run with: node_modules/.bin/electron quotation-export.smoke.js
const { app, BrowserWindow, nativeImage } = require('electron');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { exportQuotation } = require('./quotation-export');
const { exportPendingServices } = require('./pending-services-export');
app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'quotation-smoke-'));
  const logo = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="150" height="95"><rect width="150" height="95" fill="#2563eb"/><text x="20" y="54" fill="white" font-size="20">EMPRESA</text></svg>').toString('base64')}`;
  const database = {
    getAccountInformation: () => ({ business: { commercialName: 'Empresa de prueba', image: logo }, user: { name: 'Ana Pérez' } }),
    listClients: () => [],
    listCatalogItems: () => [{ id: 1, name: 'Instalación y configuración', kind: 'Servicio', unit: 'Servicio', description: 'Material y mano de obra.' }]
  };
  const options = { clientId: null, temporaryName: 'María López', lines: Array.from({ length: 28 }, () => ({ itemId: 1, quantity: 2, cost: 80 })), payment: 'Anticipo de 50%', delivery: '3 a 5 días', warranty: '1 mes', validityDays: 15, tax: '16', hideTax: true, serviceDetails: 'Revisión de instalaciones y puesta en marcha.\nIncluye capacitación.', margin: 20 };
  try {
    for (const format of ['pdf', 'png']) {
      const filePath = path.join(directory, `cotizacion.${format}`);
      await exportQuotation(database, { ...options, format }, { BrowserWindow, dialog: { showSaveDialog: async () => ({ filePath }) } });
      const buffer = await fs.readFile(filePath);
      assert.ok(buffer.length > 1000);
      if (format === 'pdf') assert.equal(buffer.subarray(0, 4).toString(), '%PDF');
      else {
        const size = nativeImage.createFromBuffer(buffer).getSize();
        assert.ok(size.height > 1200, 'PNG must contain the entire long quote');
        console.log(JSON.stringify({ format, ...size }));
      }
      console.log(filePath);
    }
    const pendingDatabase = {
      getAccountInformation: database.getAccountInformation,
      listPaymentClients: () => [{ id: 1, name: 'María López', businessName: 'Cliente de prueba', rfc: 'RFC-OMITIDO' }],
      listPaymentServices: () => Array.from({ length: 28 }, (_, index) => ({ id: index + 1, folio: `S-${index + 1}`, date: '2026-09-25', company: 'Empresa', site: 'Oficina', description: 'Instalación y configuración', status: 'Pendiente', amount: 150 })),
      listServices: () => Array.from({ length: 28 }, (_, index) => ({ id: index + 1, clientId: 1, serviceCost: index === 0 ? 0 : 100, travelAllowance: 25, materialsCost: 25, materials: [{ name: 'Cable', cost: 25 }] }))
    };
    for (const format of ['pdf', 'png']) {
      const filePath = path.join(directory, `servicios.${format}`);
      await exportPendingServices(pendingDatabase, { clientId: 1, serviceIds: pendingDatabase.listServices().map(service => service.id), format }, { BrowserWindow, dialog: { showSaveDialog: async () => ({ filePath }) } });
      const buffer = await fs.readFile(filePath);
      assert.ok(buffer.length > 1000);
      if (format === 'png') assert.ok(nativeImage.createFromBuffer(buffer).getSize().height > 900);
      else assert.equal(buffer.subarray(0, 4).toString(), '%PDF');
    }
    await fs.writeFile(path.join(directory, 'result.json'), JSON.stringify({ success: true }));
    app.exit(0);
  } catch (error) { await fs.writeFile(path.join(directory, 'result.json'), JSON.stringify({ error: error.stack })); console.error(error); app.exit(1); }
});
