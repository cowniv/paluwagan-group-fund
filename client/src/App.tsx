import { useEffect, useState } from "react";
import { api, tokenStore } from "./api";
import type { User } from "./types";
import AuthForm from "./components/AuthForm";
import GroupList from "./components/GroupList";
import GroupView from "./components/GroupView";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [openGroup, setOpenGroup] = useState<number | null>(null);

  useEffect(() => {
    if (!tokenStore.get()) return setChecking(false);
    api<User>("/me")
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setChecking(false));
  }, []);

  function logout() {
    tokenStore.clear();
    setUser(null);
    setOpenGroup(null);
  }

  if (checking) return <p className="p-8 text-sm text-slate-500">Loading…</p>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <button onClick={() => setOpenGroup(null)} className="text-lg font-bold text-brand">
            Paluwagan
          </button>
          {user && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-500">{user.name}</span>
              <button onClick={logout} className="btn-ghost">Log out</button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
