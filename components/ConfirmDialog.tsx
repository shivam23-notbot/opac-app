import { Modal, View, Text, Pressable } from 'react-native';
import { COLORS, FONTS } from '@/constants';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const accent = destructive ? COLORS.error : COLORS.accent;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        onPress={onCancel}
        style={{
          flex: 1,
          backgroundColor: 'rgba(15,23,42,0.45)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 16,
        }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: COLORS.bgSecondary,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: COLORS.borderColor,
            padding: 22,
            width: '100%',
            maxWidth: 380,
          }}
        >
          <Text
            style={{
              fontFamily: FONTS.sansExtraBold,
              fontSize: 17,
              color: COLORS.textPrimary,
              marginBottom: 8,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontFamily: FONTS.sansMedium,
              fontSize: 13,
              color: COLORS.textSecondary,
              lineHeight: 19,
              marginBottom: 20,
            }}
          >
            {message}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={onCancel}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: COLORS.borderColor,
                alignItems: 'center',
                backgroundColor: COLORS.bgSecondary,
              }}
            >
              <Text
                style={{
                  fontFamily: FONTS.sansBold,
                  fontSize: 13,
                  color: COLORS.textSecondary,
                }}
              >
                {cancelLabel}
              </Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 10,
                alignItems: 'center',
                backgroundColor: accent,
              }}
            >
              <Text style={{ fontFamily: FONTS.sansBold, fontSize: 13, color: '#fff' }}>
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
