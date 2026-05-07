// Generate realistic, India-styled mock tender + bidder PDFs for the Nirnay demo.
// Run with: npm run generate-mocks
//
// Each PDF carries Indian-government / banking / certification visual cues:
//   - Department letterhead with bilingual heading
//   - File numbers in Govt of India format (F.No. CRPF/HQ/CIV/2026/04-117)
//   - GSTIN / PAN / UDIN with realistic format
//   - Stamp blocks (TEXT-DRAWN circular & rectangular seals)
//   - Signature blocks with name, designation, ICAI / Bank manager etc.
//   - INR figures with both numerals and "Rupees ... Only" words
//   - Bilingual section headers (Devanagari word transliterated; full Hindi
//     can't render via core helvetica, so we use ASCII transliteration in [])
//
// Verdicts are tuned so that against the mock tender:
//   bidder-01 -> eligible       (clean docs, all thresholds met + bonus criteria)
//   bidder-02 -> not_eligible   (turnover Rs. 3.4 Cr < 5 Cr, solvency 1.5 Cr < 2 Cr)
//   bidder-03 -> needs_review   (ISO expires on bid date, audit pending)
//   bidder-04 -> eligible       (strong financials, paramilitary history)
//   bidder-05 -> not_eligible   (ISO 9001 expired 2025-06-30 before bid date)

import { jsPDF } from 'jspdf';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'sample-data');
mkdirSync(OUT, { recursive: true });

const BID_DATE = '15-04-2026';
const BID_DATE_ISO = '2026-04-15';

// ============================================================================
// Low-level helpers for drawing rich PDFs
// ============================================================================

function newDoc() {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  doc.setFont('helvetica', 'normal');
  return doc;
}

function pageW(doc) {
  return doc.internal.pageSize.getWidth();
}
function pageH(doc) {
  return doc.internal.pageSize.getHeight();
}

function hairline(doc, x1, y1, x2, y2, color = [80, 80, 80]) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.5);
  doc.line(x1, y1, x2, y2);
}

function drawDoubleRule(doc, y, margin) {
  hairline(doc, margin, y, pageW(doc) - margin, y);
  hairline(doc, margin, y + 3, pageW(doc) - margin, y + 3);
}

function watermark(doc, text) {
  const w = pageW(doc);
  const h = pageH(doc);
  doc.saveGraphicsState();
  doc.setTextColor(220, 220, 220);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(70);
  doc.text(text, w / 2, h / 2, {
    align: 'center',
    angle: 35,
    baseline: 'middle',
  });
  doc.restoreGraphicsState();
  doc.setTextColor(0, 0, 0);
}

function ashokSeal(doc, cx, cy, label = 'GOVT OF INDIA') {
  // Circular text-based seal — three concentric circles with text
  doc.setDrawColor(40, 40, 40);
  doc.setLineWidth(1.2);
  doc.circle(cx, cy, 36, 'S');
  doc.setLineWidth(0.4);
  doc.circle(cx, cy, 32, 'S');
  doc.circle(cx, cy, 12, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(40, 40, 40);
  // Top arc
  doc.text(label, cx, cy - 20, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.text('SATYAMEVA JAYATE', cx, cy + 26, { align: 'center' });
  doc.setFontSize(8);
  doc.text('★', cx, cy + 3, { align: 'center', baseline: 'middle' });
  doc.setTextColor(0, 0, 0);
}

function rectSeal(doc, x, y, w, h, lines, color = [120, 30, 30]) {
  doc.setDrawColor(...color);
  doc.setLineWidth(1);
  doc.rect(x, y, w, h);
  doc.setTextColor(...color);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  let cy = y + 12;
  for (const ln of lines) {
    doc.text(ln, x + w / 2, cy, { align: 'center' });
    cy += 9;
  }
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
}

function signatureBlock(doc, x, y, opts) {
  const { name, designation, line1, line2, width = 200 } = opts;
  hairline(doc, x, y, x + width, y);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(name, x, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  if (designation) doc.text(designation, x, y + 22);
  if (line1) doc.text(line1, x, y + 32);
  if (line2) doc.text(line2, x, y + 42);
}

function fieldRow(doc, x, y, label, value, opts = {}) {
  const { labelWidth = 130, valueBold = false } = opts;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(label, x, y);
  doc.setTextColor(0, 0, 0);
  if (valueBold) doc.setFont('helvetica', 'bold');
  doc.text(String(value), x + labelWidth, y);
  doc.setFont('helvetica', 'normal');
}

function paragraph(doc, x, y, text, opts = {}) {
  const { width = pageW(doc) - 96, fontSize = 10, lineHeight = 14, font = 'normal' } = opts;
  doc.setFont('helvetica', font);
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(text, width);
  for (const ln of lines) {
    doc.text(ln, x, y);
    y += lineHeight;
  }
  return y;
}

function table(doc, x, y, columns, rows, opts = {}) {
  const { headerBg = [240, 240, 235], rowH = 18, headerH = 20, fontSize = 9 } = opts;
  const totalW = columns.reduce((sum, c) => sum + c.w, 0);
  // Header
  doc.setFillColor(...headerBg);
  doc.setDrawColor(180, 180, 180);
  doc.rect(x, y, totalW, headerH, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSize);
  let cx = x;
  for (const col of columns) {
    doc.text(col.label, cx + 5, y + 13);
    cx += col.w;
  }
  doc.setFont('helvetica', 'normal');
  // Rows
  let ry = y + headerH;
  for (const row of rows) {
    doc.setDrawColor(220, 220, 220);
    doc.rect(x, ry, totalW, rowH, 'S');
    let rx = x;
    for (const col of columns) {
      const v = row[col.key];
      const text = v == null ? '' : String(v);
      const lines = doc.splitTextToSize(text, col.w - 10);
      doc.text(lines[0] || '', rx + 5, ry + 12);
      rx += col.w;
    }
    ry += rowH;
  }
  // Vertical lines
  let vx = x;
  doc.setDrawColor(220, 220, 220);
  for (let i = 0; i < columns.length; i++) {
    doc.line(vx, y, vx, ry);
    vx += columns[i].w;
  }
  doc.line(x + totalW, y, x + totalW, ry);
  return ry;
}

function inrInWords(amount) {
  // Indian numbering — basic implementation for the values we use.
  const map = {
    100000: 'One Lakh',
    150000: 'One Lakh Fifty Thousand',
    500000: 'Five Lakh',
    1000000: 'Ten Lakh',
    1500000: 'Fifteen Lakh',
    1600000: 'Sixteen Lakh',
    2000000: 'Twenty Lakh',
    2100000: 'Twenty One Lakh',
    2150000: 'Twenty One Lakh Fifty Thousand',
    2300000: 'Twenty Three Lakh',
    2400000: 'Twenty Four Lakh',
    2600000: 'Twenty Six Lakh',
    2800000: 'Twenty Eight Lakh',
    2900000: 'Twenty Nine Lakh',
    3000000: 'Thirty Lakh',
    3100000: 'Thirty One Lakh',
    3400000: 'Thirty Four Lakh',
    3700000: 'Thirty Seven Lakh',
    3900000: 'Thirty Nine Lakh',
    4000000: 'Forty Lakh',
    4500000: 'Forty Five Lakh',
    4800000: 'Forty Eight Lakh',
    4900000: 'Forty Nine Lakh',
    5400000: 'Fifty Four Lakh',
    5800000: 'Fifty Eight Lakh',
    6200000: 'Sixty Two Lakh',
    6400000: 'Sixty Four Lakh',
    7100000: 'Seventy One Lakh',
    7200000: 'Seventy Two Lakh',
    7500000: 'Seventy Five Lakh',
    8900000: 'Eighty Nine Lakh',
    9200000: 'Ninety Two Lakh',
    9800000: 'Ninety Eight Lakh',
    11800000: 'One Crore Eighteen Lakh',
    12400000: 'One Crore Twenty Four Lakh',
    14300000: 'One Crore Forty Three Lakh',
    15200000: 'One Crore Fifty Two Lakh',
    18000000: 'One Crore Eighty Lakh',
    20000000: 'Two Crore',
    25000000: 'Two Crore Fifty Lakh',
    30000000: 'Three Crore',
    40000000: 'Four Crore',
    50000000: 'Five Crore',
    62000000: 'Six Crore Twenty Lakh',
    72000000: 'Seven Crore Twenty Lakh',
    80000000: 'Eight Crore',
    98000000: 'Nine Crore Eighty Lakh',
    124000000: 'Twelve Crore Forty Lakh',
    143000000: 'Fourteen Crore Thirty Lakh',
    152000000: 'Fifteen Crore Twenty Lakh',
    180000000: 'Eighteen Crore',
  };
  return map[amount] || `(amount in words)`;
}

function inrFmt(amount) {
  // Indian numbering — 2,50,00,000 style
  const s = String(Math.abs(amount));
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
}

function rs(amount) {
  return `Rs. ${inrFmt(amount)}/-`;
}
function rupeesWords(amount) {
  return `(Rupees ${inrInWords(amount)} Only)`;
}

function save(doc, path) {
  writeFileSync(path, Buffer.from(doc.output('arraybuffer')));
  console.log('  ', path.replace(OUT, 'sample-data'));
}

// ============================================================================
// Tender NIT (Notice Inviting Tender)
// ============================================================================

function generateTender() {
  const doc = newDoc();
  const margin = 48;
  const w = pageW(doc);

  // ---------- letterhead ----------
  ashokSeal(doc, w / 2, margin + 30, 'CRPF');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  doc.text('GOVERNMENT OF INDIA', w / 2, margin + 78, { align: 'center' });
  doc.setFontSize(10);
  doc.text('MINISTRY OF HOME AFFAIRS', w / 2, margin + 92, { align: 'center' });
  doc.setFontSize(13);
  doc.text('CENTRAL RESERVE POLICE FORCE', w / 2, margin + 108, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('[Kendriya Reserve Police Bal]', w / 2, margin + 120, { align: 'center' });
  doc.setFontSize(9);
  doc.text(
    'Directorate General : CGO Complex, Lodhi Road, New Delhi - 110003',
    w / 2,
    margin + 134,
    { align: 'center' },
  );
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(
    'Tel: 011-24369472   |   Fax: 011-24368820   |   www.crpf.gov.in   |   eprocure.gov.in',
    w / 2,
    margin + 146,
    { align: 'center' },
  );
  doc.setTextColor(0, 0, 0);

  drawDoubleRule(doc, margin + 158, margin);

  // ---------- title ----------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('NOTICE INVITING TENDER (e-Procurement)', w / 2, margin + 184, {
    align: 'center',
  });
  doc.setFontSize(10);
  doc.text('[Nivida Aamantran Suchna]', w / 2, margin + 198, { align: 'center' });

  // file no row
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('F.No. CRPF/HQ/CIV/2026/04-117', margin, margin + 224);
  doc.text('Dated: 25-03-2026', w - margin, margin + 224, { align: 'right' });

  // ---------- name of work ----------
  let y = margin + 248;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(
    'Name of Work : Construction of Border Outpost Building',
    margin,
    y,
  );
  y += 14;
  doc.text('for Central Reserve Police Force, Sector-14, North Frontier', margin, y);
  y += 22;

  // ---------- key figures table ----------
  doc.setFont('helvetica', 'normal');
  y = table(
    doc,
    margin,
    y,
    [
      { key: 'k', label: 'Particulars', w: 240 },
      { key: 'v', label: 'Details', w: pageW(doc) - margin * 2 - 240 },
    ],
    [
      { k: 'Tender Reference No.', v: 'CRPF/CIV/2026/04/BOP-117' },
      { k: 'Estimated Cost (incl. GST)', v: `${rs(80000000)} ${rupeesWords(80000000)}` },
      { k: 'Earnest Money Deposit (EMD)', v: `${rs(1600000)} ${rupeesWords(1600000)}` },
      { k: 'Tender Fee (Non-refundable)', v: 'Rs. 5,000/-' },
      { k: 'Period of Completion', v: '18 (Eighteen) months from date of award' },
      { k: 'Class of Contractor', v: 'Class-I (Civil) registered with CPWD/MES/RAILWAYS' },
      { k: 'Date of NIT Publication', v: '25-03-2026' },
      { k: 'Pre-bid Meeting', v: '02-04-2026, 11:00 hrs IST, CRPF DG HQ' },
      { k: 'Last Date for Bid Submission', v: `${BID_DATE}, 15:00 hrs IST` },
      { k: 'Date of Technical Bid Opening', v: '16-04-2026, 11:00 hrs IST' },
      { k: 'Bid Validity', v: '120 days from technical bid opening' },
    ],
    { headerBg: [232, 232, 224] },
  );

  // ---------- eligibility section ----------
  y += 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('SECTION 3 — MINIMUM ELIGIBILITY CRITERIA', margin, y);
  y += 5;
  hairline(doc, margin, y, w - margin, y);
  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  y = paragraph(
    doc,
    margin,
    y,
    'The bidder shall meet ALL of the following minimum eligibility criteria. Bids that fail any mandatory criterion (marked "shall" / "must") shall be summarily rejected. Documentary evidence is mandatory for each criterion and must be uploaded with the technical bid.',
  );
  y += 6;

  // 3.1 Financial
  doc.setFont('helvetica', 'bold');
  doc.text('3.1  Financial Eligibility', margin, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  y = paragraph(
    doc,
    margin,
    y,
    'C-1.  The bidder SHALL have a minimum annual turnover of Rs. 5,00,00,000/- (Rupees Five Crore Only) in any one of the last three financial years viz. FY 2022-23, FY 2023-24 or FY 2024-25, certified by a practising Chartered Accountant with UDIN.',
  );
  y += 4;
  y = paragraph(
    doc,
    margin,
    y,
    'C-2.  The bidder SHALL submit a valid Solvency Certificate from any Scheduled Commercial Bank for an amount NOT LESS THAN Rs. 2,00,00,000/- (Rupees Two Crore Only). The certificate must be issued not earlier than six (6) months before the bid submission date.',
  );
  y += 4;
  y = paragraph(
    doc,
    margin,
    y,
    'C-3.  The bidder MUST submit Earnest Money Deposit (EMD) of Rs. 16,00,000/- (Rupees Sixteen Lakh Only) in the form of a Bank Guarantee or Demand Draft drawn in favour of "DDO, Directorate General CRPF, New Delhi".',
  );
  y += 8;

  // 3.2 Technical
  doc.setFont('helvetica', 'bold');
  doc.text('3.2  Technical Eligibility', margin, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  y = paragraph(
    doc,
    margin,
    y,
    'C-4.  The bidder SHALL have successfully completed at least three (3) similar civil construction projects in the last seven (7) years from date of bid submission, each of value not less than Rs. 2,00,00,000/- (Rupees Two Crore). "Similar" means construction of buildings, barracks, or institutional structures for Government / PSU / Municipal clients. Completion certificates issued by client departments are mandatory.',
  );
  y += 4;
  y = paragraph(
    doc,
    margin,
    y,
    'C-5.  The bidder MUST have a minimum of five (5) years of experience in civil construction. Date of incorporation under Companies Act / firm registration / GST registration shall be the reference.',
  );
  y += 8;

  if (y > pageH(doc) - 200) {
    doc.addPage();
    y = margin;
  }

  // 3.3 Compliance
  doc.setFont('helvetica', 'bold');
  doc.text('3.3  Statutory Compliance & Certifications', margin, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  y = paragraph(
    doc,
    margin,
    y,
    'C-6.  The bidder SHALL hold a valid Goods & Services Tax (GST) Registration. GSTIN must be active as on the date of bid submission, verified through GSTN portal.',
  );
  y += 4;
  y = paragraph(
    doc,
    margin,
    y,
    'C-7.  The bidder SHALL hold a valid ISO 9001:2015 (Quality Management System) certification, issued by an IAF-accredited certifying body and valid as on the date of bid submission.',
  );
  y += 8;

  // 3.4 Documents
  doc.setFont('helvetica', 'bold');
  doc.text('3.4  Document Submission', margin, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  y = paragraph(
    doc,
    margin,
    y,
    'C-8.  The bidder SHALL submit a self-attested copy of the Permanent Account Number (PAN) Card of the firm / company, issued by the Income Tax Department.',
  );
  y += 8;

  // 3.5 Preferred
  doc.setFont('helvetica', 'bold');
  doc.text('3.5  Preferred (Non-Mandatory) Criteria', margin, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  y = paragraph(
    doc,
    margin,
    y,
    'C-9.  ISO 14001:2015 (Environmental Management System) certification is DESIRABLE and shall carry weightage in the technical scoring. This is a preferred criterion and absence shall not lead to rejection.',
  );
  y += 4;
  y = paragraph(
    doc,
    margin,
    y,
    'C-10. Prior experience of having executed construction projects for paramilitary forces (CRPF / BSF / ITBP / SSB / CISF) or Indian Armed Forces is ADVANTAGEOUS and may be cited in the cover letter.',
  );

  if (y > pageH(doc) - 180) {
    doc.addPage();
    y = margin;
  } else {
    y += 24;
  }

  // ---------- Declaration + signature ----------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('DECLARATION', margin, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  y = paragraph(
    doc,
    margin,
    y,
    'The undersigned hereby certifies that the information provided in this NIT and its annexures is correct to the best of their knowledge. CRPF reserves the right to reject any or all bids without assigning any reason and to relax the criteria in the interest of public service in accordance with the General Financial Rules, 2017.',
    { fontSize: 9, lineHeight: 12 },
  );

  y += 30;
  signatureBlock(doc, margin, y, {
    name: '(Y. K. Saxena, IPS)',
    designation: 'Inspector General (Provisioning)',
    line1: 'Directorate General CRPF',
    line2: 'For and on behalf of President of India',
  });

  // Office round seal on the right
  rectSeal(doc, w - margin - 110, y - 10, 110, 56, [
    'OFFICE OF THE',
    'INSPECTOR GENERAL',
    '(PROVISIONING)',
    'CRPF DG HQ, NEW DELHI',
  ]);

  // Subtle watermark on every page
  const pages = doc.internal.pages.length - 1;
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    watermark(doc, 'GOVT OF INDIA');
  }

  save(doc, join(OUT, 'mock-tender.pdf'));
}

// ============================================================================
// Bidder document generators
// ============================================================================

function coverLetter({ company, address, ceoName, ceoDesignation, since, body }, outPath) {
  const doc = newDoc();
  const margin = 48;
  const w = pageW(doc);

  // company letterhead band
  doc.setFillColor(20, 30, 60);
  doc.rect(0, 0, w, 70, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(company.toUpperCase(), margin, 36);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(address, margin, 50);
  doc.text(`Established ${since}   |   GST Registered   |   ISO 9001:2015 Certified`, margin, 60);
  doc.setTextColor(0, 0, 0);

  let y = 110;
  doc.setFontSize(9);
  doc.text(`Ref: ${company.split(' ')[0].toUpperCase()}/CRPF/2026/${Math.floor(Math.random() * 900 + 100)}`, margin, y);
  doc.text(`Date: ${BID_DATE}`, w - margin, y, { align: 'right' });
  y += 20;

  doc.setFont('helvetica', 'bold');
  doc.text('To,', margin, y);
  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.text('The Inspector General (Provisioning)', margin, y);
  y += 12;
  doc.text('Directorate General, Central Reserve Police Force', margin, y);
  y += 12;
  doc.text('CGO Complex, Lodhi Road, New Delhi - 110003', margin, y);
  y += 24;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Subject: Submission of Technical & Financial Bid', margin, y);
  y += 12;
  doc.text(
    '         Tender Ref: CRPF/CIV/2026/04/BOP-117 — Construction of BOP, Sector-14',
    margin,
    y,
  );
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Respected Sir / Madam,', margin, y);
  y += 16;

  for (const para of body) {
    y = paragraph(doc, margin, y, para, { fontSize: 10, lineHeight: 14 });
    y += 8;
  }

  y += 14;
  doc.text('Yours faithfully,', margin, y);
  y += 60;

  signatureBlock(doc, margin, y, {
    name: ceoName,
    designation: ceoDesignation,
    line1: `For ${company}`,
    line2: 'Authorised Signatory',
  });

  rectSeal(doc, w - margin - 130, y - 14, 130, 60, [
    company.toUpperCase(),
    '— AUTHORISED SIGNATORY —',
    'COMPANY SEAL',
  ]);

  save(doc, outPath);
}

function caCertificate({ company, pan, caFirm, caName, caRegNo, udin, turnovers, place, date }, outPath) {
  const doc = newDoc();
  const margin = 48;
  const w = pageW(doc);

  // CA firm letterhead
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(caFirm.toUpperCase(), w / 2, 60, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Chartered Accountants', w / 2, 74, { align: 'center' });
  doc.text(`Firm Reg. No.: ${caRegNo}   |   ICAI Member: ${caName}`, w / 2, 86, {
    align: 'center',
  });
  drawDoubleRule(doc, 96, margin);

  let y = 122;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('CERTIFICATE OF ANNUAL TURNOVER', w / 2, y, { align: 'center' });
  y += 16;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`UDIN: ${udin}`, w / 2, y, { align: 'center' });
  y += 22;

  doc.setFontSize(10);
  doc.text(`To Whomsoever It May Concern`, margin, y);
  y += 22;

  y = paragraph(
    doc,
    margin,
    y,
    `This is to certify that based on the audited financial statements of M/s ${company} (PAN: ${pan}) and the books of account produced before us, the annual turnover for the last three financial years is as follows:`,
    { lineHeight: 14 },
  );
  y += 12;

  y = table(
    doc,
    margin,
    y,
    [
      { key: 'fy', label: 'Financial Year', w: 160 },
      { key: 'amt', label: 'Turnover (Rs.)', w: 160 },
      { key: 'words', label: 'Amount in Words', w: pageW(doc) - margin * 2 - 320 },
    ],
    turnovers.map((t) => ({
      fy: t.fy,
      amt: inrFmt(t.amount) + '/-',
      words: inrInWords(t.amount),
    })),
  );
  y += 16;

  y = paragraph(
    doc,
    margin,
    y,
    'The above turnover figures are stated as per audited Statement of Profit & Loss prepared in accordance with the applicable accounting standards (Ind AS / AS) and the Companies Act, 2013.',
    { lineHeight: 14 },
  );
  y += 4;
  y = paragraph(
    doc,
    margin,
    y,
    'This certificate is issued at the specific request of the management for the limited purpose of submitting it to Government of India / CRPF in connection with Tender Ref: CRPF/CIV/2026/04/BOP-117.',
    { lineHeight: 14 },
  );

  y += 28;
  doc.setFontSize(9);
  doc.text(`Place : ${place}`, margin, y);
  doc.text(`Date  : ${date}`, margin, y + 12);

  signatureBlock(doc, w - margin - 200, y, {
    name: `For ${caFirm}`,
    designation: 'Chartered Accountants',
    line1: `(${caName}) — Partner`,
    line2: `M. No. ${caRegNo.split('/')[0]}   FRN: ${caRegNo}`,
  });

  rectSeal(doc, w - margin - 110, y + 56, 110, 50, [
    'INSTITUTE OF CHARTERED',
    'ACCOUNTANTS OF INDIA',
    `MEMBERSHIP ${caRegNo.split('/')[0]}`,
  ]);

  save(doc, outPath);
}

function solvencyCertificate({ company, accountNo, bankName, branch, address, date, amount, refNo }, outPath) {
  const doc = newDoc();
  const margin = 48;
  const w = pageW(doc);

  // Bank letterhead — colored band
  doc.setFillColor(8, 60, 120);
  doc.rect(0, 0, w, 70, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(bankName.toUpperCase(), margin, 38);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${branch} BRANCH`, margin, 52);
  doc.text(address, margin, 62);
  doc.setTextColor(0, 0, 0);

  let y = 110;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('SOLVENCY CERTIFICATE', w / 2, y, { align: 'center' });
  y += 14;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Ref: ${refNo}`, margin, y);
  doc.text(`Date: ${date}`, w - margin, y, { align: 'right' });
  y += 24;

  doc.setFontSize(10);
  doc.text('TO WHOMSOEVER IT MAY CONCERN', w / 2, y, { align: 'center' });
  y += 22;

  y = paragraph(
    doc,
    margin,
    y,
    `This is to certify that M/s ${company} is maintaining a Current Account No. ${accountNo} with ${bankName}, ${branch} Branch, since ${(parseInt(date.split('-')[2]) - 5)}.`,
    { lineHeight: 14 },
  );
  y += 6;

  y = paragraph(
    doc,
    margin,
    y,
    `Based on the average balance maintained, the credit facilities availed, and our internal credit-rating assessment, we hereby certify that the said firm is SOLVENT to the extent of:`,
    { lineHeight: 14 },
  );
  y += 8;

  // Big amount box
  doc.setDrawColor(8, 60, 120);
  doc.setLineWidth(1.2);
  doc.rect(margin, y, w - margin * 2, 50);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(`Rs. ${inrFmt(amount)}/-`, w / 2, y + 22, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`(Rupees ${inrInWords(amount)} Only)`, w / 2, y + 38, { align: 'center' });
  y += 64;

  y = paragraph(
    doc,
    margin,
    y,
    'This certificate is issued at the specific request of the customer for the purpose of submission to Government of India / Public Sector Undertakings, in connection with the tendering process. This certificate is valid for SIX (6) MONTHS from the date of issue. The bank, however, gives no guarantee or assurance regarding any commercial dealings the firm may enter into.',
    { lineHeight: 13, fontSize: 9 },
  );

  y += 30;
  signatureBlock(doc, margin, y, {
    name: 'For ' + bankName,
    designation: 'Branch Manager',
    line1: `${branch} Branch`,
    line2: `Auth. Code: ${refNo.split('/').pop()}`,
  });

  rectSeal(doc, w - margin - 130, y - 4, 130, 60, [
    bankName.toUpperCase(),
    `${branch.toUpperCase()} BRANCH`,
    'BRANCH MANAGER',
  ], [8, 60, 120]);

  save(doc, outPath);
}

function gstCertificate({ company, gstin, legalName, dateOfRegistration, address, status }, outPath) {
  const doc = newDoc();
  const margin = 48;
  const w = pageW(doc);

  // GST government header
  doc.setFillColor(255, 153, 51); // saffron
  doc.rect(0, 0, w, 14, 'F');
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 14, w, 14, 'F');
  doc.setFillColor(19, 136, 8); // green
  doc.rect(0, 28, w, 14, 'F');

  let y = 64;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Government of India', w / 2, y, { align: 'center' });
  y += 14;
  doc.text('Form GST REG-06', w / 2, y, { align: 'center' });
  y += 16;
  doc.setFontSize(13);
  doc.text('REGISTRATION CERTIFICATE', w / 2, y, { align: 'center' });
  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('[Panjikaran Pramaan-Patra]', w / 2, y, { align: 'center' });
  y += 14;
  hairline(doc, margin, y, w - margin, y);
  y += 22;

  doc.setFontSize(10);
  fieldRow(doc, margin, y, 'Registration Number (GSTIN):', gstin, { valueBold: true });
  y += 18;
  fieldRow(doc, margin, y, 'Legal Name of Business:', legalName, { valueBold: true });
  y += 18;
  fieldRow(doc, margin, y, 'Trade Name (if any):', company);
  y += 18;
  fieldRow(doc, margin, y, 'Constitution of Business:', 'Private Limited Company');
  y += 18;
  fieldRow(doc, margin, y, 'Address of Principal Place:', '');
  doc.setFontSize(9);
  for (const ln of doc.splitTextToSize(address, w - margin * 2 - 130)) {
    y += 13;
    doc.text(ln, margin + 130, y);
  }
  y += 22;

  fieldRow(doc, margin, y, 'Date of Registration:', dateOfRegistration);
  y += 18;
  fieldRow(doc, margin, y, 'Period of Validity (From):', dateOfRegistration);
  y += 18;
  fieldRow(doc, margin, y, 'Period of Validity (To):', 'NA (Continuing)');
  y += 18;
  fieldRow(doc, margin, y, 'Type of Registration:', 'Regular');
  y += 18;
  fieldRow(doc, margin, y, 'Particulars of Approving Authority:', 'GST Network (Auto-approved)');
  y += 18;
  fieldRow(doc, margin, y, 'Status (verified):', status);

  y += 36;
  doc.setFontSize(9);
  doc.text('This is a system-generated certificate.', w / 2, y, { align: 'center' });
  y += 12;
  doc.text(
    `Verifiable at https://services.gst.gov.in/services/searchtp using GSTIN ${gstin}`,
    w / 2,
    y,
    { align: 'center' },
  );

  rectSeal(doc, w - margin - 120, y + 24, 120, 60, [
    'GOODS AND SERVICES TAX',
    'NETWORK',
    'AUTHORISED OFFICIAL',
    'CENTRAL BOARD OF',
    'INDIRECT TAXES & CUSTOMS',
  ]);

  save(doc, outPath);
}

function isoCertificate({ company, certifyingBody, certNo, scope, issueDate, expiryDate, originalDate, standard = 'ISO 9001:2015', note }, outPath) {
  const doc = newDoc();
  const margin = 48;
  const w = pageW(doc);
  const h = pageH(doc);

  // Decorative outer border
  doc.setDrawColor(40, 80, 140);
  doc.setLineWidth(2);
  doc.rect(margin / 2, margin / 2, w - margin, h - margin);
  doc.setLineWidth(0.5);
  doc.rect(margin / 2 + 6, margin / 2 + 6, w - margin - 12, h - margin - 12);

  let y = margin + 30;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(certifyingBody.toUpperCase(), w / 2, y, { align: 'center' });
  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('IAF Accredited Certification Body', w / 2, y, { align: 'center' });
  y += 36;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('CERTIFICATE OF', w / 2, y, { align: 'center' });
  y += 22;
  doc.text('REGISTRATION', w / 2, y, { align: 'center' });
  y += 28;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Certificate No.   ${certNo}`, w / 2, y, { align: 'center' });
  y += 32;

  doc.setFontSize(11);
  doc.text('It is hereby certified that the management system of', w / 2, y, {
    align: 'center',
  });
  y += 24;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(company.toUpperCase(), w / 2, y, { align: 'center' });
  y += 26;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`has been audited and found to be in compliance with the requirements of`, w / 2, y, {
    align: 'center',
  });
  y += 22;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(standard, w / 2, y, { align: 'center' });
  y += 30;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Scope of Certification:', w / 2, y, { align: 'center' });
  y += 14;
  doc.setFont('helvetica', 'italic');
  const scopeLines = doc.splitTextToSize(scope, w - margin * 2 - 40);
  for (const ln of scopeLines) {
    doc.text(ln, w / 2, y, { align: 'center' });
    y += 13;
  }
  doc.setFont('helvetica', 'normal');
  y += 16;

  // Date block
  const colW = (w - margin * 2) / 3;
  const baseX = margin;
  const dateY = y + 6;
  for (const [label, val, idx] of [
    ['Original Certification Date', originalDate, 0],
    ['Date of Issue', issueDate, 1],
    ['Date of Expiry', expiryDate, 2],
  ]) {
    const cx = baseX + colW * idx + colW / 2;
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(label, cx, y, { align: 'center' });
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(val, cx, dateY + 12, { align: 'center' });
    doc.setFont('helvetica', 'normal');
  }
  y = dateY + 40;

  if (note) {
    doc.setFontSize(8);
    doc.setTextColor(140, 30, 30);
    const noteLines = doc.splitTextToSize(note, w - margin * 2 - 40);
    for (const ln of noteLines) {
      doc.text(ln, w / 2, y, { align: 'center' });
      y += 11;
    }
    doc.setTextColor(0, 0, 0);
  }

  // Signature
  signatureBlock(doc, margin, h - margin - 60, {
    name: 'For ' + certifyingBody,
    designation: 'Director — Certification Services',
    width: 180,
  });
  rectSeal(doc, w - margin - 120, h - margin - 80, 120, 60, [
    certifyingBody.toUpperCase(),
    'CERTIFICATION BODY',
    'IAF ACCREDITED',
  ], [40, 80, 140]);

  save(doc, outPath);
}

function panCard({ pan, name, dateOfIncorporation, fatherOrFirm }, outPath) {
  const doc = newDoc();
  const margin = 48;
  const w = pageW(doc);

  // Render an 85x55mm-ish card centered on A4
  const cardW = 360;
  const cardH = 230;
  const cx = (w - cardW) / 2;
  const cy = 80;

  // background
  doc.setFillColor(248, 245, 230);
  doc.roundedRect(cx, cy, cardW, cardH, 10, 10, 'F');
  doc.setDrawColor(190, 165, 100);
  doc.setLineWidth(1.2);
  doc.roundedRect(cx, cy, cardW, cardH, 10, 10, 'S');

  // header
  doc.setFillColor(20, 30, 60);
  doc.rect(cx, cy, cardW, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('INCOME TAX DEPARTMENT', cx + 12, cy + 12);
  doc.text('GOVT. OF INDIA', cx + 12, cy + 22);
  doc.setFontSize(7);
  doc.text('★', cx + cardW - 14, cy + 18, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  // Title
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(50, 50, 50);
  doc.text('Permanent Account Number Card', cx + cardW / 2, cy + 44, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  // PAN
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(pan, cx + 18, cy + 78);

  // Name
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text('Name', cx + 18, cy + 100);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(name, cx + 18, cy + 116);

  // Father / Firm
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text("Father's Name / Firm Type", cx + 18, cy + 138);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text(fatherOrFirm, cx + 18, cy + 152);

  // DOB
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text('Date of Incorporation / Birth', cx + 18, cy + 174);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(dateOfIncorporation, cx + 18, cy + 190);

  // Photo placeholder + signature
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.rect(cx + cardW - 110, cy + 60, 90, 110);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text('[ Photograph ]', cx + cardW - 65, cy + 118, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);

  hairline(doc, cx + cardW - 110, cy + 200, cx + cardW - 20, cy + 200);
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  doc.text('Signature', cx + cardW - 65, cy + 212, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  // Footer note
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(
    'In case this card is lost / found kindly inform / return to Income Tax PAN Services Unit, NSDL e-Gov.',
    w / 2,
    cy + cardH + 36,
    { align: 'center' },
  );
  doc.text('Verifiable at https://eportal.incometax.gov.in', w / 2, cy + cardH + 50, {
    align: 'center',
  });

  save(doc, outPath);
}

function projectsList({ company, projects }, outPath) {
  const doc = newDoc();
  const margin = 48;
  const w = pageW(doc);

  // Letterhead
  doc.setFillColor(20, 30, 60);
  doc.rect(0, 0, w, 60, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(company.toUpperCase(), margin, 32);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Annexure to Technical Bid — List of Similar Completed Projects', margin, 46);
  doc.setTextColor(0, 0, 0);

  let y = 90;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('LIST OF SIMILAR COMPLETED PROJECTS (Last 7 years)', w / 2, y, {
    align: 'center',
  });
  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('In compliance with Eligibility Criterion C-4 of NIT CRPF/CIV/2026/04/BOP-117', w / 2, y, {
    align: 'center',
  });
  y += 24;

  y = table(
    doc,
    margin,
    y,
    [
      { key: 'sn', label: 'Sl', w: 26 },
      { key: 'name', label: 'Name of Work', w: 200 },
      { key: 'value', label: 'Value (Rs.)', w: 80 },
      { key: 'client', label: 'Client', w: 110 },
      { key: 'completed', label: 'Completed On', w: 80 },
    ],
    projects.map((p, i) => ({
      sn: i + 1,
      name: p.name,
      value: inrFmt(p.value),
      client: p.client,
      completed: p.completed,
    })),
    { rowH: 26 },
  );

  y += 20;
  doc.setFontSize(9);
  doc.text(
    'I / We hereby certify that the above list is true to the best of our knowledge and belief. Completion certificates issued by the respective client departments are enclosed as Annexures A to ' +
      String.fromCharCode(64 + projects.length) +
      '.',
    margin,
    y,
    { maxWidth: w - margin * 2 },
  );

  y += 60;
  signatureBlock(doc, margin, y, {
    name: 'Authorised Signatory',
    designation: 'For ' + company,
    line1: 'Place: New Delhi',
    line2: `Date: ${BID_DATE}`,
  });
  rectSeal(doc, w - margin - 120, y - 4, 120, 60, [
    company.toUpperCase(),
    'AUTHORISED SIGNATORY',
    'COMPANY SEAL',
  ]);

  save(doc, outPath);
}

function bankGuarantee({ company, bgNo, bankName, branch, amount, issueDate, validity, mode = 'Bank Guarantee' }, outPath) {
  const doc = newDoc();
  const margin = 48;
  const w = pageW(doc);

  // Bank header
  doc.setFillColor(8, 60, 120);
  doc.rect(0, 0, w, 60, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(bankName.toUpperCase(), margin, 36);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`${branch} Branch   |   IFSC: ${bankName.slice(0, 4).toUpperCase()}0001234`, margin, 50);
  doc.setTextColor(0, 0, 0);

  let y = 92;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(`EARNEST MONEY DEPOSIT — ${mode.toUpperCase()}`, w / 2, y, {
    align: 'center',
  });
  y += 24;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  fieldRow(doc, margin, y, mode + ' No.', bgNo, { valueBold: true });
  y += 16;
  fieldRow(doc, margin, y, 'Issue Date:', issueDate);
  y += 16;
  fieldRow(doc, margin, y, 'Validity:', validity + ' from issue');
  y += 16;
  fieldRow(doc, margin, y, 'Amount:', `Rs. ${inrFmt(amount)}/- (${inrInWords(amount)})`, {
    valueBold: true,
  });
  y += 24;

  fieldRow(doc, margin, y, 'On Behalf of:', company, { valueBold: true });
  y += 16;
  fieldRow(doc, margin, y, 'Beneficiary:', 'DDO, Directorate General CRPF, New Delhi');
  y += 16;
  fieldRow(doc, margin, y, 'Tender Ref:', 'CRPF/CIV/2026/04/BOP-117');
  y += 24;

  y = paragraph(
    doc,
    margin,
    y,
    `In consideration of the President of India (Beneficiary) inviting the captioned tender, ${bankName}, ${branch} Branch hereby unconditionally and irrevocably guarantees payment of the above sum on first written demand, without protest or demur, towards the said Earnest Money Deposit. This guarantee shall remain in force as stipulated above and shall be invocable in accordance with the terms of the NIT.`,
    { lineHeight: 13, fontSize: 9 },
  );

  y += 24;
  signatureBlock(doc, margin, y, {
    name: 'For ' + bankName,
    designation: 'Branch Manager / Authorised Signatory',
    line1: 'Power of Attorney No. PoA/2024/' + Math.floor(Math.random() * 9999),
  });
  rectSeal(doc, w - margin - 130, y - 6, 130, 60, [
    bankName.toUpperCase(),
    branch.toUpperCase(),
    'AUTHORISED SIGNATORY',
  ], [8, 60, 120]);

  save(doc, outPath);
}

function bidderDir(slug) {
  const d = join(OUT, 'bidders', slug);
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  return d;
}

// ============================================================================
// Bidder data (tuned to produce specific verdicts)
// ============================================================================

const bidders = [
  // ---- B1: Sharma Construction (eligible) ----
  {
    slug: 'bidder-01-sharma-construction',
    company: 'Sharma Construction Pvt Ltd',
    address: 'Plot 22, Industrial Area Phase II, New Delhi - 110020',
    pan: 'AABCS1234A',
    gstin: '07AABCS1234A1Z5',
    legalName: 'Sharma Construction Private Limited',
    dateOfRegistration: '01-07-2017',
    gstStatus: 'ACTIVE — verified on 10-04-2026',
    incDate: '15-03-2010',
    ceo: { name: 'Rajesh Sharma', designation: 'Managing Director' },
    coverBody: [
      'We are pleased to submit our technical and financial bid for the Construction of Border Outpost Building at Sector-14 in response to your NIT dated 25-03-2026.',
      'Sharma Construction Pvt Ltd was incorporated on 15th March 2010 (16 years in operation) and has executed 47 government and PSU civil construction projects to date, including projects for ITBP, BSF, CISF and CRPF. Our average annual turnover for the last three years stands at over Rs. 12 Crore.',
      'We confirm full compliance with all eligibility criteria including ISO 9001:2015 (Bureau Veritas), ISO 14001:2015 (Environmental Management) and prior paramilitary construction history (CISF Office Complex Jaipur, BSF Family Quarters Jaisalmer, CRPF Mess Hall Hazaribagh).',
      'EMD of Rs. 16,00,000/- (Rupees Sixteen Lakh Only) is enclosed via HDFC Bank Guarantee BG/2026/04/0119 dated 05-04-2026. All supporting documents are attached as Annexures 1 to 7.',
      'We undertake to honour the bid for 120 days from the date of opening of technical bid and to execute the work within the stipulated period of 18 months if awarded.',
    ],
    ca: {
      caFirm: 'Mehra & Associates',
      caName: 'CA Anand Mehra',
      caRegNo: '087451N',
      udin: '24087451EBKABC1234',
      turnovers: [
        { fy: 'FY 2024-25', amount: 152000000 },
        { fy: 'FY 2023-24', amount: 124000000 },
        { fy: 'FY 2022-23', amount: 98000000 },
      ],
      place: 'New Delhi',
      date: '20-03-2026',
    },
    solvency: {
      bankName: 'State Bank of India',
      branch: 'Connaught Place',
      address: '11, Sansad Marg, New Delhi - 110001',
      accountNo: 'XXXX XXXX 1234',
      amount: 30000000,
      date: '10-02-2026',
      refNo: 'SBI/CP/SOL/2026/0277',
    },
    iso9001: {
      certifyingBody: 'Bureau Veritas Certification India Pvt Ltd',
      certNo: 'BV-IN-2023-9001-77821',
      scope:
        'Design, Construction and Project Management of Civil and Institutional Buildings, Barracks and Office Complexes for Government and Public Sector Clients.',
      issueDate: '12-08-2025',
      expiryDate: '11-08-2028',
      originalDate: '12-08-2017',
    },
    iso14001: {
      certifyingBody: 'Bureau Veritas Certification India Pvt Ltd',
      certNo: 'BV-IN-2024-14001-44120',
      scope: 'Environmental Management System for civil construction operations.',
      issueDate: '01-05-2024',
      expiryDate: '30-04-2027',
      originalDate: '01-05-2021',
      standard: 'ISO 14001:2015',
    },
    projects: [
      {
        name: 'ITBP Barrack Building, Leh (Phase 2)',
        value: 48000000,
        client: 'ITBP, MHA',
        completed: '01-03-2024',
      },
      {
        name: 'CISF Office Complex, Jaipur',
        value: 62000000,
        client: 'CISF Headquarters',
        completed: '15-09-2023',
      },
      {
        name: 'BSF Family Quarters, Jaisalmer',
        value: 39000000,
        client: 'BSF Headquarters',
        completed: '30-11-2022',
      },
      {
        name: 'Police Training Institute, Bhopal',
        value: 75000000,
        client: 'MP Police Housing Corp',
        completed: '20-06-2021',
      },
      {
        name: 'CRPF Mess Hall, Hazaribagh',
        value: 28000000,
        client: 'CRPF',
        completed: '10-04-2020',
      },
    ],
    bg: {
      bankName: 'HDFC Bank',
      branch: 'Connaught Place',
      bgNo: 'HDFC/BG/2026/04/0119',
      amount: 1600000,
      issueDate: '05-04-2026',
      validity: '180 days',
    },
  },

  // ---- B2: Gupta Builders (not_eligible — turnover & solvency below) ----
  {
    slug: 'bidder-02-gupta-builders',
    company: 'Gupta Builders',
    address: '14/B, Karol Bagh, New Delhi - 110005',
    pan: 'AAFFG7654B',
    gstin: '07AAFFG7654B1ZK',
    legalName: 'Gupta Builders (Sole Proprietorship)',
    dateOfRegistration: '12-09-2017',
    gstStatus: 'ACTIVE',
    incDate: '01-08-2017',
    ceo: { name: 'Anil Gupta', designation: 'Proprietor' },
    coverBody: [
      'We submit our bid for the Construction of Border Outpost Building under tender CRPF/CIV/2026/04/BOP-117.',
      'Gupta Builders has been operating since August 2017 (8 years) with focus on residential and small institutional construction in Delhi-NCR. We have completed 11 projects in the last three years.',
      'EMD of Rs. 16,00,000/- is enclosed via PNB Bank Guarantee.',
    ],
    ca: {
      caFirm: 'Bhardwaj & Co.',
      caName: 'CA Sandeep Bhardwaj',
      caRegNo: '102233N',
      udin: '24102233EFKABC9988',
      turnovers: [
        { fy: 'FY 2024-25', amount: 34000000 },
        { fy: 'FY 2023-24', amount: 31000000 },
        { fy: 'FY 2022-23', amount: 28000000 },
      ],
      place: 'New Delhi',
      date: '15-03-2026',
    },
    solvency: {
      bankName: 'Punjab National Bank',
      branch: 'Karol Bagh',
      address: '7, Pusa Road, Karol Bagh, New Delhi - 110005',
      accountNo: 'XXXX XXXX 5678',
      amount: 15000000,
      date: '22-02-2026',
      refNo: 'PNB/KB/SOL/2026/0192',
    },
    iso9001: {
      certifyingBody: 'TUV India Pvt Ltd',
      certNo: 'TUV-IN-2024-90001-66312',
      scope: 'Construction of residential and small institutional buildings.',
      issueDate: '01-05-2024',
      expiryDate: '30-04-2027',
      originalDate: '01-05-2018',
    },
    projects: [
      { name: 'Residential Apartment Block, Faridabad', value: 24000000, client: 'Pvt. Developer', completed: '12-09-2023' },
      { name: 'Govt PHC Building, Rohtak', value: 21000000, client: 'Haryana Govt', completed: '20-06-2022' },
      { name: 'Municipal School Block, Karnal', value: 26000000, client: 'KMC', completed: '15-04-2021' },
      { name: 'Community Hall, Sonipat', value: 21500000, client: 'Sonipat MC', completed: '08-12-2020' },
    ],
    bg: {
      bankName: 'Punjab National Bank',
      branch: 'Karol Bagh',
      bgNo: 'PNB/BG/2026/0455',
      amount: 1600000,
      issueDate: '08-04-2026',
      validity: '180 days',
    },
  },

  // ---- B3: National Infrastructure Corp (needs_review) ----
  {
    slug: 'bidder-03-national-infrastructure-corp',
    company: 'National Infrastructure Corp',
    address: 'Plot 8, Sector 62, Noida, UP - 201309',
    pan: 'AAACN9876C',
    gstin: '09AAACN9876C1Z2',
    legalName: 'National Infrastructure Corporation Limited',
    dateOfRegistration: '20-11-2019',
    gstStatus: 'ACTIVE (verification partial — see note)',
    incDate: '20-11-2019',
    ceo: { name: 'Dr. Manoj Tripathi', designation: 'Chief Executive Officer' },
    coverBody: [
      'We hereby submit our bid for the captioned work. Documents are enclosed; please refer to original copies on file with the issuing authorities for final confirmation. Some annexures have been re-printed from older scans.',
      'National Infrastructure Corp was incorporated in November 2019 (about 6 years and 5 months as on the bid date) and has handled three major construction projects to date.',
      'Note: ISO 9001:2015 renewal is in process; the current certificate expires on the bid submission date itself. We have applied for re-certification with the same certifying body.',
      'Final FY 2024-25 audit is underway and turnover figures are provisional pending audit.',
    ],
    ca: {
      caFirm: 'Tripathi Sharma & Co.',
      caName: 'CA Vikas Tripathi',
      caRegNo: '067112N',
      udin: '24067112EHKPRO5511',
      turnovers: [
        { fy: 'FY 2024-25 (Provisional)', amount: 72000000 },
        { fy: 'FY 2023-24', amount: 49000000 },
        { fy: 'FY 2022-23', amount: 41000000 },
      ],
      place: 'Noida',
      date: '12-03-2026',
    },
    solvency: {
      bankName: 'Bank of Baroda',
      branch: 'Sector 18, Noida',
      address: 'A-12, Sector 18, Noida - 201301',
      accountNo: 'XXXX XXXX 9012',
      amount: 25000000,
      date: '30-12-2025',
      refNo: 'BOB/SEC18/SOL/2025/0411',
    },
    iso9001: {
      certifyingBody: 'TUV SUD South Asia',
      certNo: 'TUV-SUD-2023-9001-31144',
      scope: 'Civil construction and infrastructure works.',
      issueDate: '15-04-2023',
      expiryDate: BID_DATE,
      originalDate: '15-04-2020',
      note:
        'NOTE: This certificate expires on the date of bid submission itself. Renewal application has been filed.',
    },
    projects: [
      { name: 'Govt Office Block, Lucknow', value: 23000000, client: 'UP Govt', completed: '01-02-2024' },
      { name: 'Boys Hostel Block, Varanasi', value: 21000000, client: 'BHU Engg', completed: '15-08-2022' },
      {
        name: 'PWD Rest House, Allahabad',
        value: 24000000,
        client: 'UP PWD',
        completed: '30-09-2018',
      },
    ],
    bg: {
      bankName: 'Bank of Baroda',
      branch: 'Sector 18, Noida',
      bgNo: 'BOB/DD/2026/04/0231',
      amount: 1600000,
      issueDate: '09-04-2026',
      validity: '180 days',
      mode: 'Demand Draft',
    },
  },

  // ---- B4: Apex Constructions (eligible) ----
  {
    slug: 'bidder-04-apex-constructions',
    company: 'Apex Constructions Ltd',
    address: 'Apex Tower, Andheri West, Mumbai - 400053',
    pan: 'AAACA5566D',
    gstin: '27AAACA5566D1Z9',
    legalName: 'Apex Constructions Limited',
    dateOfRegistration: '01-07-2017',
    gstStatus: 'ACTIVE',
    incDate: '25-08-2010',
    ceo: { name: 'Vikram Mehta', designation: 'Chief Executive Officer' },
    coverBody: [
      'Apex Constructions Ltd, established in August 2010 (15 years in operation), submits this bid in response to Tender CRPF/CIV/2026/04/BOP-117.',
      'We confirm compliance with all stipulated criteria. Apex has completed seven (7) similar institutional and paramilitary construction projects in the last seven years, including for IAF, Indian Navy, CISF, BSF, SSB, Coast Guard and CRPF.',
      'Our audited turnover for FY 2024-25 stood at Rs. 18 Crore. ISO 9001:2015 (DNV-GL India) and Solvency Certificate (ICICI Bank, Mumbai Main) for Rs. 4 Crore are enclosed.',
      'We submit our authorised undertaking to abide by the bid validity of 120 days and complete the work within 18 months if awarded.',
    ],
    ca: {
      caFirm: 'Khanna & Khanna',
      caName: 'CA Priya Khanna',
      caRegNo: '045129W',
      udin: '24045129KHWPRY8821',
      turnovers: [
        { fy: 'FY 2024-25', amount: 180000000 },
        { fy: 'FY 2023-24', amount: 143000000 },
        { fy: 'FY 2022-23', amount: 118000000 },
      ],
      place: 'Mumbai',
      date: '22-03-2026',
    },
    solvency: {
      bankName: 'ICICI Bank',
      branch: 'Mumbai Main',
      address: 'ICICI Bank Towers, BKC, Mumbai - 400051',
      accountNo: 'XXXX XXXX 4455',
      amount: 40000000,
      date: '15-02-2026',
      refNo: 'ICICI/BKC/SOL/2026/0712',
    },
    iso9001: {
      certifyingBody: 'DNV-GL India',
      certNo: 'DNV-9001-2024-02112',
      scope: 'Civil construction, institutional buildings, defence infrastructure.',
      issueDate: '01-06-2024',
      expiryDate: '31-05-2027',
      originalDate: '15-06-2015',
    },
    projects: [
      { name: 'IAF Station HQ, Pune', value: 89000000, client: 'Indian Air Force', completed: '20-09-2024' },
      { name: 'Naval Officers Mess, Visakhapatnam', value: 64000000, client: 'Indian Navy', completed: '10-05-2023' },
      { name: 'CRPF Group Centre, Avadi', value: 92000000, client: 'CRPF', completed: '30-11-2022' },
      { name: 'CISF HQ Annexe, Gurugram', value: 58000000, client: 'CISF', completed: '15-07-2021' },
      { name: 'BSF Hospital Block, Tekanpur', value: 71000000, client: 'BSF Academy', completed: '20-12-2020' },
      { name: 'SSB Training Centre, Salonibari', value: 45000000, client: 'SSB', completed: '05-10-2019' },
      { name: 'Coast Guard Quarters, Porbandar', value: 37000000, client: 'Indian Coast Guard', completed: '12-08-2018' },
    ],
    bg: {
      bankName: 'ICICI Bank',
      branch: 'Mumbai Main',
      bgNo: 'ICICI/BG/2026/04/0341',
      amount: 1600000,
      issueDate: '04-04-2026',
      validity: '180 days',
    },
  },

  // ---- B5: Metro Build Solutions (not_eligible — ISO expired) ----
  {
    slug: 'bidder-05-metro-build-solutions',
    company: 'Metro Build Solutions',
    address: '4, Trade Centre, Civil Lines, Nagpur - 440001',
    pan: 'AAACM3344E',
    gstin: '27AAACM3344E1Z3',
    legalName: 'Metro Build Solutions Private Limited',
    dateOfRegistration: '12-04-2018',
    gstStatus: 'ACTIVE',
    incDate: '12-04-2018',
    ceo: { name: 'Sandeep Joshi', designation: 'Director' },
    coverBody: [
      'Metro Build Solutions submits this bid for CRPF/CIV/2026/04/BOP-117.',
      'We have been operational since April 2018 (7 years) and primarily execute civil work for state PWDs and PSUs across Maharashtra and Madhya Pradesh.',
      'Note on ISO 9001: Our existing ISO 9001:2015 certificate (issued by Intertek) expired on 30 June 2025. A renewal application has been submitted but the new certificate is not yet issued. We respectfully request the tender authority to consider this as compliant pending the active renewal process.',
    ],
    ca: {
      caFirm: 'Iyer & Co.',
      caName: 'CA Ramesh Iyer',
      caRegNo: '091122M',
      udin: '24091122IYRMRC4400',
      turnovers: [
        { fy: 'FY 2024-25', amount: 62000000 },
        { fy: 'FY 2023-24', amount: 54000000 },
        { fy: 'FY 2022-23', amount: 48000000 },
      ],
      place: 'Nagpur',
      date: '18-03-2026',
    },
    solvency: {
      bankName: 'Axis Bank',
      branch: 'Civil Lines, Nagpur',
      address: 'Trade Centre, Civil Lines, Nagpur - 440001',
      accountNo: 'XXXX XXXX 7788',
      amount: 20000000,
      date: '25-02-2026',
      refNo: 'AXIS/CL-NGP/SOL/2026/0188',
    },
    iso9001: {
      certifyingBody: 'Intertek Certification India',
      certNo: 'INT-9001-2022-09887',
      scope: 'Civil and structural works for institutional and government clients.',
      issueDate: '01-07-2022',
      expiryDate: '30-06-2025',
      originalDate: '01-07-2019',
      note:
        'NOTE: This certificate has LAPSED. Renewal application filed but not yet completed at the time of bid submission.',
    },
    projects: [
      { name: 'State PWD Office, Nagpur', value: 23000000, client: 'Maharashtra PWD', completed: '15-06-2024' },
      { name: 'Govt Polytechnic Workshop Block, Nashik', value: 29000000, client: 'DTE Maharashtra', completed: '20-03-2023' },
      { name: 'Bus Depot Building, Aurangabad', value: 21500000, client: 'Maharashtra State Transport', completed: '10-11-2022' },
    ],
    bg: {
      bankName: 'Axis Bank',
      branch: 'Civil Lines, Nagpur',
      bgNo: 'AXIS/DD/2026/04/0099',
      amount: 1600000,
      issueDate: '08-04-2026',
      validity: '180 days',
      mode: 'Demand Draft',
    },
  },
];

// ============================================================================
// Run
// ============================================================================

console.log('Generating tender PDF…');
generateTender();

for (const b of bidders) {
  const dir = bidderDir(b.slug);
  console.log(`\nGenerating ${b.company} (${b.slug})…`);
  coverLetter(
    {
      company: b.company,
      address: b.address,
      ceoName: b.ceo.name,
      ceoDesignation: b.ceo.designation,
      since: b.incDate.split('-')[2],
      body: b.coverBody,
    },
    join(dir, '01-cover-letter.pdf'),
  );
  caCertificate(
    {
      company: b.company,
      pan: b.pan,
      caFirm: b.ca.caFirm,
      caName: b.ca.caName,
      caRegNo: b.ca.caRegNo,
      udin: b.ca.udin,
      turnovers: b.ca.turnovers,
      place: b.ca.place,
      date: b.ca.date,
    },
    join(dir, '02-ca-turnover-certificate.pdf'),
  );
  solvencyCertificate(
    {
      company: b.company,
      ...b.solvency,
    },
    join(dir, '03-solvency-certificate.pdf'),
  );
  gstCertificate(
    {
      company: b.company,
      gstin: b.gstin,
      legalName: b.legalName,
      dateOfRegistration: b.dateOfRegistration,
      address: b.address,
      status: b.gstStatus,
    },
    join(dir, '04-gst-registration-certificate.pdf'),
  );
  isoCertificate({ company: b.company, ...b.iso9001 }, join(dir, '05-iso-9001-certificate.pdf'));
  if (b.iso14001) {
    isoCertificate(
      { company: b.company, ...b.iso14001 },
      join(dir, '05b-iso-14001-certificate.pdf'),
    );
  }
  panCard(
    {
      pan: b.pan,
      name: b.legalName.toUpperCase(),
      dateOfIncorporation: b.incDate,
      fatherOrFirm: b.legalName.includes('Private Limited') || b.legalName.includes('Limited')
        ? 'Private Limited Company'
        : 'Sole Proprietorship',
    },
    join(dir, '06-pan-card.pdf'),
  );
  projectsList({ company: b.company, projects: b.projects }, join(dir, '07-projects-list.pdf'));
  bankGuarantee({ company: b.company, ...b.bg }, join(dir, '08-emd-bank-guarantee.pdf'));
}

console.log('\nDone. Sample data written to', OUT);
