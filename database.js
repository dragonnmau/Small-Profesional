const Database = require('better-sqlite3');
const path = require('path');
const { validateEvidence } = require('./service-evidence');
const { validateAttachment } = require('./expense-validation');

function invoiceAttachment(file) {
  if (file == null) return null;
  if (typeof file.name !== 'string' || !/\.(pdf|xml)$/i.test(file.name)) throw new Error('Selecciona una factura PDF o XML.');
  return validateAttachment(file, 'invoice');
}

class ClientDatabase {
  constructor(userDataPath) {
    this.db = new Database(path.join(userDataPath, 'SMpro.db'));
    
    this.db.pragma('journal_mode = WAL');
    this.setupDatabase();
  }

  setupDatabase() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS catalog_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, normalized_name TEXT NOT NULL UNIQUE
      );
      CREATE TABLE IF NOT EXISTS catalog_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL CHECK (kind IN ('Producto', 'Servicio', 'Paquete')),
        name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
        category_id INTEGER REFERENCES catalog_categories(id), sku TEXT,
        price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS catalog_sku_unique ON catalog_items(sku COLLATE NOCASE) WHERE sku IS NOT NULL;
      CREATE TABLE IF NOT EXISTS catalog_package_items (
        package_id INTEGER NOT NULL REFERENCES catalog_items(id),
        product_id INTEGER NOT NULL REFERENCES catalog_items(id),
        quantity INTEGER NOT NULL CHECK (quantity > 0), PRIMARY KEY (package_id, product_id)
      );
    `);
    if (!this.db.prepare('PRAGMA table_info(catalog_items)').all().some(column => column.name === 'quantity')) {
      this.db.exec('ALTER TABLE catalog_items ADD COLUMN quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0)');
    }
    this.db.exec('CREATE TABLE IF NOT EXISTS catalog_sku_sequence (id INTEGER PRIMARY KEY CHECK (id = 1), value INTEGER NOT NULL)');
    this.db.exec('INSERT OR IGNORE INTO catalog_sku_sequence (id, value) VALUES (1, 0)');
    this.db.exec('CREATE TABLE IF NOT EXISTS catalog_units (name TEXT NOT NULL, normalized_name TEXT NOT NULL UNIQUE)');
    for (const name of ['pieza', 'mts', 'bobina']) this.createCatalogUnit(name);
    if (!this.db.prepare('PRAGMA table_info(catalog_items)').all().some(column => column.name === 'unit')) {
      this.db.exec("ALTER TABLE catalog_items ADD COLUMN unit TEXT NOT NULL DEFAULT 'pieza'");
    }
    this.db.exec(`CREATE TABLE IF NOT EXISTS fiscal_documents (
      year INTEGER NOT NULL, month INTEGER NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('declaration', 'payment')),
      name TEXT NOT NULL, size INTEGER NOT NULL, data BLOB NOT NULL,
      PRIMARY KEY (year, month, kind)
    )`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS fiscal_months (
      year INTEGER NOT NULL CHECK (year BETWEEN 1900 AND 9999),
      month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
      isr_cents INTEGER CHECK (isr_cents >= 0),
      deductions_cents INTEGER CHECK (deductions_cents >= 0),
      note TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (year, month)
    )`);
    const fiscalColumns = this.db.prepare('PRAGMA table_info(fiscal_months)').all();
    if (!fiscalColumns.some(column => column.name === 'iva_surcharge_cents')) this.db.exec('ALTER TABLE fiscal_months ADD COLUMN iva_surcharge_cents INTEGER CHECK (iva_surcharge_cents >= 0)');
    if (!fiscalColumns.some(column => column.name === 'isr_surcharge_cents')) this.db.exec('ALTER TABLE fiscal_months ADD COLUMN isr_surcharge_cents INTEGER CHECK (isr_surcharge_cents >= 0)');
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
    if (!invoiceColumns.some(column => column.name === 'attachment')) this.db.exec('ALTER TABLE invoices ADD COLUMN attachment TEXT');
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
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS service_evidence (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK (kind IN ('report', 'photos', 'extras')),
        name TEXT NOT NULL, type TEXT NOT NULL, size INTEGER NOT NULL, data BLOB NOT NULL
      );
      CREATE INDEX IF NOT EXISTS service_evidence_service ON service_evidence(service_id);
      CREATE UNIQUE INDEX IF NOT EXISTS service_evidence_report ON service_evidence(service_id) WHERE kind = 'report';
    `);
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
    this.addServiceColumnIfMissing('internal_comment', "TEXT NOT NULL DEFAULT ''");
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

  listCatalogCategories() {
    return this.db.prepare('SELECT id, name FROM catalog_categories ORDER BY name COLLATE NOCASE').all();
  }

  listCatalogUnits() {
    return this.db.prepare('SELECT name FROM catalog_units ORDER BY rowid').all().map(row => row.name);
  }

  createCatalogUnit(value) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 50) throw new Error('Ingresa una unidad de medida de hasta 50 caracteres.');
    const name = value.trim();
    const normalized = name.toLocaleLowerCase('es-MX');
    this.db.prepare('INSERT OR IGNORE INTO catalog_units (name, normalized_name) VALUES (?, ?)').run(name, normalized);
    return this.db.prepare('SELECT name FROM catalog_units WHERE normalized_name = ?').get(normalized).name;
  }

  createCatalogCategory(value) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 100) throw new Error('Ingresa una categoría de hasta 100 caracteres.');
    const name = value.trim();
    const normalized = name.toLocaleLowerCase('es-MX');
    this.db.prepare('INSERT OR IGNORE INTO catalog_categories (name, normalized_name) VALUES (?, ?)').run(name, normalized);
    return this.db.prepare('SELECT id, name FROM catalog_categories WHERE normalized_name = ?').get(normalized);
  }

  updateCatalogCategory(id, value) {
    if (!Number.isSafeInteger(id) || !this.db.prepare('SELECT id FROM catalog_categories WHERE id = ?').get(id)) throw new Error('Selecciona una categoría existente.');
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 100) throw new Error('Ingresa una categoría de hasta 100 caracteres.');
    const name = value.trim();
    const normalized = name.toLocaleLowerCase('es-MX');
    if (this.db.prepare('SELECT id FROM catalog_categories WHERE normalized_name = ? AND id <> ?').get(normalized, id)) throw new Error('Ya existe una categoría con ese nombre.');
    this.db.prepare('UPDATE catalog_categories SET name = ?, normalized_name = ? WHERE id = ?').run(name, normalized, id);
    return { id, name };
  }

  listCatalogItems() {
    const components = this.db.prepare(`SELECT p.package_id AS packageId, p.product_id AS productId, i.name, i.sku, i.unit, p.quantity
      FROM catalog_package_items p JOIN catalog_items i ON i.id = p.product_id ORDER BY i.name`).all();
    return this.db.prepare(`SELECT i.id, i.kind, i.name, i.description, i.category_id AS categoryId,
      c.name AS category, i.sku, i.quantity, i.unit, i.price_cents / 100.0 AS price FROM catalog_items i
      LEFT JOIN catalog_categories c ON c.id = i.category_id ORDER BY i.id DESC`).all()
      .map(item => ({ ...item, products: components.filter(part => part.packageId === item.id)
        .map(({ productId, name, sku, quantity, unit }) => ({ productId, name, sku, quantity, unit })) }));
  }

  createCatalogItem(request) {
    return this.saveCatalogItem(request);
  }

  updateCatalogItem({ id, item }) {
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Registro inválido.');
    return this.saveCatalogItem(item, id);
  }

  generateCatalogSku(name) {
    const letters = typeof name === 'string' ? name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/gi, '').toUpperCase() : '';
    if (letters.length < 3) throw new Error('Ingresa un nombre con al menos tres letras para generar el SKU.');
    return this.db.transaction(() => {
      let value = this.db.prepare('SELECT value FROM catalog_sku_sequence WHERE id = 1').get().value;
      let sku;
      do {
        value += 1;
        sku = `${letters.slice(0, 3)}-${String(value).padStart(4, '0')}`;
      } while (this.db.prepare('SELECT id FROM catalog_items WHERE sku = ? COLLATE NOCASE').get(sku));
      this.db.prepare('UPDATE catalog_sku_sequence SET value = ? WHERE id = 1').run(value);
      return sku;
    })();
  }

  saveCatalogItem(request, editingId = null) {
    return this.db.transaction(() => {
      if (editingId !== null) {
        const previous = this.db.prepare('SELECT kind FROM catalog_items WHERE id = ?').get(editingId);
        if (!previous) throw new Error('El registro ya no existe.');
        if (previous.kind !== request?.kind) throw new Error('No se puede cambiar el tipo del registro.');
      }
      if (!request || !['Producto', 'Servicio', 'Paquete'].includes(request.kind)) throw new Error('Selecciona un tipo válido.');
      if (typeof request.name !== 'string' || !request.name.trim() || request.name.trim().length > 150) throw new Error('Ingresa un nombre de hasta 150 caracteres.');
      const description = request.description ?? '';
      if (typeof description !== 'string' || description.length > 2000) throw new Error('La descripción admite hasta 2000 caracteres.');
      const sku = request.sku == null ? null : typeof request.sku === 'string' ? request.sku.trim() || null : false;
      if (sku === false || (sku && sku.length > 80)) throw new Error('El SKU admite hasta 80 caracteres.');
      if (sku && this.db.prepare('SELECT id FROM catalog_items WHERE sku = ? COLLATE NOCASE AND id != ?').get(sku, editingId ?? 0)) throw new Error('Este SKU ya está registrado.');
      const quantity = request.quantity ?? 0;
      const requestedUnit = request.unit === undefined ? 'pieza' : request.unit;
      if (typeof requestedUnit !== 'string') throw new Error('Selecciona una unidad de medida existente.');
      const unit = this.db.prepare('SELECT name FROM catalog_units WHERE normalized_name = ?').get(requestedUnit.trim().toLocaleLowerCase('es-MX'))?.name;
      if (!unit) throw new Error('Selecciona una unidad de medida existente.');
      if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 999999) throw new Error('Ingresa una cantidad entera entre 0 y 999999.');
      const price = request.price;
      if (typeof price !== 'number' || !Number.isFinite(price) || price < 0 || price > 999999999.99 || Math.abs(price * 100 - Math.round(price * 100)) > 0.0001) throw new Error('Ingresa un precio válido con máximo dos decimales.');
      const categoryId = request.categoryId ?? null;
      if (categoryId !== null && (!Number.isSafeInteger(categoryId) || !this.db.prepare('SELECT id FROM catalog_categories WHERE id = ?').get(categoryId))) throw new Error('Selecciona una categoría existente.');
      const products = request.products ?? [];
      if (!Array.isArray(products) || products.length > 500) throw new Error('Revisa los productos del paquete.');
      if (request.kind === 'Paquete' && !products.length) throw new Error('Selecciona al menos un producto para el paquete.');
      if (request.kind !== 'Paquete' && products.length) throw new Error('Solo los paquetes pueden incluir productos.');
      const seen = new Set();
      for (const part of products) {
        if (!part || !Number.isSafeInteger(part.productId) || seen.has(part.productId) || !Number.isSafeInteger(part.quantity) || part.quantity < 1 || part.quantity > 999999) throw new Error('Revisa los productos y sus cantidades.');
        if (!this.db.prepare("SELECT id FROM catalog_items WHERE id = ? AND kind = 'Producto'").get(part.productId)) throw new Error('El paquete solo puede incluir productos existentes.');
        seen.add(part.productId);
      }
      let id = editingId;
      if (id === null) {
        const result = this.db.prepare(`INSERT INTO catalog_items (kind, name, description, category_id, sku, price_cents, quantity, unit)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(request.kind, request.name.trim(), description.trim(), categoryId, sku, Math.round(price * 100), quantity, unit);
        id = Number(result.lastInsertRowid);
      } else {
        this.db.prepare('UPDATE catalog_items SET name = ?, description = ?, category_id = ?, sku = ?, price_cents = ?, quantity = ?, unit = ? WHERE id = ?')
          .run(request.name.trim(), description.trim(), categoryId, sku, Math.round(price * 100), quantity, unit, id);
        this.db.prepare('DELETE FROM catalog_package_items WHERE package_id = ?').run(id);
      }
      const insert = this.db.prepare('INSERT INTO catalog_package_items (package_id, product_id, quantity) VALUES (?, ?, ?)');
      for (const part of products) insert.run(id, part.productId, part.quantity);
      return this.listCatalogItems().find(item => item.id === id);
    })();
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
      const affectsBalance = !this.isCreditCard(expense.cardId);
      const balance = affectsBalance ? Math.round((account.balance - expense.total) * 100) / 100 : account.balance;
      this.db.prepare(`INSERT INTO bank_movements
        (account_id, card_id, movement_type, description, amount, balance_after, created_by)
        VALUES (?, ?, 'Egreso', ?, ?, ?, ?)`).run(expense.accountId, expense.cardId, `Gasto #${id} · ${expense.expenseDate}: ${expense.concept}`, expense.total, balance, expense.createdBy);
      if (affectsBalance) this.db.prepare(`UPDATE bank_accounts SET balance = ?, balance_updated_by = ?, balance_updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .run(balance, expense.createdBy, expense.accountId);
      return this.listExpenses().find(item => item.id === id);
    })();
  }

  updateExpense({ id, expense: request }) {
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Gasto inválido.');
    return this.db.transaction(() => {
      const previous = this.db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
      if (!previous) throw new Error('El gasto no existe.');
      const { validateExpense } = require('./expense-validation');
      const expense = validateExpense(request, previous.iva_mode === 'none' ? this.getTaxSettings().ivaRate : previous.iva_rate);
      const sameSource = expense.accountId === previous.account_id && (request.cardId ?? null) === previous.card_id;
      expense.cardId = sameSource ? previous.card_id : this.validateOperationCard(expense.accountId, request.cardId);
      const account = this.db.prepare('SELECT balance, status FROM bank_accounts WHERE id = ?').get(expense.accountId);
      if (!account || (expense.accountId !== previous.account_id && account.status !== 'Activa')) throw new Error('Selecciona una cuenta bancaria activa.');
      const category = this.listExpenseCategories().find(name => name.toLocaleLowerCase('es-MX') === expense.category.toLocaleLowerCase('es-MX'));
      if (!category) throw new Error('Selecciona una categoría existente o agrega una nueva.');
      expense.category = category;
      this.db.prepare(`UPDATE expenses SET account_id = @accountId, card_id = @cardId,
        expense_date = @expenseDate, billing_month = @billingMonth, concept = @concept, category = @category,
        cfdi_use = @cfdiUse, iva_mode = @ivaMode, iva_rate = @ivaRate, subtotal = @subtotal, iva = @iva,
        total = @total, has_invoice = @hasInvoice, ticket = @ticket, invoice = @invoice WHERE id = @id`)
        .run({ ...expense, id, hasInvoice: expense.hasInvoice ? 1 : 0,
          ticket: expense.ticket ? JSON.stringify(expense.ticket) : null,
          invoice: expense.invoice ? JSON.stringify(expense.invoice) : null });
      if (!sameSource || Math.round(previous.total * 100) !== Math.round(expense.total * 100)) {
        const movement = (accountId, cardId, type, amount, description) => {
          const source = this.db.prepare('SELECT balance FROM bank_accounts WHERE id = ?').get(accountId);
          if (!source) throw new Error('La cuenta original ya no existe.');
          const affectsBalance = !this.isCreditCard(cardId);
          const balance = affectsBalance ? (Math.round(source.balance * 100) + (type === 'Ingreso' ? 1 : -1) * Math.round(amount * 100)) / 100 : source.balance;
          this.db.prepare(`INSERT INTO bank_movements (account_id, card_id, movement_type, description, amount, balance_after, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)`).run(accountId, cardId, type, description, amount, balance, expense.createdBy);
          if (affectsBalance) this.db.prepare('UPDATE bank_accounts SET balance = ?, balance_updated_by = ?, balance_updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(balance, expense.createdBy, accountId);
        };
        movement(previous.account_id, previous.card_id, 'Ingreso', previous.total, `Ajuste de gasto #${id}: devolución del importe anterior`);
        movement(expense.accountId, expense.cardId, 'Egreso', expense.total, `Gasto #${id} editado · ${expense.expenseDate}: ${expense.concept}`);
      }
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

  isCreditCard(cardId) {
    return cardId != null && this.db.prepare('SELECT card_type FROM bank_cards WHERE id = ?').get(cardId)?.card_type === 'Credito';
  }

  createBankMovement(movement) {
    const account = this.db.prepare('SELECT balance FROM bank_accounts WHERE id = ?').get(movement.accountId);
    if (!account) throw new Error('Cuenta bancaria no encontrada.');
    const affectsBalance = movement.type !== 'Egreso' || !this.isCreditCard(movement.cardId);
    const balanceAfter = Number(account.balance) + (affectsBalance ? (movement.type === 'Ingreso' ? Number(movement.amount) : -Number(movement.amount)) : 0);
    this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO bank_movements (account_id, card_id, movement_type, description, amount, balance_after, created_by)
        VALUES (@accountId, @cardId, @type, @description, @amount, @balanceAfter, @createdBy)
      `).run({ ...movement, balanceAfter });
      if (affectsBalance) this.db.prepare(`
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
        s.description, s.internal_comment AS internalComment, s.folio, s.status, s.service_paid AS servicePaid, s.service_cost AS serviceCost,
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
    return this.db.prepare(`SELECT id, folio, client_id AS clientId, client, rfc, note, json_extract(attachment, '$.name') AS attachmentName,
      invoice_date AS invoiceDate, iva_mode AS ivaMode, iva_rate AS ivaRate,
      subtotal, iva, iva_withheld AS ivaWithheld, person_type AS personType, total, created_by AS createdBy, created_at AS createdAt
      FROM invoices ORDER BY id DESC`).all().map(invoice => ({ ...invoice,
        payments: this.db.prepare(`SELECT payment_id AS id, folio, payment_date AS paymentDate, amount
          FROM invoice_payments WHERE invoice_id = ? ORDER BY payment_id`).all(invoice.id)
      }));
  }

  createInvoice(request) {
    return this.db.transaction(() => {
      const attachment = invoiceAttachment(request.attachment);
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
      this.db.prepare('UPDATE invoices SET folio = ?, attachment = ? WHERE id = ?').run(folio, attachment ? JSON.stringify(attachment) : null, id);
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

  listFiscalMonths() {
    return this.db.prepare(`SELECT year, month, isr_cents / 100.0 AS isr,
      deductions_cents / 100.0 AS deductions, iva_surcharge_cents / 100.0 AS ivaSurcharge,
      isr_surcharge_cents / 100.0 AS isrSurcharge, note, updated_at AS updatedAt
      FROM fiscal_months ORDER BY year DESC, month`).all();
  }

  validateFiscalDocumentPeriod(year, month, kind) {
    if (!Number.isInteger(year) || year < 1900 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 12) throw new Error('Selecciona un año y mes válidos.');
    if (kind !== undefined && !['declaration', 'payment'].includes(kind)) throw new Error('Tipo de comprobante inválido.');
  }

  listFiscalDocuments({ year, month }) {
    this.validateFiscalDocumentPeriod(year, month);
    return this.db.prepare('SELECT kind, name, size FROM fiscal_documents WHERE year = ? AND month = ? ORDER BY kind').all(year, month);
  }

  saveFiscalDocument({ year, month, kind, file }) {
    this.validateFiscalDocumentPeriod(year, month, kind);
    if (!kind) throw new Error('Selecciona el tipo de comprobante.');
    const [validated] = validateEvidence('report', [file]);
    return this.db.transaction(() => {
      this.db.prepare('INSERT INTO fiscal_months (year, month) VALUES (?, ?) ON CONFLICT(year, month) DO NOTHING').run(year, month);
      this.db.prepare(`INSERT INTO fiscal_documents (year, month, kind, name, size, data) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(year, month, kind) DO UPDATE SET name = excluded.name, size = excluded.size, data = excluded.data`)
        .run(year, month, kind, validated.name, validated.size, validated.data);
      return this.listFiscalDocuments({ year, month });
    })();
  }

  getFiscalDocument({ year, month, kind }) {
    this.validateFiscalDocumentPeriod(year, month, kind);
    if (!kind) throw new Error('Selecciona el tipo de comprobante.');
    const file = this.db.prepare('SELECT name, data FROM fiscal_documents WHERE year = ? AND month = ? AND kind = ?').get(year, month, kind);
    if (!file) throw new Error('Comprobante no encontrado.');
    return { name: file.name, type: 'application/pdf', data: file.data.toString('base64') };
  }

  deleteFiscalDocument({ year, month, kind }) {
    this.validateFiscalDocumentPeriod(year, month, kind);
    if (!kind) throw new Error('Selecciona el tipo de comprobante.');
    return this.db.transaction(() => {
      const result = this.db.prepare('DELETE FROM fiscal_documents WHERE year = ? AND month = ? AND kind = ?').run(year, month, kind);
      if (!result.changes) throw new Error('Comprobante no encontrado.');
      return this.listFiscalDocuments({ year, month });
    })();
  }

  saveFiscalMonth({ year, month, isr, deductions, ivaSurcharge = null, isrSurcharge = null, note }) {
    if (!Number.isInteger(year) || year < 1900 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 12) throw new Error('Selecciona un año y mes válidos.');
    const cents = (amount, label) => {
      if (amount === null) return null;
      if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0 || amount > 999999999.99 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.0001) throw new Error(`${label}: ingresa un importe no negativo con máximo dos decimales.`);
      return Math.round(amount * 100);
    };
    const isrCents = cents(isr, 'ISR');
    const deductionCents = cents(deductions, 'Deducciones');
    const ivaSurchargeCents = cents(ivaSurcharge, 'Recargos de IVA');
    const isrSurchargeCents = cents(isrSurcharge, 'Recargos de ISR');
    if (typeof note !== 'string' || note.length > 2000) throw new Error('La nota debe tener máximo 2000 caracteres.');
    this.db.prepare(`INSERT INTO fiscal_months (year, month, isr_cents, deductions_cents, iva_surcharge_cents, isr_surcharge_cents, note)
      VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(year, month) DO UPDATE SET
      isr_cents = excluded.isr_cents, deductions_cents = excluded.deductions_cents,
      iva_surcharge_cents = excluded.iva_surcharge_cents, isr_surcharge_cents = excluded.isr_surcharge_cents,
      note = excluded.note, updated_at = CURRENT_TIMESTAMP`).run(year, month, isrCents, deductionCents, ivaSurchargeCents, isrSurchargeCents, note.trim());
    return this.listFiscalMonths().find(item => item.year === year && item.month === month);
  }

  getInvoiceAttachment({ id }) {
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Factura inválida.');
    const row = this.db.prepare('SELECT attachment FROM invoices WHERE id = ?').get(id);
    if (!row) throw new Error('La factura no existe.');
    return row.attachment ? JSON.parse(row.attachment) : null;
  }

  updateInvoiceAttachment({ id, attachment }) {
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Factura inválida.');
    const file = invoiceAttachment(attachment);
    if (!file) throw new Error('Selecciona una factura PDF o XML.');
    const result = this.db.prepare('UPDATE invoices SET attachment = ? WHERE id = ?').run(JSON.stringify(file), id);
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

  requireEvidenceService(serviceId) {
    if (!Number.isSafeInteger(serviceId) || serviceId <= 0 || !this.db.prepare('SELECT 1 FROM services WHERE id = ?').get(serviceId)) throw new Error('El servicio no existe.');
  }

  listServiceEvidence({ serviceId }) {
    this.requireEvidenceService(serviceId);
    return this.db.prepare('SELECT id, kind, name, type, size FROM service_evidence WHERE service_id = ? ORDER BY id DESC').all(serviceId);
  }

  addServiceEvidence({ serviceId, kind, files }) {
    const validated = validateEvidence(kind, files);
    return this.db.transaction(() => {
      this.requireEvidenceService(serviceId);
      if (kind === 'report') this.db.prepare("DELETE FROM service_evidence WHERE service_id = ? AND kind = 'report'").run(serviceId);
      const insert = this.db.prepare('INSERT INTO service_evidence (service_id, kind, name, type, size, data) VALUES (?, ?, ?, ?, ?, ?)');
      for (const file of validated) insert.run(serviceId, kind, file.name, file.type, file.size, file.data);
      return this.listServiceEvidence({ serviceId });
    })();
  }

  getServiceEvidence({ serviceId, id }) {
    this.requireEvidenceService(serviceId);
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Archivo inválido.');
    const file = this.db.prepare('SELECT name, type, data FROM service_evidence WHERE service_id = ? AND id = ?').get(serviceId, id);
    if (!file) throw new Error('Archivo no encontrado.');
    return { ...file, data: file.data.toString('base64') };
  }

  deleteServiceEvidence({ serviceId, id }) {
    return this.db.transaction(() => {
      this.requireEvidenceService(serviceId);
      if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Archivo inválido.');
      const result = this.db.prepare('DELETE FROM service_evidence WHERE service_id = ? AND id = ?').run(serviceId, id);
      if (!result.changes) throw new Error('Archivo no encontrado.');
      return this.listServiceEvidence({ serviceId });
    })();
  }

  updateService(id, service) {
    const update = this.db.prepare(`
      UPDATE services SET date = @date, time = @time, client_id = @clientId, company_id = @companyId, city = @city,
        site = @site, description = @description, internal_comment = COALESCE(@internalComment, internal_comment), folio = @folio, status = @status, service_paid = @servicePaid,
        service_cost = @serviceCost, travel_allowance = @travelAllowance, travel_deposit = @travelDeposit,
        transport_cost = @transportCost, gasoline_cost = @gasolineCost, assigned_user_id = @assignedUserId, updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `);
    const replaceMaterials = this.db.prepare('INSERT INTO service_materials (service_id, name, cost) VALUES (?, ?, ?)');
    this.db.transaction(() => {
      update.run({ ...service, id, internalComment: typeof service.internalComment === 'string' ? service.internalComment.trim() : null });
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
