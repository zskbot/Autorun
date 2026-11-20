import { useCallback, useEffect, useState } from 'react';
import { PushToast, SyncQueueItem } from '../types/ops';

const SYNC_CHANNEL_NAME = 'kinetix-ops-realtime-sync';
const QUEUE_STORAGE_KEY = 'kinetix_ops_sync_queue_v1';

export function useOfflineSync() {
  const [browserOnline, setBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [simulatedOffline, setSimulatedOffline] = useState<boolean>(false);
  const [queue, setQueue] = useState<SyncQueueItem[]>(() => {
    try {
      const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as SyncQueueItem[]) : [];
    } catch {
      return [];
    }
  });
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(() => new Date().toLocaleTimeString());
  const [toasts, setToasts] = useState<PushToast[]>([]);

  const isOnline = browserOnline && !simulatedOffline;

  const pushToast = useCallback(
    (title: string, detail: string, severity: PushToast['severity'] = 'info') => {
      const toast: PushToast = {
        id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title,
        detail,
        severity,
        timestamp: new Date().toLocaleTimeString(),
      };
      setToasts((prev) => [toast, ...prev].slice(0, 4));
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(title, { body: detail });
        } catch {
          // Ignore browser notification restrictions inside sandboxed iframes
        }
      }
    },
    [],
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    } catch {
      // Ignore storage quota errors
    }
  }, [queue]);

  const flushSyncQueue = useCallback(() => {
    setQueue((prev) => {
      const pending = prev.filter((item) => !item.synced);
      if (pending.length === 0) return prev;
      const updated = prev.map((item) => ({ ...item, synced: true }));
      setLastSyncedAt(new Date().toLocaleTimeString());
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel(SYNC_CHANNEL_NAME);
        bc.postMessage({ type: 'SYNC_FLUSHED', count: pending.length, timestamp: new Date().toISOString() });
        bc.close();
      }
      pushToast(
        'Multi-Device Sync Completed',
        `${pending.length} queued offline operation(s) synchronized across connected sessions.`,
        'success',
      );
      return updated.slice(0, 12);
    });
  }, [pushToast]);

  useEffect(() => {
    const handleOnline = () => setBrowserOnline(true);
    const handleOffline = () => setBrowserOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(SYNC_CHANNEL_NAME);
      bc.onmessage = (event) => {
        if (event.data?.type === 'STATE_EVENT') {
          setLastSyncedAt(new Date().toLocaleTimeString());
        }
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      bc?.close();
    };
  }, []);

  useEffect(() => {
    if (isOnline && queue.some((item) => !item.synced)) {
      const timer = setTimeout(() => {
        flushSyncQueue();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isOnline, queue, flushSyncQueue]);

  const recordOperation = useCallback(
    (action: string, payloadSummary: string) => {
      const item: SyncQueueItem = {
        id: `sync-${Date.now()}`,
        action,
        payloadSummary,
        createdAt: new Date().toLocaleTimeString(),
        synced: isOnline,
      };
      setQueue((prev) => [item, ...prev].slice(0, 15));
      if (isOnline) {
        setLastSyncedAt(new Date().toLocaleTimeString());
        if (typeof BroadcastChannel !== 'undefined') {
          const bc = new BroadcastChannel(SYNC_CHANNEL_NAME);
          bc.postMessage({ type: 'STATE_EVENT', action, timestamp: new Date().toISOString() });
          bc.close();
        }
      }
    },
    [isOnline],
  );

  const pendingCount = queue.filter((i) => !i.synced).length;

  return {
    isOnline,
    simulatedOffline,
    setSimulatedOffline,
    queue,
    pendingCount,
    lastSyncedAt,
    recordOperation,
    flushSyncQueue,
    toasts,
    pushToast,
    dismissToast,
  };
}
