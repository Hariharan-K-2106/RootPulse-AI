import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type AppLanguage = "en" | "ta" | "hi";
export type ThemePreference = "system" | "light" | "dark";

const copy: Record<AppLanguage, Record<string, string>> = {
  en: {},
  ta: {
    "Dashboard": "முகப்பு", "Crop Analysis": "பயிர் பகுப்பாய்வு", "Irrigation Advisor": "பாசன ஆலோசகர்", "Crop Progress": "பயிர் முன்னேற்றம்", "Ask Your Crop": "உங்கள் பயிரிடம் கேளுங்கள்", "Workspace": "பணியிடம்", "Account details": "கணக்கு விவரங்கள்", "Name": "பெயர்", "Username": "பயனர் பெயர்", "Mobile number": "கைபேசி எண்", "Nil": "இல்லை", "Log out": "வெளியேறு", "Theme": "தோற்றம்", "Language": "மொழி", "System": "சாதன அமைப்பு", "Light": "ஒளி", "Dark": "இருள்",
    "YOUR FARM, AT A GLANCE": "உங்கள் பண்ணை ஒரு பார்வையில்", "Good morning,": "காலை வணக்கம்,", "let’s grow well.": "நன்றாக வளர்ப்போம்.", "Welcome to RootPulse AI. Your farm dashboard brings your crop records and field tools together.": "RootPulse AI-க்கு வரவேற்கிறோம். உங்கள் பயிர் பதிவுகளையும் பண்ணை கருவிகளையும் ஒரே இடத்தில் காணலாம்.", "Explore farm tools": "பண்ணை கருவிகளைப் பாருங்கள்", "Your farm workspace": "உங்கள் பண்ணை பணியிடம்", "YOUR FARM SNAPSHOT": "உங்கள் பண்ணை நிலவரம்", "At a glance": "ஒரு பார்வையில்", "Crop profiles": "பயிர் விவரங்கள்", "saved": "சேமிக்கப்பட்டது", "Your saved crop records": "சேமித்த பயிர் பதிவுகள்", "Named fields": "பெயரிடப்பட்ட வயல்கள்", "fields": "வயல்கள்", "From your crop profiles": "பயிர் பதிவுகளிலிருந்து", "Progress photos": "முன்னேற்றப் படங்கள்", "Uploaded field observations": "பதிவேற்றிய வயல் குறிப்புகள்", "Soil moisture": "மண் ஈரப்பதம்", "Manual": "கைமுறை", "entry": "பதிவு", "Enter correct readings": "சரியான அளவீடுகளை உள்ளிடவும்", "ROOTED IN THE FIELDS WE SERVE": "நாம் சேவை செய்யும் வயல்களில் வேரூன்றியது", "Farming, from India and across the world": "இந்தியாவிலும் உலகெங்கிலும் விவசாயம்", "Every field has its own rhythm. Keep yours moving forward with RootPulse AI.": "ஒவ்வொரு வயலுக்கும் தனித்துவமான வளர்ச்சி உள்ளது. RootPulse AI உடன் உங்கள் பண்ணையை முன்னேற்றுங்கள்.", "Fields in focus": "கவனத்தில் உள்ள வயல்கள்", "Photo credits and licenses": "பட உரிமம் மற்றும் நன்றி", "Farm tools": "பண்ணை கருவிகள்", "Open a tool to add observations or request guidance for your farm.": "குறிப்புகளைச் சேர்க்க அல்லது ஆலோசனை பெற கருவியைத் திறக்கவும்.", "Crop health analysis": "பயிர் நலப் பகுப்பாய்வு", "Upload a crop photo for the connected image analysis.": "பயிர் படத்தைப் பதிவேற்றி பகுப்பாய்வு செய்யவும்.", "Get a transparent advisory using crop details, manual moisture, and local weather.": "பயிர் விவரங்கள், கைமுறை ஈரப்பதம், உள்ளூர் வானிலை மூலம் தெளிவான ஆலோசனை பெறுங்கள்.", "Save dated crop photos and field observations.": "தேதியிட்ட பயிர் படங்களையும் வயல் குறிப்புகளையும் சேமிக்கவும்.", "Ask farming questions in English, Tamil, or Hindi.": "ஆங்கிலம், தமிழ் அல்லது இந்தியில் விவசாயக் கேள்விகளைக் கேளுங்கள்.", "Your farm summary could not be loaded.": "பண்ணை சுருக்கத்தை ஏற்ற முடியவில்லை.", "Smart Irrigation. Thriving Farms.": "சிறந்த பாசனம். செழிக்கும் பண்ணைகள்."
  },
  hi: {
    "Dashboard": "डैशबोर्ड", "Crop Analysis": "फसल विश्लेषण", "Irrigation Advisor": "सिंचाई सलाहकार", "Crop Progress": "फसल प्रगति", "Ask Your Crop": "अपनी फसल से पूछें", "Workspace": "कार्यस्थान", "Account details": "खाता विवरण", "Name": "नाम", "Username": "उपयोगकर्ता नाम", "Mobile number": "मोबाइल नंबर", "Nil": "नहीं दिया", "Log out": "लॉग आउट", "Theme": "थीम", "Language": "भाषा", "System": "सिस्टम", "Light": "लाइट", "Dark": "डार्क",
    "YOUR FARM, AT A GLANCE": "आपका खेत एक नज़र में", "Good morning,": "सुप्रभात,", "let’s grow well.": "आइए अच्छी फसल उगाएँ।", "Welcome to RootPulse AI. Your farm dashboard brings your crop records and field tools together.": "RootPulse AI में आपका स्वागत है। यहाँ फसल रिकॉर्ड और खेत के उपकरण एक जगह मिलते हैं।", "Explore farm tools": "खेती के उपकरण देखें", "Your farm workspace": "आपका खेत कार्यस्थान", "YOUR FARM SNAPSHOT": "आपके खेत की स्थिति", "At a glance": "एक नज़र में", "Crop profiles": "फसल प्रोफ़ाइल", "saved": "सहेजे", "Your saved crop records": "आपके सहेजे गए फसल रिकॉर्ड", "Named fields": "नामित खेत", "fields": "खेत", "From your crop profiles": "फसल प्रोफ़ाइल से", "Progress photos": "प्रगति की तस्वीरें", "Uploaded field observations": "अपलोड किए गए खेत के अवलोकन", "Soil moisture": "मिट्टी की नमी", "Manual": "मैनुअल", "entry": "प्रविष्टि", "Enter correct readings": "सही माप दर्ज करें", "ROOTED IN THE FIELDS WE SERVE": "जिन खेतों की हम सेवा करते हैं उनसे जुड़े", "Farming, from India and across the world": "भारत और दुनिया भर की खेती", "Every field has its own rhythm. Keep yours moving forward with RootPulse AI.": "हर खेत की अपनी लय होती है। RootPulse AI के साथ अपने खेत को आगे बढ़ाएँ।", "Fields in focus": "खेतों पर ध्यान", "Photo credits and licenses": "फोटो श्रेय और लाइसेंस", "Farm tools": "खेती के उपकरण", "Open a tool to add observations or request guidance for your farm.": "अवलोकन जोड़ने या सलाह पाने के लिए उपकरण खोलें।", "Crop health analysis": "फसल स्वास्थ्य विश्लेषण", "Upload a crop photo for the connected image analysis.": "विश्लेषण के लिए फसल की तस्वीर अपलोड करें।", "Get a transparent advisory using crop details, manual moisture, and local weather.": "फसल विवरण, मैनुअल नमी और स्थानीय मौसम से स्पष्ट सलाह पाएँ।", "Save dated crop photos and field observations.": "तारीख़ वाली फसल तस्वीरें और खेत के अवलोकन सहेजें।", "Ask farming questions in English, Tamil, or Hindi.": "अंग्रेज़ी, तमिल या हिंदी में खेती के सवाल पूछें।", "Your farm summary could not be loaded.": "खेत का सारांश लोड नहीं हो सका।", "Smart Irrigation. Thriving Farms.": "स्मार्ट सिंचाई। समृद्ध खेत।"
  }
};

interface PreferencesValue { language: AppLanguage; setLanguage: (language: AppLanguage) => void; theme: ThemePreference; setTheme: (theme: ThemePreference) => void; t: (text: string) => string; }
const PreferencesContext = createContext<PreferencesValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>(() => (localStorage.getItem("rootpulse-language") as AppLanguage) || "en");
  const [theme, setTheme] = useState<ThemePreference>(() => (localStorage.getItem("rootpulse-theme") as ThemePreference) || "system");
  useEffect(() => { localStorage.setItem("rootpulse-language", language); document.documentElement.lang = language; }, [language]);
  useEffect(() => {
    localStorage.setItem("rootpulse-theme", theme);
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => { root.dataset.theme = theme === "system" ? (media.matches ? "dark" : "light") : theme; };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  const value = useMemo(() => ({ language, setLanguage, theme, setTheme, t: (text: string) => copy[language][text] || text }), [language, theme]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() { const value = useContext(PreferencesContext); if (!value) throw new Error("usePreferences must be used inside PreferencesProvider."); return value; }
