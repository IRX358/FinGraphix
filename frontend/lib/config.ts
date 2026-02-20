/**
 * Centralized configuration for the FinGraphix frontend.
 */

const isBrowser = typeof window !== 'undefined';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL 
  || (isBrowser ? `${window.location.protocol}//${window.location.hostname}:8000` : 'http://localhost:8000');

export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
