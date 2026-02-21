import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema({
  revenue: Number,
  broker_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  // Add other fields like date, state for taxes
});

export const Invoice = mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);
