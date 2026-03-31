import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ── Config ────────────────────────────────────────────────────
const NICHES = [
  { v:'finance',    l:'💰 Personal Finance' },
  { v:'motivation', l:'🧠 Mindset & Motivation' },
  { v:'tech',       l:'📱 Tech & AI News' },
  { v:'facts',      l:'🌍 Amazing Facts' },
  { v:'fitness',    l:'🏋️ Fitness & Health' },
  { v:'books',      l:'📚 Book Summaries' },
  { v:'gaming',     l:'🕹️ Gaming' },
  { v:'cooking',    l:'🍳 Cooking Tips' },
  { v:'history',    l:'🏛️ History' },
  { v:'mystery',    l:'🔮 Mystery' },
];

const VOICES = [
  { v:'deep_male',   l:'Deep Male' },
  { v:'calm_female', l:'Calm Female' },
  { v:'energetic',   l:'Energetic' },
  { v:'british',     l:'British' },
  { v:'asmr',        l:'ASMR Soft' },
];

const STYLES = ['Cinematic','Minimalist','Animated','News Style','Lo-Fi'];
const DURATIONS = [15, 30, 60, 90];

const STATUS_MSG = {
  pending:        '⏳ Queued — starting soon...',
  scripting:      '🧠 Gemini AI writing your script...',
  voicing:        '🎙 ElevenLabs generating voiceover...',
  fetching_broll: '🎬 Fetching HD footage from Pexels...',
  rendering:      '⚙️ Assembling video assets...',
  uploading:      '📤 Saving to Supabase Storage...',
  scheduled:      '✅ Video ready! All assets assembled.',
  published:      '✅ Published to YouTube!',
  failed:         '❌ Generation failed.',
};

const STATUS_PROGRESS = {
  pending:5, scripting:20, voicing:45, fetching_broll:65,
  rendering:82, uploading:92, scheduled:100, published:100, failed:0,
};

// ── Helpers ────────────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('Not authenticated'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed ${res.status}`);
  return data;
}

// ── Main Dashboard Component ──────────────────────────────────
export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab, setTab] = useState('generate');

  // Generator
  const [niche, setNiche] = useState('finance');
  const [duration, setDuration] = useState(30);
  const [style, setStyle] = useState('Cinematic');
  const [voice, setVoice] = useState('deep_male');
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [genMsg, setGenMsg] = useState('');
  const [generatedVideo, setGeneratedVideo] = useState(null);
  const [genError, setGenError] = useState('');

  // Videos
  const [videos, setVideos] = useState([]);
  const [videosLoading, setVideosLoading] = useState(false);

  // Admin
  const [adminData, setAdminData] = useState(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [grantEmail, setGrantEmail] = useState('');
  const [grantCredits, setGrantCredits] = useState(100);
  const [grantPlan, setGrantPlan] = useState('creator');
  const [grantMsg, setGrantMsg] = useState('');

  // ── Auth ────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { window.location.href = '/login'; return; }
      setUser(session.user);
      await refreshProfile(session.user.id);
      setAuthLoading(false);
    });
  }, []);

  async function refreshProfile(uid) {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single();
    setProfile(data);
    return data;
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  // ── Load Videos ──────────────────────────────────────────────
  const loadVideos = useCallback(async () => {
    setVideosLoading(true);
    try {
      const data = await apiFetch('/api/videos/list');
      setVideos(data.videos || []);
    } catch (e) { console.error(e); }
    setVideosLoading(false);
  }, []);

  useEffect(() => {
    if (!authLoading && (tab === 'videos' || tab === 'generate')) loadVideos();
  }, [tab, authLoading]);

  // ── Load Admin Data ──────────────────────────────────────────
  useEffect(() => {
    if (tab === 'admin' && profile?.is_admin && !adminData) {
      setAdminLoading(true);
      apiFetch('/api/admin/stats').then(d => { setAdminData(d); setAdminLoading(false); }).catch(() => setAdminLoading(false));
    }
  }, [tab, profile]);

  // ── Generate Video ───────────────────────────────────────────
  async function startGeneration() {
    if (generating) return;
    setGenerating(true);
    setGenProgress(5);
    setGenMsg('⏳ Queued — starting soon...');
    setGenError('');
    setGeneratedVideo(null);

    try {
      const data = await apiFetch('/api/videos/generate', {
        method: 'POST',
        body: JSON.stringify({ niche, duration, style, voiceId: voice, customPrompt: prompt }),
      });
      pollVideo(data.videoId);
    } catch (e) {
      setGenError(e.message);
      setGenerating(false);
      setGenProgress(0);
      setGenMsg('');
    }
  }

  function pollVideo(videoId) {
    let attempts = 0;
    const maxAttempts = 90; // 4.5 min max

    const check = async () => {
      try {
        const data = await apiFetch(`/api/videos/${videoId}/status`);
        setGenProgress(data.progress || 0);
        setGenMsg(STATUS_MSG[data.status] || data.message || '');

        if (data.isReady) {
          setGeneratedVideo(data);
          setGenerating(false);
          await refreshProfile(user.id);
          await loadVideos();
          return;
        }

        if (data.status === 'failed') {
          setGenError('Generation failed: ' + (data.error_message || 'Unknown error. Check Vercel logs.'));
          setGenerating(false);
          setGenProgress(0);
          return;
        }

        attempts++;
        if (attempts < maxAttempts) setTimeout(check, 3000);
        else {
          setGenMsg('⚠️ Taking longer than expected. Check the Videos tab.');
          setGenerating(false);
        }
      } catch (e) {
        attempts++;
        if (attempts < maxAttempts) setTimeout(check, 5000);
        else setGenerating(false);
      }
    };

    setTimeout(check, 2000);
  }

  // ── Admin: Grant Credits ─────────────────────────────────────
  async function handleGrant() {
    setGrantMsg('');
    if (!grantEmail) { setGrantMsg('Enter an email'); return; }
    try {
      // Find user by email
      const { data: targetProfile } = await supabase.from('profiles').select('id, email').eq('email', grantEmail).single();
      if (!targetProfile) { setGrantMsg('User not found — they must sign up first'); return; }

      await apiFetch('/api/admin/grant-credits', {
        method: 'POST',
        body: JSON.stringify({ targetUserId: targetProfile.id, credits: Number(grantCredits), plan: grantPlan }),
      });
      setGrantMsg(`✅ Granted ${grantCredits} credits + ${grantPlan} plan to ${grantEmail}`);
      // Refresh admin data
      const data = await apiFetch('/api/admin/stats');
      setAdminData(data);
    } catch (e) {
      setGrantMsg('❌ ' + e.message);
    }
  }

  // ── Loading State ────────────────────────────────────────────
  if (authLoading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#060610',color:'#f0eeff',fontFamily:'DM Sans,sans-serif',flexDirection:'column',gap:'1rem' }}>
      <div style={{ width:40,height:40,border:'3px solid rgba(124,92,252,.3)',borderTopColor:'#7c5cfc',borderRadius:'50%',animation:'spin 1s linear infinite' }} />
      <p style={{ color:'#8882aa' }}>Loading your dashboard...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const isAdmin = profile?.is_admin;
  const credits = profile?.video_credits ?? 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Sans',sans-serif;background:#060610;color:#f0eeff;min-height:100vh}
        h1,h2,h3,h4{font-family:'Syne',sans-serif;font-weight:800}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}

        /* Layout */
        .layout{display:grid;grid-template-columns:220px 1fr;min-height:100vh}
        @media(max-width:768px){.layout{grid-template-columns:1fr}.sidebar{display:none}}

        /* Sidebar */
        .sidebar{background:#080818;border-right:1px solid rgba(124,92,252,.18);padding:1.2rem 1rem;display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow-y:auto}
        .logo{font-family:'Syne',sans-serif;font-size:1.15rem;font-weight:800;padding:.5rem .6rem;margin-bottom:1.2rem;letter-spacing:-.02em}
        .logo em{color:#c34bff;font-style:normal}
        .nav-btn{display:flex;align-items:center;gap:10px;width:100%;padding:.62rem .85rem;background:transparent;border:none;color:#8882aa;font-family:'DM Sans',sans-serif;font-size:.87rem;border-radius:9px;cursor:pointer;text-align:left;transition:all .18s;margin-bottom:2px}
        .nav-btn:hover{background:rgba(124,92,252,.1);color:#e0dcff}
        .nav-btn.active{background:rgba(124,92,252,.18);color:#c4b8ff}
        .nav-icon{font-size:.95rem;width:18px;text-align:center;flex-shrink:0}
        .sidebar-bottom{margin-top:auto;padding-top:1rem;border-top:1px solid rgba(124,92,252,.12)}
        .credit-card{background:rgba(124,92,252,.1);border:1px solid rgba(124,92,252,.2);border-radius:12px;padding:.9rem;margin-bottom:.8rem}
        .credit-label{font-size:.68rem;color:#8882aa;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}
        .credit-num{font-family:'Syne',sans-serif;font-size:1.8rem;font-weight:800;line-height:1;color:${credits > 0 ? '#c34bff' : '#ff4d64'}}
        .credit-sub{font-size:.68rem;color:#8882aa;margin-top:3px}
        .plan-pill{display:inline-block;padding:2px 10px;border-radius:50px;font-size:.68rem;font-weight:600;margin-top:6px;text-transform:uppercase;letter-spacing:.04em}
        .plan-free{background:rgba(136,130,170,.12);color:#8882aa;border:1px solid rgba(136,130,170,.25)}
        .plan-starter{background:rgba(46,204,138,.08);color:#2ecc8a;border:1px solid rgba(46,204,138,.25)}
        .plan-creator{background:rgba(124,92,252,.1);color:#b59dff;border:1px solid rgba(124,92,252,.3)}
        .plan-agency{background:rgba(195,75,255,.1);color:#c34bff;border:1px solid rgba(195,75,255,.3)}
        .signout-btn{display:flex;align-items:center;gap:8px;width:100%;padding:.62rem .85rem;background:transparent;border:none;color:#8882aa;font-family:'DM Sans',sans-serif;font-size:.85rem;border-radius:9px;cursor:pointer;transition:all .18s}
        .signout-btn:hover{background:rgba(255,77,100,.1);color:#ff6b7e}

        /* Main */
        .main{padding:2rem;overflow-y:auto;animation:fadeIn .3s ease}
        .page-hdr{margin-bottom:1.8rem}
        .page-title{font-size:1.7rem;margin-bottom:.3rem}
        .page-sub{color:#8882aa;font-size:.88rem}

        /* Cards */
        .card{background:rgba(20,18,45,.95);border:1px solid rgba(124,92,252,.18);border-radius:16px;padding:1.5rem}
        .card-title{font-size:.95rem;font-weight:700;color:#c4b8ff;margin-bottom:1.2rem;display:flex;align-items:center;gap:8px}

        /* Form elements */
        .fl{font-size:.68rem;color:#8882aa;text-transform:uppercase;letter-spacing:.08em;display:block;margin-bottom:6px;font-weight:500}
        select,textarea,input{width:100%;background:#0a0a1e;border:1px solid rgba(124,92,252,.22);color:#f0eeff;padding:.65rem .9rem;border-radius:9px;font-family:'DM Sans',sans-serif;font-size:.87rem;outline:none;transition:border-color .2s}
        select:focus,textarea:focus,input:focus{border-color:#7c5cfc}
        select option{background:#0a0a1e}
        textarea{resize:none}
        .fgroup{margin-bottom:1rem}

        /* Tags */
        .tags{display:flex;flex-wrap:wrap;gap:6px}
        .tag{padding:5px 12px;border-radius:50px;font-size:.75rem;cursor:pointer;border:1px solid rgba(124,92,252,.2);background:#0a0a1e;color:#8882aa;transition:all .18s;user-select:none}
        .tag:hover{border-color:rgba(124,92,252,.5);color:#e0dcff}
        .tag.on{background:rgba(124,92,252,.2);border-color:#7c5cfc;color:#c4b8ff}

        /* Buttons */
        .btn-primary{background:linear-gradient(135deg,#7c5cfc,#c34bff);color:#fff;border:none;padding:.85rem 1.5rem;border-radius:10px;font-family:'Syne',sans-serif;font-weight:700;font-size:.9rem;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px}
        .btn-primary:hover:not(:disabled){opacity:.88;transform:translateY(-1px)}
        .btn-primary:disabled{opacity:.45;cursor:not-allowed;transform:none}
        .btn-outline{background:transparent;color:#c4b8ff;border:1px solid rgba(124,92,252,.35);padding:.7rem 1.2rem;border-radius:9px;font-family:'Syne',sans-serif;font-weight:700;font-size:.85rem;cursor:pointer;transition:all .2s}
        .btn-outline:hover{background:rgba(124,92,252,.1)}
        .btn-red{background:#ff0000;color:#fff;border:none;padding:.82rem 1.4rem;border-radius:10px;font-family:'Syne',sans-serif;font-weight:700;font-size:.88rem;cursor:pointer;transition:opacity .2s;display:flex;align-items:center;justify-content:center;gap:8px}
        .btn-red:hover{opacity:.88}
        .btn-success{background:rgba(46,204,138,.15);color:#2ecc8a;border:1px solid rgba(46,204,138,.3);padding:.7rem 1.2rem;border-radius:9px;font-family:'Syne',sans-serif;font-weight:700;font-size:.85rem;cursor:pointer}

        /* Grid layouts */
        .grid2{display:grid;grid-template-columns:1fr 1fr;gap:1.2rem}
        @media(max-width:900px){.grid2{grid-template-columns:1fr}}
        .grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem}
        @media(max-width:800px){.grid4{grid-template-columns:repeat(2,1fr)}}

        /* Progress bar */
        .pbar-wrap{width:100%;height:5px;background:rgba(124,92,252,.12);border-radius:3px;overflow:hidden;margin-top:8px}
        .pbar-fill{height:100%;background:linear-gradient(90deg,#7c5cfc,#c34bff);border-radius:3px;transition:width .5s ease}

        /* Preview box */
        .preview{background:#040410;border:2px dashed rgba(124,92,252,.2);border-radius:12px;min-height:190px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:1.2rem;text-align:center;margin-bottom:.8rem;transition:all .3s}
        .preview.ready{border-style:solid;border-color:rgba(46,204,138,.4);background:linear-gradient(160deg,rgba(46,204,138,.06),rgba(6,6,16,.9))}
        .preview.active{border-color:rgba(124,92,252,.4);background:linear-gradient(160deg,rgba(124,92,252,.08),rgba(6,6,16,.9))}

        /* Video rows */
        .video-row{display:flex;align-items:center;gap:12px;padding:11px 14px;background:rgba(13,12,30,.8);border:1px solid rgba(124,92,252,.12);border-radius:10px;margin-bottom:6px;transition:border-color .2s}
        .video-row:hover{border-color:rgba(124,92,252,.3)}
        .vthumb{width:36px;height:48px;border-radius:7px;flex-shrink:0;background:linear-gradient(135deg,rgba(124,92,252,.4),rgba(195,75,255,.25))}
        .vinfo{flex:1;min-width:0}
        .vtitle{font-size:.84rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px}
        .vmeta{font-size:.7rem;color:#8882aa}
        .vstatus{font-size:.65rem;padding:3px 9px;border-radius:50px;white-space:nowrap;font-weight:600;flex-shrink:0}
        .vstatus.scheduled,.vstatus.published{background:rgba(46,204,138,.1);color:#2ecc8a;border:1px solid rgba(46,204,138,.25)}
        .vstatus.scripting,.vstatus.voicing,.vstatus.fetching_broll,.vstatus.rendering{background:rgba(124,92,252,.15);color:#b59dff;border:1px solid rgba(124,92,252,.25)}
        .vstatus.failed{background:rgba(255,77,100,.1);color:#ff6b7e;border:1px solid rgba(255,77,100,.3)}
        .vstatus.pending{background:rgba(251,192,45,.08);color:#fbc02d;border:1px solid rgba(251,192,45,.25)}

        /* Alert boxes */
        .alert-err{padding:10px 14px;background:rgba(255,77,100,.1);border:1px solid rgba(255,77,100,.3);border-radius:9px;color:#ff6b7e;font-size:.83rem;margin-bottom:1rem}
        .alert-ok{padding:10px 14px;background:rgba(46,204,138,.1);border:1px solid rgba(46,204,138,.3);border-radius:9px;color:#2ecc8a;font-size:.83rem;margin-bottom:1rem}
        .alert-info{padding:10px 14px;background:rgba(124,92,252,.1);border:1px solid rgba(124,92,252,.25);border-radius:9px;color:#b59dff;font-size:.83rem;margin-bottom:1rem}

        /* Stat cards */
        .stat-card{background:rgba(20,18,45,.95);border:1px solid rgba(124,92,252,.15);border-radius:14px;padding:1.2rem}
        .stat-label{font-size:.7rem;color:#8882aa;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
        .stat-num{font-family:'Syne',sans-serif;font-size:2rem;font-weight:800;line-height:1}
        .stat-sub{font-size:.7rem;color:#8882aa;margin-top:4px}

        /* Table */
        .data-table{width:100%;border-collapse:collapse;font-size:.82rem}
        .data-table th{padding:8px 12px;text-align:left;color:#8882aa;font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid rgba(124,92,252,.15)}
        .data-table td{padding:9px 12px;border-bottom:1px solid rgba(124,92,252,.08)}
        .data-table tr:last-child td{border-bottom:none}
        .data-table tr:hover td{background:rgba(124,92,252,.04)}

        .empty{text-align:center;padding:3rem;color:#8882aa}
        .empty-icon{font-size:2.5rem;margin-bottom:.8rem;opacity:.5}
        .spin{animation:spin 1s linear infinite;display:inline-block}
        .score-pill{padding:2px 9px;border-radius:50px;font-size:.7rem;background:rgba(46,204,138,.1);border:1px solid rgba(46,204,138,.25);color:#2ecc8a;margin-left:6px}
      `}</style>

      <div className="layout">
        {/* ════ SIDEBAR ════ */}
        <aside className="sidebar">
          <div className="logo">Reel<em>Mind</em> AI</div>

          {[
            { id:'generate', icon:'🎬', label:'Generate Video' },
            { id:'videos',   icon:'📹', label:'My Videos' },
            { id:'youtube',  icon:'▶',  label:'YouTube' },
            { id:'account',  icon:'👤', label:'Account' },
            ...(isAdmin ? [{ id:'admin', icon:'⚡', label:'Admin Panel' }] : []),
          ].map(item => (
            <button key={item.id}
              className={`nav-btn${tab === item.id ? ' active' : ''}`}
              onClick={() => setTab(item.id)}>
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {item.id === 'admin' && <span style={{ marginLeft:'auto', fontSize:'.62rem', background:'rgba(195,75,255,.2)', color:'#c34bff', padding:'1px 6px', borderRadius:'50px' }}>ADMIN</span>}
            </button>
          ))}

          <div className="sidebar-bottom">
            <div className="credit-card">
              <div className="credit-label">Video Credits</div>
              <div className="credit-num">{isAdmin ? '∞' : credits}</div>
              <div className="credit-sub">{isAdmin ? 'Admin — unlimited' : 'remaining this month'}</div>
              <span className={`plan-pill plan-${profile?.plan || 'free'}`}>{profile?.plan || 'free'} plan</span>
            </div>
            <div style={{ fontSize:'.72rem', color:'#8882aa', padding:'0 .5rem', marginBottom:'.6rem', wordBreak:'break-all' }}>{user?.email}</div>
            <button className="signout-btn" onClick={signOut}>↩ Sign out</button>
          </div>
        </aside>

        {/* ════ MAIN CONTENT ════ */}
        <main className="main">

          {/* ─── GENERATE ─────────────────────────────── */}
          {tab === 'generate' && (
            <>
              <div className="page-hdr">
                <h1 className="page-title">🎬 Video Generator</h1>
                <p className="page-sub">Configure your reel and click Generate. Gemini writes the script, ElevenLabs adds voice, Pexels provides footage.</p>
              </div>

              {!isAdmin && credits <= 0 && (
                <div className="alert-err">
                  ⚠️ You have 0 credits remaining. <a href="/#pricing" style={{ color:'#c34bff' }}>Upgrade your plan</a> to generate more videos.
                </div>
              )}

              <div className="grid2">
                {/* Left panel: Settings */}
                <div className="card">
                  <div className="card-title">⚙️ Video Settings</div>

                  <div className="fgroup">
                    <span className="fl">Niche / Topic Category</span>
                    <select value={niche} onChange={e => setNiche(e.target.value)}>
                      {NICHES.map(n => <option key={n.v} value={n.v}>{n.l}</option>)}
                    </select>
                  </div>

                  <div className="fgroup">
                    <span className="fl">Video Duration</span>
                    <div className="tags">
                      {DURATIONS.map(d => (
                        <span key={d} className={`tag${duration === d ? ' on' : ''}`} onClick={() => setDuration(d)}>
                          {d}s {d <= 30 ? 'Short' : d <= 60 ? 'Medium' : 'Long'}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="fgroup">
                    <span className="fl">Visual Style</span>
                    <div className="tags">
                      {STYLES.map(s => (
                        <span key={s} className={`tag${style === s ? ' on' : ''}`} onClick={() => setStyle(s)}>{s}</span>
                      ))}
                    </div>
                  </div>

                  <div className="fgroup">
                    <span className="fl">AI Voice</span>
                    <div className="tags">
                      {VOICES.map(v => (
                        <span key={v.v} className={`tag${voice === v.v ? ' on' : ''}`} onClick={() => setVoice(v.v)}>{v.l}</span>
                      ))}
                    </div>
                  </div>

                  <div className="fgroup">
                    <span className="fl">Custom Prompt (optional)</span>
                    <textarea
                      rows={3}
                      placeholder={`e.g. "Top 5 money habits that changed my life" — leave blank for AI to decide`}
                      value={prompt}
                      onChange={e => setPrompt(e.target.value)}
                    />
                  </div>

                  <button
                    className="btn-primary"
                    style={{ width:'100%', marginTop:'.4rem' }}
                    onClick={startGeneration}
                    disabled={generating || (!isAdmin && credits <= 0)}>
                    {generating
                      ? <><span className="spin">⚙️</span> Generating...</>
                      : '✦ Generate AI Video'}
                  </button>

                  {genError && <div className="alert-err" style={{ marginTop:'10px' }}>{genError}</div>}
                </div>

                {/* Right panel: Preview */}
                <div className="card">
                  <div className="card-title">📺 Preview & Status</div>

                  <div className={`preview${generating ? ' active' : generatedVideo ? ' ready' : ''}`}>
                    {generatedVideo ? (
                      <>
                        <div style={{ fontSize:'2rem' }}>✅</div>
                        <p style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:'.9rem', maxWidth:240, lineHeight:1.35, textAlign:'center' }}>
                          {generatedVideo.seo_title}
                        </p>
                        {generatedVideo.viral_score && (
                          <span className="score-pill">⚡ Viral Score: {generatedVideo.viral_score}/100</span>
                        )}
                        {generatedVideo.voiceover_url && (
                          <div style={{ width:'100%', marginTop:'8px' }}>
                            <p style={{ fontSize:'.68rem', color:'#8882aa', marginBottom:'5px' }}>🎙 AI Voiceover:</p>
                            <audio controls style={{ width:'100%', height:32 }} src={generatedVideo.voiceover_url}>
                              Your browser does not support audio.
                            </audio>
                          </div>
                        )}
                        {generatedVideo.youtube_url && (
                          <a href={generatedVideo.youtube_url} target="_blank" rel="noreferrer"
                            style={{ marginTop:8, padding:'6px 14px', background:'#ff0000', color:'#fff', borderRadius:7, fontSize:'.78rem', textDecoration:'none', fontWeight:700 }}>
                            ▶ View on YouTube
                          </a>
                        )}
                      </>
                    ) : generating ? (
                      <>
                        <div className="spin" style={{ fontSize:'1.8rem' }}>⚙️</div>
                        <p style={{ fontSize:'.82rem', color:'#c4b8ff', fontWeight:500 }}>AI is generating your reel...</p>
                        <p style={{ fontSize:'.72rem', color:'#8882aa' }}>Please wait — takes 30–90 seconds</p>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize:'2rem', opacity:.3 }}>▶</div>
                        <p style={{ fontSize:'.85rem', color:'#8882aa' }}>Your reel will appear here</p>
                        <p style={{ fontSize:'.72rem', color:'rgba(136,130,170,.5)' }}>Configure settings and click Generate</p>
                      </>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="pbar-wrap">
                    <div className="pbar-fill" style={{ width: genProgress + '%' }} />
                  </div>
                  <p style={{ fontSize:'.74rem', color:'#8882aa', marginTop:'6px', minHeight:'18px' }}>{genMsg}</p>

                  {/* Recent videos mini-list */}
                  {videos.length > 0 && (
                    <div style={{ marginTop:'1.2rem' }}>
                      <p style={{ fontSize:'.68rem', textTransform:'uppercase', letterSpacing:'.06em', color:'#8882aa', marginBottom:'8px' }}>Recent Generations</p>
                      {videos.slice(0,3).map(v => (
                        <div className="video-row" key={v.id}>
                          <div className="vthumb" />
                          <div className="vinfo">
                            <div className="vtitle">{v.seo_title || `${v.niche} — ${v.duration}s`}</div>
                            <div className="vmeta">{v.niche} · {v.duration}s · {new Date(v.created_at).toLocaleDateString()}</div>
                          </div>
                          <span className={`vstatus ${v.status}`}>{v.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ─── VIDEOS ────────────────────────────────── */}
          {tab === 'videos' && (
            <>
              <div className="page-hdr">
                <h1 className="page-title">📹 My Videos</h1>
                <p className="page-sub">{videos.length} video{videos.length !== 1 ? 's' : ''} generated · {profile?.total_videos_generated || 0} total all time</p>
              </div>

              <div className="grid4" style={{ marginBottom:'1.5rem' }}>
                {[
                  { label:'Total Videos', val: videos.length, color:'#f0eeff' },
                  { label:'Ready / Published', val: videos.filter(v=>['scheduled','published'].includes(v.status)).length, color:'#2ecc8a' },
                  { label:'In Progress', val: videos.filter(v=>['pending','scripting','voicing','fetching_broll','rendering'].includes(v.status)).length, color:'#b59dff' },
                  { label:'Credits Left', val: isAdmin ? '∞' : credits, color:'#c34bff' },
                ].map(s => (
                  <div className="stat-card" key={s.label}>
                    <div className="stat-label">{s.label}</div>
                    <div className="stat-num" style={{ color:s.color }}>{s.val}</div>
                  </div>
                ))}
              </div>

              {videosLoading ? (
                <div className="empty"><div className="spin" style={{ fontSize:'1.5rem' }}>⚙️</div><p style={{ marginTop:'1rem' }}>Loading videos...</p></div>
              ) : videos.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">🎬</div>
                  <p>No videos yet.</p>
                  <p style={{ marginTop:'.4rem', fontSize:'.85rem' }}>Go to the Generate tab to create your first AI reel!</p>
                  <button className="btn-primary" style={{ margin:'1rem auto 0', padding:'.75rem 1.5rem' }} onClick={() => setTab('generate')}>
                    → Go to Generator
                  </button>
                </div>
              ) : (
                videos.map(v => (
                  <div className="video-row" key={v.id}>
                    <div className="vthumb" />
                    <div className="vinfo">
                      <div className="vtitle">
                        {v.seo_title || `${v.niche} video — ${v.duration}s`}
                        {v.viral_score && <span className="score-pill">⚡ {v.viral_score}/100</span>}
                      </div>
                      <div className="vmeta">
                        {v.niche} · {v.duration}s · {v.style} · {v.voice_id?.replace('_',' ')}
                        {' · '}{new Date(v.created_at).toLocaleDateString()}
                        {v.error_message && <span style={{ color:'#ff6b7e', marginLeft:8 }}>Error: {v.error_message.slice(0,60)}</span>}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:'6px', alignItems:'center', flexShrink:0 }}>
                      {v.voiceover_url && (
                        <a href={v.voiceover_url} target="_blank" rel="noreferrer"
                          style={{ padding:'4px 10px', background:'rgba(124,92,252,.15)', border:'1px solid rgba(124,92,252,.3)', color:'#b59dff', borderRadius:6, fontSize:'.72rem', textDecoration:'none', fontWeight:700 }}>
                          🎙 Audio
                        </a>
                      )}
                      {v.youtube_url && (
                        <a href={v.youtube_url} target="_blank" rel="noreferrer"
                          style={{ padding:'4px 10px', background:'rgba(255,0,0,.15)', border:'1px solid rgba(255,0,0,.3)', color:'#ff6b7e', borderRadius:6, fontSize:'.72rem', textDecoration:'none', fontWeight:700 }}>
                          ▶ YouTube
                        </a>
                      )}
                      <span className={`vstatus ${v.status}`}>{v.status}</span>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {/* ─── YOUTUBE ────────────────────────────────── */}
          {tab === 'youtube' && (
            <>
              <div className="page-hdr">
                <h1 className="page-title">▶ YouTube Autopilot</h1>
                <p className="page-sub">Connect your channel to start auto-publishing AI videos 24/7.</p>
              </div>

              <div className="grid2">
                <div className="card">
                  <div className="card-title">▶ Connect YouTube Channel</div>
                  <p style={{ color:'#8882aa', fontSize:'.85rem', marginBottom:'1.2rem', lineHeight:1.65 }}>
                    Click the button below to authorize ReelMind AI. You'll be taken to Google, select your channel, and approve upload permissions. Once connected, we can publish videos automatically.
                  </p>
                  {[
                    'Sign in with Google (secure OAuth 2.0)',
                    'Select your YouTube channel',
                    'Grant video upload permission',
                    'Set your posting schedule',
                    'Auto-publish starts immediately',
                  ].map((s,i) => (
                    <div key={i} style={{ display:'flex', gap:10, alignItems:'center', padding:'8px 12px', background:'rgba(124,92,252,.06)', borderRadius:8, marginBottom:6 }}>
                      <div style={{ width:22, height:22, borderRadius:'50%', border:'1.5px solid rgba(124,92,252,.4)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'#b59dff', flexShrink:0 }}>{i+1}</div>
                      <span style={{ fontSize:'.85rem', color:'#c4b8ff' }}>{s}</span>
                    </div>
                  ))}
                  <button className="btn-red" style={{ width:'100%', marginTop:'1rem' }}
                    onClick={() => window.location.href = '/api/youtube/auth'}>
                    ▶ &nbsp;Connect YouTube Channel
                  </button>
                  <p style={{ fontSize:'.7rem', color:'#8882aa', textAlign:'center', marginTop:'8px' }}>
                    🔒 Secured by Google OAuth 2.0 · We never store your password
                  </p>
                </div>

                <div className="card">
                  <div className="card-title">📅 How Autopilot Works</div>
                  {[
                    ['🧠','Gemini writes a fresh script daily','No duplicate content, always unique'],
                    ['🎙','ElevenLabs generates voiceover','Sounds natural and professional'],
                    ['🎬','Pexels/Pixabay provides footage','HD portrait video, perfectly matched'],
                    ['⏰','Your video publishes on schedule','1x, 2x, or 3x per day — you choose'],
                    ['📊','Analytics sync back automatically','View counts and revenue in dashboard'],
                  ].map(([icon, title, sub]) => (
                    <div key={title} style={{ display:'flex', gap:12, padding:'10px 0', borderBottom:'1px solid rgba(124,92,252,.08)' }}>
                      <span style={{ fontSize:'1.2rem', flexShrink:0 }}>{icon}</span>
                      <div>
                        <p style={{ fontSize:'.85rem', fontWeight:500 }}>{title}</p>
                        <p style={{ fontSize:'.75rem', color:'#8882aa', marginTop:2 }}>{sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ─── ACCOUNT ────────────────────────────────── */}
          {tab === 'account' && (
            <>
              <div className="page-hdr">
                <h1 className="page-title">👤 Account</h1>
                <p className="page-sub">Your plan, credits, and profile.</p>
              </div>
              <div className="grid2">
                <div className="card">
                  <div className="card-title">Profile Details</div>
                  {[
                    ['Email', user?.email],
                    ['Plan', `${profile?.plan || 'free'} ${isAdmin ? '(Admin)' : ''}`],
                    ['Credits Remaining', isAdmin ? 'Unlimited' : `${credits}`],
                    ['Subscription Status', profile?.subscription_status || 'inactive'],
                    ['Total Videos Generated', profile?.total_videos_generated || 0],
                    ['Admin Access', isAdmin ? '✅ Yes' : 'No'],
                  ].map(([k,v]) => (
                    <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid rgba(124,92,252,.08)', fontSize:'.87rem' }}>
                      <span style={{ color:'#8882aa' }}>{k}</span>
                      <span style={{ fontWeight:500 }}>{v}</span>
                    </div>
                  ))}
                </div>
                <div className="card">
                  <div className="card-title">💳 Upgrade Your Plan</div>
                  <p style={{ color:'#8882aa', fontSize:'.85rem', marginBottom:'1.2rem', lineHeight:1.6 }}>
                    Unlock more video credits, higher quality exports, and additional YouTube channels.
                  </p>
                  {[
                    { name:'Starter', price:'₹1,900/mo', credits:'30 videos', color:'rgba(46,204,138,.1)' },
                    { name:'Creator Pro', price:'₹4,900/mo', credits:'150 videos', color:'rgba(124,92,252,.15)' },
                    { name:'Agency', price:'₹12,900/mo', credits:'Unlimited', color:'rgba(195,75,255,.1)' },
                  ].map(p => (
                    <div key={p.name} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:p.color, border:'1px solid rgba(124,92,252,.2)', borderRadius:10, marginBottom:8 }}>
                      <div>
                        <p style={{ fontWeight:600, fontSize:'.88rem' }}>{p.name}</p>
                        <p style={{ fontSize:'.72rem', color:'#8882aa' }}>{p.credits}</p>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <p style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:'1rem', color:'#c34bff' }}>{p.price}</p>
                        <a href="/#pricing" style={{ fontSize:'.72rem', color:'#8882aa', textDecoration:'none' }}>Upgrade →</a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ─── ADMIN PANEL ──────────────────────────── */}
          {tab === 'admin' && isAdmin && (
            <>
              <div className="page-hdr">
                <h1 className="page-title">⚡ Admin Panel</h1>
                <p className="page-sub">Full system access. You have unlimited credits and can manage all users.</p>
              </div>

              {adminLoading ? (
                <div className="empty"><span className="spin" style={{ fontSize:'1.5rem' }}>⚙️</span><p style={{ marginTop:'1rem' }}>Loading admin data...</p></div>
              ) : adminData ? (
                <>
                  {/* Stats */}
                  <div className="grid4" style={{ marginBottom:'1.5rem' }}>
                    {[
                      { label:'Total Users', val: adminData.stats.totalUsers, color:'#f0eeff' },
                      { label:'Total Videos', val: adminData.stats.totalVideos, color:'#b59dff' },
                      { label:'Published Videos', val: adminData.stats.publishedVideos, color:'#2ecc8a' },
                      { label:'Failed Videos', val: adminData.stats.failedVideos, color:'#ff6b7e' },
                    ].map(s => (
                      <div className="stat-card" key={s.label}>
                        <div className="stat-label">{s.label}</div>
                        <div className="stat-num" style={{ color:s.color }}>{s.val ?? 0}</div>
                      </div>
                    ))}
                  </div>

                  {/* Grant Credits */}
                  <div className="card" style={{ marginBottom:'1.2rem' }}>
                    <div className="card-title">🎁 Grant Credits to User</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 120px 150px auto', gap:'10px', alignItems:'end' }}>
                      <div>
                        <span className="fl">User Email</span>
                        <input type="email" placeholder="user@example.com" value={grantEmail} onChange={e => setGrantEmail(e.target.value)} />
                      </div>
                      <div>
                        <span className="fl">Credits</span>
                        <input type="number" value={grantCredits} onChange={e => setGrantCredits(e.target.value)} min="1" />
                      </div>
                      <div>
                        <span className="fl">Plan</span>
                        <select value={grantPlan} onChange={e => setGrantPlan(e.target.value)}>
                          <option value="free">Free</option>
                          <option value="starter">Starter</option>
                          <option value="creator">Creator Pro</option>
                          <option value="agency">Agency</option>
                        </select>
                      </div>
                      <button className="btn-primary" style={{ padding:'.65rem 1.2rem', whiteSpace:'nowrap' }} onClick={handleGrant}>
                        Grant →
                      </button>
                    </div>
                    {grantMsg && <div className={`${grantMsg.startsWith('✅') ? 'alert-ok' : 'alert-err'}`} style={{ marginTop:'10px' }}>{grantMsg}</div>}
                  </div>

                  {/* Recent Users */}
                  <div className="card" style={{ marginBottom:'1.2rem' }}>
                    <div className="card-title">👥 Recent Users ({adminData.recentUsers.length})</div>
                    <div style={{ overflowX:'auto' }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Email</th><th>Plan</th><th>Credits</th><th>Admin</th><th>Joined</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adminData.recentUsers.map(u => (
                            <tr key={u.id}>
                              <td style={{ fontFamily:'var(--font-mono)', fontSize:'.78rem' }}>{u.email}</td>
                              <td><span className={`plan-pill plan-${u.plan || 'free'}`} style={{ fontSize:'.68rem', padding:'2px 8px', borderRadius:'50px', fontWeight:600 }}>{u.plan || 'free'}</span></td>
                              <td style={{ color:'#c34bff', fontWeight:600 }}>{u.video_credits}</td>
                              <td>{u.is_admin ? <span style={{ color:'#2ecc8a' }}>✓ Admin</span> : '—'}</td>
                              <td style={{ color:'#8882aa', fontSize:'.78rem' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Recent Videos */}
                  <div className="card" style={{ marginBottom:'1.2rem' }}>
                    <div className="card-title">🎬 Recent Videos ({adminData.recentVideos.length})</div>
                    <div style={{ overflowX:'auto' }}>
                      <table className="data-table">
                        <thead>
                          <tr><th>Title</th><th>Niche</th><th>Duration</th><th>Score</th><th>Status</th><th>Date</th></tr>
                        </thead>
                        <tbody>
                          {adminData.recentVideos.map(v => (
                            <tr key={v.id}>
                              <td style={{ maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v.seo_title || '—'}</td>
                              <td>{v.niche}</td>
                              <td>{v.duration}s</td>
                              <td>{v.viral_score ? <span style={{ color:'#2ecc8a' }}>{v.viral_score}/100</span> : '—'}</td>
                              <td><span className={`vstatus ${v.status}`} style={{ display:'inline-block' }}>{v.status}</span></td>
                              <td style={{ color:'#8882aa', fontSize:'.78rem' }}>{new Date(v.created_at).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Quick Links */}
                  <div className="grid2">
                    {[
                      { label:'Open Supabase DB', url:`https://supabase.com/dashboard/project/igygmgxxnrjvstozvaay`, color:'rgba(46,204,138,.1)', textColor:'#2ecc8a' },
                      { label:'Open Vercel Logs', url:'https://vercel.com/dashboard', color:'rgba(124,92,252,.1)', textColor:'#b59dff' },
                    ].map(l => (
                      <a key={l.label} href={l.url} target="_blank" rel="noreferrer"
                        style={{ display:'block', padding:'1rem 1.4rem', background:l.color, border:`1px solid ${l.textColor}40`, borderRadius:12, color:l.textColor, textDecoration:'none', fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:'.88rem', textAlign:'center', transition:'opacity .2s' }}
                        onMouseEnter={e=>e.target.style.opacity='.8'} onMouseLeave={e=>e.target.style.opacity='1'}>
                        → {l.label}
                      </a>
                    ))}
                  </div>
                </>
              ) : (
                <div className="alert-err">Failed to load admin data. Check Vercel logs.</div>
              )}
            </>
          )}

        </main>
      </div>
    </>
  );
}
