import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { authenticatedFetch } from '@/lib/api';
import { Loader2, History } from 'lucide-react';
import { formatDateSafe } from '@/utils/date';
import type { Activity } from '@/types';

interface DocumentTimelineProps {
  documentId: string;
  documentType: 'invoice' | 'quotation';
}

export function DocumentTimeline({ documentId, documentType }: DocumentTimelineProps) {
  const { data: activities, isLoading } = useQuery<Activity[]>({
    queryKey: ['documentTimeline', documentType, documentId],
    queryFn: async () => {
      const data = await authenticatedFetch(`/api/documents/${documentType}/${documentId}/timeline`);
      return data.map((a: any) => ({
        ...a,
        performerName: a.performer_name || 'System'
      }));
    },
    enabled: !!documentId,
  });

  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!activities || activities.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-10">No history found for this document.</p>;
  }

  return (
    <div className="relative pl-6">
      <div className="absolute left-6 top-0 bottom-0 w-px bg-border -translate-x-1/2"></div>
      <ul className="space-y-8">
        {activities.map((activity) => (
          <li key={activity.id} className="relative">
            <div className="absolute -left-3 top-1 h-6 w-6 bg-primary rounded-full flex items-center justify-center ring-8 ring-background">
              <History className="h-3 w-3 text-primary-foreground" />
            </div>
            <div className="ml-8">
              <p className="text-sm font-medium">{activity.message}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateSafe(activity.timestamp, "MMMM d, yyyy 'at' h:mm a")} by {activity.performerName}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}