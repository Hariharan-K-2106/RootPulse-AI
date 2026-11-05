import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, ArrowRight, Check, CloudRain, Droplets, Info, MapPin, Sprout, Thermometer, Umbrella, Wind } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { getProgressCrops, requestIrrigationRecommendation, type IrrigationRecommendation, type ProgressCrop } from "../services/api";

const crops = ["Tomato", "Potato", "Rice", "Maize"];
const stages = ["Seedling", "Vegetative", "Flowering", "Fruiting", "Maturity"];
const soilTypes = ["Sandy", "Loamy", "Clay", "Silt"];

export default function IrrigationAdvisor() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [savedCrops, setSavedCrops] = useState<ProgressCrop[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profilesError, setProfilesError] = useState("");
  const [cropName, setCropName] = useState("");
  const [growthStage, setGrowthStage] = useState("");
  const [soilType, setSoilType] = useState("");
  const [moisture, setMoisture] = useState("");
  const [location, setLocation] = useState("");
  const [fieldSize, setFieldSize] = useState("");
  const [fieldSizeUnit, setFieldSizeUnit] = useState<"hectares" | "acres">("hectares");
  const [notes, setNotes] = useState("");
  const [recommendation, setRecommendation] = useState<IrrigationRecommendation | null>(null);
  const [weatherState, setWeatherState] = useState<"idle" | "loading" | "available" | "unavailable" | "error">("idle");
  const [weatherMessage, setWeatherMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    getProgressCrops()
      .then((items) => {
        if (!active) return;
        setSavedCrops(items);
        // Reuse the farmer's first saved crop so they do not need to enter it again.
        if (items.length) {
          setSelectedProfileId(String(items[0].id));
          setCropName(items[0].crop_name);
        }
      })
      .catch(() => {
        if (active) setProfilesError("Saved crop profiles could not be loaded. You can still enter crop details manually.");
      })
      .finally(() => { if (active) setProfilesLoading(false); });
    return () => { active = false; };
  }, []);

  function selectSavedProfile(value: string) {
    setSelectedProfileId(value);
    const selected = savedCrops.find((crop) => String(crop.id) === value);
    if (selected) setCropName(selected.crop_name);
    clearRecommendation();
  }

  function clearRecommendation() {
    setRecommendation(null);
    setFormError("");
  }

  function updateLocation(value: string) {
    setLocation(value);
    setRecommendation(null);
    setFormError("");
    setWeatherMessage("");
    setWeatherState("idle");
  }

  async function submitAdvice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setRecommendation(null);
    setFormError("");
    setWeatherMessage("");
    setWeatherState(location.trim() ? "loading" : "unavailable");
    try {
      const result = await requestIrrigationRecommendation({
        crop_name: cropName || null,
        growth_stage: growthStage || null,
        soil_type: soilType || null,
        soil_moisture: moisture === "" ? null : Number(moisture),
        location: location.trim() || null,
        field_size: fieldSize === "" ? null : Number(fieldSize),
        field_size_unit: fieldSizeUnit,
        notes: notes.trim() || null,
      });
      setRecommendation(result);
      setWeatherMessage(result.weather_message || "");
      if (result.weather_status === "available") setWeatherState("available");
      else if (result.weather_status === "error") setWeatherState("error");
      else setWeatherState("unavailable");
    } catch (error) {
      const responseMessage = error && typeof error === "object" && "response" in error
        ? (error.response as { data?: { error?: string } })?.data?.error
        : undefined;
      const message = responseMessage || "The advisory service could not be reached. Check that the backend is running and try again.";
      setFormError(message);
      setWeatherMessage(message);
      setWeatherState("error");
    } finally {
      setIsSubmitting(false);
    }
  }

  const statusLabel = recommendation?.status === "irrigate"
    ? "Irrigate"
    : recommendation?.status === "wait"
      ? "Wait"
      : "Review conditions";
  const statusClass = recommendation ? " " + recommendation.status : "";
  const currentMoisture = moisture === "" ? 0 : Math.min(100, Math.max(0, Number(moisture) || 0));
  const cropOptions = Array.from(new Set([...crops, ...savedCrops.map((crop) => crop.crop_name)]));

  return <div className="app-shell"><Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} /><main className="main-area"><Topbar pageTitle="Irrigation Advisor" onMenu={() => setMenuOpen(true)} /><div className="dashboard-content irrigation-content">
    <header className="irrigation-page-heading"><div><span className="eyebrow irrigation-eyebrow">WATER MANAGEMENT</span><h1>Irrigation Advisor</h1><p>Make informed watering decisions using crop conditions, soil moisture, and weather.</p></div><span className="advisor-badge"><Droplets size={15} /> FIELD ADVISORY</span></header>
    {profilesLoading ? <div className="farm-profile-note"><Info size={15} /><span>Checking your saved crop profiles…</span></div>
      : savedCrops.length > 0 ? <div className="farm-profile-note"><Info size={15} /><span>Saved crop profiles are connected. Select one below to prefill its crop; growth stage, soil type, location, and moisture still need to be entered for this advisory.</span></div>
        : <div className="farm-profile-note"><Info size={15} /><span>{profilesError || "No saved crop profiles yet. You can enter the crop details below and save a crop in Crop Progress for future use."}</span></div>}

    <form className="irrigation-grid" onSubmit={submitAdvice}>
      <section className="panel irrigation-input-panel" aria-labelledby="field-details-title">
        <div className="panel-heading"><div><span className="eyebrow">FIELD CONTEXT</span><h2 id="field-details-title">Farm and crop details</h2></div><span className="irrigation-step">01</span></div>
        <div className="irrigation-fields">
          {savedCrops.length > 0 && <label className="location-field">Saved crop profile <span className="optional-label">Optional</span>
            <select value={selectedProfileId} onChange={(event) => selectSavedProfile(event.target.value)}>
              <option value="">Enter details manually</option>
              {savedCrops.map((crop) => <option key={crop.id} value={crop.id}>{crop.crop_name}{crop.field_name ? ` · ${crop.field_name}` : ""}</option>)}
            </select>
            <small>Selecting a profile fills the crop type only. Other advisory inputs are not stored in the crop profile.</small>
          </label>}
          <label>Crop
            <select value={cropName} onChange={(event) => { setCropName(event.target.value); clearRecommendation(); }}>
              <option value="">Choose a crop</option>{cropOptions.map((crop) => <option key={crop}>{crop}</option>)}
            </select>
          </label>
          <label>Growth stage
            <select value={growthStage} onChange={(event) => { setGrowthStage(event.target.value); clearRecommendation(); }}>
              <option value="">Choose a stage</option>{stages.map((stage) => <option key={stage}>{stage}</option>)}
            </select>
          </label>
          <label>Soil type
            <select value={soilType} onChange={(event) => { setSoilType(event.target.value); clearRecommendation(); }}>
              <option value="">Choose soil type</option>{soilTypes.map((soil) => <option key={soil}>{soil}</option>)}
            </select>
          </label>
          <label className="location-field">Field location <span className="optional-label">For local weather</span>
            <span className="location-input-wrap"><MapPin size={16} /><input value={location} onChange={(event) => updateLocation(event.target.value)} placeholder="City or latitude, longitude" autoComplete="address-level2" /></span>
            <small>Open-Meteo weather is looked up when you request an advisory.</small>
          </label>
          <label>Field size <span className="optional-label">Optional</span>
            <span className="field-size-input"><input type="number" min="0.01" step="any" value={fieldSize} onChange={(event) => { setFieldSize(event.target.value); clearRecommendation(); }} placeholder="e.g. 1.5" /><select aria-label="Field size units" value={fieldSizeUnit} onChange={(event) => { setFieldSizeUnit(event.target.value as "hectares" | "acres"); clearRecommendation(); }}><option value="hectares">hectares</option><option value="acres">acres</option></select></span>
          </label>
        </div>
      </section>

      <section className="panel soil-panel" aria-labelledby="soil-title">
        <div className="panel-heading"><div><span className="eyebrow">MANUAL FIELD READING</span><h2 id="soil-title">Soil moisture</h2></div><span className="soil-icon"><Droplets size={17} /></span></div>
        <label htmlFor="moisture-input" className="moisture-label">Manually entered soil moisture</label>
        <div className="moisture-entry"><input id="moisture-input" type="number" min="0" max="100" step="1" inputMode="numeric" value={moisture} onChange={(event) => { setMoisture(event.target.value); clearRecommendation(); }} placeholder="—" /><span>%</span><span className="manual-tag">MANUAL</span></div>
        <input className="moisture-slider" type="range" min="0" max="100" step="1" value={currentMoisture} aria-label="Manually entered soil moisture percentage" onChange={(event) => { setMoisture(event.target.value); clearRecommendation(); }} />
        <div className="moisture-scale"><span>0% · Dry</span><span>100% · Wet</span></div>
        <div className="moisture-status-line"><span>Status</span><strong className={recommendation ? "moisture-status " + recommendation.moisture_status : "moisture-status"}>
          {recommendation ? recommendation.moisture_status.charAt(0).toUpperCase() + recommendation.moisture_status.slice(1) : moisture === "" ? "Enter a value" : "Request an advisory"}
        </strong></div>
        <div className="moisture-meter" role="img" aria-label={moisture === "" ? "No soil moisture value entered" : "Manually entered soil moisture " + moisture + " percent"}><span style={{ width: moisture === "" ? "0%" : currentMoisture + "%" }} /></div>
        {recommendation?.illustrative_thresholds && <p className="threshold-live">Illustrative for {growthStage}: Low below {recommendation.illustrative_thresholds.low_below_pct}%, high at or above {recommendation.illustrative_thresholds.high_at_or_above_pct}%.</p>}
        <p className="threshold-note"><Info size={14} />Thresholds are illustrative and need crop-specific validation. This value is not sensor data.</p>
        <label className="notes-label">Optional field notes <span className="optional-label">Context only</span>
          <textarea rows={2} value={notes} onChange={(event) => { setNotes(event.target.value); clearRecommendation(); }} placeholder="Anything else you noticed in the field?" />
        </label>
      </section>

      <section className="panel weather-card" aria-labelledby="weather-title" aria-live="polite">
        <div className="panel-heading"><div><span className="eyebrow">LOCAL WEATHER</span><h2 id="weather-title">Forecast</h2></div><span className="weather-source">OPEN-METEO</span></div>
        {weatherState === "loading" ? <div className="weather-state"><span className="weather-loading" /><div><strong>Loading local forecast</strong><p>Looking up the location and next 24 hours.</p></div></div>
          : weatherState === "available" && recommendation?.weather ? <div className="weather-data">
            <div className="weather-location"><MapPin size={14} />{recommendation.weather.location}<span>LIVE FORECAST</span></div>
            <div className="weather-metrics"><div><span><Thermometer size={15} /> Temperature</span><strong>{recommendation.weather.temperature_c}°C</strong></div><div><span><Droplets size={15} /> Humidity</span><strong>{recommendation.weather.humidity_pct}%</strong></div><div><span><Umbrella size={15} /> Rain next 24h</span><strong>{recommendation.weather.rainfall_next_24h_mm} mm</strong></div></div>
            <div className="rain-probability"><CloudRain size={15} /><span>Peak precipitation probability</span><strong>{recommendation.weather.precipitation_probability_max_pct === null ? "Unavailable" : recommendation.weather.precipitation_probability_max_pct + "%"}</strong></div>
            <small className="forecast-time">Forecast time: {recommendation.weather.forecast_timestamp} ({recommendation.weather.timezone})</small>
          </div> : weatherState === "error" || weatherState === "unavailable" ? <div className={"weather-state " + (weatherState === "error" ? "weather-error" : "")}><span className="weather-state-icon"><AlertCircle size={18} /></span><div><strong>{weatherState === "error" ? "Weather unavailable" : location.trim() ? "Forecast not loaded" : "Add a field location"}</strong><p>{weatherMessage || (location.trim() ? "Request an advisory to load the local forecast." : "Enter a city or coordinates. Weather will be loaded when you request an advisory.")}</p></div></div>
          : <div className="weather-state"><span className="weather-state-icon"><Wind size={18} /></span><div><strong>Weather is not loaded</strong><p>Enter a city or coordinates, then request an advisory to fetch live weather.</p></div></div>}
        <p className="weather-attribution">Forecast from Open-Meteo. Weather is location-based and may not reflect conditions at your exact field.</p>
      </section>

      <section className={"panel recommendation-card" + statusClass} aria-labelledby="recommendation-title" aria-live="polite">
        <div className="panel-heading"><div><span className="eyebrow">TRANSPARENT RULES</span><h2 id="recommendation-title">Irrigation recommendation</h2></div>{recommendation && <span className={"recommendation-status" + statusClass}>{statusLabel}</span>}</div>
        {!recommendation ? <div className="recommendation-empty"><span className="recommendation-icon"><Sprout size={20} /></span><div><strong>Your field advisory will appear here</strong><p>Enter field details and manually recorded soil moisture. Weather is checked when you request an advisory.</p></div></div> : <div className="recommendation-body">
          <div className="recommendation-summary"><span className={"recommendation-icon" + statusClass}>{recommendation.status === "irrigate" ? <Droplets size={20} /> : recommendation.status === "wait" ? <Check size={20} /> : <Info size={20} />}</span><div><strong>{recommendation.explanation}</strong><p>{recommendation.next_action}</p></div></div>
          {recommendation.input_factors.length > 0 && <div className="factor-list"><span>Inputs considered</span>{recommendation.input_factors.map((factor) => <div key={factor.label}><span>{factor.label}</span><strong>{factor.value}</strong><small>{factor.role}</small></div>)}</div>}
          <p className="recommendation-disclaimer">{recommendation.threshold_note}</p>
        </div>}
        {formError && <p className="irrigation-error" role="alert"><AlertCircle size={15} />{formError}</p>}
        <button className="recommendation-button" type="submit" disabled={isSubmitting}>{isSubmitting ? <><span className="weather-loading" /> Checking field conditions…</> : <>Get irrigation advisory <ArrowRight size={16} /></>}</button>
      </section>

      {recommendation?.rain_smart_alert && <section className="rain-smart-alert" role="status"><span><CloudRain size={20} /></span><div><strong>{recommendation.rain_smart_alert.title}</strong><p>{recommendation.rain_smart_alert.message}</p></div></section>}
    </form>
    <p className="irrigation-footnote">Initial advisory for planning only. Confirm field conditions directly; moisture thresholds and rain alerts are illustrative, not validated crop-specific recommendations.</p>
  </div></main></div>;
}
