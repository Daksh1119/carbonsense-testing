import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useUserStore } from '@/store';

export interface TeamMemberRecord {
  id: string;
  email: string;
  role: 'admin' | 'manager' | 'viewer';
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  department: string | null;
  employee_id: string | null;
  phone: string | null;
  approved: boolean;
  created_at: string;
  organization_id: string | null;
}

export interface UseTeamMembersReturn {
  members: TeamMemberRecord[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  removeMember: (memberId: string) => Promise<void>;
  updateMemberRole: (memberId: string, newRole: 'manager' | 'viewer') => Promise<void>;
}

/**
 * useTeamMembers Hook
 * Fetches all user_profiles in the current user's organization.
 * RLS ensures managers only see their own org (002_role_redesign_rls.sql).
 */
export function useTeamMembers(): UseTeamMembersReturn {
  const { user } = useUserStore();
  const orgId = user?.organizationId ?? '';

  const [members, setMembers] = useState<TeamMemberRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!orgId) {
      setIsLoading(false);
      setMembers([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    const { data, error: supabaseError } = await supabase
      .from('user_profiles')
      .select(
        'id, email, role, first_name, last_name, job_title, department, employee_id, phone, approved, created_at, organization_id'
      )
      .eq('organization_id', orgId)
      .order('created_at', { ascending: true });

    if (supabaseError) {
      setError(supabaseError.message);
      setIsLoading(false);
      return;
    }

    setMembers((data ?? []) as TeamMemberRecord[]);
    setIsLoading(false);
  }, [orgId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const removeMember = async (memberId: string) => {
    // Managers can soft-deactivate by unapproving a viewer; only admins can hard-delete.
    // Here we mark them as unapproved (pending state) which effectively suspends access.
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ approved: false })
      .eq('id', memberId)
      .eq('organization_id', orgId);

    if (updateError) throw new Error(updateError.message);
    await fetchMembers();
  };

  const updateMemberRole = async (memberId: string, newRole: 'manager' | 'viewer') => {
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ role: newRole })
      .eq('id', memberId)
      .eq('organization_id', orgId);

    if (updateError) throw new Error(updateError.message);
    await fetchMembers();
  };

  return { members, isLoading, error, refetch: fetchMembers, removeMember, updateMemberRole };
}
