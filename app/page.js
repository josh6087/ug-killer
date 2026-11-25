'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState('feed');

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [authError, setAuthError] = useState('');

  const [posts, setPosts] = useState([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [caption, setCaption] = useState('');

  const [usersList, setUsersList] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [reports, setReports] = useState([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadUser(session.user);
    });
  }, []);

  async function loadUser(authUser) {
    setUser(authUser);
    const { data } = await supabase.from('profiles').select('*').eq('id', authUser.id).single();
    setProfile(data);
    if (!data?.is_banned) {
      fetchPosts();
      fetchUsers(authUser.id);
      if (data?.is_mod) fetchReports();
    }
  }

  async function handleAuth(e) {
    e.preventDefault();
    setAuthError('');
    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return setAuthError(error.message);
      if (data.user) {
        const { error: pError } = await supabase.from('profiles').insert({ id: data.user.id, username });
        if (pError) return setAuthError('Username taken or invalid.');
        loadUser(data.user);
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return setAuthError(error.message);
      loadUser(data.user);
    }
  }

  async function fetchPosts() {
    const { data } = await supabase.from('posts').select('*, profiles(username)').order('created_at', { ascending: false });
    if (data) setPosts(data);
  }

  async function handlePostVideo(e) {
    e.preventDefault();
    if (!videoUrl) return;
    await supabase.from('posts').insert({ user_id: user.id, video_url: videoUrl, caption });
    setVideoUrl('');
    setCaption('');
    fetchPosts();
    setTab('feed');
  }

  async function deletePost(postId) {
    if (!confirm('Remove this Short permanently?')) return;
    await supabase.from('posts').delete().eq('id', postId);
    fetchPosts();
  }

  async function fetchUsers(myId) {
    const { data } = await supabase.from('profiles').select('*').neq('id', myId);
    if (data) setUsersList(data);
  }

  async function toggleBan(targetUser) {
    await supabase.from('profiles').update({ is_banned: !targetUser.is_banned }).eq('id', targetUser.id);
    fetchUsers(user.id);
  }

  async function toggleMod(targetUser) {
    await supabase.from('profiles').update({ is_mod: !targetUser.is_mod }).eq('id', targetUser.id);
    fetchUsers(user.id);
  }

  async function fetchReports() {
    const { data } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
    if (data) setReports(data);
  }

  async function openChat(otherUser) {
    setSelectedUser(otherUser);
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUser.id}),and(sender_id.eq.${otherUser.id},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser) return;
    await supabase.from('messages').insert({ sender_id: user.id, receiver_id: selectedUser.id, content: newMessage });
    setNewMessage('');
    openChat(selectedUser);
  }

  async function reportItem(targetType, targetId) {
    const reason = prompt(`Why are you reporting this ${targetType}?`);
    if (!reason) return;
    await supabase.from('reports').insert({ reporter_id: user.id, target_type: targetType, target_id: targetId, reason });
    alert('Report submitted.');
  }


  if (!user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: 20 }}>
        <h2>{isSignUp ? 'Create Account' : 'Log In'}</h2>
        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 300 }}>
          {isSignUp && <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required style={inputStyle} />}
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
          {authError && <p style={{ color: 'red', fontSize: 13 }}>{authError}</p>}
          <button type="submit" style={btnStyle}>{isSignUp ? 'Sign Up' : 'Log In'}</button>
        </form>
        <button onClick={() => setIsSignUp(!isSignUp)} style={{ marginTop: 15, background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' }}>
          {isSignUp ? 'Already have an account? Log In' : 'Need an account? Sign Up'}
        </button>
      </div>
    );
  }

  if (profile?.is_banned) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: 20, textAlign: 'center' }}>
        <h2 style={{ color: '#e11d48' }}>Account Banned</h2>
        <p style={{ color: '#aaa' }}>Your account (@{profile.username}) has been banned by a moderator.</p>
        <button onClick={() => { supabase.auth.signOut(); setUser(null); }} style={btnStyle}>Log Out</button>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto', borderLeft: '1px solid #222', borderRight: '1px solid #222' }}>
      {tab === 'feed' && (
        <div style={{ flex: 1, overflowY: 'scroll', scrollSnapType: 'y mandatory' }}>
          {posts.length === 0 && <p style={{ textAlign: 'center', marginTop: 100, color: '#888' }}>No videos yet. Tap + Post below!</p>}
          {posts.map(post => (
            <div key={post.id} style={{ height: 'calc(100vh - 60px)', scrollSnapAlign: 'start', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111' }}>
              <video src={post.video_url} controls loop playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', bottom: 20, left: 15, right: 15, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', background: 'rgba(0,0,0,0.6)', padding: 10, borderRadius: 8 }}>
                <div>
                  <strong>@{post.profiles?.username || 'user'}</strong>
                  <p style={{ margin: '5px 0 0', fontSize: 14 }}>{post.caption}</p>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {profile?.is_mod && <button onClick={() => deletePost(post.id)} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}>Remove</button>}
                  <button onClick={() => reportItem('post', post.id)} style={{ background: '#444', color: '#fff', border: 'none', padding: '5px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 12 }}>Report</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'upload' && (
        <div style={{ flex: 1, padding: 20 }}>
          <h3>Post a Short Video</h3>
          <p style={{ fontSize: 13, color: '#aaa' }}>Paste a direct .mp4 video link:</p>
          <form onSubmit={handlePostVideo} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input placeholder="https://.../video.mp4" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} required style={inputStyle} />
            <input placeholder="Caption..." value={caption} onChange={e => setCaption(e.target.value)} style={inputStyle} />
            <button type="submit" style={btnStyle}>Post Video</button>
          </form>
        </div>
      )}

      {tab === 'chat' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!selectedUser ? (
            <div style={{ padding: 20, overflowY: 'auto' }}>
              <h3>Chats (Permanent & Non-Deletable)</h3>
              {usersList.map(u => (
                <div key={u.id} onClick={() => openChat(u)} style={{ padding: 15, borderBottom: '1px solid #222', cursor: 'pointer' }}>
                  @{u.username} {u.is_mod && <span style={{ color: '#3b82f6', fontSize: 12 }}>[MOD]</span>}
                </div>
              ))}
            </div>
          ) : (
            <>
              <div style={{ padding: 15, borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between' }}>
                <button onClick={() => setSelectedUser(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>← Back</button>
                <strong>@{selectedUser.username}</strong>
                <span />
              </div>
              <div style={{ flex: 1, padding: 15, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {messages.map(m => {
                  const isMe = m.sender_id === user.id;
                  return (
                    <div key={m.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', background: isMe ? '#2563eb' : '#222', padding: '8px 12px', borderRadius: 12, maxWidth: '75%' }}>
                      <p style={{ margin: 0 }}>{m.content}</p>
                      {!isMe && <button onClick={() => reportItem('message', m.id)} style={{ background: 'none', border: 'none', color: '#fca5a5', fontSize: 10, padding: 0, marginTop: 4, cursor: 'pointer' }}>Report</button>}
                    </div>
                  );
                })}
              </div>
              <form onSubmit={sendMessage} style={{ display: 'flex', padding: 10, borderTop: '1px solid #222', gap: 8 }}>
                <input placeholder="Type message (cannot be deleted)..." value={newMessage} onChange={e => setNewMessage(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                <button type="submit" style={btnStyle}>Send</button>
              </form>
            </>
          )}
        </div>
      )}

      {tab === 'mod' && profile?.is_mod && (
        <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
          <h3>Moderator Controls</h3>
          <h4>Manage Users</h4>
          {usersList.map(u => (
            <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #222' }}>
              <span>@{u.username} {u.is_banned && '(BANNED)'}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => toggleMod(u)} style={{ background: u.is_mod ? '#1d4ed8' : '#333', color: '#fff', border: 'none', padding: '5px 8px', borderRadius: 5, fontSize: 12, cursor: 'pointer' }}>{u.is_mod ? 'Remove Mod' : 'Make Mod'}</button>
                <button onClick={() => toggleBan(u)} style={{ background: u.is_banned ? '#16a34a' : '#dc2626', color: '#fff', border: 'none', padding: '5px 8px', borderRadius: 5, fontSize: 12, cursor: 'pointer' }}>{u.is_banned ? 'Unban' : 'Ban'}</button>
              </div>
            </div>
          ))}
          <h4 style={{ marginTop: 25 }}>Recent Reports ({reports.length})</h4>
          {reports.length === 0 && <p style={{ color: '#666', fontSize: 13 }}>No reports yet.</p>}
          {reports.map(r => (
            <div key={r.id} style={{ background: '#111', padding: 10, borderRadius: 8, marginBottom: 8, fontSize: 13 }}>
              <strong>Type:</strong> {r.target_type} | <strong>Reason:</strong> {r.reason}
              <div style={{ color: '#666', fontSize: 11, marginTop: 4 }}>ID: {r.target_id}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ height: 60, borderTop: '1px solid #222', display: 'flex', justifyContent: 'space-around', alignItems: 'center', background: '#000' }}>
        <button onClick={() => setTab('feed')} style={navBtnStyle(tab === 'feed')}>Shorts</button>
        <button onClick={() => setTab('upload')} style={navBtnStyle(tab === 'upload')}>+ Post</button>
        <button onClick={() => setTab('chat')} style={navBtnStyle(tab === 'chat')}>Chats</button>
        {profile?.is_mod && <button onClick={() => { fetchReports(); setTab('mod'); }} style={{ ...navBtnStyle(tab === 'mod'), color: tab === 'mod' ? '#ef4444' : '#b91c1c' }}>Mod</button>}
        <button onClick={() => { supabase.auth.signOut(); setUser(null); }} style={{ background: 'none', border: 'none', color: '#666', fontSize: 12, cursor: 'pointer' }}>Logout</button>
      </div>
    </div>
  );
}

const inputStyle = { padding: 12, borderRadius: 8, border: '1px solid #333', background: '#111', color: '#fff' };
const btnStyle = { padding: 12, borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 'bold', cursor: 'pointer' };
const navBtnStyle = active => ({ background: 'none', border: 'none', color: active ? '#fff' : '#666', fontWeight: active ? 'bold' : 'normal', fontSize: 15, cursor: 'pointer' });
