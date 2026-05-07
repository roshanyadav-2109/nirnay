// Generate mock tender + 5 mock bidder PDFs for the Nirnay demo.
// Run with: node scripts/generate-mock-data.mjs
//
// Each PDF is plain typed text (no scans/images) so Gemini reads it cleanly.
// The data is deliberately tuned so the verdict engine produces:
//   bidder-01 : eligible   (clean docs, all thresholds met)
//   bidder-02 : not_eligible (turnover and solvency below thresholds)
//   bidder-03 : needs_review (ambiguous: poor wording + edge-case dates)
//   bidder-04 : eligible   (clean docs)
//   bidder-05 : not_eligible (ISO 9001 expired before bid date)

import { jsPDF } from 'jspdf';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'sample-data');
mkdirSync(OUT, { recursive: true });

const BID_DATE = '2026-04-15';

function makePdf(lines, outPath) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 56;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const usableWidth = pageWidth - margin * 2;
  let y = margin;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);

  for (const raw of lines) {
    const isHeading = raw.startsWith('# ');
    const isSubheading = raw.startsWith('## ');
    const text = raw.replace(/^#+\s*/, '');

    if (isHeading) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      y += 8;
    } else if (isSubheading) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      y += 6;
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
    }

    if (text.trim() === '') {
      y += 8;
      continue;
    }

    const wrapped = doc.splitTextToSize(text, usableWidth);
    for (const line of wrapped) {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += isHeading ? 22 : isSubheading ? 18 : 15;
    }
  }

  writeFileSync(outPath, Buffer.from(doc.output('arraybuffer')));
  console.log('wrote', outPath);
}

const tenderLines = [
  '# Government of India',
  '# Central Reserve Police Force (CRPF)',
  '# Tender No. CRPF/CIV/2026/04/BOP-117',
  '',
  '## NOTICE INVITING TENDER (NIT)',
  'Construction of Border Outpost Building at Sector 14, North Frontier',
  '',
  `Estimated Cost: Rs. 8,00,00,000 (Rupees Eight Crore Only)`,
  `Bid Submission Deadline: ${BID_DATE}`,
  'Earnest Money Deposit (EMD): Rs. 16,00,000 (Rupees Sixteen Lakh Only)',
  '',
  '## SECTION 3 — ELIGIBILITY CRITERIA',
  '',
  'The bidder shall meet ALL the following minimum eligibility criteria. Bids that fail any mandatory criterion shall be rejected. Bidders are required to submit documentary evidence for each criterion.',
  '',
  '## 3.1 Financial Eligibility',
  '',
  'C-1. The bidder shall have a minimum annual turnover of Rs. 5,00,00,000 (Rupees Five Crore) in any one of the last three financial years (FY 2022-23, FY 2023-24, FY 2024-25). A Chartered Accountant certificate is mandatory.',
  '',
  'C-2. The bidder shall submit a valid Solvency Certificate from any Scheduled Commercial Bank for an amount not less than Rs. 2,00,00,000 (Rupees Two Crore). The certificate must be issued not earlier than six months before the bid submission date.',
  '',
  'C-3. The bidder must submit Earnest Money Deposit (EMD) of Rs. 16,00,000 (Rupees Sixteen Lakh Only) in the form of a Bank Guarantee or Demand Draft.',
  '',
  '## 3.2 Technical Eligibility',
  '',
  'C-4. The bidder shall have successfully completed at least three (3) similar civil construction projects in the last seven (7) years, each of value not less than Rs. 2,00,00,000 (Rupees Two Crore). "Similar" means construction of buildings, barracks, or institutional structures for Government or PSU clients.',
  '',
  'C-5. The bidder must have a minimum of five (5) years of experience in civil construction. Date of incorporation or relevant business registration shall be the reference.',
  '',
  '## 3.3 Compliance & Certifications',
  '',
  'C-6. The bidder shall hold a valid GST Registration. GSTIN must be active as on the date of bid submission.',
  '',
  'C-7. The bidder shall hold a valid ISO 9001:2015 (Quality Management Systems) certification, valid as on the date of bid submission.',
  '',
  '## 3.4 Document Submission',
  '',
  'C-8. The bidder shall submit a self-attested copy of the Permanent Account Number (PAN) Card of the firm/company.',
  '',
  '## 3.5 Preferred (Non-Mandatory) Criteria',
  '',
  'C-9. ISO 14001:2015 (Environmental Management Systems) certification is desirable and shall carry weightage in the technical evaluation. This is a preferred criterion.',
  '',
  'C-10. Prior experience in construction projects for paramilitary or defense forces is advantageous and may be cited in the cover letter. This is a preferred criterion.',
  '',
  '## SECTION 4 — TENDER FEE AND BID SECURITY',
  'Tender fee Rs. 5,000/- non-refundable. EMD as per C-3 above. Validity of bid: 120 days.',
  '',
  '## DECLARATION',
  'The undersigned hereby certifies that the information provided is true to the best of their knowledge and that any false statement may lead to disqualification.',
];

makePdf(tenderLines, join(OUT, 'mock-tender.pdf'));

function bidderDir(slug) {
  const d = join(OUT, 'bidders', slug);
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  return d;
}

// ---------------- Bidder 01 — Sharma Construction (eligible) ----------------
const b1 = bidderDir('bidder-01-sharma-construction');
makePdf(
  [
    '# Sharma Construction Pvt Ltd',
    '## Cover Letter — Bid Submission',
    'Tender Ref: CRPF/CIV/2026/04/BOP-117',
    `Date: ${BID_DATE}`,
    '',
    'We hereby submit our bid for the construction of CRPF Border Outpost Building. Sharma Construction Pvt Ltd has been engaged in civil construction since 2010 (15 years) and has executed 47 government and PSU projects to date.',
    'We confirm full compliance with all eligibility criteria including ISO 9001:2015, ISO 14001 and prior experience with paramilitary forces (BSF, ITBP).',
    '',
    'Authorised Signatory: Rajesh Sharma, Managing Director',
  ],
  join(b1, '01-cover-letter.pdf'),
);
makePdf(
  [
    '# Chartered Accountant Certificate',
    '## Certificate of Annual Turnover',
    'Issued to: Sharma Construction Pvt Ltd',
    'PAN: AABCS1234A',
    '',
    'I hereby certify that the audited annual turnover of M/s Sharma Construction Pvt Ltd for the last three financial years is as follows:',
    '',
    'FY 2022-23: Rs. 9,80,00,000 (Rupees Nine Crore Eighty Lakh Only)',
    'FY 2023-24: Rs. 12,40,00,000 (Rupees Twelve Crore Forty Lakh Only)',
    'FY 2024-25: Rs. 15,20,00,000 (Rupees Fifteen Crore Twenty Lakh Only)',
    '',
    'Issued at: New Delhi',
    'Date: 2026-03-20',
    'CA Firm: Mehra & Associates, Membership No. 087451',
  ],
  join(b1, '02-ca-turnover-certificate.pdf'),
);
makePdf(
  [
    '# Solvency Certificate',
    '## State Bank of India',
    'Branch: Connaught Place, New Delhi',
    `Date of Issue: 2026-02-10`,
    '',
    'This is to certify that M/s Sharma Construction Pvt Ltd, account number XXXXX1234, is solvent to the extent of Rs. 3,00,00,000 (Rupees Three Crore Only) as of the date of this certificate.',
    '',
    'For State Bank of India',
    'Branch Manager (signed and stamped)',
  ],
  join(b1, '03-solvency-certificate.pdf'),
);
makePdf(
  [
    '# GST Registration Certificate',
    'GSTIN: 07AABCS1234A1Z5',
    'Legal Name: Sharma Construction Pvt Ltd',
    'Date of Registration: 2017-07-01',
    'Status: ACTIVE (verified as on 2026-04-10)',
    'Principal Place of Business: Plot 22, Industrial Area Phase II, New Delhi - 110020',
  ],
  join(b1, '04-gst-certificate.pdf'),
);
makePdf(
  [
    '# ISO 9001:2015 Certificate',
    'Bureau Veritas Certification India Pvt Ltd',
    '',
    'Certificate Number: BV-IN-2023-9001-77821',
    'Issued to: Sharma Construction Pvt Ltd',
    'Scope: Design, Construction and Project Management of Civil and Institutional Buildings',
    'Date of Initial Certification: 2017-08-12',
    'Date of Issue: 2025-08-12',
    'Date of Expiry: 2028-08-11',
    '',
    '# ISO 14001:2015 Certificate',
    'Certificate Number: BV-IN-2024-14001-44120',
    'Date of Expiry: 2027-04-30',
  ],
  join(b1, '05-iso-certificates.pdf'),
);
makePdf(
  [
    '# PAN Card',
    'Permanent Account Number: AABCS1234A',
    'Name: Sharma Construction Pvt Ltd',
    'Date of Incorporation: 2010-03-15',
  ],
  join(b1, '06-pan-card.pdf'),
);
makePdf(
  [
    '# List of Similar Completed Projects',
    'Sharma Construction Pvt Ltd',
    '',
    '1. ITBP Barrack Building, Leh — Rs. 4,80,00,000 — Completed 2024-03-01 (Govt of India, MHA)',
    '2. CISF Office Complex, Jaipur — Rs. 6,20,00,000 — Completed 2023-09-15 (CISF Hqrs)',
    '3. BSF Family Quarters, Jaisalmer — Rs. 3,90,00,000 — Completed 2022-11-30 (BSF Hqrs)',
    '4. Police Training Institute, Bhopal — Rs. 7,50,00,000 — Completed 2021-06-20 (MP Police Housing Corp)',
    '5. CRPF Mess Hall, Hazaribagh — Rs. 2,80,00,000 — Completed 2020-04-10 (CRPF)',
    '',
    'All projects completed satisfactorily. Completion certificates available.',
  ],
  join(b1, '07-projects-list.pdf'),
);
makePdf(
  [
    '# EMD Receipt — Bank Guarantee',
    'Bank: HDFC Bank, Connaught Place Branch',
    'BG No.: HDFC/BG/2026/04/0119',
    'Amount: Rs. 16,00,000 (Rupees Sixteen Lakh Only)',
    'Beneficiary: CRPF, Tender CRPF/CIV/2026/04/BOP-117',
    `Date of Issue: 2026-04-05`,
    'Validity: 180 days',
  ],
  join(b1, '08-emd-bank-guarantee.pdf'),
);

// ---------------- Bidder 02 — Gupta Builders (not eligible) ----------------
const b2 = bidderDir('bidder-02-gupta-builders');
makePdf(
  [
    '# Gupta Builders',
    '## Cover Letter — Bid Submission',
    `Date: ${BID_DATE}`,
    'We submit our bid for CRPF/CIV/2026/04/BOP-117. Gupta Builders has been operating since 2017 (8 years) with focus on residential and small institutional construction.',
    'Authorised Signatory: Anil Gupta, Proprietor',
  ],
  join(b2, '01-cover-letter.pdf'),
);
makePdf(
  [
    '# Chartered Accountant Certificate — Annual Turnover',
    'Issued to: Gupta Builders',
    'PAN: AAFFG7654B',
    '',
    'Certified annual turnover for the last three years:',
    'FY 2022-23: Rs. 2,80,00,000 (Rupees Two Crore Eighty Lakh Only)',
    'FY 2023-24: Rs. 3,10,00,000 (Rupees Three Crore Ten Lakh Only)',
    'FY 2024-25: Rs. 3,40,00,000 (Rupees Three Crore Forty Lakh Only)',
    '',
    'CA Firm: Bhardwaj & Co., Membership No. 102233',
    `Date: 2026-03-15`,
  ],
  join(b2, '02-ca-turnover.pdf'),
);
makePdf(
  [
    '# Solvency Certificate',
    'Punjab National Bank, Karol Bagh Branch',
    `Date: 2026-02-22`,
    '',
    'M/s Gupta Builders is solvent to the extent of Rs. 1,50,00,000 (Rupees One Crore Fifty Lakh Only).',
    'Branch Manager (signed and stamped)',
  ],
  join(b2, '03-solvency-certificate.pdf'),
);
makePdf(
  [
    '# GST Registration Certificate',
    'GSTIN: 07AAFFG7654B1ZK',
    'Legal Name: Gupta Builders',
    'Date of Registration: 2017-09-12',
    'Status: ACTIVE',
  ],
  join(b2, '04-gst-certificate.pdf'),
);
makePdf(
  [
    '# ISO 9001:2015 Certificate',
    'TUV India Pvt Ltd',
    'Certificate No.: TUV-IN-2024-90001-66312',
    'Issued to: Gupta Builders',
    'Date of Issue: 2024-05-01',
    'Date of Expiry: 2027-04-30',
  ],
  join(b2, '05-iso-9001.pdf'),
);
makePdf(
  [
    '# PAN Card',
    'PAN: AAFFG7654B',
    'Name: Gupta Builders (Sole Proprietorship)',
    'Date of Establishment: 2017-08-01',
  ],
  join(b2, '06-pan-card.pdf'),
);
makePdf(
  [
    '# List of Similar Projects',
    '1. Residential Apartment Block, Faridabad — Rs. 2,40,00,000 — 2023',
    '2. Govt Primary Health Centre, Rohtak — Rs. 2,10,00,000 — 2022',
    '3. Municipal School Block, Karnal — Rs. 2,60,00,000 — 2021',
    '4. Community Hall, Sonipat — Rs. 2,20,00,000 — 2020',
  ],
  join(b2, '07-projects-list.pdf'),
);
makePdf(
  [
    '# EMD Bank Guarantee',
    'Punjab National Bank',
    'Amount: Rs. 16,00,000',
    `Date: 2026-04-08`,
    'Beneficiary: CRPF',
  ],
  join(b2, '08-emd.pdf'),
);

// ---------------- Bidder 03 — National Infrastructure Corp (needs_review) -----
const b3 = bidderDir('bidder-03-national-infrastructure-corp');
makePdf(
  [
    '# National Infrastructure Corp',
    '## Cover Letter',
    `Date: ${BID_DATE}`,
    'We submit our proposal. Documents enclosed. Some certificates were re-printed from older scans; please refer to the original copies on file with the issuing authorities for confirmation.',
  ],
  join(b3, '01-cover-letter.pdf'),
);
makePdf(
  [
    '# CA Turnover Certificate (legibility note: scanned from photocopy)',
    'M/s National Infrastructure Corp',
    'Annual Turnover (combined operations):',
    '',
    'FY 2024-25: Rs. 7,20,00,000 — figure derived from books; final audit pending.',
    'FY 2023-24: Rs. 4,90,00,000',
    'FY 2022-23: Rs. 4,10,00,000',
    '',
    'Note: figures for FY 2024-25 are provisional (audit in progress).',
  ],
  join(b3, '02-ca-turnover.pdf'),
);
makePdf(
  [
    '# Solvency Certificate',
    'Bank of Baroda',
    `Date of Issue: 2025-12-30`,
    'Solvency: Rs. 2,50,00,000 (Rupees Two Crore Fifty Lakh Only)',
    'Note: This certificate is valid for six months from date of issue.',
  ],
  join(b3, '03-solvency.pdf'),
);
makePdf(
  [
    '# GST Registration',
    'GSTIN: 07AAACN9876C1Z2 (partial print legibility on scan)',
    'Status as per latest verification: ACTIVE',
  ],
  join(b3, '04-gst.pdf'),
);
makePdf(
  [
    '# ISO 9001:2015 Certificate',
    'Issued to: National Infrastructure Corp',
    'Date of Initial Certification: 2020-04-15',
    'Date of Last Renewal: 2023-04-15',
    `Date of Expiry: ${BID_DATE}`,
    'Note: certificate expires on the bid submission date itself; renewal is in progress.',
  ],
  join(b3, '05-iso-9001.pdf'),
);
makePdf(
  [
    '# PAN Card',
    'PAN: AAACN9876C',
    'Name: National Infrastructure Corp',
    'Date of Incorporation: 2019-11-20 (approximately 6 years and 5 months)',
  ],
  join(b3, '06-pan-card.pdf'),
);
makePdf(
  [
    '# List of Similar Projects',
    '1. Govt Office Block, Lucknow — Rs. 2,30,00,000 — Completed 2024-02-01',
    '2. School Building, Varanasi — Rs. 2,10,00,000 — Completed 2022-08-15',
    '3. PWD Rest House, Allahabad — Rs. 2,40,00,000 — Completed 2018-09-30 (note: just outside the 7-year window relative to bid submission)',
  ],
  join(b3, '07-projects-list.pdf'),
);
makePdf(
  [
    '# EMD Demand Draft',
    'Drawn on: Bank of Baroda',
    'Amount: Rs. 16,00,000',
    'Beneficiary: CRPF',
    `Date: 2026-04-09`,
  ],
  join(b3, '08-emd.pdf'),
);

// ---------------- Bidder 04 — Apex Constructions (eligible) ----------------
const b4 = bidderDir('bidder-04-apex-constructions');
makePdf(
  [
    '# Apex Constructions Ltd',
    '## Cover Letter',
    `Date: ${BID_DATE}`,
    'Apex Constructions Ltd, established in 2010 (15 years), submits this bid in response to Tender CRPF/CIV/2026/04/BOP-117. We confirm compliance with all stipulated criteria and have enclosed full documentation.',
    'Authorised Signatory: Vikram Mehta, CEO',
  ],
  join(b4, '01-cover-letter.pdf'),
);
makePdf(
  [
    '# CA Turnover Certificate',
    'Issued to: Apex Constructions Ltd',
    'PAN: AAACA5566D',
    '',
    'Audited Annual Turnover:',
    'FY 2024-25: Rs. 18,00,00,000 (Rupees Eighteen Crore Only)',
    'FY 2023-24: Rs. 14,30,00,000',
    'FY 2022-23: Rs. 11,80,00,000',
    '',
    'CA Firm: Khanna & Khanna, Membership No. 045129',
    `Date: 2026-03-22`,
  ],
  join(b4, '02-ca-turnover.pdf'),
);
makePdf(
  [
    '# Solvency Certificate',
    'ICICI Bank, Mumbai Main Branch',
    `Date: 2026-02-15`,
    'Solvency: Rs. 4,00,00,000 (Rupees Four Crore Only)',
  ],
  join(b4, '03-solvency.pdf'),
);
makePdf(
  [
    '# GST Registration Certificate',
    'GSTIN: 27AAACA5566D1Z9',
    'Legal Name: Apex Constructions Ltd',
    'Date of Registration: 2017-07-01',
    'Status: ACTIVE',
  ],
  join(b4, '04-gst.pdf'),
);
makePdf(
  [
    '# ISO 9001:2015 Certificate',
    'DNV-GL India',
    'Certificate No.: DNV-9001-2024-02112',
    'Issued to: Apex Constructions Ltd',
    'Date of Issue: 2024-06-01',
    'Date of Expiry: 2027-05-31',
  ],
  join(b4, '05-iso-9001.pdf'),
);
makePdf(
  [
    '# PAN Card',
    'PAN: AAACA5566D',
    'Name: Apex Constructions Ltd',
    'Date of Incorporation: 2010-08-25',
  ],
  join(b4, '06-pan-card.pdf'),
);
makePdf(
  [
    '# Similar Completed Projects',
    '1. Indian Air Force Station HQ, Pune — Rs. 8,90,00,000 — Completed 2024-09-20',
    '2. Naval Officers Mess, Visakhapatnam — Rs. 6,40,00,000 — Completed 2023-05-10',
    '3. CRPF Group Centre, Avadi — Rs. 9,20,00,000 — Completed 2022-11-30',
    '4. CISF HQ Annexe, Gurugram — Rs. 5,80,00,000 — Completed 2021-07-15',
    '5. BSF Hospital, Tekanpur — Rs. 7,10,00,000 — Completed 2020-12-20',
    '6. SSB Training Centre, Salonibari — Rs. 4,50,00,000 — Completed 2019-10-05',
    '7. Coast Guard Quarters, Porbandar — Rs. 3,70,00,000 — Completed 2018-08-12',
  ],
  join(b4, '07-projects-list.pdf'),
);
makePdf(
  [
    '# EMD Bank Guarantee',
    'ICICI Bank',
    'Amount: Rs. 16,00,000',
    `Date: 2026-04-04`,
  ],
  join(b4, '08-emd.pdf'),
);

// ---------------- Bidder 05 — Metro Build Solutions (not_eligible: ISO expired) ---
const b5 = bidderDir('bidder-05-metro-build-solutions');
makePdf(
  [
    '# Metro Build Solutions',
    '## Cover Letter',
    `Date: ${BID_DATE}`,
    'Metro Build Solutions submits this bid. We have been operational since 2018 (7 years) and execute civil work for state PWDs and PSUs.',
  ],
  join(b5, '01-cover-letter.pdf'),
);
makePdf(
  [
    '# CA Turnover Certificate',
    'Issued to: Metro Build Solutions',
    'PAN: AAACM3344E',
    '',
    'FY 2024-25: Rs. 6,20,00,000',
    'FY 2023-24: Rs. 5,40,00,000',
    'FY 2022-23: Rs. 4,80,00,000',
    '',
    'CA Firm: Iyer & Co., Membership No. 091122',
  ],
  join(b5, '02-ca-turnover.pdf'),
);
makePdf(
  [
    '# Solvency Certificate',
    'Axis Bank',
    `Date: 2026-02-25`,
    'Solvency: Rs. 2,00,00,000 (Rupees Two Crore Only)',
  ],
  join(b5, '03-solvency.pdf'),
);
makePdf(
  [
    '# GST Registration Certificate',
    'GSTIN: 27AAACM3344E1Z3',
    'Legal Name: Metro Build Solutions',
    'Status: ACTIVE',
  ],
  join(b5, '04-gst.pdf'),
);
makePdf(
  [
    '# ISO 9001:2015 Certificate',
    'Intertek Certification India',
    'Certificate No.: INT-9001-2022-09887',
    'Issued to: Metro Build Solutions',
    'Date of Issue: 2022-07-01',
    'Date of Expiry: 2025-06-30',
    'Note: Certificate has lapsed. Renewal application filed but not yet completed.',
  ],
  join(b5, '05-iso-9001.pdf'),
);
makePdf(
  [
    '# PAN Card',
    'PAN: AAACM3344E',
    'Name: Metro Build Solutions',
    'Date of Incorporation: 2018-04-12',
  ],
  join(b5, '06-pan-card.pdf'),
);
makePdf(
  [
    '# Similar Completed Projects',
    '1. State PWD Office, Nagpur — Rs. 2,30,00,000 — 2024',
    '2. Govt Polytechnic Workshop Block, Nashik — Rs. 2,90,00,000 — 2023',
    '3. Bus Depot Building, Aurangabad — Rs. 2,15,00,000 — 2022',
  ],
  join(b5, '07-projects-list.pdf'),
);
makePdf(
  [
    '# EMD Demand Draft',
    'Axis Bank',
    'Amount: Rs. 16,00,000',
    `Date: 2026-04-08`,
  ],
  join(b5, '08-emd.pdf'),
);

console.log('\nAll mock PDFs generated under sample-data/');
