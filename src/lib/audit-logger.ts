import { supabase } from '../config/supabase';
import { getOfficerName } from './officer';
import type { AuditEvent } from '../types';

export type AuditEventType =
  | 'tender_uploaded'
  | 'tender_deleted'
  | 'criteria_extracted'
  | 'criteria_edited'
  | 'criteria_verified'
  | 'bidder_uploaded'
  | 'bidder_deleted'
  | 'evaluation_started'
  | 'evaluation_completed'
  | 'verdict_produced'
  | 'verdict_overridden'
  | 'report_generated'
  | 'audit_chain_verified'
  | 'officer_set';

export async function sha256(message: string): Promise<string> {
  const buf = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function logAuditEvent(opts: {
  event_type: AuditEventType;
  entity_type: string;
  entity_id?: string;
  actor?: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  // System events explicitly pass actor: 'system'. Otherwise we use the
  // officer name from localStorage so the audit trail is per-user.
  const actor = opts.actor || getOfficerName();
  const payload = opts.payload || {};

  const { data: lastEvent } = await supabase
    .from('audit_log')
    .select('event_hash')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  const prev_hash = lastEvent?.event_hash || '0'.repeat(64);
  const canonical = JSON.stringify({
    event_type: opts.event_type,
    entity_type: opts.entity_type,
    entity_id: opts.entity_id || null,
    actor,
    payload,
  });
  const event_hash = await sha256(prev_hash + canonical);

  const { error } = await supabase.from('audit_log').insert({
    event_type: opts.event_type,
    entity_type: opts.entity_type,
    entity_id: opts.entity_id || null,
    actor,
    payload,
    prev_hash,
    event_hash,
  });
  if (error) {
    // eslint-disable-next-line no-console
    console.error('Audit log insert failed:', error);
  }
}

// Simulate tampering by mutating the payload of one persisted audit event in-place
// (without recomputing the hash). The chain verifier should then flag this row.
// Returns the row that was tampered with so the UI can highlight it.
export async function simulateTampering(): Promise<AuditEvent | null> {
  const list = await fetchAuditEvents(50);
  // Avoid the genesis event so the demo is more interesting.
  const candidate = list.length > 1 ? list[Math.floor(list.length / 2)] : list[0];
  if (!candidate) return null;

  const tamperedPayload = {
    ...(candidate.payload || {}),
    __tampered: true,
    __tampered_at: new Date().toISOString(),
    note: 'Payload was modified directly in the database — chain hash should no longer match.',
  };

  const { data, error } = await supabase
    .from('audit_log')
    .update({ payload: tamperedPayload })
    .eq('id', candidate.id)
    .select()
    .single();
  if (error) throw error;
  return data as AuditEvent;
}

export async function fetchAuditEvents(limit = 500): Promise<AuditEvent[]> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .order('id', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data || []) as AuditEvent[];
}

export interface ChainVerificationResult {
  ok: boolean;
  total: number;
  firstBrokenIndex?: number;
  brokenEvent?: AuditEvent;
  expectedHash?: string;
}

export async function verifyAuditChain(
  events?: AuditEvent[],
): Promise<ChainVerificationResult> {
  const list = events ?? (await fetchAuditEvents(10_000));
  let prev = '0'.repeat(64);
  for (let i = 0; i < list.length; i++) {
    const ev = list[i];
    const canonical = JSON.stringify({
      event_type: ev.event_type,
      entity_type: ev.entity_type,
      entity_id: ev.entity_id || null,
      actor: ev.actor,
      payload: ev.payload,
    });
    const expected = await sha256(prev + canonical);
    if (expected !== ev.event_hash || (ev.prev_hash && ev.prev_hash !== prev)) {
      return {
        ok: false,
        total: list.length,
        firstBrokenIndex: i,
        brokenEvent: ev,
        expectedHash: expected,
      };
    }
    prev = ev.event_hash;
  }
  return { ok: true, total: list.length };
}
