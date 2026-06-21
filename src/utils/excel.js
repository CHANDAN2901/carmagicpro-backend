const ExcelJS = require('exceljs');

// Parses & validates a ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD query into an
// inclusive [gte, lte] Date range (end date is pushed to end-of-day).
const parseDateRange = (query) => {
  const { startDate, endDate } = query;
  if (!startDate || !endDate) {
    throw Object.assign(new Error('startDate and endDate are required (YYYY-MM-DD)'), { statusCode: 400 });
  }
  const gte = new Date(`${startDate}T00:00:00.000`);
  const lte = new Date(`${endDate}T23:59:59.999`);
  if (Number.isNaN(gte.getTime()) || Number.isNaN(lte.getTime())) {
    throw Object.assign(new Error('Invalid date format. Use YYYY-MM-DD'), { statusCode: 400 });
  }
  if (gte > lte) {
    throw Object.assign(new Error('startDate must be on or before endDate'), { statusCode: 400 });
  }
  return { gte, lte };
};

// columns: [{ header, key, width, style? }] (exceljs column config)
const buildWorkbook = (sheetName, columns, rows) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Car Magic Pro CRM';
  const ws = wb.addWorksheet(sheetName);
  ws.columns = columns;
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.alignment = { vertical: 'middle' };
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A1A' } };
  });
  rows.forEach((r) => ws.addRow(r));
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  return wb;
};

// Streams the workbook to the response as an .xlsx download.
const sendWorkbook = async (res, wb, filename) => {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
};

module.exports = { parseDateRange, buildWorkbook, sendWorkbook };
