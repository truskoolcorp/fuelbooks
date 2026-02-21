'use client';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

export default function PayRunsPage() {
  const [payRuns, setPayRuns] = useState([]);
  const { register, handleSubmit } = useForm();

  useEffect(() => {
    fetch('/api/payroll/payruns').then(res => res.json()).then(setPayRuns);
  }, []);

  const onRunPayroll = async (data: any) => {
    await fetch('/api/payroll/payruns', { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } });
    fetch('/api/payroll/payruns').then(res => res.json()).then(setPayRuns);
  };

  return (
    <div className="p-4 bg-gray-800 text-white">
      <h1 className="text-2xl mb-4">Pay Runs</h1>
      <ul className="mb-4">
        {payRuns.map((run: any) => (
          <li key={run._id}>Date: {new Date(run.run_date).toLocaleDateString()} | Net: ${run.net_pay}</li>
        ))}
      </ul>
      <h2 className="text-xl">Run Payroll</h2>
      <form onSubmit={handleSubmit(onRunPayroll)} className="space-y-2">
        <input {...register('employee_id')} placeholder="Employee ID" className="p-2 bg-gray-700 text-white" />
        <input {...register('hours_worked', { valueAsNumber: true })} type="number" placeholder="Hours Worked" className="p-2 bg-gray-700 text-white" />
        <input {...register('deductions')} placeholder='Deductions JSON e.g. {"fica":0.0765}' className="p-2 bg-gray-700 text-white" />
        <button type="submit" className="p-2 bg-blue-600">Run</button>
      </form>
    </div>
  );
}
