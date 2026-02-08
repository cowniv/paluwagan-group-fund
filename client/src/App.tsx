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

