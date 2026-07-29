function idOf(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && '_id' in value) {
    return String((value as { _id: unknown })._id);
  }
  return String(value);
}

function iso(value: unknown): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function mapInvestor(doc: any) {
  if (!doc) return null;
  const o = typeof doc.toObject === 'function' ? doc.toObject({ virtuals: true }) : { ...doc };
  return {
    id: String(o._id),
    userId: idOf(o.user),
    name: o.name,
    email: o.email,
    phone: o.phone || '',
    company: o.company || '',
    title: o.title || '',
    status: o.status,
    totalInvested: o.totalInvested ?? 0,
    outstandingBalance: o.outstandingBalance ?? 0,
    joinedAt: iso(o.joinedAt || o.createdAt),
  };
}

export function mapInvestment(doc: any) {
  if (!doc) return null;
  const o = typeof doc.toObject === 'function' ? doc.toObject({ virtuals: true }) : { ...doc };
  return {
    id: String(o._id),
    investorId: idOf(o.investor),
    investorName: o.investorName || '',
    principal: o.principal ?? 0,
    interestRate: o.interestRate ?? 0,
    termMonths: o.termMonths ?? 0,
    monthlyPayment: o.monthlyPayment ?? 0,
    outstandingBalance: o.outstandingBalance ?? 0,
    interestEarned: o.interestEarned ?? 0,
    principalRepaid: o.principalRepaid ?? 0,
    status: o.status,
    startDate: iso(o.startDate),
    maturityDate: iso(o.maturityDate),
    nextPaymentDate: iso(o.nextPaymentDate),
    nextPaymentAmount: o.nextPaymentAmount ?? 0,
    paymentDay: o.paymentDay ?? 15,
    repaymentModel: o.repaymentModel,
    gracePeriodMonths: o.gracePeriodMonths ?? 0,
    balloonAmount: o.balloonAmount ?? 0,
  };
}

export function mapLoan(doc: any) {
  if (!doc) return null;
  const o = typeof doc.toObject === 'function' ? doc.toObject({ virtuals: true }) : { ...doc };
  return {
    id: String(o._id),
    investmentId: idOf(o.investment),
    investorId: idOf(o.investor),
    borrower: o.borrower,
    amount: o.amount ?? 0,
    rate: o.rate ?? 0,
    status: o.status,
    fundedAt: iso(o.fundedAt),
  };
}

export function mapPayment(doc: any) {
  if (!doc) return null;
  const o = typeof doc.toObject === 'function' ? doc.toObject({ virtuals: true }) : { ...doc };
  return {
    id: String(o._id),
    investmentId: idOf(o.investment),
    investorId: idOf(o.investor),
    sequence: o.sequence,
    dueDate: iso(o.dueDate),
    paymentDate: o.paymentDate ? iso(o.paymentDate) : null,
    principal: o.principal ?? 0,
    interest: o.interest ?? 0,
    total: o.total ?? 0,
    remainingBalance: o.remainingBalance ?? 0,
    amountPaid: o.amountPaid ?? 0,
    principalPaid: o.principalPaid ?? 0,
    interestPaid: o.interestPaid ?? 0,
    status: o.status,
  };
}

export function mapReport(doc: any) {
  if (!doc) return null;
  const o = typeof doc.toObject === 'function' ? doc.toObject({ virtuals: true }) : { ...doc };
  const assigned = (o.assignedInvestors || []).map(idOf);
  return {
    id: String(o._id),
    title: o.title,
    category: o.category,
    period: o.period || '',
    uploadedAt: iso(o.uploadedAt || o.createdAt),
    size: o.sizeLabel || `${Math.round((o.sizeBytes || 0) / 1024)} KB`,
    fileUrl: o.fileUrl || '',
    fileName: o.fileName || '',
    investorId: assigned[0] || undefined,
    assignedInvestors: assigned,
  };
}

export function mapContract(doc: any) {
  if (!doc) return null;
  const o = typeof doc.toObject === 'function' ? doc.toObject({ virtuals: true }) : { ...doc };
  const assigned = (o.assignedInvestors || []).map(idOf);
  return {
    id: String(o._id),
    title: o.title,
    type: o.type,
    signedAt: iso(o.signedAt || o.createdAt),
    size: o.sizeLabel || `${Math.round((o.sizeBytes || 0) / 1024)} KB`,
    fileUrl: o.fileUrl || '',
    fileName: o.fileName || '',
    investorId: assigned[0] || undefined,
    assignedInvestors: assigned,
  };
}

export function mapTimeline(doc: any) {
  if (!doc) return null;
  const o = typeof doc.toObject === 'function' ? doc.toObject({ virtuals: true }) : { ...doc };
  return {
    id: String(o._id),
    type: o.type,
    title: o.title,
    description: o.description || '',
    date: iso(o.date),
    amount: o.amount ?? undefined,
    status: o.status,
    investorId: idOf(o.investor) || undefined,
    investmentId: idOf(o.investment) || undefined,
  };
}

export function formatBytes(bytes: number) {
  if (!bytes) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
