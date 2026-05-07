import { useCallback } from 'react';
import { supabase, uploadToStorage } from '../config/supabase';
import { useEvaluationStore } from '../store/evaluation-store';
import { logAuditEvent } from '../lib/audit-logger';
import { parseTenderDocument } from '../lib/tender-parser';
import { sha256OfFile } from '../lib/pdf-utils';
import {
  getActiveTenderId,
  setActiveTenderId as persistActiveId,
} from '../lib/active-tender';
import type { Bidder, Criterion, Evaluation, Tender } from '../types';

export interface TenderSummary extends Tender {
  criteria_count: number;
  bidders_count: number;
  evaluations_count: number;
}

export function useTender() {
  const {
    setTender,
    setCriteria,
    setBidders,
    setEvaluations,
    setPipelineStage,
    setIsProcessing,
    resetPipeline,
    clearAll,
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
        persistActiveId(tender.id);
        setPipelineStage('ingest', 'done');

        await logAuditEvent({
          event_type: 'tender_uploaded',
          entity_type: 'tender',
          entity_id: tender.id,
          payload: {
            name,
            file_path: path,
            file_hash: fileHash,
            file_size: file.size,
          },
        });

        setPipelineStage('extract', 'active');
        const { criteria, rawResponse } = await parseTenderDocument(file, name);
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
      payload: {
        criterion_code: criterion.criterion_code,
        new_description: criterion.description,
      },
    });
  }, []);

  const listTenders = useCallback(async (): Promise<TenderSummary[]> => {
    const { data: tenders, error } = await supabase
      .from('tenders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const list = (tenders || []) as Tender[];
    if (list.length === 0) return [];

    const ids = list.map((t) => t.id);
    const [{ data: critCounts }, { data: bidCounts }, { data: evalCounts }] =
      await Promise.all([
        supabase.from('criteria').select('tender_id').in('tender_id', ids),
        supabase.from('bidders').select('tender_id').in('tender_id', ids),
        supabase.from('evaluations').select('tender_id').in('tender_id', ids),
      ]);

    const count = (rows: Array<{ tender_id: string }> | null | undefined, id: string) =>
      (rows || []).filter((r) => r.tender_id === id).length;

    return list.map((t) => ({
      ...t,
      criteria_count: count(critCounts as any, t.id),
      bidders_count: count(bidCounts as any, t.id),
      evaluations_count: count(evalCounts as any, t.id),
    }));
  }, []);

  const loadTenderById = useCallback(
    async (tenderId: string) => {
      const { data: tender } = await supabase
        .from('tenders')
        .select('*')
        .eq('id', tenderId)
        .single();
      if (!tender) return null;

      setTender(tender as Tender);

      const [{ data: criteria }, { data: bidders }, { data: evals }] = await Promise.all([
        supabase.from('criteria').select('*').eq('tender_id', tenderId).order('criterion_code'),
        supabase.from('bidders').select('*').eq('tender_id', tenderId).order('created_at'),
        supabase
          .from('evaluations')
          .select('*, criterion:criteria(*)')
          .eq('tender_id', tenderId),
      ]);
      setCriteria((criteria || []) as Criterion[]);
      setBidders((bidders || []) as Bidder[]);
      setEvaluations((evals || []) as Evaluation[]);
      return tender as Tender;
    },
    [setTender, setCriteria, setBidders, setEvaluations],
  );

  const setActiveTender = useCallback(
    async (tenderId: string | null) => {
      if (!tenderId) {
        persistActiveId(null);
        clearAll();
        return null;
      }
      persistActiveId(tenderId);
      return await loadTenderById(tenderId);
    },
    [clearAll, loadTenderById],
  );

  const loadActiveTender = useCallback(async () => {
    const id = getActiveTenderId();
    if (!id) return null;
    try {
      const t = await loadTenderById(id);
      if (!t) persistActiveId(null);
      return t;
    } catch {
      return null;
    }
  }, [loadTenderById]);

  const deleteTender = useCallback(
    async (tenderId: string, tenderName: string) => {
      // Audit BEFORE delete so we still have the entity_id reference.
      await logAuditEvent({
        event_type: 'tender_deleted',
        entity_type: 'tender',
        entity_id: tenderId,
        payload: { name: tenderName, deleted_at: new Date().toISOString() },
      });

      // Best-effort: clean up storage too. We list everything under the tender
      // path prefix and remove. Failures here don't block the row delete.
      try {
        const { data: tender } = await supabase
          .from('tenders')
          .select('file_path')
          .eq('id', tenderId)
          .single();
        const tenderPath = (tender as { file_path?: string } | null)?.file_path;
        if (tenderPath) {
          await supabase.storage.from('documents').remove([tenderPath]);
        }
        const { data: bidders } = await supabase
          .from('bidders')
          .select('documents')
          .eq('tender_id', tenderId);
        const docPaths: string[] = [];
        for (const b of (bidders || []) as Array<{ documents?: Array<{ file_path: string }> }>) {
          for (const d of b.documents || []) {
            if (d.file_path) docPaths.push(d.file_path);
          }
        }
        if (docPaths.length) {
          // Supabase removes up to ~100 at a time; chunk just in case.
          for (let i = 0; i < docPaths.length; i += 100) {
            await supabase.storage.from('documents').remove(docPaths.slice(i, i + 100));
          }
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Storage cleanup failed (rows will still be deleted):', e);
      }

      const { error } = await supabase.from('tenders').delete().eq('id', tenderId);
      if (error) throw error;

      // If the deleted tender was active, clear active.
      if (getActiveTenderId() === tenderId) {
        persistActiveId(null);
        clearAll();
      }
    },
    [clearAll],
  );

  // Backward-compat aliases — older pages still call these names.
  const loadTender = loadTenderById;
  const loadLatestTender = loadActiveTender;

  return {
    uploadAndProcessTender,
    verifyAllCriteria,
    updateCriterion,
    listTenders,
    loadTenderById,
    loadActiveTender,
    setActiveTender,
    deleteTender,
    loadTender,
    loadLatestTender,
  };
}
