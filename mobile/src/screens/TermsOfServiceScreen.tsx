import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../constants/theme';

type Props = { onBack: () => void };

const SECTIONS: { title: string; body: string }[] = [
  {
    title: '1. Objet',
    body:
      "Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de l'application Bag'up, plateforme de mise en relation pour la collecte, la livraison et les démarches administratives au Sénégal.",
  },
  {
    title: '2. Services',
    body:
      "Bag'up met en relation des clients et des prestataires indépendants pour des missions de type colis, documents, courses, marchandises, objets personnels, livraisons professionnelles, collectes et dépôts administratifs. Bag'up n'est pas le transporteur : la prestation est réalisée par le prestataire accepté.",
  },
  {
    title: '3. Compte utilisateur',
    body:
      "L'utilisateur s'engage à fournir des informations exactes (identité, téléphone, adresses) et à protéger l'accès à son compte. Toute activité réalisée via le compte est réputée effectuée par le titulaire.",
  },
  {
    title: '4. Demandes et tarification',
    body:
      "Le prix affiché est une estimation basée sur la distance, le niveau d'urgence (Standard, Prioritaire, Express) et le mode Immédiat ou Programmé. Le montant définitif peut être confirmé avant paiement. Les frais administratifs éventuels sont indiqués dans le récapitulatif.",
  },
  {
    title: '5. Paiement',
    body:
      "Les paiements sont effectués via les moyens proposés dans l'application (mobile money, carte, etc.). En cas d'échec ou de litige de paiement, Bag'up peut suspendre la mission jusqu'à régularisation.",
  },
  {
    title: '6. Obligations du client',
    body:
      "Le client déclare le contenu réel de la mission, respecte les interdictions légales (produits illicites, dangereux), et facilite la remise/collecte (présence, contacts, accès). Les photos et détails fournis engagent le client.",
  },
  {
    title: '7. Obligations du prestataire',
    body:
      "Le prestataire s'engage à réaliser la mission avec diligence, respecter les consignes, confirmer les étapes (prise en charge, livraison) et traiter les biens avec soin. L'abonnement et la vérification d'identité sont requis pour opérer.",
  },
  {
    title: '8. Annulation et litiges',
    body:
      "Toute annulation ou litige doit être signalé dans l'application. Bag'up peut médiater et, le cas échéant, appliquer une politique de remboursement partielle ou totale selon le stade de la mission.",
  },
  {
    title: '9. Données personnelles',
    body:
      "Bag'up traite les données nécessaires au service (identité, géolocalisation pendant la mission, historique). L'utilisateur peut demander l'accès ou la suppression de ses données via le support.",
  },
  {
    title: '10. Contact',
    body:
      "Pour toute question relative aux présentes CGU : contact@bagup-services.com — Bag'up, Sénégal.",
  },
];

export const TermsOfServiceScreen: React.FC<Props> = ({ onBack }) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={Colors.gray900} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Conditions générales</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lead}>
          En utilisant Bag'up, vous acceptez les conditions ci-dessous. Dernière mise à jour : juillet 2026.
        </Text>
        {SECTIONS.map((s) => (
          <View key={s.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </View>
        ))}
        <Text style={styles.footerNote}>
          Version officielle consultable dans l'application. Document à valeur contractuelle pour les utilisateurs de Bag'up.
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray50 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xl + 8,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray200,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.gray100,
  },
  headerTitle: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.lg,
    color: Colors.gray900,
  },
  content: { padding: Spacing.lg, paddingBottom: Spacing['2xl'] },
  lead: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.md,
    color: Colors.gray600,
    marginBottom: Spacing.lg,
    lineHeight: 22,
  },
  section: { marginBottom: Spacing.lg },
  sectionTitle: {
    fontFamily: Typography.fontFamily.syne.semiBold,
    fontSize: Typography.fontSize.md,
    color: Colors.gray900,
    marginBottom: 6,
  },
  sectionBody: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray700,
    lineHeight: 21,
  },
  footerNote: {
    fontFamily: Typography.fontFamily.dmSans.regular,
    fontSize: Typography.fontSize.xs,
    color: Colors.gray400,
    marginTop: Spacing.md,
    lineHeight: 18,
  },
});
