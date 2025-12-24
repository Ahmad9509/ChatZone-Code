// Tier configuration constants
// Used across admin pages for consistent tier definitions
// WHAT THIS FILE DOES:
// - Defines all tier information in one place (name, value, color, description)
// - Imported by multiple components to avoid duplication
// - Single source of truth for tier configuration

export const TIERS = [
  {
    value: 'free',
    label: 'Free Tier',
    color: 'bg-cyan-600',
    description: 'Available to all users',
  },
  {
    value: 'tier5',
    label: '$5/$3 Tier',
    color: 'bg-blue-600',
    description: 'Available to paid users',
  },
  {
    value: 'tier10',
    label: '$10 Tier',
    color: 'bg-purple-600',
    description: 'Available to $10+ users',
  },
  {
    value: 'tier15',
    label: '$15 Tier',
    color: 'bg-green-600',
    description: 'Available to $15 users only',
  },
];

// Helper function to get tier by value
export function getTierByValue(value: string) {
  return TIERS.find(t => t.value === value);
}

// Helper function to get tier label
export function getTierLabel(value: string): string {
  return getTierByValue(value)?.label || value;
}

// Helper function to get tier color
export function getTierColor(value: string): string {
  return getTierByValue(value)?.color || 'bg-gray-600';
}

