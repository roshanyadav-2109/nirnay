import { useCallback, useEffect, useState } from 'react';
import {
  fetchAuditEvents,
  verifyAuditChain,
  ChainVerificationResult,
} from '../lib/audit-logger';
import type { AuditEvent } from '../types';

export function useAuditLog() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [verification, setVerification] = useState<ChainVerificationResult | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAuditEvents(2000);
      setEvents(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const verify = useCallback(async () => {
    const result = await verifyAuditChain(events.length ? events : undefined);
    setVerification(result);
    return result;
  }, [events]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { events, loading, verification, refresh, verify };
}
