import { Activity, BarChart3, Droplets, Leaf, MessageCircle, Sprout, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { usePreferences } from "../preferences/PreferencesContext";

const items: Array<{ label: string; icon: typeof BarChart3; to?: string; soon?: boolean }> = [
  { label: "Dashboard", icon: BarChart3, to: "/" },
  { label: "Crop Analysis", icon: Leaf, to: "/crop-analysis" },
  { label: "Irrigation Advisor", icon: Droplets, to: "/irrigation-advisor" },
  { label: "Crop Progress", icon: Activity, to: "/crop-progress" },
  { label: "Ask Your Crop", icon: MessageCircle, to: "/ask-your-crop" },
];

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = usePreferences();
  return <><button aria-label="Close navigation" onClick={onClose} className={`sidebar-backdrop ${open ? "visible" : ""}`} /><aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
    <div className="brand"><div className="brand-mark"><Sprout size={25} /></div><div><strong>RootPulse<span> AI</span></strong><small>PRECISION AGRICULTURE</small></div><button className="icon-button mobile-close" aria-label="Close menu" onClick={onClose}><X size={20} /></button></div>
    <div className="farm-label">{t("Workspace")}</div><nav className="nav-list">{items.map(({ label, icon: Icon, to, soon }) => {
      const content = <><Icon size={19} strokeWidth={1.8} /><span>{t(label)}</span>{soon && <span className="nav-soon">Soon</span>}</>;
      return to ? <NavLink key={label} to={to} onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>{content}</NavLink> : <div key={label} className="nav-item nav-disabled" aria-disabled="true" title="Planned for a future step">{content}</div>;
    })}</nav>
    <div className="sidebar-bottom"><div className="sidebar-tip"><div className="tip-icon"><Sprout size={18} /></div><strong>Grow with confidence</strong><p>Your field insights, all in one place.</p><span>More tools coming soon</span></div><div className="sidebar-foot">ROOTPULSE AI</div></div>
  </aside></>;
}
