import { type ClassValue, clsx } from 'clsx'

/**
 * A simple wrapper around clsx for conditional class names.
 * Usage: cn('base-class', isActive && 'active-class', { 'error': hasError })
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs)
}
