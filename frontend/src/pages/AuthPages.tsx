import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, Leaf, LoaderCircle, Sprout } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getRecoveryQuestions, resetFarmerPassword, setupRecoveryAnswers, verifyRecoveryAnswers } from "../services/api";

function AuthFrame({ mode, children }: { mode: "login" | "register" | "forgot"; children: React.ReactNode }) {
  const isLogin = mode === "login";
  const isForgot = mode === "forgot";
  return <main className="auth-page">
    <section className="auth-story">
      <Link to="/" className="auth-brand auth-logo-brand"><img src="/images/rootpulse-ai-logo.png" alt="RootPulse AI logo: Smart Irrigation. Thriving Farms." /></Link>
      <div className="auth-story-copy"><span className="auth-kicker"><Leaf size={14} /> ROOTED IN BETTER FARMING</span><h1>Insight for<br /><em>every field.</em></h1><p>Crop insights, field notes, and practical irrigation planning in one workspace.</p><div className="auth-field-art" aria-hidden="true"><i /><i /><i /><span><Sprout size={47} /></span></div></div>
      <div className="auth-story-footer">ROOTPULSE AI <b>Â·</b> FARMER WORKSPACE</div>
    </section>
    <section className="auth-form-side"><div className="auth-mobile-brand"><span className="auth-brand-mark"><Sprout size={23} /></span><span><strong>RootPulse<span> AI</span></strong><small className="brand-tagline">Smart Irrigation. Thriving Farms.</small></span></div><div className="auth-card">
      <span className="auth-card-kicker">{isLogin ? "WELCOME BACK" : isForgot ? "ACCOUNT RECOVERY" : "JOIN ROOTPULSE AI"}</span>
      <h2>{isLogin ? "Sign in to your farm" : isForgot ? "Reset your password" : "Create your farmer account"}</h2>
      <p className="auth-card-subtitle">{isLogin ? "Your field workspace is ready when you are." : isForgot ? "Verify your recovery answers to set a new password." : "Set up your account to keep your farm work personal."}</p>
      {children}
    </div><p className="auth-legal-note">Your account details stay protected. Farm guidance is informational and does not replace local agricultural expertise.</p></section>
  </main>;
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  minLength = 8,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  return <label className="auth-field" htmlFor={id}>{label}<span className="auth-password-wrap">
    <input id={id} type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} minLength={minLength} maxLength={128} required />
    <button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? "Hide password" : "Show password"}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button>
  </span></label>;
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const registrationComplete = searchParams.get("registered") === "1";
  const resetComplete = searchParams.get("reset") === "1";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const loggedInUser = await login(username.trim(), password);
      const state = location.state as { from?: { pathname?: string } } | null;
      const target = state?.from?.pathname?.startsWith("/") ? state.from.pathname : "/";
      // Older Flask processes may omit this field; only redirect when missing answers are explicitly confirmed.
      navigate(loggedInUser.recovery_configured === false ? "/recovery-setup" : target, { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not sign in. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return <AuthFrame mode="login"><form className="auth-form" onSubmit={submit}>
    {registrationComplete && <div className="auth-success" role="status">Your account is ready. Sign in to continue.</div>}
    {resetComplete && <div className="auth-success" role="status">Your password was updated. Sign in with your new password.</div>}
    <label className="auth-field" htmlFor="login-username">Username<input id="login-username" type="text" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" minLength={3} maxLength={32} required /></label>
    <PasswordField id="login-password" label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
    <p className="auth-forgot-link"><Link to="/forgot-password">Forgot Password?</Link></p>
    {error && <div className="auth-error" role="alert">{error}</div>}
    <button type="submit" className="auth-submit" disabled={isSubmitting}>{isSubmitting ? <><LoaderCircle size={17} className="spin" />Signing inâ€¦</> : <>Sign in <ArrowRight size={17} /></>}</button>
  </form><p className="auth-switch">New to RootPulse AI? <Link to="/register">Create an account</Link></p></AuthFrame>;
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [securityAnswer1, setSecurityAnswer1] = useState("");
  const [securityAnswer2, setSecurityAnswer2] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setIsSubmitting(true);
    try {
      await register({ full_name: fullName.trim(), username: username.trim(), password, phone: phone.trim() || undefined, security_answer1: securityAnswer1, security_answer2: securityAnswer2 });
      navigate("/login?registered=1", { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create your account. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return <AuthFrame mode="register"><form className="auth-form register-form" onSubmit={submit}>
    <label className="auth-field" htmlFor="register-name">Full name<input id="register-name" type="text" value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" minLength={2} maxLength={80} required /></label>
    <label className="auth-field" htmlFor="register-username">Username<input id="register-username" type="text" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" minLength={3} maxLength={32} pattern="[A-Za-z0-9_]+" title="Use 3â€“32 letters, numbers, or underscores." required /></label>
    <label className="auth-field" htmlFor="register-phone">Phone number <span className="auth-optional">Optional</span><input id="register-phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" maxLength={20} placeholder="+91 98765 43210" /></label>
    <label className="auth-field" htmlFor="register-answer1">What is your pet name?<input id="register-answer1" type="text" value={securityAnswer1} onChange={(event) => setSecurityAnswer1(event.target.value)} autoComplete="off" minLength={1} maxLength={200} required /></label>
    <label className="auth-field" htmlFor="register-answer2">What is the name of your childhood best friend?<input id="register-answer2" type="text" value={securityAnswer2} onChange={(event) => setSecurityAnswer2(event.target.value)} autoComplete="off" minLength={1} maxLength={200} required /></label>
    <p className="auth-password-hint">Answers are stored securely and are used only for account recovery.</p>
    <PasswordField id="register-password" label="Password" value={password} onChange={setPassword} autoComplete="new-password" />
    <PasswordField id="register-confirm-password" label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
    <p className="auth-password-hint">Use 8â€“128 characters.</p>
    {error && <div className="auth-error" role="alert">{error}</div>}
    <button type="submit" className="auth-submit" disabled={isSubmitting}>{isSubmitting ? <><LoaderCircle size={17} className="spin" />Creating accountâ€¦</> : <>Create account <ArrowRight size={17} /></>}</button>
  </form><p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p></AuthFrame>;
}


const RECOVERY_GENERIC_MESSAGE = "We could not verify this account. If you can still sign in, sign in and set up recovery answers.";

type RecoveryStage = "username" | "answers" | "password";

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<RecoveryStage>("username");
  const [username, setUsername] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [answer1, setAnswer1] = useState("");
  const [answer2, setAnswer2] = useState("");
  const [recoveryToken, setRecoveryToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function findAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setIsSubmitting(true);
    try {
      const result = await getRecoveryQuestions(username.trim());
      if (result.status !== "available" || !result.questions) { setError(RECOVERY_GENERIC_MESSAGE); return; }
      setQuestions(result.questions); setStage("answers");
    } catch { setError(RECOVERY_GENERIC_MESSAGE); }
    finally { setIsSubmitting(false); }
  }

  async function verifyAnswers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setIsSubmitting(true);
    try {
      const result = await verifyRecoveryAnswers(username.trim(), answer1, answer2);
      setRecoveryToken(result.recovery_token); setAnswer1(""); setAnswer2(""); setStage("password");
    } catch { setError(RECOVERY_GENERIC_MESSAGE); }
    finally { setIsSubmitting(false); }
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }
    setIsSubmitting(true);
    try {
      await resetFarmerPassword(username.trim(), recoveryToken, newPassword);
      setRecoveryToken(""); setNewPassword(""); setConfirmPassword("");
      navigate("/login?reset=1", { replace: true });
    } catch (reason) {
      const responseMessage = reason && typeof reason === "object" && "response" in reason
        ? (reason.response as { data?: { error?: string; message?: string } })?.data
        : undefined;
      setError(responseMessage?.error || responseMessage?.message || "Could not reset your password. Please restart account recovery.");
      setRecoveryToken(""); setStage("username");
    } finally { setIsSubmitting(false); }
  }

  return <AuthFrame mode="forgot">
    {stage === "username" && <form className="auth-form" onSubmit={findAccount}>
      <label className="auth-field" htmlFor="recovery-username">Username<input id="recovery-username" type="text" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" minLength={3} maxLength={32} required /></label>
      <p className="auth-password-hint">Enter your account username to continue.</p>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <button type="submit" className="auth-submit" disabled={isSubmitting}>{isSubmitting ? <><LoaderCircle size={17} className="spin" />Checking…</> : <>Continue <ArrowRight size={17} /></>}</button>
    </form>}
    {stage === "answers" && <form className="auth-form" onSubmit={verifyAnswers}>
      {questions.map((question, index) => <label className="auth-field" htmlFor={`recovery-answer-${index + 1}`} key={question}>{question}<input id={`recovery-answer-${index + 1}`} type="text" value={index === 0 ? answer1 : answer2} onChange={(event) => index === 0 ? setAnswer1(event.target.value) : setAnswer2(event.target.value)} autoComplete="off" maxLength={200} required /></label>)}
      {error && <div className="auth-error" role="alert">{error}</div>}
      <button type="submit" className="auth-submit" disabled={isSubmitting}>{isSubmitting ? <><LoaderCircle size={17} className="spin" />Verifying…</> : <>Verify answers <ArrowRight size={17} /></>}</button>
    </form>}
    {stage === "password" && <form className="auth-form" onSubmit={updatePassword}>
      <PasswordField id="recovery-new-password" label="New password" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
      <PasswordField id="recovery-confirm-password" label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
      <p className="auth-password-hint">Use 8–128 characters.</p>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <button type="submit" className="auth-submit" disabled={isSubmitting}>{isSubmitting ? <><LoaderCircle size={17} className="spin" />Updating password…</> : <>Set new password <ArrowRight size={17} /></>}</button>
    </form>}
    <p className="auth-switch"><Link to="/login">Back to sign in</Link></p>
  </AuthFrame>;
}


export function RecoverySetupPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [answer1, setAnswer1] = useState("");
  const [answer2, setAnswer2] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await setupRecoveryAnswers(answer1, answer2);
      navigate("/", { replace: true });
    } catch (reason) {
      const responseMessage = reason && typeof reason === "object" && "response" in reason
        ? (reason.response as { data?: { error?: string } })?.data?.error
        : undefined;
      setError(responseMessage || "Could not save your recovery answers. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (user?.recovery_configured !== false) return <Navigate to="/" replace />;

  return <AuthFrame mode="forgot"><form className="auth-form" onSubmit={submit}>
    <div className="auth-success" role="status">Your account does not have recovery answers yet. Add them now so you can reset your password later.</div>
    <label className="auth-field" htmlFor="setup-recovery-answer1">What is your pet name?<input id="setup-recovery-answer1" type="text" value={answer1} onChange={(event) => setAnswer1(event.target.value)} autoComplete="off" maxLength={200} required /></label>
    <label className="auth-field" htmlFor="setup-recovery-answer2">What is the name of your childhood best friend?<input id="setup-recovery-answer2" type="text" value={answer2} onChange={(event) => setAnswer2(event.target.value)} autoComplete="off" maxLength={200} required /></label>
    <p className="auth-password-hint">Answers are saved as secure hashes and cannot be viewed later.</p>
    {error && <div className="auth-error" role="alert">{error}</div>}
    <button type="submit" className="auth-submit" disabled={isSubmitting}>{isSubmitting ? <><LoaderCircle size={17} className="spin" />Saving answers...</> : <>Save recovery answers <ArrowRight size={17} /></>}</button>
    <p className="auth-switch">Signed in as {user?.username}</p>
  </form></AuthFrame>;
}
