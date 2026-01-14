import { signInWithPopup, signOut } from "firebase/auth";
import {
  getFirebaseAuth,
  googleAuthProvider,
  isFirebaseConfigured,
} from "./firebaseClient";

export const signInWithGoogle = async () => {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase is not configured.");
  }

  const auth = getFirebaseAuth();
  if (!auth) {
    throw new Error("Firebase auth is unavailable.");
  }

  await signInWithPopup(auth, googleAuthProvider);
};

export const signOutUser = async () => {
  const auth = getFirebaseAuth();
  if (!auth) {
    return;
  }

  await signOut(auth);
};
