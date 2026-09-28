const XLSX = require('xlsx');
const fs = require('fs/promises');
const FOOTER = 'Generado con Small-Profesional, 32NG Dev';

const headers = ['Folio', 'Fecha', 'Empresa', 'Sitio', 'Descripción', 'Estatus', 'Importe (MXN)'];
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

function prepareReport(database, options) {
  if (!options || !['pdf', 'xlsx', 'png'].includes(options.format) || !Number.isInteger(options.clientId)
    || !Array.isArray(options.serviceIds) || !options.serviceIds.length || !options.serviceIds.every(Number.isInteger)) {
    throw new Error('Selecciona un cliente, servicios pendientes y un formato válido.');
  }
  const client = database.listPaymentClients().find(item => item.id === options.clientId);
  const ids = new Set(options.serviceIds);
  const services = database.listPaymentServices(options.clientId).filter(service => ids.has(service.id));
  if (!client || services.length !== ids.size) {
    throw new Error('Algunos servicios ya no están pendientes. Cierra y vuelve a abrir el ingreso para actualizar la lista.');
  }
  const rows = services.map(service => [service.folio || `Servicio #${service.id}`, service.date,
    service.company, service.site || 'Sin sitio', service.description || 'Sin descripción', service.status, service.amount]);
  let details = [];
  {
    const fullServices = new Map(database.listServices().map(service => [service.id, service]));
    details = services.map(service => {
      const full = fullServices.get(service.id);
      if (!full || full.clientId !== options.clientId) throw new Error('No se pudo obtener el desglose del servicio. Actualiza la lista e intenta de nuevo.');
      return { ...service, serviceCost: full.serviceCost, travelAllowance: full.travelAllowance,
        materialsCost: full.materialsCost,
        materials: full.materials || [] };
    });
  }
  return { client, rows, details, total: services.reduce((total, service) => total + service.amount, 0) };
}

function reportHtml({ client, rows, total, business, exportedBy, details = [] }) {
  const money = value => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
  const hasTravelAllowance = details.some(service => Number(service.travelAllowance) > 0);
  const pdfHeaders = [...headers.slice(0, -1), 'Costo de servicio (MXN)', ...(hasTravelAllowance ? ['Viáticos (MXN)'] : []), headers[headers.length - 1]];
  const tableRows = rows.map((row, index) => {
    const service = details[index];
    const materials = service?.materials || [];
    const travelAllowance = Number(service?.travelAllowance) || 0;
    const serviceRow = `<tr${materials.length ? ' class="has-materials"' : ''}>${row.slice(0, -1).map(value => `<td>${escapeHtml(value)}</td>`).join('')}
      <td>${Number(service?.serviceCost) > 0 ? escapeHtml(money(Number(service.serviceCost))) : 'costo por definir'}</td>
      ${hasTravelAllowance ? `<td class="money">${travelAllowance > 0 ? escapeHtml(money(travelAllowance)) : '—'}</td>` : ''}
      <td class="money">${escapeHtml(money(row[row.length - 1]))}</td></tr>`;
    const materialsRow = materials.length ? `<tr class="materials-row"><td colspan="${pdfHeaders.length}"><strong>Materiales</strong><ul>${materials.map(material =>
      `<li><span>${escapeHtml(material.name || 'Material sin nombre')}</span><strong>${escapeHtml(money(Number(material.cost) || 0))}</strong></li>`).join('')}</ul></td></tr>` : '';
    return serviceRow + materialsRow;
  }).join('');
  const logo = /^data:image\/[a-z0-9.+-]+;base64,/i.test(business?.image || '')
    ? `<img class="company-logo" src="${escapeHtml(business.image)}" alt="Logo de la empresa">` : '';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">
    <style>.report-header{display:flex;align-items:center;justify-content:space-between;gap:24px;break-inside:avoid;margin-bottom:18px}.report-heading{flex:1;min-width:0}.company-name{font-size:18px;font-weight:bold;overflow-wrap:anywhere}.company-logo{width:150px;height:85px;object-fit:contain;object-position:right center;flex-shrink:0}</style>
    <style>td.money{text-align:right;white-space:nowrap}.has-materials{break-after:avoid}.has-materials td{border-bottom:0}.materials-row{break-inside:auto}.materials-row td{text-align:left;background:#f6f8fb;padding:8px 14px 12px}.materials-row ul{margin:6px 0 0;padding-left:20px}.materials-row li{padding:3px 0;break-inside:avoid}.materials-row li strong{margin-left:16px;white-space:nowrap}</style>
    <style>body{font:11px Arial,sans-serif;color:#172033}h1{font-size:22px}p{margin:6px 0}table{width:100%;border-collapse:collapse;margin-top:22px;table-layout:fixed}th,td{padding:8px 5px;border-bottom:1px solid #ddd;text-align:left;overflow-wrap:anywhere}th{background:#eef2f6}thead{display:table-header-group}tr{break-inside:avoid}td:last-child{text-align:right} .total{text-align:right;font-size:15px;font-weight:bold;margin-top:18px}</style>
    <style>footer{margin-top:24px;padding-top:12px;border-top:1px solid #ddd;text-align:center;color:#586477;font-size:10px}@media print{footer{display:none}}</style>
    </head><body><header class="report-header"><div class="report-heading">
    <p class="company-name">${escapeHtml(business?.commercialName?.trim() || 'Empresa sin nombre registrado')}</p>
    <h1>Servicios pendientes seleccionados</h1>
    <p>Exportado por: ${escapeHtml(exportedBy?.trim() || 'Administrador')}</p>
    </div>${logo}</header>
    <p>Cliente: ${escapeHtml(client.name)}</p><p>Razón social: ${escapeHtml(client.businessName)}</p>
    <p>Fecha de exportación: ${escapeHtml(new Date().toLocaleDateString('es-MX'))}</p>
    <table><thead><tr>${pdfHeaders.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
    <tbody>${tableRows}</tbody></table>
    <p class="total">${rows.length} servicio(s) · Total pendiente: ${escapeHtml(money(total))} MXN</p><footer>${FOOTER}</footer></body></html>`;
}

async function exportPendingServices(database, options, { dialog, BrowserWindow, parent }) {
  const report = prepareReport(database, options);
  const safeName = report.client.name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '-').trim().slice(0, 80) || 'Cliente';
  const { canceled, filePath } = await dialog.showSaveDialog(parent, {
    title: 'Exportar servicios pendientes seleccionados',
    defaultPath: `Servicios-pendientes-${safeName}-${new Date().toISOString().slice(0, 10)}.${options.format}`,
    filters: [{ name: options.format === 'pdf' ? 'PDF' : options.format === 'png' ? 'Imagen PNG' : 'Excel', extensions: [options.format] }]
  });
  if (canceled || !filePath) return null;
  if (options.format === 'xlsx') {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Servicios pendientes seleccionados'], ['Cliente', report.client.name],
      ['Razón social', report.client.businessName],
      ['Fecha de exportación', new Date().toLocaleDateString('es-MX')], [], [...headers.slice(0, -1), 'Costo de servicio (MXN)', headers[headers.length - 1]],
      ...report.rows.map((row, index) => [...row.slice(0, -1), Number(report.details[index].serviceCost) > 0 ? Number(report.details[index].serviceCost) : 'costo por definir', row[row.length - 1]]),
      ['', '', '', '', 'Total pendiente', '', '', report.total], [], [FOOTER]
    ]);
    sheet['!cols'] = [22, 14, 28, 28, 60, 18, 24, 20].map(wch => ({ wch }));
    for (let row = 7; row <= 7 + report.rows.length; row++) {
      sheet[`H${row}`].z = '"$"#,##0.00';
      if (sheet[`G${row}`]?.t === 'n') sheet[`G${row}`].z = '"$"#,##0.00';
    }
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Servicios pendientes');
    await fs.writeFile(filePath, XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  } else {
    const information = database.getAccountInformation();
    report.business = information?.business;
    report.exportedBy = information?.user?.name;
    const printWindow = new BrowserWindow({ show: false, width: 1200, height: 900, useContentSize: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } });
    try {
      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(reportHtml(report))}`);
      await printWindow.webContents.executeJavaScript('Promise.all(Array.from(document.images, image => image.decode())).then(() => document.fonts.ready).then(() => true)');
      let buffer;
      if (options.format === 'png') {
        await printWindow.webContents.executeJavaScript("document.body.style.margin = '28px'; document.body.style.background = '#fff'");
        const height = await printWindow.webContents.executeJavaScript('Math.ceil(document.documentElement.scrollHeight)');
        if (height > 16000) throw new Error('El reporte es demasiado largo para una sola imagen. Selecciona PDF para exportarlo completo.');
        printWindow.setContentSize(1200, height);
        await printWindow.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
        const image = await printWindow.webContents.capturePage({ x: 0, y: 0, width: 1200, height }, { stayHidden: true });
        if (image.isEmpty() || image.getSize().height < height) throw new Error('No se pudo capturar el reporte completo. Intenta exportarlo en PDF.');
        buffer = image.toPNG();
      } else buffer = await printWindow.webContents.printToPDF({
        pageSize: 'A4', landscape: true, printBackground: true,
        displayHeaderFooter: true, headerTemplate: '<span></span>',
        footerTemplate: `<div style="font:9px Arial;width:100%;text-align:center;color:#586477">${FOOTER}</div>`,
        margins: { top: .4, bottom: .6, left: .4, right: .4 }
      });
      await fs.writeFile(filePath, buffer);
    } finally { printWindow.destroy(); }
  }
  return filePath;
}

module.exports = { exportPendingServices, prepareReport, reportHtml };
