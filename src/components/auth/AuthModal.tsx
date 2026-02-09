"use client";

import React, { useState } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider,
  sendPasswordResetEmail
} from "firebase/auth";
import { auth } from "@/lib/firebase";

type AuthMode = "login" | "signup" | "forgot-password";

export const AuthModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  if (!isOpen) return null;

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
        onClose();
      } else if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email, password);
        onClose();
      } else if (mode === "forgot-password") {
        await sendPasswordResetEmail(auth, email);
        setMessage("Password reset email sent! Please check your inbox.");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleGoogleAuth = async () => {
    setError("");
    setMessage("");
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      onClose();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError("");
    setMessage("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            {mode === "login" ? "Login" : mode === "signup" ? "Sign Up" : "Reset Password"}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-600">
            {message}
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
              required
            />
          </div>
          
          {mode !== "forgot-password" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
                required
              />
              {mode === "login" && (
                <div className="mt-1 flex justify-end">
                  <button 
                    type="button"
                    onClick={() => toggleMode("forgot-password")}
                    className="text-xs font-semibold text-blue-600 hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
          >
            {mode === "login" ? "Login" : mode === "signup" ? "Sign Up" : "Send Reset Email"}
          </button>
        </form>

        {mode !== "forgot-password" && (
          <>
            <div className="my-6 flex items-center gap-4 text-gray-400">
              <div className="h-px flex-1 bg-gray-200"></div>
              <span className="text-xs uppercase">Or continue with</span>
              <div className="h-px flex-1 bg-gray-200"></div>
            </div>

            <button
              onClick={handleGoogleAuth}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="h-5 w-5" />
              Google
            </button>
          </>
        )}

        <p className="mt-6 text-center text-sm text-gray-600">
          {mode === "login" ? (
            <>
              Don't have an account?{" "}
              <button
                onClick={() => toggleMode("signup")}
                className="font-semibold text-blue-600 hover:underline"
              >
                Sign Up
              </button>
            </>
          ) : mode === "signup" ? (
            <>
              Already have an account?{" "}
              <button
                onClick={() => toggleMode("login")}
                className="font-semibold text-blue-600 hover:underline"
              >
                Login
              </button>
            </>
          ) : (
            <button
              onClick={() => toggleMode("login")}
              className="font-semibold text-blue-600 hover:underline"
            >
              Back to Login
            </button>
          )}
        </p>
      </div>
    </div>
  );
};
