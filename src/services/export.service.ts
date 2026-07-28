import { ApiError } from '../utils/ApiError.js';
import logger from '../config/logger.js';

export class ExportService {
  /**
   * @param {{
   *   userRepository: import('../repositories/user.repository.js').UserRepository,
   * }} deps
   */
  constructor(deps) {
    this.users = deps.userRepository;
  }

  /**
   * @param {{ format?: 'csv'|'excel'|'pdf', filter?: object, fields?: string[] }} options
   */
  async exportUsers(options = {}) {
    const format = (options.format || 'csv').toLowerCase();
    const fields = options.fields || [
      'email',
      'firstName',
      'lastName',
      'phone',
      'isActive',
      'emailVerified',
      'createdAt',
      'role',
    ];

    const result = await this.users.findMany(options.filter || {}, {
      page: 1,
      limit: Math.min(options.limit || 5000, 10000),
      sort: options.sort || '-createdAt',
      search: options.search,
      searchFields: ['email', 'firstName', 'lastName'],
      populate: { path: 'role', select: 'name slug' },
      lean: true,
    });

    const rows = result.data.map((user) => flattenUser(user, fields));

    switch (format) {
      case 'csv':
        return {
          mimeType: 'text/csv',
          filename: `users-${dateStamp()}.csv`,
          content: toCsv(fields, rows),
        };
      case 'excel':
      case 'xlsx':
        return {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          filename: `users-${dateStamp()}.xlsx`,
          content: await toExcel(fields, rows),
          encoding: 'buffer',
        };
      case 'pdf':
        return {
          mimeType: 'application/pdf',
          filename: `users-${dateStamp()}.pdf`,
          content: await toPdf(fields, rows),
          encoding: 'buffer',
        };
      default:
        throw ApiError.badRequest('Unsupported export format. Use csv, excel, or pdf');
    }
  }
}

function flattenUser(user, fields) {
  const map = {
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone || '',
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : '',
    role: user.role?.name || user.role?.slug || String(user.role || ''),
    fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
  };
  const row = {};
  for (const f of fields) row[f] = map[f] ?? user[f] ?? '';
  return row;
}

function toCsv(fields, rows) {
  const escape = (val) => {
    const s = String(val ?? '');
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = fields.map(escape).join(',');
  const lines = rows.map((row) => fields.map((f) => escape(row[f])).join(','));
  return [header, ...lines].join('\n');
}

async function toExcel(fields, rows) {
  try {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Users');
    sheet.columns = fields.map((f) => ({ header: f, key: f, width: 20 }));
    rows.forEach((row) => sheet.addRow(row));
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  } catch (err) {
    logger.warn('exceljs unavailable, falling back to CSV buffer', { message: err.message });
    return Buffer.from(toCsv(fields, rows), 'utf8');
  }
}

async function toPdf(fields, rows) {
  try {
    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));

    const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

    doc.fontSize(16).text('Users Export', { underline: true });
    doc.moveDown();
    doc.fontSize(8);

    const header = fields.join(' | ');
    doc.text(header);
    doc.moveDown(0.5);

    for (const row of rows.slice(0, 500)) {
      doc.text(fields.map((f) => String(row[f] ?? '')).join(' | '));
    }

    if (rows.length > 500) {
      doc.moveDown();
      doc.text(`… and ${rows.length - 500} more rows`);
    }

    doc.end();
    return done;
  } catch (err) {
    logger.warn('pdfkit unavailable, falling back to text buffer', { message: err.message });
    return Buffer.from(toCsv(fields, rows), 'utf8');
  }
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

export default ExportService;
