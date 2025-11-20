import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, PlusCircle, KeyRound, Copy, Check, BookOpen } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api';
import { showError, showSuccess } from '@/utils/toast';
import { formatDateSafe } from '@/utils/date';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
}

const ApiSettings = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);

  const { data: apiKeys, isLoading } = useQuery<ApiKey[]>({
    queryKey: ['api-keys'],
    queryFn: () => authenticatedFetch('/api/api-keys'),
    enabled: !!profile,
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => authenticatedFetch('/api/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
    onSuccess: (data) => {
      showSuccess('API key created successfully!');
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setGeneratedKey(data.apiKey);
      setIsCreateOpen(false);
      setNewKeyName('');
    },
    onError: (error) => showError((error as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => authenticatedFetch(`/api/api-keys/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      showSuccess('API key revoked successfully.');
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
    onError: (error) => showError((error as Error).message),
  });

  const handleCreateKey = () => {
    if (newKeyName.trim()) {
      createMutation.mutate(newKeyName.trim());
    }
  };

  const handleCopyKey = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>API Keys</CardTitle>
            <CardDescription>Manage API keys for programmatic access to your data.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link to="/settings/api/docs">
                <BookOpen className="mr-2 h-4 w-4" />
                View API Docs
              </Link>
            </Button>
            <Button size="sm" className="gap-1" onClick={() => setIsCreateOpen(true)}>
              <PlusCircle className="h-3.5 w-3.5" />
              Generate New Key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key Prefix</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                ) : apiKeys?.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell className="font-mono">{key.key_prefix}...</TableCell>
                    <TableCell>{formatDateSafe(key.created_at, 'PPP')}</TableCell>
                    <TableCell>{key.last_used_at ? formatDateSafe(key.last_used_at, 'PPP p') : 'Never'}</TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="destructive" size="sm">Revoke</Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently revoke this API key. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(key.id)}>Revoke</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate New API Key</DialogTitle>
            <DialogDescription>Give your new key a descriptive name.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="key-name">Key Name</Label>
            <Input id="key-name" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="e.g., My Custom Integration" />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
            <Button onClick={handleCreateKey} disabled={createMutation.isPending || !newKeyName.trim()}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!generatedKey} onOpenChange={() => setGeneratedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Key Generated</DialogTitle>
            <DialogDescription>
              Copy your new API key. For security, this is the only time it will be displayed.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label>Your New API Key</Label>
            <div className="flex items-center gap-2">
              <Input readOnly value={generatedKey || ''} className="font-mono" />
              <Button size="icon" variant="outline" onClick={handleCopyKey}>
                {hasCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/50 rounded-md text-sm text-yellow-800 dark:text-yellow-300">
              <KeyRound className="h-4 w-4 inline-block mr-2" />
              Store this key securely. You will not be able to see it again.
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setGeneratedKey(null)}>I have copied my key</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ApiSettings;