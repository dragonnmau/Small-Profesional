const {app, BrowserWindow, ipcMain, dialog} = require('electron')
    const url = require("url");
    const path = require("path");
  const { ClientDatabase } = require('./database');
  const XLSX = require('xlsx');
  const fs = require('fs');

    let mainWindow
  let clientDatabase

    function initializeDatabase () {
      if (!clientDatabase) clientDatabase = new ClientDatabase(app.getPath('userData'))
    }

    function createWindow () {
      mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, 'preload.js')
        }
      })

      mainWindow.loadURL(
        url.format({
          pathname: path.join(__dirname, `/dist/sm-pro/browser/index.html`),
          protocol: "file:",
          slashes: true
        })
      );
      // Open the DevTools.
      mainWindow.webContents.openDevTools()

      mainWindow.on('closed', function () {
        mainWindow = null
      })
    }

    ipcMain.on('clients:list', event => { event.returnValue = clientDatabase.listClients() })
    ipcMain.on('linked-companies:list', event => { event.returnValue = clientDatabase.listLinkedCompanies() })
    ipcMain.on('linked-companies:create', (event, company) => { event.returnValue = clientDatabase.createLinkedCompany(company) })
    ipcMain.on('linked-companies:update', (event, request) => { event.returnValue = clientDatabase.updateLinkedCompany(request.id, request.company) })
    ipcMain.on('tax-regimes:list', event => { event.returnValue = clientDatabase.listTaxRegimes() })
    ipcMain.on('tax-settings:get', event => { event.returnValue = clientDatabase.getTaxSettings() })
    ipcMain.on('tax-settings:update', (event, settings) => { event.returnValue = clientDatabase.updateTaxSettings(settings) })
    ipcMain.on('services:list', event => { event.returnValue = clientDatabase.listServices() })
    ipcMain.on('services:create', (event, service) => { event.returnValue = clientDatabase.createService(service) })
    ipcMain.on('services:update', (event, request) => { event.returnValue = clientDatabase.updateService(request.id, request.service) })
    ipcMain.on('services:delete', (event, id) => { clientDatabase.deleteService(id); event.returnValue = true })
    ipcMain.on('service-cities:list', event => { event.returnValue = clientDatabase.listServiceCities() })
    ipcMain.on('service-materials:list', event => { event.returnValue = clientDatabase.listServiceMaterials() })
    ipcMain.on('services:export', (event, options) => {
      const services = clientDatabase.listServices().filter(service =>
        (!options.month || service.date.startsWith(options.month)) &&
        (options.clientId === null || service.clientId === options.clientId) &&
        (options.companyId === null || service.companyId === options.companyId)
      );
      const selectedFields = Array.isArray(options.fields) ? options.fields : [];
      const templatePath = path.join(__dirname, 'public', 'Servicios Del Mes 2026 Plantilla.xlsx');
      const workbook = fs.existsSync(templatePath) ? XLSX.readFile(templatePath) : XLSX.utils.book_new();
      const rows = services.map(service => {
        const row = {
          Fecha: service.date,
          Hora: service.time,
          Folio: service.folio,
          Cliente: service.client,
          Empresa: service.company,
          Ciudad: service.city,
          Sitio: service.site,
          Descripción: service.description,
          Estatus: service.status,
          'Costo de servicio': service.serviceCost,
          Viático: service.travelAllowance,
          'Costo de materiales': service.materialsCost,
          'Costo de transporte': service.transportCost,
          'Costo de gasolina': service.gasolineCost,
          'Costo final': service.serviceCost + service.travelAllowance + service.materialsCost + service.transportCost + service.gasolineCost
        };
        const costFields = new Set(selectedFields);
        return Object.fromEntries(Object.entries(row).filter(([key]) => !['Costo de servicio', 'Viático', 'Costo de materiales', 'Costo de transporte', 'Costo de gasolina', 'Costo final'].includes(key) || costFields.has(key)));
      });
      const sheet = XLSX.utils.json_to_sheet(rows);
      if (workbook.SheetNames.length) workbook.Sheets[workbook.SheetNames[0]] = sheet;
      else XLSX.utils.book_append_sheet(workbook, sheet, 'Servicios del mes');
      const selectedClient = options.clientId === null
        ? 'Todos-los-clientes'
        : clientDatabase.listClients().find(client => client.id === options.clientId)?.name || 'Cliente';
      const safeClientName = selectedClient.replace(/[<>:"/\\|?*\x00-\x1F]/g, '-').trim();
      const monthName = options.month || 'todos-los-meses';
      const filePath = dialog.showSaveDialogSync(mainWindow, {
        title: 'Exportar servicios',
        defaultPath: `Servicios-${safeClientName}-${monthName}.xlsx`,
        filters: [{ name: 'Excel', extensions: ['xlsx'] }]
      });
      if (!filePath) { event.returnValue = null; return; }
      XLSX.writeFile(workbook, filePath);
      event.returnValue = filePath;
    })
    ipcMain.on('clients:create', (event, client) => { event.returnValue = clientDatabase.createClient(client) })
    ipcMain.on('clients:update', (event, request) => { event.returnValue = clientDatabase.updateClient(request.id, request.client) })
    ipcMain.on('clients:update-status', (event, request) => {
      clientDatabase.updateClientStatus(request.id, request.status)
      event.returnValue = true
    })

    app.whenReady().then(() => {
      initializeDatabase()
      createWindow()
      console.log(path.join(app.getPath('userData'), 'SMpro.db'));
    })

    app.on('window-all-closed', function () {
      if (process.platform !== 'darwin') app.quit()
    })

    app.on('activate', function () {
      if (mainWindow === null) {
        initializeDatabase()
        createWindow()
        console.log(path.join(app.getPath('userData'), 'SMpro.db'));
      }
    })
