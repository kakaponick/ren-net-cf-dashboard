'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Globe,
  KeyRound
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

interface NavigationProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Domains', href: '/', icon: Globe },
  { name: 'Accounts', href: '/accounts', icon: KeyRound },
];

export function Navigation({ children }: NavigationProps) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <header className="border-b bg-card px-6 py-2">
          <div className="flex items-center justify-between">
            <div className="flex gap-6 items-center">
              <h1 className="font-bold">Cloudflare Dashboard</h1>

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
            </div>
            

            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
