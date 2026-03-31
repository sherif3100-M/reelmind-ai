import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Index() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        window.location.href = '/dashboard';
      } else {
        window.location.href = '/login';
      }
    });
  }, []);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#0a0a0f', color: '#fff',
      fontFamily: 'sans-serif', fontSize: '1.1rem'
    }}>
      Loading ReelMind AI...
    </div>
  );
}
