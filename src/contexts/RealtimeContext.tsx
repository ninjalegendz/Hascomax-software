import React, { createContext, useEffect, useContext, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient, InfiniteData } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import type { Message } from '@/types';

interface MessagesPage {
  messages: Message[];
  nextCursor: string | null;
}

const queryKeyMap: { [key: string]: string | string[] } = {
  customers: 'customers',
  invoices: ['invoices', 'receipts'],
  products: 'inventory',
  inventory_purchases: ['purchases', 'inventory'],
  sales: ['sales', 'dashboard-summary'],
  activities: 'activities',
  roles: 'roles',
  profiles: 'employees',
  transactions: 'transactions',
  conversations: 'conversations',
  quotations: 'quotations',
  tasks: 'tasks',
  payment_methods: 'paymentMethods',
  purchase_receipts: 'purchaseReceipts',
  damaged_stock_log: 'damages',
  product_categories: 'productCategories',
  product_units: 'productUnits',
  settings: 'settings',
  returns: 'returns',
  repairs: 'repairs',
  couriers: 'couriers',
};

const socket = io({
  autoConnect: false, // Don't connect automatically
});

const RealtimeContext = createContext<Socket | null>(null);

export const RealtimeProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const { profile, token } = useAuth();

  useEffect(() => {
    if (token) {
      // If we have a token, update the auth object and connect
      socket.auth = { token };
      socket.connect();
    } else {
      // If there's no token (logged out), disconnect
      socket.disconnect();
    }

    // Cleanup on component unmount or when token changes
    return () => {
      socket.disconnect();
    };
  }, [token]); // This effect runs whenever the token changes

  useEffect(() => {
    if (!socket || !profile) return;

    socket.on('connect', () => {
      console.log('Connected to realtime server');
    });

    const handleDataChanged = (data: { table: string; taskId?: string; }) => {
      console.log(`Realtime event for table: ${data.table}`);
      if (data.table === 'task_comments' && data.taskId) {
        queryClient.invalidateQueries({ queryKey: ['comments', data.taskId] });
      } else {
        const queryKeys = queryKeyMap[data.table];
        if (queryKeys) {
          const keysToInvalidate = Array.isArray(queryKeys) ? queryKeys : [queryKeys];
          keysToInvalidate.forEach(key => {
            queryClient.invalidateQueries({ queryKey: [key] });
          });
        }
      }
    };

    const handleNewMessage = (data: { conversationId: string; message: Message }) => {
      queryClient.setQueryData(['messages', data.conversationId], (oldData: InfiniteData<MessagesPage> | undefined) => {
          if (!oldData) return oldData;
          
          const newPages = oldData.pages.map(page => ({
            ...page,
            messages: [...page.messages],
          }));
  
          newPages[newPages.length - 1].messages.push(data.message);
  
          return {
            ...oldData,
            pages: newPages,
          };
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    };

    const handleMessageUpdated = (data: { conversationId: string; message: Message }) => {
      queryClient.setQueryData(['messages', data.conversationId], (oldData: InfiniteData<MessagesPage> | undefined) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map(page => ({
            ...page,
            messages: page.messages.map(m => m.id === data.message.id ? data.message : m),
          })),
        };
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    };

    const handleMessageDeleted = (data: { conversationId: string; messageId: string }) => {
      queryClient.setQueryData(['messages', data.conversationId], (oldData: InfiniteData<MessagesPage> | undefined) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map(page => ({
            ...page,
            messages: page.messages.filter(m => m.id !== data.messageId),
          })),
        };
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    };

    const handleMessagesRead = (data: { conversationId: string; readerId: string; }) => {
        if (data.readerId !== profile.id) {
            queryClient.setQueryData(['messages', data.conversationId], (oldData: InfiniteData<MessagesPage> | undefined) => {
                if (!oldData) return oldData;
                return {
                    ...oldData,
                    pages: oldData.pages.map(page => ({
                        ...page,
                        messages: page.messages.map(msg => 
                            msg.sender_id === profile.id && !msg.is_read 
                                ? { ...msg, is_read: 1 } 
                                : msg
                        )
                    }))
                };
            });
        }
    };

    socket.on('data_changed', handleDataChanged);
    socket.on('new_message', handleNewMessage);
    socket.on('message_updated', handleMessageUpdated);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('messages_read', handleMessagesRead);

    socket.on('disconnect', () => {
      console.log('Disconnected from realtime server');
    });

    // Cleanup listeners on component unmount
    return () => {
      socket.off('connect');
      socket.off('data_changed', handleDataChanged);
      socket.off('new_message', handleNewMessage);
      socket.off('message_updated', handleMessageUpdated);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('messages_read', handleMessagesRead);
      socket.off('disconnect');
    };
  }, [queryClient, profile]);

  return (
    <RealtimeContext.Provider value={socket}>
      {children}
    </RealtimeContext.Provider>
  );
};

export const useRealtime = () => {
  return useContext(RealtimeContext);
};