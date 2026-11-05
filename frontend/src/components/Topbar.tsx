import { Globe2, LogOut, Menu, Moon, Sun, Monitor } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { usePreferences, type AppLanguage, type ThemePreference } from "../preferences/PreferencesContext";

export default function Topbar({ onMenu, pageTitle = "Dashboard" }: { onMenu: () => void; pageTitle?: string }) {
  const { user, logout } = useAuth();
  const { language, setLanguage, theme, setTheme, t } = usePreferences();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  async function signOut() {
    setLogoutError("");
    try { await logout(); navigate("/login", { replace: true }); }
    catch { setLogoutError("Could not log out. Check your connection and try again."); }
  }
  const initials = user?.full_name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "F";
  const ThemeIcon = theme === "dark" ? Moon : theme === "system" ? Monitor : Sun;
  return <header className="topbar">
    <button className="icon-button menu-button" aria-label="Open navigation" onClick={onMenu}><Menu size={22} /></button>
    <div className="crumb"><span>{t("Workspace")}</span><b>/</b><strong>{t(pageTitle)}</strong></div>
    <div className="top-actions">
      <label className="preference-select" title={t("Theme")}><span className="sr-only">{t("Theme")}</span><ThemeIcon size={15}/><select aria-label={t("Theme")} value={theme} onChange={(event) => setTheme(event.target.value as ThemePreference)}><option value="system">{t("System")}</option><option value="light">{t("Light")}</option><option value="dark">{t("Dark")}</option></select></label>
      <label className="preference-select language-preference" title={t("Language")}><Globe2 size={15}/><span className="sr-only">{t("Language")}</span><select aria-label={t("Language")} value={language} onChange={(event) => setLanguage(event.target.value as AppLanguage)}><option value="en">English</option><option value="ta">தமிழ்</option><option value="hi">हिन्दी</option></select></label>
      <div className="account-menu">
        <button type="button" className="user-pill" aria-expanded={accountOpen} aria-haspopup="dialog" onClick={() => setAccountOpen((open) => !open)}>
          <div className="avatar">{initials}</div><div><strong>{user?.full_name || "Farmer"}</strong><small>@{user?.username || "grower"}</small></div>
        </button>
        {accountOpen && <section className="account-popover" role="dialog" aria-label={t("Account details")}>
          <strong className="account-popover-title">{t("Account details")}</strong>
          <div><span>{t("Name")}</span><b>{user?.full_name || "—"}</b></div>
          <div><span>{t("Username")}</span><b>@{user?.username || "—"}</b></div>
          <div><span>{t("Mobile number")}</span><b>{user?.phone?.trim() || t("Nil")}</b></div>
        </section>}
      </div>
      <button type="button" className="logout-button" onClick={() => void signOut()} aria-label={t("Log out")} title={t("Log out")}><LogOut size={17}/><span>{t("Log out")}</span></button>
      {logoutError && <span className="logout-error" role="alert">{logoutError}</span>}
    </div>
  </header>;
}
