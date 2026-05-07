import { callGemini, parseJsonResponse } from '../config/gemini';
import { fileToBase64 } from './pdf-utils';
import type { Criterion, ExtractedCriteria } from '../types';

const CRITERIA_EXTRACTION_PROMPT = `You are an expert Indian government procurement analyst. You are reading a tender document.

Extract ALL eligibility criteria from this tender document. Focus on:
1. ELIGIBILITY CRITERIA section
2. MINIMUM QUALIFICATION REQUIREMENTS (MQR)
3. PRE-QUALIFICATION conditions
4. Any "shall", "must", "mandatory", "essential" requirements scattered in the document
5. Document submission requirements
6. Financial thresholds (turnover, net worth, solvency)
7. Technical requirements (experience, similar projects, certifications)
8. Compliance requirements (GST, PAN, ISO, licenses)

For each criterion, output this EXACT JSON structure:
{
  "criteria": [
    {
      "criterion_code": "C-1",
      "category": "financial",
      "description": "Clear one-line description",
      "is_mandatory": true,
      "rule_type": "numeric_threshold",
      "parameters": {
        "field": "annual_turnover",
        "operator": ">=",
        "value": 50000000,
        "unit": "INR"
      },
      "source_text": "Exact quote from tender (max 200 chars)",
      "source_page": 4
    }
  ]
}

ENUMS:
- category: "technical" | "financial" | "compliance" | "document"
- rule_type: "numeric_threshold" | "boolean_presence" | "date_validity" | "document_required" | "semantic_match"
- operator (only for numeric_threshold): ">=" | "<=" | "==" | ">" | "<"

RULES:
- Normalize ALL Indian currency to base INR units: "Rs. 5 Cr" = 50000000, "Rs. 50 Lakh" = 5000000, "Rs. 5,00,00,000" = 50000000
- For "similar projects" or experience requirements, use rule_type "semantic_match" and put the qualifying description in parameters.match_text
- For "X years of experience" use rule_type "numeric_threshold" with field="years_of_experience", unit="years"
- Mark is_mandatory=true if the tender uses "shall", "must", "mandatory", "essential", "required"
- Mark is_mandatory=false if the tender uses "preferred", "desirable", "advantageous"
- If a requirement says "valid as on date of bid submission", set parameters.reference_date to "bid_submission_date"
- For document submission requirements (PAN, EMD receipt, etc.), use rule_type "document_required" with parameters.document_name
- Number the criteria sequentially starting at C-1
- NEVER invent criteria not in the document
- Output ONLY valid JSON, no markdown, no explanation, no preamble.`;

export interface TenderParseResult {
  criteria: Array<
    Omit<
      Criterion,
      'id' | 'tender_id' | 'human_verified' | 'human_edited' | 'created_at'
    >
  >;
  rawResponse: string;
}

export async function parseTenderDocument(file: File): Promise<TenderParseResult> {
  const pdfBase64 = await fileToBase64(file);
  const mimeType = file.type || 'application/pdf';

  const raw = await callGemini({
    prompt: CRITERIA_EXTRACTION_PROMPT,
    pdfs: [{ data: pdfBase64, mimeType }],
  });

  const parsed = parseJsonResponse<ExtractedCriteria>(raw);
  if (!parsed?.criteria || !Array.isArray(parsed.criteria)) {
    throw new Error('Gemini response did not contain a valid criteria array.');
  }

  const sanitized = parsed.criteria.map((c, idx) => ({
    criterion_code: c.criterion_code || `C-${idx + 1}`,
    category: c.category,
    description: c.description,
    is_mandatory: c.is_mandatory ?? true,
    rule_type: c.rule_type,
    parameters: c.parameters || {},
    source_text: c.source_text || null,
    source_page: c.source_page ?? null,
  }));

  return { criteria: sanitized, rawResponse: raw };
}
