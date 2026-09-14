import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';
import { useAuth } from '../context/AuthContext';

interface Props {
  onDeleted?: () => void;
}

export const DeleteAccountButton: React.FC<Props> = ({ onDeleted }) => {
  const { deleteAccount } = useAuth();
  const [visible, setVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const closeModal = () => {
    if (loading) return;
    setVisible(false);
    setPassword('');
  };

  const confirmDelete = () => {
    Alert.alert(
      'Supprimer mon compte',
      'Cette action est définitive. Votre profil, historique et données seront supprimés.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Continuer',
          style: 'destructive',
          onPress: () => {
            setPassword('');
            setVisible(true);
          },
        },
      ],
    );
  };

  const handleDelete = async () => {
    if (password.trim().length < 6) {
      Alert.alert('Erreur', 'Entrez votre mot de passe pour confirmer.');
      return;
    }
    setLoading(true);
    try {
      await deleteAccount(password.trim());
      closeModal();
      onDeleted?.();
      Alert.alert('Compte supprimé', 'Votre compte a été supprimé définitivement.');
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Suppression impossible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <TouchableOpacity style={styles.btn} onPress={confirmDelete} activeOpacity={0.85}>
        <Ionicons name="trash-outline" size={20} color={Colors.accent} />
        <Text style={styles.btnText}>Supprimer mon compte</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={closeModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.title}>Confirmer la suppression</Text>
            <Text style={styles.hint}>
              Saisissez votre mot de passe pour supprimer définitivement votre compte Bag&apos;up.
            </Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Mot de passe"
              placeholderTextColor={Colors.gray300}
              secureTextEntry
              autoCapitalize="none"
              editable={!loading}
            />
            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeModal} disabled={loading}>
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteBtn, loading && styles.deleteBtnDisabled]}
                onPress={handleDelete}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.deleteText}>Supprimer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.base,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.accent + '33',
    backgroundColor: Colors.accent + '0D',
  },
  btnText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.accent,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    padding: Spacing.lg,
    paddingBottom: Spacing['2xl'],
  },
  title: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.gray900,
    marginBottom: Spacing.sm,
  },
  hint: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray500,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : Spacing.sm,
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
    backgroundColor: Colors.gray50,
    minHeight: 48,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.gray100,
  },
  cancelText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.gray700,
  },
  deleteBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.base,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.accent,
  },
  deleteBtnDisabled: { opacity: 0.6 },
  deleteText: {
    fontFamily: Typography.fontFamily.dmSans.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.white,
  },
});
