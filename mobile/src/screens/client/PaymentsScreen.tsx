import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows, withAlpha } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  success: { label: 'Réussi', color: Colors.success, bg: withAlpha(Colors.success, 0.12), icon: 'checkmark-circle' },
  failed: { label: 'Échoué', color: Colors.accent, bg: withAlpha(Colors.accent, 0.12), icon: 'close-circle' },
  pending: { label: 'En attente', color: Colors.gray400, bg: Colors.gray100, icon: 'time' },
};

const methodLabels: Record<string, string> = {
  orange_money: 'Orange Money',
  wave: 'Wave',
  free_money: 'Free Money',
  card: 'Carte bancaire',
};

interface Props { onBack: () => void; }

export const PaymentsScreen: React.FC<Props> = ({ onBack }) => {
  const { token } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPayments = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.payments.mine(token);
      setPayments(data);
    } catch (e) {
      console.error('PaymentsScreen fetch error:', e);
    }
  }, [token]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPayments();
    setRefreshing(false);
  }, [fetchPayments]);

  const totalSpent = payments.filter(p => p.status === 'success').reduce((sum, p) => sum + Number(p.amount), 0);
  const successCount = payments.filter(p => p.status === 'success').length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={22} color={Colors.gray900} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes paiements</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}>
        <LinearGradient colors={Colors.gradientPrimary} style={styles.summaryCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View style={styles.summaryIcon}><Ionicons name="wallet" size={24} color={Colors.white} /></View>
          <Text style={styles.summaryLabel}>Total dépensé</Text>
          <Text style={styles.summaryAmount}>{totalSpent.toLocaleString()} <Text style={styles.summaryCurrency}>FCFA</Text></Text>
          <Text style={styles.summarySub}>{successCount} paiement{successCount > 1 ? 's' : ''} réussi{successCount > 1 ? 's' : ''}</Text>
        </LinearGradient>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Historique</Text>
          {payments.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><Ionicons name="receipt-outline" size={32} color={Colors.gray300} /></View>
              <Text style={styles.emptyText}>Aucun paiement</Text>
            </View>
          ) : (
            payments.map((p) => {
              const cfg = statusConfig[p.status] || statusConfig.pending;
              return (
                <View key={p.id} style={[styles.paymentCard, Shadows.sm]}>
                  <View style={[styles.paymentIcon, { backgroundColor: cfg.bg }]}>
                    <Ionicons name={cfg.icon as any} size={18} color={cfg.color} />
                  </View>
                  <View style={styles.paymentLeft}>
                    <Text style={styles.paymentAmount}>{Number(p.amount).toLocaleString()} FCFA</Text>
                    <Text style={styles.paymentMethod}>{methodLabels[p.method] || p.method}</Text>
                    {p.mission && <Text style={styles.paymentMission} numberOfLines={1}>{p.mission.serviceType} · {p.mission.pickupAddress}</Text>}
                  </View>
                  <View style={[styles.paymentStatus, { backgroundColor: cfg.bg }]}>
                    <Text style={[styles.paymentStatusText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, backgroundColor: Colors.white },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.lg, color: Colors.gray900 },
  summaryCard: { marginHorizontal: Spacing.lg, marginTop: Spacing.md, borderRadius: BorderRadius['2xl'], padding: Spacing.xl, alignItems: 'center', ...Shadows.primary },
  summaryIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  summaryLabel: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.white, opacity: 0.85 },
  summaryAmount: { fontFamily: Typography.fontFamily.syne.bold, fontSize: Typography.fontSize['3xl'], color: Colors.white, marginTop: Spacing.xs },
  summaryCurrency: { fontSize: Typography.fontSize.lg, opacity: 0.85 },
  summarySub: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.white, opacity: 0.7, marginTop: Spacing.xs },
  section: { paddingHorizontal: Spacing.lg, marginTop: Spacing.xl },
  sectionTitle: { fontFamily: Typography.fontFamily.syne.semiBold, fontSize: Typography.fontSize.lg, color: Colors.gray900, marginBottom: Spacing.md },
  emptyState: { alignItems: 'center', paddingVertical: Spacing['2xl'] },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  emptyText: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.md, color: Colors.gray500 },
  paymentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.base, marginBottom: Spacing.sm },
  paymentIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md },
  paymentLeft: { flex: 1 },
  paymentAmount: { fontFamily: Typography.fontFamily.dmSans.semiBold, fontSize: Typography.fontSize.md, color: Colors.gray900 },
  paymentMethod: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.sm, color: Colors.gray400, marginTop: 2 },
  paymentMission: { fontFamily: Typography.fontFamily.dmSans.regular, fontSize: Typography.fontSize.xs, color: Colors.gray400, marginTop: 2 },
  paymentStatus: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.md },
  paymentStatusText: { fontFamily: Typography.fontFamily.dmSans.medium, fontSize: Typography.fontSize.xs },
});
