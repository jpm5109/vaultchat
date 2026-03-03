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
 * This version is self-contained to ensure compatibility.
 */

// --- Firebase Configuration ---
// These globals are provided by the environment. 
// For local development, replace with: const firebaseConfig = { apiKey: "..." };
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

// Helper to generate a random 8-character invite code
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

  // 1. Authentication Handshake
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

  // 2. Profile & Social Listeners
  useEffect(() => {
    if (!user) return;
    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
    const requestsColl = collection(db, 'artifacts', appId, 'users', user.uid, 'requests');

    const unsubProfile = onSnapshot(profileRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setProfile(data);
        setFriends(data.friends || []);
      }
      setLoading(false);
    }, (err) => console.error("Profile listen error", err));

    const unsubRequests = onSnapshot(requestsColl, (snap) => {
      setPendingRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error("Requests listen error", err));

    return () => { unsubProfile(); unsubRequests(); };
  }, [user]);

  // 3. Message Synchronization
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

  // --- Core Handlers ---

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
      // Set private profile
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'), profileData);
      // Map invite code to UID in public discovery
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'discovery', inviteCode), {
        uid: user.uid, nickname: profileData.nickname
      });
    } catch (err) { 
      console.error(err);
      showStatus("Initialization failed.", "error"); 
    } finally { setLoading(false); }
  };

  const resetInviteCode = async () => {
    if (!profile) return;
    try {
      const oldCode = profile.inviteCode;
      const newCode = generateInviteCode();
      // Remove old mapping
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'discovery', oldCode));
      // Create new mapping
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'discovery', newCode), {
        uid: user.uid, nickname: profile.nickname
      });
      // Update the code in my profile
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data'), {
        inviteCode: newCode
      });
      showStatus("Unique ID Reset Successful");
    } catch (err) { 
      console.error(err);
      showStatus("Reset failed.", "error"); 
    }
  };

  const sendFriendRequest = async () => {
    if (!searchCode || searchCode === profile?.inviteCode) return;
    try {
      const targetDisc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'discovery', searchCode));
      if (!targetDisc.exists()) { 
        showStatus("ID not found.", "error"); 
        return; 
      }
      
      const targetUid = targetDisc.data().uid;
      // Send to target user's private requests inbox
      await setDoc(doc(db, 'artifacts', appId, 'users', targetUid, 'requests', user.uid), {
        fromUid: user.uid, 
        fromNickname: profile.nickname, 
        timestamp: Date.now()
      });
      showStatus("Request sent!");
      setSearchCode('');
    } catch (err) { 
      console.error(err);
      showStatus("Failed to send request.", "error"); 
    }
  };

  const acceptRequest = async (req) => {
    try {
      const myRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
      const theirRef = doc(db, 'artifacts', appId, 'users', req.fromUid, 'profile', 'data');
      // Update both profiles simultaneously
      await updateDoc(myRef, { friends: arrayUnion({ uid: req.fromUid, nickname: req.fromNickname }) });
      await updateDoc(theirRef, { friends: arrayUnion({ uid: user.uid, nickname: profile.nickname }) });
      // Delete request from inbox
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'requests', req.fromUid));
    } catch (err) { console.error(err); }
  };

  const removeFriend = async (friend) => {
    if (!window.confirm(`Delete connection with ${friend.nickname}? History will be retained unless wiped.`)) return;
    try {
      const myRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'data');
      const theirRef = doc(db, 'artifacts', appId, 'users', friend.uid, 'profile', 'data');
      await updateDoc(myRef, { friends: arrayRemove(friend) });
      await updateDoc(theirRef, { friends: arrayRemove({ uid: user.uid, nickname: profile.nickname }) });
      if (activeChat?.uid === friend.uid) setActiveChat(null);
      showStatus("Friend removed.");
    } catch (err) { console.error(err); }
  };

  const deleteChatHistory = async () => {
    if (!activeChat || !window.confirm("Permanently wipe chat history for BOTH users?")) return;
    try {
      const chatId = [user.uid, activeChat.uid].sort().join('_');
      const msgColl = collection(db, 'artifacts', appId, 'public', 'data', `chat_${chatId}`);
      const snap = await getDocs(msgColl);
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      showStatus("Channel wiped.");
    } catch (err) { 
      console.error(err);
      showStatus("Wipe failed.", "error");
    }
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

  // --- Render Logic ---

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
      {/* Sidebar */}
      <div className={`fixed inset-0 z-20 md:relative md:flex w-full md:w-80 flex-col bg-slate-950 border-r border-slate-800 transition-transform ${activeChat ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}>
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-cyan-400" size={24} />
            <h1 className="font-black tracking-tighter uppercase text-base">VaultChat</h1>
          </div>
          <button onClick={() => window.location.reload()} className="p-2 text-slate-600 hover:text-red-400 transition-colors"><LogOut size={18}/></button>
        </div>

        {/* Shareable ID Section */}
        <div className="p-5 m-4 bg-slate-900 rounded-3xl border border-slate-800/80 shadow-inner relative group">
          <div className="flex justify-between items-center mb-3 px-1">
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Shareable Invite ID</p>
            <button onClick={resetInviteCode} title="Reset ID (Deletes old ID)" className="text-slate-700 hover:text-cyan-400 transition-all hover:rotate-180 duration-500"><RefreshCw size={14}/></button>
          </div>
          <div className="flex gap-2 items-center bg-black/40 p-4 rounded-2xl border border-slate-700/50">
            <code className="text-sm text-cyan-300 font-mono font-bold flex-1">{profile.inviteCode}</code>
            <button 
              onClick={() => {navigator.clipboard.writeText(profile.inviteCode); showStatus("ID Copied!");}} 
              className="p-1 text-slate-600 hover:text-cyan-400"
            >
              <Copy size={16} />
            </button>
          </div>
        </div>

        {status.msg && (
          <div className={`mx-4 mb-3 p-3 text-xs font-bold rounded-xl border flex items-center gap-3 animate-in slide-in-from-top-2 ${status.type === 'error' ? 'bg-red-900/20 text-red-400 border-red-800/50' : 'bg-cyan-900/20 text-cyan-300 border-cyan-800/50'}`}>
            <Clock size={14} className="animate-pulse" /> {status.msg}
          </div>
        )}

        <nav className="flex gap-1 px-4 mb-4 mt-2">
          <button onClick={() => setView('chats')} className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${view === 'chats' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/40' : 'text-slate-500 hover:bg-slate-800'}`}>CHATS</button>
          <button onClick={() => setView('friends')} className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${view === 'friends' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/40' : 'text-slate-500 hover:bg-slate-800'}`}>SOCIAL</button>
        </nav>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {view === 'chats' ? (
            <div className="space-y-1">
              {friends.length === 0 && <div className="py-24 text-center opacity-10 font-black text-xs uppercase tracking-widest">No Active Nodes</div>}
              {friends.map(f => (
                <button
                  key={f.uid}
                  onClick={() => setActiveChat(f)}
                  className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all mb-1 ${activeChat?.uid === f.uid ? 'bg-slate-800 border border-slate-700 shadow-xl' : 'hover:bg-slate-900/50 border border-transparent'}`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-cyan-400 text-lg shadow-sm">
                    {f.nickname[0].toUpperCase()}
                  </div>
                  <div className="text-left flex-1 truncate">
                    <p className="text-sm font-black text-slate-200">{f.nickname}</p>
                    <p className="text-[10px] text-green-500 font-mono font-bold tracking-tighter">NODE_VERIFIED</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-8 py-2">
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Establish Link</h3>
                <div className="space-y-2">
                  <input 
                    type="text" 
                    placeholder="Peer Invite ID..." 
                    value={searchCode} 
                    onChange={e => setSearchCode(e.target.value)} 
                    className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 text-sm text-white font-mono outline-none focus:ring-1 focus:ring-cyan-500" 
                  />
                  <button onClick={sendFriendRequest} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-4 rounded-2xl text-[10px] font-black tracking-widest uppercase shadow-lg shadow-cyan-950/40 active:scale-[0.98]">
                    Dispatch Link Request
                  </button>
                </div>
              </div>

              {pendingRequests.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Incoming Signal</h3>
                  {pendingRequests.map(r => (
                    <div key={r.id} className="bg-slate-900 p-5 rounded-3xl border border-slate-800 flex items-center justify-between shadow-xl animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-200">{r.fromNickname}</span>
                        <span className="text-[9px] text-slate-600 font-mono font-bold">CONNECTION_REQ</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => acceptRequest(r)} className="p-2.5 bg-green-600/10 text-green-500 border border-green-500/20 rounded-xl hover:bg-green-600 hover:text-white transition-all"><Check size={18}/></button>
                        <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'requests', r.fromUid))} className="p-2.5 bg-slate-800 text-slate-500 rounded-xl hover:bg-red-600/10 hover:text-red-500 transition-all"><X size={18}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-slate-800 bg-slate-900/30 flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20"><User size={20} className="text-cyan-400" /></div>
          <div className="flex-1 truncate">
            <span className="text-xs font-black text-slate-200 tracking-tight block truncate uppercase">{profile.nickname}</span>
            <span className="text-[9px] text-slate-500 font-mono">STATUS: ENCRYPTED</span>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-slate-900 shadow-2xl relative">
        {activeChat ? (
          <>
            <header className="h-20 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-950/60 backdrop-blur-3xl sticky top-0 z-10">
              <div className="flex items-center gap-5">
                <button onClick={() => setActiveChat(null)} className="md:hidden p-2 -ml-2 text-slate-400"><ArrowLeft size={24} /></button>
                <div className="w-11 h-11 rounded-2xl bg-cyan-600 flex items-center justify-center font-black text-xl shadow-lg shadow-cyan-950/50">{activeChat.nickname[0].toUpperCase()}</div>
                <div>
                  <h2 className="text-lg font-black text-white leading-tight tracking-tight uppercase">{activeChat.nickname}</h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Secured Channel</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => removeFriend(activeChat)} title="Sever Connection" className="p-3 text-slate-600 hover:text-red-400 transition-all hover:bg-red-400/5 rounded-xl"><UserMinus size={20} /></button>
                <button onClick={deleteChatHistory} title="Purge Channel Logs" className="p-3 text-slate-600 hover:text-red-500 transition-all hover:bg-red-500/5 rounded-xl"><Trash2 size={20} /></button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8 space-y-5 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-slate-800/10 via-transparent to-transparent">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-5 space-y-6">
                  <ShieldCheck size={120} />
                  <p className="text-xs font-black tracking-[1em] uppercase">Private Communication Hub</p>
                </div>
              )}
              {messages.map((m, idx) => (
                <div key={m.id || idx} className={`flex ${m.sender === user.uid ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                  <div className={`max-w-[80%] md:max-w-[60%] px-5 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                    m.sender === user.uid 
                    ? 'bg-cyan-600 text-white rounded-br-none shadow-cyan-950/40 border border-cyan-500/20' 
                    : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700/80 shadow-black/20'
                  }`}>
                    {m.text}
                    <div className={`text-[9px] mt-1.5 font-bold uppercase opacity-40 text-right ${m.sender === user.uid ? 'text-white' : 'text-slate-400'}`}>
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={scrollRef} />
            </div>

            <form onSubmit={sendMessage} className="p-6 bg-slate-950/90 border-t border-slate-800/50 backdrop-blur-4xl">
              <div className="max-w-4xl mx-auto flex gap-4">
                <input 
                  type="text" 
                  placeholder="Enter secure message..." 
                  value={inputText} 
                  onChange={e => setInputText(e.target.value)} 
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-[1.5rem] px-6 py-4 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-cyan-500/50 text-white placeholder-slate-700 shadow-inner" 
                />
                <button 
                  type="submit" 
                  disabled={!inputText.trim()} 
                  className="w-14 h-14 rounded-2xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-20 disabled:grayscale text-white flex items-center justify-center transition-all active:scale-90 shadow-xl shadow-cyan-950/50"
                >
                  <Send size={24} />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-600 p-12">
            <div className="relative mb-12">
              <div className="absolute inset-0 bg-cyan-500 blur-[120px] opacity-10 animate-pulse" />
              <div className="p-16 rounded-[4rem] bg-slate-800/20 border border-slate-800 shadow-2xl relative z-10">
                <ShieldCheck size={120} className="text-slate-800" />
              </div>
            </div>
            <div className="text-center max-w-sm space-y-4">
              <h3 className="text-3xl font-black text-slate-200 tracking-tight uppercase">Node Standby</h3>
              <p className="text-sm leading-relaxed text-slate-500 font-medium px-4">Encryption keys are idle. Select a verified contact or establish a new node connection to begin secure data transfer.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}