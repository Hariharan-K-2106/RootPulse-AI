import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { AlertCircle, ArrowUp, Check, ChevronDown, CircleHelp, Leaf, LoaderCircle, MessageCircle, RotateCcw, Sprout, Volume2, VolumeX, X } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import {
  getCropProgress,
  getProgressCrops,
  getRecentCropAnalyses,
  sendCropChatMessage,
  type ChatLanguage,
  type ChatMessageInput,
  type ProgressCrop,
  type ProgressPhoto,
  type RecentCropAnalysis,
} from "../services/api";

type ChatItem = {
  id: string;
  role: "user" | "assistant";
  content: string;
  language: ChatLanguage;
};

function loadSpeechVoices(synthesis: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> {
  const available = synthesis.getVoices();
  if (available.length) return Promise.resolve(available);

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      synthesis.removeEventListener("voiceschanged", checkVoices);
      resolve(synthesis.getVoices());
    };
    const checkVoices = () => {
      if (synthesis.getVoices().length) finish();
    };
    const timeoutId = window.setTimeout(finish, 1200);
    synthesis.addEventListener("voiceschanged", checkVoices);
    checkVoices();
  });
}

const languageOptions: { id: ChatLanguage; label: string; native: string; voice: string }[] = [
  { id: "en", label: "English", native: "English", voice: "en-IN" },
  { id: "ta", label: "Tamil", native: "தமிழ்", voice: "ta-IN" },
  { id: "hi", label: "Hindi", native: "हिन्दी", voice: "hi-IN" },
];

const localized = {
  en: {
    welcome: "Hello! I’m here to help you think through questions about your crops.",
    hint: "Ask in English. I’ll keep guidance practical and explain when information is missing.",
    placeholder: "Ask a question about your crop…",
    suggestions: ["How can I improve my crop’s health?", "Should I irrigate today?", "What should I watch for during this growth stage?", "Explain my latest crop analysis."],
    send: "Send message",
    clear: "Clear conversation",
    noContext: "No crop selected",
    noContextText: "I can answer general questions. Select one of your saved crops to include its name and saved field observations.",
    cropContext: "Crop context shared",
    noCropNotes: "No saved field observations for this crop yet.",
    latestNotes: "Recent farmer observations",
    notStored: "Not saved in RootPulse yet",
    waiting: "The assistant is preparing a reply…",
    confirmClear: "Clear all messages in this conversation?",
    speakUnavailable: "Speech playback is unavailable in this browser.",
    voiceUnavailable: "No voice is installed for this language. Check your device’s text-to-speech settings.",
    retry: "Retry",
    noCrops: "No crops have been added yet. Add a crop in Crop Progress to give the assistant field context.",
    contextFailure: "Could not load saved crop context.",
    assistantFailure: "The assistant could not be reached. Check the backend and retry.",
    notConfigured: "AI assistant is not configured yet. Add OPENAI_API_KEY to backend/.env to enable replies.",
  },
  ta: {
    welcome: "வணக்கம்! உங்கள் பயிர்கள் பற்றிய கேள்விகளைப் புரிந்துகொள்ள நான் உதவுகிறேன்.",
    hint: "தமிழில் கேளுங்கள். நடைமுறைக்கு ஏற்ற பதிலை அளித்து, தகவல் இல்லாதபோது அதைத் தெளிவாகச் சொல்கிறேன்.",
    placeholder: "உங்கள் பயிரைப் பற்றி கேளுங்கள்…",
    suggestions: ["என் பயிரின் ஆரோக்கியத்தை எப்படிச் மேம்படுத்தலாம்?", "இன்று பாசனம் செய்யலாமா?", "இந்த வளர்ச்சி நிலையில் எதைக் கவனிக்க வேண்டும்?", "என் சமீபத்திய பயிர் பகுப்பாய்வை விளக்குங்கள்."],
    send: "செய்தியை அனுப்பு",
    clear: "உரையாடலை அழி",
    noContext: "பயிர் தேர்ந்தெடுக்கப்படவில்லை",
    noContextText: "பொதுவான கேள்விகளுக்கு பதிலளிக்கலாம். சேமிக்கப்பட்ட பயிரைத் தேர்ந்தெடுத்தால் அதன் பெயரும் குறிப்புகளும் சேர்க்கப்படும்.",
    cropContext: "பகிரப்படும் பயிர் விவரம்",
    noCropNotes: "இந்தப் பயிருக்கான வயல் குறிப்புகள் இன்னும் இல்லை.",
    latestNotes: "சமீபத்திய விவசாயி குறிப்புகள்",
    notStored: "RootPulse-ல் சேமிக்கப்படவில்லை",
    waiting: "உதவியாளர் பதில் தயாரிக்கிறார்…",
    confirmClear: "இந்த உரையாடலில் உள்ள எல்லா செய்திகளையும் அழிக்கவா?",
    speakUnavailable: "இந்த உலாவியில் குரல் வாசிப்பு கிடைக்கவில்லை.",
    voiceUnavailable: "இந்த மொழிக்கான குரல் உங்கள் சாதனத்தில் இல்லை. உரை-குரல் அமைப்புகளைப் பாருங்கள்.",
    retry: "மீண்டும் முயற்சி",
    noCrops: "இன்னும் பயிர்கள் சேர்க்கப்படவில்லை. வயல் விவரங்களைப் பகிர Crop Progress-ல் பயிர் சேர்க்கவும்.",
    contextFailure: "சேமிக்கப்பட்ட பயிர் விவரங்களை ஏற்ற முடியவில்லை.",
    assistantFailure: "உதவியாளரைத் தொடர்புகொள்ள முடியவில்லை. சேவையைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.",
    notConfigured: "AI உதவியாளர் இன்னும் அமைக்கப்படவில்லை. பதில்களை இயக்க backend/.env கோப்பில் OPENAI_API_KEY சேர்க்கவும்.",
  },
  hi: {
    welcome: "नमस्ते! मैं आपकी फसलों से जुड़े सवालों पर सोचने में मदद करूँगा।",
    hint: "हिंदी में पूछें। मैं सरल, उपयोगी जवाब दूँगा और जानकारी कम होने पर बताऊँगा।",
    placeholder: "अपनी फसल के बारे में पूछें…",
    suggestions: ["मैं अपनी फसल की सेहत कैसे सुधारूँ?", "क्या आज सिंचाई करनी चाहिए?", "इस वृद्धि अवस्था में किन बातों पर ध्यान दूँ?", "मेरे नवीनतम फसल विश्लेषण को समझाएँ।"],
    send: "संदेश भेजें",
    clear: "बातचीत साफ़ करें",
    noContext: "कोई फसल नहीं चुनी गई",
    noContextText: "मैं सामान्य सवालों का जवाब दे सकता हूँ। सेव की गई फसल चुनें ताकि उसका नाम और खेत के नोट शामिल हों।",
    cropContext: "साझा की जा रही फसल जानकारी",
    noCropNotes: "इस फसल के लिए खेत के नोट अभी सेव नहीं हैं।",
    latestNotes: "किसान के हाल के नोट",
    notStored: "RootPulse में सेव नहीं है",
    waiting: "सहायक जवाब तैयार कर रहा है…",
    confirmClear: "क्या इस बातचीत के सभी संदेश हटाएँ?",
    speakUnavailable: "इस ब्राउज़र में आवाज़ में सुनने की सुविधा उपलब्ध नहीं है।",
    voiceUnavailable: "इस भाषा की आवाज़ आपके डिवाइस पर उपलब्ध नहीं है। टेक्स्ट-टू-स्पीच सेटिंग देखें।",
    retry: "फिर कोशिश करें",
    noCrops: "अभी कोई फसल नहीं जोड़ी गई। खेत की जानकारी साझा करने के लिए Crop Progress में फसल जोड़ें।",
    contextFailure: "सेव की गई फसल जानकारी लोड नहीं हो सकी।",
    assistantFailure: "सहायक से संपर्क नहीं हो सका। सेवा जाँचकर फिर कोशिश करें।",
    notConfigured: "AI सहायक अभी कॉन्फ़िगर नहीं है। जवाब चालू करने के लिए backend/.env में OPENAI_API_KEY जोड़ें।",
  },
} satisfies Record<ChatLanguage, {
  welcome: string; hint: string; placeholder: string; suggestions: string[]; send: string;
  clear: string; noContext: string; noContextText: string; cropContext: string; noCropNotes: string;
  latestNotes: string; notStored: string; waiting: string; confirmClear: string;
  speakUnavailable: string; voiceUnavailable: string; retry: string; noCrops: string; contextFailure: string; assistantFailure: string; notConfigured: string;
}>;

function toChatError(error: unknown, language: ChatLanguage) {
  if (error && typeof error === "object" && "response" in error) {
    const data = (error.response as { data?: { message?: string; status?: string } })?.data;
    if (data?.status === "not_configured") return localized[language].notConfigured;
    if (data?.message) return data.message;
  }
  return localized[language].assistantFailure;
}

export default function AskYourCrop() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [language, setLanguage] = useState<ChatLanguage>("en");
  const [crops, setCrops] = useState<ProgressCrop[]>([]);
  const [cropId, setCropId] = useState<number | null>(null);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [latestAnalysis, setLatestAnalysis] = useState<RecentCropAnalysis | null>(null);
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingCrops, setLoadingCrops] = useState(true);
  const [contextLoading, setContextLoading] = useState(false);
  const [error, setError] = useState("");
  const [speechNotice, setSpeechNotice] = useState("");
  const [retryRequest, setRetryRequest] = useState<{ message: string; history: ChatMessageInput[]; language: ChatLanguage; cropId: number | null } | null>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  const content = localized[language];
  const currentCrop = crops.find((crop) => crop.id === cropId) || null;
  const recentNotes = photos.filter((photo) => photo.note?.trim()).slice(-3).reverse();

  useEffect(() => {
    let active = true;
    getProgressCrops()
      .then((items) => { if (active) setCrops(items); })
      .catch((reason) => { if (active) setError(toChatError(reason, language)); })
      .finally(() => { if (active) setLoadingCrops(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (cropId === null) {
      setPhotos([]);
      return;
    }
    let active = true;
    setContextLoading(true);
    getCropProgress(cropId)
      .then((items) => { if (active) setPhotos(items); })
      .catch((reason) => { if (active) setError(toChatError(reason, language)); })
      .finally(() => { if (active) setContextLoading(false); });
    return () => { active = false; };
  }, [cropId]);

  useEffect(() => {
    if (!currentCrop) {
      setLatestAnalysis(null);
      return;
    }
    let active = true;
    setLatestAnalysis(null);
    getRecentCropAnalyses()
      .then((items) => {
        if (!active) return;
        const matching = items
          .filter((item) => item.crop_name.toLocaleLowerCase() === currentCrop.crop_name.toLocaleLowerCase())
          .sort((a, b) => b.created_at.localeCompare(a.created_at));
        setLatestAnalysis(matching[0] ?? null);
      })
      .catch(() => { if (active) setLatestAnalysis(null); });
    return () => { active = false; };
  }, [cropId, currentCrop?.crop_name]);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  async function sendMessage(
    text: string,
    previousMessages: Array<Pick<ChatItem, "role" | "content">> = messages,
    isRetry = false,
    requestLanguage: ChatLanguage = language,
    requestCropId: number | null = cropId,
  ) {
    const message = text.trim();
    if (!message || isLoading) return;
    const history = previousMessages.slice(-10).map(({ role, content: messageContent }) => ({ role, content: messageContent }));
    if (!isRetry) {
      setMessages((existing) => [...existing, { id: String(Date.now()) + "-user", role: "user", content: message, language: requestLanguage }]);
    }
    setDraft("");
    setIsLoading(true);
    setError("");
    setRetryRequest(null);
    setSpeechNotice("");
    try {
      const result = await sendCropChatMessage(message, requestLanguage, requestCropId, history);
      if (result.status !== "ok" || !result.response) throw new Error(result.message || "The assistant did not return a response.");
      setMessages((existing) => [...existing, {
        id: String(Date.now()) + "-assistant",
        role: "assistant",
        content: result.response || "",
        language: result.language,
      }]);
    } catch (reason) {
      setError(toChatError(reason, requestLanguage));
      setRetryRequest({ message, history, language: requestLanguage, cropId: requestCropId });
    } finally {
      setIsLoading(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(draft);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(draft);
    }
  }

  function clearConversation() {
    if (!messages.length) return;
    if (window.confirm(content.confirmClear)) {
      setMessages([]);
      setError("");
      setRetryRequest(null);
      setSpeechNotice("");
    }
  }

  async function speakMessage(message: ChatItem) {
    setSpeechNotice("");
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      setSpeechNotice(localized[message.language].speakUnavailable);
      return;
    }

    const synthesis = window.speechSynthesis;
    synthesis.cancel();
    const voices = await loadSpeechVoices(synthesis);
    if (!voices.length) {
      setSpeechNotice(localized[message.language].voiceUnavailable);
      return;
    }

    const selectedLanguage = languageOptions.find((item) => item.id === message.language);
    const requestedLocale = selectedLanguage?.voice.toLowerCase() || "en-in";
    const matchingVoice = voices.find((item) => item.lang.toLowerCase() === requestedLocale)
      || voices.find((item) => item.lang.toLowerCase() === message.language)
      || voices.find((item) => item.lang.toLowerCase().startsWith(message.language + "-"));
    // Use the OS default voice when it has no voice for the selected language.
    // The browser still gets the requested language when one is available;
    // fallback voices use their own locale to avoid an unsupported voice error.
    const voice = matchingVoice || voices.find((item) => item.default) || voices[0];
    const utterance = new SpeechSynthesisUtterance(message.content);
    utterance.lang = matchingVoice ? selectedLanguage?.voice || voice.lang : voice.lang || selectedLanguage?.voice || "en-IN";
    utterance.voice = voice;
    utterance.onerror = () => setSpeechNotice(localized[message.language].speakUnavailable);
    synthesis.speak(utterance);
  }

  return <div className="app-shell"><Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} /><main className="main-area"><Topbar pageTitle="Ask Your Crop" onMenu={() => setMenuOpen(true)} /><div className="dashboard-content ask-content">
    <header className="ask-heading"><div><span className="eyebrow">FIELD COMPANION</span><h1>Ask Your Crop</h1><p>Get farming guidance in your preferred language.</p></div><div className="language-chips" aria-label="Supported languages"><span>English</span><span>தமிழ்</span><span>हिन्दी</span></div></header>
    <div className="ask-layout">
      <section className="panel chat-panel" aria-label="Chat with Ask Your Crop">
        <div className="chat-topline"><div className="assistant-identity"><span className="assistant-avatar"><Sprout size={19} /></span><div><strong>RootPulse Assistant</strong><small><span /> Multilingual farm guidance</small></div></div>
          <div className="chat-controls"><label className="language-select-wrap"><span className="sr-only">Response language</span><select aria-label="Response language" value={language} onChange={(event) => setLanguage(event.target.value as ChatLanguage)}>{languageOptions.map((item) => <option key={item.id} value={item.id}>{item.native}</option>)}</select><ChevronDown size={13} /></label><button type="button" className="chat-clear" onClick={clearConversation} disabled={!messages.length || isLoading} title={content.clear} aria-label={content.clear}><RotateCcw size={15} /></button></div>
        </div>
        <div className="chat-message-list" role="log" aria-live="polite" aria-relevant="additions text">
          {!messages.length ? <div className="chat-welcome"><span className="welcome-leaf"><Leaf size={22} /></span><span className="eyebrow">ROOTPULSE AI</span><h2>{content.welcome}</h2><p>{content.hint}</p></div> : messages.map((message) => <article key={message.id} className={"chat-message " + message.role}>
            {message.role === "assistant" && <span className="message-avatar"><Sprout size={15} /></span>}
            <div className="message-content"><p>{message.content}</p>{message.role === "assistant" && <button type="button" className="speak-button" onClick={() => speakMessage(message)} aria-label="Read this response aloud"><Volume2 size={15} /> <span>Listen</span></button>}</div>
          </article>)}
          {isLoading && <div className="assistant-loading"><span className="message-avatar"><Sprout size={15} /></span><div><span className="typing-dots"><i /><i /><i /></span><small>{content.waiting}</small></div></div>}
          <div ref={chatEnd} />
        </div>
        {!messages.length && <div className="suggested-questions"><div><CircleHelp size={14} /> Suggested questions</div>{content.suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => void sendMessage(suggestion)} disabled={isLoading}><span>{suggestion}</span><ArrowUp size={14} /></button>)}</div>}
        {error && <div className="chat-error" role="alert"><AlertCircle size={16} /><span>{error}</span>{retryRequest && <button type="button" onClick={() => void sendMessage(retryRequest.message, retryRequest.history, true, retryRequest.language, retryRequest.cropId)}><RotateCcw size={13} />{content.retry}</button>}</div>}
        {speechNotice && <div className="speech-notice" role="status"><VolumeX size={14} />{speechNotice}<button type="button" onClick={() => setSpeechNotice("")} aria-label="Dismiss"><X size={13} /></button></div>}
        <form className="chat-composer" onSubmit={onSubmit}>
          <label className="sr-only" htmlFor="chat-message">Message for the farming assistant</label>
          <textarea id="chat-message" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} maxLength={2000} rows={2} placeholder={content.placeholder} disabled={isLoading} />
          <div className="composer-footer"><small>{draft.length}/2000 · Enter to send · Shift+Enter for a new line</small><button type="submit" aria-label={content.send} disabled={!draft.trim() || isLoading}>{isLoading ? <LoaderCircle size={17} className="spin" /> : <ArrowUp size={18} />}</button></div>
        </form>
        <p className="chat-safety-note"><Check size={13} /> Guidance can be incomplete. Confirm serious crop-health concerns with an agricultural expert.</p>
      </section>

      <aside className="panel crop-context-panel" aria-labelledby="context-title">
        <div className="panel-heading"><div><span className="eyebrow">PERSONALIZE YOUR QUESTION</span><h2 id="context-title">Crop context</h2></div><span className="context-leaf"><Sprout size={17} /></span></div>
        <label className="context-select-label" htmlFor="context-crop">Choose a saved crop or field</label>
        <select id="context-crop" className="context-crop-select" value={cropId ?? ""} disabled={loadingCrops} onChange={(event) => { setCropId(event.target.value ? Number(event.target.value) : null); setError(""); }}>
          <option value="">{loadingCrops ? "Loading saved crops…" : "No crop context"}</option>{crops.map((crop) => <option key={crop.id} value={crop.id}>{crop.crop_name}{crop.field_name ? " · " + crop.field_name : ""}</option>)}
        </select>
        {cropId === null ? <div className="context-empty"><span><MessageCircle size={18} /></span><strong>{content.noContext}</strong><p>{crops.length ? content.noContextText : content.noCrops}</p></div> : currentCrop ? <div className="context-details">
          <div className="context-crop-card"><span className="context-crop-icon"><Leaf size={17} /></span><div><small>SELECTED FIELD</small><strong>{currentCrop.crop_name}</strong><span>{currentCrop.field_name || "Field name not provided"}</span></div></div>
          <div className="context-status"><Check size={14} /><span>{content.cropContext}</span></div>
          <div className="context-notes"><strong>{content.latestNotes}</strong>{contextLoading ? <span className="context-muted">Loading observations…</span> : recentNotes.length ? recentNotes.map((photo) => <div className="context-note" key={photo.id}><time>{photo.captured_at}</time><p>{photo.note}</p></div>) : <span className="context-muted">{content.noCropNotes}</span>}</div>
          <div className="context-analysis"><strong>Latest analysis for {currentCrop.crop_name}</strong>{latestAnalysis ? <div className="context-analysis-result"><span className={"analysis-status " + latestAnalysis.status}>{latestAnalysis.status.split("_").join(" ")}</span><p>{latestAnalysis.condition || latestAnalysis.candidate_condition || "Condition not identified"}{latestAnalysis.confidence !== null ? ` · ${latestAnalysis.confidence.toFixed(1)}% model score` : ""}</p><small>{latestAnalysis.explanation}</small><time>{latestAnalysis.created_at}</time></div> : <span className="context-muted">No saved analysis matches this crop type yet. Run a crop analysis to share its result here. Analyses are matched by crop type and are not linked to a specific field.</span>}</div>
        </div> : <div className="context-empty"><span><AlertCircle size={18} /></span><strong>Crop context unavailable</strong><p>Refresh the page and try again.</p></div>}
        <div className="context-language-note"><span className="context-language-icon">文</span><p>Answers and suggested questions follow your selected language: <strong>{languageOptions.find((item) => item.id === language)?.native}</strong>.</p></div>
        <a className="context-add-link" href="/crop-progress">Manage crops in Crop Progress <ArrowUp size={14} /></a>
      </aside>
    </div>
  </div></main></div>;
}
