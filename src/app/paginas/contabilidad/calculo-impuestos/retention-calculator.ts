export type IvaRetention = 'none' | 'two-thirds' | 'four-percent';
export interface RetentionInput {
  amount: number; mode: 'subtotal' | 'net'; ivaRate: number; isrRate: number;
  ivaRetention: IvaRetention; decimals: number;
}
export interface RetentionProfile {
  id: string; label: string; isrRate: number; ivaRetention: IvaRetention; note: string;
}

// LISR arts. 106, 113-J, 116; Reglamento LIVA art. 3. Recipient: persona moral.
export const RETENTION_PROFILES: RetentionProfile[] = [
  { id: 'honorarios', label: 'Persona física · Honorarios', isrRate: 10, ivaRetention: 'two-thirds', note: 'Servicios profesionales prestados por una persona física: ISR sobre el subtotal y retención de dos terceras partes del IVA.' },
  { id: 'resico-profesional', label: 'Persona física RESICO · Honorarios', isrRate: 1.25, ivaRetention: 'two-thirds', note: 'Servicios profesionales de una persona física en RESICO: ISR de 1.25% sobre el subtotal y dos terceras partes del IVA.' },
  { id: 'resico-empresarial', label: 'Persona física RESICO · Actividad empresarial', isrRate: 1.25, ivaRetention: 'none', note: 'Operaciones empresariales de una persona física RESICO sin supuesto especial de retención de IVA. Para honorarios, comisiones o transporte, selecciona el supuesto correspondiente.' },
  { id: 'arrendamiento', label: 'Persona física · Arrendamiento gravado', isrRate: 10, ivaRetention: 'two-thirds', note: 'Arrendamiento de inmuebles gravado con IVA. Este perfil no corresponde a casa habitación exenta.' },
  { id: 'resico-arrendamiento', label: 'Persona física RESICO · Arrendamiento gravado', isrRate: 1.25, ivaRetention: 'two-thirds', note: 'Arrendamiento gravado de una persona física RESICO. Este perfil no corresponde a casa habitación exenta.' },
  { id: 'comisiones', label: 'Persona física · Comisiones (fuera de RESICO)', isrRate: 0, ivaRetention: 'two-thirds', note: 'Comisiones de una persona física: retención de dos terceras partes del IVA. Para RESICO, usa el modo personalizado con ISR de 1.25%.' },
  { id: 'transporte', label: 'Persona física o moral · Autotransporte de bienes', isrRate: 0, ivaRetention: 'four-percent', note: 'Autotransporte terrestre de bienes: retención de IVA de 4% sobre el subtotal. Si el emisor es persona física RESICO, utiliza su perfil específico.' },
  { id: 'resico-transporte', label: 'Persona física RESICO · Autotransporte de bienes', isrRate: 1.25, ivaRetention: 'four-percent', note: 'Autotransporte terrestre de bienes de persona física RESICO: ISR de 1.25% y retención de IVA de 4% sobre el subtotal.' },
  { id: 'sin-retenciones', label: 'Operación sin retenciones', isrRate: 0, ivaRetention: 'none', note: 'Para operaciones que no estén sujetas a retención. Ser persona moral no determina por sí solo una retención en todas las compras.' }
];

export function calculateRetention(input: RetentionInput) {
  const { amount, mode, ivaRate, isrRate, ivaRetention, decimals } = input;
  if (!Number.isFinite(amount) || amount < 0 || amount > 1e12) throw new Error('Ingresa un importe entre 0 y 1,000,000,000,000.');
  if (![ivaRate, isrRate].every(rate => Number.isFinite(rate) && rate >= 0 && rate <= 100)) throw new Error('Las tasas deben estar entre 0 y 100%.');
  if (![2, 4, 6].includes(decimals)) throw new Error('Selecciona 2, 4 o 6 decimales.');
  const unit = 10 ** decimals;
  const round = (value: number) => Math.round((value + Number.EPSILON) * unit) / unit;
  const retainedIvaRate = ivaRate === 0 ? 0 : ivaRetention === 'two-thirds' ? ivaRate / 100 * 2 / 3 : ivaRetention === 'four-percent' ? .04 : 0;
  if (retainedIvaRate > ivaRate / 100) throw new Error('La retención de IVA no puede superar el IVA trasladado.');
  const factor = 1 + ivaRate / 100 - isrRate / 100 - retainedIvaRate;
  if (factor <= 0) throw new Error('Las tasas deben producir un total neto mayor que cero.');
  const compute = (base: number) => {
    const subtotal = round(base);
    const iva = round(subtotal * ivaRate / 100);
    const isr = round(subtotal * isrRate / 100);
    const retainedIva = round(subtotal * retainedIvaRate);
    return { subtotal, iva, isr, retainedIva, total: round(subtotal + iva - isr - retainedIva) };
  };
  let result = compute(mode === 'net' ? amount / factor : amount);
  if (mode === 'net') {
    // Find the closest representable subtotal after rounding each displayed tax.
    const initial = result.subtotal;
    for (let step = -3; step <= 3; step++) {
      if (initial + step / unit < 0) continue;
      const candidate = compute(initial + step / unit);
      if (Math.abs(candidate.total - amount) < Math.abs(result.total - amount)) result = candidate;
    }
  }
  return { ...result, roundingDifference: mode === 'net' ? round(result.total - round(amount)) : 0 };
}
