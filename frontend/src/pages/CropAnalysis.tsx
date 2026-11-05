import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, FileImage, ImagePlus, Info, Leaf, LoaderCircle, RefreshCw, ShieldCheck, Sparkles, Trash2, UploadCloud } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { analyzeCrop, getRecentCropAnalyses, type AnalyzeResponse, type RecentCropAnalysis } from "../services/api";

const cropOptions = ["Tomato", "Potato", "Rice", "Maize"];
const maxFileSize = 10 * 1024 * 1024;
const allowedExtensions = [".jpg", ".jpeg", ".png"];

const statusLabels = {
  healthy: "Healthy",
  possible_issue: "Possible issue",
  uncertain: "Uncertain result",
  unsupported_crop: "Crop unsupported",
};

export default function CropAnalysis() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [cropName, setCropName] = useState(cropOptions[0]);
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [validationMessage, setValidationMessage] = useState("");
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<RecentCropAnalysis[]>([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(true);
  const [recentError, setRecentError] = useState("");
  const [requestError, setRequestError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!image) {
      setPreviewUrl("");
      return;
    }
    const objectUrl = URL.createObjectURL(image);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [image]);

  useEffect(() => {
    let active = true;
    getRecentCropAnalyses()
      .then((records) => { if (active) setRecentAnalyses(records); })
      .catch(() => { if (active) setRecentError("Analysis history could not be loaded. Refresh the page and try again."); })
      .finally(() => { if (active) setIsLoadingRecent(false); });
    return () => { active = false; };
  }, []);

  function chooseImage(file?: File) {
    if (!file) return;
    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!allowedExtensions.includes(extension) || (file.type && !["image/jpeg", "image/png"].includes(file.type))) {
      setValidationMessage("Choose a JPG, JPEG, or PNG image.");
      return;
    }
    if (file.size > maxFileSize) {
      setValidationMessage("This image is larger than 10 MB. Choose a smaller image.");
      return;
    }
    setImage(file);
    setAnalysis(null);
    setRequestError("");
    setValidationMessage("");
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    chooseImage(event.target.files?.[0]);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    chooseImage(event.dataTransfer.files[0]);
  }

  async function onAnalyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!image || isAnalyzing) return;
    setIsAnalyzing(true);
    setAnalysis(null);
    setRequestError("");
    try {
      const result = await analyzeCrop(image, cropName);
      setAnalysis(result);
      try {
        setRecentAnalyses(await getRecentCropAnalyses());
        setRecentError("");
      } catch {
        setRecentError("The report was created, but recent history could not be refreshed.");
      }
    } catch (error) {
      const responseMessage = error && typeof error === "object" && "response" in error
        ? (error.response as { data?: { message?: string } })?.data?.message
        : undefined;
      setRequestError(responseMessage || "We couldn’t reach the analysis service. Check that the backend is running and try again.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function clearImage() {
    setImage(null);
    setAnalysis(null);
    setRequestError("");
    setValidationMessage("");
  }

  function openSavedAnalysis(record: RecentCropAnalysis) {
    setAnalysis(record);
    setCropName(record.crop_name);
    setRequestError("");
    document.getElementById("analysis-result-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function formatAnalysisDate(value: string) {
    const date = new Date(value.replace(" ", "T"));
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  const analysisTone = analysis ? " result-" + analysis.status : "";
  const stateLabel = analysis ? statusLabels[analysis.status] : requestError ? "Request failed" : "Waiting for photo";

  return <div className="app-shell"><Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} /><main className="main-area"><Topbar pageTitle="Crop Analysis" onMenu={() => setMenuOpen(true)} /><div className="dashboard-content crop-analysis-content">
    <header className="crop-page-heading"><div><span className="eyebrow crop-heading-eyebrow">FIELD TOOL</span><h1>Crop Analysis</h1><p>Upload a crop photo to check its visible health and identify possible issues.</p></div><span className="ai-badge"><Sparkles size={14} /> AI analysis</span></header>

    <form className="analysis-layout" onSubmit={onAnalyze}>
      <section className="panel upload-panel" aria-labelledby="upload-title">
        <div className="panel-heading"><div><span className="eyebrow">START AN ANALYSIS</span><h2 id="upload-title">Crop photo</h2></div><span className="step-count">01</span></div>
        <label className="crop-select-label" htmlFor="crop-select">Select your crop</label>
        <select id="crop-select" className="crop-select" value={cropName} onChange={(event) => { setCropName(event.target.value); setAnalysis(null); setRequestError(""); }}>
          {cropOptions.map((crop) => <option key={crop} value={crop}>{crop}</option>)}
        </select>
        <p className="supported-crops-note">Model coverage: tomato, potato, and maize. Rice is not supported yet.</p>

        {!image ? <label htmlFor="crop-image" className={"upload-dropzone" + (isDragging ? " dragging" : "")} onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={onDrop}>
          <input ref={fileInput} id="crop-image" className="visually-hidden-input" type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" onChange={onFileChange} />
          <span className="upload-icon"><UploadCloud size={25} /></span><strong>Drop your crop photo here</strong><span className="upload-support">or <u>browse files</u> on your device</span><small>JPG, JPEG, PNG · Up to 10 MB</small>
        </label> : <div className="image-preview-wrap">
          <div className="preview-image-box"><img src={previewUrl} alt={"Selected " + cropName + " crop preview"} /></div>
          <div className="preview-caption"><div><FileImage size={16} /><span><strong>{image.name}</strong><small>{(image.size / (1024 * 1024)).toFixed(2)} MB</small></span></div><div className="preview-actions"><button type="button" className="preview-action" onClick={() => fileInput.current?.click()}><RefreshCw size={14} /> Replace</button><button type="button" className="preview-action remove" onClick={clearImage}><Trash2 size={14} /> Remove</button></div></div>
          <input ref={fileInput} id="crop-image" className="visually-hidden-input" type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" onChange={onFileChange} />
        </div>}

        {validationMessage && <p className="upload-validation" role="alert"><AlertCircle size={15} />{validationMessage}</p>}
        <div className="upload-helper"><ShieldCheck size={15} /><span>Models are trained on public leaf-image data and are not a substitute for an agronomist.</span></div>
        <button className="analyze-button" type="submit" disabled={!image || isAnalyzing}>{isAnalyzing ? <><LoaderCircle size={17} className="spin" /> Analyzing image…</> : <><ImagePlus size={17} /> Analyze Crop <ArrowRight size={16} /></>}</button>
      </section>

      <section id="analysis-result-card" className={"panel result-panel" + analysisTone} aria-labelledby="result-title" aria-live="polite">
        <div className="panel-heading"><div><span className="eyebrow">YOUR FIELD REPORT</span><h2 id="result-title">Analysis result</h2></div><span className={"result-state" + (requestError ? " error" : analysis ? " " + analysis.status : "")}>{stateLabel}</span></div>
        {requestError ? <div className="result-message error-message"><AlertCircle size={20} /><div><strong>Analysis couldn’t be completed</strong><p>{requestError}</p></div></div> : analysis ? <div className={"result-message " + analysis.status + "-message"}>
          {analysis.status === "healthy" ? <CheckCircle2 size={20} /> : analysis.status === "possible_issue" ? <AlertCircle size={20} /> : <Info size={20} />}
          <div><strong>{analysis.status === "healthy" ? "Model matched a healthy-leaf class" : analysis.status === "possible_issue" ? "Possible crop health issue" : analysis.status === "uncertain" ? "Result marked uncertain" : "This crop is not supported"}</strong><p>{analysis.explanation}</p></div>
        </div> : <div className="result-intro"><div className="result-leaf"><Leaf size={20} /></div><div><strong>Your crop report will appear here</strong><p>Choose a leaf photo to run the classifier. Low-score or mismatched results are marked uncertain.</p></div></div>}
        <div className="result-details">
          <div><span>Selected crop</span><strong>{analysis?.crop_name || cropName}</strong></div>
          <div><span>Predicted condition</span><strong>{analysis ? analysis.condition || (analysis.candidate_condition ? "Uncertain · possible match: " + analysis.candidate_condition : "Not available") : "—"}</strong></div>
          <div><span>Model score</span><strong>{analysis?.confidence === null || analysis?.confidence === undefined ? "Not available" : analysis.confidence.toFixed(1) + "%"}</strong></div>
          <div className="explanation-row"><span>Model</span><strong>{analysis?.model || (analysis?.status === "unsupported_crop" ? "Not run" : "PlantVillage EfficientNetV2-S")}</strong></div>
        </div>
        <div className="next-steps"><span>Recommended next steps</span>{analysis ? <ul>{analysis.next_steps.map((step) => <li key={step}>{step}</li>)}</ul> : <p>No recommendations are generated until a result is available.</p>}</div>
        {analysis?.limitations && <p className="model-limitations"><Info size={14} />{analysis.limitations}</p>}
      </section>
    </form>

    <section className="panel recent-panel" aria-labelledby="recent-title">
      <div className="panel-heading"><div><span className="eyebrow">YOUR HISTORY</span><h2 id="recent-title">Recent analyses</h2></div><span className="coming-pill">{isLoadingRecent ? "Loading history" : `${recentAnalyses.length} saved`}</span></div>
      {recentError && <div className="recent-error" role="alert">{recentError}</div>}
      {!recentError && isLoadingRecent ? <div className="recent-empty"><span><LoaderCircle size={19} className="spin" /></span><div><strong>Loading your reports</strong><p>Checking saved crop analysis results.</p></div></div>
        : !recentError && recentAnalyses.length === 0 ? <div className="recent-empty"><span><CheckCircle2 size={20} /></span><div><strong>No analyses yet</strong><p>Your completed crop reports will appear here. Original uploaded photos are not retained.</p></div></div>
          : !recentError && <div className="recent-analysis-list">{recentAnalyses.map((record) => <button type="button" className="recent-analysis-row" key={record.id} onClick={() => openSavedAnalysis(record)}>
              <span className={`recent-analysis-icon ${record.status}`}><Leaf size={18} /></span>
              <span className="recent-analysis-main"><strong>{record.crop_name}</strong><small>{record.condition || (record.candidate_condition ? `Uncertain · possible match: ${record.candidate_condition}` : statusLabels[record.status])}</small></span>
              <span className="recent-analysis-date">{formatAnalysisDate(record.created_at)}</span>
              <span className={`recent-status-chip ${record.status}`}>{statusLabels[record.status]}</span>
              <ArrowRight size={16} className="recent-analysis-arrow" />
            </button>)}</div>}
      {!recentError && !isLoadingRecent && recentAnalyses.length > 0 && <p className="recent-footnote">Select a report to review its saved result. The source photo is not stored.</p>}
    </section>
  </div></main></div>;
}
