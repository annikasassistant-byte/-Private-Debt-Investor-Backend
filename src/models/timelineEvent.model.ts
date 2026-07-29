import mongoose from 'mongoose';
import { applyBaseModel } from './base.model.js';
import { TIMELINE_EVENT_TYPE } from '../enums/domain.js';

const { Schema } = mongoose;

const timelineEventSchema = new Schema({
  type: { type: String, enum: Object.values(TIMELINE_EVENT_TYPE), required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 300 },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  date: { type: Date, required: true, index: true },
  amount: { type: Number, default: null },
  status: {
    type: String,
    enum: ['completed', 'upcoming', 'future', 'overdue'],
    default: 'future',
    index: true,
  },
  investor: { type: Schema.Types.ObjectId, ref: 'Investor', default: null, index: true },
  investment: { type: Schema.Types.ObjectId, ref: 'Investment', default: null, index: true },
  payment: { type: Schema.Types.ObjectId, ref: 'Payment', default: null },
  meta: { type: Schema.Types.Mixed, default: {} },
});

applyBaseModel(timelineEventSchema, mongoose);

export const TimelineEvent =
  mongoose.models.TimelineEvent || mongoose.model('TimelineEvent', timelineEventSchema);
export { timelineEventSchema };
export default TimelineEvent;
