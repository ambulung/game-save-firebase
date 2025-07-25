import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, provider } from './firebase';
import { Helmet } from 'react-helmet-async';
import SettingsModal from './Dashboard.jsx'; // Reuse the modal from Dashboard
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import ReCAPTCHA from 'react-google-recaptcha';

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
  const recaptchaRef = useRef();
  const [recaptchaValue, setRecaptchaValue] = useState(null);

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
    if (!recaptchaValue) {
      setError('Please complete the reCAPTCHA.');
      setLoading(false);
      return;
    }
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
      {/* Error Popout */}
      {error && (
        <div className="fixed top-8 left-1/2 transform -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-fade-in">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" /></svg>
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-4 text-white hover:text-gray-200 focus:outline-none">✕</button>
        </div>
      )}
      <div className="flex flex-col md:flex-row items-center justify-center w-full max-w-4xl gap-12">
        {/* Logo/Title Section */}
        <div className="flex flex-col items-start justify-center w-full md:w-1/2 mb-8 md:mb-0">
          <h1 className="text-5xl font-extrabold mb-4 tracking-tight text-left">Game Save Manager</h1>
          <p className="text-lg text-gray-300 text-left max-w-xs">Securely manage and access your game saves from anywhere.</p>
        </div>
        {/* Login Form Section */}
        <div className="w-full max-w-sm bg-[#23232a] rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-6 border border-[#23232a] text-white">
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
            <div className="flex justify-center my-2">
              <ReCAPTCHA
                ref={recaptchaRef}
                sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
                theme="dark"
                onChange={setRecaptchaValue}
              />
            </div>
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
          <button onClick={handleSignIn} 
            className="w-full flex items-center justify-center gap-3 px-4 py-2 rounded-xl border border-gray-500 bg-[#23232a] hover:bg-[#23232a]/80 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 font-semibold text-white">
            <svg className="w-5 h-5" viewBox="0 0 48 48"><g><path fill="#4285F4" d="M24 9.5c3.54 0 6.7 1.22 9.19 3.23l6.85-6.85C35.64 2.69 30.18 0 24 0 14.82 0 6.71 5.48 2.69 13.44l7.98 6.2C12.13 13.13 17.62 9.5 24 9.5z"/><path fill="#34A853" d="M46.1 24.55c0-1.64-.15-3.22-.42-4.74H24v9.01h12.42c-.54 2.9-2.18 5.36-4.65 7.01l7.19 5.6C43.98 37.13 46.1 31.3 46.1 24.55z"/><path fill="#FBBC05" d="M10.67 28.09c-1.01-2.99-1.01-6.19 0-9.18l-7.98-6.2C.86 16.09 0 19.01 0 22c0 2.99.86 5.91 2.69 8.29l7.98-6.2z"/><path fill="#EA4335" d="M24 44c6.18 0 11.64-2.03 15.54-5.53l-7.19-5.6c-2.01 1.35-4.59 2.13-7.35 2.13-6.38 0-11.87-3.63-14.33-8.89l-7.98 6.2C6.71 42.52 14.82 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></g></svg>
            <span>Sign in with Google</span>
          </button>
        </div>
      </div>
      {/* SettingsModal for new user removed */}
    </div>
  );
} 