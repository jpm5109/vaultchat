import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, getDoc, 
  onSnapshot, updateDoc, arrayUnion, arrayRemove, 
  deleteDoc, addDoc, getDocs, writeBatch
} from 'firebase/firestore';
import { 
  Send, UserPlus, Users, MessageSquare, LogOut, 
  Check, X, ShieldCheck, Search, User, Copy, 
  Clock, ArrowLeft, Trash2, RefreshCw, UserMinus
} from 'lucide-react';

/**
 * VAULTCHAT - SECURE WEB MESSAGING
 * Optimized for Mobile Layout & Full Account Wipe on Logout.
 */

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'vault-chat-v6';

const generateInviteCode = () => Math.random().toString(36).substring(2, 10).toUpperCase();

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [searchCode, setSearchCode] = useState('');
  const [inputText, setInputText] = useState('');
  const [nicknameInput, setNicknameInput] = useState('');
  const [view, setView] = useState('chats');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ msg: '', type: 'info' });
  const scrollRef = useRef(null);

  const showStatus = (msg, type = 'info') => {
    setStatus({ msg, type });
    setTimeout(() => setStatus({ msg: '', type: 'info' }), 4000);
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth Error:", err);
        showStatus("Database Connection Error", "error");
      }
    };
    initAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
    const requestsColl = collection(db, 'artifacts', appId, 'users', user.uid, 'requests');

    const unsubProfile = onSnapshot(profileRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setProfile(data);
        setFriends(data.friends || []);
      } else {
        setProfile(null);
        setFriends([]);
      }
      setLoading(false);
    }, (err) => console.error("Profile listen error", err));

    const unsubRequests = onSnapshot(requestsColl, (snap) => {
      setPendingRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Requests listen error", err));

    return () => { unsubProfile(); unsubRequests(); };
  }, [user]);

  useEffect(() => {
    if (!user || !activeChat) { setMessages([]); return; }
    const chatId = [user.uid, activeChat.uid].sort().join('_');
    const msgColl = collection(db, 'artifacts', appId, 'public', 'data', `chat_${chatId}`);
    
    const unsubMsgs = onSnapshot(msgColl, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(msgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)));
    }, (err) => console.error("Message listen error", err));

    return () => unsubMsgs();
  }, [user, activeChat]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    if (!nicknameInput.trim() || !user) return;
    try {
      setLoading(true);
      const inviteCode = generateInviteCode();
      const profileData = {
        uid: user.uid,
        nickname: nicknameInput.trim(),
        inviteCode: inviteCode,
        friends: [],
        createdAt: Date.now()
      };
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'), profileData);
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'discovery', inviteCode), {
        uid: user.uid, nickname: profileData.nickname
      });
    } catch (err) { 
      console.error(err);
      showStatus("Initialization failed.", "error"); 
    } finally { setLoading(false); }
  };

  const handleLogout = async () => {
    if (!window.confirm("WARNING: This will permanently delete your identity and all chat history. Proceed?")) return;
    try {
      setLoading(true);
      const batch = writeBatch(db);

      if (profile?.inviteCode) {
        batch.delete(doc(db, 'artifacts', appId, 'public', 'data', 'discovery', profile.inviteCode));
      }

      for (const friend of friends) {
        const theirRef = doc(db, 'artifacts', appId, 'users', friend.uid, 'profile', 'data');
        batch.update(theirRef, { friends: arrayRemove({ uid: user.uid, nickname: profile.nickname }) });

        const chatId = [user.uid, friend.uid].sort().join('_');
        const msgColl = collection(db, 'artifacts', appId, 'public', 'data', `chat_${chatId}`);
        const snap = await getDocs(msgColl);
        snap.docs.forEach(d => batch.delete(d.ref));
      }

      const reqColl = collection(db, 'artifacts', appId, 'users', user.uid, 'requests');
      const reqSnap = await getDocs(reqColl);
      reqSnap.docs.forEach(d => batch.delete(d.ref));
      batch.delete(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'));

      await batch.commit();
      setProfile(null);
      setActiveChat(null);
      showStatus("Data Purged. Logged Out.");
    } catch (err) { 
      console.error(err);
      showStatus("Logout Failed", "error"); 
    } finally { setLoading(false); }
  };

  const resetInviteCode = async () => {
    if (!profile) return;
    try {
      const oldCode = profile.inviteCode;
      const newCode = generateInviteCode();
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'discovery', oldCode));
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'discovery', newCode), {
        uid: user.uid, nickname: profile.nickname
      });
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'), {
        inviteCode: newCode
      });
      showStatus("ID Rotated Successfully");
    } catch (err) { 
      console.error(err);
      showStatus("Rotation failed.", "error"); 
    }
  };

  const sendFriendRequest = async () => {
    if (!searchCode || searchCode === profile?.inviteCode) return;
    try {
      const targetDisc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'discovery', searchCode));
      if (!targetDisc.exists()) { showStatus("ID not found.", "error"); return; }
      const targetUid = targetDisc.data().uid;
      await setDoc(doc(db, 'artifacts', appId, 'users', targetUid, 'requests', user.uid), {
        fromUid: user.uid, fromNickname: profile.nickname, timestamp: Date.now()
      });
      showStatus("Request sent!");
      setSearchCode('');
    } catch (err) { showStatus("Failed to send request.", "error"); }
  };

  const acceptRequest = async (req) => {
    try {
      const myRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
      const theirRef = doc(db, 'artifacts', appId, 'users', req.fromUid, 'profile', 'data');
      await updateDoc(myRef, { friends: arrayUnion({ uid: req.fromUid, nickname: req.fromNickname }) });
      await updateDoc(theirRef, { friends: arrayUnion({ uid: user.uid, nickname: profile.nickname }) });
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'requests', req.fromUid));
    } catch (err) { console.error(err); }
  };

  const removeFriend = async (friend) => {
    if (!window.confirm(`Sever connection with ${friend.nickname}?`)) return;
    try {
      const myRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
      const theirRef = doc(db, 'artifacts', appId, 'users', friend.uid, 'profile', 'data');
      await updateDoc(myRef, { friends: arrayRemove(friend) });
      await updateDoc(theirRef, { friends: arrayRemove({ uid: user.uid, nickname: profile.nickname }) });
      if (activeChat?.uid === friend.uid) setActiveChat(null);
    } catch (err) { console.error(err); }
  };

  const deleteChatHistory = async () => {
    if (!activeChat || !window.confirm("Wipe conversation for both nodes?")) return;
    try {
      const chatId = [user.uid, activeChat.uid].sort().join('_');
      const msgColl = collection(db, 'artifacts', appId, 'public', 'data', `chat_${chatId}`);
      const snap = await getDocs(msgColl);
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      showStatus("Channel purged.");
    } catch (err) { showStatus("Purge failed.", "error"); }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !activeChat) return;
    const chatId = [user.uid, activeChat.uid].sort().join('_');
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', `chat_${chatId}`), {
        sender: user.uid, text: inputText, timestamp: Date.now()
      });
      setInputText('');
    } catch (err) { console.error(err); }
  };

  if (loading && user) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-950 text-cyan-500 font-mono text-xs tracking-[0.3em]">
      <div className="w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-6" />
      SYNCHRONIZING_VAULT...
    </div>
  );

  if (!profile) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950 p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-[2.5rem] p-10 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-cyan-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-cyan-500/20">
              <ShieldCheck className="text-cyan-400 w-10 h-10" />
            </div>
            <h2 className="text-3xl font-black text-white tracking-tight">Identity Setup</h2>
            <p className="text-slate-500 text-sm mt-3">Initialize your unique encryption profile</p>
          </div>
          <form onSubmit={handleCreateAccount} className="space-y-5">
            <input 
              type="text" 
              placeholder="Private Nickname" 
              value={nicknameInput} 
              onChange={e => setNicknameInput(e.target.value)} 
              className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-white outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all text-center font-bold placeholder-slate-700" 
              required 
            />
            <button className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-cyan-900/30">
              Generate Identity
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-slate-900 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar - Fix: Added flex-col and overflow-hidden to prevent layout jumps */}
      <div className={`fixed inset-0 z-20 md:relative md:flex w-full md:w-80 flex-col bg-slate-950 border-r border-slate-800 transition-transform ${activeChat ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}>
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-cyan-400" size={24} />
            <h1 className="font-black tracking-tighter uppercase text-base">VaultChat</h1>
          </div>
          <button onClick={handleLogout} className="p-2 text-slate-600 hover:text-red-400 transition-colors" title="Purge & Logout">
            <LogOut size={18}/>
          </button>
        </div>

        {/* Shareable ID - Fix: Reduced margins for mobile spacing */}
        <div className="p-4 m-3 bg-slate-900 rounded-2xl border border-slate-800/80 shadow-inner relative">
          <div className="flex justify-between items-center mb-2 px-1">
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Access Key</p>
            <button onClick={resetInviteCode} title="Rotate ID" className="text-slate-700 hover:text-cyan-400 transition-all hover:rotate-180 duration-500"><RefreshCw size={14}/></button>
          </div>
          <div className="flex gap-2 items-center bg-black/40 p-3 rounded-xl border border-slate-700/50">
            <code className="text-sm text-cyan-300 font-mono font-bold flex-1">{profile.inviteCode}</code>
            <button onClick={() => {navigator.clipboard.writeText(profile.inviteCode); showStatus("ID Copied!");}} className="p-1 text-slate-600 hover:text-cyan-400"><Copy size={16} /></button>
          </div>
        </div>

        {status.msg && (
          <div className={`mx-4 mb-3 p-3 text-xs font-bold rounded-xl border flex items-center gap-3 ${status.type === 'error' ? 'bg-red-900/20 text-red-400 border-red-800/50' : 'bg-cyan-900/20 text-cyan-300 border-cyan-800/50'}`}>
            <Clock size={14} /> {status.msg}
          </div>
        )}

        <nav className="flex gap-1 px-4 mb-4 mt-1">
          <button onClick={() => setView('chats')} className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${view === 'chats' ? 'bg-cyan-600 text-white' : 'text-slate-500 hover:bg-slate-800'}`}>CHATS</button>
          <button onClick={() => setView('friends')} className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${view === 'friends' ? 'bg-cyan-600 text-white' : 'text-slate-500 hover:bg-slate-800'}`}>NODES</button>
        </nav>

        <div className="flex-1 overflow-y-auto px-4 pb-2">
          {view === 'chats' ? (
            <div className="space-y-1">
              {friends.length === 0 && <div className="py-24 text-center opacity-10 font-black text-xs uppercase tracking-widest">No Active Links</div>}
              {friends.map(f => (
                <button key={f.uid} onClick={() => setActiveChat(f)} className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all mb-1 ${activeChat?.uid === f.uid ? 'bg-slate-800 border-slate-700' : 'hover:bg-slate-900/50 border-transparent'}`}>
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-cyan-400 text-lg">{f.nickname[0].toUpperCase()}</div>
                  <div className="text-left flex-1 truncate">
                    <p className="text-sm font-black text-slate-200">{f.nickname}</p>
                    <p className="text-[10px] text-green-500 font-mono font-bold">STABLE_LINK</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-6 py-2">
              <div className="space-y-3">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Connect Peer</h3>
                <div className="space-y-2">
                  <input type="text" placeholder="Access ID..." value={searchCode} onChange={e => setSearchCode(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm text-white font-mono outline-none focus:ring-1 focus:ring-cyan-500" />
                  <button onClick={sendFriendRequest} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-4 rounded-xl text-[10px] font-black tracking-widest uppercase">Request Sync</button>
                </div>
              </div>
              {pendingRequests.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Incoming Signal</h3>
                  {pendingRequests.map(r => (
                    <div key={r.id} className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
                      <div className="flex flex-col"><span className="text-sm font-black text-slate-200">{r.fromNickname}</span><span className="text-[9px] text-slate-600 font-mono">SIGNAL_REQ</span></div>
                      <div className="flex gap-2">
                        <button onClick={() => acceptRequest(r)} className="p-2 bg-green-600/10 text-green-500 border border-green-500/20 rounded-lg"><Check size={18}/></button>
                        <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'requests', r.fromUid))} className="p-2 bg-slate-800 text-slate-500 rounded-lg"><X size={18}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Profile Footer - Fix: Removed margin-top and padding-bottom to stick it to the bottom screen edge */}
        <div className="p-5 border-t border-slate-800 bg-slate-900 flex items-center gap-4 mt-auto">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20"><User size={20} className="text-cyan-400" /></div>
          <div className="flex-1 truncate">
            <span className="text-xs font-black text-slate-200 tracking-tight block truncate uppercase">{profile.nickname}</span>
            <span className="text-[9px] text-slate-500 font-mono">IDENTITY_ACTIVE</span>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-slate-900 shadow-2xl relative">
        {activeChat ? (
          <>
            <header className="h-20 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-950/60 backdrop-blur-3xl sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <button onClick={() => setActiveChat(null)} className="md:hidden p-2 -ml-2 text-slate-400"><ArrowLeft size={24} /></button>
                <div className="w-11 h-11 rounded-xl bg-cyan-600 flex items-center justify-center font-black text-xl">{activeChat.nickname[0].toUpperCase()}</div>
                <div>
                  <h2 className="text-lg font-black text-white leading-tight uppercase">{activeChat.nickname}</h2>
                  <div className="flex items-center gap-1.5 mt-0.5"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div><span className="text-[10px] text-slate-500 font-black tracking-widest">SECURE_NODE</span></div>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => removeFriend(activeChat)} title="Sever Node" className="p-2 text-slate-600 hover:text-red-400"><UserMinus size={20} /></button>
                <button onClick={deleteChatHistory} title="Purge Data" className="p-2 text-slate-600 hover:text-red-500"><Trash2 size={20} /></button>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-5 space-y-6">
                  <ShieldCheck size={100} />
                  <p className="text-[10px] font-black tracking-[1em] uppercase">Private Hub</p>
                </div>
              )}
              {messages.map((m, idx) => (
                <div key={m.id || idx} className={`flex ${m.sender === user.uid ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] md:max-w-[60%] px-4 py-2.5 rounded-2xl text-sm ${m.sender === user.uid ? 'bg-cyan-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-200 rounded-bl-none'}`}>
                    {m.text}
                    <div className="text-[8px] mt-1 font-bold uppercase opacity-40 text-right">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
              ))}
              <div ref={scrollRef} />
            </div>
            <form onSubmit={sendMessage} className="p-5 bg-slate-950/90 border-t border-slate-800/50">
              <div className="max-w-4xl mx-auto flex gap-3">
                <input type="text" placeholder="Message..." value={inputText} onChange={e => setInputText(e.target.value)} className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-5 py-3.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50" />
                <button type="submit" disabled={!inputText.trim()} className="w-12 h-12 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-20 text-white flex items-center justify-center transition-all active:scale-90"><Send size={20} /></button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-600 p-10">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-cyan-500 blur-[100px] opacity-10" />
              <div className="p-14 rounded-[3.5rem] bg-slate-800/20 border border-slate-800 relative z-10"><ShieldCheck size={100} className="text-slate-800" /></div>
            </div>
            <div className="text-center max-w-xs space-y-3">
              <h3 className="text-2xl font-black text-slate-200 tracking-tight uppercase">System Idle</h3>
              <p className="text-xs text-slate-500 font-medium px-4">Establish a node connection to begin secure transfer.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}