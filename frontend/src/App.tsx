import { Navigate, Route, Routes } from "react-router-dom";
import CropAnalysis from "./pages/CropAnalysis";
import Dashboard from "./pages/Dashboard";
import IrrigationAdvisor from "./pages/IrrigationAdvisor";
import CropProgress from "./pages/CropProgress";
import AskYourCrop from "./pages/AskYourCrop";
import { RequireAuth, GuestOnly } from "./auth/RouteGuards";
import { ForgotPasswordPage, LoginPage, RegisterPage, RecoverySetupPage } from "./pages/AuthPages";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
      <Route path="/forgot-password" element={<GuestOnly><ForgotPasswordPage /></GuestOnly>} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/crop-analysis" element={<CropAnalysis />} />
        <Route path="/irrigation-advisor" element={<IrrigationAdvisor />} />
        <Route path="/crop-progress" element={<CropProgress />} />
        <Route path="/ask-your-crop" element={<AskYourCrop />} />
        <Route path="/recovery-setup" element={<RecoverySetupPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
