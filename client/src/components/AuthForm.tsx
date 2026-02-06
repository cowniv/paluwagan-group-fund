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
