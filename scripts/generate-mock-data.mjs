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
    22000000: 'Two Crore Twenty Lakh',
    47000000: 'Forty Seven Lakh',
    51000000: 'Fifty One Lakh',
    56000000: 'Fifty Six Lakh',
    64000000: 'Sixty Four Lakh',
    68000000: 'Sixty Eight Lakh',
    78000000: 'Seventy Eight Lakh',
    92000000: 'Ninety Two Lakh',
    112000000: 'One Crore Twelve Lakh',
    120000000: 'Twelve Crore',
    220000000: 'Twenty Two Crore',
    2400000: 'Twenty Four Lakh',
    250000000: 'Twenty Five Crore',
    270000000: 'Twenty Seven Crore',
    280000000: 'Twenty Eight Crore',
    320000000: 'Thirty Two Crore',
    380000000: 'Thirty Eight Crore',
    35000000: 'Three Crore Fifty Lakh',
    55000000: 'Five Crore Fifty Lakh',
    60000000: 'Six Crore',
    70000000: 'Seven Crore',
    5000000: 'Fifty Lakh',
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
// HEALTHCARE TENDER (AIIMS — ventilator procurement)
// ============================================================================
// Document types unique to medical-device procurement:
//   - CDSCO Manufacturing License (Form MD-9 issued by Drug Controller General)
//   - ISO 13485:2016 (Medical Devices QMS — reused via isoCertificate)
//   - IEC 60601-1 compliance (medical electrical safety — reused via isoCertificate)
//   - PAN-India service-network statement
// Reused: cover letter, CA turnover, GST cert, PAN card, supply list, bank guarantee.

function cdscoLicense({ company, licenseNo, issueDate, expiryDate, devices, manufacturingSite }, outPath) {
  const doc = newDoc();
  const margin = 48;
  const w = pageW(doc);

  // Tricolour header band (Govt of India aesthetic)
  doc.setFillColor(255, 153, 51);
  doc.rect(0, 0, w, 12, 'F');
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 12, w, 12, 'F');
  doc.setFillColor(19, 136, 8);
  doc.rect(0, 24, w, 12, 'F');

  let y = 60;
  ashokSeal(doc, w / 2, y, 'CDSCO');
  y += 56;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('GOVERNMENT OF INDIA', w / 2, y, { align: 'center' });
  y += 14;
  doc.text('MINISTRY OF HEALTH AND FAMILY WELFARE', w / 2, y, { align: 'center' });
  y += 14;
  doc.setFontSize(13);
  doc.text('CENTRAL DRUGS STANDARD CONTROL ORGANISATION', w / 2, y, { align: 'center' });
  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Office of the Drugs Controller General (India), FDA Bhawan, New Delhi - 110002', w / 2, y, { align: 'center' });
  y += 18;
  drawDoubleRule(doc, y, margin);
  y += 22;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('LICENCE TO MANUFACTURE FOR SALE OR FOR DISTRIBUTION OF', w / 2, y, { align: 'center' });
  y += 14;
  doc.text('NOTIFIED MEDICAL DEVICES', w / 2, y, { align: 'center' });
  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('[Form MD-9 — Medical Devices Rules, 2017]', w / 2, y, { align: 'center' });
  y += 22;

  doc.setFontSize(10);
  fieldRow(doc, margin, y, 'License Number:', licenseNo, { valueBold: true });
  y += 18;
  fieldRow(doc, margin, y, 'Date of Issue:', issueDate);
  y += 18;
  fieldRow(doc, margin, y, 'Date of Expiry:', expiryDate);
  y += 18;
  fieldRow(doc, margin, y, 'Manufacturer:', company, { valueBold: true });
  y += 18;
  fieldRow(doc, margin, y, 'Manufacturing Site:', manufacturingSite);
  y += 18;
  fieldRow(doc, margin, y, 'Device Class:', 'Class C (Moderate-High Risk)');
  y += 18;
  fieldRow(doc, margin, y, 'Risk Classification:', 'Per Medical Device Rules, 2017');
  y += 26;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Authorised Devices', margin, y);
  y += 6;
  hairline(doc, margin, y, w - margin, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  for (const dev of devices) {
    doc.text(`• ${dev}`, margin + 12, y);
    y += 13;
  }
  y += 16;

  y = paragraph(
    doc,
    margin,
    y,
    'The applicant is licensed to manufacture for sale or distribution of the medical devices specified above, subject to compliance with the Medical Devices Rules, 2017, and conditions of the licence. This licence shall remain valid until the date of expiry shown above unless suspended or cancelled.',
    { fontSize: 9, lineHeight: 13 },
  );

  y += 28;
  signatureBlock(doc, margin, y, {
    name: '(Dr. Rajeev Singh Raghuvanshi)',
    designation: 'Drugs Controller General (India)',
    line1: 'Central Licensing Authority',
    line2: 'Ministry of Health & Family Welfare',
  });

  rectSeal(doc, w - margin - 130, y - 16, 130, 70, [
    'CENTRAL DRUGS STANDARD',
    'CONTROL ORGANISATION',
    'CENTRAL LICENSING',
    'AUTHORITY',
    `${licenseNo}`,
  ]);

  // Footer — verifiable line
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text('Verifiable at https://cdscomdonline.gov.in', w / 2, pageH(doc) - 50, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  save(doc, outPath);
}

function serviceNetworkStatement({ company, address, cities, ceoName }, outPath) {
  const doc = newDoc();
  const margin = 48;
  const w = pageW(doc);

  // Company letterhead band (medical blue)
  doc.setFillColor(0, 95, 134);
  doc.rect(0, 0, w, 56, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(company.toUpperCase(), margin, 32);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(address, margin, 46);
  doc.setTextColor(0, 0, 0);

  let y = 90;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('PAN-INDIA SERVICE NETWORK STATEMENT', w / 2, y, { align: 'center' });
  y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    'Annexure to Technical Bid — In compliance with Eligibility Criterion C-9 (AIIMS Tender)',
    w / 2,
    y,
    { align: 'center' },
  );
  y += 24;

  y = paragraph(
    doc,
    margin,
    y,
    `${company} maintains the following service centres and authorised biomedical engineers across India for installation, training, preventive maintenance and after-sales support of medical equipment supplied:`,
    { fontSize: 10, lineHeight: 13 },
  );
  y += 14;

  y = table(
    doc,
    margin,
    y,
    [
      { key: 'sn', label: 'Sl', w: 26 },
      { key: 'city', label: 'City', w: 110 },
      { key: 'state', label: 'State', w: 110 },
      { key: 'engineers', label: 'Biomed Engineers', w: 100 },
      { key: 'response', label: 'Response SLA', w: 100 },
    ],
    cities.map((c, i) => ({
      sn: i + 1,
      city: c.city,
      state: c.state,
      engineers: String(c.engineers),
      response: c.response,
    })),
    { rowH: 18, headerBg: [220, 232, 240] },
  );
  y += 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Total cities covered: ${cities.length}`, margin, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    `Total biomedical engineers on payroll: ${cities.reduce((a, c) => a + c.engineers, 0)}`,
    margin,
    y,
  );
  y += 22;

  y = paragraph(
    doc,
    margin,
    y,
    'We undertake to provide on-site response within the Service Level Agreement (SLA) timelines specified above, 24×7 telephonic support, mandatory annual preventive maintenance, and emergency replacement of critical spares from our regional stocking depots.',
    { fontSize: 9, lineHeight: 13 },
  );

  y += 24;
  signatureBlock(doc, margin, y, {
    name: ceoName,
    designation: 'For ' + company,
    line1: 'Authorised Signatory',
    line2: `Date: ${BID_DATE}`,
  });
  rectSeal(doc, w - margin - 130, y - 16, 130, 64, [
    company.toUpperCase(),
    'AUTHORISED SIGNATORY',
    'COMPANY SEAL',
  ], [0, 95, 134]);

  save(doc, outPath);
}

function generateHealthcareTender() {
  const doc = newDoc();
  const margin = 48;
  const w = pageW(doc);

  // Letterhead — AIIMS
  ashokSeal(doc, w / 2, margin + 30, 'AIIMS');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  doc.text('GOVERNMENT OF INDIA', w / 2, margin + 78, { align: 'center' });
  doc.setFontSize(10);
  doc.text('MINISTRY OF HEALTH AND FAMILY WELFARE', w / 2, margin + 92, { align: 'center' });
  doc.setFontSize(13);
  doc.text('ALL INDIA INSTITUTE OF MEDICAL SCIENCES', w / 2, margin + 108, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Ansari Nagar, New Delhi - 110029', w / 2, margin + 122, { align: 'center' });
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(
    'Tel: 011-26588500   |   Fax: 011-26588641   |   www.aiims.edu   |   eprocure.gov.in',
    w / 2,
    margin + 134,
    { align: 'center' },
  );
  doc.setTextColor(0, 0, 0);

  drawDoubleRule(doc, margin + 146, margin);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('NOTICE INVITING TENDER (e-Procurement)', w / 2, margin + 172, { align: 'center' });
  doc.setFontSize(10);
  doc.text('[Stores Procurement, Department of Anaesthesiology and Critical Care]', w / 2, margin + 186, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('F.No. AIIMS/STORES/MED-EQ/2026/04-094', margin, margin + 212);
  doc.text('Dated: 01-04-2026', w - margin, margin + 212, { align: 'right' });

  let y = margin + 236;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(
    'Name of Work : Supply, Installation, Commissioning & Training for',
    margin,
    y,
  );
  y += 14;
  doc.text('50 (Fifty) Adult Mechanical Ventilators with 5-year CMC', margin, y);
  y += 14;
  doc.text('for the Trauma Centre and ICU, AIIMS New Delhi', margin, y);
  y += 22;

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
      { k: 'Tender Reference No.', v: 'AIIMS/MED-EQ/2026/VENT/094' },
      { k: 'Estimated Cost (incl. GST)', v: `${rs(120000000)} (Rupees Twelve Crore Only)` },
      { k: 'Earnest Money Deposit (EMD)', v: `${rs(2400000)} (Rupees Twenty Four Lakh Only)` },
      { k: 'Tender Fee (Non-refundable)', v: 'Rs. 10,000/-' },
      { k: 'Period of Supply & Installation', v: '120 days from date of award' },
      { k: 'Comprehensive Maintenance Contract', v: '5 years from acceptance' },
      { k: 'Pre-bid Meeting', v: '08-04-2026, 10:30 hrs IST, Stores AIIMS' },
      { k: 'Last Date for Bid Submission', v: `${BID_DATE}, 14:00 hrs IST` },
      { k: 'Date of Technical Bid Opening', v: '17-04-2026, 11:00 hrs IST' },
      { k: 'Bid Validity', v: '180 days from technical bid opening' },
    ],
    { headerBg: [232, 232, 224] },
  );

  y += 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('SECTION 4 — MINIMUM ELIGIBILITY CRITERIA', margin, y);
  y += 5;
  hairline(doc, margin, y, w - margin, y);
  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  y = paragraph(
    doc,
    margin,
    y,
    'The bidder must be the OEM (Original Equipment Manufacturer) or its authorised channel partner. All criteria are mandatory unless explicitly marked as preferred. AIIMS reserves the right to verify any document directly with the issuing authority.',
  );
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('4.1  Regulatory Compliance', margin, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  y = paragraph(
    doc,
    margin,
    y,
    'C-1.  The bidder SHALL hold a valid CDSCO Manufacturing License under the Medical Devices Rules, 2017 (Form MD-9 or MD-5) for "Mechanical Ventilator". Importer-only registrations (MD-15) are also acceptable provided OEM authorisation is enclosed.',
  );
  y += 4;
  y = paragraph(
    doc,
    margin,
    y,
    'C-2.  The bidder MUST hold a valid ISO 13485:2016 (Medical Devices Quality Management System) certificate from an IAF-accredited certifying body, valid as on the bid submission date.',
  );
  y += 4;
  y = paragraph(
    doc,
    margin,
    y,
    'C-3.  Compliance with IEC 60601-1 (General Requirements for Basic Safety) and IEC 60601-2-12 (Particular Requirements for Lung Ventilators) is mandatory. BIS / ETDC test reports from an NABL-accredited lab shall be enclosed.',
  );
  y += 8;

  if (y > pageH(doc) - 200) {
    doc.addPage();
    y = margin;
  }

  doc.setFont('helvetica', 'bold');
  doc.text('4.2  Experience and Past Supply', margin, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  y = paragraph(
    doc,
    margin,
    y,
    'C-4.  The bidder MUST have a minimum of five (5) years of experience in supply of Class C medical devices. Date of incorporation under Companies Act / firm registration shall be the reference.',
  );
  y += 4;
  y = paragraph(
    doc,
    margin,
    y,
    'C-5.  The bidder SHALL have successfully supplied at least three (3) similar mechanical ventilator orders in the last five (5) years, each of value not less than Rs. 50,00,000/- (Rupees Fifty Lakh) to Government / PSU / autonomous teaching hospitals. Completion or installation certificates are mandatory.',
  );
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.text('4.3  Financial Eligibility', margin, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  y = paragraph(
    doc,
    margin,
    y,
    'C-6.  The bidder SHALL have a minimum annual turnover of Rs. 10,00,00,000/- (Rupees Ten Crore Only) in any one of the last three financial years (FY 2022-23 / 2023-24 / 2024-25), certified by a practising Chartered Accountant with UDIN.',
  );
  y += 4;
  y = paragraph(
    doc,
    margin,
    y,
    'C-7.  The bidder SHALL maintain a positive net worth of at least Rs. 5,00,00,000/- (Rupees Five Crore Only) as on 31st March 2025, certified by a CA along with the latest audited balance sheet.',
  );
  y += 8;

  if (y > pageH(doc) - 200) {
    doc.addPage();
    y = margin;
  }

  doc.setFont('helvetica', 'bold');
  doc.text('4.4  Statutory Documentation', margin, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  y = paragraph(
    doc,
    margin,
    y,
    'C-8.  The bidder SHALL hold a valid Goods & Services Tax (GST) Registration that is active as on the bid submission date, verifiable on the GSTN portal.',
  );
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.text('4.5  After-Sales & Service Network', margin, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  y = paragraph(
    doc,
    margin,
    y,
    'C-9.  The bidder MUST have an authorised service network covering at least ten (10) cities across India, with on-site response time of not more than 24 hours for tier-1 cities (Delhi, Mumbai, Chennai, Kolkata, Bengaluru) and 48 hours elsewhere. A self-attested service network statement listing cities, biomedical engineers, and SLA shall be enclosed.',
  );
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.text('4.6  Preferred (Non-Mandatory) Criteria', margin, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  y = paragraph(
    doc,
    margin,
    y,
    'C-10. ISO 9001:2015 (Quality Management System) certification, in addition to ISO 13485:2016, is DESIRABLE and shall carry weightage in the technical evaluation.',
  );
  y += 4;
  y = paragraph(
    doc,
    margin,
    y,
    'C-11. The bidder is encouraged to declare local manufacturing under the "Make in India" / DPIIT-recognised local content scheme. Local Content (LC) percentage shall be self-certified per Public Procurement (Preference to Make in India) Order, 2017.',
  );

  if (y > pageH(doc) - 180) {
    doc.addPage();
    y = margin;
  } else {
    y += 24;
  }

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
    'AIIMS reserves the right to reject any or all bids without assigning any reason and to relax the criteria in the interest of public service in accordance with the General Financial Rules, 2017 and the Manual for Procurement of Goods, 2022. Conditional bids are liable to rejection.',
    { fontSize: 9, lineHeight: 12 },
  );

  y += 30;
  signatureBlock(doc, margin, y, {
    name: '(Dr. M. Srinivas)',
    designation: 'Director',
    line1: 'All India Institute of Medical Sciences, New Delhi',
    line2: 'For and on behalf of President of India',
  });
  rectSeal(doc, w - margin - 110, y - 10, 110, 56, [
    'OFFICE OF THE',
    'DIRECTOR',
    'AIIMS NEW DELHI',
    'STORES SECTION',
  ]);

  const pages = doc.internal.pages.length - 1;
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    watermark(doc, 'GOVT OF INDIA');
  }

  save(doc, join(OUT, 'healthcare-tender.pdf'));
}

// ----------------- Healthcare bidder data -----------------

function healthcareDir(slug) {
  const d = join(OUT, 'healthcare-bidders', slug);
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  return d;
}

const healthcareBidders = [
  // ---- HB-01: MediTech Systems (eligible) ----
  {
    slug: 'bidder-01-meditech-systems',
    company: 'MediTech Systems Pvt Ltd',
    address: 'Plot 17, Sector 4, IMT Manesar, Gurugram, Haryana - 122051',
    pan: 'AAACM4421T',
    gstin: '06AAACM4421T1Z9',
    legalName: 'MediTech Systems Private Limited',
    dateOfRegistration: '15-04-2014',
    gstStatus: 'ACTIVE — verified on 12-04-2026',
    incDate: '15-04-2014',
    ceo: { name: 'Dr. Sanjay Krishnan', designation: 'Managing Director' },
    coverBody: [
      'We are pleased to submit our technical and financial bid for the supply, installation and commissioning of 50 adult mechanical ventilators for AIIMS New Delhi (Tender Ref: AIIMS/MED-EQ/2026/VENT/094).',
      'MediTech Systems was incorporated in April 2014 and has, over the past 12 years, supplied medical equipment to over 240 government hospitals including AIIMS Bhubaneswar, AIIMS Patna, PGIMER Chandigarh, JIPMER Puducherry and several state-level government hospitals. Our flagship MTV-720 ventilator is BIS-certified, CE marked, and IEC 60601 compliant.',
      'We confirm full compliance with all eligibility criteria, including a valid CDSCO Manufacturing License (Form MD-9, MFG/MD/2024/0091) for Mechanical Ventilator (Class C), ISO 13485:2016 certification from TUV India, and a PAN-India service network covering 22 cities with 84 biomedical engineers on payroll.',
      'EMD of Rs. 24,00,000/- (Rupees Twenty Four Lakh Only) is enclosed via HDFC Bank Guarantee BG/2026/04/0871 dated 03-04-2026. All supporting documents are attached as Annexures 1 to 9.',
    ],
    ca: {
      caFirm: 'Krishnan Iyer & Co.',
      caName: 'CA Lakshmi Krishnan',
      caRegNo: '023411S',
      udin: '24023411LKHCMD2024',
      turnovers: [
        { fy: 'FY 2024-25', amount: 152000000 },
        { fy: 'FY 2023-24', amount: 124000000 },
        { fy: 'FY 2022-23', amount: 98000000 },
      ],
      place: 'Gurugram',
      date: '20-03-2026',
    },
    cdsco: {
      licenseNo: 'MFG/MD/2024/0091',
      issueDate: '15-06-2024',
      expiryDate: '14-06-2029',
      devices: [
        'Adult Mechanical Ventilator (Class C)',
        'Neonatal Mechanical Ventilator (Class C)',
        'Patient Monitor with ECG/SpO2/NIBP (Class B)',
      ],
      manufacturingSite: 'Plot 17, Sector 4, IMT Manesar, Gurugram, Haryana',
    },
    iso13485: {
      certifyingBody: 'TUV India Pvt Ltd',
      certNo: 'TUV-IN-2024-13485-22311',
      scope:
        'Design, development, manufacture, installation and servicing of mechanical ventilators, patient monitors and critical-care medical devices.',
      issueDate: '01-07-2024',
      expiryDate: '30-06-2027',
      originalDate: '01-07-2018',
      standard: 'ISO 13485:2016',
    },
    iec60601: {
      certifyingBody: 'Electronics Test & Development Centre (ETDC)',
      certNo: 'ETDC-IEC-60601-2024-1188',
      scope:
        'Compliance with IEC 60601-1 (General requirements for basic safety) and IEC 60601-2-12 (Particular requirements for lung ventilators) for the MTV-720 adult ventilator.',
      issueDate: '12-09-2024',
      expiryDate: '11-09-2027',
      originalDate: '12-09-2024',
      standard: 'IEC 60601-1 / 60601-2-12',
    },
    iso9001: {
      certifyingBody: 'TUV India Pvt Ltd',
      certNo: 'TUV-IN-2024-90001-44199',
      scope: 'Design, development, manufacture and servicing of medical devices.',
      issueDate: '01-07-2024',
      expiryDate: '30-06-2027',
      originalDate: '01-07-2014',
      standard: 'ISO 9001:2015',
    },
    serviceNetwork: {
      cities: [
        { city: 'New Delhi', state: 'Delhi', engineers: 14, response: '4 hr' },
        { city: 'Mumbai', state: 'Maharashtra', engineers: 9, response: '4 hr' },
        { city: 'Bengaluru', state: 'Karnataka', engineers: 7, response: '6 hr' },
        { city: 'Chennai', state: 'Tamil Nadu', engineers: 6, response: '6 hr' },
        { city: 'Kolkata', state: 'West Bengal', engineers: 5, response: '8 hr' },
        { city: 'Hyderabad', state: 'Telangana', engineers: 5, response: '8 hr' },
        { city: 'Pune', state: 'Maharashtra', engineers: 4, response: '8 hr' },
        { city: 'Ahmedabad', state: 'Gujarat', engineers: 4, response: '12 hr' },
        { city: 'Lucknow', state: 'Uttar Pradesh', engineers: 4, response: '12 hr' },
        { city: 'Patna', state: 'Bihar', engineers: 3, response: '24 hr' },
        { city: 'Bhubaneswar', state: 'Odisha', engineers: 3, response: '24 hr' },
        { city: 'Chandigarh', state: 'Chandigarh UT', engineers: 3, response: '12 hr' },
        { city: 'Jaipur', state: 'Rajasthan', engineers: 3, response: '12 hr' },
        { city: 'Guwahati', state: 'Assam', engineers: 3, response: '24 hr' },
        { city: 'Trivandrum', state: 'Kerala', engineers: 3, response: '24 hr' },
        { city: 'Dehradun', state: 'Uttarakhand', engineers: 2, response: '24 hr' },
        { city: 'Indore', state: 'Madhya Pradesh', engineers: 3, response: '24 hr' },
        { city: 'Raipur', state: 'Chhattisgarh', engineers: 2, response: '24 hr' },
        { city: 'Ranchi', state: 'Jharkhand', engineers: 2, response: '24 hr' },
        { city: 'Visakhapatnam', state: 'Andhra Pradesh', engineers: 2, response: '24 hr' },
        { city: 'Srinagar', state: 'J&K', engineers: 1, response: '48 hr' },
        { city: 'Imphal', state: 'Manipur', engineers: 1, response: '48 hr' },
      ],
    },
    projects: [
      { name: 'AIIMS Bhubaneswar — 25 Adult Ventilators', value: 6500000, client: 'AIIMS Bhubaneswar', completed: '15-09-2024' },
      { name: 'PGIMER Chandigarh — 18 ICU Ventilators', value: 5400000, client: 'PGIMER, Chandigarh', completed: '20-03-2024' },
      { name: 'JIPMER Puducherry — 30 Adult Ventilators', value: 7800000, client: 'JIPMER', completed: '12-11-2023' },
      { name: 'Tata Memorial Hospital — 12 Anaesthesia Ventilators', value: 4200000, client: 'TMH Mumbai', completed: '08-06-2023' },
      { name: 'AIIMS Patna — 20 Adult Ventilators', value: 5200000, client: 'AIIMS Patna', completed: '14-02-2022' },
    ],
    bg: {
      bankName: 'HDFC Bank',
      branch: 'IMT Manesar',
      bgNo: 'HDFC/BG/2026/04/0871',
      amount: 2400000,
      issueDate: '03-04-2026',
      validity: '210 days',
    },
  },

  // ---- HB-02: Lifeline Healthcare Solutions (not_eligible — no CDSCO license, only importer registration without OEM authorisation) ----
  {
    slug: 'bidder-02-lifeline-healthcare',
    company: 'Lifeline Healthcare Solutions',
    address: 'Building 4, Phase III, Okhla Industrial Area, New Delhi - 110020',
    pan: 'AAFFL5511P',
    gstin: '07AAFFL5511P1ZN',
    legalName: 'Lifeline Healthcare Solutions',
    dateOfRegistration: '20-06-2019',
    gstStatus: 'ACTIVE',
    incDate: '20-06-2019',
    ceo: { name: 'Mr. Pankaj Verma', designation: 'Proprietor' },
    coverBody: [
      'We submit our bid for the captioned tender. Lifeline Healthcare Solutions is an authorised distributor of imported medical equipment, established in June 2019 (~7 years).',
      'We are NOT a manufacturer; we operate as an authorised distributor. CDSCO Form MD-15 (Importer Registration) is enclosed. OEM authorisation letter is being sought from the manufacturer and shall be submitted as soon as available.',
      'EMD of Rs. 24,00,000/- is enclosed via Bank Guarantee.',
    ],
    ca: {
      caFirm: 'Sehgal Verma & Associates',
      caName: 'CA Ankit Sehgal',
      caRegNo: '116622N',
      udin: '24116622SVHTRN8800',
      turnovers: [
        { fy: 'FY 2024-25', amount: 72000000 },
        { fy: 'FY 2023-24', amount: 64000000 },
        { fy: 'FY 2022-23', amount: 51000000 },
      ],
      place: 'New Delhi',
      date: '18-03-2026',
    },
    cdsco: null, // KEY: no manufacturing license
    iso13485: {
      certifyingBody: 'Intertek Certification India',
      certNo: 'INT-13485-2024-09127',
      scope:
        'Distribution and after-sales service of imported medical devices.',
      issueDate: '01-08-2024',
      expiryDate: '31-07-2027',
      originalDate: '01-08-2021',
      standard: 'ISO 13485:2016',
    },
    iec60601: null, // KEY: no IEC compliance test report (relies on imported OEM compliance)
    serviceNetwork: {
      cities: [
        { city: 'New Delhi', state: 'Delhi', engineers: 5, response: '8 hr' },
        { city: 'Mumbai', state: 'Maharashtra', engineers: 3, response: '12 hr' },
        { city: 'Bengaluru', state: 'Karnataka', engineers: 2, response: '24 hr' },
        { city: 'Chennai', state: 'Tamil Nadu', engineers: 2, response: '24 hr' },
        { city: 'Hyderabad', state: 'Telangana', engineers: 2, response: '24 hr' },
        { city: 'Kolkata', state: 'West Bengal', engineers: 2, response: '48 hr' },
        { city: 'Ahmedabad', state: 'Gujarat', engineers: 2, response: '48 hr' },
      ],
    },
    projects: [
      { name: 'Govt Medical College Indore — 8 ventilators (imported)', value: 3200000, client: 'GMC Indore', completed: '12-01-2024' },
      { name: 'Safdarjung Hospital — 6 patient monitors', value: 1800000, client: 'Safdarjung Delhi', completed: '04-06-2023' },
      { name: 'ESIC Hospital Delhi — 10 syringe pumps', value: 950000, client: 'ESIC Delhi', completed: '20-09-2022' },
    ],
    bg: {
      bankName: 'Punjab National Bank',
      branch: 'Okhla',
      bgNo: 'PNB/BG/2026/04/2241',
      amount: 2400000,
      issueDate: '07-04-2026',
      validity: '210 days',
    },
  },

  // ---- HB-03: Pinnacle Medical Devices (needs_review — CDSCO renewal pending, FY audit incomplete) ----
  {
    slug: 'bidder-03-pinnacle-medical-devices',
    company: 'Pinnacle Medical Devices',
    address: '47, Electronic City Phase 2, Hosur Road, Bengaluru - 560100',
    pan: 'AAACP9982R',
    gstin: '29AAACP9982R1ZQ',
    legalName: 'Pinnacle Medical Devices Pvt Ltd',
    dateOfRegistration: '12-08-2018',
    gstStatus: 'ACTIVE',
    incDate: '12-08-2018',
    ceo: { name: 'Dr. Anita Rao', designation: 'CEO' },
    coverBody: [
      'We submit our bid for the AIIMS ventilator tender. Pinnacle Medical Devices is incorporated in August 2018 (~7 years 8 months).',
      'NOTE: Our CDSCO Manufacturing License (MFG/MD/2021/0334) was valid until 11-04-2026. Renewal application has been filed with CDSCO and the new license is expected within 30 days. The current license expired four (4) days before the bid submission date. We respectfully request consideration of this as substantive compliance pending renewal.',
      'NOTE: FY 2024-25 audit is in progress; turnover figure of Rs. 11.2 Cr is provisional pending audit. Audited financials shall be submitted to AIIMS within 30 days of bid opening.',
    ],
    ca: {
      caFirm: 'Rao Subramanian & Co.',
      caName: 'CA Vikram Subramanian',
      caRegNo: '042001S',
      udin: '24042001VSCPMD3344',
      turnovers: [
        { fy: 'FY 2024-25 (Provisional)', amount: 112000000 },
        { fy: 'FY 2023-24', amount: 92000000 },
        { fy: 'FY 2022-23', amount: 78000000 },
      ],
      place: 'Bengaluru',
      date: '15-03-2026',
    },
    cdsco: {
      licenseNo: 'MFG/MD/2021/0334',
      issueDate: '12-04-2021',
      expiryDate: '11-04-2026', // expired BEFORE bid date 15-04-2026
      devices: [
        'Adult Mechanical Ventilator (Class C)',
      ],
      manufacturingSite: '47, Electronic City Phase 2, Bengaluru, Karnataka',
      note: 'NOTE: This license expired on 11-04-2026, four days before the bid submission. Renewal application is in process.',
    },
    iso13485: {
      certifyingBody: 'DNV-GL India',
      certNo: 'DNV-13485-2023-09812',
      scope: 'Manufacture of mechanical ventilators and respiratory care devices.',
      issueDate: '20-08-2023',
      expiryDate: '19-08-2026',
      originalDate: '20-08-2020',
      standard: 'ISO 13485:2016',
    },
    iec60601: {
      certifyingBody: 'NABL-Accredited Lab — Underwriters Laboratories India',
      certNo: 'UL-IND-IEC-60601-2023-2298',
      scope: 'IEC 60601-1 and 60601-2-12 compliance for the PMD-V100 ventilator.',
      issueDate: '04-04-2023',
      expiryDate: '03-04-2026', // ALSO recently expired
      originalDate: '04-04-2023',
      standard: 'IEC 60601-1 / 60601-2-12',
      note:
        'NOTE: This compliance test report expired 12 days prior to bid submission. Re-testing has been booked at the same lab.',
    },
    serviceNetwork: {
      cities: [
        { city: 'Bengaluru', state: 'Karnataka', engineers: 8, response: '4 hr' },
        { city: 'Chennai', state: 'Tamil Nadu', engineers: 4, response: '8 hr' },
        { city: 'Hyderabad', state: 'Telangana', engineers: 4, response: '8 hr' },
        { city: 'Kochi', state: 'Kerala', engineers: 3, response: '12 hr' },
        { city: 'Mumbai', state: 'Maharashtra', engineers: 3, response: '12 hr' },
        { city: 'Pune', state: 'Maharashtra', engineers: 2, response: '24 hr' },
        { city: 'Coimbatore', state: 'Tamil Nadu', engineers: 2, response: '24 hr' },
        { city: 'Vijayawada', state: 'Andhra Pradesh', engineers: 2, response: '24 hr' },
        { city: 'Trivandrum', state: 'Kerala', engineers: 2, response: '24 hr' },
        { city: 'New Delhi', state: 'Delhi', engineers: 2, response: '24 hr' },
        { city: 'Ahmedabad', state: 'Gujarat', engineers: 2, response: '24 hr' },
      ],
    },
    projects: [
      { name: 'AIIMS Bhopal — 12 Adult Ventilators', value: 5800000, client: 'AIIMS Bhopal', completed: '15-11-2024' },
      { name: 'NIMHANS Bengaluru — 8 Adult Ventilators', value: 3400000, client: 'NIMHANS', completed: '08-04-2023' },
      { name: 'KMC Manipal — 6 Adult Ventilators', value: 2800000, client: 'KMC Manipal Hospital', completed: '20-09-2021' },
    ],
    bg: {
      bankName: 'Canara Bank',
      branch: 'Electronic City',
      bgNo: 'CAN/BG/2026/04/0671',
      amount: 2400000,
      issueDate: '08-04-2026',
      validity: '210 days',
    },
  },

  // ---- HB-04: Jeevan Bio-Medical (eligible) ----
  {
    slug: 'bidder-04-jeevan-bio-medical',
    company: 'Jeevan Bio-Medical Pvt Ltd',
    address: 'A-21 MIDC Andheri East, Mumbai - 400093',
    pan: 'AAACJ7711K',
    gstin: '27AAACJ7711K1ZP',
    legalName: 'Jeevan Bio-Medical Private Limited',
    dateOfRegistration: '08-11-2010',
    gstStatus: 'ACTIVE',
    incDate: '08-11-2010',
    ceo: { name: 'Mr. Rohan Joshi', designation: 'Chief Executive Officer' },
    coverBody: [
      'Jeevan Bio-Medical, established in November 2010 (15 years), submits this bid for the AIIMS ventilator tender. We are an OEM with manufacturing facilities in Mumbai and Hyderabad.',
      'Our flagship JBM-Vent-Pro ventilator is supplied to over 300 hospitals across India and exported to 12 countries. We hold valid CDSCO Form MD-9 manufacturing license, ISO 13485:2016, IEC 60601 compliance via NABL-accredited testing, and ISO 9001:2015.',
      'Our PAN-India service network covers 28 cities with 110+ certified biomedical engineers. Audited turnover for FY 2024-25 is Rs. 22 Crore. Net worth as on 31-03-2025 is Rs. 8.4 Crore.',
      'We are also a DPIIT-registered Class-I local supplier under Make in India with 78% local content for the JBM-Vent-Pro.',
    ],
    ca: {
      caFirm: 'Joshi Patel & Co.',
      caName: 'CA Hetal Patel',
      caRegNo: '098112W',
      udin: '24098112HPJBPV9911',
      turnovers: [
        { fy: 'FY 2024-25', amount: 220000000 },
        { fy: 'FY 2023-24', amount: 180000000 },
        { fy: 'FY 2022-23', amount: 143000000 },
      ],
      place: 'Mumbai',
      date: '22-03-2026',
    },
    cdsco: {
      licenseNo: 'MFG/MD/2023/0188',
      issueDate: '20-03-2023',
      expiryDate: '19-03-2028',
      devices: [
        'Adult Mechanical Ventilator (Class C)',
        'Anaesthesia Workstation (Class C)',
        'Defibrillator (Class C)',
        'Patient Monitor (Class B)',
        'Infant Incubator (Class B)',
      ],
      manufacturingSite: 'A-21 MIDC Andheri East, Mumbai (Plant 1) and Plot 88 IDA Hyderabad (Plant 2)',
    },
    iso13485: {
      certifyingBody: 'Bureau Veritas Certification India',
      certNo: 'BV-IN-2024-13485-66102',
      scope:
        'Design, development, manufacture, installation and servicing of mechanical ventilators, anaesthesia workstations, patient monitors and critical-care medical devices.',
      issueDate: '15-05-2024',
      expiryDate: '14-05-2027',
      originalDate: '15-05-2015',
      standard: 'ISO 13485:2016',
    },
    iec60601: {
      certifyingBody: 'STQC (Standardisation, Testing and Quality Certification) — NABL-accredited',
      certNo: 'STQC-IEC-60601-2024-3322',
      scope:
        'Compliance with IEC 60601-1 and IEC 60601-2-12 for the JBM-Vent-Pro adult ventilator.',
      issueDate: '20-08-2024',
      expiryDate: '19-08-2027',
      originalDate: '15-04-2018',
      standard: 'IEC 60601-1 / 60601-2-12',
    },
    iso9001: {
      certifyingBody: 'Bureau Veritas Certification India',
      certNo: 'BV-IN-2024-90001-66103',
      scope: 'Design, development, manufacture and servicing of medical devices.',
      issueDate: '15-05-2024',
      expiryDate: '14-05-2027',
      originalDate: '15-05-2010',
      standard: 'ISO 9001:2015',
    },
    serviceNetwork: {
      cities: [
        { city: 'Mumbai', state: 'Maharashtra', engineers: 18, response: '2 hr' },
        { city: 'New Delhi', state: 'Delhi', engineers: 12, response: '4 hr' },
        { city: 'Bengaluru', state: 'Karnataka', engineers: 10, response: '4 hr' },
        { city: 'Chennai', state: 'Tamil Nadu', engineers: 8, response: '4 hr' },
        { city: 'Kolkata', state: 'West Bengal', engineers: 7, response: '6 hr' },
        { city: 'Hyderabad', state: 'Telangana', engineers: 9, response: '4 hr' },
        { city: 'Pune', state: 'Maharashtra', engineers: 6, response: '6 hr' },
        { city: 'Ahmedabad', state: 'Gujarat', engineers: 5, response: '8 hr' },
        { city: 'Lucknow', state: 'Uttar Pradesh', engineers: 4, response: '12 hr' },
        { city: 'Patna', state: 'Bihar', engineers: 3, response: '24 hr' },
        { city: 'Bhubaneswar', state: 'Odisha', engineers: 3, response: '24 hr' },
        { city: 'Chandigarh', state: 'Chandigarh UT', engineers: 3, response: '12 hr' },
        { city: 'Jaipur', state: 'Rajasthan', engineers: 4, response: '12 hr' },
        { city: 'Guwahati', state: 'Assam', engineers: 2, response: '24 hr' },
        { city: 'Trivandrum', state: 'Kerala', engineers: 3, response: '24 hr' },
        { city: 'Indore', state: 'Madhya Pradesh', engineers: 3, response: '24 hr' },
        { city: 'Nagpur', state: 'Maharashtra', engineers: 3, response: '24 hr' },
        { city: 'Visakhapatnam', state: 'Andhra Pradesh', engineers: 3, response: '24 hr' },
        { city: 'Bhopal', state: 'Madhya Pradesh', engineers: 2, response: '24 hr' },
        { city: 'Coimbatore', state: 'Tamil Nadu', engineers: 2, response: '24 hr' },
        { city: 'Vadodara', state: 'Gujarat', engineers: 2, response: '24 hr' },
        { city: 'Surat', state: 'Gujarat', engineers: 2, response: '24 hr' },
        { city: 'Madurai', state: 'Tamil Nadu', engineers: 2, response: '24 hr' },
        { city: 'Dehradun', state: 'Uttarakhand', engineers: 2, response: '24 hr' },
        { city: 'Ranchi', state: 'Jharkhand', engineers: 1, response: '48 hr' },
        { city: 'Raipur', state: 'Chhattisgarh', engineers: 2, response: '24 hr' },
        { city: 'Mangalore', state: 'Karnataka', engineers: 1, response: '24 hr' },
        { city: 'Aizawl', state: 'Mizoram', engineers: 1, response: '72 hr' },
      ],
    },
    projects: [
      { name: 'AIIMS Rishikesh — 28 Adult Ventilators', value: 7800000, client: 'AIIMS Rishikesh', completed: '12-08-2024' },
      { name: 'KGMU Lucknow — 22 Adult Ventilators', value: 6200000, client: 'KGMU', completed: '20-04-2024' },
      { name: 'Sanjay Gandhi PGI — 18 Anaesthesia Ventilators', value: 5600000, client: 'SGPGI Lucknow', completed: '15-12-2023' },
      { name: 'AIIMS Jodhpur — 15 Adult Ventilators', value: 4400000, client: 'AIIMS Jodhpur', completed: '08-09-2023' },
      { name: 'JIPMER — 24 Adult Ventilators', value: 6800000, client: 'JIPMER Puducherry', completed: '20-05-2022' },
      { name: 'Tata Memorial — 14 Anaesthesia Ventilators', value: 5200000, client: 'TMH Mumbai', completed: '12-11-2021' },
    ],
    bg: {
      bankName: 'ICICI Bank',
      branch: 'Andheri East',
      bgNo: 'ICICI/BG/2026/04/9982',
      amount: 2400000,
      issueDate: '02-04-2026',
      validity: '210 days',
    },
  },

  // ---- HB-05: Universal Hospital Equipment Co. (not_eligible — turnover below threshold and < 10 city service network) ----
  {
    slug: 'bidder-05-universal-hospital-equipment',
    company: 'Universal Hospital Equipment Co.',
    address: '14, Rani Jhansi Road, Civil Lines, Nagpur - 440001',
    pan: 'AAFFU3344Q',
    gstin: '27AAFFU3344Q1Z6',
    legalName: 'Universal Hospital Equipment Company',
    dateOfRegistration: '04-09-2017',
    gstStatus: 'ACTIVE',
    incDate: '04-09-2017',
    ceo: { name: 'Mr. Sandeep Kulkarni', designation: 'Director' },
    coverBody: [
      'We submit our bid for the AIIMS ventilator tender. Universal Hospital Equipment Co. has been operational since September 2017 (~8.5 years).',
      'We are CDSCO Form MD-9 licensed for adult ventilators and ISO 13485:2016 certified.',
      'Note: Our annual turnover for FY 2024-25 is Rs. 6.8 Crore. While this is below the Rs. 10 Crore threshold, we have grown 22% YoY and request consideration. Net worth as on 31-03-2025 is Rs. 4.2 Crore.',
      'Our service network presently covers 7 cities. We are expanding to additional 4 cities (Lucknow, Jaipur, Kochi, Bhubaneswar) by end-2026.',
    ],
    ca: {
      caFirm: 'Iyer Mahajan & Co.',
      caName: 'CA Vinod Mahajan',
      caRegNo: '067112W',
      udin: '24067112VMUHEQ4422',
      turnovers: [
        { fy: 'FY 2024-25', amount: 68000000 },
        { fy: 'FY 2023-24', amount: 56000000 },
        { fy: 'FY 2022-23', amount: 47000000 },
      ],
      place: 'Nagpur',
      date: '20-03-2026',
    },
    cdsco: {
      licenseNo: 'MFG/MD/2022/0411',
      issueDate: '15-09-2022',
      expiryDate: '14-09-2027',
      devices: ['Adult Mechanical Ventilator (Class C)', 'Patient Monitor (Class B)'],
      manufacturingSite: '14, Rani Jhansi Road, Civil Lines, Nagpur',
    },
    iso13485: {
      certifyingBody: 'Underwriters Laboratories India',
      certNo: 'UL-IN-2023-13485-22087',
      scope: 'Manufacture of adult mechanical ventilators and patient monitors.',
      issueDate: '01-12-2023',
      expiryDate: '30-11-2026',
      originalDate: '01-12-2020',
      standard: 'ISO 13485:2016',
    },
    iec60601: {
      certifyingBody: 'ETDC (NABL-accredited)',
      certNo: 'ETDC-IEC-60601-2023-0788',
      scope: 'IEC 60601-1 and 60601-2-12 compliance for the UHE-V200 ventilator.',
      issueDate: '20-04-2023',
      expiryDate: '19-04-2026',
      originalDate: '20-04-2023',
      standard: 'IEC 60601-1 / 60601-2-12',
    },
    serviceNetwork: {
      cities: [
        { city: 'Nagpur', state: 'Maharashtra', engineers: 6, response: '4 hr' },
        { city: 'Mumbai', state: 'Maharashtra', engineers: 4, response: '8 hr' },
        { city: 'Pune', state: 'Maharashtra', engineers: 3, response: '12 hr' },
        { city: 'Bhopal', state: 'Madhya Pradesh', engineers: 2, response: '24 hr' },
        { city: 'Indore', state: 'Madhya Pradesh', engineers: 2, response: '24 hr' },
        { city: 'Aurangabad', state: 'Maharashtra', engineers: 2, response: '24 hr' },
        { city: 'Raipur', state: 'Chhattisgarh', engineers: 1, response: '48 hr' },
      ],
    },
    projects: [
      { name: 'GMC Nagpur — 8 Adult Ventilators', value: 2800000, client: 'GMCH Nagpur', completed: '12-04-2024' },
      { name: 'AIIMS Nagpur — 6 Adult Ventilators', value: 2400000, client: 'AIIMS Nagpur', completed: '08-09-2023' },
      { name: 'GMC Bhopal — 5 Adult Ventilators', value: 2200000, client: 'GMC Bhopal', completed: '20-11-2022' },
    ],
    bg: {
      bankName: 'Bank of Maharashtra',
      branch: 'Civil Lines, Nagpur',
      bgNo: 'BOM/BG/2026/04/0588',
      amount: 2400000,
      issueDate: '07-04-2026',
      validity: '210 days',
    },
  },
];

function generateHealthcareBidders() {
  for (const b of healthcareBidders) {
    const dir = healthcareDir(b.slug);
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
    if (b.cdsco) {
      cdscoLicense({ company: b.company, ...b.cdsco }, join(dir, '03-cdsco-manufacturing-license.pdf'));
    }
    isoCertificate({ company: b.company, ...b.iso13485 }, join(dir, '04-iso-13485-certificate.pdf'));
    if (b.iec60601) {
      isoCertificate({ company: b.company, ...b.iec60601 }, join(dir, '05-iec-60601-compliance.pdf'));
    }
    gstCertificate(
      {
        company: b.company,
        gstin: b.gstin,
        legalName: b.legalName,
        dateOfRegistration: b.dateOfRegistration,
        address: b.address,
        status: b.gstStatus,
      },
      join(dir, '06-gst-registration-certificate.pdf'),
    );
    panCard(
      {
        pan: b.pan,
        name: b.legalName.toUpperCase(),
        dateOfIncorporation: b.incDate,
        fatherOrFirm:
          b.legalName.includes('Private Limited') || b.legalName.includes('Limited')
            ? 'Private Limited Company'
            : b.legalName.includes('Company')
              ? 'Partnership Firm'
              : 'Sole Proprietorship',
      },
      join(dir, '07-pan-card.pdf'),
    );
    serviceNetworkStatement(
      {
        company: b.company,
        address: b.address,
        cities: b.serviceNetwork.cities,
        ceoName: b.ceo.name,
      },
      join(dir, '08-service-network-statement.pdf'),
    );
    projectsList({ company: b.company, projects: b.projects }, join(dir, '09-similar-supply-list.pdf'));
    bankGuarantee({ company: b.company, ...b.bg }, join(dir, '10-emd-bank-guarantee.pdf'));
    if (b.iso9001) {
      isoCertificate({ company: b.company, ...b.iso9001 }, join(dir, '11-iso-9001-certificate.pdf'));
    }
  }
}

// ============================================================================
// Run
// ============================================================================

console.log('Generating CRPF construction tender PDF…');
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

console.log('\nGenerating AIIMS healthcare tender PDF…');
generateHealthcareTender();
generateHealthcareBidders();

// ============================================================================
// THIRD TENDER — CRPF Indo-Bangladesh Border Fencing
// ============================================================================

function generateFencingTender() {
  const doc = newDoc();
  const margin = 48;
  const w = pageW(doc);

  ashokSeal(doc, w / 2, margin + 30, 'CRPF');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('GOVERNMENT OF INDIA', w / 2, margin + 78, { align: 'center' });
  doc.setFontSize(10);
  doc.text('MINISTRY OF HOME AFFAIRS', w / 2, margin + 92, { align: 'center' });
  doc.setFontSize(13);
  doc.text('CENTRAL RESERVE POLICE FORCE', w / 2, margin + 108, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Frontier Headquarters (Eastern Sector), Salt Lake, Kolkata - 700091', w / 2, margin + 122, { align: 'center' });
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text('Tel: 033-23210011   |   www.crpf.gov.in   |   eprocure.gov.in', w / 2, margin + 134, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  drawDoubleRule(doc, margin + 146, margin);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('NOTICE INVITING TENDER (e-Procurement)', w / 2, margin + 172, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('F.No. CRPF/EAST/FENCE/2026/03-058', margin, margin + 200);
  doc.text('Dated: 18-03-2026', w - margin, margin + 200, { align: 'right' });

  let y = margin + 224;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Name of Work : Construction and Erection of Border Fencing', margin, y);
  y += 14;
  doc.text('along the Indo-Bangladesh Border, Sector 9, Tripura', margin, y);
  y += 14;
  doc.text('(Length: 18.4 km — Phase II)', margin, y);
  y += 22;

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
      { k: 'Tender Reference No.', v: 'CRPF/EAST/FENCE/2026/03/058' },
      { k: 'Estimated Cost (incl. GST)', v: `${rs(250000000)} (Rupees Twenty Five Crore Only)` },
      { k: 'Earnest Money Deposit (EMD)', v: `${rs(5000000)} (Rupees Fifty Lakh Only)` },
      { k: 'Tender Fee (Non-refundable)', v: 'Rs. 25,000/-' },
      { k: 'Period of Completion', v: '24 (Twenty Four) months from date of award' },
      { k: 'Class of Contractor', v: 'Class-I (Civil — Border Infrastructure)' },
      { k: 'Pre-bid Meeting', v: '01-04-2026, 11:00 hrs IST, FHQ Kolkata' },
      { k: 'Last Date for Bid Submission', v: `${BID_DATE}, 16:00 hrs IST` },
      { k: 'Date of Technical Bid Opening', v: '17-04-2026, 11:00 hrs IST' },
      { k: 'Bid Validity', v: '180 days from technical bid opening' },
    ],
    { headerBg: [232, 232, 224] },
  );

  y += 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('SECTION 3 — MINIMUM ELIGIBILITY CRITERIA', margin, y);
  y += 5;
  hairline(doc, margin, y, w - margin, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  y = paragraph(doc, margin, y,
    'The bidder shall meet ALL of the criteria below. All criteria are mandatory unless explicitly marked as preferred. CRPF reserves the right to verify documents directly with the issuing authority.');
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('3.1  Financial Eligibility', margin, y); y += 14;
  doc.setFont('helvetica', 'normal');
  y = paragraph(doc, margin, y,
    'C-1.  The bidder SHALL have a minimum annual turnover of Rs. 15,00,00,000/- (Rupees Fifteen Crore Only) in any one of the last three financial years (FY 2022-23 / 2023-24 / 2024-25), certified by a practising Chartered Accountant with UDIN.');
  y += 4;
  y = paragraph(doc, margin, y,
    'C-2.  The bidder SHALL submit a valid Solvency Certificate from any Scheduled Commercial Bank for an amount NOT LESS THAN Rs. 5,00,00,000/- (Rupees Five Crore Only), issued not earlier than six (6) months before the bid submission date.');
  y += 4;
  y = paragraph(doc, margin, y,
    'C-3.  The bidder MUST submit Earnest Money Deposit (EMD) of Rs. 50,00,000/- (Rupees Fifty Lakh Only) in the form of a Bank Guarantee or Demand Draft drawn in favour of "DDO, FHQ CRPF Eastern Sector".');
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.text('3.2  Technical Eligibility', margin, y); y += 14;
  doc.setFont('helvetica', 'normal');
  y = paragraph(doc, margin, y,
    'C-4.  The bidder SHALL have successfully completed at least two (2) similar border-fencing or boundary-infrastructure projects in the last seven (7) years from date of bid submission, each of value not less than Rs. 10,00,00,000/- (Rupees Ten Crore Only). "Similar" means construction of fencing, boundary walls, security walls or perimeter infrastructure for Government / paramilitary / armed-forces clients.');
  y += 4;
  y = paragraph(doc, margin, y,
    'C-5.  The bidder MUST have a minimum of eight (8) years of continuous experience in civil construction, with demonstrable work in border, boundary or security-related infrastructure.');
  y += 8;

  if (y > pageH(doc) - 200) { doc.addPage(); y = margin; }

  doc.setFont('helvetica', 'bold');
  doc.text('3.3  Statutory Compliance', margin, y); y += 14;
  doc.setFont('helvetica', 'normal');
  y = paragraph(doc, margin, y,
    'C-6.  The bidder SHALL hold a valid GST Registration. GSTIN must be active as on the bid submission date, verifiable through the GSTN portal.');
  y += 4;
  y = paragraph(doc, margin, y,
    'C-7.  The bidder SHALL hold a valid ISO 9001:2015 (Quality Management System) certification, issued by an IAF-accredited certifying body and valid as on the bid submission date.');
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.text('3.4  Document Submission', margin, y); y += 14;
  doc.setFont('helvetica', 'normal');
  y = paragraph(doc, margin, y,
    'C-8.  The bidder SHALL submit a self-attested copy of the Permanent Account Number (PAN) Card of the firm / company.');
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.text('3.5  Preferred (Non-Mandatory) Criteria', margin, y); y += 14;
  doc.setFont('helvetica', 'normal');
  y = paragraph(doc, margin, y,
    'C-9.  Use of BIS-certified hot-dip galvanised steel from approved domestic manufacturers (TATA / SAIL / Jindal / Essar) for fencing materials is DESIRABLE and shall carry weightage in the technical scoring.');
  y += 4;
  y = paragraph(doc, margin, y,
    'C-10. Prior experience executing border infrastructure work for paramilitary forces (BSF / SSB / ITBP / CRPF) or Indian Armed Forces is ADVANTAGEOUS and may be cited in the cover letter.');

  if (y > pageH(doc) - 180) { doc.addPage(); y = margin; } else { y += 24; }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('DECLARATION', margin, y);
  y += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  y = paragraph(doc, margin, y,
    'CRPF reserves the right to reject any or all bids without assigning any reason and to relax the criteria in the interest of public service in accordance with the General Financial Rules, 2017. Conditional bids are liable to rejection.',
    { fontSize: 9, lineHeight: 12 });

  y += 30;
  signatureBlock(doc, margin, y, {
    name: '(A. K. Mishra, IPS)',
    designation: 'Inspector General (Eastern Sector)',
    line1: 'Frontier Headquarters CRPF, Kolkata',
    line2: 'For and on behalf of President of India',
  });
  rectSeal(doc, w - margin - 110, y - 10, 110, 56, [
    'OFFICE OF THE',
    'INSPECTOR GENERAL',
    '(EASTERN SECTOR)',
    'CRPF FHQ, KOLKATA',
  ]);

  save(doc, join(OUT, 'fencing-tender.pdf'));
}

function fencingDir(slug) {
  const d = join(OUT, 'fencing-bidders', slug);
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  return d;
}

const fencingBidders = [
  // ---- FB-01: Hindustan Borders & Infrastructure (eligible) ----
  {
    slug: 'bidder-01-hindustan-borders-infrastructure',
    company: 'Hindustan Borders & Infrastructure Ltd',
    address: 'Plot 14, Sector 5, Salt Lake City, Kolkata - 700091',
    pan: 'AAACH8821K',
    gstin: '19AAACH8821K1Z3',
    legalName: 'Hindustan Borders and Infrastructure Limited',
    dateOfRegistration: '14-05-2010',
    gstStatus: 'ACTIVE — verified on 11-04-2026',
    incDate: '14-05-2010',
    ceo: { name: 'Mr. Subir Banerjee', designation: 'Managing Director' },
    coverBody: [
      'We submit our bid for the Indo-Bangladesh border fencing tender (Sector 9, Tripura — Phase II). Hindustan Borders & Infrastructure has executed border-fencing and security-perimeter work for BSF, SSB and ITBP across the eastern, north-eastern and western sectors since 2010.',
      'Our completed work includes 47 km of BSF border fencing along the Indo-Bangladesh border in West Bengal and Assam, the SSB perimeter at Birgunj-Raxaul, and the ITBP boundary at Sikkim. Annual turnover for FY 2024-25 was Rs. 32 Crore, certified by Banerjee Roy & Co.',
      'We confirm full compliance with all eligibility criteria, including BIS-certified galvanised steel sourcing from TATA Steel and Jindal Steel for the fencing pillars and chain-link.',
    ],
    ca: {
      caFirm: 'Banerjee Roy & Co.',
      caName: 'CA Tapan Banerjee',
      caRegNo: '054201E',
      udin: '24054201BNRY7711',
      turnovers: [
        { fy: 'FY 2024-25', amount: 320000000 },
        { fy: 'FY 2023-24', amount: 280000000 },
        { fy: 'FY 2022-23', amount: 240000000 },
      ],
      place: 'Kolkata',
      date: '20-03-2026',
    },
    solvency: {
      bankName: 'State Bank of India',
      branch: 'Salt Lake',
      address: 'Sector 5, Salt Lake, Kolkata - 700091',
      accountNo: 'XXXX XXXX 8821',
      amount: 80000000,
      date: '08-02-2026',
      refNo: 'SBI/SLT/SOL/2026/0418',
    },
    iso9001: {
      certifyingBody: 'Bureau Veritas Certification India',
      certNo: 'BV-IN-2024-90001-77144',
      scope:
        'Construction and erection of border fencing, security perimeter walls, and boundary infrastructure for Government and paramilitary clients.',
      issueDate: '01-06-2024',
      expiryDate: '31-05-2027',
      originalDate: '01-06-2015',
    },
    projects: [
      { name: 'BSF Indo-Bangladesh Fencing — Phase I, North 24 Parganas', value: 220000000, client: 'BSF Eastern Command', completed: '20-09-2024' },
      { name: 'SSB Indo-Nepal Boundary Wall — Birgunj Sector', value: 140000000, client: 'SSB HQ', completed: '15-04-2023' },
      { name: 'ITBP Boundary Fencing — Sikkim Sector', value: 105000000, client: 'ITBP HQ', completed: '10-12-2022' },
      { name: 'BSF Border Roads — Cooch Behar', value: 88000000, client: 'BSF', completed: '20-08-2021' },
    ],
    bg: {
      bankName: 'State Bank of India',
      branch: 'Salt Lake',
      bgNo: 'SBI/BG/2026/04/2244',
      amount: 5000000,
      issueDate: '04-04-2026',
      validity: '210 days',
    },
  },

  // ---- FB-02: Eastern Steel Construction (not_eligible — turnover below + only 1 fencing project) ----
  {
    slug: 'bidder-02-eastern-steel-construction',
    company: 'Eastern Steel Construction',
    address: '22, B.T. Road, Kolkata - 700050',
    pan: 'AAFFE3322B',
    gstin: '19AAFFE3322B1ZP',
    legalName: 'Eastern Steel Construction (Partnership)',
    dateOfRegistration: '10-08-2015',
    gstStatus: 'ACTIVE',
    incDate: '10-08-2015',
    ceo: { name: 'Mr. Debasish Mukherjee', designation: 'Managing Partner' },
    coverBody: [
      'We submit our bid for the captioned tender. Eastern Steel Construction has been operational since August 2015 (~10 years 8 months).',
      'We have completed one fencing project for the West Bengal PWD and several boundary wall projects for state government clients. We are working towards expanding into BSF / SSB-grade work.',
      'EMD of Rs. 50 Lakh is enclosed via Allahabad Bank Demand Draft.',
    ],
    ca: {
      caFirm: 'Mukherjee Sen & Co.',
      caName: 'CA Sourav Sen',
      caRegNo: '067822E',
      udin: '24067822MKSN3344',
      turnovers: [
        { fy: 'FY 2024-25', amount: 98000000 },
        { fy: 'FY 2023-24', amount: 87000000 },
        { fy: 'FY 2022-23', amount: 76000000 },
      ],
      place: 'Kolkata',
      date: '14-03-2026',
    },
    solvency: {
      bankName: 'Indian Bank',
      branch: 'B.T. Road',
      address: '22, B.T. Road, Kolkata - 700050',
      accountNo: 'XXXX XXXX 3322',
      amount: 35000000,
      date: '20-02-2026',
      refNo: 'IB/BTR/SOL/2026/0188',
    },
    iso9001: {
      certifyingBody: 'TUV India Pvt Ltd',
      certNo: 'TUV-IN-2024-90001-44882',
      scope: 'Civil construction and steel-fabrication works.',
      issueDate: '01-04-2024',
      expiryDate: '31-03-2027',
      originalDate: '01-04-2018',
    },
    projects: [
      { name: 'WB PWD Boundary Fencing — Howrah PSU Plant', value: 92000000, client: 'WB PWD', completed: '12-01-2024' },
      { name: 'KMC Park Boundary Wall, Salt Lake', value: 45000000, client: 'KMC', completed: '08-09-2022' },
      { name: 'Govt Industrial Estate Wall — Durgapur', value: 38000000, client: 'WB Govt', completed: '20-04-2021' },
    ],
    bg: {
      bankName: 'Indian Bank',
      branch: 'B.T. Road',
      bgNo: 'IB/DD/2026/04/0066',
      amount: 5000000,
      issueDate: '06-04-2026',
      validity: '210 days',
      mode: 'Demand Draft',
    },
  },

  // ---- FB-03: Patel Boundary Works (needs_review — borderline experience + ISO scope) ----
  {
    slug: 'bidder-03-patel-boundary-works',
    company: 'Patel Boundary Works',
    address: 'Plot 8, Hindustan Steel Compound, Asansol - 713301',
    pan: 'AAACP4411D',
    gstin: '19AAACP4411D1ZQ',
    legalName: 'Patel Boundary Works Pvt Ltd',
    dateOfRegistration: '15-04-2018',
    gstStatus: 'ACTIVE',
    incDate: '15-04-2018',
    ceo: { name: 'Mr. Hardik Patel', designation: 'Director' },
    coverBody: [
      'Patel Boundary Works was incorporated on 15-04-2018 (~7 years 12 months as on the bid submission date — slightly short of the 8-year minimum requested in C-5). We respectfully request consideration on the basis of substantive experience accumulated during this period.',
      'We have executed two BSF border-related projects (mostly access roads with boundary wall) but the second of these is from 2018 and may fall outside the 7-year window depending on the date of measurement.',
      'Our ISO 9001:2015 scope covers "general civil construction" and not specifically border infrastructure; the certifying body has been requested to update the scope.',
    ],
    ca: {
      caFirm: 'Patel & Patel',
      caName: 'CA Mehul Patel',
      caRegNo: '102211W',
      udin: '24102211PTMP6622',
      turnovers: [
        { fy: 'FY 2024-25', amount: 180000000 },
        { fy: 'FY 2023-24', amount: 150000000 },
        { fy: 'FY 2022-23', amount: 130000000 },
      ],
      place: 'Asansol',
      date: '12-03-2026',
    },
    solvency: {
      bankName: 'Bank of Baroda',
      branch: 'Asansol Main',
      address: 'Hindustan Steel Compound, Asansol - 713301',
      accountNo: 'XXXX XXXX 4411',
      amount: 60000000,
      date: '01-12-2025',
      refNo: 'BOB/ASN/SOL/2025/0488',
    },
    iso9001: {
      certifyingBody: 'Intertek Certification India',
      certNo: 'INT-9001-2023-66012',
      scope: 'General civil construction and reinforced concrete works.',
      issueDate: '15-09-2023',
      expiryDate: '14-09-2026',
      originalDate: '15-09-2020',
    },
    projects: [
      { name: 'BSF Boundary Wall + Access Road — Dhubri Sector', value: 110000000, client: 'BSF Eastern', completed: '20-08-2024' },
      { name: 'BSF Service Road + Wall — Murshidabad', value: 105000000, client: 'BSF Eastern', completed: '12-09-2018' },
      { name: 'Govt PWD Steel Compound — Dhanbad', value: 78000000, client: 'Jharkhand PWD', completed: '15-06-2021' },
    ],
    bg: {
      bankName: 'Bank of Baroda',
      branch: 'Asansol Main',
      bgNo: 'BOB/BG/2026/04/0099',
      amount: 5000000,
      issueDate: '07-04-2026',
      validity: '210 days',
    },
  },

  // ---- FB-04: Kalpana Steel & Civil (eligible) ----
  {
    slug: 'bidder-04-kalpana-steel-civil',
    company: 'Kalpana Steel & Civil Pvt Ltd',
    address: '57, Civil Lines, Guwahati - 781001',
    pan: 'AAACK7711N',
    gstin: '18AAACK7711N1Z8',
    legalName: 'Kalpana Steel and Civil Private Limited',
    dateOfRegistration: '20-07-2009',
    gstStatus: 'ACTIVE',
    incDate: '20-07-2009',
    ceo: { name: 'Mrs. Anuradha Saikia', designation: 'Managing Director' },
    coverBody: [
      'Kalpana Steel & Civil, established in July 2009 (~16 years), is one of the larger civil-and-steel contractors in the north-east. We have executed border fencing for BSF, SSB and ITBP and have ongoing work along the Indo-Myanmar border in Mizoram.',
      'Our flagship project is the 28 km BSF Indo-Bangladesh fencing in Karimganj, Assam. We also use only TATA Steel and SAIL hot-dip galvanised steel for all fencing work, certified through BIS-tested chains.',
      'Audited turnover for FY 2024-25 is Rs. 38 Crore. ISO 9001:2015 (DNV-GL India) and Solvency Certificate (HDFC Bank, Guwahati) for Rs. 7 Crore are enclosed.',
    ],
    ca: {
      caFirm: 'Saikia Borah & Associates',
      caName: 'CA Pranab Saikia',
      caRegNo: '038211E',
      udin: '24038211SKBR8822',
      turnovers: [
        { fy: 'FY 2024-25', amount: 380000000 },
        { fy: 'FY 2023-24', amount: 320000000 },
        { fy: 'FY 2022-23', amount: 270000000 },
      ],
      place: 'Guwahati',
      date: '18-03-2026',
    },
    solvency: {
      bankName: 'HDFC Bank',
      branch: 'Guwahati Main',
      address: 'GS Road, Guwahati - 781005',
      accountNo: 'XXXX XXXX 7711',
      amount: 70000000,
      date: '12-02-2026',
      refNo: 'HDFC/GHY/SOL/2026/0612',
    },
    iso9001: {
      certifyingBody: 'DNV-GL India',
      certNo: 'DNV-9001-2024-04011',
      scope:
        'Construction of border fencing, perimeter walls, civil and steel infrastructure for paramilitary and Government clients.',
      issueDate: '01-05-2024',
      expiryDate: '30-04-2027',
      originalDate: '01-05-2014',
    },
    projects: [
      { name: 'BSF Indo-Bangladesh Fencing — Karimganj (28 km)', value: 280000000, client: 'BSF North-East', completed: '15-11-2024' },
      { name: 'ITBP Indo-China Boundary Wall — Tawang Sector', value: 195000000, client: 'ITBP HQ', completed: '20-04-2023' },
      { name: 'SSB Indo-Bhutan Fencing — Phuentsholing Sector', value: 142000000, client: 'SSB HQ', completed: '18-09-2022' },
      { name: 'BSF Cooch Behar Phase II — boundary work', value: 120000000, client: 'BSF Eastern', completed: '10-06-2021' },
      { name: 'Assam Rifles Boundary Renovation — Tezpur', value: 78000000, client: 'Assam Rifles', completed: '14-12-2019' },
    ],
    bg: {
      bankName: 'HDFC Bank',
      branch: 'Guwahati Main',
      bgNo: 'HDFC/BG/2026/04/0918',
      amount: 5000000,
      issueDate: '03-04-2026',
      validity: '210 days',
    },
  },

  // ---- FB-05: Northeast Builders (not_eligible — no similar fencing project ≥ Rs 10 Cr) ----
  {
    slug: 'bidder-05-northeast-builders',
    company: 'Northeast Builders',
    address: '8, Paltan Bazar, Shillong - 793001',
    pan: 'AAFFN5500X',
    gstin: '17AAFFN5500X1ZM',
    legalName: 'Northeast Builders (Partnership)',
    dateOfRegistration: '04-02-2014',
    gstStatus: 'ACTIVE',
    incDate: '04-02-2014',
    ceo: { name: 'Mr. K. Lyngdoh', designation: 'Managing Partner' },
    coverBody: [
      'We submit our bid. Northeast Builders has been operational since 2014 (~12 years) and primarily executes road, building and culvert work for the State PWD across Meghalaya and Assam.',
      'We have not previously executed border-fencing work but our experience in remote-area civil construction is directly relevant. We seek to enter the border-infrastructure space through this tender.',
    ],
    ca: {
      caFirm: 'Lyngdoh & Co.',
      caName: 'CA Daniel Lyngdoh',
      caRegNo: '094112E',
      udin: '24094112LDDL5511',
      turnovers: [
        { fy: 'FY 2024-25', amount: 175000000 },
        { fy: 'FY 2023-24', amount: 142000000 },
        { fy: 'FY 2022-23', amount: 118000000 },
      ],
      place: 'Shillong',
      date: '14-03-2026',
    },
    solvency: {
      bankName: 'Punjab National Bank',
      branch: 'Shillong Main',
      address: 'Paltan Bazar, Shillong - 793001',
      accountNo: 'XXXX XXXX 5500',
      amount: 55000000,
      date: '22-02-2026',
      refNo: 'PNB/SHL/SOL/2026/0211',
    },
    iso9001: {
      certifyingBody: 'TUV India Pvt Ltd',
      certNo: 'TUV-IN-2023-90001-22288',
      scope: 'Civil construction including roads, buildings and culverts in remote areas.',
      issueDate: '20-06-2023',
      expiryDate: '19-06-2026',
      originalDate: '20-06-2017',
    },
    projects: [
      { name: 'Meghalaya PWD Highway Stretch — Cherrapunji', value: 145000000, client: 'Meghalaya PWD', completed: '12-10-2024' },
      { name: 'Govt Cultural Centre, Shillong', value: 88000000, client: 'Meghalaya Govt', completed: '20-08-2023' },
      { name: 'Border Patrol Rest Houses, Tura', value: 32000000, client: 'BSF North-East', completed: '14-04-2022' },
    ],
    bg: {
      bankName: 'Punjab National Bank',
      branch: 'Shillong Main',
      bgNo: 'PNB/BG/2026/04/0044',
      amount: 5000000,
      issueDate: '07-04-2026',
      validity: '210 days',
    },
  },
];

function generateFencingBidders() {
  for (const b of fencingBidders) {
    const dir = fencingDir(b.slug);
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
      { company: b.company, ...b.solvency },
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
    panCard(
      {
        pan: b.pan,
        name: b.legalName.toUpperCase(),
        dateOfIncorporation: b.incDate,
        fatherOrFirm:
          b.legalName.includes('Private Limited') || b.legalName.includes('Limited')
            ? 'Private Limited Company'
            : b.legalName.includes('Partnership')
              ? 'Partnership Firm'
              : 'Sole Proprietorship',
      },
      join(dir, '06-pan-card.pdf'),
    );
    projectsList({ company: b.company, projects: b.projects }, join(dir, '07-projects-list.pdf'));
    bankGuarantee({ company: b.company, ...b.bg }, join(dir, '08-emd-bank-guarantee.pdf'));
  }
}

console.log('\nGenerating CRPF border fencing tender PDF…');
generateFencingTender();
generateFencingBidders();

console.log('\nDone. Sample data written to', OUT);
