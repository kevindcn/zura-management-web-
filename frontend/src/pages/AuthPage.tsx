import React, { useState } from "react";
import { useAuthStore } from "../store/auth";
import { api } from "../lib/api";
import zuraIconPng from "../components/photo/zura-icon.png";
import {
  Loader2,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Zap,
  Users,
  User as UserIcon,
} from "lucide-react";

export const AuthPage: React.FC = () => {
  const { setAuth } = useAuthStore();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
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
      setError(err.message || "Authentication failed");
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
      setError(err.message || "Failed to launch demo mode");
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F4FD] flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden font-sans select-none">
      {/* Ambient background soft blurs */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-80 h-80 bg-blue-100/30 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container Card (2-Column Layout matching Reference Image) */}
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(15,23,42,0.08)] border border-slate-100 grid grid-cols-1 lg:grid-cols-12 overflow-hidden relative z-10">
        {/* LEFT COLUMN: Brand, Value Proposition & Visual Illustration */}
        <div className="lg:col-span-5 bg-gradient-to-br from-blue-50/50 via-slate-50/30 to-blue-50/80 p-8 sm:p-10 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-100/90 relative overflow-hidden">
          {/* Top Brand Header */}
          <div>
            <div className="flex items-center gap-2.5">
              <img
                src={zuraIconPng}
                alt="Zura Logo"
                className="w-8 h-8 object-contain drop-shadow-xs"
                draggable={false}
              />
              <span className="text-xl font-bold tracking-tight text-[#172B4D] dark:text-white transition-colors">
                Zura<span className="text-blue-600 dark:text-blue-400 font-extrabold ml-0.5">.</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              Agile Project Management &amp; Work Tracking
            </p>

            {/* Main Headline */}
            <h2 className="text-2xl sm:text-[26px] font-extrabold text-slate-900 tracking-tight leading-snug mt-7">
              Organize Your Projects, Build Better Together
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed mt-2.5 max-w-sm">
              Keep your team aligned, track progress in real-time, and turn ideas into results with Zura.
            </p>

            {/* 3 Value Features */}
            <div className="space-y-4 mt-6">
              {/* Feature 1 */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-100/80 text-blue-600 flex items-center justify-center flex-shrink-0 shadow-2xs mt-0.5">
                  <Zap size={15} className="fill-blue-600" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Track Progress</h4>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    See what's done, what's in progress, and what's next.
                  </p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-purple-100/80 text-purple-600 flex items-center justify-center flex-shrink-0 shadow-2xs mt-0.5">
                  <Users size={15} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Work Together</h4>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Collaborate with your team in one place.
                  </p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-100/80 text-emerald-600 flex items-center justify-center flex-shrink-0 shadow-2xs mt-0.5">
                  <ShieldCheck size={15} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Stay Organized</h4>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Manage tasks, deadlines, and priorities with ease.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Illustration: Flat Frontal Board with Potted Plant & Analytics Card (matching Reference 2, tidak miring) */}
          <div className="mt-8 pt-2 relative">
            <div className="relative w-full max-w-[360px] sm:max-w-[400px] mx-auto flex items-end">
              {/* 1. Potted Plant on the Left */}
              <div className="relative -mr-2 sm:-mr-3 -mb-1 w-14 sm:w-16 h-28 sm:h-32 flex-shrink-0 z-10 pointer-events-none drop-shadow-sm">
                <svg
                  viewBox="0 0 80 120"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-full h-full"
                >
                  {/* Pot base shadow */}
                  <ellipse cx="40" cy="115" rx="18" ry="3.5" fill="#CBD5E1" opacity="0.6" />
                  
                  {/* Ceramic Pot Body */}
                  <path
                    d="M26 80 L30 112 C30 114 32 115 35 115 H45 C48 115 50 114 50 112 L54 80 Z"
                    fill="#FFFFFF"
                    stroke="#E2E8F0"
                    strokeWidth="1.5"
                  />
                  {/* Pot Rim */}
                  <rect
                    x="24"
                    y="76"
                    width="32"
                    height="6"
                    rx="2"
                    fill="#F8FAFC"
                    stroke="#E2E8F0"
                    strokeWidth="1.5"
                  />
                  {/* Dark Soil */}
                  <ellipse cx="40" cy="78" rx="12" ry="2.5" fill="#94A3B8" />

                  {/* Stems */}
                  <path d="M40 76 Q39 52 40 28" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M40 68 Q28 58 22 48" stroke="#059669" strokeWidth="2" strokeLinecap="round" />
                  <path d="M40 62 Q52 52 58 44" stroke="#059669" strokeWidth="2" strokeLinecap="round" />
                  <path d="M40 72 Q26 67 18 64" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M40 70 Q54 65 62 62" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" />

                  {/* Center Top Leaf */}
                  <path d="M40 28 C33 18 36 6 40 2 C44 6 47 18 40 28 Z" fill="#10B981" />
                  <path d="M40 3 L40 26" stroke="#059669" strokeWidth="1" strokeLinecap="round" />

                  {/* Upper Left Leaf */}
                  <path d="M22 48 C14 40 14 28 18 23 C24 27 28 36 23 47 Z" fill="#34D399" />
                  <path d="M18 24 Q22 35 23 46" stroke="#059669" strokeWidth="1" />

                  {/* Upper Right Leaf */}
                  <path d="M58 44 C66 36 66 24 62 19 C56 23 52 32 57 43 Z" fill="#10B981" />
                  <path d="M62 20 Q58 31 57 42" stroke="#047857" strokeWidth="1" />

                  {/* Lower Left Leaf */}
                  <path d="M18 64 C8 60 6 50 9 45 C16 47 20 55 18 63 Z" fill="#059669" />
                  <path d="M10 46 Q15 54 18 62" stroke="#065F46" strokeWidth="1" />

                  {/* Lower Right Leaf */}
                  <path d="M62 62 C72 58 74 48 71 43 C64 45 60 53 62 61 Z" fill="#34D399" />
                  <path d="M70 44 Q65 52 62 60" stroke="#059669" strokeWidth="1" />
                </svg>
              </div>

              {/* 2. Main Window (Flat frontal, tidak miring) */}
              <div className="flex-1 bg-white/95 rounded-2xl shadow-[0_16px_36px_-10px_rgba(15,23,42,0.1)] border border-slate-100 overflow-hidden relative">
                {/* Window Top Bar */}
                <div className="bg-slate-50/90 px-3 py-2 border-b border-slate-100 flex items-center justify-between gap-2">
                  {/* Colored Window Dots */}
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <div className="w-2 h-2 rounded-full bg-slate-300" />
                  </div>

                  {/* Top Search Input Bar */}
                  <div className="flex-1 max-w-[130px] sm:max-w-[150px] h-5 bg-white rounded-full border border-slate-200/80 px-2 flex items-center gap-1.5 shadow-2xs">
                    <svg
                      className="w-2.5 h-2.5 text-slate-400 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.5"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <div className="h-1 w-10 bg-slate-200 rounded-full" />
                  </div>

                  {/* Right Header Icons */}
                  <div className="flex items-center gap-1">
                    <div className="w-3.5 h-3.5 rounded-full bg-slate-200/80" />
                    <div className="w-3.5 h-3.5 rounded-full bg-slate-300/80" />
                  </div>
                </div>

                {/* Window Body: Sidebar + 3 Columns */}
                <div className="p-2.5 flex gap-2">
                  {/* Left Mini Sidebar */}
                  <div className="w-8 sm:w-9 flex flex-col items-center py-1 gap-2 border-r border-slate-100 pr-1.5 flex-shrink-0">
                    {/* Mini Zura Logo */}
                    <img
                      src={zuraIconPng}
                      alt="Zura"
                      className="w-5 h-5 object-contain shadow-2xs"
                      draggable={false}
                    />

                    {/* Nav Icons */}
                    <div className="flex flex-col items-center gap-1.5 mt-0.5">
                      <div className="w-4 h-4 rounded bg-blue-50 flex items-center justify-center text-blue-600">
                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                        </svg>
                      </div>
                      <div className="w-4 h-4 rounded bg-slate-100 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-xs border border-slate-400" />
                      </div>
                      <div className="w-4 h-4 rounded bg-slate-100 flex items-center justify-center">
                        <div className="w-2 h-1.5 rounded-xs border border-slate-400" />
                      </div>
                      <div className="w-4 h-4 rounded bg-slate-100 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full border border-slate-400" />
                      </div>
                    </div>
                  </div>

                  {/* 3 Kanban Columns */}
                  <div className="flex-1 grid grid-cols-3 gap-1.5 sm:gap-2">
                    {/* Column 1 - To Do */}
                    <div className="bg-slate-50/80 rounded-xl p-1.5 space-y-1.5 border border-slate-100/70">
                      <div className="h-1.5 w-9 bg-blue-600 rounded-full mb-1" />
                      {/* Card 1 */}
                      <div className="bg-white rounded-lg p-1.5 shadow-2xs border border-slate-100 space-y-1">
                        <div className="h-1 w-full bg-slate-300 rounded" />
                        <div className="h-1 w-2/3 bg-slate-200 rounded" />
                        <div className="flex justify-end pt-0.5">
                          <div className="w-3.5 h-3.5 rounded-full bg-blue-500 text-[6px] text-white flex items-center justify-center font-bold">
                            U
                          </div>
                        </div>
                      </div>
                      {/* Card 2 */}
                      <div className="bg-white rounded-lg p-1.5 shadow-2xs border border-slate-100 space-y-1">
                        <div className="h-1 w-4/5 bg-slate-300 rounded" />
                        <div className="flex justify-end pt-0.5">
                          <div className="w-3.5 h-3.5 rounded-full bg-slate-200" />
                        </div>
                      </div>
                    </div>

                    {/* Column 2 - In Progress */}
                    <div className="bg-slate-50/80 rounded-xl p-1.5 space-y-1.5 border border-slate-100/70">
                      <div className="h-1.5 w-9 bg-emerald-500 rounded-full mb-1" />
                      {/* Card 1 */}
                      <div className="bg-white rounded-lg p-1.5 shadow-2xs border border-slate-100 space-y-1">
                        <div className="h-1 w-full bg-emerald-400 rounded" />
                        <div className="h-1 w-3/4 bg-slate-200 rounded" />
                        <div className="flex justify-end pt-0.5">
                          <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 text-[6px] text-white flex items-center justify-center font-bold">
                            K
                          </div>
                        </div>
                      </div>
                      {/* Card 2 */}
                      <div className="bg-white rounded-lg p-1.5 shadow-2xs border border-slate-100 space-y-1">
                        <div className="h-1 w-2/3 bg-slate-300 rounded" />
                        <div className="flex justify-end pt-0.5">
                          <div className="w-3.5 h-3.5 rounded-full bg-slate-200" />
                        </div>
                      </div>
                    </div>

                    {/* Column 3 - Done */}
                    <div className="bg-slate-50/80 rounded-xl p-1.5 space-y-1.5 border border-slate-100/70">
                      <div className="h-1.5 w-9 bg-purple-600 rounded-full mb-1" />
                      {/* Card 1 */}
                      <div className="bg-white rounded-lg p-1.5 shadow-2xs border border-slate-100 space-y-1">
                        <div className="h-1 w-full bg-purple-400 rounded" />
                        <div className="h-1 w-1/2 bg-slate-200 rounded" />
                        <div className="flex justify-end pt-0.5">
                          <div className="w-3.5 h-3.5 rounded-full bg-purple-500 text-[6px] text-white flex items-center justify-center font-bold">
                            A
                          </div>
                        </div>
                      </div>
                      {/* Card 2 */}
                      <div className="bg-white rounded-lg p-1.5 shadow-2xs border border-slate-100 space-y-1">
                        <div className="h-1 w-3/4 bg-slate-200 rounded" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Floating Analytics Chart Card on Bottom-Right */}
              <div className="absolute -bottom-3 -right-2 sm:-bottom-4 sm:-right-3 w-20 sm:w-24 h-20 sm:h-24 bg-white rounded-2xl shadow-[0_16px_32px_-6px_rgba(15,23,42,0.18)] border border-slate-100 p-2 sm:p-2.5 z-20 flex flex-col justify-between">
                {/* Mini upward trending graph line */}
                <div className="w-full h-5 relative">
                  <svg
                    viewBox="0 0 50 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-full h-full"
                  >
                    <path
                      d="M2 17 L16 11 L28 14 L46 3"
                      stroke="#93C5FD"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="46" cy="3" r="2" fill="#2563EB" />
                  </svg>
                </div>

                {/* 3 Vertical Blue Bars of Increasing Height */}
                <div className="flex items-end justify-between px-1 gap-1.5">
                  <div className="w-2.5 sm:w-3 h-5 bg-blue-600 rounded-xs" />
                  <div className="w-2.5 sm:w-3 h-8 bg-blue-600 rounded-xs" />
                  <div className="w-2.5 sm:w-3 h-12 bg-blue-600 rounded-xs" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Authentication Form */}
        <div className="lg:col-span-7 p-8 sm:p-10 lg:p-12 flex flex-col justify-between bg-white">
          <div>
            {/* Top Switcher: Don't have an account yet? Sign Up */}
            <div className="flex justify-end items-center text-xs text-slate-500 mb-6">
              {isRegister ? (
                <>
                  <span>Already have an account?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegister(false);
                      setError(null);
                    }}
                    className="text-blue-600 hover:text-blue-700 font-bold ml-1 transition"
                  >
                    Log In
                  </button>
                </>
              ) : (
                <>
                  <span>Don't have an account yet?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegister(true);
                      setError(null);
                    }}
                    className="text-blue-600 hover:text-blue-700 font-bold ml-1 transition"
                  >
                    Sign Up
                  </button>
                </>
              )}
            </div>

            {/* Header: Welcome Back */}
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {isRegister ? "Create an Account" : "Welcome Back"}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1.5">
                {isRegister
                  ? "Start managing your team's projects with Zura today."
                  : "Sign in to your Zura account to continue to your workspace."}
              </p>
            </div>

            {/* Quick Demo Login Banner */}
            <div className="mt-6 p-3.5 sm:p-4 bg-blue-50/70 border border-blue-100/90 rounded-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white text-blue-600 flex items-center justify-center flex-shrink-0 shadow-2xs border border-blue-100">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Quick Demo Login</h4>
                  <p className="text-[11px] text-slate-500">
                    Try Zura with a demo account to explore all features.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={demoLoading}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition shadow-xs whitespace-nowrap flex-shrink-0"
              >
                {demoLoading ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <>
                    <span>Quick Demo Login</span>
                    <ArrowRight size={13} />
                  </>
                )}
              </button>
            </div>

            {/* OR Divider */}
            <div className="relative flex py-2 items-center my-4">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                OR
              </span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            {/* Error message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {isRegister && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name
                  </label>
                  <div className="relative flex items-center">
                    <UserIcon size={15} className="absolute left-3.5 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Sarah Connor"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address
                </label>
                <div className="relative flex items-center">
                  <Mail size={15} className="absolute left-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Password
                </label>
                <div className="relative flex items-center">
                  <Lock size={15} className="absolute left-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 text-slate-400 hover:text-slate-600 transition"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Remember me & Forgot password */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 rounded-sm"
                  />
                  <span>Remember me</span>
                </label>

                <button
                  type="button"
                  onClick={() => alert("Please contact your workspace administrator to reset your password.")}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition"
                >
                  Forgot password?
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    <span>{isRegister ? "Create Account" : "Log In"}</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Security Footer */}
          <div className="mt-8 pt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-medium">
            <ShieldCheck size={14} className="text-emerald-500 flex-shrink-0" />
            <span>Enterprise-grade security · JWT Authentication &amp; bcrypt</span>
          </div>
        </div>
      </div>
    </div>
  );
};
