import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Send, MessageSquare, MoreHorizontal } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { authenticatedFetch } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { TaskComment } from '@/types';
import { formatDistanceToNowSafe } from '@/utils/date';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface CommentSectionProps {
  taskId: string;
}

const parseMentions = (text: string) => {
  const parts = text.split(/(@[\w\s]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return <strong key={i} className="text-primary font-medium">{part}</strong>;
    }
    return part;
  });
};

const CommentForm = ({ taskId, parentId, onCommentPosted, employees }: { taskId: string, parentId: string | null, onCommentPosted: () => void, employees: any[] }) => {
  const [content, setContent] = useState('');
  const [mentionSearch, setMentionSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (newComment: { content: string; parent_id: string | null }) => 
      authenticatedFetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        body: JSON.stringify(newComment),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', taskId] });
      setContent('');
      onCommentPosted();
    },
    onError: (error) => {
      showError(error.message);
    },
  });

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);

    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = newContent.substring(0, cursorPosition);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setShowSuggestions(true);
      setMentionSearch(mentionMatch[1]);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSelectMention = (name: string) => {
    const cursorPosition = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = content.substring(0, cursorPosition);
    const textAfterCursor = content.substring(cursorPosition);

    const newTextBefore = textBeforeCursor.replace(/@(\w*)$/, `@${name} `);
    setContent(newTextBefore + textAfterCursor);
    setShowSuggestions(false);
    textareaRef.current?.focus();
  };

  const filteredEmployees = useMemo(() => {
    if (!mentionSearch || !employees) return [];
    return employees.filter(emp => 
        `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(mentionSearch.toLowerCase())
    );
  }, [mentionSearch, employees]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim()) {
      mutation.mutate({ content: content.trim(), parent_id: parentId });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-start gap-4">
      <div className="flex-1 space-y-2 relative">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          placeholder={parentId ? "Write a reply..." : "Add a comment..."}
          className="min-h-[60px]"
        />
        {showSuggestions && filteredEmployees.length > 0 && (
          <div className="absolute z-10 w-full bg-background border rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
            {filteredEmployees.map(emp => (
              <div 
                key={emp.id} 
                onClick={() => handleSelectMention(`${emp.first_name} ${emp.last_name}`)}
                className="p-2 hover:bg-muted cursor-pointer text-sm"
              >
                {emp.first_name} {emp.last_name}
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2">
          {parentId && <Button type="button" variant="ghost" size="sm" onClick={onCommentPosted}>Cancel</Button>}
          <Button type="submit" size="sm" disabled={mutation.isPending || !content.trim()}>
            {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {parentId ? 'Reply' : 'Comment'}
          </Button>
        </div>
      </div>
    </form>
  );
};

const Comment = ({ comment, allComments, activeReplyId, onReply, employees }: { comment: TaskComment, allComments: TaskComment[], activeReplyId: string | null, onReply: (id: string | null) => void, employees: any[] }) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(comment.content);

  const isAuthor = profile?.id === comment.created_by;

  const editMutation = useMutation({
    mutationFn: (updatedContent: string) =>
      authenticatedFetch(`/api/tasks/${comment.task_id}/comments/${comment.id}`, {
        method: 'PUT',
        body: JSON.stringify({ content: updatedContent }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', comment.task_id] });
      setIsEditing(false);
      showSuccess("Comment updated!");
    },
    onError: (error) => {
      showError(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      authenticatedFetch(`/api/tasks/${comment.task_id}/comments/${comment.id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', comment.task_id] });
      showSuccess("Comment deleted!");
    },
    onError: (error) => {
      showError(error.message);
    },
  });

  const handleSaveEdit = () => {
    if (editedContent.trim() && editedContent.trim() !== comment.content) {
      editMutation.mutate(editedContent.trim());
    } else {
      setIsEditing(false);
    }
  };
  
  const childComments = allComments.filter(c => c.parent_id === comment.id);
  
  return (
    <div className="flex items-start gap-4">
      <Avatar className="h-8 w-8">
        <AvatarFallback>{comment.creator_name?.charAt(0) || 'U'}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm">{comment.creator_name}</p>
            <p className="text-xs text-muted-foreground">{formatDistanceToNowSafe(comment.created_at, { addSuffix: true })}</p>
          </div>
          {isAuthor && !isEditing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setIsEditing(true)}>Edit</DropdownMenuItem>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">Delete</DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>This will permanently delete this comment and all its replies. This action cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteMutation.mutate()}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        
        {!isEditing ? (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{parseMentions(comment.content)}</p>
        ) : (
          <div className="space-y-2 mt-1">
            <Textarea value={editedContent} onChange={(e) => setEditedContent(e.target.value)} className="min-h-[60px]" />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSaveEdit} disabled={editMutation.isPending}>
                {editMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        )}

        {!isEditing && (
          <Button variant="ghost" size="sm" className="mt-1 h-auto p-1 text-xs" onClick={() => onReply(comment.id)}>
            <MessageSquare className="mr-1 h-3 w-3" /> Reply
          </Button>
        )}
        
        {activeReplyId === comment.id && (
          <div className="mt-4">
            <CommentForm taskId={comment.task_id} parentId={comment.id} onCommentPosted={() => onReply(null)} employees={employees} />
          </div>
        )}

        {childComments.length > 0 && (
          <div className="mt-4 space-y-4 pl-6 border-l">
            {childComments.map(child => (
              <Comment key={child.id} comment={child} allComments={allComments} activeReplyId={activeReplyId} onReply={onReply} employees={employees} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export function CommentSection({ taskId }: CommentSectionProps) {
  const { profile } = useAuth();
  const [replyingToId, setReplyingToId] = useState<string | null>(null);

  const { data: comments, isLoading: isLoadingComments } = useQuery<TaskComment[]>({
    queryKey: ['comments', taskId],
    queryFn: () => authenticatedFetch(`/api/tasks/${taskId}/comments`),
    enabled: !!taskId,
  });

  const { data: employees, isLoading: isLoadingEmployees } = useQuery<any[]>({
    queryKey: ['employees'],
    queryFn: () => authenticatedFetch('/api/employees'),
    enabled: !!profile,
  });

  const topLevelComments = useMemo(() => comments?.filter(c => !c.parent_id) || [], [comments]);
  const isLoading = isLoadingComments || isLoadingEmployees;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-6">
          {isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : topLevelComments.length > 0 ? (
            topLevelComments.map(comment => (
              <Comment key={comment.id} comment={comment} allComments={comments || []} activeReplyId={replyingToId} onReply={setReplyingToId} employees={employees || []} />
            ))
          ) : (
            <p className="text-sm text-center text-muted-foreground py-4">No comments yet. Be the first to add one!</p>
          )}
        </div>
        <div className="flex items-start gap-4 pt-6 border-t">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{profile?.first_name?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <CommentForm taskId={taskId} parentId={null} onCommentPosted={() => {}} employees={employees || []} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}