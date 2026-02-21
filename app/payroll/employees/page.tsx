'use client';
import { useEffect, useState } from 'react';
// Add forms for edit/delete using PUT/DELETE

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    fetch('/api/payroll/employees').then(res => res.json()).then(setEmployees);
  }, []);

  return (
    <div className="p-4 bg-gray-800 text-white">
      <h1 className="text-2xl">Manage Employees</h1>
      <ul>{employees.map((emp: any) => <li key={emp._id}>{emp.name}</li>)}</ul>
    </div>
  );
}
