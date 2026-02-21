import { NextResponse } from 'next/server';
import { connectToDB } from '@/lib/mongooseClient';
import { Employee } from '@/models/Employee';
import { PayRun } from '@/models/PayRun';
import { Invoice } from '@/models/Invoice';

export async function GET(request: Request) {
  await connectToDB();
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get('employee_id');
  let data = await PayRun.find(employeeId ? { employee_id: employeeId } : {});
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  await connectToDB();
  const payRun = await request.json();
  const employee = await Employee.findById(payRun.employee_id);
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

  const invoices = await Invoice.find({ broker_id: payRun.employee_id });
  const tradeRevenue = invoices.reduce((sum, inv) => sum + (inv.revenue || 0), 0);

  const hourlyPay = (payRun.hours_worked || 0) * (employee.hourly_rate || 0);
  const commissionPay = tradeRevenue * (employee.commission_pct || 0);
  payRun.gross_pay = hourlyPay + commissionPay;
  const deductionsTotal = Object.values(payRun.deductions || {}).reduce((a: number, b: number) => a + b, 0);
  payRun.net_pay = payRun.gross_pay - deductionsTotal; // FL no state tax; add FICA etc.

  const newPayRun = new PayRun(payRun);
  await newPayRun.save();
  return NextResponse.json(newPayRun);
}
