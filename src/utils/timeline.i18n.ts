/** German timeline copy — single source for persisted event titles/descriptions. */

export function formatEurDe(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(amount) || 0);
}

export const TimelineCopy = {
  investmentStarted(principal: number) {
    return {
      title: 'Investition gestartet',
      description: `Investition über ${formatEurDe(principal)} gestartet`,
    };
  },
  loanFunded(borrowerOrName: string) {
    const who = String(borrowerOrName || '').trim();
    return {
      title: 'Darlehen ausgezahlt',
      description: who ? `Darlehen ausgezahlt für ${who}` : 'Darlehen ausgezahlt',
    };
  },
  nextPayment(principal: number, interest: number, note = '') {
    return {
      title: 'Nächste Zahlung',
      description: `Tilgung ${formatEurDe(principal)} · Finanzierungsgebühr ${formatEurDe(interest)}.${note ? ` ${note}` : ''}`,
    };
  },
  overdueInstallment(sequence: number, principal: number, interest: number, note = '') {
    return {
      title: `Überfällig · Rate Nr. ${sequence}`,
      description: `Tilgung ${formatEurDe(principal)} · Finanzierungsgebühr ${formatEurDe(interest)}.${note ? ` ${note}` : ''}`,
    };
  },
  scheduledInstallment(sequence: number, principal: number, interest: number, note = '') {
    return {
      title: `Geplante Zahlung · Rate Nr. ${sequence}`,
      description: `Tilgung ${formatEurDe(principal)} · Finanzierungsgebühr ${formatEurDe(interest)}.${note ? ` ${note}` : ''}`,
    };
  },
  installment(sequence: number, principal: number, interest: number, note = '') {
    return {
      title: `Rate Nr. ${sequence}`,
      description: `Tilgung ${formatEurDe(principal)} · Finanzierungsgebühr ${formatEurDe(interest)}.${note ? ` ${note}` : ''}`,
    };
  },
  paymentCompleted(sequence: number) {
    return {
      title: 'Zahlung erfolgt',
      description: `Zahlung Rate Nr. ${sequence} erfolgt`,
    };
  },
  partialPayment(sequence: number) {
    return {
      title: 'Teilzahlung erhalten',
      description: `Teilzahlung für Rate Nr. ${sequence} erhalten`,
    };
  },
  earlyRepayment(amount: number) {
    return {
      title: 'Vorzeitige Rückzahlung',
      description: `Vorzeitige Rückzahlung über ${formatEurDe(amount)}`,
    };
  },
  loanFullyRepaid() {
    return {
      title: 'Vollständig zurückgezahlt',
      description: 'Investition vollständig zurückgezahlt',
    };
  },
} as const;
