const fs = require('node:fs/promises');
const FOOTER = 'Creado con Small Profesional, 32NG Dev';
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

function prepareQuotation(database, options, now = new Date()) {
  if (!options || !['pdf', 'png'].includes(options.format) || !['16', 'exempt', 'none'].includes(options.tax)
    || typeof options.hideTax !== 'boolean' || !Number.isFinite(options.margin) || options.margin < 0 || options.margin > 99.99
    || !Number.isInteger(options.validityDays) || options.validityDays < 1 || options.validityDays > 365
    || !Array.isArray(options.lines) || !options.lines.length || options.lines.length > 1000
    || !['Contado', 'Anticipo de 50%', 'Contra entrega', 'Plazos a 3 meses', 'Plazos a 6 meses'].includes(options.payment)
    || !['3 a 5 días', '15 días', '30 días'].includes(options.delivery)
    || !['Sin garantía', '1 mes', '2 meses'].includes(options.warranty)
    || typeof options.serviceDetails !== 'string' || options.serviceDetails.length > 5000
    || typeof options.temporaryName !== 'string' || options.temporaryName.length > 200) {
    throw new Error('Revisa los conceptos, importes y condiciones de la cotización.');
  }
  const information = database.getAccountInformation();
  const createdBy = information?.user?.name?.trim();
  const business = information?.business;
  if (!createdBy || !business?.commercialName?.trim() || !/^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,[a-z0-9+/=\s]+$/i.test(business.image || '')) {
    throw new Error('Completa el nombre de la empresa, su imagen y tu nombre en Información de la empresa antes de exportar.');
  }
  let client = options.clientId === null ? { name: 'Público en general' }
    : database.listClients().find(client => client.id === options.clientId && client.status === 'Activo');
  if (!client) throw new Error('El cliente ya no está disponible. Actualiza la vista y vuelve a intentarlo.');
  if (normalize(client.name) === 'publico en general') client = { ...client, name: options.temporaryName.trim() || client.name };
  const catalog = new Map(database.listCatalogItems().map(item => [item.id, item]));
  const lines = options.lines.map(line => {
    const item = line && catalog.get(line.itemId);
    if (!item || !Number.isFinite(line.quantity) || line.quantity <= 0 || line.quantity > 999999
      || !Number.isFinite(line.cost) || line.cost < 0 || line.cost > 999999999) throw new Error('Hay conceptos o importes inválidos. Actualiza la vista y revisa la cotización.');
    return { name: item.name, kind: item.kind, unit: item.unit, description: item.description,
      products: item.kind === 'Paquete' ? (item.products || []).map(part => ({ name: part.name, quantity: part.quantity, unit: part.unit })) : [],
      quantity: line.quantity, amount: round(round(line.quantity * line.cost) / (1 - options.margin / 100)) };
  });
  const subtotal = round(lines.reduce((sum, line) => sum + line.amount, 0));
  const taxAmount = options.tax === '16' ? round(subtotal * 0.16) : 0;
  const expires = new Date(now); expires.setDate(expires.getDate() + options.validityDays);
  return { business, createdBy, client, lines, subtotal, taxAmount, total: round(subtotal + taxAmount),
    businessPhone: information.user.phone?.trim() || information.user.mobile?.trim() || '', businessEmail: information.user.email?.trim() || '',
    date: now.toLocaleDateString('es-MX'), expires: expires.toLocaleDateString('es-MX'),
    payment: options.payment, delivery: options.delivery, warranty: options.warranty, validityDays: options.validityDays,
    hideTax: options.hideTax, tax: options.tax, serviceDetails: options.serviceDetails };
}

function quotationHtml(report) {
  const e = escapeHtml;
  const money = value => e(new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value));
  const field = (label, value) => value ? `<p><strong>${label}:</strong> ${e(value)}</p>` : '';
  const payment = report.payment === 'Anticipo de 50%'
    ? `Anticipo del 50% - ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(round(report.total / 2))}` : report.payment;
  const clientRow = fields => {
    const content = fields.map(([label, value]) => field(label, value)).join('');
    return content ? `<div class="client-row">${content}</div>` : '';
  };
  // When tax is hidden, distribute the tax cents over the displayed lines so they still add up to the total.
  let accumulatedBase = 0, accumulatedTotal = 0;
  const rows = report.lines.map(line => {
    let amount = line.amount;
    if (report.hideTax && report.tax === '16') {
      accumulatedBase = round(accumulatedBase + line.amount);
      const nextTotal = round(accumulatedBase + round(accumulatedBase * 0.16));
      amount = round(nextTotal - accumulatedTotal); accumulatedTotal = nextTotal;
    }
    const contents = line.kind === 'Paquete' && line.products?.length
      ? `<small class="package-contents"><strong>Incluye por paquete:</strong> ${line.products.map(part => `${e(part.quantity)} ${e(part.unit)} de ${e(part.name)}`).join(' · ')}</small>` : '';
    return `<tr><td><strong>${e(line.name)}</strong><small>${e(line.kind)} · ${e(line.unit)}</small>${line.description ? `<small class="description">${e(line.description)}</small>` : ''}${contents}</td><td class="number">${e(line.quantity)}</td><td class="number">${money(amount)}</td></tr>`;
  }).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><title>Cotización</title>
  <style>.company-contact{display:flex;gap:4px 18px;flex-wrap:wrap;margin-top:5px}.company-contact p{margin:0}.terms-row{display:flex;align-items:flex-start;gap:24px;border-top:1px solid #dbe2eb;padding-top:18px}.terms-row>.conditions{flex:1;min-width:0;border:0;padding:0}.terms-row>.details{flex:1;min-width:0;margin:0;line-height:1.4;white-space:normal}.terms-row .details p{white-space:pre-wrap;margin:0}</style>
  <style>small.package-contents{font-size:.85em;line-height:1.4;margin-top:4px;overflow-wrap:anywhere}</style>
  <style>.document .client{margin:16px 0;padding:10px 12px;break-inside:avoid}.client h2{font-size:14px;margin:0 0 6px}.client-row{display:flex;flex-wrap:wrap;column-gap:18px;row-gap:3px;margin-top:3px}.client-row p{margin:0;min-width:0;max-width:100%;line-height:1.4}.client-row strong{white-space:nowrap}</style>
  <style>*{box-sizing:border-box}body{margin:0;background:white;color:#172033;font:14px Arial,sans-serif}.document{padding:36px}header{display:flex;justify-content:space-between;align-items:center;gap:24px;border-bottom:3px solid #2563eb;padding-bottom:22px}header div{min-width:0}h1{font-size:30px;margin:8px 0}h2{font-size:17px;margin:0 0 10px}p{margin:5px 0;overflow-wrap:anywhere}img{width:150px;height:95px;object-fit:contain}small{display:block;color:#586477;font-size:12px;margin-top:5px}.client{margin:24px 0;padding:16px;background:#f2f5fa}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{padding:12px 8px;border-bottom:1px solid #dbe2eb;text-align:left;overflow-wrap:anywhere}th{background:#edf2fa}th:first-child{width:62%}.number{text-align:right}thead{display:table-header-group}tr{break-inside:avoid}.description,.details{white-space:pre-wrap;overflow-wrap:anywhere}.totals{margin:20px 0 24px auto;width:300px;break-inside:avoid}.totals p{display:flex;justify-content:space-between;gap:16px}.total{border-top:2px solid #2563eb;padding-top:12px;font-size:21px;font-weight:bold}.conditions{break-inside:avoid;border-top:1px solid #dbe2eb;padding-top:18px}.details{margin-top:20px;line-height:1.6}footer{margin-top:32px;padding-top:16px;border-top:1px solid #dbe2eb;text-align:center;color:#586477;font-size:11px}@media print{body{font-size:11px}.document{padding:0}footer{display:none}th,td{padding:9px 6px}}</style></head>
  <body><main class="document"><header><div><h2>${e(report.business.commercialName)}</h2>${field('RFC', report.business.companyRfc)}${field('Dirección', report.business.address)}<h1>Cotización</h1>${field('Fecha', report.date)}${field('Creada por', report.createdBy)}${report.businessPhone || report.businessEmail ? `<div class="company-contact">${field('Teléfono', report.businessPhone)}${field('Correo', report.businessEmail)}</div>` : ''}</div><img src="${e(report.business.image)}" alt="Imagen de la empresa"></header>
  <section class="client"><h2>Datos del cliente</h2>${clientRow([['Cliente', report.client.name], ['Razón social', report.client.businessName], ['RFC', report.client.rfc]])}${clientRow([['Dirección', report.client.address], ['C.P.', report.client.postalCode]])}${clientRow([['Contacto', report.client.contact], ['Teléfono', report.client.phone], ['Correo', report.client.email]])}</section>
  <table><thead><tr><th>Concepto</th><th class="number">Cantidad</th><th class="number">Importe (MXN)</th></tr></thead><tbody>${rows}</tbody></table>
  <section class="totals">${report.hideTax ? '' : `<p><span>Subtotal</span><span>${money(report.subtotal)}</span></p><p><span>${report.tax === '16' ? 'IVA (16%)' : report.tax === 'exempt' ? 'IVA exento' : 'Sin IVA'}</span><span>${money(report.taxAmount)}</span></p>`}<p class="total"><span>Total MXN</span><span>${money(report.total)}</span></p></section>
  <div class="terms-row"><section class="conditions"><h2>Condiciones</h2>${field('Pago', payment)}${field('Plazo de entrega', report.delivery)}${field('Garantía', report.warranty)}${field('Validez', `${report.validityDays} días · Hasta el ${report.expires}`)}</section>
  ${report.serviceDetails.trim() ? `<section class="details"><h2>Detalles del servicio</h2><p>${e(report.serviceDetails)}</p></section>` : ''}</div><footer>${FOOTER}</footer></main></body></html>`;
}

async function exportQuotation(database, options, { dialog, BrowserWindow, parent }) {
  const report = prepareQuotation(database, options);
  const safeName = report.client.name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '-').trim().slice(0, 80) || 'Cliente';
  const { canceled, filePath } = await dialog.showSaveDialog(parent, {
    title: 'Exportar cotización', defaultPath: `Cotizacion-${safeName}.${options.format}`,
    filters: [{ name: options.format === 'pdf' ? 'Documento PDF' : 'Imagen PNG', extensions: [options.format] }]
  });
  if (canceled || !filePath) return null;
  const window = new BrowserWindow({ show: false, width: 900, height: 1200, useContentSize: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } });
  try {
    await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(quotationHtml(report))}`);
    await window.webContents.executeJavaScript(`Promise.all(Array.from(document.images, image => image.decode())).then(() => document.fonts.ready).then(() => true)`);
    let buffer;
    if (options.format === 'pdf') {
      buffer = await window.webContents.printToPDF({ pageSize: 'A4', printBackground: true,
        displayHeaderFooter: true, headerTemplate: '<span></span>',
        footerTemplate: `<div style="font:9px Arial;width:100%;text-align:center;color:#586477">${FOOTER} · <span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
        margins: { top: .4, bottom: .6, left: .4, right: .4 } });
    } else {
      const height = await window.webContents.executeJavaScript('Math.ceil(document.documentElement.scrollHeight)');
      if (height > 16000) throw new Error('La cotización es demasiado larga para una sola imagen. Selecciona PDF para exportarla completa.');
      window.setContentSize(900, height);
      await window.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
      const image = await window.webContents.capturePage({ x: 0, y: 0, width: 900, height }, { stayHidden: true });
      if (image.isEmpty() || image.getSize().height < height) throw new Error('No se pudo capturar la cotización completa. Intenta exportarla en PDF.');
      buffer = image.toPNG();
    }
    await fs.writeFile(filePath, buffer);
  } finally { window.destroy(); }
  return filePath;
}

module.exports = { prepareQuotation, quotationHtml, exportQuotation };
