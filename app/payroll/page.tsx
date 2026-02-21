'use client';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

type Employee = {
  _id: string;
  name: string;
  role: string;
  hourly_rate?: number;
  commission_pct?: number;
};

export default function PayrollDashboard() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const { register, handleSubmit } = useForm();

  useEffect(() => {
    fetch('/api/payroll/employees')
      .then(res => res.json())
      .then(setEmployees);
  }, []);

  const onAddEmployee = async (data: any) => {
    await fetch('/api/payroll/employees', { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } });
    fetch('/api/payroll/employees').then(res => res.json()).then(setEmployees);
  };

  return (
    <div className="p-4 bg-gray-800 text-white rounded">
      <h1 className="text-2xl mb-4">Payroll Dashboard</h1>
      <h2 className="text-xl">Employees</h2>
      <ul className="mb-4">
        {employees.map(emp => (
          <li key={emp._id} className="mb-2">
            {emp.name} - {emp.role} (${emp.hourly_rate || 0}/hr, {(emp.commission_pct || 0) * 100}% commission)
          </li>
        ))}
      </ul>
      <h2 className="text-xl">Add Employee</h2>
      <form onSubmit={handleSubmit(onAddEmployee)} className="space-y-2">
        <input {...register('name')} placeholder="Name" className="p-2 bg-gray-700 text-white" />
        <input {...register('role')} placeholder="Role" className="p-2 bg-gray-700 text-white" />
        <input {...register('hourly_rate', { valueAsNumber: true })} type="number" placeholder="Hourly Rate" className="p-2 bg-gray-700 text-white" />
        <input {...register('commission_pct', { valueAsNumber: true })} type="number" step="0.01" placeholder="Commission %" className="p-2 bg-gray-700 text-white" />
        <button type="submit" className="p-2 bg-blue-600">Add</button>
      </form>
    </div>
  );
}
