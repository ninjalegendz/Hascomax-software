import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useRealtime } from '@/contexts/RealtimeContext';
import { useAuth } from '@/contexts/AuthContext';
import type { Message } from '@/types';

export function RealtimeToastNotifier() {
  const socket = useRealtime();
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!socket || !profile) return;

    const handleNewMessage = (data: { conversationId: string; message: Message }) => {
      if (data.message.sender_id !== profile.id) {
        const isViewingChat = location.pathname === `/messages/${data.conversationId}`;
        if (!isViewingChat) {
          toast.message(`New message from ${data.message.sender_name}`, {
            description: data.message.content,
            action: {
              label: 'View',
              onClick: () => navigate(`/messages/${data.conversationId}`),
            },
          });
        }
      }
    };

    socket.on('new_message', handleNewMessage);

    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [socket, profile, location, navigate]);

  return null;
}