import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
          window.location.href = '/login';
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  return <Component {...pageProps} />;
}
