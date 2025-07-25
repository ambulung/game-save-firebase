import { useState, useEffect, Fragment, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, provider, storage, db } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL, listAll, deleteObject, uploadBytesResumable, getMetadata, updateMetadata, getBlob } from 'firebase/storage';
import { collection, doc, getDoc, setDoc, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { Helmet } from 'react-helmet-async';
import { updateProfile } from 'firebase/auth';
import { CopyToClipboard } from 'react-copy-to-clipboard';

// SVG icons (same as before)
const icons = {
  download: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" /></svg>
  ),
  rename: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 11l6 6M3 21h6l11-11a2.828 2.828 0 00-4-4L5 17v4z" /></svg>
  ),
  delete: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
  ),
  file: (
    <svg className="w-5 h-5 mr-2 text-yellow-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16V4a2 2 0 012-2h8l6 6v8a2 2 0 01-2 2H6a2 2 0 01-2-2z" /></svg>
  ),
  pdf: (
    <svg className="w-5 h-5 mr-2 text-red-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16V4a2 2 0 012-2h8l6 6v8a2 2 0 01-2 2H6a2 2 0 01-2-2z" /></svg>
  ),
  archive: (
    <svg className="w-5 h-5 mr-2 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect width="20" height="14" x="2" y="7" rx="2" /><path d="M16 3v4M8 3v4m-4 4h16" /></svg>
  ),
  save: (
    <svg className="w-5 h-5 mr-2 text-green-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v6h6V3" /></svg>
  ),
  text: (
    <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
  ),
};

function FileIcon({ name }) {
  const ext = name.split('.').pop().toLowerCase();
  if (["zip","rar","7z"].includes(ext)) return icons.archive;
  if (["sav","save","dat"].includes(ext)) return icons.save;
  if (["txt","md","log"].includes(ext)) return icons.text;
  if (["pdf"].includes(ext)) return icons.pdf;
  return icons.file;
}

function Toast({ message, type, onClose }) {
  if (!message) return null;
  return (
    <div className={`fixed top-6 left-1/2 z-50 -translate-x-1/2 px-6 py-3 rounded shadow-lg text-sm font-medium transition-all duration-300 ${type === 'error' ? 'bg-red-700 text-white' : 'bg-green-700 text-white'}`}
      role="alert">
      <div className="flex items-center gap-2">
        <span>{message}</span>
        <button onClick={onClose} className="ml-2 text-lg leading-none" aria-label="Close">&times;</button>
      </div>
    </div>
  );
}

function SetupModal({ files, fileLabels, onLabelChange, onConfirm, onCancel, uploading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-[#23232a] rounded-xl shadow-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4 text-white">Setup Save Files</h2>
        <div className="space-y-3 mb-4">
          {files.map((file) => (
            <div key={file.name} className="flex items-center gap-2">
              <span className="text-xs text-gray-300 truncate max-w-[100px]">{file.name}</span>
              <input
                type="text"
                className="px-2 py-1 text-xs rounded bg-gray-800 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Game Title (e.g. Baldur's Gate 3)"
                value={fileLabels[file.name] || ''}
                onChange={e => onLabelChange(file.name, e.target.value)}
                disabled={uploading}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-800 text-white" disabled={uploading}>Cancel</button>
          <button onClick={onConfirm} className="px-3 py-1 rounded bg-blue-700 hover:bg-blue-800 text-white" disabled={uploading}>Upload</button>
        </div>
      </div>
    </div>
  );
}

function SettingsModal({ user, open, onClose, onSave, uploading, progress, onDeleteAccount }) {
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(user.photoURL || '/default.jpg');
  const [error, setError] = useState('');

  // Clean up blob URLs
  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB.');
      return;
    }
    setError('');
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSave = () => {
    if (!displayName.trim()) {
      setError('Name cannot be empty.');
      return;
    }
    onSave({ displayName, imageFile });
  };

  const handleClose = () => {
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
    onClose();
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-[#23232a] rounded-2xl shadow-2xl p-8 w-full max-w-lg flex flex-col">
        <h2 className="text-2xl font-bold mb-6 text-white">Profile Settings</h2>
        <div className="flex flex-row gap-8 items-center mb-6">
          <div className="flex flex-col items-center flex-shrink-0">
            <img src={imagePreview || '/default.jpg'} alt="Profile preview" className="w-32 h-32 object-cover rounded-xl border-2 border-gray-700 mb-3 shadow" onError={e => { e.target.onerror = null; e.target.src = '/default.jpg'; }} />
            <label className="block w-full text-xs text-center text-gray-300 cursor-pointer bg-[#353646] hover:bg-[#353656] px-3 py-1 rounded transition">
              Change Image
              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </label>
            <div className="text-xs text-gray-400 mt-1">Max 5MB</div>
          </div>
          <div className="flex-1 flex flex-col gap-3">
            <label className="text-xs text-gray-300 mb-1">Display Name</label>
            <input
              type="text"
              className="px-4 py-2 rounded bg-gray-800 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-base"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              maxLength={50}
            />
          </div>
        </div>
        {uploading && (
          <div className="w-full mb-4">
            <div className="w-full bg-gray-700 rounded h-2 overflow-hidden">
              <div className="bg-blue-500 h-2 transition-all duration-200" style={{ width: `${progress}%` }}></div>
            </div>
            <div className="text-blue-400 text-xs mt-1">Uploading... {progress.toFixed(0)}%</div>
          </div>
        )}
        {error && <div className="text-red-400 text-sm mb-4">{error}</div>}
        <div className="flex flex-col md:flex-row justify-end gap-3 mt-2">
          <button onClick={handleClose} className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-800 text-white">Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 rounded bg-blue-700 hover:bg-blue-800 text-white font-semibold">Save</button>
          <button onClick={onDeleteAccount} className="px-4 py-2 rounded bg-red-700 hover:bg-red-800 text-white font-semibold md:ml-auto mt-3 md:mt-0">Delete Account</button>
        </div>
      </div>
    </div>
  );
}

function ConfirmationModal({ open, message, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-[#23232a] rounded-2xl shadow-2xl p-8 w-full max-w-xs flex flex-col items-center">
        <div className="text-lg font-semibold text-white mb-4 text-center">{message}</div>
        <div className="flex gap-4 mt-2">
          <button onClick={onCancel} className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-800 text-white">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded bg-red-700 hover:bg-red-800 text-white font-semibold">Confirm</button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState([]);
  const [refreshFiles, setRefreshFiles] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [newFileName, setNewFileName] = useState('');
  const [progress, setProgress] = useState(0);
  const [fileMeta, setFileMeta] = useState({});
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const fileInputRef = useRef();
  const navigate = useNavigate();
  const [downloadUrls, setDownloadUrls] = useState({});
  const [fileLabels, setFileLabels] = useState({});
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  // Save locations state: { [fileName]: [location1, location2, ...] }
  const [saveLocations, setSaveLocations] = useState({});
  // For copy-to-clipboard feedback
  const [copyToast, setCopyToast] = useState(false);
  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState({ open: false, message: '', onConfirm: null });
  // Search state
  const [search, setSearch] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  // Add state for delete confirmation modal
  const [deleteModal, setDeleteModal] = useState({ open: false, value: '', error: '' });
  // In Dashboard component, add state for current uploading file name
  const [currentUploadingFile, setCurrentUploadingFile] = useState('');

  const handleLocationChange = (fileName, idx, value) => {
    setSaveLocations((prev) => ({
      ...prev,
      [fileName]: prev[fileName]?.map((loc, i) => (i === idx ? value : loc)) || [value],
    }));
  };
  const handleAddLocation = (fileName) => {
    setSaveLocations((prev) => ({
      ...prev,
      [fileName]: [...(prev[fileName] || ['']), ''],
    }));
  };

  // Fetch save locations from Firestore on load and when files/user change
  useEffect(() => {
    if (!user) return;
    const fetchLocations = async () => {
      const locs = {};
      for (const file of files) {
        const ref = doc(db, 'users', user.uid, 'saveLocations', file.name);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          locs[file.name] = snap.data().locations || [''];
        } else {
          locs[file.name] = [''];
        }
      }
      setSaveLocations(locs);
    };
    fetchLocations();
  }, [user, files]);

  // Update Firestore when saveLocations change (debounced)
  useEffect(() => {
    if (!user) return;
    const updateFirestore = async () => {
      for (const [fileName, locations] of Object.entries(saveLocations)) {
        const ref = doc(db, 'users', user.uid, 'saveLocations', fileName);
        // Only save non-empty locations
        const filtered = locations.filter((loc) => loc.trim() !== '');
        if (filtered.length > 0) {
          await setDoc(ref, { locations: filtered });
        } else {
          await deleteDoc(ref);
        }
      }
    };
    updateFirestore();
  }, [saveLocations, user]);

  // Auth state for always-up-to-date user info
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setFiles([]);
      setDownloadUrls({});
      return;
    }
    const fetchFiles = async () => {
      const storage = getStorage();
      const userRef = ref(storage, `${user.uid}/`);
      try {
        const res = await listAll(userRef);
        setFiles(res.items);
        // Fetch download URLs for each file
        const urls = {};
        for (const file of res.items) {
          urls[file.name] = await getDownloadURL(file);
        }
        setDownloadUrls(urls);
      } catch (err) {
        setFiles([]);
        setDownloadUrls({});
      }
    };
    fetchFiles();
  }, [user, refreshFiles]);

  useEffect(() => {
    if (!files.length) return;
    const fetchMeta = async () => {
      const meta = {};
      for (const file of files) {
        try {
          meta[file.name] = await getMetadata(file);
        } catch {}
      }
      setFileMeta(meta);
    };
    fetchMeta();
  }, [files]);

  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
  const USER_TOTAL_LIMIT = 50 * 1024 * 1024; // 50MB
  const getTotalUsedSize = () => {
    return Object.values(fileMeta).reduce((sum, meta) => sum + (meta?.size || 0), 0);
  };

  const handleFileLabelChange = (fileName, value) => {
    setFileLabels((prev) => ({ ...prev, [fileName]: value }));
  };

  const handleFileInputChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setPendingFiles(files);
    setShowSetupModal(true);
  };

  const handleModalConfirm = async () => {
    setShowSetupModal(false);
    await handleFileUpload(pendingFiles);
    setPendingFiles([]);
  };

  const handleModalCancel = () => {
    setShowSetupModal(false);
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileUpload = async (files) => {
    if (!files.length || !user) return;
    let anyError = false;
    const totalUsed = getTotalUsedSize();
    const totalNew = files.reduce((sum, file) => sum + file.size, 0);
    if (totalUsed + totalNew > USER_TOTAL_LIMIT) {
      setToast({ message: `Upload would exceed your 50MB total storage limit.`, type: 'error' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      setFileLabels({});
      return;
    }
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        setToast({ message: `File ${file.name} is too large. Max 20MB.`, type: 'error' });
        anyError = true;
        continue;
      }
      setUploading(true);
      setProgress(0);
      setCurrentUploadingFile(file.name);
      try {
        const storage = getStorage();
        const fileRef = ref(storage, `${user.uid}/${file.name}`);
        const customMetadata = { label: fileLabels[file.name] || '' };
        const uploadTask = uploadBytesResumable(fileRef, file, { customMetadata });
        await new Promise((resolve, reject) => {
          uploadTask.on('state_changed', (snapshot) => {
            setProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          }, reject, resolve);
        });
        setToast({ message: `Uploaded ${file.name}!`, type: 'success' });
        setRefreshFiles((r) => !r);
      } catch (err) {
        setToast({ message: `Upload failed for ${file.name}: ${err.message}`, type: 'error' });
        anyError = true;
      } finally {
        setUploading(false);
        setProgress(0);
        setCurrentUploadingFile('');
      }
    }
    if (!anyError && fileInputRef.current) fileInputRef.current.value = '';
    setFileLabels({});
  };

  const [uploading, setUploading] = useState(false);

  const handleSignOut = async () => {
    setConfirmModal({
      open: true,
      message: 'Are you sure you want to sign out?',
      onConfirm: async () => {
        setLoggingOut(true);
        setConfirmModal({ open: false, message: '', onConfirm: null });
        // Simulate loading for 1.5s
        setTimeout(async () => {
          await signOut(auth);
          setLoggingOut(false);
          navigate('/login', { replace: true });
        }, 1500);
      },
    });
  };

  // Delete file with confirmation modal
  const handleDelete = (fileRef) => {
    setConfirmModal({
      open: true,
      message: `Are you sure you want to delete ${fileRef.name}?`,
      onConfirm: async () => {
        setDeleting(fileRef.name);
        try {
          await deleteObject(fileRef);
          setFiles((prev) => prev.filter((f) => f.name !== fileRef.name));
          setToast({ message: 'File deleted.', type: 'success' });
        } catch (err) {
          alert('Delete failed: ' + err.message);
          setToast({ message: 'Delete failed: ' + err.message, type: 'error' });
        } finally {
          setDeleting(null);
        }
        setConfirmModal({ open: false, message: '', onConfirm: null });
      },
    });
  };

  // (If you ever re-enable renaming, preserve customMetadata)
  const handleRename = async (fileRef, newName) => {
    setRenaming(fileRef.name);
    try {
      const storage = getStorage();
      // Get the old file's metadata
      const oldMeta = await getMetadata(fileRef);
      const blob = await getBlob(fileRef);
      const newRef = ref(storage, `${user.uid}/${newName}`);
      // Copy over customMetadata (like label)
      await uploadBytes(newRef, blob, { customMetadata: oldMeta.customMetadata });
      await deleteObject(fileRef);
      setRefreshFiles((r) => !r);
      setToast({ message: 'File renamed.', type: 'success' });
    } catch (err) {
      alert('Rename failed: ' + err.message);
      setToast({ message: 'Rename failed: ' + err.message, type: 'error' });
    } finally {
      setRenaming(null);
      setNewFileName('');
    }
  };

  // Download handler to always show Save As dialog
  const handleDownload = async (file) => {
    try {
      const url = downloadUrls[file.name];
      const response = await fetch(url);
      const blob = await response.blob();
      const a = document.createElement('a');
      const label = fileMeta[file.name]?.customMetadata?.label || file.name;
      const ext = file.name.substring(file.name.lastIndexOf('.'));
      a.href = URL.createObjectURL(blob);
      a.download = label + ext;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (err) {
      setToast({ message: 'Download failed: ' + err.message, type: 'error' });
    }
  };

  // Avatar upload with progress
  const handleAvatarUpload = async (imageFile) => {
    if (!imageFile || !user) return;
    setUploading(true);
    setProgress(0);
    try {
      const avatarRef = ref(storage, `avatars/${user.uid}/avatar.jpg`);
      const uploadTask = uploadBytesResumable(avatarRef, imageFile);
      await new Promise((resolve, reject) => {
        uploadTask.on('state_changed',
          (snapshot) => {
            setProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          },
          reject,
          resolve
        );
      });
      const photoURL = await getDownloadURL(avatarRef);
      await updateProfile(user, { photoURL });
      setToast({ message: 'Profile picture updated!', type: 'success' });
      setShowSettings(false);
    } catch (err) {
      setToast({ message: `Failed to update profile picture: ${err.message}`, type: 'error' });
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  // Unified settings save
  const handleSettingsSave = async ({ displayName, imageFile }) => {
    try {
      if (displayName !== user.displayName) {
        await updateProfile(user, { displayName });
        setToast({ message: 'Display name updated!', type: 'success' });
      }
      if (imageFile) {
        await handleAvatarUpload(imageFile);
      } else {
        setShowSettings(false);
      }
    } catch (err) {
      setToast({ message: 'An unexpected error occurred during settings save.', type: 'error' });
    }
  };

  // Remove a save location with confirmation modal
  const handleRemoveLocation = (fileName, idx) => {
    setConfirmModal({
      open: true,
      message: 'Are you sure you want to remove this save location?',
      onConfirm: () => {
        setSaveLocations((prev) => {
          const updated = { ...prev };
          if (updated[fileName]) {
            updated[fileName] = updated[fileName].filter((_, i) => i !== idx);
            if (updated[fileName].length === 0) updated[fileName] = [''];
          }
          return updated;
        });
        setConfirmModal({ open: false, message: '', onConfirm: null });
      },
    });
  };

  // Show copy toast for 1.5s
  const handleCopy = (text) => {
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 1500);
  };

  // Toast auto-dismiss after 6 seconds
  useEffect(() => {
    if (toast.message) {
      const timer = setTimeout(() => setToast({ message: '', type: 'success' }), 6000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Add handler to open delete modal
  const handleDeleteAccountClick = () => {
    setDeleteModal({ open: true, value: '', error: '' });
    setShowSettings(false);
  };
  // Update handleDeleteAccount to delete all user files from storage before deleting the user
  const handleDeleteAccount = async () => {
    if (deleteModal.value !== 'DELETE') {
      setDeleteModal((prev) => ({ ...prev, error: 'You must type DELETE to confirm.' }));
      return;
    }
    try {
      // Delete all files in user's storage folder
      const storage = getStorage();
      const userFolderRef = ref(storage, `${user.uid}/`);
      const avatarRef = ref(storage, `avatars/${user.uid}/avatar.jpg`);
      // Delete all save files
      try {
        const listRes = await listAll(userFolderRef);
        await Promise.all(listRes.items.map(fileRef => deleteObject(fileRef)));
      } catch (err) {
        // Ignore if folder doesn't exist
      }
      // Delete avatar
      try {
        await deleteObject(avatarRef);
      } catch (err) {
        // Ignore if avatar doesn't exist
      }
      // Now delete the user
      await user.delete();
      setDeleteModal({ open: false, value: '', error: '' });
      setToast({ message: 'Account and all files deleted successfully.', type: 'success' });
      setTimeout(() => {
        navigate('/login', { replace: true });
        window.location.reload();
      }, 1500);
    } catch (err) {
      setDeleteModal((prev) => ({ ...prev, error: err.message }));
    }
  };

  return (
    <Fragment>
      <Helmet>
        <title>Dashboard | Game Save Manager</title>
        <meta name="description" content="Manage, upload, and download your game save files securely from any device. Your personal game save manager dashboard." />
      </Helmet>
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />
      {copyToast && (
        <div className="fixed top-6 left-1/2 z-50 -translate-x-1/2 px-6 py-3 rounded shadow-lg text-sm font-medium bg-green-700 text-white transition-all duration-300" role="alert">
          Copied to clipboard!
        </div>
      )}
      {uploading && (
        <div className="fixed top-0 left-0 w-full z-50 flex flex-col items-center">
          <div className="w-full max-w-md bg-[#23232a] rounded-b-xl shadow-xl px-6 py-4 flex flex-col items-center border-b-2 border-blue-700">
            <div className="w-full flex justify-between items-center mb-2">
              <span className="text-sm text-blue-300 font-semibold">Uploading: {currentUploadingFile}</span>
              <span className="text-xs text-blue-400">{progress.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded h-2 overflow-hidden">
              <div className="bg-blue-500 h-2 transition-all duration-200" style={{ width: `${progress}%` }}></div>
            </div>
          </div>
        </div>
      )}
      <ConfirmationModal
        open={confirmModal.open}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ open: false, message: '', onConfirm: null })}
      />
      {deleteModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-[#23232a] rounded-2xl shadow-2xl p-8 w-full max-w-xs flex flex-col items-center">
            <div className="text-lg font-semibold text-white mb-4 text-center">Type DELETE to confirm account deletion.<br/>This action cannot be undone.</div>
            <input
              type="text"
              className="px-4 py-2 rounded bg-gray-800 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-red-400 text-center mb-3"
              placeholder="Type DELETE"
              value={deleteModal.value}
              onChange={e => setDeleteModal((prev) => ({ ...prev, value: e.target.value, error: '' }))}
            />
            {deleteModal.error && <div className="text-red-400 text-xs mb-2">{deleteModal.error}</div>}
            <div className="flex gap-4 mt-2">
              <button onClick={() => setDeleteModal({ open: false, value: '', error: '' })} className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-800 text-white">Cancel</button>
              <button onClick={handleDeleteAccount} className="px-4 py-2 rounded bg-red-700 hover:bg-red-800 text-white font-semibold">Delete</button>
            </div>
          </div>
        </div>
      )}
      <div className="min-h-screen w-full flex bg-[#18181b] text-white font-sans">
        {/* Sidebar */}
        <aside className="w-64 fixed top-0 left-0 h-screen bg-[#20212b] flex flex-col items-center py-8 shadow-lg z-40">
          {user && (
            <div className="flex flex-col items-center w-full">
              <div className="flex flex-row items-center w-full px-4">
                <img src={user.photoURL || '/default.jpg'} alt="User avatar" className="w-14 h-14 object-cover rounded-xl border border-gray-700" onError={e => { e.target.onerror = null; e.target.src = '/default.jpg'; }} />
                <div className="ml-4 flex flex-col">
                  <div className="text-sm font-medium truncate">{user.displayName || user.email}</div>
                  <div className="mt-2 w-full">
                    <div className="text-[10px] text-gray-300 whitespace-nowrap mb-1">
                      Storage Used: {(getTotalUsedSize() / (1024 * 1024)).toFixed(1)} / 50.0 MB
                    </div>
                    <div className="flex items-center gap-2 w-full">
                      <div className="flex-1 h-2 bg-gray-800 border border-gray-700 rounded-full overflow-hidden relative">
                        <div
                          className="bg-blue-500 h-2 absolute top-0 left-0 rounded-full"
                          style={{ width: `${Math.max(Math.min((getTotalUsedSize() / (50 * 1024 * 1024)) * 100, 100), getTotalUsedSize() > 0 ? 2 : 0)}%` }}
                        ></div>
                      </div>
                      <span className="text-[10px] text-gray-300 whitespace-nowrap min-w-[32px] text-right">
                        {`${Math.min((getTotalUsedSize() / (50 * 1024 * 1024)) * 100, 100).toFixed(0)}%`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <nav className="w-full flex flex-col items-center mt-8">
                <button onClick={() => setShowSettings(true)} className="w-11/12 px-4 py-2 mb-2 bg-[#353646] rounded hover:bg-[#353656] text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-400">Settings</button>
                <button
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  className="w-11/12 px-4 py-2 mb-2 bg-blue-600 rounded hover:bg-blue-700 text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  Upload Files
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileInputChange}
                  disabled={uploading}
                  aria-label="Upload files"
                />
                <button onClick={handleSignOut} className="w-11/12 px-4 py-2 bg-red-600 rounded hover:bg-red-700 text-white text-xs focus:outline-none focus:ring-2 focus:ring-red-400 flex items-center justify-center" disabled={loggingOut}>
                  {loggingOut ? (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeOpacity=".25" /><path d="M12 6v6l4 2" /></svg>
                      Logging out...
                    </span>
                  ) : (
                    'Sign Out'
                  )}
                </button>
              </nav>
            </div>
          )}
        </aside>
        {/* Main Content */}
        <main className="flex-1 flex flex-col min-h-screen ml-64">
          {/* Header */}
          <header className="w-full fixed top-0 left-64 right-0 flex items-center px-8 py-6 bg-[#23232a] border-b border-gray-800 shadow z-30">
            <h1 className="text-2xl font-bold tracking-tight">Game Save Manager</h1>
          </header>
          {/* Setup Modal */}
          {showSetupModal && (
            <SetupModal
              files={pendingFiles}
              fileLabels={fileLabels}
              onLabelChange={handleFileLabelChange}
              onConfirm={handleModalConfirm}
              onCancel={handleModalCancel}
              uploading={uploading}
            />
          )}
          {/* File List */}
          <section className="flex-1 flex flex-col items-center justify-start px-8 py-8 mt-[104px]">
            <div className="w-full bg-[#23232a] rounded-xl shadow-xl p-6">
              <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div className="text-lg font-semibold mb-2 md:mb-0">Your Save Files</div>
                <div className="flex flex-col md:flex-row md:items-center gap-2 w-full md:w-auto">
                  <input
                    type="text"
                    className="px-3 py-2 rounded bg-gray-800 border border-gray-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-full md:w-64"
                    placeholder="Search by game name or file name..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>
              {files.length === 0 ? (
                <div className="text-gray-400 text-sm">No files uploaded.</div>
              ) : (
                <ul className="divide-y divide-[#282832]">
                  {files.filter(file => {
                    const label = fileMeta[file.name]?.customMetadata?.label || '';
                    const name = file.name || '';
                    return (
                      label.toLowerCase().includes(search.toLowerCase()) ||
                      name.toLowerCase().includes(search.toLowerCase())
                    );
                  }).map((file) => (
                    <li key={file.name} className="flex flex-col py-3">
                      <div className="flex items-center min-w-0 gap-3 mb-2">
                        <FileIcon name={file.name} />
                        <span className="truncate max-w-[180px] text-base font-semibold" title={fileMeta[file.name]?.customMetadata?.label || file.name}>
                          {fileMeta[file.name]?.customMetadata?.label || file.name}
                        </span>
                      </div>
                      {/* Save Locations UI below game name, long horizontal */}
                      <div className="flex flex-col gap-2 w-full mb-2">
                        {(saveLocations[file.name] || ['']).map((loc, idx) => (
                          <div key={idx} className="flex items-center gap-2 w-full">
                            <input
                              type="text"
                              className="flex-1 px-3 py-2 text-xs rounded bg-gray-800 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                              placeholder="Save Location (e.g. C:/Games/BG3/Save)"
                              value={loc}
                              onChange={e => handleLocationChange(file.name, idx, e.target.value)}
                            />
                            <CopyToClipboard text={loc} onCopy={() => handleCopy(loc)}>
                              <button className="px-3 py-2 text-xs bg-green-700 rounded hover:bg-green-800 text-white" title="Copy to clipboard">Copy</button>
                            </CopyToClipboard>
                            <button onClick={() => handleRemoveLocation(file.name, idx)} className="px-3 py-2 text-xs bg-red-700 rounded hover:bg-red-800 text-white" title="Remove location">Remove</button>
                          </div>
                        ))}
                        <button onClick={() => handleAddLocation(file.name)} className="mt-1 px-3 py-2 text-xs bg-[#353646] rounded hover:bg-[#353656] text-white self-start">+ Add Location</button>
                      </div>
                      <div className="flex flex-col md:flex-row md:items-center gap-2 mt-2 md:mt-0">
                        <span className="text-xs text-gray-400">File: {file.name}</span>
                        <span className="text-xs text-gray-400">Size: {fileMeta[file.name]?.size ? (fileMeta[file.name].size / 1024).toFixed(1) + ' KB' : '...'}</span>
                        <span className="text-xs text-gray-400">Uploaded: {fileMeta[file.name]?.timeCreated ? new Date(fileMeta[file.name].timeCreated).toLocaleString() : '...'}</span>
                        <a
                          href={downloadUrls[file.name]}
                          download={fileMeta[file.name]?.customMetadata?.label ? `${fileMeta[file.name].customMetadata.label}${file.name.substring(file.name.lastIndexOf('.'))}` : file.name}
                          className="ml-2 px-2 py-1 text-xs bg-blue-700 rounded hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                          aria-label={`Download ${file.name}`}
                          title="Download"
                        >
                          {icons.download}
                        </a>
                        <button
                          onClick={() => handleDelete(file)}
                          className="ml-2 px-2 py-1 text-xs bg-red-700 rounded hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:opacity-50"
                          disabled={deleting === file.name}
                          aria-label={`Delete ${file.name}`}
                          title="Delete"
                        >
                          {deleting === file.name ? (
                            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeOpacity=".25" /><path d="M12 6v6l4 2" /></svg>
                          ) : (
                            icons.delete
                          )}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </main>
      </div>
      {/* Settings Modal */}
      {user && (
        <SettingsModal
          user={user}
          open={showSettings}
          onClose={() => setShowSettings(false)}
          onSave={handleSettingsSave}
          uploading={uploading}
          progress={progress}
          onDeleteAccount={handleDeleteAccountClick}
        />
      )}
    </Fragment>
  );
} 