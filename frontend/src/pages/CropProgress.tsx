import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { Activity, AlertCircle, CalendarDays, Check, FileImage, ImagePlus, Leaf, LoaderCircle, Plus, Scale, Sprout, UploadCloud } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import {
  createProgressCrop,
  getCropProgress,
  getProgressCrops,
  uploadProgressPhoto,
  type ProgressCrop,
  type ProgressPhoto,
} from "../services/api";

const cropOptions = ["Tomato", "Potato", "Rice", "Maize"];
const maxFileSize = 10 * 1024 * 1024;
const allowedExtensions = [".jpg", ".jpeg", ".png"];

function todayLocal() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "response" in error) {
    const data = (error.response as { data?: { error?: string } })?.data;
    if (data?.error) return data.error;
  }
  return fallback;
}

export default function CropProgress() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [crops, setCrops] = useState<ProgressCrop[]>([]);
  const [selectedCropId, setSelectedCropId] = useState<number | null>(null);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [capturedAt, setCapturedAt] = useState(todayLocal());
  const [note, setNote] = useState("");
  const [cropName, setCropName] = useState("");
  const [fieldName, setFieldName] = useState("");
  const [selectedComparison, setSelectedComparison] = useState<number[]>([]);
  const [loadingCrops, setLoadingCrops] = useState(true);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [creatingCrop, setCreatingCrop] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [validation, setValidation] = useState("");
  const [pageError, setPageError] = useState("");
  const [success, setSuccess] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const selectedCrop = crops.find((crop) => crop.id === selectedCropId) || null;
  const selectedPhotos = useMemo(
    () => selectedComparison.map((id) => photos.find((photo) => photo.id === id)).filter((photo): photo is ProgressPhoto => Boolean(photo)),
    [photos, selectedComparison],
  );

  useEffect(() => {
    if (!image) {
      setPreview("");
      return;
    }
    const objectUrl = URL.createObjectURL(image);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [image]);

  useEffect(() => {
    let active = true;
    getProgressCrops()
      .then((items) => {
        if (!active) return;
        setCrops(items);
        setSelectedCropId(items[0]?.id ?? null);
      })
      .catch((error) => {
        if (active) setPageError(errorMessage(error, "Could not load crops. Check that the backend is running."));
      })
      .finally(() => { if (active) setLoadingCrops(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (selectedCropId === null) {
      setPhotos([]);
      return;
    }
    let active = true;
    setLoadingPhotos(true);
    setPageError("");
    setSelectedComparison([]);
    getCropProgress(selectedCropId)
      .then((items) => { if (active) setPhotos(items); })
      .catch((error) => { if (active) setPageError(errorMessage(error, "Could not load this crop’s timeline.")); })
      .finally(() => { if (active) setLoadingPhotos(false); });
    return () => { active = false; };
  }, [selectedCropId]);

  function chooseImage(file?: File) {
    if (!file) return;
    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!allowedExtensions.includes(extension) || (file.type && !["image/jpeg", "image/png"].includes(file.type))) {
      setValidation("Choose a JPG, JPEG, or PNG image.");
      return;
    }
    if (file.size > maxFileSize) {
      setValidation("This image is larger than 10 MB. Choose a smaller file.");
      return;
    }
    setImage(file);
    setValidation("");
    setPageError("");
    setSuccess("");
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    chooseImage(event.target.files?.[0]);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    chooseImage(event.dataTransfer.files[0]);
  }

  async function addCrop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creatingCrop || !cropName) return;
    setCreatingCrop(true);
    setPageError("");
    setSuccess("");
    try {
      const crop = await createProgressCrop(cropName, fieldName.trim());
      setCrops((existing) => [...existing, crop]);
      setSelectedCropId(crop.id);
      setCropName("");
      setFieldName("");
      setSuccess("Crop added. You can now add dated progress photos.");
    } catch (error) {
      setPageError(errorMessage(error, "Could not add this crop."));
    } finally {
      setCreatingCrop(false);
    }
  }

  async function savePhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!image || selectedCropId === null || uploading) return;
    setUploading(true);
    setPageError("");
    setSuccess("");
    try {
      const result = await uploadProgressPhoto(selectedCropId, image, capturedAt, note.trim());
      setPhotos((existing) => [...existing, result.photo].sort((a, b) => a.captured_at.localeCompare(b.captured_at) || a.id - b.id));
      setImage(null);
      setNote("");
      setCapturedAt(todayLocal());
      setSuccess(result.message);
    } catch (error) {
      setPageError(errorMessage(error, "Could not upload the progress photo. Try again."));
    } finally {
      setUploading(false);
    }
  }

  function toggleComparison(photoId: number) {
    setSelectedComparison((current) => {
      if (current.includes(photoId)) return current.filter((id) => id !== photoId);
      if (current.length >= 2) return [current[1], photoId];
      return [...current, photoId];
    });
  }

  return <div className="app-shell"><Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} /><main className="main-area"><Topbar pageTitle="Crop Progress" onMenu={() => setMenuOpen(true)} /><div className="dashboard-content progress-content">
    <header className="progress-heading"><div><span className="eyebrow">SEASON PLANNER</span><h1>Crop Progress</h1><p>Track your crops over time with dated photos and field observations.</p></div><span className="progress-badge"><Activity size={15} /> SEASON TIMELINE</span></header>

    {pageError && <div className="progress-feedback progress-error" role="alert"><AlertCircle size={16} />{pageError}<button type="button" onClick={() => setPageError("")} aria-label="Dismiss error">×</button></div>}
    {success && <div className="progress-feedback progress-success" role="status"><Check size={16} />{success}<button type="button" onClick={() => setSuccess("")} aria-label="Dismiss message">×</button></div>}

    <section className="panel crop-picker-panel" aria-labelledby="crop-picker-title">
      <div className="panel-heading"><div><span className="eyebrow">YOUR FIELDS</span><h2 id="crop-picker-title">Select a crop</h2></div><span className="progress-step"><Sprout size={16} /></span></div>
      {loadingCrops ? <div className="progress-loading"><LoaderCircle size={18} className="spin" /> Loading your crops…</div> : crops.length > 0 ? <div className="crop-picker-row">
        <label htmlFor="progress-crop-select">Crop or field</label>
        <select id="progress-crop-select" value={selectedCropId ?? ""} onChange={(event) => setSelectedCropId(Number(event.target.value))}>
          {crops.map((crop) => <option key={crop.id} value={crop.id}>{crop.crop_name}{crop.field_name ? " · " + crop.field_name : ""}</option>)}
        </select>
        <span>{crops.length} {crops.length === 1 ? "crop" : "crops"} in your list</span>
      </div> : <div className="crop-empty-state"><span><Leaf size={20} /></span><div><strong>No crops added yet</strong><p>Add a crop and optional field name to start a progress timeline. Crop records are saved on this backend.</p></div></div>}
      <form className="add-crop-form" onSubmit={addCrop}>
        <label>Crop<select value={cropName} onChange={(event) => setCropName(event.target.value)} required><option value="">Choose a crop</option>{cropOptions.map((crop) => <option key={crop}>{crop}</option>)}</select></label>
        <label>Field name <span>Optional</span><input value={fieldName} onChange={(event) => setFieldName(event.target.value)} maxLength={100} placeholder="e.g. North field" /></label>
        <button type="submit" disabled={!cropName || creatingCrop}>{creatingCrop ? <LoaderCircle size={15} className="spin" /> : <Plus size={16} />}{creatingCrop ? "Adding…" : "Add crop"}</button>
      </form>
    </section>

    {selectedCrop && <div className="progress-main-grid">
      <form className="panel progress-upload-panel" onSubmit={savePhoto} aria-labelledby="progress-upload-title">
        <div className="panel-heading"><div><span className="eyebrow">ADD A FIELD MOMENT</span><h2 id="progress-upload-title">Upload progress photo</h2></div><span className="progress-step">01</span></div>
        <div className="progress-target"><span><Sprout size={15} /></span><div><small>ADDING PHOTO TO</small><strong>{selectedCrop.crop_name}{selectedCrop.field_name ? " · " + selectedCrop.field_name : ""}</strong></div></div>
        {!image ? <label htmlFor="progress-image" className={"progress-dropzone" + (dragging ? " dragging" : "")} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
          <input ref={fileInput} className="visually-hidden-input" id="progress-image" type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" onChange={onFileChange} />
          <span className="progress-upload-icon"><UploadCloud size={24} /></span><strong>Drop your crop photo here</strong><span>or <u>browse files</u> on your device</span><small>JPG, JPEG, PNG · Up to 10 MB</small>
        </label> : <div className="progress-preview"><img src={preview} alt="Preview of the selected crop progress photo" /><div><FileImage size={15} /><strong>{image.name}</strong><button type="button" onClick={() => setImage(null)}>Remove</button></div><input ref={fileInput} className="visually-hidden-input" id="progress-image" type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" onChange={onFileChange} /></div>}
        {validation && <p className="progress-validation" role="alert"><AlertCircle size={14} />{validation}</p>}
        <div className="progress-upload-fields">
          <label htmlFor="captured-at">Capture date<input id="captured-at" type="date" max={todayLocal()} value={capturedAt} onChange={(event) => setCapturedAt(event.target.value)} required /></label>
          <label htmlFor="progress-note">Observation note <span>Optional</span><textarea id="progress-note" rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. First flowering observed" /></label>
        </div>
        <p className="progress-upload-hint"><Scale size={14} /> Photos and notes document observations; they do not measure growth or diagnose crop health.</p>
        <button className="progress-submit" type="submit" disabled={!image || uploading || !capturedAt}>{uploading ? <><LoaderCircle size={16} className="spin" /> Saving photo…</> : <><ImagePlus size={16} /> Save progress photo</>}</button>
      </form>

      <section className="panel progress-timeline-panel" aria-labelledby="timeline-title">
        <div className="panel-heading"><div><span className="eyebrow">DATED OBSERVATIONS</span><h2 id="timeline-title">{selectedCrop.crop_name} timeline</h2></div><span className="timeline-count">{photos.length} {photos.length === 1 ? "photo" : "photos"}</span></div>
        <p className="timeline-hint">Select up to two photos below to compare them side by side.</p>
        {loadingPhotos ? <div className="progress-loading"><LoaderCircle size={18} className="spin" /> Loading timeline…</div> : photos.length === 0 ? <div className="timeline-empty"><span><CalendarDays size={21} /></span><strong>No progress photos yet</strong><p>Upload the first dated photo to begin tracking this crop through the season.</p></div> : <div className="progress-timeline">
          {photos.map((photo) => <article className="timeline-entry" key={photo.id}>
            <div className="timeline-marker" aria-hidden="true" />
            <div className="timeline-photo"><img src={photo.image_url} alt={"Progress photo captured " + photo.captured_at} loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} /></div>
            <div className="timeline-copy"><time dateTime={photo.captured_at}>{new Date(photo.captured_at + "T12:00:00").toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</time><p>{photo.note || "No observation note added."}</p>{photo.analysis ? <small className={"timeline-analysis " + photo.analysis.status}>Crop analysis: {photo.analysis.condition || photo.analysis.status.replace(/_/g, " ")}</small> : <small className="timeline-analysis-muted">No linked crop analysis</small>}</div>
            <label className="compare-check"><input type="checkbox" checked={selectedComparison.includes(photo.id)} onChange={() => toggleComparison(photo.id)} aria-label={"Select photo from " + photo.captured_at + " for comparison"} /><span>Compare</span></label>
          </article>)}
        </div>}
        {photos.length > 0 && <p className="timeline-footnote">Photos are shown oldest to newest. Missing image files will display as unavailable.</p>}
      </section>
    </div>}

    {selectedPhotos.length === 2 && <section className="panel photo-comparison" aria-labelledby="compare-title">
      <div className="panel-heading"><div><span className="eyebrow">SIDE-BY-SIDE VIEW</span><h2 id="compare-title">Photo comparison</h2></div><button className="comparison-clear" type="button" onClick={() => setSelectedComparison([])}>Clear selection</button></div>
      <p className="comparison-note">A visual reference only. Differences are not measured growth or a crop-health assessment.</p>
      <div className="comparison-grid">{selectedPhotos.map((photo) => <article className="comparison-photo" key={photo.id}><div className="comparison-image"><img src={photo.image_url} alt={"Crop photo captured " + photo.captured_at} onError={(event) => { event.currentTarget.hidden = true; }} /></div><time dateTime={photo.captured_at}>{new Date(photo.captured_at + "T12:00:00").toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</time><p>{photo.note || "No observation note added."}</p></article>)}</div>
    </section>}
    <p className="progress-page-footnote">Your photos and notes are stored by this local project backend. Keep original field records for decisions that need verified measurements.</p>
  </div></main></div>;
}
