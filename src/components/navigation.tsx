'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Cloud,
  Globe,
  Key
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

interface NavigationProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Domains', href: '/', icon: Globe },
  { name: 'Accounts', href: '/accounts', icon: Key },
];

export function Navigation({ children }: NavigationProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-background">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="border-b bg-card px-6 py-2">
          <div className="flex items-center justify-between">
            <div className="flex gap-2 items-center">
              <Cloud />
              <h1 className="font-bold">Cloudflare Dashboard</h1>
            </div>
            <nav className="flex gap-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Button
                    key={item.name}
                    asChild
                    size="sm"
                    variant={isActive ? "default" : "ghost"}
                  >
                    <Link href={item.href}>
                      <Icon />
                      {item.name}
                    </Link>
                  </Button>
                );
              })}
            </nav>
            <h2 className="w-96 text-lg font-semibold">
              {pathname === '/accounts' && 'Account Management'}
              {pathname === '/' && 'Domain Management'}
              {pathname?.startsWith('/dns/') && 'DNS Records'}
              {pathname?.startsWith('/ssl/') && 'SSL Certificates'}
            </h2>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
