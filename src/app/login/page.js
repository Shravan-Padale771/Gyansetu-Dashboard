"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { motion } from "framer-motion";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push("/"); // Success! Send them to the dashboard
        router.refresh(); // Force Next.js to update the middleware state
      } else {
        setError("Incorrect password. Please try again.");
      }
    } catch (err) {
      setError("Server error. Please check your connection.");
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-900">
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-slate-100"
      >
        <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-6 mx-auto">
          <Lock size={24} />
        </div>
        <h1 className="text-2xl font-bold text-center mb-2">Admin Dashboard</h1>
        <p className="text-slate-500 text-center mb-8 text-sm">Enter your master password to access the CMS.</p>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition-all text-center tracking-widest text-lg font-mono"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-rose-500 text-sm text-center font-medium">{error}</p>}

          <button
            type="submit"
            disabled={isLoading || !password}
            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-70"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : "Unlock Dashboard"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}