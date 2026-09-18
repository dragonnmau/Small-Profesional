const MAX_FILE_SIZE = 5 * 1024 * 1024;
const { cfdiUses } = require('./src/app/services/expense-catalogs.json');

function validateCategory(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 80) throw new Error('Escribe una categoría de hasta 80 caracteres.');
  return value.trim().replace(/\s+/g, ' ');
}

function validateAttachment(file, kind) {
  if (file == null) return null;
  const types = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf', xml: 'application/xml' };
  const extension = typeof file.name === 'string' ? file.name.split('.').pop().toLowerCase() : '';
  if (!types[extension] || (kind === 'ticket' && !['jpg', 'jpeg', 'png', 'webp'].includes(extension))) throw new Error('Formato de archivo no permitido.');
  if (file.name.length > 200 || /[\\/\x00-\x1f]/.test(file.name)) throw new Error('Nombre de archivo inválido.');
  if (typeof file.data !== 'string' || !file.data.length || file.data.length > Math.ceil(MAX_FILE_SIZE / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.data)) throw new Error('Archivo inválido o mayor a 5 MB.');
  const bytes = Buffer.from(file.data, 'base64');
  if (!bytes.length || bytes.length > MAX_FILE_SIZE) throw new Error('El archivo debe pesar entre 1 byte y 5 MB.');
  return { name: file.name, type: types[extension], data: file.data };
}

function validateExpense(request, configuredRate) {
  if (!request || !Number.isSafeInteger(request.accountId) || request.accountId <= 0) throw new Error('Selecciona una cuenta bancaria.');
  if (typeof request.billingMonth !== 'string' || !/^(0[1-9]|1[0-2])$/.test(request.billingMonth)) throw new Error('Selecciona un mes de facturación válido.');
  const date = request.expenseDate;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error('La fecha no es válida.');
  if (typeof request.concept !== 'string' || !request.concept.trim() || request.concept.trim().length > 500) throw new Error('Escribe un concepto de hasta 500 caracteres.');
  if (typeof request.amount !== 'number' || !Number.isFinite(request.amount) || request.amount <= 0 || request.amount > 999999999.99 || Math.abs(request.amount * 100 - Math.round(request.amount * 100)) > 0.0001) throw new Error('Ingresa un importe positivo con máximo dos decimales.');
  if (!['none', 'added', 'included'].includes(request.ivaMode)) throw new Error('Selecciona el tratamiento del IVA.');
  if (typeof request.hasInvoice !== 'boolean') throw new Error('Indica si tiene factura.');
  const category = validateCategory(request.category);
  const cfdiUse = request.hasInvoice ? request.cfdiUse : '';
  if (request.hasInvoice && !cfdiUses.some(use => use.code === cfdiUse)) throw new Error('Selecciona un uso de CFDI válido.');
  if (request.invoice && !request.hasInvoice) throw new Error('Marca que el gasto tiene factura para adjuntarla.');
  const ivaRate = request.ivaMode === 'none' ? 0 : Number(configuredRate);
  if (!Number.isFinite(ivaRate) || ivaRate < 0 || ivaRate > 100) throw new Error('La tasa de IVA configurada no es válida.');
  const cents = Math.round(request.amount * 100);
  const subtotal = request.ivaMode === 'included' ? Math.round(cents / (1 + ivaRate / 100)) : cents;
  const iva = request.ivaMode === 'included' ? cents - subtotal : Math.round(subtotal * ivaRate / 100);
  return { accountId: request.accountId, expenseDate: date, concept: request.concept.trim(), ivaMode: request.ivaMode,
    category, cfdiUse, billingMonth: request.billingMonth, ivaRate, subtotal: subtotal / 100, iva: iva / 100, total: (subtotal + iva) / 100, hasInvoice: request.hasInvoice,
    ticket: validateAttachment(request.ticket, 'ticket'), invoice: validateAttachment(request.invoice, 'invoice'),
    createdBy: typeof request.createdBy === 'string' && request.createdBy.trim() ? request.createdBy.trim() : 'Administrador' };
}

module.exports = { validateExpense, validateCategory };
