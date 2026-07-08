import { useMutation } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { supabase } from '@/lib/supabase';

export type ReportTargetType = 'drink_log' | 'comment' | 'user';

interface ReportInput {
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  details?: string;
}

export function useReportContent(currentUserId: string | undefined) {
  return useMutation({
    mutationFn: async ({ targetType, targetId, reason, details }: ReportInput) => {
      const { error } = await (supabase.from('content_reports') as any).insert({
        reporter_id: currentUserId!,
        target_type: targetType,
        target_id: targetId,
        reason,
        details: details ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      Alert.alert(
        'Report submitted',
        'Thanks for letting us know. Our team will review this content within 24 hours.',
      );
    },
    onError: () => {
      Alert.alert('Something went wrong', 'Your report could not be submitted. Please try again.');
    },
  });
}
