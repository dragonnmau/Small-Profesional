const fs = require('node:fs/promises');
const titles = { informative: 'Reporte informativo', acknowledgement: 'Reporte de acuse', log: 'Bitácora de servicio' };
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const money = value => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value) || 0);

function prepareReport(database, options) {
  if (!options || !Object.hasOwn(titles, options.type) || !Number.isInteger(options.serviceId) || options.serviceId <= 0) {
    throw new Error('Selecciona un servicio y un tipo de reporte válido.');
  }
  const service = database.listServices().find(item => item.id === options.serviceId);
  if (!service) throw new Error('El servicio ya no está disponible. Actualiza la lista e intenta nuevamente.');
  return { service, type: options.type, business: database.getAccountInformation?.()?.business };
}

function reportHtml({ service, type, business }) {
  const informative = type === 'informative';
  const log = type === 'log';
  const logo = /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,[a-z0-9+/=\s]+$/i.test(business?.image || '')
    ? `<img class="company-logo" src="${escapeHtml(business.image)}" alt="Logo de la empresa">` : '';
  const header = `<header class="report-header"><div><p class="company-name">${escapeHtml(business?.commercialName?.trim() || 'Empresa sin nombre registrado')}</p><h1>${escapeHtml(titles[type])}</h1></div>${logo}</header>`;
  const field = (label, value) => `<div class="field"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || 'Sin registrar')}</dd></div>`;
  const fields = [field('Folio', service.folio), field('Fecha y hora', `${service.date} · ${service.time || 'Sin horario'}`),
  field('Cliente', service.client), field('Empresa', service.company), field('Sitio', service.site), field('Ciudad', service.city),
  field('Ingeniero asignado', service.assignedUserName || 'Sin asignar')];
  if (!log) fields.push(field('Estado', service.status), field('Servicio pagado', service.servicePaid), field('Viático depositado', service.travelDeposit));
  const costRows = [['Costo de servicio', service.serviceCost], ['Viáticos', service.travelAllowance]];
  if (informative) costRows.push(['Materiales', service.materialsCost], ['Transporte', service.transportCost], ['Gasolina', service.gasolineCost]);
  const costs = log ? '' : `<section><h2>Costos (MXN)</h2><table class="costs"><tbody>${costRows.map(([label, value]) =>
    `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(money(value))}</td></tr>`).join('')}
    <tr class="total"><td>Total${informative ? '' : ' de servicio y viáticos'}</td><td>${escapeHtml(money(costRows.reduce((sum, [, value]) => sum + (Number(value) || 0), 0)))}</td></tr></tbody></table></section>`;
  const materials = (service.materials || []).length ? `<section><h2>Materiales utilizados</h2><table><thead><tr><th>Material</th>${informative ? '<th>Costo (MXN)</th>' : ''}</tr></thead><tbody>${service.materials.map(material =>
    `<tr><td>${escapeHtml(material.name)}</td>${informative ? `<td>${escapeHtml(money(material.cost))}</td>` : ''}</tr>`).join('')}</tbody></table></section>` : '';
  const logSections = log ? `<section class="actions"><h2>Servicio solicitado o diagnóstico</h2><div class="writing-box short-box"><p>${escapeHtml(service.description || '')}</p></div></section>
    <section class="actions"><h2>Bitácora de acciones tomadas</h2><div class="writing-box"></div></section>
    <section class="actions"><h2>Materiales/refacciones usados o requeridos</h2><div class="writing-box short-box"><p>${escapeHtml((service.materials || []).map(material => material.name).filter(Boolean).join(', '))}</p></div></section>
    <section class="equipment"><h2>Equipos</h2><table><colgroup><col style="width:19%"><col style="width:17%"><col style="width:15%"><col style="width:22%"><col style="width:9%"><col style="width:9%"><col style="width:9%"></colgroup>
    <thead><tr><th>Equipo</th><th>Modelo</th><th>Marca</th><th>Número de serie</th><th>Instalado</th><th>Removido</th><th>Intervenido</th></tr></thead>
    <tbody>${Array.from({ length: 6 }, () => '<tr class="equipment-row"><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('')}</tbody></table></section>` : '';
  const signatures = informative ? '' : `<section class="signatures"><div><div class="signature-line"></div><p>${service.assignedUserName ? escapeHtml(service.assignedUserName) + '<br>' : ''}Nombre y firma del ingeniero asignado</p></div>
    <div><div class="signature-line"></div><p>Nombre y firma de cliente</p></div></section>`;
  const ratings = ['Excelente', 'Bueno', 'Regular', 'Mala'].map(option => `<span class="rating-option"><span class="rating-check"></span>${option}</span>`).join('');
  const evaluation = log ? `<section class="evaluation-times"><div><h2>Evaluación de servicio</h2>
    <div class="rating-row"><strong>El servicio fue:</strong><div class="rating-options">${ratings}</div></div>
    <div class="rating-row"><strong>La atención fue:</strong><div class="rating-options">${ratings}</div></div>
    <h2>Comentarios:</h2><div class="writing-box evaluation-box" style="width:45%"></div></div>
    <div class="schedule"><h2>Horarios</h2><p class="time-field">Hora de salida: <span>___:___ __</span></p><p class="time-field">Hora de inicio: <span>___:___ __</span></p><p class="time-field">Hora de finalización: <span>___:___ __</span></p></div></section>` : '';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">
    <style>*{box-sizing:border-box}body{margin:0;color:#172033;font:11px Arial,sans-serif}h1{font-size:22px;margin:0 0 14px}h2{font-size:12px;margin:12px 0 6px;color:#315b93}
    dl{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;margin:0}.field{break-inside:avoid}dt{font-size:10px;color:#586477}dd{margin:3px 0 0;font-weight:600;overflow-wrap:anywhere;white-space:pre-wrap}
    p{margin:5px 0;line-height:1.4;white-space:pre-wrap;overflow-wrap:anywhere}h2{break-after:avoid}table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}th,td{border:1px solid #cbd3dd;padding:6px;text-align:left;overflow-wrap:anywhere}th{background:#eef2f6;font-size:9px}tr{break-inside:avoid}
    .costs td:last-child{text-align:right}.total{font-weight:bold}.writing-box{height:155px;border:1px solid #8793a3;background:repeating-linear-gradient(to bottom,transparent 0,transparent 17.5px,#e0e5eb 17.5px,#e0e5eb 18px)}
    .actions,.equipment,.signatures{break-inside:avoid}.equipment-row{height:30px}
    .signatures{display:flex;gap:48px;margin-top:48px}.signatures>div{flex:1;text-align:center}.signature-line{border-top:1px solid #172033}.signatures p{font-size:10px;margin-top:7px}
    .report-header{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:14px;break-inside:avoid}.report-header>div{flex:1;min-width:0}.company-name{font-size:15px;font-weight:bold;margin:0 0 8px}.report-header h1{margin:0}.company-logo{width:120px;height:65px;object-fit:contain;object-position:right top;flex-shrink:0}
    .log h2{margin:9px 0 5px}.log dl{gap:6px 16px}.log .writing-box{height:180px}.log .short-box{height:auto;min-height:52px;padding:5px 8px;background:none}.log .equipment-row{height:19px}.log .equipment th,.log .equipment td{padding:3px 5px}
    .closing{break-inside:avoid}.evaluation-times{display:grid;grid-template-columns:2fr 1fr;gap:16px;break-inside:avoid}.log .evaluation-box{height:42px}.rating-row{font-size:9px;margin-bottom:5px}.rating-options{display:flex;gap:10px;margin-top:3px}.rating-option{display:inline-flex;align-items:center;gap:4px}.rating-check{display:inline-block;width:9px;height:9px;border:1px solid #586477}.schedule{text-align:right}.time-field{margin:0;padding:4px 0;font-size:9px;white-space:nowrap}.time-field span{display:inline;font:9px monospace}.log .signatures{margin-top:34px}
    .report-page{width:calc(210mm - .8in);min-height:calc(297mm - .9in - 1px);display:flex;flex-direction:column;break-after:page}.report-page:last-child{break-after:auto}.report-page>*{flex-shrink:0}.report-page .closing{margin-top:auto;padding-top:12px}
    </style></head><body class="${log ? 'log' : ''}">${header}<dl>${fields.join('')}</dl>
    ${log ? '' : `<section><h2>Descripción del servicio</h2><p>${escapeHtml(service.description || 'Sin descripción')}</p></section>`}
    ${informative && service.internalComment ? `<section><h2>Comentario interno</h2><p>${escapeHtml(service.internalComment)}</p></section>` : ''}
    ${log ? '' : materials}${costs}${logSections}<div class="closing">${evaluation}${signatures}</div></body></html>`;
}

async function exportServiceReport(database, options, { dialog, BrowserWindow, parent }) {
  const report = prepareReport(database, options);
  const safeFolio = String(report.service.folio || `Servicio-${report.service.id}`).replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').slice(0, 80);
  const { canceled, filePath } = await dialog.showSaveDialog(parent, {
    title: `Generar ${titles[report.type].toLocaleLowerCase('es-MX')}`,
    defaultPath: `${titles[report.type]}-${safeFolio}.pdf`, filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (canceled || !filePath) return null;
  const window = new BrowserWindow({
    show: false, width: 800, height: 1000, useContentSize: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false }
  });
  try {
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(reportHtml(report))}`);
    await window.webContents.executeJavaScript('Promise.all(Array.from(document.images, image => image.decode().catch(() => {}))).then(() => document.fonts.ready).then(() => true)');
    if (report.type !== 'informative') {
      await window.webContents.executeJavaScript(`(() => {
        const blocks = Array.from(document.body.children);
        const createPage = () => {
          const page = document.createElement('div');
          page.className = 'report-page';
          document.body.appendChild(page);
          return page;
        };
        let page = createPage();
        const pageHeight = page.getBoundingClientRect().height;
        for (const block of blocks) {
          page.appendChild(block);
          if (page.getBoundingClientRect().height > pageHeight + .5 && page.children.length > 1) {
            page = createPage();
            page.appendChild(block);
          }
        }
      })()`);
    }
    const buffer = await window.webContents.printToPDF({
      pageSize: 'A4', landscape: false, printBackground: true,
      margins: { top: .4, bottom: .5, left: .4, right: .4 }, displayHeaderFooter: true, headerTemplate: '<span></span>',
      footerTemplate: '<div style="font:9px Arial;width:100%;text-align:center;color:#586477">Small-Profesional · <span class="pageNumber"></span> / <span class="totalPages"></span></div>'
    });
    await fs.writeFile(filePath, buffer);
    return filePath;
  } finally { window.destroy(); }
}

module.exports = { prepareReport, reportHtml, exportServiceReport };
