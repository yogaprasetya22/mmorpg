export const API_BASE_URL = typeof window !== 'undefined' 
  ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080')
  : 'http://localhost:8080';

export const WS_BASE_URL = typeof window !== 'undefined'
  ? (process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws')
  : 'ws://localhost:8080/ws';
