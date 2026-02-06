import { useState, type FormEvent } from "react";
import { api, tokenStore } from "../api";
import type { User } from "../types";

export default function AuthForm({ onAuthed }: { onAuthed: (u: User) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ email: "ana@example.com", name: "", password: "password123" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

