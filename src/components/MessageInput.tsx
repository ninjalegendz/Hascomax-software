import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtime } from '@/contexts/RealtimeContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send } from 'lucide-react';
import { showError } from '@/utils/toast';
import type { Message } from '@/types';

interface MessageInputProps {
  conversationId: string;
  recipientId: string;
}

export function MessageInput({ conversationId, recipientId }: MessageInputProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const socket = useRealtime();
  const [content, setContent] = useState('');
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  const mutation = useMutation({
    mutationFn: (newMessage: { content: string }) =>
      authenticatedFetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify({ recipientId, content: newMessage.content }),
      }),
    onMutate: async (newMessage) => {
      await queryClient.cancelQueries({ queryKey: ['messages', conversationId] });
      const previousMessages = queryClient.getQueryData(['messages', conversationId]);

      const optimisticMessage: Message = {
        id: `optimistic-${Date.now()}`,
        conversation_id: conversationId,
        sender_id: profile!.id,
        sender_name: `${profile!.first_name} ${profile!.last_name}`,
        content: newMessage.content,
        created_at: new Date().toISOString(),
        is_read: 0,
      };

      queryClient.setQueryData(['messages', conversationId], (oldData: any) => {
        if (!oldData || !oldData.pages) return oldData;
        const newData = { ...oldData };
        const lastPageIndex = newData.pages.length - 1;
        newData.pages[lastPageIndex] = {
          ...newData.pages[lastPageIndex],
          messages: [...newData.pages[lastPageIndex].messages, optimisticMessage],
        };
        return newData;
      });

      return { previousMessages };
    },
    onError: (err, newMessage, context) => {
      showError("Failed to send message. Please try again.");
      if (context?.previousMessages) {
        queryClient.setQueryData(['messages', conversationId], context.previousMessages);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    if (!socket) return;

    if (!typingTimeoutRef.current) {
      socket.emit('start_typing', { conversationId, userId: profile?.id, recipientId });
    } else {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', { conversationId, userId: profile?.id, recipientId });
      typingTimeoutRef.current = null;
    }, 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedContent = content.trim();
    if (!trimmedContent) return;

    mutation.mutate({ content: trimmedContent }, {
      onSuccess: () => {
        setContent('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      }
    });

    if (socket) {
      socket.emit('stop_typing', { conversationId, userId: profile?.id, recipientId });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  return (
    <div className="p-4 border-t">
      <form onSubmit={handleSubmit} className="flex items-start gap-2">
        <Textarea
          ref={textareaRef}
          rows={1}
          value={content}
          onChange={handleTyping}
          placeholder="Type a message..."
          className="resize-none max-h-40"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        <Button type="submit" size="icon" disabled={mutation.isPending || !content.trim()}>
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}