const fs = require('fs/promises');

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Selecciona una semana válida.');
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (dateKey(date) !== value) throw new Error('Selecciona una semana válida.');
  return date;
}

function prepareCalendar(database, options) {
  if (!options || !['png', 'pdf'].includes(options.format)) throw new Error('Selecciona PNG o PDF.');
  const start = parseDate(options.start);
  const end = parseDate(options.end);
  const days = [];
  for (const day = new Date(start); day <= end && days.length < 8; day.setDate(day.getDate() + 1)) {
    days.push({ date: dateKey(day), label: day.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' }) });
  }
  if (!days.length || days.length > 7) throw new Error('El calendario debe incluir entre uno y siete días.');
  const services = database.listServices().filter(service => service.date >= options.start && service.date <= options.end)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`) || a.id - b.id);
  return { start: options.start, end: options.end, days: days.map(day => ({ ...day, services: services.filter(service => service.date === day.date) })), count: services.length };
}

function calendarHtml(report) {
  const card = service => {
    const status = service.status.trim().toLocaleLowerCase('es-MX');
    const group = status.startsWith('cancelado') ? 'cancelled' : ['completado', 'pagado'].includes(status) ? 'completed' : 'pending';
    return `<article class="${group}"><div class="time">${escapeHtml(service.time || 'Sin horario')}</div><div class="service-details">
      <div class="service-heading"><h3>${escapeHtml(service.client || 'Sin cliente')}</h3><span class="status">${escapeHtml(service.status)}</span></div>
      <div class="folio">${escapeHtml(service.folio || 'Sin folio')}${service.company ? ` · ${escapeHtml(service.company)}` : ''}</div>
      <p>${escapeHtml(service.description || 'Sin descripción')}</p>
      <p class="meta">${escapeHtml([service.site || 'Sin sitio', service.city].filter(Boolean).join(' · '))} · Responsable: ${escapeHtml(service.assignedUserName || 'Sin asignar')}</p></div></article>`;
  };
  const agenda = report.days.map(day => `<section class="day"><h2>${escapeHtml(day.label)}<span>${day.services.length} servicios</span></h2>
    ${day.services.length ? day.services.map(card).join('') : '<p class="empty">Sin servicios</p>'}</section>`).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
    <style>
      *{box-sizing:border-box}body{margin:24px;background:white;color:#172033;font:12px Arial,sans-serif}
      h1{font-size:22px;margin:0 0 6px}header{margin-bottom:14px}header p{color:#586477}
      .day{margin-bottom:10px}h2{display:flex;justify-content:space-between;gap:12px;background:#eaf0f7;text-transform:capitalize;padding:8px 10px;font-size:13px;margin:0 0 5px;break-after:avoid}
      h2 span{font-size:11px;font-weight:normal;text-transform:none;white-space:nowrap}
      article{display:flex;gap:12px;padding:8px 10px;margin-bottom:4px;border-left:4px solid #d99119;background:#f8fafc;break-inside:avoid;overflow-wrap:anywhere}
      article.completed{border-color:#0d9488}article.cancelled{border-color:#db5563}
      .time{font-weight:bold;flex:0 0 75px;font-size:11px;padding-top:2px}.service-details{flex:1;min-width:0}
      .service-heading{display:flex;justify-content:space-between;align-items:baseline;gap:10px}.status{font-size:10px;color:#586477;flex-shrink:0}h3{font-size:13px;margin:0}
      .folio{color:#315b93;font-size:11px;margin-top:3px}p{line-height:1.35;margin:4px 0 0;white-space:pre-wrap}.meta,.empty{color:#586477;font-size:11px}.empty{padding:4px 10px}
      footer{margin-top:14px;color:#586477;font-size:10px;text-align:center}
      @media print{body{margin:0}footer{display:none}}
    </style></head><body><header><h1>Calendario de servicios</h1>
    <p>${escapeHtml(report.start)} al ${escapeHtml(report.end)} · ${report.count} servicios · Todos los estados</p></header>
    <main>${agenda}</main>
    <footer>Generado con Small-Profesional, 32NG Dev</footer></body></html>`;
}

async function exportServiceCalendar(database, options, { dialog, BrowserWindow, parent }) {
  const report = prepareCalendar(database, options);
  const { canceled, filePath } = await dialog.showSaveDialog(parent, {
    title: 'Exportar calendario de la semana',
    defaultPath: `Calendario-servicios-${report.start}-al-${report.end}.${options.format}`,
    filters: [{ name: options.format === 'pdf' ? 'PDF' : 'Imagen PNG', extensions: [options.format] }]
  });
  if (canceled || !filePath) return null;
  const window = new BrowserWindow({ show: false, width: 800, height: 600, useContentSize: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } });
  try {
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(calendarHtml(report))}`);
    await window.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
    let buffer;
    if (options.format === 'png') {
      const height = await window.webContents.executeJavaScript('Math.ceil(Math.max(document.body.scrollHeight, document.body.offsetHeight) + 48)');
      if (height > 16000) throw new Error('El calendario es demasiado largo para una imagen. Exporta en PDF para incluir todos los servicios.');
      window.setContentSize(800, height);
      await window.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
      const image = await window.webContents.capturePage({ x: 0, y: 0, width: 800, height }, { stayHidden: true });
      if (image.isEmpty() || image.getSize().height < height) throw new Error('No se pudo capturar el calendario completo. Intenta exportar en PDF.');
      buffer = image.toPNG();
    } else {
      buffer = await window.webContents.printToPDF({ pageSize: 'A4', landscape: false, printBackground: true,
        margins: { top: .4, bottom: .5, left: .3, right: .3 }, displayHeaderFooter: true,
        headerTemplate: '<span></span>', footerTemplate: '<div style="font:9px Arial;width:100%;text-align:center;color:#586477">Small-Profesional · <span class="pageNumber"></span> / <span class="totalPages"></span></div>' });
    }
    await fs.writeFile(filePath, buffer);
    return filePath;
  } finally { window.destroy(); }
}

module.exports = { prepareCalendar, calendarHtml, exportServiceCalendar };
