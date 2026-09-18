import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../config/supabase";
import { addFavorite, loadAccountData, removeFavorite, saveAccountProfile, type FavoriteLocation } from "../../data/account";
import { loadProfile, normalizeProfile, saveProfile, type UserProfile } from "../../data/profile";

export function useAccountProfile() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile>(loadProfile);
  const [favorites, setFavorites] = useState<FavoriteLocation[]>([]);
  const [ready, setReady] = useState(!supabase);
  const [error, setError] = useState("");
  const [recovery, setRecovery] = useState(false);
  const owner = useRef<string | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    if (!supabase) return;
    let disposed = false;
    let initialized = false;
    const accept = (next: Session | null) => {
      if (disposed) return;
      const userId = next?.user.id ?? null;
      setSession(next);
      if (initialized && userId === owner.current) return;
      initialized = true;
      owner.current = userId;
      const current = ++generation.current;
      setError("");
      setFavorites([]);
      setProfile(userId ? normalizeProfile({}) : loadProfile());
      setReady(!userId);
      if (!userId) { setRecovery(false); return; }
      void loadAccountData(userId).then(data => {
        if (disposed || current !== generation.current) return;
        setProfile(data.profile);
        setFavorites(data.favorites);
        setReady(true);
      }).catch(() => {
        if (!disposed && current === generation.current) setError("Could not load private preferences. Routing and profile saving are paused until they load.");
      });
    };
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      queueMicrotask(() => accept(next));
    });
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (disposed || initialized) return;
      if (sessionError) { setError("Could not restore your session. Please reload or sign in again."); return; }
      accept(data.session);
      if (data.session && new URLSearchParams(location.search).get("account") === "recovery") setRecovery(true);
    }).catch(() => { if (!disposed) setError("Could not restore your session."); });
    return () => { disposed = true; generation.current++; data.subscription.unsubscribe(); };
  }, []);

  const save = useCallback(async (next: UserProfile) => {
    if (!ready) throw new Error("Wait for your private preferences to load.");
    const userId = owner.current;
    const current = generation.current;
    const normalized = normalizeProfile(next);
    if (userId) await saveAccountProfile(userId, normalized);
    else saveProfile(normalized);
    if (owner.current !== userId || generation.current !== current) throw new Error("Your account changed. Please reopen preferences.");
    setProfile(normalized);
  }, [ready]);

  const saveFavorite = useCallback(async (place: Omit<FavoriteLocation, "id">) => {
    const userId = owner.current;
    const current = generation.current;
    if (!userId || !ready) throw new Error("Sign in and load your profile before saving favorites.");
    const favorite = await addFavorite(userId, place);
    if (owner.current === userId && generation.current === current) setFavorites(previous => [...previous, favorite]);
  }, [ready]);

  const deleteFavorite = useCallback(async (id: string) => {
    const userId = owner.current;
    const current = generation.current;
    if (!userId || !ready) throw new Error("Sign in before changing favorites.");
    await removeFavorite(userId, id);
    if (owner.current === userId && generation.current === current) setFavorites(previous => previous.filter(favorite => favorite.id !== id));
  }, [ready]);

  return { session, profile, favorites, ready, error, recovery, setRecovery, save, saveFavorite, deleteFavorite };
}