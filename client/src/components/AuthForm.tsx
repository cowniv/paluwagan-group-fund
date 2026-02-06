import { useState, type FormEvent } from "react";
import { api, tokenStore } from "../api";
import type { User } from "../types";

export default function AuthForm({ onAuthed }: { onAuthed: (u: User) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ email: "ana@example.com", name: "", password: "password123" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api<{ token: string; user: User }>(`/auth/${mode}`, { method: "POST", body: form });
      tokenStore.set(res.token);
      onAuthed(res.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-1 text-2xl font-bold">{mode === "login" ? "Welcome back" : "Create an account"}</h1>
      <p className="mb-6 text-sm text-slate-500">Track your group's paluwagan: who paid, who's next, and where the money went.</p>
      <form onSubmit={submit} className="card space-y-3">
        {mode === "register" && (
          <label className="block text-sm">
            Name
            <input className="input mt-1" value={form.name} onChange={set("name")} required />
          </label>
        )}
        <label className="block text-sm">
          Email
          <input className="input mt-1" type="email" value={form.email} onChange={set("email")} required />
        </label>
        <label className="block text-sm">
          Password
          <input className="input mt-1" type="password" value={form.password} onChange={set("password")} minLength={8} required />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn w-full" disabled={busy}>
          {busy ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}
        </button>
        <button type="button" className="w-full text-sm text-brand" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "No account yet? Sign up" : "Have an account? Log in"}
        </button>
      </form>
      {mode === "login" && <p className="mt-3 text-center text-xs text-slate-400">Demo: ana@example.com / password123 (after npm run seed)</p>}
    </div>
  );
}
