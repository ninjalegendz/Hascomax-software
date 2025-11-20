import React, { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DollarSign, Users, TrendingUp } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";
import { ActivityFeed } from "@/components/ActivityFeed";
import { useAuth } from "@/contexts/AuthContext";
import { showError } from "@/utils/toast";
import { authenticatedFetch } from "@/lib/api";
import { useCurrency } from "@/hooks/useCurrency";
import { formatDateSafe } from "@/utils/date";

const PIE_COLORS = ["#0088FE", "#FF8042"];

interface SalesByDay {
  date: string;
  total: number;
}
interface RecentSale {
  sale_date: string;
  total_amount: number;
  customer_name: string;
}
interface DashboardSummary {
  totalReceivables: number;
  totalCustomers: number;
  customerStatus: { status: string; count: number }[];
  salesByDay: SalesByDay[];
  recentSales: RecentSale[];
}

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const { profile } = useAuth();
  const { currency, format } = useCurrency();

  useEffect(() => {
    const fetchSummary = async () => {
      if (!profile) return;
      try {
        const data = await authenticatedFetch("/api/dashboard-summary");
        setSummary(data);
      } catch (error) {
        showError((error as Error).message);
      }
    };
    fetchSummary();
  }, [profile]);

  const customerStatusData = summary?.customerStatus.map(s => ({
    name: s.status,
    value: s.count
  })) || [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome Back!</h1>
          <p className="text-muted-foreground">Here's a summary of your business.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Receivables</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{format(summary?.totalReceivables)}</div>
            <p className="text-xs text-muted-foreground">Total outstanding amount from customers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{summary?.totalCustomers || 0}</div>
            <p className="text-xs text-muted-foreground">Total number of customers</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Sales Overview</CardTitle>
            <CardDescription>Total sales over the last 30 days.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={summary?.salesByDay}>
                <XAxis dataKey="date" tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${currency}${value}`} />
                <Tooltip formatter={(value) => [format(value as number), 'Sales']} />
                <Bar dataKey="total" fill="currentColor" radius={[4, 4, 0, 0]} className="fill-primary" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Sales</CardTitle>
          </CardHeader>
          <CardContent>
            {summary?.recentSales && summary.recentSales.length > 0 ? (
              <ul className="space-y-4">
                {summary.recentSales.map((sale, index) => (
                  <li key={index} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{sale.customer_name}</p>
                      <p className="text-sm text-muted-foreground">{formatDateSafe(sale.sale_date, 'PP')}</p>
                    </div>
                    <p className="font-semibold">{format(sale.total_amount)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No recent sales.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Customers by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={customerStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {customerStatusData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <div className="lg:col-span-2">
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
}