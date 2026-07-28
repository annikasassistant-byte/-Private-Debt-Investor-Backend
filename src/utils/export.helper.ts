import { PassThrough } from 'node:stream';
import { Parser as Json2CsvParser } from 'json2csv';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

/**
 * Export rows to a CSV string (or Buffer).
 * @param {object[]} rows
 * @param {object} [options]
 * @param {string[]} [options.fields]
 * @param {string} [options.delimiter=',']
 * @param {boolean} [options.header=true]
 * @returns {string}
 */
export function exportToCsv(rows, options = {}) {
  const { fields, delimiter = ',', header = true } = options;

  const parser = new Json2CsvParser({
    fields: fields || (rows[0] ? Object.keys(rows[0]) : []),
    delimiter,
    header,
    defaultValue: '',
  });

  return parser.parse(rows || []);
}

/**
 * Export rows to an Excel workbook buffer (.xlsx).
 * @param {object[]} rows
 * @param {object} [options]
 * @param {string} [options.sheetName='Sheet1']
 * @param {string[]} [options.columns]
 * @param {string} [options.title]
 * @returns {Promise<Buffer>}
 */
export async function exportToExcel(rows, options = {}) {
  const { sheetName = 'Sheet1', columns, title } = options;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Depth Dashboard';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName);
  const keys = columns || (rows[0] ? Object.keys(rows[0]) : []);

  sheet.columns = keys.map((key) => ({
    header: key,
    key,
    width: Math.max(12, String(key).length + 4),
  }));

  if (title) {
    sheet.insertRow(1, [title]);
    sheet.mergeCells(1, 1, 1, Math.max(keys.length, 1));
    sheet.getRow(1).font = { bold: true, size: 14 };
    sheet.getRow(2).font = { bold: true };
  } else {
    sheet.getRow(1).font = { bold: true };
  }

  for (const row of rows || []) {
    sheet.addRow(keys.map((key) => row[key] ?? ''));
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Export tabular data to a simple PDF buffer.
 * @param {object[]} rows
 * @param {object} [options]
 * @param {string} [options.title='Export']
 * @param {string[]} [options.columns]
 * @param {'portrait'|'landscape'} [options.orientation='portrait']
 * @returns {Promise<Buffer>}
 */
export function exportToPdf(rows, options = {}) {
  const { title = 'Export', columns, orientation = 'portrait' } = options;
  const keys = columns || (rows[0] ? Object.keys(rows[0]) : []);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 40,
      size: 'A4',
      layout: orientation,
    });

    const stream = new PassThrough();
    const chunks = [];

    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
    doc.on('error', reject);

    doc.pipe(stream);

    doc.fontSize(16).text(title, { underline: true });
    doc.moveDown();

    if (!rows?.length) {
      doc.fontSize(11).text('No data available.');
      doc.end();
      return;
    }

    doc.fontSize(10).font('Helvetica-Bold').text(keys.join(' | '));
    doc.moveDown(0.5);
    doc.font('Helvetica');

    for (const row of rows) {
      const line = keys.map((key) => String(row[key] ?? '')).join(' | ');
      doc.text(line, { width: doc.page.width - 80 });
      doc.moveDown(0.25);

      if (doc.y > doc.page.height - 60) {
        doc.addPage();
      }
    }

    doc.end();
  });
}

/**
 * Map format string to an exporter and content-type.
 * @param {'csv'|'excel'|'xlsx'|'pdf'} format
 * @param {object[]} rows
 * @param {object} [options]
 * @returns {Promise<{ buffer: Buffer, contentType: string, extension: string, filename: string }>}
 */
export async function exportData(format, rows, options = {}) {
  const baseName = options.filename || `export-${Date.now()}`;
  const normalized = String(format || 'csv').toLowerCase();

  if (normalized === 'csv') {
    const csv = exportToCsv(rows, options);
    return {
      buffer: Buffer.from(csv, 'utf8'),
      contentType: 'text/csv; charset=utf-8',
      extension: 'csv',
      filename: `${baseName}.csv`,
    };
  }

  if (normalized === 'excel' || normalized === 'xlsx') {
    const buffer = await exportToExcel(rows, options);
    return {
      buffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: 'xlsx',
      filename: `${baseName}.xlsx`,
    };
  }

  if (normalized === 'pdf') {
    const buffer = await exportToPdf(rows, options);
    return {
      buffer,
      contentType: 'application/pdf',
      extension: 'pdf',
      filename: `${baseName}.pdf`,
    };
  }

  throw new Error(`Unsupported export format: ${format}`);
}

/**
 * Express helper — write an export directly to the response.
 * @param {import('express').Response} res
 * @param {'csv'|'excel'|'xlsx'|'pdf'} format
 * @param {object[]} rows
 * @param {object} [options]
 */
export async function sendExport(res, format, rows, options = {}) {
  const result = await exportData(format, rows, options);

  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  res.setHeader('Content-Length', result.buffer.length);
  return res.status(200).send(result.buffer);
}

export default {
  exportToCsv,
  exportToExcel,
  exportToPdf,
  exportData,
  sendExport,
};
