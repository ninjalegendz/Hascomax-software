import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowDown } from 'lucide-react';
import type { Message } from '@/types';
import { isSameDay, format, isYesterday } from 'date-fns';
import { MessageBubble } from './MessageBubble';

interface MessageListProps {
  messages: Message[];
  profileId: string;
  topMessageRef: (node?: Element | null | undefined) => void;
  isFetchingNextPage: boolean;
  typingUser: string | null;
}

const formatDateSeparator = (date: Date) => {
  if (isSameDay(date, new Date())) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
};

export function MessageList({ messages, profileId, topMessageRef, isFetchingNextPage, typingUser }: MessageListProps) {
  const [viewport, setViewport] = useState<HTMLElement | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const scrollAreaRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const viewportNode = node.querySelector<HTMLElement>('[data-radix-scroll-area-viewport]');
      setViewport(viewportNode);
    }
  }, []);

  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'auto') => {
    if (viewport) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior });
    }
  };

  useEffect(() => {
    if (!viewport) return;

    const handleScroll = () => {
      const isAtBottom = viewport.scrollHeight - viewport.clientHeight <= viewport.scrollTop + 50;
      setShowScrollDown(!isAtBottom);
    };

    viewport.addEventListener('scroll', handleScroll);
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, [viewport]);

  useEffect(() => {
    if (!viewport) return;

    const isAtBottom = viewport.scrollHeight - viewport.clientHeight <= viewport.scrollTop + 50;

    if (isAtBottom) {
      setTimeout(() => scrollToBottom('smooth'), 100);
    } else {
      setShowScrollDown(true);
    }
  }, [messages, viewport]);

  useEffect(() => {
    if (typingUser && viewport) {
      const isAtBottom = viewport.scrollHeight - viewport.clientHeight <= viewport.scrollTop + 50;
      if (isAtBottom) {
        setTimeout(() => scrollToBottom('smooth'), 100);
      }
    }
  }, [typingUser, viewport]);

  return (
    <div className="flex-1 relative min-h-0">
      <ScrollArea className="absolute inset-0 h-full w-full" ref={scrollAreaRef}>
        <div className="p-4 space-y-1">
          {isFetchingNextPage && (
            <div className="flex justify-center py-2"><Loader2 className="h-5 w-5 animate-spin" /></div>
          )}
          {messages.map((msg, index) => {
            const prevMsg = messages[index - 1];
            const nextMsg = messages[index + 1];
            const isSender = msg.sender_id === profileId;

            const showDateSeparator = !prevMsg || !isSameDay(new Date(prevMsg.created_at), new Date(msg.created_at));
            
            const isFirstInGroup = !prevMsg || prevMsg.sender_id !== msg.sender_id || !isSameDay(new Date(prevMsg.created_at), new Date(msg.created_at));
            const isLastInGroup = !nextMsg || nextMsg.sender_id !== msg.sender_id || !isSameDay(new Date(nextMsg.created_at), new Date(msg.created_at));

            return (
              <React.Fragment key={msg.id}>
                {showDateSeparator && (
                  <div className="text-center text-xs text-muted-foreground py-3">{formatDateSeparator(new Date(msg.created_at))}</div>
                )}
                <div ref={index === 0 ? topMessageRef : null}>
                  <MessageBubble
                    message={msg}
                    isSender={isSender}
                    isFirstInGroup={isFirstInGroup}
                    isLastInGroup={isLastInGroup}
                  />
                </div>
              </React.Fragment>
            );
          })}
          {typingUser && (
            <div className="flex items-end gap-2 justify-start mt-2">
              <div className="max-w-xs lg:max-w-md p-3 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground animate-pulse">{typingUser} is typing...</p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
      {showScrollDown && (
        <div className="absolute bottom-4 right-4 z-10">
          <Button size="icon" className="rounded-full shadow-lg" onClick={() => scrollToBottom('smooth')}>
            <ArrowDown className="h-5 w-5" />
          </Button>
        </div>
      )}
    </div>
  );
}