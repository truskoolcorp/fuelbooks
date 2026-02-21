import mongoose from 'mongoose';

const payRunSchema = new mongoose.Schema({
  employee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  run_date: { type: Date, default: Date.now },
  hours_worked: Number,
  gross_pay: Number,
  deductions: Object,
  net_pay: Number,
  invoice_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' }], // If you have Invoice model
});

export const PayRun = mongoose.models.PayRun || mongoose.model('PayRun', payRunSchema);
