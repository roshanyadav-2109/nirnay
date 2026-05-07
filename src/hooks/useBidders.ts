import { useCallback } from 'react';
import { supabase, uploadToStorage } from '../config/supabase';
import { useEvaluationStore } from '../store/evaluation-store';
import { logAuditEvent } from '../lib/audit-logger';
import { evaluateCriterion } from '../lib/bid-analyzer';
import { computeOverallVerdict } from '../lib/verdict-engine';
import { sha256OfFile } from '../lib/pdf-utils';
import type { Bidder, BidderDocument, Criterion, Evaluation } from '../types';

export interface NewBidderInput {
  name: string;
  files: File[];
}

export function useBidders() {
  const {
    upsertBidder,
    setBidders,
    setEvaluations,
    upsertEvaluation,
    setPipelineStage,
    setIsProcessing,
  } = useEvaluationStore();

  const addBidder = useCallback(
    async (tenderId: string, input: NewBidderInput): Promise<Bidder> => {
      const docs: BidderDocument[] = [];
      for (const file of input.files) {
        const hash = await sha256OfFile(file);
        const path = `bidders/${tenderId}/${input.name}/${file.name}`;
        await uploadToStorage(file, path);
        docs.push({
          name: file.name,
          file_path: path,
          file_hash: hash,
          type: file.type || 'application/pdf',
          size: file.size,
        });
      }

      const { data, error } = await supabase
        .from('bidders')
        .insert({
          tender_id: tenderId,
          name: input.name,
          documents: docs,
          status: 'uploaded',
        })
        .select()
        .single();
      if (error) throw error;
      const bidder = data as Bidder;
      upsertBidder(bidder);

      await logAuditEvent({
        event_type: 'bidder_uploaded',
        entity_type: 'bidder',
        entity_id: bidder.id,
        payload: { name: input.name, doc_count: docs.length },
      });

      return bidder;
    },
    [upsertBidder],
  );

  const evaluateBidder = useCallback(
    async (bidder: Bidder, criteria: Criterion[]): Promise<Evaluation[]> => {
      const updated: Bidder = { ...bidder, status: 'processing' };
      upsertBidder(updated);
      await supabase.from('bidders').update({ status: 'processing' }).eq('id', bidder.id);

      await logAuditEvent({
        event_type: 'evaluation_started',
        entity_type: 'bidder',
        entity_id: bidder.id,
        actor: 'system',
        payload: { criterion_count: criteria.length },
      });

      const results: Evaluation[] = [];
      for (const criterion of criteria) {
        try {
          const { evaluation, rawResponse } = await evaluateCriterion({
            criterion,
            documents: bidder.documents,
          });

          const { data: insertedEval, error } = await supabase
            .from('evaluations')
            .insert({
              bidder_id: bidder.id,
              criterion_id: criterion.id,
              tender_id: bidder.tender_id,
              status: evaluation.status,
              found_value: evaluation.found_value || null,
              found_unit: evaluation.found_unit || null,
              confidence: evaluation.confidence,
              evidence_text: evaluation.evidence_text || null,
              evidence_doc: evaluation.evidence_doc || null,
              evidence_page: evaluation.evidence_page ?? null,
              reasoning: evaluation.reasoning,
              llm_raw_response: { raw: rawResponse.slice(0, 2000) },
              human_override: false,
            })
            .select()
            .single();
          if (error) throw error;
          const evalRow = { ...(insertedEval as Evaluation), criterion };
          results.push(evalRow);
          upsertEvaluation(evalRow);
        } catch (err) {
          const fallback: Partial<Evaluation> = {
            bidder_id: bidder.id,
            criterion_id: criterion.id,
            tender_id: bidder.tender_id,
            status: 'needs_review',
            confidence: 0.3,
            reasoning: `Evaluation failed: ${(err as Error).message}. Marked as needs_review for human inspection.`,
            human_override: false,
          };
          const { data: insertedEval } = await supabase
            .from('evaluations')
            .insert(fallback)
            .select()
            .single();
          if (insertedEval) {
            const evalRow = { ...(insertedEval as Evaluation), criterion };
            results.push(evalRow);
            upsertEvaluation(evalRow);
          }
        }
      }

      const overall = computeOverallVerdict(results);
      const { data: updatedBidder } = await supabase
        .from('bidders')
        .update({ status: 'evaluated', overall_verdict: overall.status })
        .eq('id', bidder.id)
        .select()
        .single();
      if (updatedBidder) upsertBidder(updatedBidder as Bidder);

      await logAuditEvent({
        event_type: 'evaluation_completed',
        entity_type: 'bidder',
        entity_id: bidder.id,
        actor: 'system',
        payload: {
          overall_verdict: overall.status,
          passed: overall.passedCount,
          failed: overall.failedCount,
          review: overall.reviewCount,
        },
      });

      await logAuditEvent({
        event_type: 'verdict_produced',
        entity_type: 'bidder',
        entity_id: bidder.id,
        actor: 'system',
        payload: {
          status: overall.status,
          confidence: overall.confidence,
          reasoning: overall.reasoning,
        },
      });

      return results;
    },
    [upsertBidder, upsertEvaluation],
  );

  const evaluateAll = useCallback(
    async (bidders: Bidder[], criteria: Criterion[]) => {
      setPipelineStage('match', 'active');
      setIsProcessing(true);
      try {
        for (const bidder of bidders) {
          await evaluateBidder(bidder, criteria);
        }
        setPipelineStage('match', 'done');
        setPipelineStage('verdict', 'done');
      } finally {
        setIsProcessing(false);
      }
    },
    [evaluateBidder, setIsProcessing, setPipelineStage],
  );

  const overrideVerdict = useCallback(
    async (
      evaluation: Evaluation,
      newStatus: Evaluation['status'],
      reason: string,
      actor?: string,
    ): Promise<Evaluation> => {
      const { data, error } = await supabase
        .from('evaluations')
        .update({
          status: newStatus,
          human_override: true,
          human_override_reason: reason,
          human_override_by: actor,
          human_override_at: new Date().toISOString(),
        })
        .eq('id', evaluation.id)
        .select()
        .single();
      if (error) throw error;
      const updated = { ...(data as Evaluation), criterion: evaluation.criterion };
      upsertEvaluation(updated);

      await logAuditEvent({
        event_type: 'verdict_overridden',
        entity_type: 'evaluation',
        entity_id: evaluation.id,
        actor,
        payload: {
          previous_status: evaluation.status,
          new_status: newStatus,
          reason,
          bidder_id: evaluation.bidder_id,
          criterion_id: evaluation.criterion_id,
        },
      });

      const { data: peerEvals } = await supabase
        .from('evaluations')
        .select('*, criterion:criteria(*)')
        .eq('bidder_id', evaluation.bidder_id);
      const overall = computeOverallVerdict((peerEvals || []) as Evaluation[]);
      const { data: bidderRow } = await supabase
        .from('bidders')
        .update({ overall_verdict: overall.status })
        .eq('id', evaluation.bidder_id)
        .select()
        .single();
      if (bidderRow) upsertBidder(bidderRow as Bidder);

      return updated;
    },
    [upsertBidder, upsertEvaluation],
  );

  const loadBiddersForTender = useCallback(
    async (tenderId: string) => {
      const { data: bidders } = await supabase
        .from('bidders')
        .select('*')
        .eq('tender_id', tenderId)
        .order('created_at', { ascending: true });
      setBidders((bidders || []) as Bidder[]);

      const { data: evals } = await supabase
        .from('evaluations')
        .select('*, criterion:criteria(*)')
        .eq('tender_id', tenderId);
      setEvaluations((evals || []) as Evaluation[]);
    },
    [setBidders, setEvaluations],
  );

  const deleteBidder = useCallback(
    async (bidder: Bidder) => {
      await logAuditEvent({
        event_type: 'bidder_deleted',
        entity_type: 'bidder',
        entity_id: bidder.id,
        payload: {
          name: bidder.name,
          tender_id: bidder.tender_id,
          doc_count: bidder.documents.length,
        },
      });

      // Try to clean up the bidder's documents from storage.
      try {
        const paths = bidder.documents.map((d) => d.file_path).filter(Boolean);
        if (paths.length) {
          for (let i = 0; i < paths.length; i += 100) {
            await supabase.storage.from('documents').remove(paths.slice(i, i + 100));
          }
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Bidder storage cleanup failed:', e);
      }

      const { error } = await supabase.from('bidders').delete().eq('id', bidder.id);
      if (error) throw error;

      const store = useEvaluationStore.getState();
      store.setBidders(store.bidders.filter((b) => b.id !== bidder.id));
      store.setEvaluations(store.evaluations.filter((e) => e.bidder_id !== bidder.id));
    },
    [],
  );

  return {
    addBidder,
    evaluateBidder,
    evaluateAll,
    overrideVerdict,
    loadBiddersForTender,
    deleteBidder,
  };
}
