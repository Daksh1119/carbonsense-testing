import { type ClassValue, clsx } from "clsx";

/**
 * Utility function to merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/**
 * Format number with commas
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-IN").format(num);
}

/**
 * Format currency in Indian Rupees
 */
export function formatCurrency(
  amount: number,
  currency: string = "INR"
): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format date to readable string
 */
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

/**
 * Calculate days between two dates
 */
export function daysBetween(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Calculate days remaining from today to target date
 */
export function daysRemaining(targetDate: string | Date): number {
  const today = new Date();
  const target = new Date(targetDate);
  return daysBetween(today, target);
}

/**
 * Format CO2 amount with appropriate unit
 */
export function formatCO2(amount: number): string {
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)} tCO₂e`;
  }
  return `${amount.toFixed(0)} kg CO₂e`;
}

/**
 * Calculate percentage
 */
export function calculatePercentage(part: number, whole: number): number {
  if (whole === 0) return 0;
  return Math.round((part / whole) * 100);
}

/**
 * Get urgency color based on days remaining
 */
export function getUrgencyColor(daysLeft: number): string {
  if (daysLeft < 0) return "text-rose-400";
  if (daysLeft < 30) return "text-rose-400";
  if (daysLeft < 60) return "text-amber-400";
  return "text-emerald-400";
}

/**
 * Get priority badge variant
 */
export function getPriorityVariant(
  priority: "critical" | "high" | "medium" | "low"
): "danger" | "warning" | "info" | "default" {
  switch (priority) {
    case "critical":
      return "danger";
    case "high":
      return "warning";
    case "medium":
      return "info";
    default:
      return "default";
  }
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

/**
 * Generate random ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
