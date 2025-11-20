import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { authenticatedFetch } from '@/lib/api';
import type { Conversation } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Loader2, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNowSafe } from '@/utils/date';
import { NewConversationDialog } from './NewConversationDialog';

export function ConversationList() {
  const navigate = useNavigate();
  const { conversationId: activeConversationId } = useParams<{ conversationId: string }>();
  const [isNewConvoDialogOpen, setIsNewConvoDialogOpen] = useState(false);

  const { data: conversations, isLoading } = useQuery<Conversation[]>({
    queryKey: ['conversations'],
    queryFn: () => authenticatedFetch('/api/conversations'),
  });

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-xl font-bold">Messages</h2>
          <Button size="icon" variant="ghost" onClick={() => setIsNewConvoDialogOpen(true)}>
            <Edit className="h-5 w-5" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <nav className="p-2 space-y-1">
              {conversations?.map((convo) => (
                <button
                  key={convo.id}
                  onClick={() => navigate(`/messages/${convo.id}`)}
                  className={cn(
                    'w-full text-left flex items-start gap-3 p-2 rounded-lg transition-colors',
                    activeConversationId === convo.id ? 'bg-muted' : 'hover:bg-muted/50'
                  )}
                >
                  <Avatar>
                    <AvatarFallback>{convo.participantName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex justify-between items-center">
                      <p className="font-semibold truncate">{convo.participantName}</p>
                      <p className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNowSafe(convo.lastMessageAt, { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-muted-foreground truncate">{convo.lastMessage}</p>
                      {convo.unreadCount > 0 && (
                        <span className="flex items-center justify-center bg-primary text-primary-foreground text-xs rounded-full h-5 w-5">
                          {convo.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </nav>
          )}
        </ScrollArea>
      </div>
      <NewConversationDialog isOpen={isNewConvoDialogOpen} onOpenChange={setIsNewConvoDialogOpen} />
    </>
  );
}