-- Seed data for Bag'up
-- Password for all users: test123 (bcrypt hash below)

-- ============ USERS ============
-- Clients
INSERT INTO "User" (id, phone, email, password, role, "isVerified", "firstName", "lastName", address, country, "referralCode", "createdAt", "updatedAt")
VALUES
('c1-0001', '+221771234567', 'amina.diallo@gmail.com', '$2b$10$xfxVcdZgUfwZM.ygywZCr.MuqZfsFXgNalSc5fXrcU.LNLNuYAUwK', 'client', true, 'Amina', 'Diallo', 'Medina, Dakar', 'Sénégal', 'BAG-AMINA', NOW() - INTERVAL '30 days', NOW()),
('c1-0002', '+221772345678', 'ousmane.fall@gmail.com', '$2b$10$xfxVcdZgUfwZM.ygywZCr.MuqZfsFXgNalSc5fXrcU.LNLNuYAUwK', 'client', true, 'Ousmane', 'Fall', 'Pikine, Dakar', 'Sénégal', 'BAG-OUSMA', NOW() - INTERVAL '25 days', NOW()),
('c1-0003', '+221773456789', 'fatou.ndiaye@gmail.com', '$2b$10$xfxVcdZgUfwZM.ygywZCr.MuqZfsFXgNalSc5fXrcU.LNLNuYAUwK', 'client', true, 'Fatou', 'Ndiaye', 'Rufisque, Dakar', 'Sénégal', 'BAG-FATOU', NOW() - INTERVAL '20 days', NOW()),
('c1-0004', '+221774567890', 'moussa.sow@gmail.com', '$2b$10$xfxVcdZgUfwZM.ygywZCr.MuqZfsFXgNalSc5fXrcU.LNLNuYAUwK', 'client', true, 'Moussa', 'Sow', 'Keur Massar, Dakar', 'Sénégal', 'BAG-MOUSS', NOW() - INTERVAL '15 days', NOW()),
('c1-0005', '+221775678901', 'aissatou.ba@gmail.com', '$2b$10$xfxVcdZgUfwZM.ygywZCr.MuqZfsFXgNalSc5fXrcU.LNLNuYAUwK', 'client', true, 'Aissatou', 'Ba', 'Guédiawaye, Dakar', 'Sénégal', 'BAG-AISSA', NOW() - INTERVAL '10 days', NOW());

-- Providers (prestataires)
INSERT INTO "User" (id, phone, email, password, role, "isVerified", "firstName", "lastName", address, country, "referralCode", "vehicleType", zone, "serviceCategories", rating, "totalRatings", "subscriptionStatus", "subscriptionExpiry", "createdAt", "updatedAt")
VALUES
('p1-0001', '+221781111111', 'ibrahima.gueye@bagup.sn', '$2b$10$xfxVcdZgUfwZM.ygywZCr.MuqZfsFXgNalSc5fXrcU.LNLNuYAUwK', 'provider', true, 'Ibrahima', 'Gueye', 'Dakar Plateau', 'Sénégal', 'BAG-IBRA', 'moto', 'Dakar', 'collecte_livraison', 4.8, 23, 'active', NOW() + INTERVAL '20 days', NOW() - INTERVAL '28 days', NOW()),
('p1-0002', '+221782222222', 'cheikh.diop@bagup.sn', '$2b$10$xfxVcdZgUfwZM.ygywZCr.MuqZfsFXgNalSc5fXrcU.LNLNuYAUwK', 'provider', true, 'Cheikh', 'Diop', 'Pikine', 'Sénégal', 'BAG-CHEIK', 'moto', 'Pikine', 'collecte_livraison,demarches_admin', 4.5, 15, 'active', NOW() + INTERVAL '15 days', NOW() - INTERVAL '22 days', NOW()),
('p1-0003', '+221783333333', 'modou.kane@bagup.sn', '$2b$10$xfxVcdZgUfwZM.ygywZCr.MuqZfsFXgNalSc5fXrcU.LNLNuYAUwK', 'provider', true, 'Modou', 'Kane', 'Rufisque', 'Sénégal', 'BAG-MODOU', 'voiture', 'Rufisque', 'collecte_livraison', 4.2, 8, 'active', NOW() + INTERVAL '10 days', NOW() - INTERVAL '18 days', NOW()),
('p1-0004', '+221784444444', 'bassirou.sarr@bagup.sn', '$2b$10$xfxVcdZgUfwZM.ygywZCr.MuqZfsFXgNalSc5fXrcU.LNLNuYAUwK', 'provider', false, 'Bassirou', 'Sarr', 'Keur Massar', 'Sénégal', 'BAG-BASS', 'moto', 'Keur Massar', 'collecte_livraison', 0, 0, 'trial', NOW() + INTERVAL '5 days', NOW() - INTERVAL '5 days', NOW()),
('p1-0005', '+221785555555', 'pape.mbaye@bagup.sn', '$2b$10$xfxVcdZgUfwZM.ygywZCr.MuqZfsFXgNalSc5fXrcU.LNLNuYAUwK', 'provider', true, 'Pape', 'Mbaye', 'Guédiawaye', 'Sénégal', 'BAG-PAPE', 'velo', 'Guédiawaye', 'collecte_livraison', 4.9, 31, 'active', NOW() + INTERVAL '25 days', NOW() - INTERVAL '35 days', NOW());

-- ============ MISSIONS ============
INSERT INTO "Mission" (id, "serviceType", urgency, "pickupAddress", "deliveryAddress", description, price, status, "clientId", "providerId", "createdAt", "updatedAt")
VALUES
('m1-0001', 'colis', 'express', 'Sacré-Cœur, Dakar', 'Mermoz, Dakar', 'Colis 2kg - vêtements', 2500, 'delivered', 'c1-0001', 'p1-0001', NOW() - INTERVAL '25 days', NOW() - INTERVAL '24 days'),
('m1-0002', 'documents', 'standard', 'Plateau, Dakar', 'Fann, Dakar', 'Livraison de documents administratifs', 1500, 'delivered', 'c1-0002', 'p1-0001', NOW() - INTERVAL '22 days', NOW() - INTERVAL '21 days'),
('m1-0003', 'courses', 'express', 'Sandaga, Dakar', 'Liberté 6, Dakar', 'Courses au marché', 3000, 'delivered', 'c1-0003', 'p1-0002', NOW() - INTERVAL '18 days', NOW() - INTERVAL '17 days'),
('m1-0004', 'colis', 'standard', 'Pikine, Dakar', 'Parcelles, Dakar', 'Colis électronique 5kg', 4000, 'delivered', 'c1-0004', 'p1-0002', NOW() - INTERVAL '15 days', NOW() - INTERVAL '14 days'),
('m1-0005', 'marchandises', 'programme', 'Rufisque', 'Dakar Plateau', 'Marchandises 20kg', 7500, 'delivered', 'c1-0005', 'p1-0003', NOW() - INTERVAL '12 days', NOW() - INTERVAL '11 days'),
('m1-0006', 'documents', 'express', 'Keur Massar', 'Almadies, Dakar', 'Documents urgents', 3500, 'in_progress', 'c1-0001', 'p1-0005', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'),
('m1-0007', 'colis', 'standard', 'Guédiawaye', 'Yoff, Dakar', 'Colis cadeau', 2000, 'accepted', 'c1-0002', 'p1-0001', NOW() - INTERVAL '1 day', NOW()),
('m1-0008', 'courses', 'express', 'Castors, Dakar', 'Point E, Dakar', 'Courses pharmacie', 1800, 'pending', 'c1-0003', NULL, NOW() - INTERVAL '6 hours', NOW()),
('m1-0009', 'objets_personnels', 'standard', 'Mermoz, Dakar', 'Ouakam, Dakar', 'Récupérer clés', 1500, 'pending', 'c1-0004', NULL, NOW() - INTERVAL '3 hours', NOW()),
('m1-0010', 'livraison_entreprise', 'programme', 'Zone des Niayes', 'Dakar Plateau', 'Livraison entreprise - 10 colis', 12000, 'delivered', 'c1-0005', 'p1-0003', NOW() - INTERVAL '8 days', NOW() - INTERVAL '7 days'),
('m1-0011', 'colis', 'express', 'Liberté 6, Dakar', 'Sacré-Cœur, Dakar', 'Colis urgent 1kg', 2000, 'picked_up', 'c1-0001', 'p1-0005', NOW() - INTERVAL '1 day', NOW()),
('m1-0012', 'documents', 'standard', 'Fann, Dakar', 'Plateau, Dakar', 'Dossier administratif', 1500, 'cancelled', 'c1-0002', NULL, NOW() - INTERVAL '5 days', NOW() - INTERVAL '4 days');

-- ============ PAYMENTS ============
INSERT INTO "Payment" (id, amount, method, status, "userId", "missionId", "createdAt", "updatedAt")
VALUES
('pay-0001', 2500, 'orange_money', 'success', 'c1-0001', 'm1-0001', NOW() - INTERVAL '24 days', NOW() - INTERVAL '24 days'),
('pay-0002', 1500, 'wave', 'success', 'c1-0002', 'm1-0002', NOW() - INTERVAL '21 days', NOW() - INTERVAL '21 days'),
('pay-0003', 3000, 'free_money', 'success', 'c1-0003', 'm1-0003', NOW() - INTERVAL '17 days', NOW() - INTERVAL '17 days'),
('pay-0004', 4000, 'orange_money', 'success', 'c1-0004', 'm1-0004', NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'),
('pay-0005', 7500, 'card', 'success', 'c1-0005', 'm1-0005', NOW() - INTERVAL '11 days', NOW() - INTERVAL '11 days'),
('pay-0006', 12000, 'orange_money', 'success', 'c1-0005', 'm1-0010', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days'),
('pay-0007', 3500, 'wave', 'pending', 'c1-0001', 'm1-0006', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day');

-- ============ SUBSCRIPTIONS ============
INSERT INTO "Subscription" (id, type, amount, status, "startDate", "endDate", "userId", "createdAt")
VALUES
('sub-0001', 'registration', 5000, 'success', NOW() - INTERVAL '28 days', NULL, 'p1-0001', NOW() - INTERVAL '28 days'),
('sub-0002', 'monthly', 5000, 'success', NOW() - INTERVAL '28 days', NOW() + INTERVAL '2 days', 'p1-0001', NOW() - INTERVAL '28 days'),
('sub-0003', 'registration', 5000, 'success', NOW() - INTERVAL '22 days', NULL, 'p1-0002', NOW() - INTERVAL '22 days'),
('sub-0004', 'monthly', 5000, 'success', NOW() - INTERVAL '22 days', NOW() + INTERVAL '8 days', 'p1-0002', NOW() - INTERVAL '22 days'),
('sub-0005', 'registration', 5000, 'success', NOW() - INTERVAL '18 days', NULL, 'p1-0003', NOW() - INTERVAL '18 days'),
('sub-0006', 'monthly', 5000, 'success', NOW() - INTERVAL '18 days', NOW() + INTERVAL '12 days', 'p1-0003', NOW() - INTERVAL '18 days'),
('sub-0007', 'registration', 5000, 'success', NOW() - INTERVAL '5 days', NULL, 'p1-0004', NOW() - INTERVAL '5 days'),
('sub-0008', 'monthly', 5000, 'pending', NOW() - INTERVAL '5 days', NOW() + INTERVAL '25 days', 'p1-0004', NOW() - INTERVAL '5 days'),
('sub-0009', 'registration', 5000, 'success', NOW() - INTERVAL '35 days', NULL, 'p1-0005', NOW() - INTERVAL '35 days'),
('sub-0010', 'monthly', 5000, 'success', NOW() - INTERVAL '35 days', NOW() + INTERVAL '25 days', 'p1-0005', NOW() - INTERVAL '35 days');

-- ============ REFERRALS ============
INSERT INTO "Referral" (id, "referrerId", "referredId", code, "rewardType", "rewardStatus", "createdAt")
VALUES
('ref-0001', 'c1-0001', 'c1-0002', 'BAG-AMINA-001', 'credit', 'rewarded', NOW() - INTERVAL '20 days'),
('ref-0002', 'c1-0001', 'c1-0003', 'BAG-AMINA-002', 'credit', 'rewarded', NOW() - INTERVAL '15 days'),
('ref-0003', 'p1-0001', 'p1-0004', 'BAG-IBRA-001', 'free_month', 'pending', NOW() - INTERVAL '5 days'),
('ref-0004', 'c1-0002', 'c1-0004', 'BAG-OUSMA-001', 'credit', 'pending', NOW() - INTERVAL '8 days');

-- ============ RATINGS ============
INSERT INTO "Rating" (id, score, comment, "raterId", "ratedId", "missionId", "createdAt")
VALUES
('rat-0001', 5, 'Excellent service, très rapide', 'c1-0001', 'p1-0001', 'm1-0001', NOW() - INTERVAL '24 days'),
('rat-0002', 4, 'Bon service', 'c1-0002', 'p1-0001', 'm1-0002', NOW() - INTERVAL '21 days'),
('rat-0003', 5, 'Parfait, livré en avance', 'c1-0003', 'p1-0002', 'm1-0003', NOW() - INTERVAL '17 days'),
('rat-0004', 4, 'Satisfait', 'c1-0004', 'p1-0002', 'm1-0004', NOW() - INTERVAL '14 days'),
('rat-0005', 5, 'Très professionnel', 'c1-0005', 'p1-0003', 'm1-0005', NOW() - INTERVAL '11 days'),
('rat-0006', 5, 'Rapide et sérieux', 'c1-0005', 'p1-0003', 'm1-0010', NOW() - INTERVAL '7 days');
