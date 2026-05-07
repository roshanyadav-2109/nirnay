export type RuleType =
  | 'numeric_threshold'
  | 'boolean_presence'
  | 'date_validity'
  | 'document_required'
  | 'semantic_match';

export type CriterionCategory = 'technical' | 'financial' | 'compliance' | 'document';

export type VerdictStatus = 'eligible' | 'not_eligible' | 'needs_review';

export type TenderStatus =
  | 'uploaded'
  | 'processing'
  | 'criteria_extracted'
  | 'evaluation_complete';

export type BidderStatus = 'uploaded' | 'processing' | 'evaluated';

export interface CriterionParameters {
  field?: string;
  operator?: '>=' | '<=' | '==' | '>' | '<';
  value?: number;
  unit?: string;
  document_name?: string;
  reference_date?: string;
  match_text?: string;
  [key: string]: unknown;
}

export interface Tender {
  id: string;
  name: string;
  description?: string | null;
  file_path: string;
  file_hash: string;
  raw_text?: string | null;
  status: TenderStatus;
  created_at: string;
  updated_at?: string;
}

export interface Criterion {
  id: string;
  tender_id: string;
  criterion_code: string;
  category: CriterionCategory;
  description: string;
  is_mandatory: boolean;
  rule_type: RuleType;
  parameters: CriterionParameters;
  source_text?: string | null;
  source_page?: number | null;
  human_verified: boolean;
  human_edited: boolean;
  created_at?: string;
}

export interface BidderDocument {
  name: string;
  file_path: string;
  file_hash: string;
  type: string;
  size?: number;
}

export interface Bidder {
  id: string;
  tender_id: string;
  name: string;
  documents: BidderDocument[];
  status: BidderStatus;
  overall_verdict?: VerdictStatus | null;
  created_at?: string;
}

export interface Evaluation {
  id: string;
  bidder_id: string;
  criterion_id: string;
  tender_id: string;
  status: VerdictStatus;
  found_value?: string | null;
  found_unit?: string | null;
  confidence: number;
  evidence_text?: string | null;
  evidence_doc?: string | null;
  evidence_page?: number | null;
  reasoning: string;
  llm_raw_response?: Record<string, unknown> | null;
  human_override: boolean;
  human_override_reason?: string | null;
  human_override_by?: string | null;
  human_override_at?: string | null;
  criterion?: Criterion;
  created_at?: string;
}

export interface AuditEvent {
  id: number;
  event_type: string;
  entity_type: string;
  entity_id?: string | null;
  actor: string;
  payload: Record<string, unknown>;
  prev_hash?: string | null;
  event_hash: string;
  created_at: string;
}

export interface PipelineStage {
  key: 'ingest' | 'extract' | 'criteria' | 'match' | 'verdict';
  label: string;
  status: 'idle' | 'active' | 'done' | 'error';
}

export interface ExtractedCriteria {
  criteria: Array<Omit<Criterion, 'id' | 'tender_id' | 'human_verified' | 'human_edited' | 'created_at'>>;
}

export interface EvaluationResponse {
  status: VerdictStatus;
  found_value?: string;
  found_unit?: string;
  confidence: number;
  evidence_text?: string;
  evidence_doc?: string;
  evidence_page?: number;
  reasoning: string;
}
