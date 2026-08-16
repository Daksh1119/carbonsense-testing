"use client";
import { useUserStore } from '@/store';

export default function DebugUserOverlay() {
  if (process.env.NODE_ENV !== 'development') return null;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { user, isAuthenticated } = useUserStore();
  if (!isAuthenticated || !user) return null;
  return (
    <div style={{
      position: 'fixed',
      bottom: 12,
      right: 12,
      zIndex: 9999,
      background: 'rgba(30,41,59,0.95)',
      color: '#fff',
      padding: '12px 20px',
      borderRadius: 8,
      fontSize: 14,
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      pointerEvents: 'none',
      opacity: 0.95,
    }}>
      <div><b>Role:</b> {user.role}</div>
      <div><b>Email:</b> {user.email}</div>
      <div><b>Approval:</b> {String(user.approvalStatus)}</div>
    </div>
  );
}
