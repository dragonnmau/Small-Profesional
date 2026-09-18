const {app, BrowserWindow, ipcMain, dialog} = require('electron')
    const url = require("url");
    const path = require("path");
  const { ClientDatabase } = require('./database');
  const { exportServices } = require('./services-template-export');

  const { exportPendingServices } = require('./pending-services-export');

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
    ipcMain.on('account-information:get', event => { event.returnValue = clientDatabase.getAccountInformation() })
    ipcMain.on('account-information:save', (event, information) => { event.returnValue = clientDatabase.saveAccountInformation(information) })
    ipcMain.on('collaborators:list', event => { event.returnValue = clientDatabase.listCollaborators() })
    ipcMain.on('collaborators:create', (event, collaborator) => { event.returnValue = clientDatabase.createCollaborator(collaborator) })
    ipcMain.on('collaborators:update', (event, request) => { event.returnValue = clientDatabase.updateCollaborator(request.id, request.collaborator) })
    ipcMain.on('collaborators:status', (event, request) => { clientDatabase.updateCollaboratorStatus(request); event.returnValue = true })
    for (const [channel, handler] of [
      ['expenses:list', () => clientDatabase.listExpenses()],
      ['bank-accounts:update', request => clientDatabase.updateBankAccount(request)],
      ['bank-cards:update', request => clientDatabase.updateBankCard(request)],
      ['expenses:categories', () => clientDatabase.listExpenseCategories()],
      ['expenses:create-category', name => clientDatabase.createExpenseCategory(name)],
      ['expenses:create', request => clientDatabase.createExpense(request)],
      ['expenses:attachment', request => clientDatabase.getExpenseAttachment(request)]
    ]) {
      ipcMain.on(channel, (event, request) => {
        try { event.returnValue = { value: handler(request) }; }
        catch (error) { event.returnValue = { error: error.message }; }
      });
    }
    ipcMain.on('bank-accounts:list', event => { event.returnValue = clientDatabase.listBankAccounts() })
    ipcMain.on('bank-accounts:create', (event, account) => { event.returnValue = clientDatabase.createBankAccount(account) })
    ipcMain.on('bank-cards:create', (event, card) => {
      try { event.returnValue = { value: clientDatabase.createBankCard(card) }; }
      catch (error) { event.returnValue = { error: error.message }; }
    })
    ipcMain.on('bank-accounts:balance', (event, request) => { event.returnValue = clientDatabase.updateBankBalance(request) })
    ipcMain.on('bank-accounts:deactivate', (event, request) => { clientDatabase.deactivateBankAccount(request); event.returnValue = true })
    ipcMain.on('bank-movements:create', (event, movement) => { event.returnValue = clientDatabase.createBankMovement(movement) })
    ipcMain.on('payments:clients', event => { event.returnValue = clientDatabase.listPaymentClients() })
    ipcMain.handle('payments:export-pending', async (event, options) => {
      try { return { value: await exportPendingServices(clientDatabase, options, { dialog, BrowserWindow, parent: mainWindow }) }; }
      catch (error) { return { error: error.message || 'No se pudieron exportar los servicios.' }; }
    })
    ipcMain.on('payments:services', (event, clientId) => { event.returnValue = clientDatabase.listPaymentServices(clientId) })
    ipcMain.on('invoices:list', event => { event.returnValue = clientDatabase.listInvoices() })
    ipcMain.on('invoices:update-note', (event, request) => {
      try { event.returnValue = { value: clientDatabase.updateInvoiceNote(request) }; }
      catch (error) { event.returnValue = { error: error.message }; }
    })
    ipcMain.on('invoices:create', (event, request) => {
      try { event.returnValue = { value: clientDatabase.createInvoice(request) }; }
      catch (error) { event.returnValue = { error: error.message }; }
    })
    ipcMain.on('payments:details', (event, id) => {
      try { event.returnValue = { value: clientDatabase.listPaidServices(id) }; }
      catch (error) { event.returnValue = { error: error.message }; }
    })
    ipcMain.on('payments:list', event => { event.returnValue = clientDatabase.listPayments() })
    ipcMain.on('payments:create', (event, payment) => {
      try { event.returnValue = { value: clientDatabase.createPayment(payment) }; }
      catch (error) { event.returnValue = { error: error.message }; }
    })
    ipcMain.on('payments:update', (event, request) => {
      try { event.returnValue = { value: clientDatabase.updatePayment(request) }; }
      catch (error) { event.returnValue = { error: error.message }; }
    })
    ipcMain.on('payments:revert', (event, request) => {
      try { event.returnValue = { value: clientDatabase.revertPayment(request) }; }
      catch (error) { event.returnValue = { error: error.message }; }
    })
    ipcMain.on('services:list', event => { event.returnValue = clientDatabase.listServices() })
    ipcMain.on('services:create', (event, service) => { event.returnValue = clientDatabase.createService(service) })
    ipcMain.on('services:update', (event, request) => { event.returnValue = clientDatabase.updateService(request.id, request.service) })
    ipcMain.on('services:delete', (event, id) => { clientDatabase.deleteService(id); event.returnValue = true })
    ipcMain.on('service-cities:list', event => { event.returnValue = clientDatabase.listServiceCities() })
    ipcMain.on('service-materials:list', event => { event.returnValue = clientDatabase.listServiceMaterials() })
    ipcMain.on('services:export', (event, options) => {
      try {
        event.returnValue = { value: exportServices(clientDatabase, options, {
          dialog, parent: mainWindow,
          templatePath: path.join(__dirname, 'public', 'Servicios Del Mes 2026 Plantilla.xlsx')
        }) };
      } catch (error) { event.returnValue = { error: error.message || 'No se pudo exportar la lista de servicios.' }; }
    })
    ipcMain.on('clients:create', (event, client) => {
      try { event.returnValue = { value: clientDatabase.createClient(client) }; }
      catch (error) { event.returnValue = { error: error.message }; }
    })
    ipcMain.on('clients:update', (event, request) => {
      try { event.returnValue = { value: clientDatabase.updateClient(request.id, request.client) }; }
      catch (error) { event.returnValue = { error: error.message }; }
    })
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
