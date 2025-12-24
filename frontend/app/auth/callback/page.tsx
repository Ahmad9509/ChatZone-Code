// OAuth callback handler
'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      alert('Authentication failed. Please try again.');
      router.push('/login');
      return;
    }

    if (token) {
      localStorage.setItem('token', token);
      router.push('/chat');
    } else {
      router.push('/login');
    }
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-text-primary">
      <div className="rounded-xl border border-border bg-surface px-6 py-8 shadow-card">
        <div className="text-sm text-text-secondary">Signing you in…</div>
      </div>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-text-primary">
          <div className="rounded-xl border border-border bg-surface px-6 py-8 shadow-card">
            <div className="text-sm text-text-secondary">Loading…</div>
          </div>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}

