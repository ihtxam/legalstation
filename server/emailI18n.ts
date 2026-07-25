import { isAppLocale, type AppLocale } from "@shared/locales";

type InviteStrings = {
  firmSubject: (firmName: string) => string;
  firmHeading: (firmName: string) => string;
  firmBody: (inviterName: string, firmName: string) => string;
  firmCta: string;
  firmExpiry: string;
  firmFooter: string;
  clientSubject: string;
  clientHeading: (firmName: string) => string;
  clientBody: (firmName: string) => string;
  clientCta: string;
  clientHint: string;
  clientExpiry: string;
  clientFooter: string;
  greeting: string;
};

const INVITE_I18N: Record<AppLocale, InviteStrings> = {
  en: {
    greeting: "Hi,",
    firmSubject: (firmName) => `Join ${firmName} on LexFlow`,
    firmHeading: (firmName) => `Join ${firmName} on LexFlow`,
    firmBody: (inviterName, firmName) =>
      `${inviterName} has invited you to join <strong>${firmName}</strong> on LexFlow, a modern legal practice management platform.`,
    firmCta: "Create account &amp; join",
    firmExpiry:
      "This invitation expires in 7 days. If you have questions, contact your firm administrator.",
    firmFooter: "LexFlow — Swiss Legal Practice Management",
    clientSubject: "Access your case information on LexFlow",
    clientHeading: (firmName) => `Welcome to ${firmName}'s LexFlow Portal`,
    clientBody: (firmName) =>
      `<strong>${firmName}</strong> has invited you to access your case information and documents through LexFlow, a secure legal practice management platform.`,
    clientCta: "Get Started",
    clientHint:
      "You'll be able to view your cases, upload documents, and communicate securely with your legal team.",
    clientExpiry: "This invitation expires in 7 days.",
    clientFooter: "LexFlow — Swiss Legal Practice Management",
  },
  fr: {
    greeting: "Bonjour,",
    firmSubject: (firmName) => `Rejoindre ${firmName} sur LexFlow`,
    firmHeading: (firmName) => `Rejoindre ${firmName} sur LexFlow`,
    firmBody: (inviterName, firmName) =>
      `${inviterName} vous a invité à rejoindre <strong>${firmName}</strong> sur LexFlow, une plateforme moderne de gestion de cabinet juridique.`,
    firmCta: "Créer un compte et rejoindre",
    firmExpiry:
      "Cette invitation expire dans 7 jours. Pour toute question, contactez l'administrateur de votre cabinet.",
    firmFooter: "LexFlow — Gestion de cabinet juridique suisse",
    clientSubject: "Accédez à vos dossiers sur LexFlow",
    clientHeading: (firmName) => `Bienvenue sur le portail LexFlow de ${firmName}`,
    clientBody: (firmName) =>
      `<strong>${firmName}</strong> vous invite à accéder à vos dossiers et documents via LexFlow, une plateforme sécurisée de gestion juridique.`,
    clientCta: "Commencer",
    clientHint:
      "Vous pourrez consulter vos dossiers, téléverser des documents et communiquer en toute sécurité avec votre équipe juridique.",
    clientExpiry: "Cette invitation expire dans 7 jours.",
    clientFooter: "LexFlow — Gestion de cabinet juridique suisse",
  },
  de: {
    greeting: "Guten Tag,",
    firmSubject: (firmName) => `${firmName} auf LexFlow beitreten`,
    firmHeading: (firmName) => `${firmName} auf LexFlow beitreten`,
    firmBody: (inviterName, firmName) =>
      `${inviterName} hat Sie eingeladen, <strong>${firmName}</strong> auf LexFlow beizutreten — einer modernen Plattform für Kanzleimanagement.`,
    firmCta: "Konto erstellen &amp; beitreten",
    firmExpiry:
      "Diese Einladung läuft in 7 Tagen ab. Bei Fragen wenden Sie sich an Ihren Kanzleiadministrator.",
    firmFooter: "LexFlow — Schweizer Kanzleimanagement",
    clientSubject: "Greifen Sie auf Ihre Fallinformationen in LexFlow zu",
    clientHeading: (firmName) => `Willkommen im LexFlow-Portal von ${firmName}`,
    clientBody: (firmName) =>
      `<strong>${firmName}</strong> hat Sie eingeladen, Ihre Fallinformationen und Dokumente über LexFlow — eine sichere Plattform für juristische Zusammenarbeit — einzusehen.`,
    clientCta: "Loslegen",
    clientHint:
      "Sie können Ihre Fälle einsehen, Dokumente hochladen und sicher mit Ihrem Rechtsteam kommunizieren.",
    clientExpiry: "Diese Einladung läuft in 7 Tagen ab.",
    clientFooter: "LexFlow — Schweizer Kanzleimanagement",
  },
  it: {
    greeting: "Ciao,",
    firmSubject: (firmName) => `Unisciti a ${firmName} su LexFlow`,
    firmHeading: (firmName) => `Unisciti a ${firmName} su LexFlow`,
    firmBody: (inviterName, firmName) =>
      `${inviterName} ti ha invitato a unirti a <strong>${firmName}</strong> su LexFlow, una piattaforma moderna per la gestione degli studi legali.`,
    firmCta: "Crea account e unisciti",
    firmExpiry:
      "Questo invito scade tra 7 giorni. Per domande, contatta l'amministratore del tuo studio.",
    firmFooter: "LexFlow — Gestione studi legali svizzeri",
    clientSubject: "Accedi alle informazioni della tua pratica su LexFlow",
    clientHeading: (firmName) => `Benvenuto nel portale LexFlow di ${firmName}`,
    clientBody: (firmName) =>
      `<strong>${firmName}</strong> ti ha invitato ad accedere alle informazioni e ai documenti della tua pratica tramite LexFlow, una piattaforma legale sicura.`,
    clientCta: "Inizia",
    clientHint:
      "Potrai visualizzare le tue pratiche, caricare documenti e comunicare in modo sicuro con il tuo team legale.",
    clientExpiry: "Questo invito scade tra 7 giorni.",
    clientFooter: "LexFlow — Gestione studi legali svizzeri",
  },
  ar: {
    greeting: "مرحبًا،",
    firmSubject: (firmName) => `انضم إلى ${firmName} على LexFlow`,
    firmHeading: (firmName) => `انضم إلى ${firmName} على LexFlow`,
    firmBody: (inviterName, firmName) =>
      `دعاك ${inviterName} للانضمام إلى <strong>${firmName}</strong> على LexFlow، منصة حديثة لإدارة مكاتب المحاماة.`,
    firmCta: "إنشاء حساب والانضمام",
    firmExpiry: "تنتهي صلاحية هذه الدعوة خلال 7 أيام. لأي استفسار، تواصل مع مسؤول مكتبك.",
    firmFooter: "LexFlow — إدارة مكاتب المحاماة السويسرية",
    clientSubject: "الوصول إلى معلومات قضيتك على LexFlow",
    clientHeading: (firmName) => `مرحبًا بك في بوابة LexFlow الخاصة بـ ${firmName}`,
    clientBody: (firmName) =>
      `دعاك <strong>${firmName}</strong> للوصول إلى معلومات قضيتك ومستنداتك عبر LexFlow، منصة قانونية آمنة.`,
    clientCta: "ابدأ الآن",
    clientHint: "ستتمكن من عرض قضاياك ورفع المستندات والتواصل بأمان مع فريقك القانوني.",
    clientExpiry: "تنتهي صلاحية هذه الدعوة خلال 7 أيام.",
    clientFooter: "LexFlow — إدارة مكاتب المحاماة السويسرية",
  },
};

export function resolveInviteLocale(locale?: string | null): AppLocale {
  return isAppLocale(locale) ? locale : "en";
}

export function getInviteEmailStrings(locale?: string | null): InviteStrings {
  return INVITE_I18N[resolveInviteLocale(locale)];
}
