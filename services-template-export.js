const fs = require('fs');
const XLSX = require('xlsx');

const xml = value => String(value ?? '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').replace(/[&<>"']/g,
  character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);
const money = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const rounded = value => Math.round((value + Number.EPSILON) * 100) / 100;
const costKeys = ['Costo de servicio', 'Viático', 'Costo de materiales', 'Costo de transporte', 'Costo de gasolina', 'Costo final'];

// Edit the template's XML inside its ZIP container. Rebuilding with json_to_sheet
// discards its styles, merged cells, table style, frozen headings and sparkline.
function createServicesWorkbook(templatePath, services, options, clientName) {
  const archive = XLSX.CFB.read(fs.readFileSync(templatePath), { type: 'buffer' });
  const read = name => {
    const entry = XLSX.CFB.find(archive, name);
    if (!entry) throw new Error(`La plantilla no contiene ${name}.`);
    return entry.content.toString('utf8');
  };
  const write = (name, content) => XLSX.CFB.utils.cfb_add(archive, name, Buffer.from(content));
  let sheet = read('/xl/worksheets/sheet1.xml');
  const originalData = sheet.match(/<sheetData>([\s\S]*?)<\/sheetData>/)?.[1];
  if (!originalData) throw new Error('El formato de la plantilla de servicios no es válido.');
  const styles = new Map([...originalData.matchAll(/<c r="([A-Z]+\d+)" s="(\d+)"/g)].map(match => [match[1], match[2]]));
  const cell = (address, value, styleAddress = address, formula) => {
    const style = styles.get(styleAddress) || '10';
    if (value === null) return `<c r="${address}" s="${style}"/>`;
    return typeof value === 'number'
      ? `<c r="${address}" s="${style}">${formula ? `<f>${xml(formula)}</f>` : ''}<v>${value}</v></c>`
      : `<c r="${address}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
  };
  const row = (number, height, cells) => `<row r="${number}" ht="${height}" customHeight="1">${cells.join('')}</row>`;
  const selected = new Set(options.fields || costKeys);
  const include = index => selected.has(costKeys[index]);
  const last = 7 + Math.max(services.length, 1);
  const totalRow = last + 1;
  const totals = [0, 0, 0, 0, 0];
  const dataRows = services.map((service, index) => {
    const number = index + 8;
    const costs = [service.serviceCost, service.travelAllowance, service.materialsCost, service.transportCost, service.gasolineCost].map(money);
    const amounts = [include(0) ? costs[0] : null, include(1) ? costs[1] : null, include(2) ? costs[2] : null,
      include(3) || include(4) ? rounded((include(3) ? costs[3] : 0) + (include(4) ? costs[4] : 0)) : null,
      include(5) ? rounded(costs.reduce((sum, value) => sum + value, 0)) : null];
    amounts.forEach((amount, index) => { totals[index] = rounded(totals[index] + (amount || 0)); });
    const date = /^\d{4}-\d{2}-\d{2}$/.test(service.date) ? (Date.parse(`${service.date}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86400000 : NaN;
    const values = [Number.isFinite(date) ? date : service.date, service.company || service.client, service.city, service.site,
      service.description, service.folio, service.status, service.travelDeposit, ...amounts];
    // Only use a formula for the full total when all its source costs are included.
    const formula = costKeys.slice(0, 5).every(key => selected.has(key)) ? `SUM(J${number}:M${number})` : undefined;
    const height = Math.max(26.25, Math.min(180, Math.ceil(String(service.description || '').length / 22) * 15));
    return row(number, height, values.map((value, column) => {
      const letter = XLSX.utils.encode_col(column + 1);
      return cell(`${letter}${number}`, value ?? '', letter === 'G' ? 'G9' : `${letter}8`, column === 12 ? formula : undefined);
    }));
  });
  if (!dataRows.length) dataRows.push(row(8, 26.25, Array.from({ length: 13 }, (_, index) => {
    const letter = XLSX.utils.encode_col(index + 1);
    return cell(`${letter}8`, null, `${letter}8`);
  })));
  const count = services.length;
  const completed = services.filter(service => service.status === 'Completado').length;
  const sum = (column, value, address, style = address) => cell(address, value, style, `SUM(${column}8:${column}${last})`);
  const totalVisible = include(5);
  const expenseVisible = include(2) || include(3) || include(4);
  const period = /^\d{4}-\d{2}$/.test(options.month || '') ? options.month : 'Todos los meses';
  const subtitle = `Cliente: ${clientName} · Periodo: ${period}`;
  const labels = ['Fecha', 'Empresa', 'Ciudad', 'Sitio', 'Descripción', 'Folio de servicio', 'Estatus', 'Viático depositado',
    'Costo', 'Viáticos', 'Costo de materiales', 'Transporte / gasolina', 'Costo Total'];
  const rows = [row(1, 6.75, []), row(2, 30, [cell('B2', 'Control de Servicios en Campo')]), row(3, 30, [cell('B3', subtitle)]),
    row(4, 33.75, [cell('B4', 'Total Servicios'), cell('D4', 'Servicios Completados'), cell('F4', 'Costo Total Acumulado'),
      cell('J4', 'Total de Viáticos'), cell('M4', 'Desglose de Gastos')]),
    row(5, 33.75, [cell('B5', count, 'B5', `COUNTA(B8:B${last})`), cell('D5', completed, 'D5', `COUNTIF(H8:H${last},"Completado")`),
      cell('F5', totalVisible ? totals[4] : null, 'F5', `N${totalRow}`), sum('K', include(1) ? totals[1] : null, 'J5'),
      cell('M5', expenseVisible ? rounded(totals[2] + totals[3]) : null, 'M5', `SUM(L${totalRow}:M${totalRow})`)]),
    row(7, 36, labels.map((label, index) => cell(`${XLSX.utils.encode_col(index + 1)}7`, label))), ...dataRows,
    row(totalRow, 30, [cell(`H${totalRow}`, 'Total General', 'H13'), ...['J', 'K', 'L', 'M', 'N'].map((column, index) =>
      sum(column, [include(0), include(1), include(2), include(3) || include(4), include(5)][index] ? totals[index] : null,
        `${column}${totalRow}`, `${column}13`))])];
  sheet = sheet.replace(/<sheetData>[\s\S]*?<\/sheetData>/, `<sheetData>${rows.join('')}</sheetData>`)
    .replace(/<dimension[^>]*\/>/, `<dimension ref="A1:N${totalRow}"/>`)
    .replace(/activeCell="L16" sqref="L16"/, 'activeCell="B8" sqref="B8"')
    // The template's validation lists contain sample clients/cities, not the actual export.
    .replace(/<dataValidations[\s\S]*?<\/dataValidations>/, '')
    .replace(/<xm:f>.*?<\/xm:f>/, `<xm:f>'Servicios'!J${totalRow}:M${totalRow}</xm:f>`)
    .replace('<headerFooter/>', '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/><headerFooter/>')
    .replace('</sheetPr>', '<pageSetUpPr fitToPage="1"/></sheetPr>');
  write('/xl/worksheets/sheet1.xml', sheet);
  let table = read('/xl/tables/table1.xml').replace('ref="B7:N13"', `ref="B7:N${totalRow}" totalsRowCount="1" totalsRowShown="1"`)
    .replace('<tableColumns', `<autoFilter ref="B7:N${last}"/><tableColumns`).replace('name="Columna1"', 'name="Transporte / gasolina"');
  write('/xl/tables/table1.xml', table);
  let workbook = read('/xl/workbook.xml').replace('name="Mayo"', 'name="Servicios"')
    .replace(/<calcPr[^>]*\/>/, '<calcPr calcId="191029" fullCalcOnLoad="1"/>');
  workbook = workbook.replace('</sheets>', `</sheets><definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">'Servicios'!$B$2:$N$${totalRow}</definedName><definedName name="_xlnm.Print_Titles" localSheetId="0">'Servicios'!$7:$7</definedName></definedNames>`);
  write('/xl/workbook.xml', workbook);
  write('/docProps/app.xml', read('/docProps/app.xml').replace('<vt:lpstr>Mayo</vt:lpstr>', '<vt:lpstr>Servicios</vt:lpstr>'));
  // All cells now use inline strings: discard the sample data in shared strings.
  write('/xl/sharedStrings.xml', '<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="0" uniqueCount="0"/>');
  return XLSX.CFB.write(archive, { type: 'buffer', fileType: 'zip', compression: true });
}

function exportServices(database, options, { dialog, parent, templatePath }) {
  const services = database.listServices().filter(service =>
    (!options.month || service.date.startsWith(options.month)) &&
    (options.clientId == null || service.clientId === options.clientId) &&
    (options.companyId == null || service.companyId === options.companyId)
  ).sort((a, b) => a.date.localeCompare(b.date) || String(a.folio || '').localeCompare(String(b.folio || '')));
  const clientName = options.clientId == null ? 'Todos los clientes' : database.listClients().find(client => client.id === options.clientId)?.name || 'Cliente';
  const workbook = createServicesWorkbook(templatePath, services, options, clientName);
  const safeClientName = clientName.replace(/[<>:"/\\|?*\x00-\x1F]/g, '-').trim().slice(0, 80);
  const filePath = dialog.showSaveDialogSync(parent, {
    title: 'Exportar servicios', defaultPath: `Servicios-${safeClientName}-${options.month || 'todos-los-meses'}.xlsx`,
    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
  });
  if (!filePath) return null;
  fs.writeFileSync(filePath, workbook);
  return filePath;
}

module.exports = { createServicesWorkbook, exportServices };
