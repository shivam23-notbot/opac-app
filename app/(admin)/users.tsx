import { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from '@/components/BottomSheet';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { TextField } from '@/components/TextField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useUsersStore, type AppUser } from '@/store/usersStore';
import { useAuthStore } from '@/store/authStore';
import { useAuditStore } from '@/store/auditStore';
import { useUiStore } from '@/store/uiStore';
import { COLORS, FONTS } from '@/constants';
import { useIsMobile } from '@/hooks/useIsMobile';
import { Plus, Pencil, Trash2, Shield, User as UserIcon, Eye, EyeOff, KeyRound } from 'lucide-react-native';
import type { UserRole } from '@/types';

export default function UsersScreen() {
  const insets = useSafeAreaInsets();
  const isMobile = useIsMobile();
  const users = useUsersStore((s) => s.users);
  const addUser = useUsersStore((s) => s.addUser);
  const updateUser = useUsersStore((s) => s.updateUser);
  const removeUser = useUsersStore((s) => s.removeUser);
  const sendPasswordReset = useUsersStore((s) => s.sendPasswordReset);
  const authUser = useAuthStore((s) => s.user);
  const logAudit = useAuditStore((s) => s.log);
  const showToast = useUiStore((s) => s.showToast);

  const [showSheet, setShowSheet] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('worker');

  const openAdd = () => {
    setEditing(null);
    setName('');
    setEmail('');
    setPassword('');
    setRole('worker');
    setShowPassword(false);
    setShowSheet(true);
  };

  const openEdit = (u: AppUser) => {
    setEditing(u);
    setName(u.name);
    setEmail(u.email);
    setPassword('');
    setRole(u.role);
    setShowPassword(false);
    setShowSheet(true);
  };

  const handleSave = async () => {
    if (editing) {
      const result = await updateUser(editing.id, { name, email, role });
      if (!result.ok) {
        showToast('error', result.error ?? 'Could not update user');
        return;
      }
      logAudit({
        userId: authUser!.id,
        userName: authUser!.name,
        action: 'update_user',
        entity: 'worker',
        entityId: editing.id,
        detail: `Updated user ${name} (${email})`,
      });
      showToast('success', 'User updated');
    } else {
      const result = await addUser({ name, email, password, role });
      if (!result.ok) {
        showToast('error', result.error ?? 'Could not add user');
        return;
      }
      logAudit({
        userId: authUser!.id,
        userName: authUser!.name,
        action: 'add_user',
        entity: 'worker',
        entityId: result.id ?? 'new',
        detail: `Added user ${name} (${email}) as ${role}`,
      });
      showToast('success', 'User added');
    }
    setShowSheet(false);
  };

  const handleSendReset = async () => {
    if (!editing) return;
    const result = await sendPasswordReset(editing.id);
    if (!result.ok) {
      showToast('error', result.error ?? 'Could not send reset email');
      return;
    }
    logAudit({
      userId: authUser!.id,
      userName: authUser!.name,
      action: 'reset_password',
      entity: 'worker',
      entityId: editing.id,
      detail: `Sent password reset email to ${editing.email}`,
    });
    showToast('success', `Reset email sent to ${editing.email}`);
  };

  const handleDelete = async (u: AppUser) => {
    if (authUser?.id === u.id) {
      showToast('error', 'You cannot remove yourself');
      return;
    }
    const result = await removeUser(u.id);
    if (!result.ok) {
      showToast('error', result.error ?? 'Could not remove user');
      return;
    }
    logAudit({
      userId: authUser!.id,
      userName: authUser!.name,
      action: 'remove_user',
      entity: 'worker',
      entityId: u.id,
      detail: `Removed user ${u.name} (${u.email})`,
    });
    showToast('success', 'User removed');
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bgPrimary }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 20,
          padding: 20,
          paddingBottom: 120,
        }}
      >
        <Text
          style={{
            color: COLORS.textPrimary,
            fontFamily: FONTS.serifSemibold,
            fontSize: 28,
            letterSpacing: -0.6,
            marginBottom: 8,
          }}
        >
          Users
        </Text>
        <Text
          style={{
            color: COLORS.textSecondary,
            fontFamily: FONTS.sansMedium,
            fontSize: 13,
            marginBottom: 20,
          }}
        >
          Manage login accounts for workers and admins.
        </Text>

        {users.map((u) => (
          <View
            key={u.id}
            style={{
              backgroundColor: COLORS.bgSecondary,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: COLORS.borderColor,
              padding: 14,
              marginBottom: 10,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor:
                      u.role === 'admin' ? COLORS.accentSoftBg : COLORS.bgTertiary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {u.role === 'admin' ? (
                    <Shield size={16} color={COLORS.accent} />
                  ) : (
                    <UserIcon size={16} color={COLORS.textSecondary} />
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text
                      style={{
                        color: COLORS.textPrimary,
                        fontFamily: FONTS.sansBold,
                        fontSize: 14,
                      }}
                      numberOfLines={1}
                    >
                      {u.name}
                    </Text>
                    {authUser?.id === u.id && (
                      <Text
                        style={{
                          color: COLORS.accent,
                          fontFamily: FONTS.sansBold,
                          fontSize: 10,
                          letterSpacing: 0.5,
                        }}
                      >
                        YOU
                      </Text>
                    )}
                  </View>
                  <Text
                    style={{
                      color: COLORS.textSecondary,
                      fontFamily: FONTS.sansMedium,
                      fontSize: 12,
                      marginTop: 1,
                    }}
                    numberOfLines={1}
                  >
                    {u.email}
                  </Text>
                  <Text
                    style={{
                      color: u.role === 'admin' ? COLORS.accent : COLORS.textTertiary,
                      fontFamily: FONTS.sansBold,
                      fontSize: 10,
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                      marginTop: 3,
                    }}
                  >
                    {u.role}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Pressable
                  onPress={() => openEdit(u)}
                  hitSlop={6}
                  style={{
                    backgroundColor: COLORS.bgTertiary,
                    borderRadius: 8,
                    padding: 8,
                  }}
                >
                  <Pencil size={14} color={COLORS.textSecondary} />
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (authUser?.id === u.id) {
                      showToast('error', 'You cannot remove yourself');
                      return;
                    }
                    setDeleteTarget(u);
                  }}
                  hitSlop={6}
                  style={{
                    backgroundColor: COLORS.bgTertiary,
                    borderRadius: 8,
                    padding: 8,
                  }}
                >
                  <Trash2 size={14} color={COLORS.error} />
                </Pressable>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <Pressable
        onPress={openAdd}
        style={{
          position: 'absolute',
          bottom: isMobile ? 90 : 24,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: COLORS.accent,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: COLORS.accent,
          shadowOpacity: 0.35,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        }}
      >
        <Plus size={24} color="#fff" />
      </Pressable>

      <BottomSheet
        open={showSheet}
        onClose={() => setShowSheet(false)}
        title={editing ? 'Edit User' : 'Add User'}
      >
        <TextField
          label="Full Name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Ramesh Patel"
        />
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="user@opac.in"
          keyboardType="email-address"
        />
        {editing ? (
          <View style={{ marginBottom: 4 }}>
            <Text
              style={{
                fontFamily: FONTS.sansBold,
                fontSize: 11,
                letterSpacing: 1,
                textTransform: 'uppercase',
                color: COLORS.textSecondary,
                marginBottom: 8,
              }}
            >
              Password
            </Text>
            <Pressable
              onPress={handleSendReset}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingVertical: 12,
                paddingHorizontal: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: COLORS.borderColor,
                backgroundColor: COLORS.bgTertiary,
              }}
            >
              <KeyRound size={14} color={COLORS.textSecondary} />
              <Text
                style={{
                  color: COLORS.textPrimary,
                  fontFamily: FONTS.sansSemibold,
                  fontSize: 13,
                }}
              >
                Send password reset email
              </Text>
            </Pressable>
            <Text
              style={{
                color: COLORS.textTertiary,
                fontFamily: FONTS.sansMedium,
                fontSize: 11,
                marginTop: 6,
              }}
            >
              Passwords are managed by Supabase Auth. Admins can trigger a reset
              email; the user picks their new password from the link.
            </Text>
          </View>
        ) : (
          <View style={{ marginBottom: 4 }}>
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••"
              secureTextEntry={!showPassword}
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -6 }}
            >
              {showPassword ? (
                <EyeOff size={13} color={COLORS.textTertiary} />
              ) : (
                <Eye size={13} color={COLORS.textTertiary} />
              )}
              <Text
                style={{
                  color: COLORS.textTertiary,
                  fontFamily: FONTS.sansSemibold,
                  fontSize: 12,
                }}
              >
                {showPassword ? 'Hide password' : 'Show password'}
              </Text>
            </Pressable>
          </View>
        )}

        <Text
          style={{
            fontFamily: FONTS.sansBold,
            fontSize: 11,
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: COLORS.textSecondary,
            marginTop: 12,
            marginBottom: 8,
          }}
        >
          Role
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {(['worker', 'admin'] as const).map((r) => {
            const selected = role === r;
            return (
              <Pressable
                key={r}
                onPress={() => setRole(r)}
                style={{
                  flex: 1,
                  paddingVertical: 11,
                  borderRadius: 10,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: selected ? COLORS.accent : COLORS.borderColor,
                  backgroundColor: selected ? COLORS.accentSoftBg : COLORS.bgSecondary,
                }}
              >
                <Text
                  style={{
                    color: selected ? COLORS.accent : COLORS.textSecondary,
                    fontFamily: FONTS.sansBold,
                    fontSize: 12,
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                  }}
                >
                  {r}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ marginTop: 8 }}>
          <PrimaryButton
            label={editing ? 'Save Changes' : 'Add User'}
            onPress={handleSave}
            size="lg"
          />
        </View>
      </BottomSheet>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Remove user?"
        message={
          deleteTarget
            ? `Remove ${deleteTarget.name} (${deleteTarget.email})? They will no longer be able to log in. This action is logged.`
            : ''
        }
        confirmLabel="Remove"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </View>
  );
}
