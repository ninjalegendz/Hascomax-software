import React from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { ConversationList } from '@/components/ConversationList';
import { ChatWindow } from '@/components/ChatWindow';
import { useIsMobile } from '@/hooks/use-mobile';
import { MessageSquare } from 'lucide-react';

const Messages = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="h-[calc(100vh-8rem)]">
        {conversationId ? (
          <ChatWindow conversationId={conversationId} />
        ) : (
          <ConversationList />
        )}
      </div>
    );
  }

  return (
    <Card className="h-[calc(100vh-8rem)] flex flex-col">
      <CardContent className="p-0 flex-1 flex flex-row min-h-0">
        <div className="w-1/3 max-w-sm border-r">
          <ConversationList />
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          {conversationId ? (
            <ChatWindow conversationId={conversationId} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
              <div className="bg-muted rounded-full p-4 mb-6">
                <MessageSquare className="h-12 w-12 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Your Messages</h2>
              <p>Select a conversation from the list on the left to start chatting, or create a new one.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default Messages;