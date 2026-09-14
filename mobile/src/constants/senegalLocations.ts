import { dakarPracticalPlaces } from './dakarPlaces';

export interface SenegalLocation {
  label: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  aliases?: string;
}

export const senegalLocations: SenegalLocation[] = [
  // ===== DÉPARTEMENT DE DAKAR =====
  // Plateau & Centre-ville
  { label: 'Dakar Plateau', city: 'Dakar', country: 'Sénégal', lat: 14.6693, lng: -17.4398 },
  { label: 'Plateau Domaine, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6650, lng: -17.4410 },
  { label: 'Rebeuss, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6750, lng: -17.4420 },
  { label: 'Gibraltar, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6790, lng: -17.4440 },
  { label: 'Île de Gorée, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6670, lng: -17.3980 },
  // Médina
  { label: 'Médina, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6800, lng: -17.4530 },
  { label: 'HLM Médina, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6720, lng: -17.4480 },
  // Fann - Point E - Amitié
  { label: 'Fann, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6920, lng: -17.4630 },
  { label: 'Fann Résidence, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6900, lng: -17.4660 },
  { label: 'Fann Hock, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6860, lng: -17.4640 },
  { label: 'Point E, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6830, lng: -17.4610 },
  { label: 'Amitié, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6950, lng: -17.4600 },
  { label: 'Sicap Fann, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6980, lng: -17.4680 },
  // Gueule Tapée - Fass - Colobane
  { label: 'Gueule Tapée, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6770, lng: -17.4560 },
  { label: 'Fass, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6820, lng: -17.4480 },
  { label: 'Colobane, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6880, lng: -17.4450 },
  // Grand Dakar & Biscuiterie
  { label: 'Grand Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7050, lng: -17.4500 },
  { label: 'Biscuiterie, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7150, lng: -17.4480 },
  { label: 'Niary Tally, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7000, lng: -17.4500 },
  { label: 'Bourguiba, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7100, lng: -17.4550 },
  { label: 'Castors, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7050, lng: -17.4480 },
  // Dieuppeul - Derklé
  { label: 'Dieuppeul, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6970, lng: -17.4550 },
  { label: 'Derklé, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7080, lng: -17.4520 },
  // HLM
  { label: 'HLM Grand Yoff, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7520, lng: -17.4250 },
  { label: 'HLM 1, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7050, lng: -17.4450 },
  { label: 'HLM 5, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7080, lng: -17.4430 },
  // Sicap & Libertés
  { label: 'Sicap Liberté, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7050, lng: -17.4600 },
  { label: 'Liberté 1, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7000, lng: -17.4580 },
  { label: 'Liberté 2, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7050, lng: -17.4590 },
  { label: 'Liberté 3, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7100, lng: -17.4600 },
  { label: 'Liberté 4, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7150, lng: -17.4610 },
  { label: 'Liberté 5, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7180, lng: -17.4620 },
  { label: 'Liberté 6, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7210, lng: -17.4640 },
  { label: 'Liberté 6 Extension, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7250, lng: -17.4660 },
  { label: 'Sicap Baobab, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6980, lng: -17.4600 },
  { label: 'Sicap Amitié, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6950, lng: -17.4610 },
  { label: 'Sicap Karack, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7020, lng: -17.4580 },
  // Mermoz - Sacré-Cœur
  { label: 'Mermoz, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7050, lng: -17.4700 },
  { label: 'Sicap Mermoz, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7080, lng: -17.4650 },
  { label: 'Mermoz Pyrotechnie, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7020, lng: -17.4720 },
  { label: 'Sacré-Cœur 1, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6880, lng: -17.4680 },
  { label: 'Sacré-Cœur 2, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6920, lng: -17.4670 },
  { label: 'Sacré-Cœur 3, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6960, lng: -17.4660 },
  { label: 'Cité Keur Gorgui, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7100, lng: -17.4540 },
  { label: 'VDN, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7200, lng: -17.4600 },
  // Grand Yoff & Patte d'Oie
  { label: 'Grand Yoff, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7470, lng: -17.4470 },
  { label: 'Patte d\'Oie, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7370, lng: -17.4370 },
  { label: 'Patte d\'Oie Builders, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7400, lng: -17.4400 },
  // Hann Bel-Air & Maristes
  { label: 'Hann Bel-Air, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6800, lng: -17.4300 },
  { label: 'Hann Maristes, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6850, lng: -17.4350 },
  { label: 'Les Maristes, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6950, lng: -17.4620 },
  { label: 'Hann Mariste 2, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6880, lng: -17.4330 },
  // Parcelles Assainies (U1 → U26 + labels U8 pour la recherche quotidienne)
  { label: 'Parcelles Assainies, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7600, lng: -17.3900 },
  { label: 'Parcelles Assainies Unité 1 (U1)', city: 'Dakar', country: 'Sénégal', lat: 14.7560, lng: -17.3880 },
  { label: 'Parcelles Assainies Unité 2 (U2)', city: 'Dakar', country: 'Sénégal', lat: 14.7570, lng: -17.3900 },
  { label: 'Parcelles Assainies Unité 3 (U3)', city: 'Dakar', country: 'Sénégal', lat: 14.7580, lng: -17.3920 },
  { label: 'Parcelles Assainies Unité 4 (U4)', city: 'Dakar', country: 'Sénégal', lat: 14.7590, lng: -17.3940 },
  { label: 'Parcelles Assainies Unité 5 (U5)', city: 'Dakar', country: 'Sénégal', lat: 14.7600, lng: -17.3960 },
  { label: 'Parcelles Assainies Unité 6 (U6)', city: 'Dakar', country: 'Sénégal', lat: 14.7610, lng: -17.3980 },
  { label: 'Parcelles Assainies Unité 7 (U7)', city: 'Dakar', country: 'Sénégal', lat: 14.7620, lng: -17.4000 },
  { label: 'Parcelles Assainies Unité 8 (U8)', city: 'Dakar', country: 'Sénégal', lat: 14.7630, lng: -17.4020 },
  { label: 'Parcelle U8, Parcelles Assainies', city: 'Dakar', country: 'Sénégal', lat: 14.7630, lng: -17.4020 },
  { label: 'Parcelles Assainies Unité 9 (U9)', city: 'Dakar', country: 'Sénégal', lat: 14.7640, lng: -17.4040 },
  { label: 'Parcelles Assainies Unité 10 (U10)', city: 'Dakar', country: 'Sénégal', lat: 14.7650, lng: -17.3950 },
  { label: 'Parcelles Assainies Unité 11 (U11)', city: 'Dakar', country: 'Sénégal', lat: 14.7660, lng: -17.3970 },
  { label: 'Parcelles Assainies Unité 12 (U12)', city: 'Dakar', country: 'Sénégal', lat: 14.7670, lng: -17.3990 },
  { label: 'Parcelles Assainies Unité 13 (U13)', city: 'Dakar', country: 'Sénégal', lat: 14.7680, lng: -17.4010 },
  { label: 'Parcelles Assainies Unité 14 (U14)', city: 'Dakar', country: 'Sénégal', lat: 14.7700, lng: -17.4000 },
  { label: 'Parcelles Assainies Unité 15 (U15)', city: 'Dakar', country: 'Sénégal', lat: 14.7720, lng: -17.4020 },
  { label: 'Parcelles Assainies Unité 16 (U16)', city: 'Dakar', country: 'Sénégal', lat: 14.7730, lng: -17.4040 },
  { label: 'Parcelles Assainies Unité 17 (U17)', city: 'Dakar', country: 'Sénégal', lat: 14.7740, lng: -17.4060 },
  { label: 'Parcelles Assainies Unité 18 (U18)', city: 'Dakar', country: 'Sénégal', lat: 14.7750, lng: -17.4080 },
  { label: 'Parcelles Assainies Unité 19 (U19)', city: 'Dakar', country: 'Sénégal', lat: 14.7760, lng: -17.4090 },
  { label: 'Parcelles Assainies Unité 20 (U20)', city: 'Dakar', country: 'Sénégal', lat: 14.7770, lng: -17.4100 },
  { label: 'Parcelles Assainies Unité 21 (U21)', city: 'Dakar', country: 'Sénégal', lat: 14.7780, lng: -17.4110 },
  { label: 'Parcelles Assainies Unité 22 (U22)', city: 'Dakar', country: 'Sénégal', lat: 14.7790, lng: -17.4120 },
  { label: 'Parcelles Assainies Unité 23 (U23)', city: 'Dakar', country: 'Sénégal', lat: 14.7800, lng: -17.4130 },
  { label: 'Parcelles Assainies Unité 24 (U24)', city: 'Dakar', country: 'Sénégal', lat: 14.7810, lng: -17.4140 },
  { label: 'Parcelles Assainies Unité 25 (U25)', city: 'Dakar', country: 'Sénégal', lat: 14.7750, lng: -17.4100 },
  { label: 'Parcelles Assainies Unité 26 (U26)', city: 'Dakar', country: 'Sénégal', lat: 14.7770, lng: -17.4120 },
  // Cambérène
  { label: 'Cambérène, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7680, lng: -17.4280 },
  // Yoff - Ngor - Ouakam - Almadies
  { label: 'Yoff, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7470, lng: -17.4760 },
  { label: 'Yoff Virage, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7350, lng: -17.4710 },
  { label: 'Yoff Layène, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7520, lng: -17.4820 },
  { label: 'Ngor, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7430, lng: -17.4910 },
  { label: 'Almadies, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7490, lng: -17.4960 },
  { label: 'Ouakam, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7180, lng: -17.4840 },
  { label: 'Cité Avion, Ouakam', city: 'Dakar', country: 'Sénégal', lat: 14.7220, lng: -17.4820 },
  { label: 'Nord Foire, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7450, lng: -17.4750 },
  { label: 'Ouest Foire, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7480, lng: -17.4800 },
  { label: 'Cité Soprim, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7208, lng: -17.4555 },
  // ===== DÉPARTEMENT DE PIKINE =====
  { label: 'Pikine, Dakar', city: 'Pikine', country: 'Sénégal', lat: 14.7540, lng: -17.3900 },
  { label: 'Pikine Est', city: 'Pikine', country: 'Sénégal', lat: 14.7560, lng: -17.3850 },
  { label: 'Pikine Nord', city: 'Pikine', country: 'Sénégal', lat: 14.7600, lng: -17.3880 },
  { label: 'Pikine Ouest', city: 'Pikine', country: 'Sénégal', lat: 14.7520, lng: -17.3950 },
  { label: 'Pikine Tally Boumack', city: 'Pikine', country: 'Sénégal', lat: 14.7600, lng: -17.3800 },
  { label: 'Dalifort, Pikine', city: 'Pikine', country: 'Sénégal', lat: 14.7400, lng: -17.4100 },
  { label: 'Guinaw Rail, Pikine', city: 'Pikine', country: 'Sénégal', lat: 14.7500, lng: -17.3800 },
  { label: 'Thiaroye, Pikine', city: 'Pikine', country: 'Sénégal', lat: 14.7600, lng: -17.3600 },
  { label: 'Thiaroye Gare, Pikine', city: 'Pikine', country: 'Sénégal', lat: 14.7580, lng: -17.3620 },
  { label: 'Thiaroye sur Mer, Pikine', city: 'Pikine', country: 'Sénégal', lat: 14.7700, lng: -17.3500 },
  { label: 'Djiddah Thiaroye Kao, Pikine', city: 'Pikine', country: 'Sénégal', lat: 14.7650, lng: -17.3680 },
  { label: 'Diamaguène Sicap Mbao', city: 'Pikine', country: 'Sénégal', lat: 14.7550, lng: -17.3550 },
  { label: 'Mbao, Pikine', city: 'Pikine', country: 'Sénégal', lat: 14.7300, lng: -17.3300 },
  { label: 'Tivaouane Diacksao, Pikine', city: 'Pikine', country: 'Sénégal', lat: 14.7620, lng: -17.3720 },
  // ===== DÉPARTEMENT DE KEUR MASSAR =====
  { label: 'Keur Massar', city: 'Keur Massar', country: 'Sénégal', lat: 14.7800, lng: -17.3200 },
  { label: 'Keur Massar Nord', city: 'Keur Massar', country: 'Sénégal', lat: 14.7850, lng: -17.3180 },
  { label: 'Keur Massar Sud', city: 'Keur Massar', country: 'Sénégal', lat: 14.7750, lng: -17.3220 },
  { label: 'Malika, Keur Massar', city: 'Keur Massar', country: 'Sénégal', lat: 14.7900, lng: -17.3300 },
  { label: 'Yeumbeul Nord', city: 'Keur Massar', country: 'Sénégal', lat: 14.7820, lng: -17.3480 },
  { label: 'Yeumbeul Sud', city: 'Keur Massar', country: 'Sénégal', lat: 14.7760, lng: -17.3520 },
  { label: 'Jaxaay, Keur Massar', city: 'Keur Massar', country: 'Sénégal', lat: 14.8000, lng: -17.3050 },
  // ===== DÉPARTEMENT DE GUÉDIAWAYE =====
  { label: 'Guédiawaye', city: 'Guédiawaye', country: 'Sénégal', lat: 14.7860, lng: -17.3530 },
  { label: 'Golf Sud, Guédiawaye', city: 'Guédiawaye', country: 'Sénégal', lat: 14.7800, lng: -17.4000 },
  { label: 'Sam Notaire, Guédiawaye', city: 'Guédiawaye', country: 'Sénégal', lat: 14.7850, lng: -17.3900 },
  { label: 'Ndiarème Limamoulaye, Guédiawaye', city: 'Guédiawaye', country: 'Sénégal', lat: 14.7900, lng: -17.3850 },
  { label: 'Wakhinane Nimzatt, Guédiawaye', city: 'Guédiawaye', country: 'Sénégal', lat: 14.7880, lng: -17.3800 },
  { label: 'Médina Gounass, Guédiawaye', city: 'Guédiawaye', country: 'Sénégal', lat: 14.7950, lng: -17.3550 },
  { label: 'Cité Mixta, Guédiawaye', city: 'Guédiawaye', country: 'Sénégal', lat: 14.7900, lng: -17.3500 },
  // ===== DÉPARTEMENT DE RUFISQUE =====
  { label: 'Rufisque Centre', city: 'Rufisque', country: 'Sénégal', lat: 14.7090, lng: -17.2730 },
  { label: 'Rufisque Est', city: 'Rufisque', country: 'Sénégal', lat: 14.7150, lng: -17.2600 },
  { label: 'Rufisque Nord', city: 'Rufisque', country: 'Sénégal', lat: 14.7180, lng: -17.2700 },
  { label: 'Rufisque Ouest', city: 'Rufisque', country: 'Sénégal', lat: 14.7050, lng: -17.2820 },
  { label: 'Bargny, Rufisque', city: 'Rufisque', country: 'Sénégal', lat: 14.6950, lng: -17.2230 },
  { label: 'Sébikotane, Rufisque', city: 'Rufisque', country: 'Sénégal', lat: 14.7480, lng: -17.1380 },
  { label: 'Sangalkam, Rufisque', city: 'Rufisque', country: 'Sénégal', lat: 14.7800, lng: -17.2250 },
  { label: 'Bambilor, Rufisque', city: 'Rufisque', country: 'Sénégal', lat: 14.7900, lng: -17.2000 },
  { label: 'Tivaouane Peulh, Rufisque', city: 'Rufisque', country: 'Sénégal', lat: 14.8100, lng: -17.2400 },
  { label: 'Sendou, Rufisque', city: 'Rufisque', country: 'Sénégal', lat: 14.6700, lng: -17.1900 },
  // ===== RÉGION DE THIÈS =====
  { label: 'Thiès Centre', city: 'Thiès', country: 'Sénégal', lat: 14.7880, lng: -16.9260 },
  { label: 'Thiès Nord', city: 'Thiès', country: 'Sénégal', lat: 14.8000, lng: -16.9200 },
  { label: 'Thiès Est', city: 'Thiès', country: 'Sénégal', lat: 14.7850, lng: -16.9100 },
  { label: 'Thiès Ouest', city: 'Thiès', country: 'Sénégal', lat: 14.7900, lng: -16.9400 },
  { label: 'Médina Fall, Thiès', city: 'Thiès', country: 'Sénégal', lat: 14.7950, lng: -16.9300 },
  { label: 'Randoulène, Thiès', city: 'Thiès', country: 'Sénégal', lat: 14.7800, lng: -16.9150 },
  { label: 'Tivaouane Centre', city: 'Tivaouane', country: 'Sénégal', lat: 14.9500, lng: -16.8120 },
  { label: 'Khombole', city: 'Khombole', country: 'Sénégal', lat: 14.7660, lng: -16.6900 },
  { label: 'Pout', city: 'Pout', country: 'Sénégal', lat: 14.7710, lng: -17.0610 },
  { label: 'Kayar', city: 'Kayar', country: 'Sénégal', lat: 14.9180, lng: -17.1200 },
  // Diamniadio & Diass
  { label: 'Diamniadio', city: 'Diamniadio', country: 'Sénégal', lat: 14.7400, lng: -17.1700 },
  { label: 'Cité du Savoir, Diamniadio', city: 'Diamniadio', country: 'Sénégal', lat: 14.7350, lng: -17.1650 },
  { label: 'Diass', city: 'Diass', country: 'Sénégal', lat: 14.6800, lng: -17.1300 },
  // Petite Côte
  { label: 'Mbour Centre', city: 'Mbour', country: 'Sénégal', lat: 14.3920, lng: -16.9590 },
  { label: 'Saly, Mbour', city: 'Mbour', country: 'Sénégal', lat: 14.4530, lng: -16.9550 },
  { label: 'Saly Portudal', city: 'Mbour', country: 'Sénégal', lat: 14.4450, lng: -17.0200 },
  { label: 'Nguérigne, Mbour', city: 'Mbour', country: 'Sénégal', lat: 14.3800, lng: -16.9700 },
  { label: 'Ngaparou', city: 'Ngaparou', country: 'Sénégal', lat: 14.4700, lng: -17.0550 },
  { label: 'Somone', city: 'Somone', country: 'Sénégal', lat: 14.4880, lng: -17.0780 },
  { label: 'Popenguine', city: 'Popenguine', country: 'Sénégal', lat: 14.5550, lng: -17.1080 },
  { label: 'Joal-Fadiouth', city: 'Joal-Fadiouth', country: 'Sénégal', lat: 14.1670, lng: -16.8500 },
  { label: 'Nianing', city: 'Nianing', country: 'Sénégal', lat: 14.3450, lng: -16.9300 },
  { label: 'Warang', city: 'Warang', country: 'Sénégal', lat: 14.3700, lng: -16.9500 },
  // ===== RÉGION DE SAINT-LOUIS =====
  { label: 'Saint-Louis Centre', city: 'Saint-Louis', country: 'Sénégal', lat: 16.0330, lng: -16.5020 },
  { label: 'Sor, Saint-Louis', city: 'Saint-Louis', country: 'Sénégal', lat: 16.0400, lng: -16.4900 },
  { label: 'Ndar Tout, Saint-Louis', city: 'Saint-Louis', country: 'Sénégal', lat: 16.0250, lng: -16.5100 },
  { label: 'Guet Ndar, Saint-Louis', city: 'Saint-Louis', country: 'Sénégal', lat: 16.0270, lng: -16.5080 },
  { label: 'Richard Toll', city: 'Richard Toll', country: 'Sénégal', lat: 16.4620, lng: -15.7010 },
  { label: 'Dagana', city: 'Dagana', country: 'Sénégal', lat: 16.5150, lng: -15.5050 },
  { label: 'Podor', city: 'Podor', country: 'Sénégal', lat: 16.6500, lng: -14.9600 },
  { label: 'Gandon', city: 'Gandon', country: 'Sénégal', lat: 15.9500, lng: -16.4500 },
  // ===== RÉGION DE LOUGA =====
  { label: 'Louga Centre', city: 'Louga', country: 'Sénégal', lat: 15.6180, lng: -16.2260 },
  { label: 'Linguère', city: 'Linguère', country: 'Sénégal', lat: 15.3950, lng: -15.1190 },
  { label: 'Kébémer', city: 'Kébémer', country: 'Sénégal', lat: 15.3680, lng: -16.4410 },
  { label: 'Dahra', city: 'Dahra', country: 'Sénégal', lat: 15.3480, lng: -15.4800 },
  // ===== RÉGION DE MATAM =====
  { label: 'Matam Centre', city: 'Matam', country: 'Sénégal', lat: 15.6550, lng: -13.2550 },
  { label: 'Ourossogui', city: 'Ourossogui', country: 'Sénégal', lat: 15.6080, lng: -13.3220 },
  { label: 'Kanel', city: 'Kanel', country: 'Sénégal', lat: 15.4910, lng: -13.1760 },
  { label: 'Ranérou', city: 'Ranérou', country: 'Sénégal', lat: 15.2960, lng: -13.9550 },
  // ===== RÉGION DE DIOURBEL =====
  { label: 'Diourbel Centre', city: 'Diourbel', country: 'Sénégal', lat: 14.6550, lng: -16.2310 },
  { label: 'Bambey', city: 'Bambey', country: 'Sénégal', lat: 14.7000, lng: -16.4550 },
  { label: 'Touba Mosquée', city: 'Touba', country: 'Sénégal', lat: 14.8520, lng: -15.8830 },
  { label: 'Touba Mbacké', city: 'Touba', country: 'Sénégal', lat: 14.8300, lng: -15.9100 },
  { label: 'Mbacké Centre', city: 'Mbacké', country: 'Sénégal', lat: 14.7900, lng: -15.9080 },
  // ===== RÉGION DE FATICK =====
  { label: 'Fatick Centre', city: 'Fatick', country: 'Sénégal', lat: 14.3350, lng: -16.4000 },
  { label: 'Foundiougne', city: 'Foundiougne', country: 'Sénégal', lat: 14.1330, lng: -16.4660 },
  { label: 'Gossas', city: 'Gossas', country: 'Sénégal', lat: 14.4960, lng: -16.2820 },
  { label: 'Sokone', city: 'Sokone', country: 'Sénégal', lat: 13.8830, lng: -16.3720 },
  { label: 'Passy', city: 'Passy', country: 'Sénégal', lat: 14.1100, lng: -16.2600 },
  // ===== RÉGION DE KAOLACK =====
  { label: 'Kaolack Centre', city: 'Kaolack', country: 'Sénégal', lat: 14.1650, lng: -16.0750 },
  { label: 'Kaolack Médina', city: 'Kaolack', country: 'Sénégal', lat: 14.1550, lng: -16.0700 },
  { label: 'Nioro du Rip', city: 'Nioro du Rip', country: 'Sénégal', lat: 13.7500, lng: -15.7900 },
  { label: 'Guinguinéo', city: 'Guinguinéo', country: 'Sénégal', lat: 14.2660, lng: -15.9500 },
  { label: 'Kahone', city: 'Kahone', country: 'Sénégal', lat: 14.1550, lng: -16.0330 },
  // ===== RÉGION DE KAFFRINE =====
  { label: 'Kaffrine Centre', city: 'Kaffrine', country: 'Sénégal', lat: 14.1050, lng: -15.5500 },
  { label: 'Koungheul', city: 'Koungheul', country: 'Sénégal', lat: 13.9800, lng: -14.8000 },
  { label: 'Malem Hodar', city: 'Malem Hodar', country: 'Sénégal', lat: 14.0840, lng: -15.2960 },
  { label: 'Birkilane', city: 'Birkilane', country: 'Sénégal', lat: 14.1300, lng: -15.7500 },
  // ===== RÉGION DE TAMBACOUNDA =====
  { label: 'Tambacounda Centre', city: 'Tambacounda', country: 'Sénégal', lat: 13.7700, lng: -13.6700 },
  { label: 'Bakel', city: 'Bakel', country: 'Sénégal', lat: 14.9050, lng: -12.4550 },
  { label: 'Goudiry', city: 'Goudiry', country: 'Sénégal', lat: 14.1880, lng: -12.7170 },
  { label: 'Koumpentoum', city: 'Koumpentoum', country: 'Sénégal', lat: 13.9800, lng: -14.5600 },
  // ===== RÉGION DE KÉDOUGOU =====
  { label: 'Kédougou Centre', city: 'Kédougou', country: 'Sénégal', lat: 12.5570, lng: -12.1740 },
  { label: 'Saraya', city: 'Saraya', country: 'Sénégal', lat: 12.8300, lng: -11.7500 },
  { label: 'Salémata', city: 'Salémata', country: 'Sénégal', lat: 12.6300, lng: -12.8200 },
  // ===== RÉGION DE KOLDA =====
  { label: 'Kolda Centre', city: 'Kolda', country: 'Sénégal', lat: 12.8830, lng: -14.9500 },
  { label: 'Vélingara', city: 'Vélingara', country: 'Sénégal', lat: 13.1500, lng: -14.1160 },
  { label: 'Médina Yoro Foulah', city: 'Médina Yoro Foulah', country: 'Sénégal', lat: 13.2500, lng: -14.7000 },
  // ===== RÉGION DE SÉDHIOU =====
  { label: 'Sédhiou Centre', city: 'Sédhiou', country: 'Sénégal', lat: 12.7080, lng: -15.5570 },
  { label: 'Goudomp', city: 'Goudomp', country: 'Sénégal', lat: 12.5800, lng: -15.8700 },
  { label: 'Bounkiling', city: 'Bounkiling', country: 'Sénégal', lat: 13.0400, lng: -15.6900 },
  // ===== RÉGION DE ZIGUINCHOR (Casamance) =====
  { label: 'Ziguinchor Centre', city: 'Ziguinchor', country: 'Sénégal', lat: 12.5830, lng: -16.2720 },
  { label: 'Ziguinchor Boucotte', city: 'Ziguinchor', country: 'Sénégal', lat: 12.5750, lng: -16.2800 },
  { label: 'Bignona', city: 'Bignona', country: 'Sénégal', lat: 12.8100, lng: -16.2300 },
  { label: 'Oussouye', city: 'Oussouye', country: 'Sénégal', lat: 12.4850, lng: -16.5470 },
  { label: 'Cap Skirring', city: 'Cap Skirring', country: 'Sénégal', lat: 12.3550, lng: -16.7480 },
  { label: 'Kafountine', city: 'Kafountine', country: 'Sénégal', lat: 12.9280, lng: -16.7450 },
  { label: 'Diouloulou', city: 'Diouloulou', country: 'Sénégal', lat: 13.0480, lng: -16.5950 },
  // Aéroports & gares
  { label: 'Aéroport Blaise Diagne (AIBD)', city: 'Diass', country: 'Sénégal', lat: 14.6700, lng: -17.0730 },
  { label: 'Aéroport LSS (Léopold Sédar Senghor)', city: 'Dakar', country: 'Sénégal', lat: 14.7400, lng: -17.4900 },
  { label: 'Gare de Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6710, lng: -17.4350 },
  { label: 'Gare de Thiès', city: 'Thiès', country: 'Sénégal', lat: 14.7900, lng: -16.9250 },
  // Marchés, repères et lieux du quotidien (recherche locale, sans Google)
  { label: 'Sea Plaza, Almadies', city: 'Dakar', country: 'Sénégal', lat: 14.7458, lng: -17.5125 },
  { label: 'Auchan Almadies, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7445, lng: -17.5055 },
  { label: 'Pointe des Almadies, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7465, lng: -17.5190 },
  { label: 'Mamelles, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7315, lng: -17.5010 },
  { label: 'Monument de la Renaissance, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7220, lng: -17.4950 },
  { label: 'Mosquée de la Divinité, Ouakam', city: 'Dakar', country: 'Sénégal', lat: 14.7265, lng: -17.4985 },
  { label: 'King Fahd Palace, Almadies', city: 'Dakar', country: 'Sénégal', lat: 14.7480, lng: -17.5080 },
  { label: 'Radisson Blu, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6925, lng: -17.4705 },
  { label: 'Terrou-Bi, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6905, lng: -17.4725 },
  { label: 'Corniche Ouest, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6880, lng: -17.4685 },
  { label: 'Place de l\'Indépendance, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6702, lng: -17.4315 },
  { label: 'UCAD, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6915, lng: -17.4655 },
  { label: 'Université Cheikh Anta Diop, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6915, lng: -17.4655 },
  { label: 'Hôpital Principal, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6665, lng: -17.4355 },
  { label: 'Hôpital Fann, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6928, lng: -17.4668 },
  { label: 'Hôpital Aristide Le Dantec, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6628, lng: -17.4358 },
  { label: 'Soumbédioune, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6785, lng: -17.4585 },
  { label: 'Marché Soumbédioune, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6778, lng: -17.4592 },
  { label: 'Marché Castors, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7065, lng: -17.4475 },
  { label: 'Marché Petersen, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6688, lng: -17.4365 },
  { label: 'Canal 4, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6975, lng: -17.4555 },
  { label: 'Jet d\'eau, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6922, lng: -17.4528 },
  { label: 'Stade Léopold Sédar Senghor, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6935, lng: -17.4495 },
  { label: 'Gare routière des Baux Maraîchers, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7210, lng: -17.4560 },
  { label: 'Rond-point Sham, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7165, lng: -17.4675 },
  { label: 'Scat Urbam, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7120, lng: -17.4550 },
  { label: 'Ben Tally, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7185, lng: -17.4520 },
  { label: 'HLM Grand Médine, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7485, lng: -17.4320 },
  { label: 'Cité des Eaux, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7280, lng: -17.4480 },
  { label: 'Technopole, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7685, lng: -17.4180 },
  { label: 'Pikine Icotaf', city: 'Pikine', country: 'Sénégal', lat: 14.7575, lng: -17.3780 },
  { label: 'Keur Mbaye Fall, Pikine', city: 'Pikine', country: 'Sénégal', lat: 14.7485, lng: -17.3720 },
  { label: 'Zac Mbao, Pikine', city: 'Pikine', country: 'Sénégal', lat: 14.7380, lng: -17.3420 },
  { label: 'Lac Rose, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.8380, lng: -17.2340 },
  { label: 'Niaga, Lac Rose', city: 'Dakar', country: 'Sénégal', lat: 14.8280, lng: -17.2450 },
  { label: 'Diamniadio Centre', city: 'Diamniadio', country: 'Sénégal', lat: 14.7205, lng: -17.1850 },
  { label: 'AIBD, Diass', city: 'Diass', country: 'Sénégal', lat: 14.6700, lng: -17.0730 },
  { label: 'Saly Saly', city: 'Mbour', country: 'Sénégal', lat: 14.4480, lng: -16.9800 },
  { label: 'Somone Lagune', city: 'Somone', country: 'Sénégal', lat: 14.4920, lng: -17.0700 },
  { label: 'Touba Centre', city: 'Touba', country: 'Sénégal', lat: 14.8660, lng: -15.8760 },
  { label: 'Saint-Louis Sor', city: 'Saint-Louis', country: 'Sénégal', lat: 16.0175, lng: -16.4890 },
  { label: 'Kaolack Gambie', city: 'Kaolack', country: 'Sénégal', lat: 14.1510, lng: -16.0720 },
  ...dakarPracticalPlaces,
  { label: 'Marché Sandaga, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6680, lng: -17.4380 },
  { label: 'Marché HLM, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7520, lng: -17.4250 },
  { label: 'Marché Tilène, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6720, lng: -17.4480 },
  { label: 'Marché Kermel, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6700, lng: -17.4330 },
  { label: 'Cité Asecna, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.6900, lng: -17.4500 },
  { label: 'Cité Keur Baye Gouye, Dakar', city: 'Dakar', country: 'Sénégal', lat: 14.7150, lng: -17.4500 },
  // Diaspora - pays communs
  { label: 'Paris, France', city: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
  { label: 'Marseille, France', city: 'Marseille', country: 'France', lat: 43.2965, lng: 5.3698 },
  { label: 'Lyon, France', city: 'Lyon', country: 'France', lat: 45.7640, lng: 4.8357 },
  { label: 'Toulouse, France', city: 'Toulouse', country: 'France', lat: 43.6047, lng: 1.4442 },
  { label: 'Bordeaux, France', city: 'Bordeaux', country: 'France', lat: 44.8378, lng: -0.5792 },
  { label: 'Lille, France', city: 'Lille', country: 'France', lat: 50.6292, lng: 3.0573 },
  { label: 'New York, USA', city: 'New York', country: 'USA', lat: 40.7128, lng: -74.0060 },
  { label: 'Atlanta, USA', city: 'Atlanta', country: 'USA', lat: 33.7490, lng: -84.3880 },
  { label: 'Washington DC, USA', city: 'Washington', country: 'USA', lat: 38.9072, lng: -77.0369 },
  { label: 'Rome, Italie', city: 'Rome', country: 'Italie', lat: 41.9028, lng: 12.4964 },
  { label: 'Milan, Italie', city: 'Milan', country: 'Italie', lat: 45.4642, lng: 9.1900 },
  { label: 'Madrid, Espagne', city: 'Madrid', country: 'Espagne', lat: 40.4168, lng: -3.7038 },
  { label: 'Barcelone, Espagne', city: 'Barcelone', country: 'Espagne', lat: 41.3851, lng: 2.1734 },
  { label: 'Londres, Royaume-Uni', city: 'Londres', country: 'Royaume-Uni', lat: 51.5074, lng: -0.1278 },
  { label: 'Bruxelles, Belgique', city: 'Bruxelles', country: 'Belgique', lat: 50.8503, lng: 4.3517 },
  { label: 'Berlin, Allemagne', city: 'Berlin', country: 'Allemagne', lat: 52.5200, lng: 13.4050 },
  { label: 'Hambourg, Allemagne', city: 'Hambourg', country: 'Allemagne', lat: 53.5511, lng: 9.9937 },
  { label: 'Montréal, Canada', city: 'Montréal', country: 'Canada', lat: 45.5017, lng: -73.5673 },
  { label: 'Toronto, Canada', city: 'Toronto', country: 'Canada', lat: 43.6532, lng: -79.3832 },
  { label: 'Dubaï, EAU', city: 'Dubaï', country: 'Émirats Arabes Unis', lat: 25.2048, lng: 55.2708 },
  { label: 'Abidjan, Côte d\'Ivoire', city: 'Abidjan', country: 'Côte d\'Ivoire', lat: 5.3600, lng: -4.0083 },
  { label: 'Bamako, Mali', city: 'Bamako', country: 'Mali', lat: 12.6392, lng: -8.0029 },
  { label: 'Conakry, Guinée', city: 'Conakry', country: 'Guinée', lat: 9.6412, lng: -13.5784 },
  { label: 'Nouakchott, Mauritanie', city: 'Nouakchott', country: 'Mauritanie', lat: 18.0735, lng: -15.9582 },
];

// Normalise une chaîne: minuscules + suppression des accents (é -> e) pour
// que "medina" matche "Médina", "liberte" matche "Liberté", etc.
// Développe aussi "u8" / "parcelle u8" → "unite 8" pour les Parcelles Assainies.
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Virgules / ponctuation iOS → espaces (sinon "Castors, Dakar" peut rater)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\bpolices\b/g, 'police')
    .replace(/\btribunaux\b/g, 'tribunal')
    .replace(/\bcommissariats\b/g, 'commissariat')
    .replace(/\bgendarmeries\b/g, 'gendarmerie')
    .replace(/\bmarches\b/g, 'marche')
    .replace(/\bhopitaux\b/g, 'hopital')
    .replace(/\bmairies\b/g, 'mairie')
    .replace(/\bparcelle[s]?\s*u\s*(\d{1,2})\b/g, 'parcelles assainies unite $1 u$1')
    .replace(/\bu\s*(\d{1,2})\b/g, 'unite $1 u$1')
    .replace(/\bunite\s*(\d{1,2})\b/g, 'unite $1 u$1');
}

const CATEGORY_HEAD = /^(tribunal|justice|palais|police|commissariat|gendarmerie|gendarme|marche|apix|hopital|clinique|mairie|prefecture|ministere|douane|poste|universite|lycee|mosquee|eglise|banque|gare|stade|plage|port)$/;

function matchesQuery(hay: string, q: string): number {
  if (!q) return -1;
  if (hay.startsWith(q)) return 0;
  if (hay.includes(q)) return 2;
  const stop = new Set(['les', 'la', 'le', 'des', 'du', 'de', 'au', 'aux', 'en', 'a']);
  const parts = q.split(/\s+/).filter((part) => part && !stop.has(part));
  if (parts.length >= 1 && parts.every((part) => hay.includes(part))) return parts.length > 1 ? 4 : 2;
  return -1;
}

export function searchLocations(query: string): SenegalLocation[] {
  if (!query || query.trim().length < 1) return [];
  const q = normalize(query.trim());
  const tokens = q.split(/\s+/).filter(Boolean);
  const limit = tokens.some((token) => CATEGORY_HEAD.test(token)) ? 48 : 24;
  const scored = senegalLocations
    .map((loc) => {
      const label = normalize(loc.label);
      const extra = normalize(loc.aliases || '');
      const city = normalize(loc.city);
      const hay = `${label} ${extra}`;
      let score = matchesQuery(hay, q);
      if (score < 0 && city.startsWith(q)) score = 1;
      else if (score < 0 && city.includes(q)) score = 3;
      return { loc, score };
    })
    .filter((x) => x.score >= 0)
    .sort((a, b) => a.score - b.score || a.loc.label.localeCompare(b.loc.label, 'fr'));
  return scored.slice(0, limit).map((x) => x.loc);
}
