import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerWithRange } from "@/components/ui/datepicker-with-range";
import { formatDateSafe } from "@/utils/date";
import { useAuth } from "@/contexts/AuthContext";
import { showError } from "@/utils/toast";
import type { Activity as ActivityType } from "@/types";
import { authenticatedFetch } from "@/lib/api";
import { ArrowUpDown, Loader2 } from "lucide-react";
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

const fetchActivities = async (filters: any): Promise<ActivityData> => {
  const params = new URLSearchParams();
  if (filters.searchTerm) params.append('searchTerm', filters.searchTerm);
  if (filters.performerId && filters.performerId !== 'all-performers') params.append('performerId', filters.performerId);
  if (filters.dateRange?.from) params.append('startDate', filters.dateRange.from.toISOString());
  if (filters.dateRange?.to) params.append('endDate', filters.dateRange.to.toISOString());
  if (filters.sortBy) params.append('sortBy', filters.sortBy);
  if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
  if (filters.page) params.append('page', filters.page);
  if (filters.pageSize) params.append('pageSize', filters.pageSize);
  
  const data = await authenticatedFetch(`/api/activities?${params.toString()}`);
  return {
    activities: data.activities.map((a: any) => ({
      ...a,
      performerName: a.performer_name || 'System'
    })),
    performers: data.performers,
    count: data.count,
  };
};

const Activity = () => {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [performerId, setPerformerId] = useState("all-performers");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [sorting, setSorting] = useState({ sortBy: 'timestamp', sortOrder: 'DESC' as 'ASC' | 'DESC' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const filters = useMemo(() => ({
    searchTerm,
    performerId,
    dateRange,
    ...sorting,
    page: currentPage,
    pageSize,
  }), [searchTerm, performerId, dateRange, sorting, currentPage, pageSize]);

  const { data, isLoading, isError } = useQuery<ActivityData, Error>({
    queryKey: ['activities', filters],
    queryFn: () => fetchActivities(filters),
    enabled: !!profile,
  });

  if (isError) {
    showError("Failed to fetch activity log.");
  }

  const handleSort = (column: string) => {
    setSorting(prev => ({
      sortBy: column,
      sortOrder: prev.sortBy === column && prev.sortOrder === 'ASC' ? 'DESC' : 'ASC'
    }));
  };

  const totalCount = data?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Log</CardTitle>
        <CardDescription>A complete history of all actions taken in the application.</CardDescription>
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
        <div className="border rounded-md overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button variant="ghost" onClick={() => handleSort('performer_name')}>
                    Performer <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>Action</TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => handleSort('timestamp')}>
                    Date & Time <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={3} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : data?.activities && data.activities.length > 0 ? (
                data.activities.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell className="font-medium">{activity.performerName}</TableCell>
                    <TableCell>{activity.message}</TableCell>
                    <TableCell>{formatDateSafe(activity.timestamp, "MMMM d, yyyy 'at' h:mm a")}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={3} className="h-24 text-center">No activity found for the selected filters.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      {totalPages > 0 && (
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
};

export default Activity;