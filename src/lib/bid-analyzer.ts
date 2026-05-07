import { callGemini, parseJsonResponse } from '../config/gemini';
import type { BidderDocument, Criterion, EvaluationResponse } from '../types';
import { downloadFromStorage } from '../config/supabase';
import { fileToBase64 } from './pdf-utils';

const BID_EVALUATION_PROMPT = `You are evaluating a bidder's submission against a specific eligibility criterion from an Indian government tender.

CRITERION:
Code: {criterion_code}
Description: {description}
Category: {category}
Rule Type: {rule_type}
Parameters: {parameters}
Mandatory: {is_mandatory}

BIDDER DOCUMENTS PROVIDED:
The attached PDF(s) are the bidder's submission documents. Document names: {doc_names}

TASK: Evaluate whether this bidder meets the above criterion based ONLY on evidence found in the provided documents.

Output this EXACT JSON (no markdown, no preamble, valid JSON only):
{
  "status": "eligible",
  "found_value": "the actual value found, e.g. '62400000' or 'ISO 9001:2015 valid till 2027-03-15'",
  "found_unit": "INR|years|count|date|boolean|text",
  "confidence": 0.92,
  "evidence_text": "Exact text from the document that supports this verdict (max 300 chars)",
  "evidence_doc": "name of the document where evidence was found",
  "evidence_page": 1,
  "reasoning": "1-2 sentence explanation citing the evidence"
}

ENUMS:
- status: "eligible" | "not_eligible" | "needs_review"

CRITICAL RULES:
1. If you CANNOT find evidence for this criterion in any document → status="needs_review", reasoning="No evidence found in submitted documents for this criterion", confidence between 0.3 and 0.5.
2. NEVER set status="not_eligible" just because evidence is missing — that's "needs_review".
3. status="not_eligible" ONLY when you find evidence that CONTRADICTS the requirement (e.g., turnover is Rs. 3 Cr but requirement is Rs. 5 Cr).
4. For numeric comparisons: extract the number, normalize to base units (INR not Cr/Lakh, years not months), then compare.
5. For dates: compare against the tender's reference date if given, otherwise today (2026-05-07).
6. If document quality is poor or values are unclear → status="needs_review" with low confidence.
7. Confidence guide: 0.9+ = clear evidence, 0.7-0.9 = evidence found but some ambiguity, 0.5-0.7 = weak evidence, <0.5 = very uncertain.
8. Output ONLY valid JSON. No markdown. No preamble.`;

const BATCH_EVALUATION_PROMPT = `You are evaluating an Indian government tender bidder's submission against ALL of the eligibility criteria below in a single pass.

BIDDER DOCUMENTS PROVIDED:
The attached PDF(s) are the bidder's submission documents. Document names: {doc_names}

CRITERIA (evaluate each one independently):
{criteria_json}

TASK: For each criterion, evaluate whether this bidder meets it based ONLY on evidence found in the provided documents.

Output ONE JSON object with an "evaluations" array. Each entry must include the criterion_code so the consumer can map results back. Same length and same order as the criteria above.

EXACT OUTPUT SHAPE:
{
  "evaluations": [
    {
      "criterion_code": "C-1",
      "status": "eligible",
      "found_value": "the actual value found, e.g. '152000000' or 'ISO 9001:2015 valid till 2028-08-11'",
      "found_unit": "INR|years|count|date|boolean|text",
      "confidence": 0.92,
      "evidence_text": "Exact text from the document supporting the verdict (max 300 chars)",
      "evidence_doc": "name of the document where evidence was found",
      "evidence_page": 1,
      "reasoning": "1-2 sentence explanation citing the evidence"
    }
  ]
}

ENUMS:
- status: "eligible" | "not_eligible" | "needs_review"

CRITICAL RULES:
1. If you CANNOT find evidence for a criterion in any document → status="needs_review", reasoning="No evidence found in submitted documents for this criterion", confidence 0.3–0.5.
2. NEVER set status="not_eligible" just because evidence is missing — that's "needs_review".
3. status="not_eligible" ONLY when evidence CONTRADICTS the requirement (e.g., turnover is Rs. 3 Cr but requirement is Rs. 5 Cr).
4. For numeric comparisons normalise to base units (INR not Cr/Lakh, years not months) before comparing.
5. For dates compare against the tender's reference date if specified, otherwise today (2026-05-07).
6. Confidence guide: 0.9+ clear evidence, 0.7-0.9 evidence with some ambiguity, 0.5-0.7 weak, <0.5 very uncertain.
7. Each evaluation in the output array must have a criterion_code from the input. Do not invent criteria. Do not omit any.
8. Output ONLY valid JSON. No markdown. No preamble.`;

function fillPrompt(criterion: Criterion, docNames: string[]): string {
  return BID_EVALUATION_PROMPT.replace('{criterion_code}', criterion.criterion_code)
    .replace('{description}', criterion.description)
    .replace('{category}', criterion.category)
    .replace('{rule_type}', criterion.rule_type)
    .replace('{parameters}', JSON.stringify(criterion.parameters || {}))
    .replace('{is_mandatory}', String(criterion.is_mandatory))
    .replace('{doc_names}', docNames.join(', '));
}

export interface EvaluateOpts {
  criterion: Criterion;
  documents: BidderDocument[];
}

export interface EvaluateResult {
  evaluation: EvaluationResponse;
  rawResponse: string;
}

async function loadDocAsBase64(doc: BidderDocument): Promise<{
  data: string;
  mimeType: string;
}> {
  const blob = await downloadFromStorage(doc.file_path);
  const data = await fileToBase64(blob);
  const mimeType = doc.type || blob.type || 'application/pdf';
  return { data, mimeType };
}

export async function evaluateCriterion({
  criterion,
  documents,
}: EvaluateOpts): Promise<EvaluateResult> {
  if (documents.length === 0) {
    return {
      evaluation: {
        status: 'needs_review',
        confidence: 0.3,
        reasoning: 'No documents submitted by this bidder for evaluation.',
      },
      rawResponse: '',
    };
  }

  const pdfs = await Promise.all(documents.slice(0, 6).map(loadDocAsBase64));
  const prompt = fillPrompt(criterion, documents.map((d) => d.name));

  const raw = await callGemini({ prompt, pdfs });
  const parsed = parseJsonResponse<EvaluationResponse>(raw);

  if (!parsed.status || !['eligible', 'not_eligible', 'needs_review'].includes(parsed.status)) {
    return {
      evaluation: {
        status: 'needs_review',
        confidence: 0.3,
        reasoning: `LLM returned an unparseable status. Raw: ${raw.slice(0, 120)}`,
      },
      rawResponse: raw,
    };
  }

  parsed.confidence = clamp01(Number(parsed.confidence));
  if (!parsed.reasoning) parsed.reasoning = 'No reasoning provided.';

  return { evaluation: parsed, rawResponse: raw };
}

// ---------------------------------------------------------------------------
// Batch evaluator — single LLM call evaluates ALL criteria for one bidder.
// Big speed-up: 50 sequential calls -> 5 concurrent calls.
// ---------------------------------------------------------------------------

export interface BatchEvaluateOpts {
  criteria: Criterion[];
  documents: BidderDocument[];
}

export interface BatchEvaluateResult {
  evaluations: Array<EvaluationResponse & { criterion_code: string }>;
  rawResponse: string;
}

export async function evaluateAllCriteriaForBidder({
  criteria,
  documents,
}: BatchEvaluateOpts): Promise<BatchEvaluateResult> {
  if (documents.length === 0) {
    return {
      evaluations: criteria.map((c) => ({
        criterion_code: c.criterion_code,
        status: 'needs_review',
        confidence: 0.3,
        reasoning: 'No documents submitted by this bidder for evaluation.',
      })),
      rawResponse: '',
    };
  }

  const pdfs = await Promise.all(documents.slice(0, 8).map(loadDocAsBase64));
  const criteriaPayload = criteria.map((c) => ({
    criterion_code: c.criterion_code,
    description: c.description,
    category: c.category,
    rule_type: c.rule_type,
    parameters: c.parameters || {},
    is_mandatory: c.is_mandatory,
  }));

  const prompt = BATCH_EVALUATION_PROMPT.replace(
    '{criteria_json}',
    JSON.stringify(criteriaPayload, null, 2),
  ).replace('{doc_names}', documents.map((d) => d.name).join(', '));

  const raw = await callGemini({ prompt, pdfs });
  const parsed = parseJsonResponse<{
    evaluations: Array<EvaluationResponse & { criterion_code: string }>;
  }>(raw);

  if (!parsed?.evaluations || !Array.isArray(parsed.evaluations)) {
    // Fallback: produce a needs_review per criterion so we never silently fail.
    return {
      evaluations: criteria.map((c) => ({
        criterion_code: c.criterion_code,
        status: 'needs_review' as const,
        confidence: 0.3,
        reasoning: 'Batch evaluation response could not be parsed.',
      })),
      rawResponse: raw,
    };
  }

  // Match returned evaluations back to the criteria by criterion_code.
  // Anything missing => synthetic needs_review.
  const byCode = new Map<string, EvaluationResponse & { criterion_code: string }>();
  for (const ev of parsed.evaluations) {
    if (ev?.criterion_code) byCode.set(ev.criterion_code, ev);
  }

  const aligned = criteria.map((c, idx) => {
    const ev = byCode.get(c.criterion_code) ?? parsed.evaluations[idx];
    if (!ev) {
      return {
        criterion_code: c.criterion_code,
        status: 'needs_review' as const,
        confidence: 0.3,
        reasoning: 'No evaluation returned for this criterion.',
      };
    }
    return {
      criterion_code: c.criterion_code,
      status: ['eligible', 'not_eligible', 'needs_review'].includes(ev.status)
        ? ev.status
        : ('needs_review' as const),
      found_value: ev.found_value,
      found_unit: ev.found_unit,
      confidence: clamp01(Number(ev.confidence)),
      evidence_text: ev.evidence_text,
      evidence_doc: ev.evidence_doc,
      evidence_page: ev.evidence_page,
      reasoning: ev.reasoning || 'No reasoning provided.',
    };
  });

  return { evaluations: aligned, rawResponse: raw };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
