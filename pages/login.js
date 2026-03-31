import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    // If already logged in, redirect to dashboard
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) window.location.href = '/dashboard';
      else setChecking(false);
    });
  }, []);

  async function handleSubmit(e) {
    e?.preventDefault();
    if (!email || !password) { setError('Please enter email and password.'); return; }
    setLoading(true); setError(''); setSuccess('');

    try {
      if (mode === 'signup') {
        const { data, error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        setSuccess('Account created! Signing you in...');
        setTimeout(() => window.location.href = '/dashboard', 1500);
      } else {
        const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        window.location.href = '/dashboard';
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.');
    }
    setLoading(false);
  }

  if (checking) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#060610',color:'#f0eeff',fontFamily:'sans-serif' }}>
      <p>Loading...</p>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Sans',sans-serif;background:#060610;color:#f0eeff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem}
        .card{width:100%;max-width:420px;background:rgba(20,18,45,0.97);border:1px solid rgba(124,92,252,.3);border-radius:20px;padding:2.5rem 2rem;box-shadow:0 0 60px rgba(124,92,252,.12)}
        .logo{font-family:'Syne',sans-serif;font-size:1.4rem;font-weight:800;text-align:center;margin-bottom:1.8rem;letter-spacing:-.02em}
        .logo em{color:#c34bff;font-style:normal}
        h2{font-family:'Syne',sans-serif;font-size:1.5rem;text-align:center;margin-bottom:.3rem}
        .sub{color:#8882aa;font-size:.85rem;text-align:center;margin-bottom:1.8rem}
        .field{margin-bottom:1rem}
        label{font-size:.7rem;color:#8882aa;text-transform:uppercase;letter-spacing:.08em;display:block;margin-bottom:6px;font-weight:500}
        input{width:100%;background:#0a0a1e;border:1px solid rgba(124,92,252,.25);color:#f0eeff;padding:.78rem 1rem;border-radius:10px;font-family:'DM Sans',sans-serif;font-size:.92rem;outline:none;transition:border-color .2s}
        input:focus{border-color:#7c5cfc;box-shadow:0 0 0 3px rgba(124,92,252,.12)}
        .btn{width:100%;padding:.9rem;background:linear-gradient(135deg,#7c5cfc,#c34bff);border:none;color:#fff;font-family:'Syne',sans-serif;font-weight:700;font-size:.95rem;border-radius:10px;cursor:pointer;margin-top:.5rem;transition:all .2s;letter-spacing:.02em}
        .btn:hover:not(:disabled){opacity:.9;transform:translateY(-1px)}
        .btn:disabled{opacity:.5;cursor:not-allowed}
        .mode-toggle{text-align:center;margin-top:1.2rem;font-size:.85rem;color:#8882aa}
        .mode-toggle button{background:none;border:none;color:#c34bff;cursor:pointer;font-size:.85rem;font-family:'DM Sans',sans-serif;text-decoration:underline;padding:0}
        .mode-toggle button:hover{color:#d87aff}
        .alert{padding:10px 14px;border-radius:9px;font-size:.82rem;text-align:center;margin-bottom:1rem;line-height:1.5}
        .alert.error{background:rgba(255,77,100,.1);border:1px solid rgba(255,77,100,.3);color:#ff6b7e}
        .alert.success{background:rgba(46,204,138,.1);border:1px solid rgba(46,204,138,.3);color:#2ecc8a}
        .divider{display:flex;align-items:center;gap:12px;margin:1.2rem 0;color:#8882aa;font-size:.78rem}
        .divider::before,.divider::after{content:'';flex:1;height:1px;background:rgba(124,92,252,.15)}
        .back-home{display:block;text-align:center;margin-top:1rem;color:#8882aa;font-size:.82rem;text-decoration:none;transition:color .2s}
        .back-home:hover{color:#f0eeff}
        .security-note{display:flex;align-items:center;justify-content:center;gap:6px;font-size:.72rem;color:#8882aa;margin-top:1rem}
      `}</style>

      <div className="card">
        <div className="logo">Reel<em>Mind</em> AI</div>

        <h2>{mode === 'login' ? 'Welcome back' : 'Create account'}</h2>
        <p className="sub">
          {mode === 'login'
            ? 'Sign in to access your video dashboard'
            : 'Start free — 3 videos included, no card needed'}
        </p>

        {error && <div className="alert error">⚠️ {error}</div>}
        {success && <div className="alert success">✓ {success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Email address</label>
            <input type="email" placeholder="you@example.com" value={email}
              onChange={e => setEmail(e.target.value)} autoComplete="email" required />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" placeholder={mode === 'signup' ? 'Min 6 characters' : '••••••••'} value={password}
              onChange={e => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
          </div>

          <button className="btn" type="submit" disabled={loading || !email || !password}>
            {loading ? '⏳ Please wait...' : mode === 'login' ? '→ Sign In' : '→ Create Free Account'}
          </button>
        </form>

        <div className="mode-toggle">
          {mode === 'login' ? (
            <>No account? <button onClick={() => { setMode('signup'); setError(''); setSuccess(''); }}>Sign up free</button></>
          ) : (
            <>Have an account? <button onClick={() => { setMode('login'); setError(''); setSuccess(''); }}>Sign in</button></>
          )}
        </div>

        <a href="/index.html" className="back-home">← Back to home</a>
        <div className="security-note">🔒 Secured by Supabase · Your data is encrypted</div>
      </div>
    </>
  );
}
