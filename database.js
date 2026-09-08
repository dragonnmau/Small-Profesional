const Database = require('better-sqlite3');
const path = require('path');

class ClientDatabase {
  constructor(userDataPath) {
    this.db = new Database(path.join(userDataPath, 'SMpro.db'));
    
    this.db.pragma('journal_mode = WAL');
    this.setupDatabase();
  }

  setupDatabase() {

    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE,
        value TEXT
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
    this.addColumnIfMissing('tax_regime', 'VARCHAR(100)');
    this.addColumnIfMissing('contact', 'VARCHAR(100)');
    this.addColumnIfMissing('kind', "VARCHAR(20) DEFAULT 'Cliente'");
    this.addServiceColumnIfMissing('time', "TEXT NOT NULL DEFAULT '09:00'");
      this.addServiceColumnIfMissing('service_paid', "VARCHAR(5) NOT NULL DEFAULT 'No'");
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
        s.transport_cost AS transportCost, s.gasoline_cost AS gasolineCost
      FROM services s
      JOIN clients c ON c.id = s.client_id
      LEFT JOIN linked_companies lc ON lc.id = s.company_id
      ORDER BY s.date DESC, s.id DESC
    `).all();
    const materials = this.db.prepare('SELECT service_id AS serviceId, name, cost FROM service_materials ORDER BY id').all();
    return services.map(service => ({ ...service, materials: materials.filter(material => material.serviceId === service.id).map(({ name, cost }) => ({ name, cost })) }));
  }

  createService(service) {
    const insertService = this.db.prepare(`
        INSERT INTO services (date, time, client_id, company_id, city, site, description, folio, status, service_paid,
        service_cost, travel_allowance, travel_deposit, transport_cost, gasoline_cost)
      VALUES (@date, @time, @clientId, @companyId, @city, @site, @description, @folio, @status, @servicePaid,
        @serviceCost, @travelAllowance, @travelDeposit, @transportCost, @gasolineCost)
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
        transport_cost = @transportCost, gasoline_cost = @gasolineCost, updated_at = CURRENT_TIMESTAMP
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
      SELECT id, kind, name, razon_social AS businessName, COALESCE(rfc, '') AS rfc, tax_regime AS taxRegime,
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
    const result = this.db.prepare(`
      INSERT INTO clients (kind, name, razon_social, rfc, tax_regime, address, zip, contact, phone, email, status)
      VALUES (@kind, @name, @businessName, @rfc, @taxRegime, @address, @postalCode, @contact, @phone, @email, @status)
    `).run(client);
    return this.getClient(Number(result.lastInsertRowid));
  }

  updateClient(id, client) {
    this.db.prepare(`
      UPDATE clients SET kind = @kind, name = @name, razon_social = @businessName, rfc = @rfc,
        tax_regime = @taxRegime, address = @address, zip = @postalCode, contact = @contact,
        phone = @phone, email = @email, status = @status, updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run({ ...client, id });
    return this.getClient(id);
  }

  updateClientStatus(id, status) {
    this.db.prepare('UPDATE clients SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);
  }

  getClient(id) {
    return this.db.prepare(`
      SELECT id, kind, name, razon_social AS businessName, COALESCE(rfc, '') AS rfc, tax_regime AS taxRegime,
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
