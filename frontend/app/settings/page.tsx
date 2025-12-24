'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { auth } from '@/lib/api';
import { useTheme } from '@/theme/context';

type ThemeOption = 'light' | 'dark' | 'auto';

type NotificationSettings = {
  responseCompletions: boolean;
  weeklyDigest: boolean;
  productUpdates: boolean;
};

type TabId =
  | 'general'
  | 'account'
  | 'appearance'
  | 'subscription'
  | 'notifications'
  | 'privacy'
  | 'advanced';

const tabs: { id: TabId; label: string; icon: string }[] = [
  { id: 'general', label: 'General', icon: '⚙️' },
  { id: 'account', label: 'Account', icon: '👤' },
  { id: 'appearance', label: 'Appearance', icon: '🎨' },
  { id: 'subscription', label: 'Subscription', icon: '💳' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
  { id: 'privacy', label: 'Privacy', icon: '🔒' },
  { id: 'advanced', label: 'Advanced', icon: '🔧' },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, setUser } = useStore();
  const { mode, resolvedMode, setMode } = useTheme();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('general');

  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [workFunction, setWorkFunction] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [themeOption, setThemeOption] = useState<ThemeOption>('auto');
  const [notifications, setNotifications] = useState<NotificationSettings>({
    responseCompletions: true,
    weeklyDigest: false,
    productUpdates: true,
  });
  const [autoDeleteDays, setAutoDeleteDays] = useState('never');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4000);
  const [showTokenUsage, setShowTokenUsage] = useState(false);

  // Dynamic pricing state
  const [pricing, setPricing] = useState<any>(null);
  const [pricingLoading, setPricingLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      if (typeof window === 'undefined') return;

      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        const response = await auth.getMe();
        const currentUser = response.data.user;
        setUser(currentUser);

        setFullName(currentUser.name || '');
        setDisplayName(currentUser.name || '');
        setCustomInstructions(currentUser.customInstructions || '');
        setNotifications({
          responseCompletions: currentUser.settings?.notifications?.responseCompletions ?? true,
          weeklyDigest: currentUser.settings?.notifications?.weeklyDigest ?? false,
          productUpdates: currentUser.settings?.notifications?.productUpdates ?? true,
        });
        setAutoDeleteDays(currentUser.settings?.autoDeleteDays || 'never');
        setTemperature(currentUser.settings?.temperature ?? 0.7);
        setMaxTokens(currentUser.settings?.maxTokens ?? 4000);
        setShowTokenUsage(currentUser.settings?.showTokenUsage ?? false);

        const storedTheme = currentUser.settings?.theme;
        if (storedTheme === 'light' || storedTheme === 'dark') {
          setMode(storedTheme);
        } else {
          setMode('system');
        }
      } catch (error) {
        console.error('Auth error:', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [router, setUser, setMode]);

  // Fetch dynamic pricing based on user's IP
  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/stripe/pricing`);
        const data = await response.json();
        if (data.success) {
          setPricing(data);
        }
      } catch (error) {
        console.error('Failed to fetch pricing:', error);
      } finally {
        setPricingLoading(false);
      }
    };

    fetchPricing();
  }, []);

  useEffect(() => {
    setThemeOption(mode === 'system' ? 'auto' : mode);
  }, [mode]);

  const handleThemeChange = (option: ThemeOption) => {
    setThemeOption(option);
    if (option === 'auto') {
      setMode('system');
    } else {
      setMode(option);
    }
  };

  const handleSaveSettings = async () => {
    try {
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
    }
  };

  const workFunctions = useMemo(
    () => [
      'Software Developer',
      'Designer',
      'Writer',
      'Student',
      'Researcher',
      'Business Professional',
      'Educator',
      'Other',
    ],
    []
  );

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-text-primary">
        <div className="rounded-2xl bg-surface px-6 py-8 soft-elevated">
          <div className="text-sm text-text-secondary">Loading settings…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-text-primary">
      <aside className="flex w-72 flex-col bg-surface soft-elevated">
        <div className="px-6 py-5">
          <button
            onClick={() => router.push('/chat')}
            className="mb-4 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-subtle soft-elevated neumorphic-transition hover:soft-hover"
          >
            ← Back to chat
          </button>
          <h1 className="text-xl font-semibold">Settings</h1>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`mb-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm neumorphic-transition ${
                activeTab === tab.id
                  ? 'bg-surface-subtle text-text-primary soft-elevated border-l-[3px] border-l-accent'
                  : 'text-text-secondary bg-surface soft-elevated hover:soft-hover'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface soft-elevated text-sm font-semibold text-accent">
              {user.name[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{user.name}</div>
              <div className="truncate text-xs text-text-secondary">{user.email}</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-background">
        <div className="mx-auto flex max-w-4xl flex-col gap-8 px-8 py-10">
          {activeTab === 'general' && (
            <>
              <section className="rounded-2xl bg-surface p-6 soft-elevated">
                <h2 className="text-lg font-semibold">Profile</h2>
                <p className="mt-1 text-sm text-text-secondary">Update how ChatZone addresses you.</p>
                <div className="mt-6 flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface soft-elevated text-base font-semibold text-accent">
                    {fullName[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className="flex-1 space-y-4">
                    <div>
                      <label className="text-xs font-semibold uppercase text-text-secondary">Full name</label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="mt-1 w-full rounded-xl border-0 bg-surface-subtle px-4 py-2.5 text-sm soft-pressed focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 neumorphic-transition"
                        placeholder="Enter your full name"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase text-text-secondary">Display name</label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="mt-1 w-full rounded-xl border-0 bg-surface-subtle px-4 py-2.5 text-sm soft-pressed focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 neumorphic-transition"
                        placeholder="What should ChatZone call you?"
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl bg-surface p-6 soft-elevated">
                <h2 className="text-lg font-semibold">Preferences</h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Help us tailor responses to your work and voice.
                </p>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase text-text-secondary">Work function</label>
                    <select
                      value={workFunction}
                      onChange={(e) => setWorkFunction(e.target.value)}
                      className="mt-1 w-full rounded-xl border-0 bg-surface-subtle px-4 py-2.5 text-sm soft-pressed focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 neumorphic-transition"
                    >
                      <option value="">Select</option>
                      {workFunctions.map((fn) => (
                        <option key={fn} value={fn.toLowerCase()}>
                          {fn}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase text-text-secondary">Auto-delete conversations</label>
                    <select
                      value={autoDeleteDays}
                      onChange={(e) => setAutoDeleteDays(e.target.value)}
                      className="mt-1 w-full rounded-xl border-0 bg-surface-subtle px-4 py-2.5 text-sm soft-pressed focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 neumorphic-transition"
                    >
                      <option value="never">Never</option>
                      <option value="30">After 30 days</option>
                      <option value="60">After 60 days</option>
                      <option value="90">After 90 days</option>
                    </select>
                  </div>
                </div>
                <div className="mt-6">
                  <label className="text-xs font-semibold uppercase text-text-secondary">Custom instructions</label>
                  <textarea
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    rows={4}
                    maxLength={5000}
                    className="mt-1 w-full rounded-xl border-0 bg-surface-subtle px-4 py-3 text-sm soft-pressed focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 neumorphic-transition"
                    placeholder="e.g. analogies help me learn new concepts"
                  />
                  <div className="mt-1 text-right text-xs text-text-secondary">
                    {customInstructions.length}/5000
                  </div>
                </div>
              </section>
            </>
          )}

          {activeTab === 'account' && (
            <section className="rounded-2xl bg-surface p-6 soft-elevated">
              <h2 className="text-lg font-semibold">Account details</h2>
              <p className="mt-1 text-sm text-text-secondary">Your sign-in information and referral stats.</p>
              <dl className="mt-6 grid gap-4 md:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase text-text-secondary">Email</dt>
                  <dd className="mt-1 text-sm text-text-primary">{user.email}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-text-secondary">User ID</dt>
                  <dd className="mt-1 font-mono text-xs text-text-secondary">{user._id}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-text-secondary">Member since</dt>
                  <dd className="mt-1 text-sm text-text-primary">
                    {new Date(user.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-text-secondary">Current plan</dt>
                  <dd className="mt-1 text-sm font-semibold capitalize text-text-primary">{user.tier} plan</dd>
                </div>
              </dl>
              <div className="mt-6 rounded-xl bg-surface-subtle p-4 soft-elevated">
                <h3 className="text-sm font-semibold text-text-primary">Referral program</h3>
                <p className="mt-1 text-xs text-text-secondary">
                  Share your link and earn credits when friends upgrade.
                </p>
                <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
                  <input
                    type="text"
                    value={user.referralCode}
                    readOnly
                    className="flex-1 rounded-xl border-0 bg-background px-4 py-2.5 text-sm soft-pressed"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`https://chatzone.ai?ref=${user.referralCode}`);
                      alert('Referral link copied!');
                    }}
                    className="rounded-xl border-0 bg-surface px-4 py-2.5 text-sm font-semibold text-text-primary soft-elevated neumorphic-transition hover:soft-hover active:soft-pressed"
                  >
                    Copy link
                  </button>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'appearance' && (
            <section className="rounded-2xl bg-surface p-6 soft-elevated">
              <h2 className="text-lg font-semibold">Theme</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Choose a light or dark workspace, or follow your system preference.
              </p>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {[
                  { id: 'light', label: 'Light', swatch: 'bg-white' },
                  { id: 'dark', label: 'Dark', swatch: 'bg-[#1f1f1f]' },
                  { id: 'auto', label: 'Match system', swatch: 'bg-gradient-to-r from-white to-[#1f1f1f]' },
                ].map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleThemeChange(option.id as ThemeOption)}
                    className={`flex flex-col items-start gap-3 rounded-xl px-4 py-4 text-left text-sm neumorphic-transition ${
                      themeOption === option.id 
                        ? 'bg-surface-subtle soft-elevated border-l-[3px] border-l-accent' 
                        : 'bg-surface soft-elevated hover:soft-hover'
                    }`}
                  >
                    <div className={`h-16 w-full rounded-lg ${option.swatch} soft-elevated`} />
                    <span className="font-medium text-text-primary">{option.label}</span>
                    {option.id === 'auto' && (
                      <span className="text-xs text-text-secondary">Currently {resolvedMode} mode</span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'subscription' && (
            <section className="rounded-2xl bg-surface p-6 soft-elevated">
              <h2 className="text-lg font-semibold">Subscription</h2>
              <p className="mt-1 text-sm text-text-secondary">Track usage and manage your plan.</p>
              
              {/* Current Plan Status */}
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl bg-surface-subtle p-4 soft-elevated">
                  <h3 className="text-sm font-semibold text-text-primary">Messages sent</h3>
                  <p className="mt-2 text-2xl font-semibold">{user.messageCount || 0}</p>
                </div>
                <div className="rounded-xl bg-surface-subtle p-4 soft-elevated">
                  <h3 className="text-sm font-semibold text-text-primary">Pro replies used</h3>
                  <p className="mt-2 text-2xl font-semibold">{user.proRepliesCount?.total || 0}</p>
                </div>
              </div>

              {/* Available Plans - Dynamic Pricing */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-text-primary">Available plans</h3>
                <p className="mt-1 text-sm text-text-secondary">
                  Pricing based on your location: {pricingLoading ? 'Detecting...' : pricing?.countryCode || 'Unknown'}
                </p>
                
                {pricingLoading ? (
                  <div className="mt-4 text-center py-8">
                    <p className="text-sm text-text-secondary">Loading pricing...</p>
                  </div>
                ) : pricing && pricing.tiers ? (
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    {Object.entries(pricing.tiers).map(([key, tier]: [string, any]) => (
                      <div 
                        key={key}
                        className={`rounded-xl p-4 soft-elevated ${
                          user.tier === key ? 'bg-surface-subtle border-l-[3px] border-l-accent' : 'bg-surface'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold text-text-primary">{tier.name}</h4>
                            <div className="mt-2 flex items-baseline">
                              <span className="text-3xl font-bold text-text-primary">${tier.price}</span>
                              <span className="ml-1 text-sm text-text-secondary">/{tier.interval}</span>
                            </div>
                          </div>
                          {user.tier === key && (
                            <span className="rounded-full bg-accent px-2 py-1 text-xs font-semibold text-white soft-elevated">
                              Current
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            // TODO: Implement subscription flow
                            console.log(`Subscribe to ${tier.tierKey}`);
                          }}
                          disabled={user.tier === key}
                          className={`mt-4 w-full rounded-xl px-4 py-2.5 text-sm font-semibold neumorphic-transition ${
                            user.tier === key
                              ? 'bg-surface-subtle text-text-secondary cursor-not-allowed soft-pressed'
                              : 'bg-accent text-white soft-elevated hover:soft-hover active:soft-pressed'
                          }`}
                        >
                          {user.tier === key ? 'Active plan' : `Upgrade to ${tier.name}`}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl bg-surface-subtle p-4 soft-elevated">
                    <p className="text-sm text-text-secondary">Unable to load pricing. Please try again later.</p>
                  </div>
                )}
              </div>

              <button className="mt-6 w-full rounded-xl border-0 bg-surface px-4 py-2.5 text-sm font-semibold text-text-primary soft-elevated neumorphic-transition hover:soft-hover active:soft-pressed">
                Manage subscription
              </button>
            </section>
          )}

          {activeTab === 'notifications' && (
            <section className="rounded-2xl bg-surface p-6 soft-elevated">
              <h2 className="text-lg font-semibold">Notifications</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Control when we nudge you about activity.
              </p>
              <div className="mt-6 space-y-5">
                {(
                  [
                    {
                      key: 'responseCompletions' as const,
                      title: 'Response completions',
                      description:
                        'Get notified when ChatZone finishes a longer reply, including research or file uploads.',
                    },
                    {
                      key: 'weeklyDigest' as const,
                      title: 'Weekly digest',
                      description: 'Receive a short recap of your usage and highlights each week.',
                    },
                    {
                      key: 'productUpdates' as const,
                      title: 'Product updates',
                      description: 'Hear about new features and improvements as they launch.',
                    },
                  ]
                ).map((item) => (
                  <div key={item.key} className="flex items-start justify-between gap-4 rounded-xl bg-surface-subtle p-4 soft-elevated">
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary">{item.title}</h3>
                      <p className="mt-1 text-sm text-text-secondary">{item.description}</p>
                    </div>
                    <button
                      onClick={() =>
                        setNotifications((prev) => ({
                          ...prev,
                          [item.key]: !prev[item.key],
                        }))
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors soft-elevated ${
                        notifications[item.key] ? 'bg-accent' : 'bg-surface'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform soft-elevated ${
                          notifications[item.key] ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'privacy' && (
            <section className="rounded-2xl bg-surface p-6 soft-elevated">
              <h2 className="text-lg font-semibold">Privacy & data</h2>
              <p className="mt-1 text-sm text-text-secondary">Manage export, retention, and deletion.</p>
              <div className="mt-6 space-y-4">
                <div className="rounded-xl bg-surface-subtle p-4 soft-elevated">
                  <h3 className="text-sm font-semibold text-text-primary">Conversation history</h3>
                  <p className="mt-1 text-sm text-text-secondary">
                    Conversations follow the auto-delete schedule you set in General preferences.
                  </p>
                </div>
                <div className="rounded-xl bg-surface-subtle p-4 soft-elevated">
                  <h3 className="text-sm font-semibold text-text-primary">Export data</h3>
                  <p className="mt-1 text-sm text-text-secondary">
                    Download your messages, settings, and usage in JSON format.
                  </p>
                  <button className="mt-3 rounded-xl border-0 bg-surface px-4 py-2.5 text-sm font-semibold text-text-primary soft-elevated neumorphic-transition hover:soft-hover active:soft-pressed">
                    Request export
                  </button>
                </div>
                <div className="rounded-xl bg-surface-subtle p-4 soft-elevated">
                  <h3 className="text-sm font-semibold text-text-primary text-red-500">Delete account</h3>
                  <p className="mt-1 text-sm text-text-secondary">
                    Permanently remove your data. This action cannot be undone.
                  </p>
                  <button className="mt-3 rounded-xl border-0 bg-surface px-4 py-2.5 text-sm font-semibold text-red-500 soft-elevated neumorphic-transition hover:soft-hover active:soft-pressed">
                    Delete account
                  </button>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'advanced' && (
            <section className="rounded-2xl bg-surface p-6 soft-elevated">
              <h2 className="text-lg font-semibold">Advanced controls</h2>
              <p className="mt-1 text-sm text-text-secondary">Fine-tune how the assistant responds.</p>
              <div className="mt-6 space-y-6">
                <div className="rounded-xl bg-surface-subtle p-4 soft-elevated">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-text-primary">Temperature</label>
                    <span className="text-sm text-text-secondary">{temperature.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="mt-2 w-full accent-accent"
                  />
                  <p className="mt-1 text-xs text-text-secondary">
                    Lower values keep responses focused, higher values make them more inventive.
                  </p>
                </div>
                <div className="rounded-xl bg-surface-subtle p-4 soft-elevated">
                  <label className="text-sm font-semibold text-text-primary">Max tokens per response</label>
                  <input
                    type="number"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value, 10) || 0)}
                    min={100}
                    max={32000}
                    step={100}
                    className="mt-2 w-full rounded-xl border-0 bg-background px-4 py-2.5 text-sm soft-pressed focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 neumorphic-transition"
                  />
                </div>
                <div className="flex items-center justify-between rounded-xl bg-surface-subtle p-4 soft-elevated">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Show token usage</h3>
                    <p className="mt-1 text-sm text-text-secondary">Display token counts for each message in chat.</p>
                  </div>
                  <button
                    onClick={() => setShowTokenUsage((prev) => !prev)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors soft-elevated ${
                      showTokenUsage ? 'bg-accent' : 'bg-surface'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform soft-elevated ${
                        showTokenUsage ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </section>
          )}

          <div className="sticky bottom-0 bg-background py-4">
            <button
              onClick={handleSaveSettings}
              className="w-full rounded-xl border-0 bg-accent px-4 py-3.5 text-sm font-semibold text-white soft-elevated neumorphic-transition hover:soft-hover active:soft-pressed"
            >
              Save changes
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

