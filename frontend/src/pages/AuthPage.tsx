import React, { useState } from "react";
import { useAuthStore } from "../store/auth";
import { api } from "../lib/api";
import { ZuraLogo } from "../components/ZuraLogo";
import { Loader2, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";

export const AuthPage: React.FC = () => {
  const { setAuth } = useAuthStore();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        const res = await api.auth.register({ name, email, password });
        setAuth(res.user, res.token);
      } else {
        const res = await api.auth.login({ email, password });
        setAuth(res.user, res.token);
      }
    } catch (err: any) {
      setError(err.message || "Autentikasi gagal");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setDemoLoading(true);
    try {
      const res = await api.auth.demoLogin();
      setAuth(res.user, res.token);
    } catch (err: any) {
      setError(err.message || "Gagal masuk mode demo");
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F5F7] flex flex-col justify-center items-center p-4">
      {/* Brand Header */}
      <div className="flex items-center gap-3 mb-8">
        <ZuraLogo size="lg" showText={false} />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-jira-text">
            Zura<span className="text-blue-600 font-extrabold ml-0.5">.</span>
          </h1>
          <p className="text-xs text-jira-subtle font-medium">
            Agile Project Management &amp; Work Tracking
          </p>
        </div>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md bg-white border border-jira-border rounded-lg shadow-jira-modal p-8">
        {/* Quick Demo Access banner */}
        <div className="mb-6 p-3 bg-blue-50/70 border border-blue-200/60 rounded-md">
          <div className="flex items-center gap-2 text-jira-blue font-semibold text-xs mb-1.5">
            <Sparkles size={14} />
            <span>Instant Access Mode</span>
          </div>
          <p className="text-[11px] text-jira-subtle leading-relaxed mb-3">
            Ingin mencoba Zura secara instan tanpa memasukkan kredensial?
          </p>
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={demoLoading}
            className="w-full py-2 bg-jira-blue hover:bg-jira-blue-hover text-white text-xs font-semibold rounded flex items-center justify-center gap-1.5 shadow-sm transition active:scale-[0.98]"
          >
            {demoLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <>
                <span>Quick Demo Login (Alex Morgan - Lead)</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>

        <div className="relative flex py-2 items-center mb-6">
          <div className="flex-grow border-t border-slate-200"></div>
          <span className="flex-shrink mx-3 text-xs text-jira-subtle font-medium uppercase tracking-wider">
            Or {isRegister ? "create account" : "sign in"}
          </span>
          <div className="flex-grow border-t border-slate-200"></div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-xs font-semibold text-jira-subtle uppercase mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sarah Connor"
                className="w-full px-3 py-2 bg-white border border-jira-border rounded text-sm text-jira-text outline-none focus:border-jira-blue focus:ring-1 focus:ring-jira-blue"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-jira-subtle uppercase mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full px-3 py-2 bg-white border border-jira-border rounded text-sm text-jira-text outline-none focus:border-jira-blue focus:ring-1 focus:ring-jira-blue"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-jira-subtle uppercase mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 bg-white border border-jira-border rounded text-sm text-jira-text outline-none focus:border-jira-blue focus:ring-1 focus:ring-jira-blue"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-jira-blue hover:bg-jira-blue-hover disabled:opacity-50 text-white text-sm font-semibold rounded shadow-sm flex items-center justify-center gap-2 transition"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            <span>{isRegister ? "Create Account" : "Log In"}</span>
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-jira-subtle">
          {isRegister ? (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setIsRegister(false)}
                className="text-jira-blue hover:underline font-semibold"
              >
                Log In
              </button>
            </>
          ) : (
            <>
              Don't have an account yet?{" "}
              <button
                type="button"
                onClick={() => setIsRegister(true)}
                className="text-jira-blue hover:underline font-semibold"
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2 text-xs text-jira-subtle">
        <ShieldCheck size={14} className="text-emerald-600" />
        <span>Enterprise-grade security · JWT Authentication &amp; bcrypt</span>
      </div>
    </div>
  );
};
