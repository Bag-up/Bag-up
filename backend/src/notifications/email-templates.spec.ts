import {
  missionAcceptedEmail,
  missionCreatedEmail,
  missionDeliveredEmail,
  notificationEmail,
  passwordResetEmail,
  phoneVerificationEmail,
  paymentReceiptEmail,
  welcomeClientEmail,
  accountPendingReviewEmail,
  accountActivatedEmail,
  staffAccountPendingReviewEmail,
} from './email-templates';

describe('email-templates', () => {
  it('passwordReset contient le code', () => {
    const mail = passwordResetEmail({ firstName: 'El', code: 'AB12CD34' });
    expect(mail.subject).toContain('Réinitialisation');
    expect(mail.html).toContain('AB12CD34');
    expect(mail.html).toContain("Bag'up");
  });

  it('phoneVerification contient le code', () => {
    const mail = phoneVerificationEmail({ firstName: 'Awa', code: '654321' });
    expect(mail.subject).toContain('vérification');
    expect(mail.html).toContain('654321');
    expect(mail.html).toContain('5 minutes');
  });

  it('welcome / pending / activated', () => {
    expect(welcomeClientEmail({ firstName: 'Awa' }).subject).toContain('Bienvenue');
    expect(accountPendingReviewEmail({ firstName: 'El', role: 'provider' }).html).toContain('en attente');
    expect(accountActivatedEmail({ firstName: 'El', role: 'merchant' }).html).toContain('actif');
  });

  it('staffAccountPendingReview pointe vers le back-office', () => {
    const mail = staffAccountPendingReviewEmail({
      staffFirstName: 'Admin',
      applicantName: 'Awa Diallo',
      role: 'provider',
      phone: '+221770000000',
      reviewUrl: 'https://admin.bagup.app/users/abc',
    });
    expect(mail.subject).toContain('à valider');
    expect(mail.html).toContain('https://admin.bagup.app/users/abc');
    expect(mail.html).toContain('Awa Diallo');
  });

  it('notification générique', () => {
    const mail = notificationEmail({
      firstName: 'El',
      title: 'Info',
      message: 'Message test',
    });
    expect(mail.subject).toBe("Bag'up — Info");
    expect(mail.html).toContain('Message test');
  });

  it('missionCreated / accepted / delivered', () => {
    expect(
      missionCreatedEmail({
        serviceType: 'colis',
        pickupAddress: 'Dakar',
        deliveryAddress: 'Pikine',
        price: 2500,
      }).html,
    ).toContain('2');
    expect(missionAcceptedEmail({ providerName: 'Amadou' }).html).toContain('Amadou');
    expect(missionDeliveredEmail({ deliveryAddress: 'Pikine' }).subject).toContain('livraison');
  });

  it('paymentReceipt affiche le montant', () => {
    const mail = paymentReceiptEmail({
      amount: 5000,
      kind: 'subscription',
      transactionId: 'TXN-1',
      method: 'wave',
    });
    expect(mail.html).toContain('5');
    expect(mail.html).toContain('TXN-1');
  });
});
