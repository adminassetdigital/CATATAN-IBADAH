import { useCallback, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { mergeLocalDataToFirestore } from '../lib/db';
import { auth, googleProvider } from '../lib/firebase';
import {
  deleteAllLocalData,
  readLocalDays,
  readLocalJurnal,
} from '../lib/localStore';

function mapAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';

  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'Jendela masuk Google ditutup sebelum selesai. Silakan coba lagi.';
    case 'auth/popup-blocked':
      return 'Popup masuk diblokir oleh browser. Izinkan popup untuk situs ini lalu coba kembali.';
    case 'auth/cancelled-popup-request':
      return 'Permintaan masuk dibatalkan karena ada jendela lain yang terbuka.';
    case 'auth/network-request-failed':
      return 'Tidak ada koneksi internet. Periksa jaringanmu lalu coba masuk kembali.';
    case 'auth/unauthorized-domain':
      return 'Domain ini belum diizinkan di pengaturan Firebase Authentication.';
    default:
      return 'Gagal masuk dengan Google. Silakan coba beberapa saat lagi.';
  }
}

export interface UseAuthResult {
  user: User | null;
  loading: boolean;
  signingIn: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
}

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [signingIn, setSigningIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        setUser(firebaseUser);
        setLoading(false);
      },
      (error) => {
        console.error('Auth state error:', error);
        setAuthError('Gagal memeriksa status akun.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    setSigningIn(true);
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      const localDays = readLocalDays();
      const localJurnal = readLocalJurnal();
      if (
        Object.keys(localDays).length > 0 ||
        localJurnal.length > 0
      ) {
        try {
          await mergeLocalDataToFirestore(
            credential.user.uid,
            localDays,
            localJurnal
          );
          deleteAllLocalData();
        } catch (mergeErr) {
          console.error('Gagal menyinkronkan data lokal:', mergeErr);
        }
      }
    } catch (error) {
      setAuthError(mapAuthError(error));
    } finally {
      setSigningIn(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setAuthError(null);
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
      setAuthError('Gagal keluar dari akun. Silakan coba lagi.');
    }
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  return {
    user,
    loading,
    signingIn,
    authError,
    signInWithGoogle,
    logout,
    clearAuthError,
  };
}
