import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import Layout from '@/components/layout';
import AccountsPage from '@/pages/accounts';
import DomainsPage from '@/pages/domains';
import DNSRecordsPage from '@/pages/dns-records';
import SSLCertificatesPage from '@/pages/ssl-certificates';
import { useAccountStore } from '@/store/account-store';
import { ThemeProvider } from '@/contexts/theme-context';

function App() {
  const { loadAccounts } = useAccountStore();

  useEffect(() => {
    // Load accounts from localStorage on app initialization
    loadAccounts();
  }, [loadAccounts]);

  return (
    <ThemeProvider defaultTheme="system" storageKey="cf-dashboard-theme">
      <Router>
        <div className="min-h-screen bg-background">
          <Layout>
            <Routes>
              <Route path="/" element={<DomainsPage />} />
              <Route path="/domains" element={<DomainsPage />} />
              <Route path="/accounts" element={<AccountsPage />} />
              <Route path="/dns/:zoneId" element={<DNSRecordsPage />} />
              <Route path="/ssl/:zoneId" element={<SSLCertificatesPage />} />
            </Routes>
          </Layout>
          <Toaster />
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;