import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerWithRange } from "@/components/ui/datepicker-with-range";
import { formatDateSafe } from "@/utils/date";
import type { Activity as ActivityType } from "@/types";
import { authenticatedFetch } from "@/lib/api";
import { Loader2, History } from "lucide-react";
import { DateRange } from "react-day-picker";
import { DataTablePagination } from "@/components/DataTablePagination";

interface Performer {
  id: string;
  first_name: string;
  last_name: string;
}

interface ActivityData {
  activities: ActivityType[];
  performers: Performer[];
  count: number;
}

const fetchCustomerActivities = async (customerId: string, filters: any): Promise<ActivityData> => {
  const params = new URLSearchParams();
  if (filters.searchTerm) params.append('searchTerm', filters.searchTerm);
  if (filters.performerId && filters.performerId !== 'all-performers') params.append('performerId', filters.performerId);
  if (filters.dateRange?.from) params.append('startDate', filters.dateRange.from.toISOString());
  if (filters.dateRange?.to) params.append('endDate', filters.dateRange.to.toISOString());
  if (filters.page) params.append('page', filters.page);
  if (filters.pageSize) params.append('pageSize', filters.pageSize);
  
  const data = await authenticatedFetch(`/api/customers/${customerId}/activities?${params.toString()}`);
  return {
    activities: data.activities.map((a: any) => ({
      ...a,
      performerName: a.performer_name || 'System'
    })),
    performers: data.performers,
    count: data.count,
  };
};

export function CustomerActivityTimeline({ customerId }: { customerId: string }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [performerId, setPerformerId] = useState("all-performers");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filters = useMemo(() => ({
    searchTerm,
    performerId,
    dateRange,
    page: currentPage,
    pageSize,
  }), [searchTerm, performerId, dateRange, currentPage, pageSize]);

  const { data, isLoading } = useQuery<ActivityData, Error>({
    queryKey: ['customerActivities', customerId, filters],
    queryFn: () => fetchCustomerActivities(customerId, filters),
  });

  const totalCount = data?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Timeline</CardTitle>
        <CardDescription>A history of all actions related to this customer.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <Input
            placeholder="Search activities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
          <Select value={performerId} onValueChange={setPerformerId}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="All Performers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-performers">All Performers</SelectItem>
              {data?.performers.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DatePickerWithRange date={dateRange} setDate={setDateRange} />
        </div>
        {isLoading ? (
          <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : data?.activities && data.activities.length > 0 ? (
          <div className="relative pl-6">
            <div className="absolute left-6 top-0 bottom-0 w-px bg-border -translate-x-1/2"></div>
            <ul className="space-y-8">
              {data.activities.map((activity) => (
                <li key={activity.id} className="relative">
                  <div className="absolute -left-3 top-1 h-6 w-6 bg-primary rounded-full flex items-center justify-center ring-8 ring-background">
                    <History className="h-3 w-3 text-primary-foreground" />
                  </div>
                  <div className="ml-8">
                    <p className="text-sm font-medium">{activity.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateSafe(activity.timestamp, "MMMM d, yyyy 'at' h:mm a")} by {activity.performerName || 'System'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-10">No activity logged for this customer.</p>
        )}
      </CardContent>
      {totalPages > 1 && (
        <CardFooter>
          <DataTablePagination
            page={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            setPage={setCurrentPage}
            setPageSize={setPageSize}
            totalCount={totalCount}
          />
        </CardFooter>
      )}
    </Card>
  );
}