import Link from 'next/link';

export default function PayrollLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <nav className="w-64 p-4 bg-gray-900">
        <ul>
          <li><Link href="/payroll">Dashboard</Link></li>
          <li><Link href="/payroll/employees">Employees</Link></li>
          <li><Link href="/payroll/payruns">Pay Runs</Link></li>
        </ul>
      </nav>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
