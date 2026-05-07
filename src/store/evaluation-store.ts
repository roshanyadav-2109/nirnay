import { create } from 'zustand';
import type {
  Bidder,
  Criterion,
  Evaluation,
  PipelineStage,
  Tender,
} from '../types';

interface EvaluationState {
  tender: Tender | null;
  criteria: Criterion[];
  bidders: Bidder[];
  evaluations: Evaluation[];
  pipeline: PipelineStage[];
  isProcessing: boolean;

  setTender: (t: Tender | null) => void;
  setCriteria: (c: Criterion[]) => void;
  upsertCriterion: (c: Criterion) => void;
  removeCriterion: (id: string) => void;
  setBidders: (b: Bidder[]) => void;
  upsertBidder: (b: Bidder) => void;
  setEvaluations: (e: Evaluation[]) => void;
  upsertEvaluation: (e: Evaluation) => void;
  setPipelineStage: (key: PipelineStage['key'], status: PipelineStage['status']) => void;
  resetPipeline: () => void;
  setIsProcessing: (v: boolean) => void;
  clearAll: () => void;
}

const defaultPipeline = (): PipelineStage[] => [
  { key: 'ingest', label: 'Ingest', status: 'idle' },
  { key: 'extract', label: 'Extract', status: 'idle' },
  { key: 'criteria', label: 'Criteria', status: 'idle' },
  { key: 'match', label: 'Match', status: 'idle' },
  { key: 'verdict', label: 'Verdict', status: 'idle' },
];

export const useEvaluationStore = create<EvaluationState>((set) => ({
  tender: null,
  criteria: [],
  bidders: [],
  evaluations: [],
  pipeline: defaultPipeline(),
  isProcessing: false,

  setTender: (t) => set({ tender: t }),
  setCriteria: (c) => set({ criteria: c }),
  upsertCriterion: (c) =>
    set((s) => {
      const idx = s.criteria.findIndex((x) => x.id === c.id);
      const next = [...s.criteria];
      if (idx >= 0) next[idx] = c;
      else next.push(c);
      return { criteria: next };
    }),
  removeCriterion: (id) =>
    set((s) => ({ criteria: s.criteria.filter((c) => c.id !== id) })),
  setBidders: (b) => set({ bidders: b }),
  upsertBidder: (b) =>
    set((s) => {
      const idx = s.bidders.findIndex((x) => x.id === b.id);
      const next = [...s.bidders];
      if (idx >= 0) next[idx] = b;
      else next.push(b);
      return { bidders: next };
    }),
  setEvaluations: (e) => set({ evaluations: e }),
  upsertEvaluation: (e) =>
    set((s) => {
      const idx = s.evaluations.findIndex(
        (x) => x.bidder_id === e.bidder_id && x.criterion_id === e.criterion_id,
      );
      const next = [...s.evaluations];
      if (idx >= 0) next[idx] = e;
      else next.push(e);
      return { evaluations: next };
    }),
  setPipelineStage: (key, status) =>
    set((s) => ({
      pipeline: s.pipeline.map((stage) =>
        stage.key === key ? { ...stage, status } : stage,
      ),
    })),
  resetPipeline: () => set({ pipeline: defaultPipeline() }),
  setIsProcessing: (v) => set({ isProcessing: v }),
  clearAll: () =>
    set({
      tender: null,
      criteria: [],
      bidders: [],
      evaluations: [],
      pipeline: defaultPipeline(),
      isProcessing: false,
    }),
}));
