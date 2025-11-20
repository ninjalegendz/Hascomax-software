import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRealtime } from './RealtimeContext';
import { useAuth } from './AuthContext';

interface UrgentNotification {
  taskId: string;
  taskTitle: string;
  senderName: string;
}

interface UrgentNotificationContextType {
  notification: UrgentNotification | null;
  dismiss: () => void;
}

const UrgentNotificationContext = createContext<UrgentNotificationContextType | undefined>(undefined);

export const UrgentNotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notification, setNotification] = useState<UrgentNotification | null>(null);
  const socket = useRealtime();
  const { profile } = useAuth();

  useEffect(() => {
    if (!socket || !profile) return;

    const handleUrgentNotification = (data: UrgentNotification & { recipientIds: string[] }) => {
      if (data.recipientIds.includes(profile.id)) {
        setNotification({
          taskId: data.taskId,
          taskTitle: data.taskTitle,
          senderName: data.senderName,
        });
      }
    };

    socket.on('urgent_notification', handleUrgentNotification);

    return () => {
      socket.off('urgent_notification', handleUrgentNotification);
    };
  }, [socket, profile]);

  const dismiss = () => {
    setNotification(null);
  };

  return (
    <UrgentNotificationContext.Provider value={{ notification, dismiss }}>
      {children}
    </UrgentNotificationContext.Provider>
  );
};

export const useUrgentNotification = () => {
  const context = useContext(UrgentNotificationContext);
  if (context === undefined) {
    throw new Error('useUrgentNotification must be used within an UrgentNotificationProvider');
  }
  return context;
};