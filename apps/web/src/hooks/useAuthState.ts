import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { getFirebaseAuth, isFirebaseConfigured } from "../../lib/firebaseClient";

export type AuthStatus = "local" | "signed-in";

export type AuthState = {
  status: AuthStatus;
  user: User | null;
};

export const useAuthState = (): AuthState => {
  const [state, setState] = useState<AuthState>({
    status: "local",
    user: null,
  });

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setState({ status: "local", user: null });
      return;
    }

    const auth = getFirebaseAuth();
    if (!auth) {
      setState({ status: "local", user: null });
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setState({ status: user ? "signed-in" : "local", user });
    });

    return () => unsubscribe();
  }, []);

  return state;
};
