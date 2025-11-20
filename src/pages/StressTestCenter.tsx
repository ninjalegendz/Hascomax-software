import React, { useState, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, CheckCircle, XCircle, Play } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api';
import { useRealtime } from '@/contexts/RealtimeContext';
import { showError, showSuccess } from '@/utils/toast';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';

const presets = {
  lite: { label: 'Lite', customers: 50, products: 25, purchases: 100, sales: 250 },
  medium: { label: 'Medium', customers: 200, products: 100, purchases: 500, sales: 1000 },
  full: { label: 'Full', customers: 500, products: 250, purchases: 1500, sales: 3000 },
  extreme: { label: 'Extreme', customers: 1000, products: 500, purchases: 5000, sales: 5000 },
};
type PresetKey = keyof typeof presets;

function DataGenerationTest() {
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>('lite');
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const socket = useRealtime();
  const queryClient = useQueryClient();
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!socket) return;
    const handleProgress = (data: { message: string }) => {
      setLogs(prev => [...prev, `[INFO] ${data.message}`]);
    };
    const handleEnd = (data: { message: string }) => {
      setLogs(prev => [...prev, `[SUCCESS] ${data.message}`]);
      setIsLoading(false);
      showSuccess("Data generation complete!");
      queryClient.invalidateQueries();
    };
    const handleError = (data: { message: string }) => {
      setLogs(prev => [...prev, `[ERROR] ${data.message}`]);
      setIsLoading(false);
      showError(`Data generation failed: ${data.message}`);
    };
    socket.on('stress-test:progress', handleProgress);
    socket.on('stress-test:end', handleEnd);
    socket.on('stress-test:error', handleError);
    return () => {
      socket.off('stress-test:progress', handleProgress);
      socket.off('stress-test:end', handleEnd);
      socket.off('stress-test:error', handleError);
    };
  }, [socket, queryClient]);

  useEffect(() => {
    if (logContainerRef.current) {
      const scrollable = logContainerRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollable) scrollable.scrollTop = scrollable.scrollHeight;
    }
  }, [logs]);

  const handleStart = async () => {
    setIsLoading(true);
    setLogs(['[START] Beginning data generation...']);
    try {
      await authenticatedFetch('/api/stress-test/data-generation', {
        method: 'POST',
        body: JSON.stringify({ preset: selectedPreset }),
      });
    } catch (err) {
      const errorMsg = (err as Error).message;
      setLogs(prev => [...prev, `[ERROR] ${errorMsg}`]);
      showError(`Data generation failed: ${errorMsg}`);
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Database Population</CardTitle>
        <CardDescription>Generate large amounts of mock data to test application performance and database capacity.</CardDescription>
      </CardHeader>
      <CardContent className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Label>Select a Test Size</Label>
          <RadioGroup value={selectedPreset} onValueChange={(v) => setSelectedPreset(v as PresetKey)} className="grid grid-cols-2 gap-4">
            {Object.keys(presets).map((key) => (
              <Label key={key} className={cn("flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground", selectedPreset === key && "border-primary")}>
                <RadioGroupItem value={key} className="sr-only" />
                <span className="text-lg font-semibold">{presets[key as PresetKey].label}</span>
              </Label>
            ))}
          </RadioGroup>
          <Button onClick={handleStart} disabled={isLoading} className="w-full">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            {isLoading ? 'Generating Data...' : 'Start Generation'}
          </Button>
        </div>
        <div className="space-y-2">
          <Label>Live Log</Label>
          <ScrollArea className="h-64 w-full rounded-md border bg-muted/50" ref={logContainerRef}>
            <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-all">{logs.join('\n')}</pre>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}

function ConcurrencyTest() {
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const handleRunTest = async () => {
    setIsLoading(true);
    setLogs(['[START] Running concurrency test...']);
    try {
      const result = await authenticatedFetch('/api/stress-test/concurrency', { method: 'POST' });
      setLogs(result.log);
    } catch (err) {
      const errorMsg = (err as Error).message;
      setLogs(prev => [...prev, `[ERROR] ${errorMsg}`]);
      showError(`Test failed: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stock Update Concurrency Test</CardTitle>
        <CardDescription>Simulates two users trying to purchase the last item in stock simultaneously to test for race conditions.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleRunTest} disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
          {isLoading ? 'Running Test...' : 'Run Concurrency Test'}
        </Button>
        <div>
          <Label>Test Log</Label>
          <ScrollArea className="h-64 w-full rounded-md border bg-muted/50">
            <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-all">{logs.join('\n')}</pre>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}

const API_ENDPOINTS_TO_CHECK = [
  { name: 'Dashboard Summary', path: '/api/dashboard-summary' },
  { name: 'Customers List', path: '/api/customers' },
  { name: 'Products List', path: '/api/products' },
  { name: 'Invoices List', path: '/api/invoices' },
  { name: 'Purchases List', path: '/api/purchases' },
  { name: 'Activity Log', path: '/api/activities' },
];

function ApiHealthCheck() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const handleRunChecks = async () => {
    setIsLoading(true);
    setResults([]);
    const promises = API_ENDPOINTS_TO_CHECK.map(async (endpoint) => {
      const startTime = Date.now();
      try {
        const response = await authenticatedFetch(endpoint.path);
        const endTime = Date.now();
        return { name: endpoint.name, status: 'OK', code: 200, latency: endTime - startTime };
      } catch (error) {
        const endTime = Date.now();
        return { name: endpoint.name, status: 'Error', code: 500, latency: endTime - startTime, error: (error as Error).message };
      }
    });
    const checkResults = await Promise.all(promises);
    setResults(checkResults);
    setIsLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Endpoint Health Check</CardTitle>
        <CardDescription>Pings key read-only API endpoints to ensure they are responsive and returning successful status codes.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleRunChecks} disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
          {isLoading ? 'Running Checks...' : 'Run Health Checks'}
        </Button>
        <div className="border rounded-md">
          <Table>
            <TableHeader><TableRow><TableHead>Endpoint</TableHead><TableHead>Status</TableHead><TableHead>Latency</TableHead></TableRow></TableHeader>
            <TableBody>
              {results.map((result, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{result.name}</TableCell>
                  <TableCell className="flex items-center gap-2">
                    {result.status === 'OK' ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
                    {result.code} {result.status}
                  </TableCell>
                  <TableCell>{result.latency}ms</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

const StressTestCenter = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stress Testing Center</h1>
          <p className="text-muted-foreground">Tools to test application performance and reliability.</p>
        </div>
      </div>
      <Tabs defaultValue="data-generation" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="data-generation">Data Generation</TabsTrigger>
          <TabsTrigger value="concurrency">Concurrency Test</TabsTrigger>
          <TabsTrigger value="health-check">API Health Check</TabsTrigger>
        </TabsList>
        <TabsContent value="data-generation" className="mt-4">
          <DataGenerationTest />
        </TabsContent>
        <TabsContent value="concurrency" className="mt-4">
          <ConcurrencyTest />
        </TabsContent>
        <TabsContent value="health-check" className="mt-4">
          <ApiHealthCheck />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StressTestCenter;