import { useEffect, useState } from "react";
import { ArrowRight, Droplets, Leaf, MapPin, MessageCircle, Sprout } from "lucide-react";
import { Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { getProgressSummary, type ProgressSummary } from "../services/api";
import { usePreferences } from "../preferences/PreferencesContext";

const farmPhotos = [
  {
    src: "/images/farm-story/tamil-nadu-paddy.jpg",
    alt: "Wide green paddy fields beneath a bright sky in Tamil Nadu",
    title: "Tamil Nadu paddy fields",
    credit: "Jperiapandi · CC BY-SA 4.0",
    source: "https://commons.wikimedia.org/wiki/File:Paddy_field_in_Tamil_Nadu_India.jpg",
  },
  {
    src: "/images/farm-story/indian-paddy-farmer.jpg",
    alt: "An Indian farmer planting rice seedlings in a flooded paddy field",
    title: "Rice planting, India",
    credit: "Alex Jaison · Pexels",
    source: "https://www.pexels.com/photo/indian-farmer-working-in-paddy-field-29039798/",
  },
  {
    src: "/images/farm-story/indian-vegetable-farm.jpg",
    alt: "A farmer tending a vegetable plot in rural India",
    title: "Vegetable growing",
    credit: "Shubham Thakur · Pexels",
    source: "https://www.pexels.com/photo/landscape-nature-hand-village-9517802/",
  },
  {
    src: "/images/farm-story/indian-seedlings.jpg",
    alt: "A woman farmer caring for young seedlings in a protected nursery",
    title: "Growing from seedlings",
    credit: "EqualStock IN · Pexels",
    source: "https://www.pexels.com/photo/farmers-in-india-20515651/",
  },
  {
    src: "/images/farm-story/world-rice-field.jpg",
    alt: "A farmer and water buffalo working in a green rice terrace in Indonesia",
    title: "Rice terraces, Indonesia",
    credit: "Tuti Isnawati · Pexels",
    source: "https://www.pexels.com/photo/farmer-with-water-buffalo-in-scenic-rice-field-40611636/",
  },
];

const farmQuotes = [
  "Grow with care. Harvest with hope.",
  "Healthy soil is the start of a healthy season.",
];

const features = [
  { href: "/crop-analysis", icon: Leaf, title: "Crop health analysis", text: "Upload a crop photo for the connected image analysis." },
  { href: "/irrigation-advisor", icon: Droplets, title: "Irrigation advisor", text: "Get a transparent advisory using crop details, manual moisture, and local weather." },
  { href: "/crop-progress", icon: Sprout, title: "Crop progress", text: "Save dated crop photos and field observations." },
  { href: "/ask-your-crop", icon: MessageCircle, title: "Ask Your Crop", text: "Ask farming questions in English, Tamil, or Hindi." },
];

function FarmPhotoTrack({ duplicate = false }: { duplicate?: boolean }) {
  const slides = [
    { type: "photo" as const, photo: farmPhotos[0] },
    { type: "quote" as const, quote: farmQuotes[0] },
    { type: "photo" as const, photo: farmPhotos[1] },
    { type: "photo" as const, photo: farmPhotos[2] },
    { type: "quote" as const, quote: farmQuotes[1] },
    { type: "photo" as const, photo: farmPhotos[3] },
    { type: "photo" as const, photo: farmPhotos[4] },
  ];
  return <div className="farm-photo-track" aria-hidden={duplicate || undefined}>
    {slides.map((slide, index) => slide.type === "photo"
      ? <figure className="farm-photo-card" key={`${duplicate ? "copy-" : ""}${slide.photo.src}`}>
          <img src={slide.photo.src} alt={duplicate ? "" : slide.photo.alt} loading={duplicate || index > 1 ? "lazy" : "eager"} />
          <figcaption><strong>{slide.photo.title}</strong></figcaption>
        </figure>
      : <article className="farm-quote-card" key={`${duplicate ? "copy-" : ""}quote-${index}`} aria-label={duplicate ? undefined : slide.quote}>
          <span aria-hidden="true">“</span><blockquote>{slide.quote}</blockquote>
        </article>)}
  </div>;
}

export default function Dashboard() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [summaryError, setSummaryError] = useState("");
  const [loading, setLoading] = useState(true);
  const { t } = usePreferences();

  useEffect(() => {
    let active = true;
    getProgressSummary()
      .then((result) => { if (active) setSummary(result); })
      .catch(() => { if (active) setSummaryError("Your farm summary could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return <div className="app-shell"><Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} /><main className="main-area"><Topbar onMenu={() => setMenuOpen(true)} /><div className="dashboard-content">
    <section className="welcome-card"><div className="welcome-copy"><div className="eyebrow"><span className="live-dot" /> {t("YOUR FARM, AT A GLANCE")}</div><h1>{t("Good morning,")}<br/><em>{t("let’s grow well.")}</em></h1><p>{t("Welcome to RootPulse AI. Your farm dashboard brings your crop records and field tools together.")}</p><a className="primary-button" href="#tools">{t("Explore farm tools")} <ArrowRight size={17} /></a></div><div className="welcome-art"><img className="welcome-logo-image" src="/images/rootpulse-ai-logo.png" alt="RootPulse AI — Smart Irrigation. Thriving Farms." /></div><div className="welcome-stamp"><Sprout size={14}/> {t("Your farm workspace")}</div></section>

    <div className="section-heading"><div><span className="eyebrow">{t("YOUR FARM SNAPSHOT")}</span><h2>{t("At a glance")}</h2></div></div>
    {summaryError && <div className="dashboard-error" role="alert">{t(summaryError)}</div>}
    <section className="metrics-grid">
      <article className="metric-card"><div className="metric-top"><span>{t("Crop profiles")}</span><span className="metric-icon green"><Sprout size={17}/></span></div><div className="metric-value">{loading ? "—" : String(summary?.crop_count ?? 0).padStart(2, "0")} <small>{t("saved")}</small></div><div className="metric-note">{t("Your saved crop records")}</div></article>
      <article className="metric-card"><div className="metric-top"><span>{t("Named fields")}</span><span className="metric-icon blue"><MapPin size={17}/></span></div><div className="metric-value">{loading ? "—" : String(summary?.field_count ?? 0).padStart(2, "0")} <small>{t("fields")}</small></div><div className="metric-note">{t("From your crop profiles")}</div></article>
      <article className="metric-card"><div className="metric-top"><span>{t("Progress photos")}</span><span className="metric-icon yellow"><Leaf size={17}/></span></div><div className="metric-value">{loading ? "—" : String(summary?.progress_photo_count ?? 0).padStart(2, "0")} <small>{t("saved")}</small></div><div className="metric-note">{t("Uploaded field observations")}</div></article>
      <article className="metric-card"><div className="metric-top"><span>{t("Soil moisture")}</span><span className="metric-icon pale"><Droplets size={17}/></span></div><div className="metric-value metric-word">{t("Manual")} <small>{t("entry")}</small></div><div className="metric-note">{t("Enter correct readings")}</div></article>
    </section>

    <section className="farm-story" aria-labelledby="farm-story-title">
      <div className="farm-story-heading"><div><span className="eyebrow">{t("ROOTED IN THE FIELDS WE SERVE")}</span><h2 id="farm-story-title">{t("Farming, from India and across the world")}</h2><p>{t("Every field has its own rhythm. Keep yours moving forward with RootPulse AI.")}</p></div><span className="farm-story-mark"><Sprout size={20}/> {t("Fields in focus")}</span></div>
      <div className="farm-photo-marquee" aria-label="A moving gallery of Indian farms and farmers">
        <div className="farm-photo-loop"><FarmPhotoTrack/><FarmPhotoTrack duplicate/></div>
      </div>
      <details className="farm-story-credits"><summary>{t("Photo credits and licenses")}</summary><ul>{farmPhotos.map((photo) => <li key={photo.src}><a href={photo.source} target="_blank" rel="noreferrer">{photo.title}</a> — {photo.credit}{photo.credit.includes("CC BY-SA") && <> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a></>}</li>)}</ul></details>
    </section>

    <section className="tools-section" id="tools"><div className="panel-heading tools-heading"><div><span className="eyebrow">ROOTPULSE AI</span><h2>{t("Farm tools")}</h2><p>{t("Open a tool to add observations or request guidance for your farm.")}</p></div></div><div className="feature-grid">{features.map(({ href, icon: Icon, title, text }) => <Link className="feature-card feature-link" to={href} key={title}><div className="feature-icon"><Icon size={19}/></div><div><div className="feature-title">{t(title)}</div><p>{t(text)}</p></div><ArrowRight className="feature-arrow" size={17}/></Link>)}</div></section>
    <footer className="page-footer"><span><span className="footer-mark"><Sprout size={15}/></span> RootPulse AI</span><span>{t("Smart Irrigation. Thriving Farms.")}</span><span>GP-02</span></footer>
  </div></main></div>;
}
