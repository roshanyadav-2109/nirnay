-- Nirnay initial schema
-- Run this once in the Supabase SQL editor.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS tenders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    file_path TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    raw_text TEXT,
    status TEXT DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'criteria_extracted', 'evaluation_complete')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS criteria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tender_id UUID REFERENCES tenders(id) ON DELETE CASCADE,
    criterion_code TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('technical', 'financial', 'compliance', 'document')),
    description TEXT NOT NULL,
    is_mandatory BOOLEAN DEFAULT true,
    rule_type TEXT NOT NULL CHECK (rule_type IN ('numeric_threshold', 'boolean_presence', 'date_validity', 'document_required', 'semantic_match')),
    parameters JSONB NOT NULL DEFAULT '{}',
    source_text TEXT,
    source_page INTEGER,
    human_verified BOOLEAN DEFAULT false,
    human_edited BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bidders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tender_id UUID REFERENCES tenders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    documents JSONB DEFAULT '[]',
    status TEXT DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'evaluated')),
    overall_verdict TEXT CHECK (overall_verdict IN ('eligible', 'not_eligible', 'needs_review')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bidder_id UUID REFERENCES bidders(id) ON DELETE CASCADE,
    criterion_id UUID REFERENCES criteria(id) ON DELETE CASCADE,
    tender_id UUID REFERENCES tenders(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('eligible', 'not_eligible', 'needs_review')),
    found_value TEXT,
    found_unit TEXT,
    confidence NUMERIC(3,2) CHECK (confidence >= 0 AND confidence <= 1),
    evidence_text TEXT,
    evidence_doc TEXT,
    evidence_page INTEGER,
    reasoning TEXT NOT NULL,
    llm_raw_response JSONB,
    human_override BOOLEAN DEFAULT false,
    human_override_reason TEXT,
    human_override_by TEXT,
    human_override_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    actor TEXT NOT NULL DEFAULT 'system',
    payload JSONB NOT NULL DEFAULT '{}',
    prev_hash TEXT,
    event_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_evaluations_bidder ON evaluations(bidder_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_criterion ON evaluations(criterion_id);
CREATE INDEX IF NOT EXISTS idx_criteria_tender ON criteria(tender_id);
CREATE INDEX IF NOT EXISTS idx_bidders_tender ON bidders(tender_id);

ALTER TABLE tenders ENABLE ROW LEVEL SECURITY;
ALTER TABLE criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE bidders ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for tenders" ON tenders;
DROP POLICY IF EXISTS "Allow all for criteria" ON criteria;
DROP POLICY IF EXISTS "Allow all for bidders" ON bidders;
DROP POLICY IF EXISTS "Allow all for evaluations" ON evaluations;
DROP POLICY IF EXISTS "Allow all for audit_log" ON audit_log;

CREATE POLICY "Allow all for tenders" ON tenders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for criteria" ON criteria FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for bidders" ON bidders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for evaluations" ON evaluations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for audit_log" ON audit_log FOR ALL USING (true) WITH CHECK (true);
