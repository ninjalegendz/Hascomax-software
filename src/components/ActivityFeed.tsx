import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { formatDistanceToNowSafe } from "@/utils/date";
import { Button } from "./ui/button";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import type { Activity } from "@/types";
import { authenticatedFetch } from "@/lib/api";
import { Loader2 } from "lucide-react";

export function ActivityFeed() {
  const { profile } = useAuth();

  const { data, isLoading } = useQuery<{ activities: Activity[] }>({
    queryKey: ['activities', { pageSize: 5 }],
    queryFn: async () => {
      const data = await authenticatedFetch("/api/activities?pageSize=5");
      return {
        activities: data.activities.map((a: any) => ({
          ...a,
          performerName: a.performer_name || 'System'
        }))
      };
    },
    enabled: !!profile,
  });

  const activities = data?.activities || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center h-24">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : activities && activities.length > 0 ? (
          <ul className="space-y-4">
            {activities.map((activity) => (
              <li key={activity.id} className="flex items-start gap-4">
                <div className="flex-1">
                  <p className="text-sm">
                    <span className="font-semibold">{activity.performerName}</span> {activity.message}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNowSafe(activity.timestamp, { addSuffix: true })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No recent activity. Make a change to see it here!
          </p>
        )}
      </CardContent>
      {activities && activities.length > 0 && (
        <CardFooter>
          <Button asChild className="w-full" variant="outline">
            <Link to="/activity">View All Activity</Link>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}