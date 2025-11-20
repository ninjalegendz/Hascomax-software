import { useAuth } from "@/contexts/AuthContext";

export function usePermissions(requiredPermissions: string | string[]): boolean {
  const { profile, loading } = useAuth();

  if (loading || !profile) {
    return false;
  }

  const userPermissions = new Set(profile.permissions);
  const permissionsToCheck = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

  if (permissionsToCheck.length === 0) {
    return true;
  }

  return permissionsToCheck.every(p => userPermissions.has(p));
}