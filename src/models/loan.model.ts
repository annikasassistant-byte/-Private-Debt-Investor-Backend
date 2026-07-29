import mongoose from 'mongoose';
import { applyBaseModel } from './base.model.js';
import { INVESTMENT_STATUS } from '../enums/domain.js';

const { Schema } = mongoose;

const loanSchema = new Schema({
  investment: { type: Schema.Types.ObjectId, ref: 'Investment', required: true, index: true },
  investor: { type: Schema.Types.ObjectId, ref: 'Investor', required: true, index: true },
  borrower: { type: String, required: true, trim: true, maxlength: 200 },
  amount: { type: Number, required: true, min: 0 },
  rate: { type: Number, required: true, min: 0 },
  status: {
    type: String,
    enum: Object.values(INVESTMENT_STATUS),
    default: INVESTMENT_STATUS.ACTIVE,
    index: true,
  },
  fundedAt: { type: Date, required: true },
  notes: { type: String, trim: true, maxlength: 2000, default: '' },
});

applyBaseModel(loanSchema, mongoose);

export const Loan = mongoose.models.Loan || mongoose.model('Loan', loanSchema);
export { loanSchema };
export default Loan;
