import { type ClassValue, clsx } from 'clsx';

// Simple cn utility without tailwind-merge to avoid extra dependency
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'IPL-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function formatCurrency(amount: number): string {
  if (amount >= 1) {
    return `${amount.toFixed(2)} Cr`;
  }
  return `${(amount * 100).toFixed(0)} L`;
}

export function formatNumber(num: number): string {
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`;
  }
  return num.toString();
}

export function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getRatingColor(rating: number): string {
  if (rating >= 85) return 'text-emerald-400';
  if (rating >= 70) return 'text-blue-400';
  if (rating >= 55) return 'text-yellow-400';
  if (rating >= 40) return 'text-orange-400';
  return 'text-red-400';
}

export function getRatingLabel(rating: number): string {
  if (rating >= 85) return 'Elite';
  if (rating >= 70) return 'Star';
  if (rating >= 55) return 'Good';
  if (rating >= 40) return 'Average';
  return 'Developing';
}
