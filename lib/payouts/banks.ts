/**
 * Banks licensed by the Central Bank of Sri Lanka — licensed commercial banks
 * and licensed specialised banks. `name` is the value saved as
 * payout_settings.bank_name, so the six original names are kept exactly as
 * they were stored before this list existed.
 *
 * Mirrors store/src/lib/payouts/banks.ts — keep the two in step.
 */

export type BankKind = "commercial" | "specialised";

export interface SriLankaBank {
  name: string;
  short: string;
  kind: BankKind;
  /** Other names sellers search by. */
  aliases?: string[];
  popular?: boolean;
}

export const SRI_LANKA_BANKS: SriLankaBank[] = [
  // Licensed commercial banks
  { name: "Bank of Ceylon", short: "BOC", kind: "commercial", popular: true },
  { name: "People's Bank", short: "PB", kind: "commercial", popular: true, aliases: ["Peoples Bank"] },
  { name: "Commercial Bank of Ceylon", short: "CB", kind: "commercial", popular: true, aliases: ["ComBank"] },
  { name: "Hatton National Bank (HNB)", short: "HNB", kind: "commercial", popular: true, aliases: ["HNB"] },
  { name: "Sampath Bank", short: "SMP", kind: "commercial", popular: true },
  { name: "Seylan Bank", short: "SEY", kind: "commercial", popular: true },
  { name: "Nations Trust Bank", short: "NTB", kind: "commercial", popular: true },
  { name: "National Development Bank (NDB)", short: "NDB", kind: "commercial", aliases: ["NDB"] },
  { name: "DFCC Bank", short: "DFC", kind: "commercial" },
  { name: "Pan Asia Banking Corporation", short: "PAB", kind: "commercial", aliases: ["Pan Asia Bank"] },
  { name: "Union Bank of Colombo", short: "UB", kind: "commercial" },
  { name: "Cargills Bank", short: "CGB", kind: "commercial" },
  { name: "Amana Bank", short: "AMN", kind: "commercial" },
  { name: "Bank of China", short: "BOCH", kind: "commercial" },
  { name: "Citibank N.A.", short: "CITI", kind: "commercial", aliases: ["Citi"] },
  { name: "Deutsche Bank AG", short: "DB", kind: "commercial" },
  { name: "Habib Bank", short: "HBL", kind: "commercial", aliases: ["HBL"] },
  { name: "HSBC", short: "HSBC", kind: "commercial", aliases: ["Hongkong and Shanghai Banking Corporation"] },
  { name: "Indian Bank", short: "IB", kind: "commercial" },
  { name: "Indian Overseas Bank", short: "IOB", kind: "commercial" },
  { name: "MCB Bank", short: "MCB", kind: "commercial" },
  { name: "Public Bank Berhad", short: "PBB", kind: "commercial" },
  { name: "Standard Chartered Bank", short: "SCB", kind: "commercial", aliases: ["StanChart"] },
  { name: "State Bank of India", short: "SBI", kind: "commercial", aliases: ["SBI"] },

  // Licensed specialised banks
  { name: "National Savings Bank (NSB)", short: "NSB", kind: "specialised", aliases: ["NSB"] },
  { name: "Pradeshiya Sanwardhana Bank", short: "PSB", kind: "specialised", aliases: ["Regional Development Bank", "RDB"] },
  { name: "HDFC Bank", short: "HDFC", kind: "specialised", aliases: ["Housing Development Finance Corporation"] },
  { name: "Sanasa Development Bank", short: "SDB", kind: "specialised" },
  { name: "State Mortgage & Investment Bank", short: "SMIB", kind: "specialised", aliases: ["SMIB"] },
  { name: "Sri Lanka Savings Bank", short: "SLSB", kind: "specialised" },
];

export function findBank(name: string | null | undefined): SriLankaBank | undefined {
  if (!name) return undefined;
  const n = name.trim().toLowerCase();
  return SRI_LANKA_BANKS.find((b) => b.name.toLowerCase() === n);
}

export function searchBanks(query: string): SriLankaBank[] {
  const q = query.trim().toLowerCase();
  if (!q) return SRI_LANKA_BANKS;
  return SRI_LANKA_BANKS.filter(
    (b) =>
      b.name.toLowerCase().includes(q) ||
      b.short.toLowerCase().includes(q) ||
      b.aliases?.some((a) => a.toLowerCase().includes(q)),
  );
}

/** Two- to four-letter monogram for a bank, known or typed in by the seller. */
export function bankMonogram(name: string): string {
  const known = findBank(name);
  if (known) return known.short;
  const paren = name.match(/\(([^)]+)\)/);
  if (paren) return paren[1].slice(0, 4).toUpperCase();
  return (
    name
      .split(/\s+/)
      .filter((w) => w && !/^(of|and|the|bank|plc)$/i.test(w))
      .map((w) => w[0])
      .join("")
      .slice(0, 3)
      .toUpperCase() || "BK"
  );
}
