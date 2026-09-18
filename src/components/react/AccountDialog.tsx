import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { accountRedirect, supabase } from "../../config/supabase";
import type { FavoriteLocation } from "../../data/account";

interface AccountDialogProps {
  session: Session | null;
  recovery: boolean;
  ready: boolean;
  loadError: string;
  favorites: FavoriteLocation[];
  onRemoveFavorite: (id: string) => Promise<void>;
  onProfile: () => void;
  onClose: () => void;
}

export function AccountDialog({ session, recovery, ready, loadError, favorites, onRemoveFavorite, onProfile, onClose }: AccountDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [view, setView] = useState<"login" | "register" | "forgot" | "password">(recovery ? "password" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => { if (recovery) setView("password"); }, [recovery]);

  const perform = async (operation: () => Promise<void>) => {
    setBusy(true); setError(""); setMessage("");
    try { await operation(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The account request failed. Please retry."); }
    finally { setBusy(false); setPassword(""); }
  };

  const submit = async () => {
    if (!supabase) return;
    if (view === "password") {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMessage("Password updated."); setView("login");
    } else if (view === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: accountRedirect(true) });
      if (error) throw error;
      setMessage("If this email has an account, a password reset link is on its way.");
    } else if (view === "register") {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: accountRedirect() } });
      if (error) throw error;
      setMessage(data.session ? "Account created." : "Check your email to confirm your account, then sign in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setMessage("Signed in.");
    }
  };

  return (
    <dialog ref={dialog} className="profile-drawer account-dialog" aria-labelledby="account-title" onCancel={onClose}>
      <div className="profile-drawer__header">
        <h2 id="account-title">Account</h2>
        <button className="btn" onClick={onClose} aria-label="Close account">Close</button>
      </div>
      {!supabase ? <>
        <p>Accounts are not configured on this installation. Guest mapping and preferences remain available.</p>
        <button className="btn" onClick={onProfile}>Guest preferences</button>
      </> : session && view !== "password" ? <>
        <p>{session.user.email}</p>
        <p className="profile-drawer__hint">Preferences and explicitly saved favorites are private to this account. Guest settings and local Patches are not uploaded.</p>
        {loadError ? <p role="alert">{loadError} Reload to retry.</p> : !ready && <p role="status">Loading private preferences...</p>}
        <button className="btn" disabled={!ready || busy} onClick={onProfile}>Access preferences</button>
        <h3>Favorite locations</h3>
        {ready && favorites.length === 0 && <p>No saved favorites.</p>}
        <ul className="account-favorites">
          {favorites.map(favorite => <li key={favorite.id}>
            <span>{favorite.label}</span>
            <button className="btn" disabled={busy} aria-label={`Remove ${favorite.label}`}
              onClick={() => void perform(() => onRemoveFavorite(favorite.id))}>Remove</button>
          </li>)}
        </ul>
        <button className="btn" disabled={busy} onClick={() => { setView("password"); setMessage(""); }}>Change password</button>
        <button className="btn" disabled={busy} onClick={() => void perform(async () => {
          const { error } = await supabase!.auth.signOut({ scope: "local" });
          if (error) throw error;
          setView("login"); setMessage("Signed out on this device.");
        })}>Sign out</button>
      </> : <>
        <form onSubmit={event => { event.preventDefault(); void perform(submit); }}>
          <fieldset className="account-fields" disabled={busy}>
            <legend>{view === "register" ? "Create account" : view === "forgot" ? "Reset password" : view === "password" ? "New password" : "Sign in"}</legend>
            {view !== "password" && <div className="form-field">
              <label htmlFor="account-email">Email</label>
              <input id="account-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} />
            </div>}
            {view !== "forgot" && <div className="form-field">
              <label htmlFor="account-password">Password</label>
              <input id="account-password" type="password" required minLength={view === "login" ? 1 : 12} maxLength={128}
                autoComplete={view === "login" ? "current-password" : "new-password"} value={password} onChange={event => setPassword(event.target.value)} />
              {view !== "login" && <span className="profile-drawer__hint">At least 12 characters.</span>}
            </div>}
            {view === "register" && <p className="profile-drawer__hint">Your email is used for sign-in. Saving access preferences or favorite locations stores that data privately in your account. No travel history is recorded.</p>}
            <button className="btn btn--primary" type="submit">{busy ? "Please wait..." : view === "register" ? "Create account" : view === "forgot" ? "Send reset link" : view === "password" ? "Update password" : "Sign in"}</button>
          </fieldset>
        </form>
        <div className="form-actions">
          {view !== "login" && <button className="btn" disabled={busy} onClick={() => { setView("login"); setError(""); setPassword(""); }}>Back</button>}
          {view === "login" && <>
            <button className="btn" disabled={busy} onClick={() => { setView("register"); setError(""); setPassword(""); }}>Register</button>
            <button className="btn" disabled={busy} onClick={() => { setView("forgot"); setError(""); setPassword(""); }}>Forgot password</button>
            <button className="btn" disabled={busy} onClick={onClose}>Continue as guest</button>
          </>}
        </div>
      </>}
      {error && <p className="route-panel__error" role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </dialog>
  );
}