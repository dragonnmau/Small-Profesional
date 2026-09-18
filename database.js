const Database = require('better-sqlite3');
const path = require('path');

class ClientDatabase {
  constructor(userDataPath) {
    this.db = new Database(path.join(userDataPath, 'SMpro.db'));
    
    this.db.pragma('journal_mode = WAL');
    this.setupDatabase();
  }

  setupDatabase() {
    this.db.exec(`CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES bank_accounts(id),
      expense_date TEXT NOT NULL, concept TEXT NOT NULL,
      iva_mode TEXT NOT NULL, iva_rate REAL NOT NULL,
      subtotal REAL NOT NULL, iva REAL NOT NULL, total REAL NOT NULL,
      has_invoice INTEGER NOT NULL DEFAULT 0,
      ticket TEXT, invoice TEXT, created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);

    const expenseColumns = this.db.prepare('PRAGMA table_info(expenses)').all();
    if (!expenseColumns.some(column => column.name === 'card_id')) this.db.exec('ALTER TABLE expenses ADD COLUMN card_id INTEGER REFERENCES bank_cards(id)');
    if (!expenseColumns.some(column => column.name === 'billing_month')) this.db.exec("ALTER TABLE expenses ADD COLUMN billing_month TEXT NOT NULL DEFAULT ''");
    if (!expenseColumns.some(column => column.name === 'category')) this.db.exec("ALTER TABLE expenses ADD COLUMN category TEXT NOT NULL DEFAULT ''");
    if (!expenseColumns.some(column => column.name === 'cfdi_use')) this.db.exec("ALTER TABLE expenses ADD COLUMN cfdi_use TEXT NOT NULL DEFAULT ''");
    this.db.exec('CREATE TABLE IF NOT EXISTS expense_categories (name TEXT NOT NULL, normalized_name TEXT NOT NULL UNIQUE)');
    const insertCategory = this.db.prepare('INSERT OR IGNORE INTO expense_categories (name, normalized_name) VALUES (?, ?)');
    for (const name of require('./src/app/services/expense-catalogs.json').categories) insertCategory.run(name, name.toLocaleLowerCase('es-MX'));

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        folio TEXT UNIQUE,
        client_id INTEGER NOT NULL,
        client TEXT NOT NULL,
        rfc TEXT NOT NULL,
        invoice_date TEXT NOT NULL,
        iva_mode TEXT NOT NULL,
        iva_rate REAL NOT NULL,
        subtotal REAL NOT NULL,
        iva REAL NOT NULL,
        total REAL NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS invoice_payments (
        invoice_id INTEGER NOT NULL REFERENCES invoices(id),
        payment_id INTEGER NOT NULL UNIQUE REFERENCES payments(id),
        folio TEXT NOT NULL,
        payment_date TEXT NOT NULL,
        amount REAL NOT NULL,
        PRIMARY KEY (invoice_id, payment_id)
      );
    `);

    const invoiceColumns = this.db.prepare('PRAGMA table_info(invoices)').all();
    if (!invoiceColumns.some(column => column.name === 'note')) this.db.exec("ALTER TABLE invoices ADD COLUMN note TEXT NOT NULL DEFAULT ''");
    if (!invoiceColumns.some(column => column.name === 'person_type')) this.db.exec('ALTER TABLE invoices ADD COLUMN person_type TEXT');
    if (!invoiceColumns.some(column => column.name === 'iva_withheld')) this.db.exec('ALTER TABLE invoices ADD COLUMN iva_withheld REAL NOT NULL DEFAULT 0');

    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE,
        value TEXT
      )
    `).run();
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS company_information (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        commercial_name VARCHAR(150) NOT NULL DEFAULT '',
        person_type VARCHAR(20) NOT NULL DEFAULT 'Fisica',
        company_rfc VARCHAR(13) NOT NULL DEFAULT '',
        address TEXT NOT NULL DEFAULT '',
        image TEXT NOT NULL DEFAULT '',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS user_information (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        name VARCHAR(150) NOT NULL DEFAULT '',
        rfc VARCHAR(13) NOT NULL DEFAULT '',
        password TEXT NOT NULL DEFAULT '',
        email VARCHAR(150) NOT NULL DEFAULT '',
        phone VARCHAR(30) NOT NULL DEFAULT '',
        extension VARCHAR(15) NOT NULL DEFAULT '',
        mobile VARCHAR(30) NOT NULL DEFAULT '',
        profile_image TEXT NOT NULL DEFAULT '',
        user_type VARCHAR(20) NOT NULL DEFAULT 'admin',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS collaborators (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(150) NOT NULL,
        rfc VARCHAR(13) NOT NULL DEFAULT '',
        password TEXT NOT NULL DEFAULT '',
        email VARCHAR(150) NOT NULL DEFAULT '',
        phone VARCHAR(30) NOT NULL DEFAULT '',
        extension VARCHAR(15) NOT NULL DEFAULT '',
        mobile VARCHAR(30) NOT NULL DEFAULT '',
        profile_image TEXT NOT NULL DEFAULT '',
        user_type VARCHAR(30) NOT NULL DEFAULT 'Colaborador',
        status VARCHAR(20) NOT NULL DEFAULT 'Activo',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS bank_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(100) NOT NULL,
        bank VARCHAR(100) NOT NULL,
        account_number VARCHAR(30) NOT NULL,
        balance REAL NOT NULL DEFAULT 0,
        balance_updated_by VARCHAR(150) NOT NULL DEFAULT '',
        balance_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) NOT NULL DEFAULT 'Activa',
        created_by VARCHAR(150) NOT NULL DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS bank_cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        card_type VARCHAR(20) NOT NULL DEFAULT 'Debito',
        last_four VARCHAR(4) NOT NULL,
        holder_name VARCHAR(150) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'Activa',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES bank_accounts(id) ON DELETE CASCADE
      )
    `).run();
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS bank_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        card_id INTEGER,
        movement_type VARCHAR(20) NOT NULL,
        description VARCHAR(200) NOT NULL,
        amount REAL NOT NULL,
        balance_after REAL NOT NULL,
        created_by VARCHAR(150) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES bank_accounts(id) ON DELETE CASCADE,
        FOREIGN KEY (card_id) REFERENCES bank_cards(id) ON DELETE SET NULL
      )
    `).run();
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(30) UNIQUE,
        razon_social VARCHAR(100),
        tax_regime VARCHAR(100),
        rfc VARCHAR(13),
        email VARCHAR(100),
        phone VARCHAR(20),
        contact VARCHAR(100),
        address VARCHAR(100),
        city VARCHAR(50),
        state VARCHAR(50),
        zip VARCHAR(20),
        country VARCHAR(50),
        status VARCHAR(20) DEFAULT 'Activo',
        kind VARCHAR(20) DEFAULT 'Cliente',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS regimenes_fiscales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clave_sat VARCHAR(10) UNIQUE NOT NULL,
        nombre VARCHAR(150) UNIQUE NOT NULL,
        tipo_persona VARCHAR(30) NOT NULL,
        activo INTEGER NOT NULL DEFAULT 1
      )
    `).run();
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS linked_companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        name VARCHAR(100) NOT NULL,
        business_name VARCHAR(150),
        contact VARCHAR(100),
        phone VARCHAR(20),
        email VARCHAR(100),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
        UNIQUE (client_id, name)
      )
    `).run();
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        time TEXT NOT NULL DEFAULT '09:00',
        client_id INTEGER NOT NULL,
        company_id INTEGER,
        city VARCHAR(100),
        site VARCHAR(150),
        description TEXT,
        folio VARCHAR(50),
        status VARCHAR(40) NOT NULL DEFAULT 'Pendiente',
        service_paid VARCHAR(5) NOT NULL DEFAULT 'No',
        service_cost REAL NOT NULL DEFAULT 0,
        travel_allowance REAL NOT NULL DEFAULT 0,
        travel_deposit VARCHAR(10) NOT NULL DEFAULT 'N/A',
        transport_cost REAL NOT NULL DEFAULT 0,
        gasoline_cost REAL NOT NULL DEFAULT 0,
        assigned_user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id),
        FOREIGN KEY (company_id) REFERENCES linked_companies(id)
      )
    `).run();
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS service_materials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_id INTEGER NOT NULL,
        name VARCHAR(150) NOT NULL,
        cost REAL NOT NULL DEFAULT 0,
        FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
      )
    `).run();
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        account_id INTEGER NOT NULL,
        payment_date TEXT NOT NULL,
        invoice_number VARCHAR(80) NOT NULL,
        folio VARCHAR(80) NOT NULL UNIQUE,
        amount REAL NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'Activo',
        created_by VARCHAR(150) NOT NULL DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        reverted_by VARCHAR(150),
        reverted_at DATETIME,
        FOREIGN KEY (account_id) REFERENCES bank_accounts(id),
        FOREIGN KEY (client_id) REFERENCES clients(id)
      )
    `).run();
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS payment_services (
        payment_id INTEGER NOT NULL,
        service_id INTEGER NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        PRIMARY KEY (payment_id, service_id),
        FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
        FOREIGN KEY (service_id) REFERENCES services(id)
      )
    `).run();
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS payment_reversals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payment_id INTEGER NOT NULL,
        reason VARCHAR(250) NOT NULL,
        reverted_by VARCHAR(150) NOT NULL,
        reverted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (payment_id) REFERENCES payments(id)
      )
    `).run();
    this.addColumnIfMissing('tax_regime', 'VARCHAR(100)');
    this.addColumnIfMissing('person_type', 'VARCHAR(20)');
    this.addColumnIfMissing('contact', 'VARCHAR(100)');
    this.addColumnIfMissing('kind', "VARCHAR(20) DEFAULT 'Cliente'");
    this.addServiceColumnIfMissing('time', "TEXT NOT NULL DEFAULT '09:00'");
      this.addServiceColumnIfMissing('service_paid', "VARCHAR(5) NOT NULL DEFAULT 'No'");
    this.addServiceColumnIfMissing('assigned_user_id', 'INTEGER');
    if (!this.db.prepare('PRAGMA table_info(bank_cards)').all().some(column => column.name === 'credit_limit')) this.db.exec('ALTER TABLE bank_cards ADD COLUMN credit_limit REAL');
    if (!this.db.prepare('PRAGMA table_info(bank_cards)').all().some(column => column.name === 'credit_adjustment')) this.db.exec('ALTER TABLE bank_cards ADD COLUMN credit_adjustment REAL NOT NULL DEFAULT 0');
    this.addBankAccountColumnIfMissing('status', "VARCHAR(20) NOT NULL DEFAULT 'Activa'");
    this.addPaymentColumnIfMissing('account_id', 'INTEGER');
    this.addPaymentColumnIfMissing('card_id', 'INTEGER REFERENCES bank_cards(id)');
    this.addPaymentColumnIfMissing('status', "VARCHAR(20) NOT NULL DEFAULT 'Activo'");
    this.addPaymentColumnIfMissing('reverted_by', 'VARCHAR(150)');
    this.addPaymentColumnIfMissing('reverted_at', 'DATETIME');
    this.seedTaxRegimes();
    //this.seedLinkedCompanies();
  }

  listTaxRegimes() {
    console.log('Loading tax regimes from database...');
    let regimes = this.db.prepare(`
      SELECT id, clave_sat AS satCode, nombre AS name, tipo_persona AS personType
      FROM regimenes_fiscales WHERE activo = 1 OR activo IS NULL ORDER BY tipo_persona, nombre
    `).all();
    if (!regimes.length) {
      this.seedTaxRegimes();
      regimes = this.db.prepare(`
        SELECT id, clave_sat AS satCode, nombre AS name, tipo_persona AS personType
        FROM regimenes_fiscales WHERE activo = 1 OR activo IS NULL ORDER BY tipo_persona, nombre
      `).all();
    }
    //console.log('Tax regimes loaded:', regimes);
    return regimes;
  }

  getTaxSettings() {
    const settings = this.db.prepare(`
      SELECT key, value FROM settings WHERE key IN ('iva_rate', 'isr_rate')
    `).all();
    const values = Object.fromEntries(settings.map(setting => [setting.key, Number(setting.value)]));
    return {
      ivaRate: Number.isFinite(values.iva_rate) ? values.iva_rate : 16,
      isrRate: Number.isFinite(values.isr_rate) ? values.isr_rate : 30
    };
  }

  getAccountInformation() {
    const company = this.db.prepare(`
      SELECT commercial_name AS commercialName, person_type AS personType,
        company_rfc AS companyRfc, address, image
      FROM company_information WHERE id = 1
    `).get();
    const user = this.db.prepare(`
      SELECT name, rfc, password, email, phone, extension, mobile,
        profile_image AS image, user_type AS userType
      FROM user_information WHERE id = 1
    `).get();
    if (!company && !user) return null;
    return {
      business: company || { commercialName: '', personType: 'Fisica', companyRfc: '', address: '', image: '' },
      user: user || { name: '', rfc: '', password: '', email: '', phone: '', extension: '', mobile: '', image: '', userType: 'admin' }
    };
  }

  saveAccountInformation(information) {
    const saveCompany = this.db.prepare(`
      INSERT INTO company_information (id, commercial_name, person_type, company_rfc, address, image, updated_at)
      VALUES (1, @commercialName, @personType, @companyRfc, @address, @image, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET commercial_name = excluded.commercial_name,
        person_type = excluded.person_type, company_rfc = excluded.company_rfc,
        address = excluded.address, image = excluded.image, updated_at = CURRENT_TIMESTAMP
    `);
    const saveUser = this.db.prepare(`
      INSERT INTO user_information (id, name, rfc, password, email, phone, extension, mobile, profile_image, user_type, updated_at)
      VALUES (1, @name, @rfc, @password, @email, @phone, @extension, @mobile, @image, @userType, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, rfc = excluded.rfc,
        password = excluded.password, email = excluded.email, phone = excluded.phone,
        extension = excluded.extension, mobile = excluded.mobile,
        profile_image = excluded.profile_image, user_type = excluded.user_type, updated_at = CURRENT_TIMESTAMP
    `);
    this.db.transaction(() => {
      saveCompany.run(information.business);
      saveUser.run(information.user);
    })();
    return this.getAccountInformation();
  }

  listExpenseCategories() {
    return this.db.prepare('SELECT name FROM expense_categories ORDER BY rowid').all().map(row => row.name);
  }

  createExpenseCategory(value) {
    const name = require('./expense-validation').validateCategory(value);
    const normalized = name.toLocaleLowerCase('es-MX');
    this.db.prepare('INSERT OR IGNORE INTO expense_categories (name, normalized_name) VALUES (?, ?)').run(name, normalized);
    return this.db.prepare('SELECT name FROM expense_categories WHERE normalized_name = ?').get(normalized).name;
  }

  listExpenses() {
    return this.db.prepare(`SELECT e.id, e.account_id AS accountId, a.name AS accountName, a.bank,
      e.expense_date AS expenseDate, e.concept, e.iva_mode AS ivaMode, e.iva_rate AS ivaRate,
      e.subtotal, e.iva, e.total, e.has_invoice AS hasInvoice, e.category, e.cfdi_use AS cfdiUse, e.billing_month AS billingMonth,
      e.card_id AS cardId, bc.card_type AS cardType, bc.last_four AS cardLastFour,
      json_extract(e.ticket, '$.name') AS ticketName, json_extract(e.invoice, '$.name') AS invoiceName,
      e.created_by AS createdBy, e.created_at AS createdAt
      FROM expenses e JOIN bank_accounts a ON a.id = e.account_id LEFT JOIN bank_cards bc ON bc.id = e.card_id ORDER BY e.expense_date DESC, e.id DESC`)
      .all().map(row => ({ ...row, hasInvoice: !!row.hasInvoice }));
  }

  getExpenseAttachment({ id, kind }) {
    if (!['ticket', 'invoice'].includes(kind)) throw new Error('Tipo de archivo inválido.');
    const row = this.db.prepare(`SELECT ${kind} AS attachment FROM expenses WHERE id = ?`).get(id);
    if (!row?.attachment) throw new Error('Archivo no encontrado.');
    return JSON.parse(row.attachment);
  }

  createExpense(request) {
    const { validateExpense } = require('./expense-validation');
    const expense = validateExpense(request, this.getTaxSettings().ivaRate);
    return this.db.transaction(() => {
      expense.cardId = this.validateOperationCard(expense.accountId, request.cardId);
      const account = this.db.prepare("SELECT balance FROM bank_accounts WHERE id = ? AND status = 'Activa'").get(expense.accountId);
      if (!account) throw new Error('Selecciona una cuenta bancaria activa.');
      const category = this.listExpenseCategories().find(name => name.toLocaleLowerCase('es-MX') === expense.category.toLocaleLowerCase('es-MX'));
      if (!category) throw new Error('Selecciona una categoría existente o agrega una nueva.');
      expense.category = category;
      const result = this.db.prepare(`INSERT INTO expenses
        (account_id, expense_date, concept, iva_mode, iva_rate, subtotal, iva, total, has_invoice, ticket, invoice, created_by, category, cfdi_use, billing_month, card_id)
        VALUES (@accountId, @expenseDate, @concept, @ivaMode, @ivaRate, @subtotal, @iva, @total, @hasInvoice, @ticket, @invoice, @createdBy, @category, @cfdiUse, @billingMonth, @cardId)`)
        .run({ ...expense, hasInvoice: expense.hasInvoice ? 1 : 0,
          ticket: expense.ticket ? JSON.stringify(expense.ticket) : null,
          invoice: expense.invoice ? JSON.stringify(expense.invoice) : null });
      const id = Number(result.lastInsertRowid);
      const balance = Math.round((account.balance - expense.total) * 100) / 100;
      this.db.prepare(`INSERT INTO bank_movements
        (account_id, card_id, movement_type, description, amount, balance_after, created_by)
        VALUES (?, ?, 'Egreso', ?, ?, ?, ?)`).run(expense.accountId, expense.cardId, `Gasto #${id} · ${expense.expenseDate}: ${expense.concept}`, expense.total, balance, expense.createdBy);
      this.db.prepare(`UPDATE bank_accounts SET balance = ?, balance_updated_by = ?, balance_updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .run(balance, expense.createdBy, expense.accountId);
      return this.listExpenses().find(item => item.id === id);
    })();
  }

  listBankAccounts() {
    const accounts = this.db.prepare(`
      SELECT id, name, bank, account_number AS accountNumber, balance,
        balance_updated_by AS balanceUpdatedBy, balance_updated_at AS balanceUpdatedAt,
        COALESCE(status, 'Activa') AS status
      FROM bank_accounts WHERE COALESCE(status, 'Activa') = 'Activa' ORDER BY id DESC
    `).all();
    const cards = this.db.prepare(`
      SELECT id, account_id AS accountId, card_type AS cardType, last_four AS lastFour,
        holder_name AS holderName, credit_limit AS creditLimit, credit_adjustment AS creditAdjustment, status FROM bank_cards ORDER BY id DESC
    `).all();
    const movements = this.db.prepare(`
      SELECT id, account_id AS accountId, card_id AS cardId, movement_type AS type,
        description, amount, balance_after AS balanceAfter, created_by AS createdBy,
        created_at AS createdAt FROM bank_movements ORDER BY id DESC
    `).all();
    return accounts.map(account => ({
      ...account,
      cards: cards.filter(card => card.accountId === account.id).map(card => {
        const usedCents = movements.filter(movement => movement.cardId === card.id)
          .reduce((total, movement) => total + (movement.type === 'Egreso' ? 1 : -1) * Math.round(movement.amount * 100), 0);
        return { ...card, availableCredit: card.cardType === 'Credito' && card.creditLimit !== null
          ? (Math.round(card.creditLimit * 100) - Math.max(0, usedCents + Math.round(card.creditAdjustment * 100))) / 100 : null };
      }),
      movements: movements.filter(movement => movement.accountId === account.id).slice(0, 10)
    }));
  }

  updateBankAccount({ id, account }) {
    if (typeof account?.name !== 'string' || !account.name.trim() || account.name.trim().length > 150 || typeof account.bank !== 'string' || !account.bank.trim() || account.bank.trim().length > 100 || typeof account.accountNumber !== 'string' || account.accountNumber.length > 30) throw new Error('Revisa el nombre, banco y número de cuenta.');
    const result = this.db.prepare("UPDATE bank_accounts SET name = ?, bank = ?, account_number = ? WHERE id = ? AND status = 'Activa'")
      .run(account.name.trim(), account.bank.trim(), account.accountNumber.trim(), id);
    if (!result.changes) throw new Error('Cuenta bancaria no encontrada o inactiva.');
    return this.listBankAccounts().find(item => item.id === id);
  }

  updateBankCard({ id, card }) {
    return this.db.transaction(() => {
    if (!card || !['Debito', 'Credito'].includes(card.cardType) || !/^\d{4}$/.test(card.lastFour) || typeof card.holderName !== 'string' || !card.holderName.trim() || card.holderName.trim().length > 150) throw new Error('Revisa el tipo de tarjeta, los cuatro dígitos y el titular.');
    const creditLimit = card.cardType === 'Credito' ? card.creditLimit ?? null : null;
    if (creditLimit !== null && (typeof creditLimit !== 'number' || !Number.isFinite(creditLimit) || creditLimit <= 0 || creditLimit > 999999999.99 || Math.abs(creditLimit * 100 - Math.round(creditLimit * 100)) > 0.0001)) throw new Error('Ingresa un límite de crédito positivo con máximo dos decimales.');
    const existing = this.db.prepare('SELECT credit_adjustment FROM bank_cards WHERE id = ? AND account_id = ?').get(id, card.accountId);
    if (!existing) throw new Error('Tarjeta no encontrada.');
    let adjustment = card.cardType === 'Credito' ? existing.credit_adjustment : 0;
    if (card.cardType === 'Credito' && card.availableCredit !== undefined) {
      const available = card.availableCredit;
      if (creditLimit === null || typeof available !== 'number' || !Number.isFinite(available) || available > creditLimit || available < -999999999.99 || Math.abs(available * 100 - Math.round(available * 100)) > 0.0001) throw new Error('El disponible debe ser un importe con máximo dos decimales y no superar el límite de crédito.');
      const usedCents = this.db.prepare('SELECT movement_type, amount FROM bank_movements WHERE card_id = ?').all(id)
        .reduce((sum, movement) => sum + (movement.movement_type === 'Egreso' ? 1 : -1) * Math.round(movement.amount * 100), 0);
      adjustment = (Math.round(creditLimit * 100) - Math.round(available * 100) - usedCents) / 100;
    }
    const result = this.db.prepare(`UPDATE bank_cards SET card_type = ?, last_four = ?, holder_name = ?, credit_limit = ?, credit_adjustment = ?
      WHERE id = ? AND account_id = ? AND EXISTS (SELECT 1 FROM bank_accounts WHERE id = bank_cards.account_id AND status = 'Activa')`)
      .run(card.cardType, card.lastFour, card.holderName.trim(), creditLimit, adjustment, id, card.accountId);
    if (!result.changes) throw new Error('Tarjeta no encontrada en una cuenta activa.');
    return this.listBankAccounts().find(account => account.id === card.accountId).cards.find(item => item.id === id);
    })();
  }

  createBankAccount(account) {
    const result = this.db.prepare(`
      INSERT INTO bank_accounts (name, bank, account_number, balance, balance_updated_by, created_by)
      VALUES (@name, @bank, @accountNumber, @initialBalance, @createdBy, @createdBy)
    `).run(account);
    return this.listBankAccounts().find(item => item.id === Number(result.lastInsertRowid));
  }

  createBankCard(card) {
    const creditLimit = card.cardType === 'Credito' ? card.creditLimit ?? null : null;
    if (creditLimit !== null && (typeof creditLimit !== 'number' || !Number.isFinite(creditLimit) || creditLimit <= 0 || creditLimit > 999999999.99 || Math.abs(creditLimit * 100 - Math.round(creditLimit * 100)) > 0.0001)) throw new Error('Ingresa un límite de crédito positivo con máximo dos decimales.');
    const result = this.db.prepare(`
      INSERT INTO bank_cards (account_id, card_type, last_four, holder_name, credit_limit)
      VALUES (@accountId, @cardType, @lastFour, @holderName, @creditLimit)
    `).run({ ...card, creditLimit });
    return this.db.prepare(`
      SELECT id, account_id AS accountId, card_type AS cardType, last_four AS lastFour,
        holder_name AS holderName, credit_limit AS creditLimit, status FROM bank_cards WHERE id = ?
    `).get(Number(result.lastInsertRowid));
  }

  deactivateBankAccount(request) {
    this.db.prepare(`
      UPDATE bank_accounts SET status = 'Baja', balance_updated_by = @updatedBy,
        balance_updated_at = CURRENT_TIMESTAMP WHERE id = @accountId
    `).run(request);
  }

  updateBankBalance(request) {
    this.db.prepare(`
      UPDATE bank_accounts SET balance = @balance, balance_updated_by = @updatedBy,
        balance_updated_at = CURRENT_TIMESTAMP WHERE id = @accountId
    `).run(request);
    return this.listBankAccounts().find(item => item.id === request.accountId);
  }

  createBankMovement(movement) {
    const account = this.db.prepare('SELECT balance FROM bank_accounts WHERE id = ?').get(movement.accountId);
    if (!account) throw new Error('Cuenta bancaria no encontrada.');
    const balanceAfter = Number(account.balance) + (movement.type === 'Ingreso' ? Number(movement.amount) : -Number(movement.amount));
    this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO bank_movements (account_id, card_id, movement_type, description, amount, balance_after, created_by)
        VALUES (@accountId, @cardId, @type, @description, @amount, @balanceAfter, @createdBy)
      `).run({ ...movement, balanceAfter });
      this.db.prepare(`
        UPDATE bank_accounts SET balance = ?, balance_updated_by = ?, balance_updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(balanceAfter, movement.createdBy, movement.accountId);
    })();
    return this.listBankAccounts().find(item => item.id === movement.accountId);
  }

  updateTaxSettings(settings) {
    const saveSetting = this.db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    this.db.transaction(() => {
      saveSetting.run('iva_rate', String(settings.ivaRate));
      saveSetting.run('isr_rate', String(settings.isrRate));
    })();
    return this.getTaxSettings();
  }

  listServices() {
    const services = this.db.prepare(`
      SELECT s.id, s.date, s.time, s.client_id AS clientId, c.name AS client,
        s.company_id AS companyId, COALESCE(lc.name, '') AS company, s.city, s.site,
        s.description, s.folio, s.status, s.service_paid AS servicePaid, s.service_cost AS serviceCost,
        s.travel_allowance AS travelAllowance, s.travel_deposit AS travelDeposit,
        COALESCE((SELECT SUM(sm.cost) FROM service_materials sm WHERE sm.service_id = s.id), 0) AS materialsCost,
        s.transport_cost AS transportCost, s.gasoline_cost AS gasolineCost,
        s.assigned_user_id AS assignedUserId,
        COALESCE(col.name, CASE WHEN s.assigned_user_id IS NULL THEN COALESCE(ui.name, 'Administrador') ELSE 'Usuario no encontrado' END) AS assignedUserName
      FROM services s
      JOIN clients c ON c.id = s.client_id
      LEFT JOIN linked_companies lc ON lc.id = s.company_id
      LEFT JOIN collaborators col ON col.id = s.assigned_user_id
      LEFT JOIN user_information ui ON ui.id = 1
      ORDER BY s.date DESC, s.id DESC
    `).all();
    const materials = this.db.prepare('SELECT service_id AS serviceId, name, cost FROM service_materials ORDER BY id').all();
    return services.map(service => ({ ...service, materials: materials.filter(material => material.serviceId === service.id).map(({ name, cost }) => ({ name, cost })) }));
  }

  listCollaborators() {
    const admin = this.db.prepare(`
      SELECT 0 AS id, name, rfc, password, email, phone, extension, mobile,
        profile_image AS image, 'Admin' AS userType, 'Activo' AS status
      FROM user_information WHERE id = 1
    `).get();
    const collaborators = this.db.prepare(`
      SELECT id, name, rfc, password, email, phone, extension, mobile,
        profile_image AS image, user_type AS userType, status
      FROM collaborators ORDER BY id DESC
    `).all();
    return admin ? [admin, ...collaborators] : collaborators;
  }

  createCollaborator(collaborator) {
    const result = this.db.prepare(`
      INSERT INTO collaborators (name, rfc, password, email, phone, extension, mobile, profile_image, user_type)
      VALUES (@name, @rfc, @password, @email, @phone, @extension, @mobile, @image, @userType)
    `).run(collaborator);
    return this.listCollaborators().find(item => item.id === Number(result.lastInsertRowid));
  }

  updateCollaborator(id, collaborator) {
    this.db.prepare(`
      UPDATE collaborators SET name = @name, rfc = @rfc, password = @password,
        email = @email, phone = @phone, extension = @extension, mobile = @mobile,
        profile_image = @image, user_type = @userType, updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run({ ...collaborator, id });
    return this.listCollaborators().find(item => item.id === id);
  }

  updateCollaboratorStatus(request) {
    if (request.id === 0) throw new Error('El usuario administrador principal no puede darse de baja.');
    this.db.prepare('UPDATE collaborators SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(request.status, request.id);
  }

  listInvoices() {
    return this.db.prepare(`SELECT id, folio, client_id AS clientId, client, rfc, note,
      invoice_date AS invoiceDate, iva_mode AS ivaMode, iva_rate AS ivaRate,
      subtotal, iva, iva_withheld AS ivaWithheld, person_type AS personType, total, created_by AS createdBy, created_at AS createdAt
      FROM invoices ORDER BY id DESC`).all().map(invoice => ({ ...invoice,
        payments: this.db.prepare(`SELECT payment_id AS id, folio, payment_date AS paymentDate, amount
          FROM invoice_payments WHERE invoice_id = ? ORDER BY payment_id`).all(invoice.id)
      }));
  }

  createInvoice(request) {
    return this.db.transaction(() => {
      if (request.note != null && typeof request.note !== 'string') throw new Error('La nota debe ser texto.');
      const note = (request.note ?? '').trim();
      const client = this.db.prepare('SELECT name, razon_social AS businessName, rfc FROM clients WHERE id = ?').get(request.clientId);
      if (!client?.rfc?.trim()) throw new Error('El cliente debe tener un RFC registrado.');
      const date = request.invoiceDate;
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error('Fecha de factura inválida.');
      if (!['added', 'included'].includes(request.ivaMode)) throw new Error('Selecciona una modalidad de IVA válida.');
      const ids = request.paymentIds;
      if (!Array.isArray(ids) || !ids.length || ids.some(id => !Number.isSafeInteger(id)) || new Set(ids).size !== ids.length) throw new Error('Selecciona al menos un pago, sin duplicados.');
      const payments = ids.map(id => this.db.prepare(`SELECT id, folio, payment_date AS paymentDate, amount FROM payments
        WHERE id = ? AND client_id = ? AND status = 'Activo'
        AND NOT EXISTS (SELECT 1 FROM invoice_payments WHERE payment_id = payments.id)`).get(id, request.clientId));
      if (payments.some(payment => !payment || !Number.isFinite(payment.amount) || payment.amount <= 0)) throw new Error('Los pagos deben estar activos, pertenecer al cliente y no estar facturados.');
      const ivaRate = this.getTaxSettings().ivaRate;
      if (!Number.isFinite(ivaRate) || ivaRate < 0 || ivaRate > 100) throw new Error('La tasa de IVA configurada no es válida.');
      const amount = payments.reduce((sum, payment) => sum + Math.round(payment.amount * 100), 0);
      const subtotal = request.ivaMode === 'included' ? Math.round(amount / (1 + ivaRate / 100)) : amount;
      const iva = request.ivaMode === 'included' ? amount - subtotal : Math.round(subtotal * ivaRate / 100);
      const rfc = client.rfc.trim().toUpperCase();
      const id = Number(this.db.prepare(`INSERT INTO invoices
        (client_id, client, rfc, invoice_date, iva_mode, iva_rate, subtotal, iva, total, created_by, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(request.clientId, client.businessName || client.name, rfc,
        date, request.ivaMode, ivaRate, subtotal / 100, iva / 100, (subtotal + iva) / 100, request.createdBy || 'Administrador', note).lastInsertRowid);
      const folio = `${date.replaceAll('-', '')}-${String(id).padStart(6, '0')}`;
      this.db.prepare('UPDATE invoices SET folio = ? WHERE id = ?').run(folio, id);
      const insert = this.db.prepare('INSERT INTO invoice_payments (invoice_id, payment_id, folio, payment_date, amount) VALUES (?, ?, ?, ?, ?)');
      payments.forEach(payment => insert.run(id, payment.id, payment.folio, payment.paymentDate, payment.amount));
      return this.listInvoices().find(invoice => invoice.id === id);
    }).immediate();
  }

  updateInvoiceNote({ id, note }) {
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Factura inválida.');
    if (typeof note !== 'string') throw new Error('La nota debe ser texto.');
    const result = this.db.prepare('UPDATE invoices SET note = ? WHERE id = ?').run(note.trim(), id);
    if (!result.changes) throw new Error('La factura no existe.');
    return this.listInvoices().find(invoice => invoice.id === id);
  }

  listPaymentClients() {
    return this.db.prepare(`
      SELECT DISTINCT c.id, c.name, COALESCE(c.razon_social, '') AS businessName, COALESCE(c.rfc, '') AS rfc
      FROM clients c JOIN services s ON s.client_id = c.id
      WHERE COALESCE(s.service_paid, 'No') <> 'Si'
        AND LOWER(TRIM(COALESCE(s.status, ''))) <> 'pagado'
        AND LOWER(TRIM(COALESCE(s.status, ''))) NOT LIKE 'cancelad%'
        AND LOWER(TRIM(COALESCE(s.status, ''))) NOT LIKE 'canceled%'
        AND LOWER(TRIM(COALESCE(s.status, ''))) NOT LIKE 'cancelled%'
      ORDER BY c.name COLLATE NOCASE
    `).all();
  }

  listPaymentServices(clientId) {
    return this.db.prepare(`
      SELECT s.id, s.date, s.time, s.client_id AS clientId, s.company_id AS companyId,
        COALESCE(lc.name, 'Sin empresa') AS company, COALESCE(s.site, '') AS site, s.description, s.folio, s.status,
        COALESCE(s.service_cost, 0) + COALESCE(s.travel_allowance, 0) +
        COALESCE((SELECT SUM(sm.cost) FROM service_materials sm WHERE sm.service_id = s.id), 0) AS amount
      FROM services s LEFT JOIN linked_companies lc ON lc.id = s.company_id
      WHERE s.client_id = ? AND COALESCE(s.service_paid, 'No') <> 'Si'
        AND LOWER(TRIM(COALESCE(s.status, ''))) <> 'pagado'
        AND LOWER(TRIM(COALESCE(s.status, ''))) NOT LIKE 'cancelad%'
        AND LOWER(TRIM(COALESCE(s.status, ''))) NOT LIKE 'canceled%'
        AND LOWER(TRIM(COALESCE(s.status, ''))) NOT LIKE 'cancelled%'
      ORDER BY s.date DESC, s.id DESC
    `).all(clientId);
  }

  listPaidServices(paymentId) {
    return this.db.prepare(`
      SELECT ps.service_id AS id, COALESCE(s.folio, '') AS folio,
        COALESCE(s.description, 'Servicio no disponible') AS description,
        COALESCE(s.date, '') AS date, COALESCE(s.site, '') AS site,
        COALESCE(lc.name, '') AS company, ps.amount
      FROM payment_services ps
      LEFT JOIN services s ON s.id = ps.service_id
      LEFT JOIN linked_companies lc ON lc.id = s.company_id
      WHERE ps.payment_id = ? ORDER BY ps.service_id
    `).all(paymentId);
  }

  listPayments() {
    return this.db.prepare(`
      SELECT p.id, p.client_id AS clientId, c.name AS client, p.account_id AS accountId,
        COALESCE(ba.name, 'Sin cuenta') AS accountName, COALESCE(ba.bank, '') AS bank,
        p.card_id AS cardId, bc.card_type AS cardType, bc.last_four AS cardLastFour,
        p.payment_date AS paymentDate, p.invoice_number AS invoiceNumber, p.folio, p.amount,
        i.id AS invoiceId, i.folio AS invoiceFolio,
        COALESCE(p.status, 'Activo') AS status, p.created_by AS createdBy, p.created_at AS createdAt,
        p.reverted_by AS revertedBy, p.reverted_at AS revertedAt
      FROM payments p JOIN clients c ON c.id = p.client_id
      LEFT JOIN bank_accounts ba ON ba.id = p.account_id
      LEFT JOIN bank_cards bc ON bc.id = p.card_id
      LEFT JOIN invoice_payments ip ON ip.payment_id = p.id
      LEFT JOIN invoices i ON i.id = ip.invoice_id
      ORDER BY p.payment_date DESC, p.id DESC
    `).all();
  }

  validateOperationCard(accountId, cardId) {
    if (cardId == null) return null;
    if (!Number.isSafeInteger(cardId) || !this.db.prepare("SELECT id FROM bank_cards WHERE id = ? AND account_id = ? AND status = 'Activa'").get(cardId, accountId)) throw new Error('Selecciona una tarjeta activa de la cuenta elegida.');
    return cardId;
  }

  createPayment(payment) {
    return this.db.transaction(() => {
    payment = { ...payment, cardId: this.validateOperationCard(payment.accountId, payment.cardId) };
    if (!Array.isArray(payment.serviceIds) || !payment.serviceIds.length || new Set(payment.serviceIds).size !== payment.serviceIds.length) throw new Error('Selecciona servicios sin duplicados.');
    const date = payment.paymentDate;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error('Fecha de pago inv?lida.');
    const account = this.db.prepare("SELECT id, balance FROM bank_accounts WHERE id = ? AND COALESCE(status, 'Activa') = 'Activa'").get(payment.accountId);
    if (!account) throw new Error('Selecciona una cuenta bancaria activa.');
    const services = payment.serviceIds.map(serviceId => this.db.prepare(`
      SELECT s.id, s.client_id AS clientId,
        COALESCE(s.service_cost, 0) + COALESCE(s.travel_allowance, 0) +
        COALESCE((SELECT SUM(sm.cost) FROM service_materials sm WHERE sm.service_id = s.id), 0) AS amount
      FROM services s WHERE s.id = ? AND s.client_id = ?
        AND COALESCE(s.service_paid, 'No') <> 'Si'
        AND LOWER(TRIM(COALESCE(s.status, ''))) <> 'pagado'
        AND LOWER(TRIM(COALESCE(s.status, ''))) NOT LIKE 'cancelad%'
        AND LOWER(TRIM(COALESCE(s.status, ''))) NOT LIKE 'canceled%'
        AND LOWER(TRIM(COALESCE(s.status, ''))) NOT LIKE 'cancelled%'
    `).get(serviceId, payment.clientId));
    if (!services.length || services.some(service => !service)) throw new Error('Uno o mas servicios ya no estan disponibles para pago.');
    const client = this.db.prepare('SELECT name, rfc FROM clients WHERE id = ?').get(payment.clientId);
    if (!client) throw new Error('Cliente no encontrado.');
    const sequence = Number(this.db.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'payments'").get()?.seq || 0) + 1;
    const prefix = ((client.rfc || '').match(/[A-Za-zÑñ&]/g) || []).join('').slice(0, 4).toUpperCase().padEnd(4, 'X');
    const folio = prefix + '-' + date.replaceAll('-', '').slice(2, 6) + '-' + sequence;
    const amount = services.reduce((total, service) => total + Number(service.amount), 0);
    const savePayment = this.db.prepare(`
      INSERT INTO payments (id, client_id, account_id, payment_date, invoice_number, folio, amount, status, created_by, card_id)
      VALUES (@id, @clientId, @accountId, @paymentDate, '', @folio, @amount, 'Activo', @createdBy, @cardId)
    `);
    const saveService = this.db.prepare(`
      INSERT INTO payment_services (payment_id, service_id, amount) VALUES (?, ?, ?)
    `);
    const markService = this.db.prepare(`
      UPDATE services SET service_paid = 'Si', status = 'Pagado', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    const addBankMovement = this.db.prepare(`
      INSERT INTO bank_movements (account_id, card_id, movement_type, description, amount, balance_after, created_by)
      VALUES (@accountId, @cardId, 'Ingreso', @description, @amount, @balanceAfter, @createdBy)
    `);
    const updateAccount = this.db.prepare(`
      UPDATE bank_accounts SET balance = @balanceAfter, balance_updated_by = @createdBy,
        balance_updated_at = CURRENT_TIMESTAMP WHERE id = @accountId
    `);
    let paymentId;
    this.db.transaction(() => {
      paymentId = Number(savePayment.run({ ...payment, id: sequence, folio, amount }).lastInsertRowid);
      services.forEach(service => { saveService.run(paymentId, service.id, service.amount); markService.run(service.id); });
      const balanceAfter = Number(account.balance) + amount;
      addBankMovement.run({ accountId: payment.accountId, cardId: payment.cardId, description: `Pago recibido ${folio}`, amount, balanceAfter, createdBy: payment.createdBy });
      updateAccount.run({ accountId: payment.accountId, balanceAfter, createdBy: payment.createdBy });
    })();
    return this.listPayments().find(item => item.id === paymentId);
    }).immediate();
  }

  updatePayment(request) {
    this.db.prepare(`
      UPDATE payments SET payment_date = @paymentDate
      WHERE id = @id AND COALESCE(status, 'Activo') = 'Activo'
    `).run(request);
    return this.listPayments().find(item => item.id === request.id);
  }

  revertPayment(request) {
    if (this.db.prepare('SELECT 1 FROM invoice_payments WHERE payment_id = ?').get(request.id)) throw new Error('No se puede revertir un pago que ya está facturado.');
    const payment = this.db.prepare(`SELECT id, account_id AS accountId, card_id AS cardId, amount, status FROM payments WHERE id = ?`).get(request.id);
    if (!payment) throw new Error('Pago no encontrado.');
    if (payment.status === 'Revertido') throw new Error('Este pago ya fue revertido.');
    const services = this.db.prepare('SELECT service_id AS serviceId FROM payment_services WHERE payment_id = ?').all(request.id);
    const account = this.db.prepare('SELECT balance FROM bank_accounts WHERE id = ?').get(payment.accountId);
    if (!account) throw new Error('La cuenta bancaria del pago ya no existe.');
    const balanceAfter = Number(account.balance) - Number(payment.amount);
    const restoreServices = this.db.prepare(`UPDATE services SET service_paid = 'No', status = 'Pendiente', updated_at = CURRENT_TIMESTAMP WHERE id IN (${services.map(() => '?').join(',') || 'NULL'})`);
    this.db.transaction(() => {
      this.db.prepare(`UPDATE payments SET status = 'Revertido', reverted_by = @revertedBy, reverted_at = CURRENT_TIMESTAMP WHERE id = @id`).run(request);
      this.db.prepare('INSERT INTO payment_reversals (payment_id, reason, reverted_by) VALUES (@id, @reason, @revertedBy)').run(request);
      restoreServices.run(...services.map(service => service.serviceId));
      this.db.prepare(`INSERT INTO bank_movements (account_id, card_id, movement_type, description, amount, balance_after, created_by) VALUES (?, ?, 'Egreso', ?, ?, ?, ?)`).run(payment.accountId, payment.cardId, `Reversion ${request.id}: ${request.reason}`, payment.amount, balanceAfter, request.revertedBy);
      this.db.prepare(`UPDATE bank_accounts SET balance = ?, balance_updated_by = ?, balance_updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(balanceAfter, request.revertedBy, payment.accountId);
    })();
    return this.listPayments().find(item => item.id === request.id);
  }

  createService(service) {
    const insertService = this.db.prepare(`
        INSERT INTO services (date, time, client_id, company_id, city, site, description, folio, status, service_paid,
        service_cost, travel_allowance, travel_deposit, transport_cost, gasoline_cost, assigned_user_id)
      VALUES (@date, @time, @clientId, @companyId, @city, @site, @description, @folio, @status, @servicePaid,
        @serviceCost, @travelAllowance, @travelDeposit, @transportCost, @gasolineCost, @assignedUserId)
    `);
    const insertMaterial = this.db.prepare('INSERT INTO service_materials (service_id, name, cost) VALUES (?, ?, ?)');
    let id;
    this.db.transaction(() => {
      id = Number(insertService.run(service).lastInsertRowid);
      service.materials.forEach(material => insertMaterial.run(id, material.name, material.cost));
    })();
    return this.listServices().find(item => item.id === id);
  }

  updateService(id, service) {
    const update = this.db.prepare(`
      UPDATE services SET date = @date, time = @time, client_id = @clientId, company_id = @companyId, city = @city,
        site = @site, description = @description, folio = @folio, status = @status, service_paid = @servicePaid,
        service_cost = @serviceCost, travel_allowance = @travelAllowance, travel_deposit = @travelDeposit,
        transport_cost = @transportCost, gasoline_cost = @gasolineCost, assigned_user_id = @assignedUserId, updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `);
    const replaceMaterials = this.db.prepare('INSERT INTO service_materials (service_id, name, cost) VALUES (?, ?, ?)');
    this.db.transaction(() => {
      update.run({ ...service, id });
      this.db.prepare('DELETE FROM service_materials WHERE service_id = ?').run(id);
      service.materials.forEach(material => replaceMaterials.run(id, material.name, material.cost));
    })();
    return this.listServices().find(item => item.id === id);
  }

  deleteService(id) {
    this.db.prepare('DELETE FROM services WHERE id = ?').run(id);
  }

  listServiceCities() {
    return this.db.prepare(`SELECT DISTINCT city FROM services WHERE TRIM(COALESCE(city, '')) <> '' ORDER BY city COLLATE NOCASE`).all().map(item => item.city);
  }

  listServiceMaterials() {
    return this.db.prepare(`SELECT DISTINCT name FROM service_materials WHERE TRIM(name) <> '' ORDER BY name COLLATE NOCASE`).all().map(item => item.name);
  }

  listClients() {
    return this.db.prepare(`
      SELECT id, kind, name, razon_social AS businessName, COALESCE(rfc, '') AS rfc, person_type AS personType, tax_regime AS taxRegime,
        address, zip AS postalCode, contact, phone, email, COALESCE(status, 'Activo') AS status
      FROM clients ORDER BY id DESC
    `).all();
  }

  listLinkedCompanies() {
    return this.db.prepare(`
      SELECT id, client_id AS clientId, name, business_name AS businessName,
        contact, phone, email
      FROM linked_companies ORDER BY id DESC
    `).all();
  }

  createLinkedCompany(company) {
    const result = this.db.prepare(`
      INSERT INTO linked_companies (client_id, name, business_name, contact, phone, email)
      VALUES (@clientId, @name, @businessName, @contact, @phone, @email)
    `).run(company);
    return this.db.prepare(`
      SELECT id, client_id AS clientId, name, business_name AS businessName,
        contact, phone, email
      FROM linked_companies WHERE id = ?
    `).get(Number(result.lastInsertRowid));
  }

  updateLinkedCompany(id, company) {
    this.db.prepare(`
      UPDATE linked_companies SET name = @name, business_name = @businessName,
        contact = @contact, phone = @phone, email = @email
      WHERE id = @id
    `).run({ ...company, id });
    return this.db.prepare(`
      SELECT id, client_id AS clientId, name, business_name AS businessName,
        contact, phone, email
      FROM linked_companies WHERE id = ?
    `).get(id);
  }

  createClient(client) {
    this.validateClientTaxRegime(client);
    const result = this.db.prepare(`
      INSERT INTO clients (kind, name, razon_social, rfc, person_type, tax_regime, address, zip, contact, phone, email, status)
      VALUES (@kind, @name, @businessName, @rfc, @personType, @taxRegime, @address, @postalCode, @contact, @phone, @email, @status)
    `).run(client);
    return this.getClient(Number(result.lastInsertRowid));
  }

  updateClient(id, client) {
    this.validateClientTaxRegime(client);
    this.db.prepare(`
      UPDATE clients SET kind = @kind, name = @name, razon_social = @businessName, rfc = @rfc,
        person_type = @personType, tax_regime = @taxRegime, address = @address, zip = @postalCode, contact = @contact,
        phone = @phone, email = @email, status = @status, updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run({ ...client, id });
    return this.getClient(id);
  }

  updateClientStatus(id, status) {
    this.db.prepare('UPDATE clients SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);
  }

  validateClientTaxRegime(client) {
    if (!['Fisica', 'Moral'].includes(client.personType)) throw new Error('Selecciona el tipo de persona: Física o Moral.');
    const regime = this.db.prepare('SELECT tipo_persona AS personType FROM regimenes_fiscales WHERE nombre = ? AND (activo = 1 OR activo IS NULL)').get(client.taxRegime);
    const type = (regime?.personType || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (!regime || !(type.includes('amb') || type.includes(client.personType === 'Fisica' ? 'fisica' : 'moral'))) throw new Error('Selecciona un régimen fiscal compatible con el tipo de persona.');
  }

  getClient(id) {
    return this.db.prepare(`
      SELECT id, kind, name, razon_social AS businessName, COALESCE(rfc, '') AS rfc, person_type AS personType, tax_regime AS taxRegime,
        address, zip AS postalCode, contact, phone, email, COALESCE(status, 'Activo') AS status
      FROM clients WHERE id = ?
    `).get(id);
  }

  addColumnIfMissing(column, definition) {
    const columns = this.db.prepare('PRAGMA table_info(clients)').all();
    if (!columns.some(currentColumn => currentColumn.name === column)) {
      this.db.prepare(`ALTER TABLE clients ADD COLUMN ${column} ${definition}`).run();
    }
  }

  addServiceColumnIfMissing(column, definition) {
    const columns = this.db.prepare('PRAGMA table_info(services)').all();
    if (!columns.some(currentColumn => currentColumn.name === column)) {
      this.db.prepare(`ALTER TABLE services ADD COLUMN ${column} ${definition}`).run();
    }
  }

  addBankAccountColumnIfMissing(column, definition) {
    const columns = this.db.prepare('PRAGMA table_info(bank_accounts)').all();
    if (!columns.some(currentColumn => currentColumn.name === column)) {
      this.db.prepare(`ALTER TABLE bank_accounts ADD COLUMN ${column} ${definition}`).run();
    }
  }

  addPaymentColumnIfMissing(column, definition) {
    const columns = this.db.prepare('PRAGMA table_info(payments)').all();
    if (!columns.some(currentColumn => currentColumn.name === column)) {
      this.db.prepare(`ALTER TABLE payments ADD COLUMN ${column} ${definition}`).run();
    }
  }

  seedTaxRegimes() {
    const regimes = [
      ['601', 'General de Ley Personas Morales', 'Personas morales'],
      ['603', 'Personas Morales con Fines no Lucrativos', 'Personas morales'],
      ['606', 'Arrendamiento', 'Personas físicas'],
      ['607', 'Régimen de Enajenación o Adquisición de Bienes', 'Personas físicas'],
      ['608', 'Demás Ingresos', 'Personas físicas'],
      ['610', 'Residentes en el Extranjero sin Establecimiento Permanente en México', 'Personas físicas y morales'],
      ['611', 'Ingresos por Dividendos (socios y accionistas)', 'Personas físicas'],
      ['612', 'Personas Físicas con Actividades Empresariales y Profesionales', 'Personas físicas'],
      ['614', 'Ingresos por Intereses', 'Personas físicas'],
      ['615', 'Régimen de los Ingresos por Obtención de Premios', 'Personas físicas'],
      ['616', 'Sin Obligaciones Fiscales', 'Personas físicas'],
      ['620', 'Sociedades Cooperativas de Producción que optan por diferir sus ingresos', 'Personas morales'],
      ['622', 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras', 'Personas morales'],
      ['623', 'Opcional para Grupos de Sociedades', 'Personas morales'],
      ['624', 'Coordinados', 'Personas morales'],
      ['625', 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas', 'Personas físicas'],
      ['626', 'Régimen Simplificado de Confianza', 'Personas físicas y morales'],
      ['628', 'Hidrocarburos', 'Personas morales'],
      ['629', 'De los Regímenes Fiscales Preferentes y Empresas Multinacionales', 'Personas físicas y morales']
    ];
    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO regimenes_fiscales (clave_sat, nombre, tipo_persona)
      VALUES (?, ?, ?)
    `);
    this.db.transaction(() => regimes.forEach(regime => insert.run(...regime)))();
  }


  seedClients() {
    this.db.prepare(`
      INSERT OR IGNORE INTO linked_companies (client_id, name, business_name, contact, phone, email)
      SELECT id, ?, ?, ?, ?, ? FROM clients WHERE id = 1
    `).run(
      'Constructora del Caribe Operaciones',
      'Constructora del Caribe Operaciones SA de CV',
      'Mariana Ruiz',
      '998 123 4567',
      'operaciones@constructoracaribe.mx'
    );
  }

  seedLinkedCompanies() {
    this.db.prepare(`
      INSERT OR IGNORE INTO linked_companies (client_id, name, business_name, contact, phone, email)
      SELECT id, ?, ?, ?, ?, ? FROM clients WHERE id = 1
    `).run(
      'Constructora del Caribe Operaciones',
      'Constructora del Caribe Operaciones SA de CV',
      'Mariana Ruiz',
      '998 123 4567',
      'operaciones@constructoracaribe.mx'
    );
  }
}

module.exports = { ClientDatabase };
