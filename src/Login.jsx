import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, provider } from './firebase';
import { Helmet } from 'react-helmet-async';
import SettingsModal from './Dashboard.jsx'; // Reuse the modal from Dashboard
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false); // keep for future use, but not used
  const [newUser, setNewUser] = useState(null); // keep for future use, but not used
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStrength, setPasswordStrength] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) navigate('/dashboard', { replace: true });
    });
    return () => unsub();
  }, [navigate]);

  // Password strength checker
  useEffect(() => {
    if (!isSignUp) {
      setPasswordStrength('');
      return;
    }
    if (password.length < 6) setPasswordStrength('Weak');
    else if (password.match(/[A-Z]/) && password.match(/[0-9]/) && password.length >= 8) setPasswordStrength('Strong');
    else setPasswordStrength('Medium');
  }, [password, isSignUp]);

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, provider);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError('Sign in failed: ' + err.message);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isSignUp) {
        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          setLoading(false);
          return;
        }
        await createUserWithEmailAndPassword(auth, email, password);
        navigate('/dashboard', { replace: true });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Save settings for new user
  const handleSettingsSave = async ({ displayName, imageFile }) => {
    try {
      if (newUser) {
        let photoURL = newUser.photoURL;
        if (imageFile) {
          // Upload avatar to storage
          const avatarRef = ref(auth.app.storage(), `avatars/${newUser.uid}/avatar.jpg`);
          await uploadBytes(avatarRef, imageFile);
          photoURL = await getDownloadURL(avatarRef);
        }
        await updateProfile(newUser, { displayName, photoURL });
        await newUser.reload(); // Ensure displayName is updated
        setShowSettingsModal(false);
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setError('Failed to save profile: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#18181b] text-white font-sans">
      <Helmet>
        <title>Login | Game Save Manager</title>
        <meta name="description" content="Sign in to access your game save files from anywhere. Secure, fast, and easy game save management." />
      </Helmet>
      <div className="w-full max-w-sm bg-[#23232a] rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-6 border border-[#23232a] text-white">
        <h1 className="text-3xl font-bold mb-2 tracking-tight">Game Save Manager</h1>
        <p className="mb-4 text-center">Sign in or create an account to access your game saves.</p>
        <form onSubmit={handleEmailAuth} className="w-full flex flex-col gap-3">
          <input
            type="email"
            className="px-3 py-2 rounded bg-gray-800 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            className="px-3 py-2 rounded bg-gray-800 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          {isSignUp && (
            <>
              <input
                type="password"
                className="px-3 py-2 rounded bg-gray-800 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Re-enter Password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
              <div className="text-xs mt-1 mb-2 text-gray-400">
                Password strength: <span className={
                  passwordStrength === 'Strong' ? 'text-green-400' : passwordStrength === 'Medium' ? 'text-yellow-400' : 'text-red-400'
                }>{passwordStrength}</span>
              </div>
            </>
          )}
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 w-full focus:outline-none focus:ring-2 focus:ring-blue-400 font-semibold"
            disabled={loading}
          >
            {loading ? (isSignUp ? 'Signing up...' : 'Logging in...') : (isSignUp ? 'Sign Up' : 'Login')}
          </button>
        </form>
        <button
          onClick={() => setIsSignUp(s => !s)}
          className="text-xs text-blue-400 hover:underline mt-1"
        >
          {isSignUp ? 'Already have an account? Login' : "Don't have an account? Sign Up"}
        </button>
        <div className="w-full flex items-center gap-2 my-2">
          <div className="flex-1 h-px bg-gray-700" />
          <span className="text-xs text-gray-400">or</span>
          <div className="flex-1 h-px bg-gray-700" />
        </div>
        <button onClick={handleSignIn} className="px-4 py-2 bg-red-600 rounded hover:bg-red-700 w-full focus:outline-none focus:ring-2 focus:ring-red-400 font-semibold">Sign in with Google</button>
        {error && <div className="text-red-400 text-xs mt-2 text-center">{error}</div>}
      </div>
      {/* SettingsModal for new user removed */}
    </div>
  );
} 