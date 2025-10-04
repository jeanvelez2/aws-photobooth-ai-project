import { useState, useEffect } from 'react';

interface QueueItem {
  id: string;
  data: any;
  timestamp: number;
  retryCount: number;
}

export function useOfflineQueue() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    // Load queue from localStorage
    const savedQueue = localStorage.getItem('offline-queue');
    if (savedQueue) {
      setQueue(JSON.parse(savedQueue));
    }

    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    // Save queue to localStorage whenever it changes
    localStorage.setItem('offline-queue', JSON.stringify(queue));
  }, [queue]);

  const addToQueue = (data: any) => {
    const item: QueueItem = {
      id: crypto.randomUUID(),
      data,
      timestamp: Date.now(),
      retryCount: 0
    };
    setQueue(prev => [...prev, item]);
  };

  const removeFromQueue = (id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  };

  const processQueue = async (processor: (item: QueueItem) => Promise<boolean>) => {
    if (!isOnline || queue.length === 0) return;

    for (const item of queue) {
      try {
        const success = await processor(item);
        if (success) {
          removeFromQueue(item.id);
        } else {
          // Increment retry count
          setQueue(prev => prev.map(qItem => 
            qItem.id === item.id 
              ? { ...qItem, retryCount: qItem.retryCount + 1 }
              : qItem
          ));
        }
      } catch (error) {
        console.error('Queue processing error:', error);
      }
    }
  };

  return {
    queue,
    isOnline,
    addToQueue,
    removeFromQueue,
    processQueue
  };
}