const catalog = require('./src/app/services/service-evidence-catalog.json');
const MAX_SIZE = 5 * 1024 * 1024;
const types = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text', ods: 'application/vnd.oasis.opendocument.spreadsheet',
  txt: 'text/plain', csv: 'text/csv', rtf: 'application/rtf', xml: 'application/xml'
};

function validateEvidence(kind, files) {
  if (!Object.hasOwn(catalog, kind)) throw new Error('Tipo de evidencia inválido.');
  if (!Array.isArray(files) || !files.length || files.length > 10 || (kind === 'report' && files.length !== 1)) {
    throw new Error('Selecciona un reporte o hasta 10 archivos por carga.');
  }
  return files.map(file => {
    if (!file || typeof file.name !== 'string' || !file.name.length || file.name.length > 200 || /[\\/\x00-\x1f]/.test(file.name)) throw new Error('Nombre de archivo inválido.');
    const extension = file.name.split('.').pop().toLowerCase();
    if (!catalog[kind].extensions.includes(extension)) throw new Error('Formato no permitido para esta sección.');
    if (typeof file.data !== 'string' || !file.data.length || file.data.length > Math.ceil(MAX_SIZE / 3) * 4) throw new Error('Cada archivo debe pesar entre 1 byte y 5 MB.');
    const bytes = Buffer.from(file.data, 'base64');
    if (!bytes.length || bytes.length > MAX_SIZE || bytes.toString('base64') !== file.data) throw new Error('Archivo inválido o mayor a 5 MB.');
    return { name: file.name, type: types[extension], size: bytes.length, data: bytes };
  });
}

module.exports = { validateEvidence };
