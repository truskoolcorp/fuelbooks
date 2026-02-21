import { NextResponse } from 'next/server';
import { connectToDB } from '@/lib/mongooseClient';
import { Employee } from '@/models/Employee';

export async function GET() {
  await connectToDB();
  const data = await Employee.find({});
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  await connectToDB();
  const employee = await request.json();
  const newEmployee = new Employee(employee);
  await newEmployee.save();
  return NextResponse.json(newEmployee);
}

export async function PUT(request: Request) {
  await connectToDB();
  const { id, ...updates } = await request.json();
  const data = await Employee.findByIdAndUpdate(id, updates, { new: true });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  await connectToDB();
  const { id } = await request.json();
  await Employee.findByIdAndDelete(id);
  return NextResponse.json({ message: 'Deleted' });
}
