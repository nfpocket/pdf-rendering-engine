export interface Party {
  name: string
  lines: string[]
  vatId?: string
}

export interface LineItem {
  id: string
  description: string
  qty: number
  unit: string
  unitPrice: number
}

export interface Invoice {
  number: string
  date: string
  dueDate: string
  currency: string
  taxRate: number
  seller: Party
  buyer: Party
  items: LineItem[]
  terms: string
}

const SAMPLE_PRODUCTS: Array<[string, string, number]> = [
  ['CNC aluminium bracket, anodised', 'pcs', 14.5],
  ['M6 stainless hex bolt (DIN 933)', 'pcs', 0.18],
  ['Industrial hinge, 120mm, load-rated', 'pcs', 7.9],
  ['Powder-coating service, RAL 7016', 'm²', 22.0],
  ['Laser cutting, 3mm mild steel', 'min', 1.35],
  ['Delivery & handling (regional)', 'flat', 38.0],
  ['Assembly labour, certified technician', 'h', 68.0],
  ['Neoprene gasket sheet, 2mm', 'm²', 11.4],
  ['Cable gland set, IP68, M20', 'set', 3.25],
  ['Engineering review & documentation', 'h', 95.0],
]

let seq = 1
export function makeItem(i: number): LineItem {
  const [description, unit, unitPrice] = SAMPLE_PRODUCTS[i % SAMPLE_PRODUCTS.length]
  return {
    id: `item-${seq++}`,
    description:
      i % 7 === 3
        ? `${description} — incl. tolerance spec ±0.05mm, batch traceability, and certificate of conformity per EN 10204 3.1`
        : description,
    qty: 1 + ((i * 3) % 12),
    unit,
    unitPrice,
  }
}

export function makeItems(n: number): LineItem[] {
  return Array.from({ length: n }, (_, i) => makeItem(i))
}

export function createInvoice(itemCount = 24): Invoice {
  return {
    number: 'INV-2026-004182',
    date: '2026-06-20',
    dueDate: '2026-07-20',
    currency: 'EUR',
    taxRate: 0.19,
    seller: {
      name: 'Norddeutsche Fertigung GmbH',
      lines: ['Hafenstraße 12', '20457 Hamburg', 'Germany'],
      vatId: 'DE123456789',
    },
    buyer: {
      name: 'Bauer Maschinenbau AG',
      lines: ['Industriepark Süd 4', '70565 Stuttgart', 'Germany'],
      vatId: 'DE987654321',
    },
    items: makeItems(itemCount),
    terms:
      'Payment is due within 30 days of the invoice date by bank transfer to the account stated above. ' +
      'A late-payment interest of 9 percentage points above the prevailing base rate applies to overdue amounts in accordance with §288 BGB. ' +
      'Title to the delivered goods remains with the seller until full payment has been received (retention of title). ' +
      'Delivered goods are to be inspected without undue delay; defects must be reported in writing within seven calendar days of receipt. ' +
      'Our general terms and conditions of sale apply exclusively; conflicting or deviating terms of the buyer are not recognised unless expressly agreed in writing. ' +
      'The place of jurisdiction for all disputes arising from this contract is Hamburg, provided the buyer is a merchant. ' +
      'This document was generated electronically and is valid without a signature.',
  }
}

// --- derived figures (computed from the DATA, never scraped from the DOM) ---

export function lineTotal(item: LineItem): number {
  return item.qty * item.unitPrice
}

export function netTotal(inv: Invoice): number {
  return inv.items.reduce((sum, it) => sum + lineTotal(it), 0)
}

export function taxTotal(inv: Invoice): number {
  return netTotal(inv) * inv.taxRate
}

export function grossTotal(inv: Invoice): number {
  return netTotal(inv) + taxTotal(inv)
}

export function money(value: number, currency: string): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
  }).format(value)
}
