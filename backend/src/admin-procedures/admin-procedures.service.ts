import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminProceduresService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.adminProcedure.findMany({ where: { isActive: true }, orderBy: { category: 'asc' } });
  }

  findAllAdmin() {
    return this.prisma.adminProcedure.findMany({ orderBy: { category: 'asc' } });
  }

  findByCategory(category: string) {
    return this.prisma.adminProcedure.findMany({ where: { category, isActive: true } });
  }

  create(data: { name: string; category: string; organism: string; intervention: string; estimatedFee?: number; estimatedDelay?: string; isActive?: boolean }) {
    return this.prisma.adminProcedure.create({ data });
  }

  update(id: string, data: { name?: string; category?: string; organism?: string; intervention?: string; estimatedFee?: number; estimatedDelay?: string; isActive?: boolean }) {
    return this.prisma.adminProcedure.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.adminProcedure.delete({ where: { id } });
  }

  async seed() {
    const count = await this.prisma.adminProcedure.count();
    if (count > 0) return;
    const procedures = [
      { name: 'Carte Nationale d\'Identité biométrique CEDEAO', category: 'État civil et identité', organism: 'Commissariat / Sous-préfecture', intervention: 'Dépôt de dossier, suivi, retrait', estimatedFee: 2500, estimatedDelay: '3 à 7 jours' },
      { name: 'Passeport biométrique', category: 'État civil et identité', organism: 'DPETV', intervention: 'Dépôt de dossier, suivi, retrait', estimatedFee: 55000, estimatedDelay: '5 à 10 jours' },
      { name: 'Extrait ou copie intégrale d\'acte de naissance', category: 'État civil et identité', organism: 'Centre d\'état civil (Mairie)', intervention: 'Retrait', estimatedFee: 1000, estimatedDelay: '1 à 2 jours' },
      { name: 'Jugement supplétif d\'acte de naissance', category: 'État civil et identité', organism: 'Tribunal', intervention: 'Suivi de dossier', estimatedFee: 5000, estimatedDelay: '2 à 4 semaines' },
      { name: 'Acte de mariage (copie / extrait)', category: 'État civil et identité', organism: 'Centre d\'état civil (Mairie)', intervention: 'Retrait', estimatedFee: 1000, estimatedDelay: '1 à 2 jours' },
      { name: 'Certificat de célibat', category: 'État civil et identité', organism: 'Mairie', intervention: 'Retrait', estimatedFee: 500, estimatedDelay: '1 jour' },
      { name: 'Acte de décès', category: 'État civil et identité', organism: 'Mairie', intervention: 'Dépôt de déclaration, retrait', estimatedFee: 500, estimatedDelay: '1 à 2 jours' },
      { name: 'Certificat de résidence', category: 'État civil et identité', organism: 'Chef de quartier / Sous-préfecture', intervention: 'Retrait', estimatedFee: 500, estimatedDelay: '1 jour' },
      { name: 'Casier judiciaire', category: 'Justice et nationalité', organism: 'Tribunal régional', intervention: 'Dépôt de demande, retrait', estimatedFee: 1000, estimatedDelay: '2 à 5 jours' },
      { name: 'Certificat de nationalité sénégalaise', category: 'Justice et nationalité', organism: 'Tribunal régional (Greffe)', intervention: 'Dépôt de dossier, retrait', estimatedFee: 2000, estimatedDelay: '1 à 3 semaines' },
      { name: 'NINEA', category: 'Entreprise et fiscalité', organism: 'DGID / Centre des services fiscaux', intervention: 'Dépôt de dossier, suivi, retrait', estimatedFee: 5000, estimatedDelay: '5 à 10 jours' },
      { name: 'Immatriculation au RCCM', category: 'Entreprise et fiscalité', organism: 'Greffe du tribunal de commerce / APIX-BCE', intervention: 'Dépôt de dossier, suivi, retrait', estimatedFee: 15000, estimatedDelay: '1 à 2 semaines' },
      { name: 'Déclaration d\'établissement / patente', category: 'Entreprise et fiscalité', organism: 'Service des impôts', intervention: 'Dépôt de dossier', estimatedFee: 3000, estimatedDelay: '3 à 5 jours' },
      { name: 'Quitus fiscal / attestation de régularité', category: 'Entreprise et fiscalité', organism: 'DGID', intervention: 'Demande, retrait', estimatedFee: 2000, estimatedDelay: '3 à 7 jours' },
      { name: 'Extrait du plan cadastral', category: 'Foncier et urbanisme', organism: 'Service du Cadastre', intervention: 'Demande, retrait', estimatedFee: 2000, estimatedDelay: '3 à 5 jours' },
      { name: 'Permis de construire', category: 'Foncier et urbanisme', organism: 'Service d\'urbanisme communal', intervention: 'Dépôt de dossier, suivi', estimatedFee: 10000, estimatedDelay: '2 à 4 semaines' },
      { name: 'Titre foncier / bail', category: 'Foncier et urbanisme', organism: 'Conservation foncière', intervention: 'Suivi de dossier', estimatedFee: 20000, estimatedDelay: '1 à 3 mois' },
      { name: 'Permis de conduire (1ère demande / renouvellement)', category: 'Transport', organism: 'Direction des Transports Terrestres', intervention: 'Dépôt de dossier, retrait', estimatedFee: 8000, estimatedDelay: '1 à 2 semaines' },
      { name: 'Carte grise / immatriculation de véhicule', category: 'Transport', organism: 'Direction des Transports Terrestres', intervention: 'Dépôt de dossier, retrait', estimatedFee: 12000, estimatedDelay: '3 à 7 jours' },
      { name: 'Homologation de diplômes étrangers', category: 'Éducation', organism: 'Ministère de l\'Éducation / Enseignement supérieur', intervention: 'Dépôt de dossier, suivi', estimatedFee: 5000, estimatedDelay: '2 à 4 semaines' },
      { name: 'Duplicata de diplôme ou de relevé de notes', category: 'Éducation', organism: 'Établissement scolaire / universitaire', intervention: 'Retrait', estimatedFee: 2000, estimatedDelay: '1 à 2 semaines' },
      { name: 'Carte d\'étudiant (établissement public)', category: 'Éducation', organism: 'Université', intervention: 'Retrait', estimatedFee: 1000, estimatedDelay: '1 à 3 jours' },
      { name: 'Visa / titre de voyage', category: 'International', organism: 'Consulats / Ambassades', intervention: 'Dépôt de dossier, suivi', estimatedFee: 30000, estimatedDelay: '1 à 3 semaines' },
      { name: 'Carte de résident pour étrangers', category: 'International', organism: 'Police des étrangers', intervention: 'Dépôt de dossier, retrait', estimatedFee: 10000, estimatedDelay: '2 à 4 semaines' },
      { name: 'Affiliation et attestations IPRES / CSS', category: 'Protection sociale', organism: 'IPRES / CSS', intervention: 'Dépôt de dossier, retrait', estimatedFee: 2000, estimatedDelay: '1 à 2 semaines' },
    ];
    await this.prisma.adminProcedure.createMany({ data: procedures });
  }
}
