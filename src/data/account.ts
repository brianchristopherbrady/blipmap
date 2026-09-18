import { supabase } from "../config/supabase";
import { normalizeProfile, type UserProfile } from "./profile";

export interface FavoriteLocation {
  id: string;
  label: string;
  lng: number;
  lat: number;
}

function client() {
  if (!supabase) throw new Error("Accounts are not configured on this installation.");
  return supabase;
}

export async function loadAccountData(userId: string): Promise<{ profile: UserProfile; favorites: FavoriteLocation[] }> {
  const [preferences, favorites] = await Promise.all([
    client().from("accessibility_profiles").select("preferences").eq("user_id", userId).maybeSingle(),
    client().from("favorite_locations").select("id,label,lng,lat").eq("user_id", userId).order("label"),
  ]);
  if (preferences.error) throw preferences.error;
  if (favorites.error) throw favorites.error;
  return { profile: normalizeProfile(preferences.data?.preferences), favorites: favorites.data ?? [] };
}

export async function saveAccountProfile(userId: string, profile: UserProfile): Promise<void> {
  const { error } = await client().from("accessibility_profiles").upsert({ user_id: userId, preferences: normalizeProfile(profile) });
  if (error) throw error;
}

export async function addFavorite(userId: string, place: Omit<FavoriteLocation, "id">): Promise<FavoriteLocation> {
  const label = place.label.trim();
  if (!label || label.length > 500 || !Number.isFinite(place.lng) || !Number.isFinite(place.lat)
    || Math.abs(place.lng) > 180 || Math.abs(place.lat) > 90) throw new Error("Invalid favorite location.");
  const { data, error } = await client().from("favorite_locations")
    .insert({ user_id: userId, label, lng: place.lng, lat: place.lat }).select("id,label,lng,lat").single();
  if (error) throw error;
  return data;
}

export async function removeFavorite(userId: string, id: string): Promise<void> {
  const { error } = await client().from("favorite_locations").delete().eq("user_id", userId).eq("id", id);
  if (error) throw error;
}