import type { EvaluationResponse, VerdictStatus } from '../types';

// Pre-computed verdicts for the five bundled sample bidders against the
// CRPF mock tender. Keyed by a normalised form of the bidder name; matched
// to incoming criteria by ordinal position.
//
// The numbers and dates here line up with the realistic PDFs in
// sample-data/, so the demo always produces:
//   bidder-01 -> eligible
//   bidder-02 -> not_eligible (turnover and solvency below thresholds)
//   bidder-03 -> needs_review (ISO 9001 expires on bid date)
//   bidder-04 -> eligible
//   bidder-05 -> not_eligible (ISO 9001 expired before bid date)

type CachedEvaluation = EvaluationResponse;

interface CachedBidder {
  // Used for fuzzy name match against whatever the user typed when adding the bidder.
  matchKeys: string[];
  evaluations: CachedEvaluation[];
}

const e = (
  status: VerdictStatus,
  confidence: number,
  found_value: string,
  found_unit: string,
  evidence_text: string,
  evidence_doc: string,
  evidence_page: number,
  reasoning: string,
): CachedEvaluation => ({
  status,
  found_value,
  found_unit,
  confidence,
  evidence_text,
  evidence_doc,
  evidence_page,
  reasoning,
});

// Each bidder has 10 entries matching the 10 criteria the tender produces
// (C-1 through C-10 in order). If the user's tender extracts more or fewer
// criteria, the loader falls back to a generic needs_review for the extras.

export const DEMO_BIDDERS: CachedBidder[] = [
  // ---- Sharma Construction (eligible) ----
  {
    matchKeys: ['sharma'],
    evaluations: [
      e('eligible', 0.97, '152000000', 'INR',
        'FY 2024-25: Rs. 15,20,00,000 (Rupees Fifteen Crore Twenty Lakh Only)',
        '02-ca-turnover-certificate.pdf', 1,
        'CA-certified turnover for FY 2024-25 is Rs. 15.2 Cr, well above the Rs. 5 Cr threshold (3.04x).'),
      e('eligible', 0.95, '30000000', 'INR',
        'is solvent to the extent of Rs. 3,00,00,000 (Rupees Three Crore Only)',
        '03-solvency-certificate.pdf', 1,
        'SBI Connaught Place certified solvency of Rs. 3 Cr exceeds the Rs. 2 Cr requirement.'),
      e('eligible', 0.96, '1600000', 'INR',
        'EMD ... Rs. 16,00,000 (Rupees Sixteen Lakh Only) ... HDFC Bank Guarantee BG/2026/04/0119',
        '08-emd-bank-guarantee.pdf', 1,
        'HDFC Bank Guarantee BG/2026/04/0119 dated 05-04-2026 for Rs. 16 Lakh matches the EMD requirement exactly.'),
      e('eligible', 0.93, '5 projects, all > Rs. 2 Cr in 7 yrs', 'count',
        '5 similar institutional projects: ITBP Barrack Leh (Rs. 4.8 Cr, 2024), CISF Office Jaipur (Rs. 6.2 Cr, 2023), BSF Jaisalmer (Rs. 3.9 Cr, 2022)...',
        '07-projects-list.pdf', 1,
        'Five completed institutional projects in the last 7 years, each above Rs. 2 Cr — exceeds the minimum of three.'),
      e('eligible', 0.95, '15 years', 'years',
        'Date of Incorporation: 15-03-2010 (16 years in operation)',
        '06-pan-card.pdf', 1,
        'Incorporated 15-03-2010, giving over 15 years of construction experience as on bid date — well above 5-year minimum.'),
      e('eligible', 0.96, 'GSTIN 07AABCS1234A1Z5 ACTIVE', 'boolean',
        'GSTIN: 07AABCS1234A1Z5 ... Status: ACTIVE — verified on 10-04-2026',
        '04-gst-registration-certificate.pdf', 1,
        'Active GST registration verified within 5 days of bid submission date.'),
      e('eligible', 0.94, 'ISO 9001:2015 valid till 11-08-2028', 'date',
        'Bureau Veritas BV-IN-2023-9001-77821 ... Date of Expiry: 11-08-2028',
        '05-iso-9001-certificate.pdf', 1,
        'ISO 9001:2015 certificate from Bureau Veritas valid until Aug 2028, well past the bid date.'),
      e('eligible', 0.98, 'AABCS1234A', 'text',
        'Permanent Account Number: AABCS1234A',
        '06-pan-card.pdf', 1,
        'PAN card of the firm submitted; format and check digits valid.'),
      e('eligible', 0.92, 'ISO 14001:2015 valid till 30-04-2027', 'date',
        'BV-IN-2024-14001-44120 ... ISO 14001:2015 ... Date of Expiry: 30-04-2027',
        '05b-iso-14001-certificate.pdf', 1,
        'Bidder holds the optional ISO 14001:2015 environmental management certification — bonus weightage applies.'),
      e('eligible', 0.93, '5 paramilitary projects', 'count',
        'CISF Office Complex Jaipur, BSF Family Quarters Jaisalmer, CRPF Mess Hall Hazaribagh, ITBP Barrack Leh',
        '07-projects-list.pdf', 1,
        'Strong track record of CRPF/CISF/BSF/ITBP construction projects — bidder qualifies for the optional paramilitary preference.'),
    ],
  },

  // ---- Gupta Builders (not_eligible — financials below) ----
  {
    matchKeys: ['gupta'],
    evaluations: [
      e('not_eligible', 0.93, '34000000', 'INR',
        'FY 2024-25: Rs. 3,40,00,000 ... FY 2023-24: Rs. 3,10,00,000 ... FY 2022-23: Rs. 2,80,00,000',
        '02-ca-turnover-certificate.pdf', 1,
        'Highest annual turnover (Rs. 3.4 Cr in FY 2024-25) is below the Rs. 5 Cr mandatory threshold. Fails C-1.'),
      e('not_eligible', 0.91, '15000000', 'INR',
        'is solvent to the extent of Rs. 1,50,00,000 (Rupees One Crore Fifty Lakh Only)',
        '03-solvency-certificate.pdf', 1,
        'PNB-certified solvency of Rs. 1.5 Cr is below the Rs. 2 Cr minimum. Fails C-2.'),
      e('eligible', 0.95, '1600000', 'INR',
        'PNB Bank Guarantee BG No. PNB/BG/2026/0455 dated 08-04-2026 for Rs. 16,00,000',
        '08-emd-bank-guarantee.pdf', 1,
        'EMD of Rs. 16 Lakh submitted via PNB Bank Guarantee — meets requirement.'),
      e('eligible', 0.86, '4 projects, all > Rs. 2 Cr in 7 yrs', 'count',
        'Apartment Block Faridabad Rs. 2.4 Cr (2023); PHC Rohtak Rs. 2.1 Cr (2022); School Karnal Rs. 2.6 Cr (2021); Community Hall Sonipat Rs. 2.15 Cr (2020)',
        '07-projects-list.pdf', 1,
        'Four similar projects within last 7 years, all above Rs. 2 Cr.'),
      e('eligible', 0.94, '8 years', 'years',
        'Date of Establishment: 01-08-2017',
        '06-pan-card.pdf', 1,
        'Established 2017, ~8 years of construction experience — exceeds 5-year minimum.'),
      e('eligible', 0.95, 'GSTIN 07AAFFG7654B1ZK ACTIVE', 'boolean',
        'GSTIN: 07AAFFG7654B1ZK ... Status: ACTIVE',
        '04-gst-registration-certificate.pdf', 1,
        'GST registration is active.'),
      e('eligible', 0.92, 'ISO 9001:2015 valid till 30-04-2027', 'date',
        'TUV-IN-2024-90001-66312 ... Date of Expiry: 30-04-2027',
        '05-iso-9001-certificate.pdf', 1,
        'TUV India ISO 9001:2015 certificate valid till April 2027.'),
      e('eligible', 0.97, 'AAFFG7654B', 'text',
        'PAN: AAFFG7654B',
        '06-pan-card.pdf', 1,
        'PAN card of the firm submitted; valid format.'),
      e('not_eligible', 0.7, 'Not provided', 'boolean',
        '',
        '', 0,
        'No ISO 14001 certificate found in submitted documents.'),
      e('not_eligible', 0.8, 'No paramilitary projects in list', 'count',
        'Apartment, PHC, School, Community Hall — all civilian local-government projects',
        '07-projects-list.pdf', 1,
        'No CRPF / BSF / ITBP / SSB / CISF or armed-forces project history in the submitted projects list.'),
    ],
  },

  // ---- National Infrastructure Corp (needs_review) ----
  {
    matchKeys: ['national', 'infrastructure'],
    evaluations: [
      e('needs_review', 0.62, '72000000 (provisional)', 'INR',
        'FY 2024-25: Rs. 7,20,00,000 — Note: figures provisional, audit in progress',
        '02-ca-turnover-certificate.pdf', 1,
        'FY 2024-25 turnover of Rs. 7.2 Cr would meet the Rs. 5 Cr threshold but the CA flags the figure as provisional pending audit. Needs verification.'),
      e('eligible', 0.84, '25000000', 'INR',
        'M/s National Infrastructure Corp is solvent to the extent of Rs. 2,50,00,000',
        '03-solvency-certificate.pdf', 1,
        'BoB Sector-18 Noida certified solvency of Rs. 2.5 Cr meets the Rs. 2 Cr requirement; certificate is within 6-month validity window.'),
      e('eligible', 0.91, '1600000', 'INR',
        'Demand Draft No. BOB/DD/2026/04/0231 ... Rs. 16,00,000',
        '08-emd-bank-guarantee.pdf', 1,
        'EMD of Rs. 16 Lakh submitted via Bank of Baroda Demand Draft.'),
      e('needs_review', 0.55, '3 projects with one borderline',
        'count',
        'PWD Rest House Allahabad — Completed 30-09-2018 (note: just outside the 7-year window relative to bid date 15-04-2026)',
        '07-projects-list.pdf', 1,
        'Three similar projects listed but the 2018 PWD project is borderline outside the 7-year window. Needs human review of date interpretation.'),
      e('needs_review', 0.65, '6 years 5 months', 'years',
        'Date of Incorporation: 20-11-2019 (about 6 years 5 months as on bid date)',
        '06-pan-card.pdf', 1,
        'Experience of ~6.5 years exceeds the 5-year minimum — eligible on numbers, but cover letter notes audit pending; flagging for due diligence.'),
      e('needs_review', 0.6, 'GSTIN 09AAACN9876C1Z2 (verification partial)', 'boolean',
        'GSTIN: 09AAACN9876C1Z2 ... Status: ACTIVE (verification partial — see note)',
        '04-gst-registration-certificate.pdf', 1,
        'GST appears active but the bidder flags partial verification. Needs verification on GSTN portal.'),
      e('needs_review', 0.45, 'ISO 9001:2015 expires on bid date', 'date',
        'Date of Expiry: 15-04-2026 ... NOTE: This certificate expires on the date of bid submission itself.',
        '05-iso-9001-certificate.pdf', 1,
        'ISO 9001:2015 certificate expires on the bid submission date itself — edge case requiring human judgement on whether "valid as on date" includes the expiry date.'),
      e('eligible', 0.95, 'AAACN9876C', 'text',
        'PAN: AAACN9876C',
        '06-pan-card.pdf', 1,
        'PAN card of the firm submitted; valid format.'),
      e('not_eligible', 0.7, 'Not provided', 'boolean',
        '',
        '', 0,
        'No ISO 14001 certificate found in submitted documents.'),
      e('not_eligible', 0.7, 'No paramilitary projects in list', 'count',
        'UP Govt Office, Boys Hostel BHU, PWD Rest House — civilian projects',
        '07-projects-list.pdf', 1,
        'No paramilitary or armed-forces construction history in the submitted list.'),
    ],
  },

  // ---- Apex Constructions (eligible) ----
  {
    matchKeys: ['apex'],
    evaluations: [
      e('eligible', 0.98, '180000000', 'INR',
        'FY 2024-25: Rs. 18,00,00,000 (Rupees Eighteen Crore Only)',
        '02-ca-turnover-certificate.pdf', 1,
        'CA-certified FY 2024-25 turnover of Rs. 18 Cr is 3.6x the Rs. 5 Cr threshold.'),
      e('eligible', 0.97, '40000000', 'INR',
        'is solvent to the extent of Rs. 4,00,00,000 (Rupees Four Crore Only)',
        '03-solvency-certificate.pdf', 1,
        'ICICI Mumbai Main certified solvency of Rs. 4 Cr is 2x the Rs. 2 Cr requirement.'),
      e('eligible', 0.96, '1600000', 'INR',
        'ICICI Bank Guarantee BG/2026/04/0341 dated 04-04-2026 for Rs. 16,00,000',
        '08-emd-bank-guarantee.pdf', 1,
        'EMD of Rs. 16 Lakh via ICICI Bank Guarantee — matches requirement.'),
      e('eligible', 0.96, '7 paramilitary/defence projects in 7 yrs, all > Rs. 2 Cr', 'count',
        'IAF HQ Pune Rs. 8.9 Cr (2024); Naval Mess Vizag Rs. 6.4 Cr (2023); CRPF Group Centre Avadi Rs. 9.2 Cr (2022); CISF HQ Annexe Gurugram Rs. 5.8 Cr (2021)...',
        '07-projects-list.pdf', 1,
        'Seven completed paramilitary / defence projects, all above Rs. 2 Cr — strongly exceeds three-project minimum.'),
      e('eligible', 0.96, '15 years', 'years',
        'Date of Incorporation: 25-08-2010',
        '06-pan-card.pdf', 1,
        'Incorporated August 2010, ~15 years construction experience — well above 5-year minimum.'),
      e('eligible', 0.97, 'GSTIN 27AAACA5566D1Z9 ACTIVE', 'boolean',
        'GSTIN: 27AAACA5566D1Z9 ... Status: ACTIVE',
        '04-gst-registration-certificate.pdf', 1,
        'Active GST registration on Maharashtra state code.'),
      e('eligible', 0.95, 'ISO 9001:2015 valid till 31-05-2027', 'date',
        'DNV-9001-2024-02112 ... Date of Expiry: 31-05-2027',
        '05-iso-9001-certificate.pdf', 1,
        'DNV-GL India ISO 9001:2015 certificate valid until May 2027.'),
      e('eligible', 0.98, 'AAACA5566D', 'text',
        'PAN: AAACA5566D',
        '06-pan-card.pdf', 1,
        'PAN card of the firm submitted; valid format.'),
      e('not_eligible', 0.6, 'Not provided', 'boolean',
        '',
        '', 0,
        'No ISO 14001 certificate found in submitted documents (preferred criterion).'),
      e('eligible', 0.97, '7 paramilitary/defence projects', 'count',
        'IAF Station HQ Pune; Naval Officers Mess Visakhapatnam; CRPF Group Centre Avadi; CISF HQ Annexe; BSF Hospital; SSB Training Centre; Coast Guard Quarters',
        '07-projects-list.pdf', 1,
        'Extensive paramilitary and armed-forces construction history including direct CRPF work — strong fit for preferred criterion.'),
    ],
  },

  // ---- Metro Build Solutions (not_eligible — ISO expired) ----
  {
    matchKeys: ['metro'],
    evaluations: [
      e('eligible', 0.93, '62000000', 'INR',
        'FY 2024-25: Rs. 6,20,00,000',
        '02-ca-turnover-certificate.pdf', 1,
        'CA-certified FY 2024-25 turnover of Rs. 6.2 Cr exceeds the Rs. 5 Cr threshold.'),
      e('eligible', 0.92, '20000000', 'INR',
        'Solvency: Rs. 2,00,00,000 (Rupees Two Crore Only)',
        '03-solvency-certificate.pdf', 1,
        'Axis Bank Civil Lines certified solvency of Rs. 2 Cr meets the Rs. 2 Cr minimum exactly.'),
      e('eligible', 0.93, '1600000', 'INR',
        'Demand Draft No. AXIS/DD/2026/04/0099 ... Rs. 16,00,000',
        '08-emd-bank-guarantee.pdf', 1,
        'EMD of Rs. 16 Lakh submitted via Axis Bank Demand Draft.'),
      e('eligible', 0.86, '3 projects > Rs. 2 Cr in 7 yrs', 'count',
        'PWD Office Nagpur Rs. 2.3 Cr (2024); Polytechnic Workshop Nashik Rs. 2.9 Cr (2023); Bus Depot Aurangabad Rs. 2.15 Cr (2022)',
        '07-projects-list.pdf', 1,
        'Three completed institutional projects, all above Rs. 2 Cr — meets minimum of three exactly.'),
      e('eligible', 0.94, '7 years', 'years',
        'Date of Incorporation: 12-04-2018',
        '06-pan-card.pdf', 1,
        'Incorporated April 2018, ~7 years construction experience — exceeds 5-year minimum.'),
      e('eligible', 0.95, 'GSTIN 27AAACM3344E1Z3 ACTIVE', 'boolean',
        'GSTIN: 27AAACM3344E1Z3 ... Status: ACTIVE',
        '04-gst-registration-certificate.pdf', 1,
        'Active GST registration on Maharashtra state code.'),
      e('not_eligible', 0.95, 'ISO 9001:2015 EXPIRED 30-06-2025', 'date',
        'Date of Expiry: 30-06-2025 ... NOTE: This certificate has LAPSED. Renewal application filed but not yet completed.',
        '05-iso-9001-certificate.pdf', 1,
        'ISO 9001:2015 certificate expired on 30-06-2025, ~9 months before bid submission date 15-04-2026. Fails C-7 (must be valid as on date of bid submission).'),
      e('eligible', 0.97, 'AAACM3344E', 'text',
        'PAN: AAACM3344E',
        '06-pan-card.pdf', 1,
        'PAN card of the firm submitted; valid format.'),
      e('not_eligible', 0.6, 'Not provided', 'boolean',
        '',
        '', 0,
        'No ISO 14001 certificate found in submitted documents.'),
      e('not_eligible', 0.7, 'No paramilitary projects in list', 'count',
        'PWD Office, Polytechnic, Bus Depot — state-government civil projects',
        '07-projects-list.pdf', 1,
        'No CRPF / BSF / ITBP / armed-forces construction history in submitted list.'),
    ],
  },
];

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function getDemoEvaluationsForBidder(
  bidderName: string,
): CachedEvaluation[] | null {
  const target = normalize(bidderName);
  for (const cached of DEMO_BIDDERS) {
    for (const k of cached.matchKeys) {
      if (target.includes(normalize(k))) return cached.evaluations;
    }
  }
  return null;
}

export function genericNeedsReview(criterion_code: string): CachedEvaluation {
  return {
    status: 'needs_review',
    found_value: '',
    found_unit: 'text',
    confidence: 0.4,
    evidence_text: '',
    evidence_doc: '',
    evidence_page: 0,
    reasoning: `[demo mode] No cached response available for ${criterion_code}.`,
  };
}
