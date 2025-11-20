import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/contexts/AuthContext';
import { showError, showSuccess } from '@/utils/toast';
import { authenticatedFetch } from '@/lib/api';
import { Loader2 } from 'lucide-react';

const profileSchema = z.object({
  first_name: z.string().min(1, 'First name is required.'),
  last_name: z.string().min(1, 'Last name is required.'),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters.'),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const ProfileSettings = () => {
  const { profile, refreshProfile } = useAuth();
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: profile?.first_name || '',
      last_name: profile?.last_name || '',
    },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onProfileSubmit = async (values: z.infer<typeof profileSchema>) => {
    setIsSavingProfile(true);
    try {
      await authenticatedFetch('/api/profile', {
        method: 'PUT',
        body: JSON.stringify(values),
      });
      await refreshProfile();
      showSuccess('Profile updated successfully!');
    } catch (error) {
      showError((error as Error).message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const onPasswordSubmit = async (values: z.infer<typeof passwordSchema>) => {
    setIsSavingPassword(true);
    try {
      await authenticatedFetch('/api/profile/password', {
        method: 'PUT',
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      });
      showSuccess('Password updated successfully!');
      passwordForm.reset();
    } catch (error) {
      showError((error as Error).message);
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Manage your personal account details.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...profileForm}>
            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={profileForm.control} name="first_name" render={({ field }) => <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
                <FormField control={profileForm.control} name="last_name" render={({ field }) => <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
              </div>
              <Button type="submit" disabled={isSavingProfile}>
                {isSavingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Update your password here. It's recommended to use a strong, unique password.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
              <FormField control={passwordForm.control} name="currentPassword" render={({ field }) => <FormItem><FormLabel>Current Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={passwordForm.control} name="newPassword" render={({ field }) => <FormItem><FormLabel>New Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={passwordForm.control} name="confirmPassword" render={({ field }) => <FormItem><FormLabel>Confirm New Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>} />
              <Button type="submit" disabled={isSavingPassword}>
                {isSavingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Password
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileSettings;