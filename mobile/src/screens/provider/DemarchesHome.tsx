import React, { useCallback, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { DEMARCHES_COMMISSION_RATE } from '../../constants/demarches';

const NEXT_STATUS: Record<string, { status: string; label: string } | null> = {
  accepted: { status: 'en_route', label: 'En route' },
  en_route: { status: 'dossier_deposed', label: 'Dossier déposé' },
  dossier_deposed: { status: 'admin_processing', label: 'En attente admin' },
  admin_processing: { status: 'document_ready', label: 'Document prêt' },
  document_ready: { status: 'document_collected', label: 'Récupéré' },
  document_collected: { status: 'returned_to_client', label: 'Restituer au client' },
  returned_to_client: null,
};

function netOf(fee: number) {
  return Math.round(fee * (1 - DEMARCHES_COMMISSION_RATE));
}

export const DemarchesHome: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { user, token, refreshUser } = useAuth();
  const [available, setAvailable] = useState<any[]>([]);
  const [mine, setMy] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [feeInput, setFeeInput] = useState(String(user?.demarchesServiceFee || ''));
  const [savingFee, setSavingFee] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [codeFor, setCodeFor] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    const [open, assigned] = await Promise.all([
      api.missions.available(token).catch(() => []),
      api.missions.provider(token).catch(() => []),
    ]);
    setAvailable(Array.isArray(open) ? open : []);
    setMy(Array.isArray(assigned) ? assigned : []);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), refreshUser()]);
    setRefreshing(false);
  };

  const saveFee = async () => {
    if (!token) return;
    const fee = Number(feeInput.replace(/\s/g, ''));
    if (!Number.isFinite(fee) || fee < 1000 || fee > 50000) {
      Alert.alert('Honoraires', 'Indiquez un montant entre 1 000 et 50 000 FCFA.');
      return;
    }
    setSavingFee(true);
    try {
      await api.users.updateMe({ demarchesServiceFee: fee }, token);
      await refreshUser();
      Alert.alert('Honoraires', `Tarif enregistré : ${fee.toLocaleString('fr-FR')} FCFA. Vous recevez ${netOf(fee).toLocaleString('fr-FR')} FCFA après commission.`);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible d’enregistrer le tarif');
    } finally {
      setSavingFee(false);
    }
  };

  const accept = async (id: string) => {
    if (!token) return;
    setBusyId(id);
    try {
      await api.missions.accept(id, token);
      await load();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Impossible d’accepter cette démarche');
    } finally {
      setBusyId(null);
    }
  };

  const advance = async (id: string, status: string, code?: string) => {
    if (!token) return;
    if (status === 'returned_to_client' && !code) {
      setCodeFor(id);
      return;
    }
    setBusyId(id);
    try {
      await api.missions.updateStatus(id, status, token, code);
      setCodeFor(null);
      setCodeInput('');
      await load();
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Mise à jour impossible');
    } finally {
      setBusyId(null);
    }
  };

  const active = mine.filter((m) =>
    ['accepted', 'en_route', 'picked_up', 'in_progress', 'dossier_deposed', 'admin_processing', 'document_ready', 'document_collected'].includes(m.status),
  );
  const fee = user?.demarchesServiceFee || 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <LinearGradient colors={['#B45309', '#F59E0B']} style={styles.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Text style={styles.kicker}>Prestataire démarches</Text>
        <Text style={styles.hello}>{user?.firstName || 'Bonjour'}</Text>
        <Text style={styles.heroSub}>Vous accompagnez le client jusqu’au dépôt et au retour du dossier. Pas de courses, pas de véhicule.</Text>
      </LinearGradient>

      <View style={[styles.card, Shadows.sm]}>
        <Text style={styles.sectionTitle}>Vos honoraires</Text>
        <Text style={styles.hint}>Visibles par le client avant qu’il vous choisisse. Bag’up retient 15 % sur cette somme uniquement.</Text>
        <View style={styles.feeRow}>
          <TextInput
            style={styles.feeInput}
            value={feeInput}
            onChangeText={setFeeInput}
            keyboardType="number-pad"
            placeholder="5000"
            placeholderTextColor={Colors.gray400}
          />
          <Text style={styles.feeUnit}>FCFA</Text>
        </View>
        {fee > 0 ? (
          <Text style={styles.net}>Vous recevez {netOf(fee).toLocaleString('fr-FR')} FCFA · Bag’up {Math.round(fee * DEMARCHES_COMMISSION_RATE).toLocaleString('fr-FR')} FCFA</Text>
        ) : null}
        <Button title={savingFee ? 'Enregistrement…' : 'Enregistrer le tarif'} onPress={saveFee} disabled={savingFee} />
      </View>

      <Text style={styles.sectionTitlePad}>Dossiers en cours</Text>
      {active.length === 0 ? (
        <Text style={styles.empty}>Aucun dossier en cours.</Text>
      ) : (
        active.map((m) => {
          const next = NEXT_STATUS[m.status];
          return (
            <View key={m.id} style={[styles.card, Shadows.sm]}>
              <Text style={styles.missionTitle}>{m.adminProcedureType || 'Démarche'}</Text>
              <Text style={styles.hint}>{m.pickupAddress} → {m.deliveryAddress}</Text>
              <Text style={styles.hint}>Statut : {m.status.replace(/_/g, ' ')}</Text>
              {next ? (
                <TouchableOpacity style={styles.action} onPress={() => advance(m.id, next.status)} disabled={busyId === m.id}>
                  <Text style={styles.actionText}>{busyId === m.id ? '…' : next.label}</Text>
                </TouchableOpacity>
              ) : null}
              {codeFor === m.id ? (
                <View style={{ marginTop: 10 }}>
                  <TextInput
                    style={styles.feeInput}
                    value={codeInput}
                    onChangeText={setCodeInput}
                    placeholder="Code de remise"
                    autoCapitalize="characters"
                    placeholderTextColor={Colors.gray400}
                  />
                  <TouchableOpacity style={[styles.action, { marginTop: 8 }]} onPress={() => advance(m.id, 'returned_to_client', codeInput.trim())}>
                    <Text style={styles.actionText}>Valider la restitution</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          );
        })
      )}

      <Text style={styles.sectionTitlePad}>Demandes qui vous sont adressées</Text>
      {available.length === 0 ? (
        <Text style={styles.empty}>Aucune demande pour le moment.</Text>
      ) : (
        available.map((m) => {
          const details = (m.serviceDetails || {}) as Record<string, unknown>;
          const serviceFee = Number(details.serviceFee || fee || 0);
          return (
            <View key={m.id} style={[styles.card, Shadows.sm]}>
              <Text style={styles.missionTitle}>{m.adminProcedureType || 'Démarche'}</Text>
              <Text style={styles.hint}>{m.adminOrganism || 'Administration'}</Text>
              <Text style={styles.hint}>{m.pickupAddress}</Text>
              <Text style={styles.net}>Honoraires {serviceFee.toLocaleString('fr-FR')} FCFA · vous {netOf(serviceFee).toLocaleString('fr-FR')} FCFA</Text>
              <TouchableOpacity style={styles.action} onPress={() => accept(m.id)} disabled={busyId === m.id}>
                <Text style={styles.actionText}>{busyId === m.id ? '…' : 'Accepter'}</Text>
              </TouchableOpacity>
            </View>
          );
        })
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.gray50 },
  hero: { marginHorizontal: Spacing.md, borderRadius: BorderRadius.lg, padding: Spacing.lg },
  kicker: { color: 'rgba(255,255,255,0.85)', fontFamily: Typography.fontFamily.dmSans.medium, fontSize: 12, letterSpacing: 0.4 },
  hello: { color: Colors.white, fontFamily: Typography.fontFamily.syne.bold, fontSize: 28, marginTop: 4 },
  heroSub: { color: 'rgba(255,255,255,0.92)', marginTop: 8, fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: Colors.white, marginHorizontal: Spacing.md, marginTop: Spacing.md, borderRadius: BorderRadius.lg, padding: Spacing.md },
  sectionTitle: { fontFamily: Typography.fontFamily.syne.bold, fontSize: 18, color: Colors.gray900 },
  sectionTitlePad: { marginHorizontal: Spacing.md, marginTop: Spacing.lg, fontFamily: Typography.fontFamily.syne.bold, fontSize: 18, color: Colors.gray900 },
  hint: { marginTop: 6, color: Colors.gray500, fontFamily: Typography.fontFamily.dmSans.regular, fontSize: 13, lineHeight: 18 },
  feeRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm, marginBottom: Spacing.sm },
  feeInput: { flex: 1, borderWidth: 1, borderColor: Colors.gray200, borderRadius: BorderRadius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 18, fontFamily: Typography.fontFamily.dmSans.medium, color: Colors.gray900 },
  feeUnit: { marginLeft: 8, color: Colors.gray500, fontFamily: Typography.fontFamily.dmSans.medium },
  net: { marginBottom: Spacing.sm, color: Colors.primary, fontFamily: Typography.fontFamily.dmSans.medium, fontSize: 13 },
  empty: { marginHorizontal: Spacing.md, marginTop: 8, color: Colors.gray400, fontFamily: Typography.fontFamily.dmSans.regular },
  missionTitle: { fontFamily: Typography.fontFamily.dmSans.bold, fontSize: 16, color: Colors.gray900 },
  action: { marginTop: Spacing.sm, backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: 12, alignItems: 'center' },
  actionText: { color: Colors.white, fontFamily: Typography.fontFamily.dmSans.bold },
});
