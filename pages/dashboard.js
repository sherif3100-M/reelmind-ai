import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const NICHES = [
  { value: 'finance', label: '💰 Personal Finance' },
  { value: 'motivation', label: '🧠 Mindset & Motivation' },
  { value: 'tech', label: '📱 Tech & AI News' },
  { value: 'facts', label: '🌍 Amazing Facts' },
  { value: 'fitness', label: '🏋️ Fitness & Health' },
  { value: 'books', label: '📚 Book Summaries' },
  { value: 'gaming', label: '🕹️ Gaming' },
  { value: 'cooking', label: '🍳 Cooking Tips' },
  { value: 'history', label: '🏛️ History & Mystery' },
  { value: 'mystery', label: '🔮 Unsolved Mysteries' },
];

const VOICES = ['deep_male', 'calm_female', 'energetic', 'british', 'asmr'];
const STYLES = ['Cinematic', 'Minimalist', 'Animated', 'News Style', 'Lo-Fi'];
const DURATIONS = [15, 30, 60, 90];

const STATUS_LABELS = {
  pending: 'Queued...',
  scripting: '🧠 Gemini writing script...',
  voicing: '🎙 ElevenLabs generating voice...',
  fetching_broll: '🎬 Fetching HD footage from Pexels...',
  rendering: '⚙️ Assembling video assets...',
  scheduled: '✅ Video ready!',
  published: '✅ Published to YouTube!',
  failed: '❌ Failed — try again',
};

const PROGRESS = { pending: 0, scripting: 20, voicing: 40, fetching_broll: 60, rendering: 80, scheduled: 100, published: 100, failed: 0 };

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('generate');

  // Generator state
  const [niche, setNiche] = useState('finance');
  const [duration, setDuration] = useState(30);
  const [style, setStyle] = useState('Cinematic');
  const [voice, setVoice] = useState('deep_male');
  const [customPrompt, setCustomPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [script, setScript] = useState(null);

  // Videos list
  const [videos, setVideos] = useState([]);
  const [channels, setChannels] = useState([]);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = '/login'; return; }
    setUser(user);
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setProfile(p);
    await loadVideos(user.id);
    await loadChannels(user.id);
    setLoading(false);
  }

  async function loadVideos(uid) {
    const { data } = await supabase.from('videos').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(20);
    setVideos(data || []);
  }

  async function loadChannels(uid) {
    const { data } = await supabase.from('channels').select('*').eq('user_id', uid);
    setChannels(data || []);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  async function generateVideo() {
    if (generating) return;
    if (!profile?.video_credits || profile.video_credits <= 0) {
      alert('No credits remaining. Please upgrade your plan.');
      return;
    }
    setGenerating(true);
    setScript(null);
    setProgress(0);
    setStatusMsg('Starting generation...');
    setCurrentVideo(null);

    try {
      const res = await fetch('/api/videos/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche, duration, style: style.toLowerCase().replace(' ', '_'), voiceId: voice, customPrompt }),
      });

      if (res.status === 401) { window.location.href = '/login'; return; }
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Generation failed');
      }

      const { videoId } = await res.json();
      setCurrentVideo(videoId);
      await pollStatus(videoId);
    } catch (e) {
      setStatusMsg('❌ Error: ' + e.message);
      setGenerating(false);
    }
  }

  async function pollStatus(videoId) {
    const maxAttempts = 60;
    let attempts = 0;

    const poll = async () => {
      try {
        const res = await fetch(`/api/videos/${videoId}/status`);
        if (!res.ok) { setTimeout(poll, 3000); return; }
        const data = await res.json();

        setProgress(data.progress || 0);
        setStatusMsg(STATUS_LABELS[data.status] || data.message || '');

        if (data.status === 'scheduled' || data.status === 'published') {
          setGenerating(false);
          if (data.seo_title) {
            setScript({ title: data.seo_title, score: data.viral_score, youtubeUrl: data.youtube_url });
          }
          // Refresh profile credits
          const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
          setProfile(p);
          await loadVideos(user.id);
          return;
        }

        if (data.status === 'failed') {
          setGenerating(false);
          setStatusMsg('❌ Failed: ' + (data.error_message || 'Unknown error'));
          return;
        }

        attempts++;
        if (attempts < maxAttempts) setTimeout(poll, 3000);
        else { setGenerating(false); setStatusMsg('⚠️ Taking longer than expected — check Videos tab'); }
      } catch (e) {
        setTimeout(poll, 5000);
      }
    };

    setTimeout(poll, 2000);
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#060610', color: '#f0eeff', fontFamily: 'DM Sans,sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
        <p>Loading your dashboard...</p>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Sans',sans-serif;background:#060610;color:#f0eeff;min-height:100vh}
        h1,h2,h3,h4{font-family:'Syne',sans-serif}
        .layout{display:flex;min-height:100vh}
        .sidebar{width:220px;background:#0c0c20;border-right:1px solid rgba(124,92,252,.2);padding:1.2rem;flex-shrink:0;display:flex;flex-direction:column}
        .logo{font-family:'Syne',sans-serif;font-size:1.2rem;font-weight:800;margin-bottom:1.5rem;padding:.5rem}
        .logo span{color:#c34bff}
        .nav-item{display:flex;align-items:center;gap:10px;padding:.65rem .9rem;border-radius:9px;cursor:pointer;font-size:.88rem;color:#8882aa;transition:all .2s;margin-bottom:3px;border:none;background:transparent;width:100%;text-align:left}
        .nav-item:hover{background:rgba(124,92,252,.1);color:#f0eeff}
        .nav-item.active{background:rgba(124,92,252,.18);color:#c4b8ff}
        .nav-icon{font-size:1rem;width:20px;text-align:center}
        .sidebar-bottom{margin-top:auto}
        .credit-box{background:rgba(124,92,252,.1);border:1px solid rgba(124,92,252,.2);border-radius:10px;padding:.8rem;margin-bottom:1rem}
        .credit-label{font-size:.7rem;color:#8882aa;margin-bottom:4px}
        .credit-num{font-family:'Syne',sans-serif;font-size:1.5rem;font-weight:800;color:#c34bff}
        .credit-sub{font-size:.68rem;color:#8882aa}
        .sign-out{display:flex;align-items:center;gap:8px;padding:.65rem .9rem;border-radius:9px;cursor:pointer;font-size:.85rem;color:#8882aa;transition:all .2s;border:none;background:transparent;width:100%;text-align:left}
        .sign-out:hover{background:rgba(255,77,100,.1);color:#ff4d64}
        .main{flex:1;overflow:auto;padding:2rem}
        .page-title{font-size:1.6rem;margin-bottom:.4rem}
        .page-sub{color:#8882aa;font-size:.88rem;margin-bottom:1.8rem}

        /* Generator */
        .gen-grid{display:grid;grid-template-columns:1fr 1fr;gap:1.2rem}
        @media(max-width:900px){.gen-grid{grid-template-columns:1fr}.sidebar{display:none}}
        .panel{background:rgba(20,18,45,.9);border:1px solid rgba(124,92,252,.2);border-radius:16px;padding:1.5rem}
        .panel h3{font-size:1rem;margin-bottom:1.2rem;color:#c4b8ff}
        .field-group{margin-bottom:1rem}
        .fl{font-size:.7rem;color:#8882aa;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;display:block}
        select,textarea{width:100%;background:#0a0a1e;border:1px solid rgba(124,92,252,.2);color:#f0eeff;padding:.62rem .85rem;border-radius:9px;font-family:'DM Sans',sans-serif;font-size:.85rem;outline:none;transition:border-color .2s}
        select:focus,textarea:focus{border-color:#7c5cfc}
        select option{background:#0a0a1e}
        textarea{resize:none;height:60px}
        .tags{display:flex;flex-wrap:wrap;gap:6px}
        .tag{padding:4px 12px;border-radius:50px;font-size:.75rem;cursor:pointer;border:1px solid rgba(124,92,252,.2);background:#0a0a1e;color:#8882aa;transition:all .2s}
        .tag.on{background:rgba(124,92,252,.18);border-color:#7c5cfc;color:#c4b8ff}
        .gen-btn{width:100%;padding:.85rem;background:linear-gradient(135deg,#7c5cfc,#c34bff);border:none;color:#fff;font-family:'Syne',sans-serif;font-weight:700;font-size:.92rem;border-radius:10px;cursor:pointer;margin-top:.6rem;transition:opacity .2s;display:flex;align-items:center;justify-content:center;gap:8px}
        .gen-btn:hover:not(:disabled){opacity:.88}.gen-btn:disabled{opacity:.5;cursor:not-allowed}

        /* Preview */
        .preview-box{background:#040410;border:2px dashed rgba(124,92,252,.2);border-radius:12px;min-height:180px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:1rem;margin-bottom:.8rem;text-align:center}
        .preview-box.ready{background:linear-gradient(160deg,rgba(124,92,252,.18),rgba(6,6,16,.95));border-style:solid;border-color:rgba(124,92,252,.4)}
        .pbar{width:100%;height:4px;background:#0a0a1e;border-radius:3px;overflow:hidden;margin-top:8px}
        .pbar-fill{height:100%;background:linear-gradient(90deg,#7c5cfc,#c34bff);border-radius:3px;transition:width .4s}
        .pstatus{font-size:.75rem;color:#8882aa;margin-top:5px;min-height:18px}
        .score-pill{padding:3px 10px;border-radius:50px;font-size:.72rem;background:rgba(46,204,138,.1);border:1px solid rgba(46,204,138,.25);color:#2ecc8a;display:inline-block;margin-top:4px}

        /* Videos list */
        .video-row{display:flex;align-items:center;gap:12px;padding:10px 12px;background:rgba(20,18,45,.6);border-radius:10px;border:1px solid rgba(124,92,252,.12);margin-bottom:6px}
        .v-thumb{width:32px;height:44px;border-radius:6px;flex-shrink:0}
        .v-info{flex:1;min-width:0}
        .v-title{font-size:.82rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .v-meta{font-size:.7rem;color:#8882aa;margin-top:2px}
        .v-status{font-size:.65rem;padding:3px 8px;border-radius:50px;white-space:nowrap}
        .v-status.pub{background:rgba(46,204,138,.1);color:#2ecc8a;border:1px solid rgba(46,204,138,.25)}
        .v-status.sch{background:rgba(251,192,45,.1);color:#fbc02d;border:1px solid rgba(251,192,45,.25)}
        .v-status.ren{background:rgba(124,92,252,.15);color:#b59dff;border:1px solid rgba(124,92,252,.25)}
        .v-status.fail{background:rgba(255,77,100,.1);color:#ff4d64;border:1px solid rgba(255,77,100,.25)}

        /* Stats */
        .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin-bottom:1.5rem}
        @media(max-width:700px){.stats-grid{grid-template-columns:repeat(2,1fr)}}
        .stat-card{background:rgba(20,18,45,.9);border:1px solid rgba(124,92,252,.15);border-radius:14px;padding:1.2rem}
        .stat-label{font-size:.72rem;color:#8882aa;margin-bottom:6px}
        .stat-num{font-family:'Syne',sans-serif;font-size:1.8rem;font-weight:800}
        .stat-sub{font-size:.7rem;color:#8882aa;margin-top:2px}

        /* YouTube connect */
        .yt-btn{width:100%;padding:.85rem;background:#ff0000;color:#fff;border:none;font-family:'Syne',sans-serif;font-weight:700;font-size:.88rem;border-radius:10px;cursor:pointer;transition:opacity .2s;display:flex;align-items:center;justify-content:center;gap:8px}
        .yt-btn:hover{opacity:.88}
        .yt-connected{padding:10px 14px;background:rgba(46,204,138,.1);border:1px solid rgba(46,204,138,.3);border-radius:10px;color:#2ecc8a;font-size:.85rem;margin-bottom:1rem}

        /* Plan badge */
        .plan-badge{display:inline-flex;align-items:center;gap:6px;padding:3px 12px;border-radius:50px;font-size:.72rem;font-weight:600}
        .plan-badge.free{background:rgba(136,130,170,.1);border:1px solid rgba(136,130,170,.25);color:#8882aa}
        .plan-badge.agency{background:rgba(195,75,255,.1);border:1px solid rgba(195,75,255,.3);color:#c34bff}
        .plan-badge.creator{background:rgba(124,92,252,.1);border:1px solid rgba(124,92,252,.3);color:#b59dff}
        .plan-badge.starter{background:rgba(46,204,138,.08);border:1px solid rgba(46,204,138,.25);color:#2ecc8a}

        .empty-state{text-align:center;padding:3rem;color:#8882aa}
        .empty-state p{margin-top:.5rem;font-size:.88rem}
        .info-box{background:rgba(124,92,252,.08);border:1px solid rgba(124,92,252,.2);border-radius:10px;padding:10px 14px;font-size:.82rem;color:#b59dff;margin-bottom:1rem}
      `}</style>

      <div className="layout">
        {/* SIDEBAR */}
        <div className="sidebar">
          <div className="logo">Reel<span>Mind</span> AI</div>

          {[
            { id: 'generate', icon: '🎬', label: 'Generate Video' },
            { id: 'videos', icon: '📹', label: 'My Videos' },
            { id: 'youtube', icon: '▶', label: 'YouTube' },
            { id: 'account', icon: '👤', label: 'Account' },
            ...(profile?.is_admin ? [{ id: 'admin', icon: '⚡', label: 'Admin Panel' }] : []),
          ].map(item => (
            <button key={item.id} className={`nav-item${tab === item.id ? ' active' : ''}`} onClick={() => setTab(item.id)}>
              <span className="nav-icon">{item.icon}</span> {item.label}
            </button>
          ))}

          <div className="sidebar-bottom">
            <div className="credit-box">
              <div className="credit-label">Video Credits</div>
              <div className="credit-num">{profile?.video_credits ?? 0}</div>
              <div className="credit-sub">{profile?.plan === 'agency' ? 'Unlimited access' : 'remaining this month'}</div>
            </div>
            <button className="sign-out" onClick={signOut}>↩ Sign out</button>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="main">

          {/* ── GENERATE TAB ── */}
          {tab === 'generate' && (
            <>
              <h1 className="page-title">Video Generator</h1>
              <p className="page-sub">Configure your reel and click Generate — Gemini AI writes the script, ElevenLabs adds the voice, Pexels provides footage.</p>

              <div className="gen-grid">
                {/* Left: Controls */}
                <div className="panel">
                  <h3>⚙️ Video Settings</h3>

                  <div className="field-group">
                    <span className="fl">Niche / Topic</span>
                    <select value={niche} onChange={e => setNiche(e.target.value)}>
                      {NICHES.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                    </select>
                  </div>

                  <div className="field-group">
                    <span className="fl">Duration</span>
                    <div className="tags">
                      {DURATIONS.map(d => (
                        <span key={d} className={`tag${duration === d ? ' on' : ''}`} onClick={() => setDuration(d)}>{d}s</span>
                      ))}
                    </div>
                  </div>

                  <div className="field-group">
                    <span className="fl">Visual Style</span>
                    <div className="tags">
                      {STYLES.map(s => (
                        <span key={s} className={`tag${style === s ? ' on' : ''}`} onClick={() => setStyle(s)}>{s}</span>
                      ))}
                    </div>
                  </div>

                  <div className="field-group">
                    <span className="fl">AI Voice</span>
                    <div className="tags">
                      {VOICES.map(v => (
                        <span key={v} className={`tag${voice === v ? ' on' : ''}`} onClick={() => setVoice(v)}>
                          {v.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="field-group">
                    <span className="fl">Custom Prompt (optional)</span>
                    <textarea placeholder={`e.g. Top 5 ways to save money in 2025...`} value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} />
                  </div>

                  <button className="gen-btn" onClick={generateVideo} disabled={generating}>
                    {generating ? '⏳ Generating...' : '✦ Generate AI Video'}
                  </button>

                  {profile?.video_credits <= 0 && (
                    <div className="info-box" style={{ marginTop: '10px', background: 'rgba(255,77,100,.08)', borderColor: 'rgba(255,77,100,.25)', color: '#ff4d64' }}>
                      ⚠️ No credits remaining — <a href="/#pricing" style={{ color: '#c34bff' }}>upgrade your plan</a>
                    </div>
                  )}
                </div>

                {/* Right: Preview */}
                <div className="panel">
                  <h3>📺 Preview</h3>

                  <div className={`preview-box${script ? ' ready' : ''}`}>
                    {script ? (
                      <>
                        <div style={{ fontSize: '1.8rem' }}>✅</div>
                        <p style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '.92rem', maxWidth: 240, textAlign: 'center', lineHeight: 1.3 }}>
                          {script.title}
                        </p>
                        {script.score && <div className="score-pill">⚡ Viral Score: {script.score}/100</div>}
                        {script.youtubeUrl && (
                          <a href={script.youtubeUrl} target="_blank" rel="noreferrer"
                            style={{ marginTop: 8, padding: '6px 14px', background: '#ff0000', color: '#fff', borderRadius: 7, fontSize: '.78rem', textDecoration: 'none', fontWeight: 700 }}>
                            ▶ View on YouTube
                          </a>
                        )}
                      </>
                    ) : generating ? (
                      <>
                        <div style={{ fontSize: '1.5rem' }}>⚙️</div>
                        <p style={{ fontSize: '.82rem', color: '#8882aa' }}>AI is generating your reel...</p>
                        <p style={{ fontSize: '.72rem', color: 'rgba(136,130,170,.6)' }}>Takes about 30–90 seconds</p>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: '1.8rem', opacity: .4 }}>▶</div>
                        <p style={{ fontSize: '.82rem', color: '#8882aa' }}>Your reel will appear here</p>
                        <p style={{ fontSize: '.7rem', color: 'rgba(136,130,170,.5)' }}>Configure settings and click Generate</p>
                      </>
                    )}
                  </div>

                  <div className="pbar"><div className="pbar-fill" style={{ width: progress + '%' }} /></div>
                  <p className="pstatus">{statusMsg}</p>

                  <div style={{ marginTop: '1.2rem' }}>
                    <p style={{ fontSize: '.72rem', textTransform: 'uppercase', letterSpacing: '.06em', color: '#8882aa', marginBottom: 8 }}>Recent Videos</p>
                    {videos.slice(0, 3).map((v, i) => (
                      <div className="video-row" key={i}>
                        <div className="v-thumb" style={{ background: `linear-gradient(135deg,rgba(124,92,252,.5),rgba(195,75,255,.3))` }} />
                        <div className="v-info">
                          <div className="v-title">{v.seo_title || `Video — ${v.niche}`}</div>
                          <div className="v-meta">{v.niche} · {v.duration}s · {new Date(v.created_at).toLocaleDateString()}</div>
                        </div>
                        <span className={`v-status ${v.status === 'published' ? 'pub' : v.status === 'scheduled' ? 'sch' : v.status === 'failed' ? 'fail' : 'ren'}`}>
                          {v.status}
                        </span>
                      </div>
                    ))}
                    {videos.length === 0 && <p style={{ color: '#8882aa', fontSize: '.82rem', textAlign: 'center', padding: '1rem 0' }}>No videos yet — generate your first one!</p>}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── VIDEOS TAB ── */}
          {tab === 'videos' && (
            <>
              <h1 className="page-title">My Videos</h1>
              <p className="page-sub">{videos.length} video{videos.length !== 1 ? 's' : ''} generated</p>

              <div className="stats-grid">
                <div className="stat-card"><div className="stat-label">Total Generated</div><div className="stat-num">{videos.length}</div></div>
                <div className="stat-card"><div className="stat-label">Published</div><div className="stat-num">{videos.filter(v => v.status === 'published').length}</div></div>
                <div className="stat-card"><div className="stat-label">Scheduled</div><div className="stat-num">{videos.filter(v => v.status === 'scheduled').length}</div></div>
                <div className="stat-card"><div className="stat-label">Credits Left</div><div className="stat-num" style={{ color: '#c34bff' }}>{profile?.video_credits ?? 0}</div></div>
              </div>

              {videos.length === 0 ? (
                <div className="empty-state">
                  <div style={{ fontSize: '3rem' }}>🎬</div>
                  <p>No videos yet. Go to the Generate tab to create your first reel!</p>
                </div>
              ) : (
                videos.map((v, i) => (
                  <div className="video-row" key={i} style={{ padding: '12px 16px' }}>
                    <div className="v-thumb" style={{ width: 40, height: 52, background: `linear-gradient(135deg,rgba(124,92,252,.5),rgba(195,75,255,.3))` }} />
                    <div className="v-info">
                      <div className="v-title" style={{ fontSize: '.9rem' }}>{v.seo_title || `${v.niche} video — ${v.duration}s`}</div>
                      <div className="v-meta">
                        {v.niche} · {v.duration}s · {v.style} · {v.voice_id?.replace('_', ' ')}
                        {v.viral_score ? ` · ⚡ Score: ${v.viral_score}/100` : ''}
                        {' · '}{new Date(v.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    {v.youtube_url && (
                      <a href={v.youtube_url} target="_blank" rel="noreferrer"
                        style={{ padding: '5px 12px', background: '#ff0000', color: '#fff', borderRadius: 7, fontSize: '.75rem', textDecoration: 'none', fontWeight: 700, flexShrink: 0, marginRight: 8 }}>
                        ▶ YouTube
                      </a>
                    )}
                    <span className={`v-status ${v.status === 'published' ? 'pub' : v.status === 'scheduled' ? 'sch' : v.status === 'failed' ? 'fail' : 'ren'}`}>
                      {v.status}
                    </span>
                  </div>
                ))
              )}
            </>
          )}

          {/* ── YOUTUBE TAB ── */}
          {tab === 'youtube' && (
            <>
              <h1 className="page-title">YouTube Channels</h1>
              <p className="page-sub">Connect your YouTube channel to enable auto-publishing 24/7.</p>

              {channels.length > 0 && (
                <div className="yt-connected">
                  ✓ {channels.length} channel{channels.length > 1 ? 's' : ''} connected: {channels.map(c => c.channel_name).join(', ')}
                </div>
              )}

              <div className="panel" style={{ maxWidth: 520 }}>
                <h3>▶ Connect YouTube Channel</h3>
                <p style={{ color: '#8882aa', fontSize: '.85rem', marginBottom: '1rem', lineHeight: 1.6 }}>
                  Click below to authorize ReelMind AI to upload videos to your channel. You will be redirected to Google to approve.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1.2rem' }}>
                  {['Sign in with Google (secure OAuth)', 'Select your YouTube channel', 'Grant upload permissions', 'Auto-publish starts immediately'].map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '8px 12px', background: 'rgba(124,92,252,.06)', borderRadius: '8px' }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', border: '1.5px solid rgba(124,92,252,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#b59dff', flexShrink: 0 }}>{i + 1}</div>
                      <span style={{ fontSize: '.85rem', color: '#c4b8ff' }}>{s}</span>
                    </div>
                  ))}
                </div>
                <button className="yt-btn" onClick={() => window.location.href = '/api/youtube/auth'}>
                  ▶ &nbsp; Connect YouTube Channel
                </button>
                <p style={{ fontSize: '.72rem', color: '#8882aa', textAlign: 'center', marginTop: '8px' }}>
                  🔒 Secured by Google OAuth 2.0 · We never store your password
                </p>
              </div>
            </>
          )}

          {/* ── ACCOUNT TAB ── */}
          {tab === 'account' && (
            <>
              <h1 className="page-title">Account</h1>
              <p className="page-sub">Your plan and profile details.</p>

              <div className="panel" style={{ maxWidth: 520, marginBottom: '1rem' }}>
                <h3>👤 Profile</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[['Email', user?.email], ['Plan', profile?.plan || 'free'], ['Credits', `${profile?.video_credits ?? 0} remaining`], ['Status', profile?.subscription_status || 'inactive'], ['Total Videos', profile?.total_videos_generated || 0]].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(124,92,252,.1)', fontSize: '.88rem' }}>
                      <span style={{ color: '#8882aa' }}>{k}</span>
                      <span style={{ fontWeight: 500 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel" style={{ maxWidth: 520 }}>
                <h3>💳 Upgrade Plan</h3>
                <p style={{ color: '#8882aa', fontSize: '.85rem', marginBottom: '1rem' }}>Get more video credits and unlock pro features.</p>
                <a href="/#pricing" style={{ display: 'block', padding: '.85rem', background: 'linear-gradient(135deg,#7c5cfc,#c34bff)', color: '#fff', fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '.92rem', borderRadius: '10px', textAlign: 'center', textDecoration: 'none' }}>
                  View Pricing Plans →
                </a>
              </div>
            </>
          )}

          {/* ── ADMIN TAB ── */}
          {tab === 'admin' && profile?.is_admin && (
            <>
              <h1 className="page-title">⚡ Admin Panel</h1>
              <p className="page-sub">Full system access. You have unlimited credits.</p>

              <div className="stats-grid">
                <div className="stat-card"><div className="stat-label">Your Plan</div><div className="stat-num" style={{ color: '#c34bff', fontSize: '1.2rem' }}>Agency</div></div>
                <div className="stat-card"><div className="stat-label">Your Credits</div><div className="stat-num" style={{ color: '#2ecc8a' }}>∞</div></div>
                <div className="stat-card"><div className="stat-label">Videos Generated</div><div className="stat-num">{videos.length}</div></div>
                <div className="stat-card"><div className="stat-label">Channels Connected</div><div className="stat-num">{channels.length}</div></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="panel">
                  <h3>🎬 Generate Test Video</h3>
                  <p style={{ color: '#8882aa', fontSize: '.83rem', marginBottom: '1rem' }}>Use the Generate tab to create and test videos. As admin you have 99,999 credits.</p>
                  <button className="gen-btn" onClick={() => setTab('generate')}>→ Go to Generator</button>
                </div>
                <div className="panel">
                  <h3>▶ YouTube Test</h3>
                  <p style={{ color: '#8882aa', fontSize: '.83rem', marginBottom: '1rem' }}>Connect your YouTube channel to test the full publish pipeline end-to-end.</p>
                  <button className="yt-btn" onClick={() => setTab('youtube')}>→ Connect YouTube</button>
                </div>
                <div className="panel">
                  <h3>🗄️ Supabase DB</h3>
                  <p style={{ color: '#8882aa', fontSize: '.83rem', marginBottom: '1rem' }}>View all tables, users, and video records directly in Supabase dashboard.</p>
                  <a href="https://supabase.com/dashboard/project/igygmgxxnrjvstozvaay" target="_blank" rel="noreferrer"
                    style={{ display: 'block', padding: '.75rem', background: 'rgba(46,204,138,.1)', border: '1px solid rgba(46,204,138,.3)', color: '#2ecc8a', fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '.88rem', borderRadius: '10px', textAlign: 'center', textDecoration: 'none' }}>
                    → Open Supabase
                  </a>
                </div>
                <div className="panel">
                  <h3>📊 Vercel Logs</h3>
                  <p style={{ color: '#8882aa', fontSize: '.83rem', marginBottom: '1rem' }}>Check API logs, function errors, and deployment status on Vercel.</p>
                  <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer"
                    style={{ display: 'block', padding: '.75rem', background: 'rgba(124,92,252,.1)', border: '1px solid rgba(124,92,252,.25)', color: '#b59dff', fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: '.88rem', borderRadius: '10px', textAlign: 'center', textDecoration: 'none' }}>
                    → Open Vercel
                  </a>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </>
  );
}
