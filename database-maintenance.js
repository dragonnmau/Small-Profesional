const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Database = require('better-sqlite3');
const { ClientDatabase } = require('./database');

class DatabaseMaintenance {
  constructor({ directory, getDatabase, setDatabase, dialog, getParent }) {
    this.directory = path.resolve(directory);
    this.file = path.join(this.directory, 'SMpro.db');
    this.getDatabase = getDatabase;
    this.setDatabase = setDatabase;
    this.dialog = dialog;
    this.getParent = getParent;
    this.busy = false;
    this.challenge = null;
  }

  createChallenge() {
    if (this.busy) throw new Error('Hay otra operación de base de datos en curso.');
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
    const text = Array.from({ length: 6 }, () => alphabet[crypto.randomInt(alphabet.length)]).join(' ');
    this.challenge = { text, expires: Date.now() + 10 * 60 * 1000 };
    return text;
  }

  async exclusive(action) {
    if (this.busy) throw new Error('Hay otra operación de base de datos en curso.');
    this.busy = true;
    try { return await action(); }
    finally { this.busy = false; }
  }

  isLiveFile(filename) {
    const normalize = value => {
      const resolved = fs.existsSync(value) ? fs.realpathSync(value) : path.resolve(value);
      return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
    };
    return [this.file, `${this.file}-wal`, `${this.file}-shm`].some(file => normalize(filename) === normalize(file));
  }

  cleanTemporary(directory, root) {
    if (path.dirname(path.resolve(directory)) !== path.resolve(root) || !path.basename(directory).startsWith('.smpro-')) {
      throw new Error('Ruta temporal de base de datos inválida.');
    }
    fs.rmSync(directory, { recursive: true, force: true });
  }

  async exportDatabase() {
    return this.exclusive(async () => {
      const { canceled, filePath } = await this.dialog.showSaveDialog(this.getParent(), {
        title: 'Exportar base de datos', defaultPath: `SMpro-respaldo-${new Date().toISOString().slice(0, 10)}.db`,
        filters: [{ name: 'Base de datos SQLite', extensions: ['db'] }]
      });
      if (canceled || !filePath) return null;
      if (this.isLiveFile(filePath)) throw new Error('Guarda el respaldo en un archivo diferente de la base de datos activa.');
      const root = path.dirname(path.resolve(filePath));
      const staging = fs.mkdtempSync(path.join(root, '.smpro-export-'));
      try {
        const snapshot = path.join(staging, 'backup.db');
        await this.getDatabase().db.backup(snapshot);
        fs.renameSync(snapshot, filePath);
        return filePath;
      } finally { this.cleanTemporary(staging, root); }
    });
  }

  validateImport(source) {
    if (source.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error('El archivo de base de datos está dañado.');
    const required = {
      clients: ['id', 'name'], services: ['id', 'date', 'client_id'],
      company_information: ['id', 'commercial_name'], user_information: ['id', 'name']
    };
    for (const [table, columns] of Object.entries(required)) {
      const actual = source.prepare(`PRAGMA table_info(${table})`).all().map(column => column.name);
      if (!columns.every(column => actual.includes(column))) throw new Error('El archivo no es una base de datos compatible de Small-Profesional.');
    }
  }

  replaceWith(staging) {
    const oldFile = path.join(staging, 'previous.db');
    const preparedFile = path.join(staging, 'SMpro.db');
    const current = this.getDatabase();
    current.db.close();
    let oldMoved = false;
    let newMoved = false;
    try {
      fs.renameSync(this.file, oldFile); oldMoved = true;
      fs.renameSync(preparedFile, this.file); newMoved = true;
      this.setDatabase(new ClientDatabase(this.directory));
    } catch (error) {
      try {
        if (newMoved) {
          // Only remove the failed replacement and its own SQLite sidecars.
          for (const file of [this.file, `${this.file}-wal`, `${this.file}-shm`]) fs.rmSync(file, { force: true });
        }
        if (oldMoved) fs.renameSync(oldFile, this.file);
        this.setDatabase(new ClientDatabase(this.directory));
      } catch (restoreError) {
        error.message = `No se pudo restaurar automáticamente la base de datos. El respaldo se conserva en ${oldFile}. ${restoreError.message}`;
        error.preserveStaging = true;
      }
      throw error;
    }
  }

  async importDatabase() {
    return this.exclusive(async () => {
      const { canceled, filePaths } = await this.dialog.showOpenDialog(this.getParent(), {
        title: 'Importar base de datos', properties: ['openFile'],
        filters: [{ name: 'Base de datos SQLite', extensions: ['db', 'sqlite', 'sqlite3'] }]
      });
      if (canceled || !filePaths?.[0]) return null;
      if (this.isLiveFile(filePaths[0])) throw new Error('Selecciona un respaldo diferente de la base de datos activa.');
      const staging = fs.mkdtempSync(path.join(this.directory, '.smpro-import-'));
      let preserve = false;
      try {
        const source = new Database(filePaths[0], { readonly: true, fileMustExist: true });
        try {
          this.validateImport(source);
          await source.backup(path.join(staging, 'SMpro.db'));
        } finally { source.close(); }
        const prepared = new ClientDatabase(staging);
        try {
          const tables = this.getDatabase().db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all();
          for (const { name } of tables) {
            const quoted = '"' + name.replaceAll('"', '""') + '"';
            const expected = this.getDatabase().db.prepare(`PRAGMA table_info(${quoted})`).all();
            const actual = new Set(prepared.db.prepare(`PRAGMA table_info(${quoted})`).all().map(column => column.name));
            if (!expected.every(column => actual.has(column.name))) throw new Error('El respaldo tiene una estructura incompatible con esta versión de Small-Profesional.');
          }
        } finally { prepared.db.close(); }
        const { response } = await this.dialog.showMessageBox(this.getParent(), {
          type: 'warning', title: 'Confirmar importación', message: '¿Reemplazar la base de datos actual con el respaldo seleccionado?',
          detail: 'Se reemplazarán todos los registros y la información de la empresa. Exporta un respaldo de la base actual antes de continuar si necesitas conservarla.',
          buttons: ['Cancelar', 'Importar y reemplazar'], defaultId: 0, cancelId: 0, noLink: true
        });
        if (response !== 1) return null;
        this.replaceWith(staging);
        this.challenge = null;
        return filePaths[0];
      } catch (error) { preserve = Boolean(error.preserveStaging); throw error; }
      finally { if (!preserve) this.cleanTemporary(staging, this.directory); }
    });
  }

  async deleteDatabase(text) {
    return this.exclusive(async () => {
      if (!this.challenge || Date.now() > this.challenge.expires || text !== this.challenge.text) {
        throw new Error('El texto de confirmación no coincide o ha caducado. Cierra y vuelve a abrir el modal.');
      }
      const { response } = await this.dialog.showMessageBox(this.getParent(), {
        type: 'warning', title: 'Eliminar base de datos', message: '¿Estás seguro de borrar toda la base de datos?',
        detail: 'Se eliminarán servicios, clientes, ingresos, gastos, archivos adjuntos y la información de empresa y usuario. Esta acción no se puede deshacer.',
        buttons: ['Cancelar', 'Eliminar base de datos'], defaultId: 0, cancelId: 0, noLink: true
      });
      if (response !== 1) return false;
      const staging = fs.mkdtempSync(path.join(this.directory, '.smpro-reset-'));
      let preserve = false;
      try {
        const prepared = new ClientDatabase(staging);
        prepared.db.close();
        this.replaceWith(staging);
        this.challenge = null;
        return true;
      } catch (error) { preserve = Boolean(error.preserveStaging); throw error; }
      finally { if (!preserve) this.cleanTemporary(staging, this.directory); }
    });
  }
}

module.exports = { DatabaseMaintenance };
