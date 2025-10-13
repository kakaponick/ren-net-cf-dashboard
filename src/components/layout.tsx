import { type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Cloud, 
  Users, 
  Globe
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Domains', href: '/domains', icon: Globe },
  { name: 'Accounts', href: '/accounts', icon: Users },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r bg-card">
        <div className="p-6">
          <div className="flex items-center space-x-2">
            <Cloud className="h-8 w-8 text-primary" />
            <h1 className="text-xl font-bold">Cloudflare Dashboard</h1>
          </div>
        </div>
        
        <nav className="px-4 space-y-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            
            return (
              <Link key={item.name} to={item.href}>
                <Button
                  variant={isActive ? "default" : "ghost"}
                  className="w-full justify-start"
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {item.name}
                </Button>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="border-b bg-card px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {location.pathname === '/accounts' && 'Account Management'}
              {location.pathname === '/domains' && 'Domain Management'}
              {location.pathname.startsWith('/dns/') && 'DNS Records'}
              {location.pathname.startsWith('/ssl/') && 'SSL Certificates'}
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
