import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import type { SyncStatus } from '@/types';
import { COLORS, FONTS } from '@/constants';

interface Props {
  status: SyncStatus;
  /** When provided, error state shows a tappable "Upload failed · tap to retry" label. */
  onRetry?: () => void;
}

/**
 * Inline sync status indicator used in dispatch (and potentially attendance) entry cards.
 * - syncing → spinner
 * - error   → WifiOff icon; if onRetry provided, also shows a retry label
 * - synced  → renders nothing
 */
export function SyncIndicator({ status, onRetry }: Props) {
  if (status === 'syncing') {
    return <ActivityIndicator size="small" color={COLORS.textTertiary} />;
  }

  if (status === 'error') {
    return (
      <Pressable
        onPress={onRetry}
        disabled={!onRetry}
        hitSlop={8}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
      >
        <WifiOff size={12} color={COLORS.error} />
        {onRetry && (
          <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 11, color: COLORS.error }}>
            Upload failed · tap to retry
          </Text>
        )}
      </Pressable>
    );
  }

  return null;
}
