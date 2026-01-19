'use client';

import { Suspense, useEffect } from 'react';
import { useAccountStore } from '@/store/account-store';
import CredentialsContent from '@/views/accounts';

export default function CredentialsPage() {
  return (
    <Suspense fallback={null}>
      <CredentialsContent />
    </Suspense>
  )
}
