import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const handle = async () => {
    setLoading(true); setMsg(''); setError('');
    try {
      if (mode === 'signup') {
        const { error: e } = await supabase.auth.signUp({ email, password });
        if (e) throw e;
        setMsg('Account created! Redirecting...');
        setTimeout(() => window.location.href = '/dashboard', 1500);
      } else {
        const { error: e } = await supabase.auth.signInWithPassword({ email, password });
        if (e) throw e;
        window.location.href = '/dashboard';
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Sans',sans-serif;background:#060610;color:#f0eeff;min-height:100vh;display:flex;align-items:center;justify-content:center}
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap');
        .wrap{width:100%;max-width:420px;padding:16px}
        .card{background:rgba(20,18,45,0.95);border:1px solid rgba(124,92,252,0.25);border-radius:20px;padding:2.5rem 2rem}
        .logo{font-family:'Syne',sans-serif;font-size:1.4rem;font-weight:800;text-align:center;margin-bottom:1.5rem}
        .logo span{color:#c34bff}
        h2{font-family:'Syne',sans-serif;font-size:1.5rem;text-align:center;margin-bottom:.4rem}
        .sub{color:#8882aa;font-size:.85rem;text-align:center;margin-bottom:1.8rem}
        .field{margin-bottom:1rem}
        label{font-size:.72rem;color:#8882aa;text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:5px}
        input{width:100%;background:#0a0a1e;border:1px solid rgba(124,92,252,0.2);color:#f0eeff;padding:.75rem 1rem;border-radius:10px;font-family:'DM Sans',sans-serif;font-size:.9rem;outline:none;transition:border-color .2s}
        input:focus{border-color:#7c5cfc}
        .btn{width:100%;padding:.9rem;background:linear-gradient(135deg,#7c5cfc,#c34bff);border:none;color:#fff;font-family:'Syne',sans-serif;font-weight:700;font-size:.95rem;border-radius:10px;cursor:pointer;margin-top:.5rem;transition:opacity .2s}
        .btn:hover{opacity:.88}.btn:disabled{opacity:.55;cursor:not-allowed}
        .toggle{text-align:center;margin-top:1.2rem;font-size:.85rem;color:#8882aa}
        .toggle a{color:#c34bff;cursor:pointer;text-decoration:none}
        .toggle a:hover{text-decoration:underline}
        .msg{padding:10px;background:rgba(46,204,138,.1);border:1px solid rgba(46,204,138,.3);border-radius:8px;color:#2ecc8a;font-size:.82rem;text-align:center;margin-bottom:1rem}
        .err{padding:10px;background:rgba(255,77,100,.1);border:1px solid rgba(255,77,100,.3);border-radius:8px;color:#ff4d64;font-size:.82rem;text-align:center;margin-bottom:1rem}
        .back{text-align:center;margin-top:1rem}
        .back a{color:#8882aa;font-size:.82rem;text-decoration:none}
        .back a:hover{color:#f0eeff}
      `}</style>
      <div className="wrap">
        <div className="card">
          <div className="logo">Reel<span>Mind</span> AI</div>
          <h2>{mode === 'login' ? 'Welcome back' : 'Create account'}</h2>
          <p className="sub">{mode === 'login' ? 'Sign in to your dashboard' : 'Start your free trial today'}</p>

          {msg && <div className="msg">{msg}</div>}
          {error && <div className="err">{error}</div>}

          <div className="field">
            <label>Email Address</label>
            <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handle()} />
          </div>

          <button className="btn" onClick={handle} disabled={loading || !email || !password}>
            {loading ? '⏳ Please wait...' : mode === 'login' ? '→ Sign In' : '→ Create Account & Start Free'}
          </button>

          <div className="toggle">
            {mode === 'login' ? (
              <>Don't have an account? <a onClick={() => { setMode('signup'); setError(''); }}>Sign up free</a></>
            ) : (
              <>Already have an account? <a onClick={() => { setMode('login'); setError(''); }}>Sign in</a></>
            )}
          </div>
          <div className="back"><a href="/">← Back to home</a></div>
        </div>
      </div>
    </>
  );
}
