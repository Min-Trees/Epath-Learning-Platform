"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  confirmPasswordReset,
  updateProfile,
  User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuthStore } from "@/stores";
import { clearTokenCache } from "@/lib/api-client";
import type { User, UserRole } from "@/types";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    displayName: string,
    role?: UserRole
  ) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resetPasswordConfirm: (
    oobCode: string,
    newPassword: string
  ) => Promise<void>;
  updateUserProfile: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { setUser, setLoading, user: storeUser } = useAuthStore();
  const [isInitializing, setIsInitializing] = useState(true);

  // Xử lý sự kiện token expired từ api-client
  const handleTokenExpired = useCallback(() => {
    console.warn("[auth] Token expired, forcing logout");
    clearTokenCache();
    setUser(null);
  }, [setUser]);

  useEffect(() => {
    // Lắng nghe sự kiện token expired
    window.addEventListener("auth:token-expired", handleTokenExpired);
    return () => {
      window.removeEventListener("auth:token-expired", handleTokenExpired);
    };
  }, [handleTokenExpired]);

  // Lắng nghe thay đổi auth state từ Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            setUser({ ...userData, id: firebaseUser.uid });
          } else {
            const newUser: User = {
              id: firebaseUser.uid,
              email: firebaseUser.email || "",
              displayName: firebaseUser.displayName || "User",
              photoURL: firebaseUser.photoURL || undefined,
              role: "employee",
              enrolledCourses: [],
              completedCourses: [],
              createdAt: new Date(),
              updatedAt: new Date(),
              isActive: true,
            };
            await setDoc(doc(db, "users", firebaseUser.uid), {
              ...newUser,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            setUser(newUser);
          }
        } catch (err) {
          // Firestore rule từ chối read/create — fallback về thông tin từ
          // Firebase Auth để app không bị block. User sẽ là employee mặc định
          // và nếu là admin thì cần fix rules.
          setUser({
            id: firebaseUser.uid,
            email: firebaseUser.email || "",
            displayName: firebaseUser.displayName || "User",
            photoURL: firebaseUser.photoURL || undefined,
            role: "employee",
            enrolledCourses: [],
            completedCourses: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            isActive: true,
          });
        }
      } else {
        setUser(null);
        clearTokenCache();
      }
      setIsInitializing(false);
    });

    return unsubscribe;
  }, [setUser]);

  const login = async (email: string, password: string) => {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    try {
      const userDoc = await getDoc(doc(db, "users", credential.user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        setUser({ ...userData, id: credential.user.uid });
      } else {
        // Tạo doc lần đầu
        const newUser: User = {
          id: credential.user.uid,
          email: credential.user.email || "",
          displayName: credential.user.displayName || "User",
          photoURL: credential.user.photoURL || undefined,
          role: "employee",
          enrolledCourses: [],
          completedCourses: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true,
        };
        await setDoc(doc(db, "users", credential.user.uid), {
          ...newUser,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setUser(newUser);
      }
    } catch (err) {
      // Fallback nếu Firestore rule chặn
      setUser({
        id: credential.user.uid,
        email: credential.user.email || "",
        displayName: credential.user.displayName || "User",
        photoURL: credential.user.photoURL || undefined,
        role: "employee",
        enrolledCourses: [],
        completedCourses: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      });
    }
  };

  const register = async (
    email: string,
    password: string,
    displayName: string,
    role: UserRole = "employee"
  ) => {
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    await updateProfile(credential.user, { displayName });

    const newUser: User = {
      id: credential.user.uid,
      email,
      displayName,
      role,
      enrolledCourses: [],
      completedCourses: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
    };

    await setDoc(doc(db, "users", credential.user.uid), {
      ...newUser,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setUser(newUser);
  };

  const logout = async () => {
    clearTokenCache();
    await signOut(auth);
    setUser(null);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const resetPasswordConfirm = async (
    oobCode: string,
    newPassword: string
  ) => {
    await confirmPasswordReset(auth, oobCode, newPassword);
  };

  const updateUserProfile = async (data: Partial<User>) => {
    if (!auth.currentUser) return;

    const userRef = doc(db, "users", auth.currentUser.uid);
    await setDoc(
      userRef,
      { ...data, updatedAt: serverTimestamp() },
      { merge: true }
    );

    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      const userData = userDoc.data() as User;
      setUser({ ...userData, id: auth.currentUser.uid });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user: storeUser,
        isLoading: isInitializing,
        isAuthenticated: !!storeUser,
        login,
        register,
        logout,
        resetPassword,
        resetPasswordConfirm,
        updateUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
