import { useEffect, useRef, useState } from "react";
import type { UserProfile, MobilityAid } from "../../data/profile";
import { MOBILITY_AID_LABELS, normalizeProfile } from "../../data/profile";
import { routingOptions } from "../../config/accessRequirements";
import type { OrsProfileKey } from "../../config/routing";

interface ProfileDrawerProps {
  profile: UserProfile;
  onSave: (profile: UserProfile) => Promise<void>;
  onClose: () => void;
  signedIn?: boolean;
}

const ROUTING_LABELS: Record<OrsProfileKey, string> = {
  wheelchair:  "Wheelchair (ORS wheelchair profile)",
  "foot-walk": "Foot — regular walking",
  "foot-hike": "Foot — hiking / off-path",
  cycling: "Bicycle",
};

export function ProfileDrawer({ profile, onSave, onClose, signedIn = false }: ProfileDrawerProps) {
  const [draft, setDraft] = useState<UserProfile>(() => normalizeProfile(profile));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  let limitation = "";
  try { routingOptions(draft); } catch (reason) { limitation = reason instanceof Error ? reason.message : "Unsupported requirements."; }

  const set = <K extends keyof UserProfile>(key: K, val: UserProfile[K]) =>
    setDraft((prev) => ({ ...prev, [key]: val }));

  const handleAidChange = (aid: Exclude<MobilityAid, "none">) => {
    setDraft(prev => {
      const aids = prev.mobilityAids ?? [];
      const mobilityAids = aids.includes(aid) ? aids.filter(value => value !== aid) : [...aids, aid];
      return { ...prev, mobilityAids, mobilityAid: mobilityAids[0] ?? "none" };
    });
  };

  return (
    <dialog ref={dialog} className="profile-drawer account-dialog" aria-labelledby="profile-title" onCancel={onClose}>
      <div className="profile-drawer__header">
        <h2 id="profile-title">Mobility profile</h2>
        <button className="btn" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <p className="profile-drawer__hint">
        {signedIn ? "Private account preferences. Changes are saved to your account." : "Guest preferences are stored only in this browser."}
      </p>

      <form onSubmit={async event => {
        event.preventDefault();
        setSaving(true); setError("");
        try { await onSave(draft); onClose(); }
        catch { setError("Profile could not be saved. Your changes are still here; please retry."); }
        finally { setSaving(false); }
      }}>
      <fieldset disabled={saving} className="account-fields">

      <div className="form-field">
        <label htmlFor="profile-name">Display name (optional)</label>
        <input
          id="profile-name"
          type="text"
          maxLength={100}
          value={draft.displayName}
          onChange={(e) => set("displayName", e.target.value)}
          placeholder="e.g. Alex"
        />
      </div>

      <fieldset className="profile-drawer__fieldset">
        <legend>Mobility aids (optional)</legend>
        {(Object.keys(MOBILITY_AID_LABELS) as MobilityAid[]).filter((aid): aid is Exclude<MobilityAid, "none"> => aid !== "none").map((aid) => (
          <label key={aid} className="profile-drawer__radio">
            <input
              type="checkbox"
              name="mobilityAid"
              value={aid}
              checked={draft.mobilityAids?.includes(aid) ?? false}
              onChange={() => handleAidChange(aid)}
            />
            {MOBILITY_AID_LABELS[aid]}
          </label>
        ))}
      </fieldset>

      <fieldset className="profile-drawer__fieldset">
        <legend>Travel mode</legend>
        {(Object.keys(ROUTING_LABELS) as OrsProfileKey[]).map((p) => (
          <label key={p} className="profile-drawer__radio">
            <input
              type="radio"
              name="routingProfile"
              value={p}
              checked={draft.routingProfile === p}
              onChange={() => set("routingProfile", p)}
            />
            {ROUTING_LABELS[p]}
          </label>
        ))}
      </fieldset>

      <fieldset className="profile-drawer__fieldset">
        <legend>Access requirements</legend>
        {([
          ["avoidStairs",        "No stairs"],
          ["requireStepFree",    "Flush crossings (no raised curbs)"],
          ["avoidSteepSlopes",   "Slope at most 3%"],
          ["avoidRoughSurfaces", "Smooth surfaces only"],
          ["avoidConstruction",  "No active construction"],
        ] as [keyof UserProfile, string][]).map(([key, label]) => (
          <label key={key} className="profile-drawer__check">
            <input
              type="checkbox"
              checked={draft[key] as boolean}
              onChange={(e) => set(key, e.target.checked as UserProfile[typeof key])}
            />
            {label}
          </label>
        ))}
      </fieldset>

      <div className="form-field">
        <label htmlFor="minimum-width">Minimum path width (meters, optional)</label>
        <input id="minimum-width" type="number" min="0.1" max="5" step="0.1" value={draft.minimumWidthM ?? ""}
          onChange={event => set("minimumWidthM", event.target.value === "" ? null : event.target.valueAsNumber)} />
      </div>
      <div className="form-field">
        <label htmlFor="maximum-incline">Maximum incline (%, optional)</label>
        <select id="maximum-incline" value={draft.maximumInclinePercent ?? ""}
          onChange={event => set("maximumInclinePercent", event.target.value === "" ? null : Number(event.target.value))}>
          <option value="">Provider default</option>
          {[3, 6, 10, 15].map(limit => <option key={limit} value={limit}>{limit}%</option>)}
          {draft.maximumInclinePercent != null && ![3, 6, 10, 15].includes(draft.maximumInclinePercent)
            && <option value={draft.maximumInclinePercent}>{draft.maximumInclinePercent}% (unsupported)</option>}
        </select>
      </div>
      {limitation && <p className="route-panel__warning" role="status">{limitation}</p>}
      <p className="profile-drawer__hint">Requirements apply to mapped data; unknown or outdated barriers may remain. Walking does not imply stair access. Width, incline and surface filters require the wheelchair routing profile.</p>
      {error && <p role="alert">{error}</p>}

      <div className="form-actions" style={{ marginTop: 16 }}>
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn--primary" type="submit">{saving ? "Saving..." : "Save profile"}</button>
      </div>
      </fieldset>
      </form>
    </dialog>
  );
}
