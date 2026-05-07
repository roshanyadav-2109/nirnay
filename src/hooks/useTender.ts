import { useCallback } from 'react';
import { supabase, uploadToStorage } from '../config/supabase';
import { useEvaluationStore } from '../store/evaluation-store';
import { logAuditEvent } from '../lib/audit-logger';
import { parseTenderDocument } from '../lib/tender-parser';
import { sha256OfFile } from '../lib/pdf-utils';
import type { Criterion, Tender } from '../types';

export function useTender() {
  const {
    setTender,
    setCriteria,
    setPipelineStage,
    setIsProcessing,
    resetPipeline,
  } = useEvaluationStore();

  const uploadAndProcessTender = useCallback(
    async (file: File, name: string, description?: string) => {
      resetPipeline();
      setIsProcessing(true);
      try {
        setPipelineStage('ingest', 'active');
        const fileHash = await sha256OfFile(file);
        const path = `tenders/${Date.now()}-${file.name}`;
        await uploadToStorage(file, path);

        const { data: tenderRow, error: insertErr } = await supabase
          .from('tenders')
          .insert({
            name,
            description: description ?? null,
            file_path: path,
            file_hash: fileHash,
            status: 'processing',
          })
          .select()
          .single();
        if (insertErr) throw insertErr;
        const tender = tenderRow as Tender;
        setTender(tender);
        setPipelineStage('ingest', 'done');

        await logAuditEvent({
          event_type: 'tender_uploaded',
          entity_type: 'tender',
          entity_id: tender.id,
          actor: 'officer',
          payload: {
            name,
            file_path: path,
            file_hash: fileHash,
            file_size: file.size,
          },
        });

        setPipelineStage('extract', 'active');
        const { criteria, rawResponse } = await parseTenderDocument(file);
        setPipelineStage('extract', 'done');

        setPipelineStage('criteria', 'active');
        const rows = criteria.map((c) => ({
          tender_id: tender.id,
          criterion_code: c.criterion_code,
          category: c.category,
          description: c.description,
          is_mandatory: c.is_mandatory,
          rule_type: c.rule_type,
          parameters: c.parameters || {},
          source_text: c.source_text || null,
          source_page: c.source_page ?? null,
          human_verified: false,
          human_edited: false,
        }));

        const { data: insertedCriteria, error: critErr } = await supabase
          .from('criteria')
          .insert(rows)
          .select();
        if (critErr) throw critErr;
        const savedCriteria = (insertedCriteria || []) as Criterion[];
        setCriteria(savedCriteria);

        await supabase
          .from('tenders')
          .update({ status: 'criteria_extracted' })
          .eq('id', tender.id);
        setTender({ ...tender, status: 'criteria_extracted' });
        setPipelineStage('criteria', 'done');

        await logAuditEvent({
          event_type: 'criteria_extracted',
          entity_type: 'tender',
          entity_id: tender.id,
          actor: 'system',
          payload: {
            count: savedCriteria.length,
            mandatory: savedCriteria.filter((c) => c.is_mandatory).length,
            optional: savedCriteria.filter((c) => !c.is_mandatory).length,
            llm_response_excerpt: rawResponse.slice(0, 500),
          },
        });

        return { tender, criteria: savedCriteria };
      } finally {
        setIsProcessing(false);
      }
    },
    [resetPipeline, setCriteria, setIsProcessing, setPipelineStage, setTender],
  );

  const verifyAllCriteria = useCallback(async (tenderId: string) => {
    const { error } = await supabase
      .from('criteria')
      .update({ human_verified: true })
      .eq('tender_id', tenderId);
    if (error) throw error;

    await logAuditEvent({
      event_type: 'criteria_verified',
      entity_type: 'tender',
      entity_id: tenderId,
      actor: 'officer',
      payload: { verified_at: new Date().toISOString() },
    });
  }, []);

  const updateCriterion = useCallback(async (criterion: Criterion) => {
    const { error } = await supabase
      .from('criteria')
      .update({
        description: criterion.description,
        category: criterion.category,
        is_mandatory: criterion.is_mandatory,
        rule_type: criterion.rule_type,
        parameters: criterion.parameters,
        human_edited: true,
      })
      .eq('id', criterion.id);
    if (error) throw error;

    await logAuditEvent({
      event_type: 'criteria_edited',
      entity_type: 'criterion',
      entity_id: criterion.id,
      actor: 'officer',
      payload: {
        criterion_code: criterion.criterion_code,
        new_description: criterion.description,
      },
    });
  }, []);

  const loadTender = useCallback(
    async (tenderId: string) => {
      const { data: tender } = await supabase
        .from('tenders')
        .select('*')
        .eq('id', tenderId)
        .single();
      if (tender) setTender(tender as Tender);
      const { data: criteria } = await supabase
        .from('criteria')
        .select('*')
        .eq('tender_id', tenderId)
        .order('criterion_code');
      setCriteria((criteria || []) as Criterion[]);
    },
    [setTender, setCriteria],
  );

  const loadLatestTender = useCallback(async () => {
    const { data } = await supabase
      .from('tenders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      setTender(data as Tender);
      const { data: criteria } = await supabase
        .from('criteria')
        .select('*')
        .eq('tender_id', (data as Tender).id)
        .order('criterion_code');
      setCriteria((criteria || []) as Criterion[]);
      return data as Tender;
    }
    return null;
  }, [setTender, setCriteria]);

  return {
    uploadAndProcessTender,
    verifyAllCriteria,
    updateCriterion,
    loadTender,
    loadLatestTender,
  };
}
