/**
 * Single source of truth for the Privacy Policy and Terms of Service.
 *
 * MIRROR of store/src/lib/legal/documents.ts — edit the web copy first, then
 * copy it here. Rendered natively by app/legal/[doc].tsx (no network needed).
 *
 * Public URLs (used in App Store Connect + Google Play Console):
 *   https://vestara.lk/legal/privacy
 *   https://vestara.lk/legal/privacy#delete-account   (data deletion URL)
 *   https://vestara.lk/legal/terms
 */

export type LegalBlock =
  | { type: "p"; text: string }
  | { type: "list"; items: { term?: string; text: string }[] }
  | { type: "callout"; title: string; text: string }
  | { type: "table"; head: [string, string, string]; rows: [string, string, string][] };

export interface LegalSection {
  id: string;
  title: string;
  /** One-line plain-language summary shown beside the formal text. */
  inShort: string;
  blocks: LegalBlock[];
}

export interface LegalDoc {
  slug: "privacy" | "terms";
  kicker: string;
  title: string;
  intro: string;
  updated: string; // ISO date
  readMinutes: number;
  highlights: { title: string; text: string }[];
  sections: LegalSection[];
  contactEmail: string;
}

export const LEGAL_ENTITY = "VESTARA Atelier (Pvt) Ltd";
export const LEGAL_ADDRESS = "85/1, Courts Road, Mawanella, Sri Lanka";
/** Public support / privacy / legal contact (single mailbox). */
export const SUPPORT_EMAIL = "munxhd@gmail.com";
/** Developer account the apps are published under on Google Play / App Store (publisher only; VESTARA is the data controller). */
export const APP_PUBLISHER = "CodeworkLab";
export const APP_PUBLISHER_EMAIL = "info@codeworklab.com";
export const SITE_ORIGIN = "https://vestara.lk";

export const PRIVACY_POLICY: LegalDoc = {
  slug: "privacy",
  kicker: "Privacy Policy",
  title: "Your data, handled with care.",
  intro:
    "This policy explains what personal data VESTARA collects when you use our website and mobile apps, why we collect it, who we share it with, and the choices you have — including how to delete your account at any time.",
  updated: "2026-11-08",
  readMinutes: 8,
  contactEmail: "munxhd@gmail.com",
  highlights: [
    { title: "We never sell your data", text: "Your profile, contacts and order history are never sold or rented to anyone." },
    { title: "Cards never touch our servers", text: "Card payments are processed by Stripe. We never see or store your full card number." },
    { title: "Delete anytime, in-app", text: "Account → Settings → Delete account removes your profile and personal data." },
    { title: "Permissions are optional", text: "Camera, photos, location and notifications are only used when you choose a feature that needs them." },
  ],
  sections: [
    {
      id: "who-we-are",
      title: "Who we are",
      inShort: "VESTARA is a Sri Lankan fashion marketplace. CodeworkLab publishes our apps; we are responsible for your data.",
      blocks: [
        {
          type: "p",
          text: `VESTARA is an online fashion marketplace operated by ${LEGAL_ENTITY}, ${LEGAL_ADDRESS} ("VESTARA", "we", "us"). Independent sellers ("Stores") list products on VESTARA and we provide the platform, checkout, delivery coordination and customer support.`,
        },
        {
          type: "p",
          text: `The VESTARA iOS and Android apps are published on the App Store and Google Play under the developer account of ${APP_PUBLISHER} (${APP_PUBLISHER_EMAIL}), on behalf of VESTARA. ${APP_PUBLISHER} acts only as the store publisher: it has no access to your VESTARA account, orders or payment details, and sees only the aggregated download, crash and usage statistics that Apple and Google provide to app publishers. VESTARA operates the Services, decides how your personal data is used, and remains responsible for it under this policy.`,
        },
        {
          type: "p",
          text: "We are the data controller for personal data processed through the VESTARA website (vestara.lk) and the VESTARA iOS and Android apps (together, the \"Services\"). We process personal data in line with the Sri Lanka Personal Data Protection Act No. 9 of 2022 and, where they apply to you, other data protection laws such as the GDPR.",
        },
      ],
    },
    {
      id: "data-we-collect",
      title: "Data we collect",
      inShort: "What you give us, what is created when you shop, and basic technical data.",
      blocks: [
        { type: "p", text: "We only collect what we need to run the Services. Depending on how you use VESTARA, this includes:" },
        {
          type: "table",
          head: ["Category", "Examples", "Source"],
          rows: [
            ["Account & contact", "Name, email address, phone number, password (stored hashed), profile photo", "You"],
            ["Delivery", "Shipping addresses, delivery notes, recipient name and phone", "You"],
            ["Orders & payments", "Items purchased, order totals, payment method type, refund and return history. Card details are handled by Stripe — we receive only a token and the last four digits", "You, Stripe"],
            ["Shopping activity", "Products viewed, searches, wishlist, cart, reviews, followed stores, sizes and fit profile, virtual wardrobe items", "You, your device"],
            ["Photos you upload", "Images used for visual search, reviews, returns, your avatar, or (for sellers) product listings", "You"],
            ["Messages & support", "Support tickets, messages to stores, return reasons", "You"],
            ["Device & technical", "IP address, device model, OS and app version, language, crash reports, push notification token", "Your device"],
            ["Location", "Only for delivery partners while on an active delivery, to show live tracking. Shoppers are never tracked by GPS", "Delivery partner's device"],
            ["Sign-in providers", "If you continue with Google: your name, email and profile picture from that account", "Google"],
          ],
        },
        {
          type: "callout",
          title: "What we don't collect",
          text: "We do not collect your contacts, precise location as a shopper, health or biometric data, or full card numbers. We do not use advertising identifiers (IDFA / AAID) and we do not track you across other companies' apps or websites.",
        },
      ],
    },
    {
      id: "how-we-use",
      title: "How we use your data",
      inShort: "To deliver your orders, keep accounts safe, improve the app and — if you agree — send offers.",
      blocks: [
        {
          type: "list",
          items: [
            { term: "Provide the Services", text: "Create and secure your account, process orders and payments, arrange delivery, handle returns and refunds, and provide customer support. (Legal basis: performance of a contract.)" },
            { term: "Personalise your experience", text: "Show recommendations, recently viewed items, size suggestions and search results that match your interests. You can turn off personalisation in Settings → Privacy. (Legitimate interests / consent.)" },
            { term: "AI-powered features", text: "Visual search, smart search, product tagging and style suggestions use machine-learning models to analyse product images, search text and photos you choose to upload. We do not use your photos to train third-party models." },
            { term: "Keep VESTARA safe", text: "Detect and prevent fraud, abuse, fake reviews and security incidents, and enforce our Terms. (Legitimate interests / legal obligation.)" },
            { term: "Communicate with you", text: "Send order updates, delivery notifications and important account messages. Marketing messages and promotional push notifications are only sent if you opt in, and you can opt out at any time. (Contract / consent.)" },
            { term: "Meet legal obligations", text: "Keep tax and accounting records, respond to lawful requests from authorities, and resolve disputes. (Legal obligation.)" },
          ],
        },
      ],
    },
    {
      id: "sharing",
      title: "Who we share it with",
      inShort: "Only the Store you buy from, our delivery and payment partners, and the service providers that run our infrastructure.",
      blocks: [
        { type: "p", text: "We never sell or rent your personal data. We share it only as needed to run the Services:" },
        {
          type: "list",
          items: [
            { term: "Stores you order from", text: "Your name, delivery address, phone number and order details so they can prepare and fulfil your order. Stores may not use this data for any other purpose." },
            { term: "Delivery partners", text: "Courier companies (such as Domex) and VESTARA delivery partners receive the recipient name, address, phone number and cash-on-delivery amount needed to deliver your parcel." },
            { term: "Payment processor", text: "Stripe, Inc. processes card payments and fraud screening under PCI-DSS Level 1." },
            { term: "Infrastructure providers", text: "Supabase (database, authentication and file storage), Cloudflare (hosting, content delivery, security and AI inference), Sentry (crash and error reporting), Expo / Apple / Google (push notification delivery), and our email and SMS providers. Each is bound by a data processing agreement." },
            { term: "Legal & safety", text: "Authorities or other parties when required by law, or when necessary to protect the rights, property or safety of VESTARA, our users or the public." },
            { term: "Business transfers", text: "A buyer or successor if VESTARA is involved in a merger, acquisition or sale of assets, subject to this policy." },
          ],
        },
        {
          type: "p",
          text: "Some providers store data outside Sri Lanka (for example in Singapore, the EU or the United States). Where data leaves Sri Lanka we rely on contractual safeguards required by applicable law.",
        },
      ],
    },
    {
      id: "permissions",
      title: "App permissions",
      inShort: "Every permission is optional and only requested when you use the feature.",
      blocks: [
        { type: "p", text: "The VESTARA mobile app may ask for the following device permissions. You can change them at any time in your device settings; the rest of the app keeps working." },
        {
          type: "table",
          head: ["Permission", "Used for", "When asked"],
          rows: [
            ["Camera", "Visual search, scanning QR codes, photographing items for reviews, returns or (sellers) listings", "When you open the camera"],
            ["Photos", "Choosing images for your avatar, reviews, visual search or product listings", "When you pick a photo"],
            ["Notifications", "Order, delivery and account updates; offers only if you opt in", "After sign-in"],
            ["Location", "Live delivery tracking — delivery partner accounts only", "When a delivery partner starts a delivery"],
          ],
        },
      ],
    },
    {
      id: "cookies",
      title: "Cookies & analytics",
      inShort: "Essential cookies keep you signed in; optional analytics can be switched off.",
      blocks: [
        {
          type: "p",
          text: "On the website we use essential cookies and local storage to keep you signed in, remember your bag and preferences, and protect against fraud. Optional analytics cookies help us understand which pages work well. You can manage these choices in our Cookie Policy at any time. The mobile app uses equivalent on-device storage for the same purposes.",
        },
      ],
    },
    {
      id: "retention",
      title: "How long we keep data",
      inShort: "As long as your account is active, then only what the law requires.",
      blocks: [
        {
          type: "list",
          items: [
            { term: "Account data", text: "Kept while your account is active. Deleted within 30 days after you delete your account." },
            { term: "Orders & invoices", text: "Kept for up to 7 years to meet Sri Lankan tax and accounting requirements, then deleted or anonymised." },
            { term: "Support messages", text: "Kept for up to 2 years after the ticket is closed." },
            { term: "Crash logs & technical data", text: "Kept for up to 90 days." },
            { term: "Backups", text: "Encrypted backups roll off automatically within 35 days." },
          ],
        },
      ],
    },
    {
      id: "security",
      title: "How we protect it",
      inShort: "Encryption in transit and at rest, strict access controls and regular review.",
      blocks: [
        {
          type: "p",
          text: "All traffic between your device and VESTARA is encrypted with TLS. Data is encrypted at rest by our infrastructure providers, and database access is restricted with row-level security so each account can only reach its own records. Staff access is limited to people who need it and protected by multi-factor authentication. No system is perfectly secure; if a breach affects your data we will notify you and the relevant authority as the law requires.",
        },
      ],
    },
    {
      id: "your-rights",
      title: "Your rights",
      inShort: "See, correct, export, restrict or delete your data — most of it right inside the app.",
      blocks: [
        {
          type: "list",
          items: [
            { term: "Access & portability", text: "Request a copy of the personal data we hold about you, in a portable format." },
            { term: "Correction", text: "Update your name, contact details and addresses directly in your account at any time." },
            { term: "Deletion", text: "Delete your account in-app, or ask us to erase specific data." },
            { term: "Objection & restriction", text: "Object to personalisation or marketing, or ask us to restrict processing." },
            { term: "Withdraw consent", text: "Turn off marketing emails, push notifications and optional cookies at any time." },
            { term: "Complain", text: "If you are unhappy with how we handle your data, contact us first. You may also complain to the Data Protection Authority of Sri Lanka or your local regulator." },
          ],
        },
        { type: "p", text: "We respond to verified requests within 30 days and never charge for reasonable requests." },
      ],
    },
    {
      id: "delete-account",
      title: "Deleting your account",
      inShort: "Account → Settings → Delete account. Or email us and we'll do it for you.",
      blocks: [
        {
          type: "list",
          items: [
            { term: "In the app", text: "Open Account → Settings, scroll to Danger zone, tap Delete account and confirm." },
            { term: "On the web", text: "Sign in at vestara.lk, go to Account → Settings and choose Delete account at the bottom of the page." },
            { term: "By email", text: "Email munxhd@gmail.com from the address on your account with the subject \"Delete my account\". We will confirm within 48 hours." },
          ],
        },
        {
          type: "callout",
          title: "What happens when you delete",
          text: "Your profile, addresses, wishlist, reviews' author details, saved photos, wardrobe and notification tokens are permanently deleted within 30 days. Order and invoice records we are legally required to keep are retained in a restricted form for up to 7 years and then deleted. Open orders must be completed or cancelled first.",
        },
      ],
    },
    {
      id: "children",
      title: "Children",
      inShort: "VESTARA is for adults. You must be 18 or older to create an account.",
      blocks: [
        {
          type: "p",
          text: "The Services are not directed to children. You must be at least 18 to create an account or place an order. We do not knowingly collect personal data from anyone under 18; if we learn we have, we will delete it. Parents or guardians who believe a child has given us data can contact munxhd@gmail.com.",
        },
      ],
    },
    {
      id: "changes",
      title: "Changes & contact",
      inShort: "We'll tell you about important changes. Questions? Email our privacy team.",
      blocks: [
        {
          type: "p",
          text: "We may update this policy from time to time. The \"Last updated\" date shows the latest version. If we make significant changes we will notify you in the app or by email before they take effect.",
        },
        {
          type: "p",
          text: `Privacy questions or requests: munxhd@gmail.com · ${LEGAL_ENTITY}, ${LEGAL_ADDRESS}. App Store / Google Play publisher: ${APP_PUBLISHER} (${APP_PUBLISHER_EMAIL}).`,
        },
      ],
    },
  ],
};

export const TERMS_OF_SERVICE: LegalDoc = {
  slug: "terms",
  kicker: "Terms of Service",
  title: "The rules of the house.",
  intro:
    "These terms are the agreement between you and VESTARA when you browse, buy or sell on our website and mobile apps. Please read them — they explain how orders, payments, delivery and returns work, and what we expect from everyone using the marketplace.",
  updated: "2026-11-08",
  readMinutes: 9,
  contactEmail: "munxhd@gmail.com",
  highlights: [
    { title: "A marketplace of independent Stores", text: "Most products are sold by independent Stores. VESTARA runs the platform, checkout and support." },
    { title: "Clear prices at checkout", text: "Product price, delivery fee and platform fee are all shown before you pay. No hidden charges." },
    { title: "14-day returns", text: "Eligible items can be returned within 14 days of delivery in original condition." },
    { title: "Sri Lankan law applies", text: "These terms are governed by the laws of Sri Lanka. Your statutory consumer rights are never affected." },
  ],
  sections: [
    {
      id: "agreement",
      title: "Agreement to these terms",
      inShort: "By using VESTARA you agree to these terms and our Privacy Policy.",
      blocks: [
        {
          type: "p",
          text: `These Terms of Service ("Terms") form a binding agreement between you and ${LEGAL_ENTITY}, ${LEGAL_ADDRESS} ("VESTARA", "we", "us"). They apply to the VESTARA website (vestara.lk), the VESTARA iOS and Android apps and related services (the "Services"). By creating an account or using the Services you accept these Terms and our Privacy Policy. If you do not agree, please do not use the Services.`,
        },
        {
          type: "p",
          text: "Sellers, delivery partners and other business users are also bound by any additional agreements they accept when onboarding; if those conflict with these Terms, the additional agreement prevails for that role.",
        },
      ],
    },
    {
      id: "accounts",
      title: "Your account",
      inShort: "Be 18+, give accurate details, and keep your login safe.",
      blocks: [
        {
          type: "list",
          items: [
            { term: "Eligibility", text: "You must be at least 18 years old and able to enter a binding contract under Sri Lankan law." },
            { term: "Accurate information", text: "Keep your name, phone, email and delivery addresses accurate and up to date." },
            { term: "Security", text: "You are responsible for activity on your account. Keep your password and one-time codes private and tell us immediately at munxhd@gmail.com if you suspect unauthorised access." },
            { term: "One person, one account", text: "Accounts are personal and may not be sold, shared or transferred." },
            { term: "Closing your account", text: "You can delete your account at any time in Account → Settings. See our Privacy Policy for what is retained." },
          ],
        },
      ],
    },
    {
      id: "marketplace",
      title: "How the marketplace works",
      inShort: "Stores sell to you directly; VESTARA provides the platform and stands behind the checkout.",
      blocks: [
        {
          type: "p",
          text: "VESTARA is a marketplace. Unless a product is clearly marked as sold by VESTARA, the seller is the independent Store shown on the product page, and the contract of sale is between you and that Store. Stores are responsible for their product descriptions, photos, sizing, stock, quality and compliance with law.",
        },
        {
          type: "p",
          text: "We review Stores before they go live, take action on reports of counterfeit or unsafe goods, and handle payment, delivery coordination, customer support and returns on behalf of Stores. If something goes wrong with an order, contact VESTARA first — we will help resolve it.",
        },
      ],
    },
    {
      id: "orders",
      title: "Orders & pricing",
      inShort: "Prices are in LKR. Your order is confirmed when the Store accepts it.",
      blocks: [
        {
          type: "list",
          items: [
            { term: "Placing an order", text: "Submitting checkout is an offer to buy. The order is accepted when the Store confirms it; you will receive a confirmation in the app and by email or SMS." },
            { term: "Prices", text: "All prices are in Sri Lankan Rupees (LKR) unless stated otherwise. Converted prices in other currencies are estimates only." },
            { term: "Fees", text: "Checkout shows the product total, a delivery fee for each Store in your order, and a platform service fee, before you pay. The amount shown at checkout is the amount you pay." },
            { term: "Errors & availability", text: "If an item is out of stock or was listed at an obvious pricing error, the Store or VESTARA may cancel that item and you will receive a full refund for it." },
            { term: "Promotions", text: "Coupons, gift cards and loyalty rewards are subject to their own conditions, cannot be exchanged for cash, and may be withdrawn if obtained through abuse or fraud." },
          ],
        },
      ],
    },
    {
      id: "payments",
      title: "Payments",
      inShort: "Pay by card (via Stripe), cash on delivery, gift card or other methods shown at checkout.",
      blocks: [
        {
          type: "p",
          text: "We accept the payment methods shown at checkout, which may include debit and credit cards, cash on delivery (COD), gift cards and store credit. Card payments are processed securely by Stripe; VESTARA does not store full card numbers. For COD orders, please have the exact amount ready — repeated refusal of COD parcels may result in COD being disabled for your account.",
        },
        {
          type: "p",
          text: "We may decline or cancel orders we reasonably suspect to be fraudulent or in breach of these Terms. If you have already paid, you will be refunded.",
        },
      ],
    },
    {
      id: "delivery",
      title: "Delivery",
      inShort: "Islandwide delivery by our courier partners; track every parcel in the app.",
      blocks: [
        {
          type: "p",
          text: "We deliver across Sri Lanka through courier partners and VESTARA delivery partners. Orders containing items from several Stores may arrive in separate parcels. Delivery estimates are shown at checkout and are estimates, not guarantees. Ownership and risk pass to you when the parcel is delivered to the address you provided.",
        },
        {
          type: "p",
          text: "Please check the parcel on delivery. If it is damaged, tampered with or missing items, report it in the app within 48 hours with photos so we can investigate.",
        },
      ],
    },
    {
      id: "returns",
      title: "Returns, refunds & cancellations",
      inShort: "Request a return within 14 days; refunds go back to your original payment method.",
      blocks: [
        {
          type: "list",
          items: [
            { term: "Cancelling", text: "You can cancel an order in the app until the Store marks it as shipped." },
            { term: "Return window", text: "Request a return in the app within 14 days of delivery. Items must be unworn, unwashed and in original condition with tags and packaging." },
            { term: "Non-returnable items", text: "Pierced jewellery, innerwear and swimwear with broken hygiene seals, opened beauty and fragrance products, made-to-measure or personalised items, and items marked final sale — unless faulty or not as described." },
            { term: "Faulty or wrong items", text: "If an item is faulty, damaged or not as described, you are entitled to a replacement or full refund including delivery fees." },
            { term: "Refunds", text: "Approved refunds are issued to the original payment method (or as store credit for COD orders unless you request a bank transfer) within 7–14 business days after the return is received and inspected." },
          ],
        },
        { type: "p", text: "Full details are in our Returns & Exchanges policy. Nothing in these Terms limits your rights under the Consumer Affairs Authority Act of Sri Lanka." },
      ],
    },
    {
      id: "conduct",
      title: "Acceptable use",
      inShort: "Use VESTARA honestly. No fraud, fakes, bots or abuse.",
      blocks: [
        { type: "p", text: "When using the Services you agree not to:" },
        {
          type: "list",
          items: [
            { text: "Sell, list or knowingly buy counterfeit, stolen, unsafe or illegal goods." },
            { text: "Post reviews, photos or messages that are false, misleading, hateful, harassing, sexually explicit or infringe someone else's rights." },
            { text: "Use bots, scrapers or automated tools to access the Services, reserve stock or harvest data." },
            { text: "Abuse promotions, referral programmes, returns or COD, or create multiple accounts to do so." },
            { text: "Interfere with, reverse-engineer or attempt to bypass the security of the Services." },
            { text: "Contact other users to complete transactions outside VESTARA." },
          ],
        },
        {
          type: "p",
          text: "We may remove content, cancel orders, or suspend or close accounts that breach these Terms. Where reasonable, we will tell you why and give you a chance to respond.",
        },
      ],
    },
    {
      id: "content",
      title: "Your content",
      inShort: "You own what you post; you let us show it on VESTARA.",
      blocks: [
        {
          type: "p",
          text: "You keep ownership of the reviews, photos and other content you submit. You grant VESTARA a non-exclusive, worldwide, royalty-free licence to host, display, adapt and share that content on and in connection with the Services, including in marketing for the relevant product or Store. You confirm you have the rights to anything you upload. You can delete your content at any time; copies may remain in backups for a limited period.",
        },
      ],
    },
    {
      id: "ip",
      title: "Intellectual property",
      inShort: "The VESTARA name, app and design belong to us; Store content belongs to the Stores.",
      blocks: [
        {
          type: "p",
          text: "The VESTARA name, logo, apps, website, software and design are owned by VESTARA or its licensors. Product images and descriptions belong to the relevant Stores or brands. You may use the Services for personal, non-commercial shopping; you may not copy, modify or redistribute any part of them without our written permission. To report content that infringes your rights, email munxhd@gmail.com.",
        },
      ],
    },
    {
      id: "ai",
      title: "AI-powered features",
      inShort: "AI helps with search and suggestions. It can make mistakes — check product details.",
      blocks: [
        {
          type: "p",
          text: "Some features — such as visual search, smart search, style suggestions and AI-generated product imagery for sellers — use artificial intelligence. AI output may be inaccurate or incomplete. Always rely on the Store's product details, size chart and photos before buying. AI-generated or AI-edited product images are labelled where shown.",
        },
      ],
    },
    {
      id: "liability",
      title: "Liability",
      inShort: "We're responsible for what's in our control; your consumer rights stay intact.",
      blocks: [
        {
          type: "p",
          text: "We work hard to keep the Services available and accurate, but they are provided \"as is\" and may occasionally be interrupted. To the extent permitted by law, VESTARA is not liable for indirect or consequential losses, or for losses caused by Stores, couriers or events outside our reasonable control. Our total liability to you for any claim relating to an order is limited to the amount you paid for that order.",
        },
        {
          type: "p",
          text: "Nothing in these Terms excludes liability for death or personal injury caused by negligence, for fraud, or any other liability that cannot be excluded under Sri Lankan law.",
        },
      ],
    },
    {
      id: "law",
      title: "Governing law & disputes",
      inShort: "Talk to us first. Sri Lankan law and courts apply.",
      blocks: [
        {
          type: "p",
          text: "If you have a complaint, please contact munxhd@gmail.com first — most issues are resolved quickly. These Terms are governed by the laws of the Democratic Socialist Republic of Sri Lanka. Any dispute that cannot be resolved informally will be subject to the exclusive jurisdiction of the courts of Colombo, without affecting any mandatory consumer protections in your place of residence.",
        },
      ],
    },
    {
      id: "changes",
      title: "Changes & contact",
      inShort: "We'll notify you of material changes. Questions? We're here.",
      blocks: [
        {
          type: "p",
          text: "We may update these Terms to reflect changes to the Services or the law. For material changes we will notify you in the app or by email at least 14 days in advance. Continuing to use the Services after the changes take effect means you accept them.",
        },
        {
          type: "p",
          text: `Questions about these Terms or help with an order: munxhd@gmail.com · ${LEGAL_ENTITY}, ${LEGAL_ADDRESS}.`,
        },
      ],
    },
  ],
};

export const LEGAL_DOCS = { privacy: PRIVACY_POLICY, terms: TERMS_OF_SERVICE } as const;

export function formatLegalDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${months[m - 1]} ${d}, ${y}`;
}
