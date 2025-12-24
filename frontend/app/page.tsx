// Landing page for ChatZone.ai
// Modern, production-ready design with dynamic pricing based on geography
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { detectCountry, getPricing } from '@/lib/geography';

export default function LandingPage() {
  const router = useRouter();
  const [pricing, setPricing] = useState({ tier5: 5, tier10: 10, tier15: 15, region: 'western' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in (only on client)
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        router.push('/chat');
        return;
      }
    }

    // Detect user's geography and set pricing
    detectCountry().then((countryCode) => {
      const pricingData = getPricing(countryCode);
      setPricing(pricingData);
      setLoading(false);
    });
  }, [router]);

  const tiers = [
    {
      name: 'Free',
      price: '$0',
      features: [
        'Limited token usage',
        'Basic AI models',
        'No Pro Replies',
        'Community support',
      ],
      cta: 'Get Started',
      highlighted: false,
    },
    {
      name: 'Starter',
      price: `$${pricing.tier5}`,
      features: [
        'More token allowance',
        'GPT-4 access',
        '10 Pro Replies/day',
        'Email support',
        '3 Projects',
      ],
      cta: 'Start Free Trial',
      highlighted: true,
    },
    {
      name: 'Pro',
      price: `$${pricing.tier10}`,
      features: [
        'Higher token limits',
        'All AI models + vision',
        '25 Pro Replies/day',
        'Priority support',
        '10 Projects',
        'RAG knowledge base',
      ],
      cta: 'Start Free Trial',
      highlighted: false,
    },
    {
      name: 'Ultra',
      price: `$${pricing.tier15}`,
      features: [
        'Unlimited tokens',
        'All AI models',
        '50 Pro Replies/day',
        'Dedicated support',
        'Unlimited Projects',
        'Full RAG + integrations',
      ],
      cta: 'Start Free Trial',
      highlighted: false,
    },
  ];

  return (
    <div className="min-h-screen bg-background text-text-primary">
      {/* Header */}
      <header className="border-b border-border bg-surface">
        <div className="container mx-auto flex items-center justify-between px-6 py-5">
          <div className="text-xl font-semibold tracking-tight">ChatZone.ai</div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white shadow-card transition-transform hover:-translate-y-0.5"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="border-b border-border bg-surface py-20">
        <div className="container mx-auto px-6 text-center">
          <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
            Your AI workspace, simplified.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-text-secondary md:text-lg">
            ChatZone brings your conversations, projects, and pro tools into a single calm hub inspired by ChatGPT’s clean aesthetic.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 md:flex-row md:justify-center">
            <Link
              href="/login"
              className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white shadow-card transition-transform hover:-translate-y-0.5"
            >
              Start chatting for free
            </Link>
            <Link
              href="#pricing"
              className="rounded-full border border-border px-6 py-3 text-sm font-semibold text-text-primary transition-colors hover:border-text-secondary"
            >
              View pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16">
        <div className="container mx-auto px-6">
          <h2 className="text-center text-2xl font-semibold tracking-tight md:text-3xl">
            Why teams switch to ChatZone
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-sm text-text-secondary">
            Familiar, polished experience with multitier model access, pro replies, and project organization out of the box.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              {
                title: 'Multiple AI models',
                description: 'Move between GPT-4, Claude, Gemini, and more without changing workflows.',
                icon: '🤖',
              },
              {
                title: 'Pro replies',
                description: 'Blend web search and citations directly into your assistant responses.',
                icon: '🔍',
              },
              {
                title: 'Organised projects',
                description: 'Keep conversations and knowledge bases grouped just like ChatGPT projects.',
                icon: '📁',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-border bg-surface p-6 shadow-card transition-shadow hover:shadow-none"
              >
                <div className="text-2xl">{feature.icon}</div>
                <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-text-secondary">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border bg-surface py-18">
        <div className="container mx-auto px-6">
          <h2 className="text-center text-2xl font-semibold tracking-tight md:text-3xl">
            Simple pricing for every tier
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-sm text-text-secondary">
            Upgrade only when you need more models or usage—downgrades are instant.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-4">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`rounded-2xl border border-border bg-surface p-6 shadow-card transition-transform hover:-translate-y-1 ${
                  tier.highlighted ? 'ring-2 ring-accent' : ''
                }`}
              >
                <h3 className="text-lg font-semibold">{tier.name}</h3>
                <div className="mt-2 text-3xl font-semibold text-text-primary">
                  {tier.price}
                  <span className="ml-1 text-sm text-text-secondary">/mo</span>
                </div>
                <ul className="mt-6 space-y-2 text-sm text-text-secondary">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span className="mt-1 text-accent">•</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login"
                  className={`mt-6 block rounded-full px-4 py-2 text-center text-sm font-semibold transition-colors ${
                    tier.highlighted
                      ? 'bg-accent text-white'
                      : 'border border-border text-text-primary hover:border-text-secondary'
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background py-10">
        <div className="container mx-auto px-6 text-center text-xs text-text-secondary">
          © 2025 ChatZone.ai. Built for teams who want a calm, capable assistant.
        </div>
      </footer>
    </div>
  );
}
