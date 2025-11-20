import React, { useEffect, useState, useMemo } from 'react';
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';
import { authenticatedFetch } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtime } from '@/contexts/RealtimeContext';
import { Loader2 } from 'lucide-react';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ChatHeader } from './ChatHeader';
import type { Message } from '@/types';

interface ChatWindowProps {
  conversationId: string;
}

interface Participant {
  id: string;
  first_name: string;
  last_name: string;
}

interface ConversationData {
  participants: Participant[];
}

interface MessagesPage {
  messages: Message[];
  nextCursor: string | null;
}

export function ChatWindow({ conversationId }: ChatWindowProps) {
  const { profile } = useAuth();
  const socket = useRealtime();
  const { ref: topMessageRef, inView: isTopMessageVisible } = useInView({ threshold: 0.5 });
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: conversationData, isLoading: isLoadingConversation } = useQuery<ConversationData>({
    queryKey: ['conversation', conversationId],
    queryFn: () => authenticatedFetch(`/api/conversations/${conversationId}`),
    enabled: !!conversationId,
  });

  const {
    data,
    isLoading: isLoadingMessages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['messages', conversationId],
    queryFn: async ({ pageParam }) => {
      const url = `/api/conversations/${conversationId}/messages?cursor=${pageParam || ''}`;
      const res = await authenticatedFetch(url);
      return res as MessagesPage;
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!conversationId,
    staleTime: Infinity,
  });

  const { mutate: markAsRead } = useMutation({
    mutationFn: () => authenticatedFetch(`/api/conversations/${conversationId}/mark-read`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  useEffect(() => {
    if (conversationId) {
      markAsRead();
    }
  }, [conversationId, markAsRead]);

  const otherParticipant = conversationData?.participants.find(p => p.id !== profile?.id);

  useEffect(() => {
    if (isTopMessageVisible && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [isTopMessageVisible, hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    if (socket && conversationId && otherParticipant) {
      const handleTypingStatus = (data: { conversationId: string; userId: string; isTyping: boolean; userName: string }) => {
        if (data.conversationId === conversationId && data.userId === otherParticipant.id) {
          setTypingUser(data.isTyping ? data.userName : null);
        }
      };
      socket.on('typing_status', handleTypingStatus);
      return () => {
        socket.off('typing_status', handleTypingStatus);
      };
    }
  }, [socket, conversationId, otherParticipant]);

  const messages = data?.pages.flatMap(page => page.messages) || [];
  const isLoading = isLoadingMessages || isLoadingConversation;

  if (isLoading) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (!otherParticipant) {
    return <div className="flex justify-center items-center h-full">Could not load conversation.</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <ChatHeader participantName={`${otherParticipant.first_name} ${otherParticipant.last_name}`} />
      <MessageList
        messages={messages}
        profileId={profile!.id}
        topMessageRef={topMessageRef}
        isFetchingNextPage={isFetchingNextPage}
        typingUser={typingUser}
      />
      <MessageInput conversationId={conversationId} recipientId={otherParticipant.id} />
    </div>
  );
}