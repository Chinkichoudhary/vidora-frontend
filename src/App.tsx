import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import "./App.css";

type Tab = "text" | "pdf";
type Screen = "home" | "login" | "signup" | "dashboard" | "pricing";

type ProgressStep = {
  id: string;
  label: string;
  status: "waiting" | "active" | "done" | "error";
};

type User = {
  id: number;
  name: string;
  email: string;
};

type VideoRecord = {
  id: number;
  topic: string;
  video_url: string;
  duration_seconds: number;
  scene_count: number;
  created_at: string;
};

type BillingStatus = {
  plan: string;
  subscription_status: string;
  videos_used: number;
  videos_limit: number;
  period_start?: string | null;
  has_audio: boolean;
  languages: string[];
  durations: number[];
  voices_by_language: Record<string, string[]>;
};

const INITIAL_STEPS: ProgressStep[] = [
  { id: "reading", label: "Reading your content", status: "waiting" },
  { id: "script", label: "Writing script with AI", status: "waiting" },
  { id: "voice", label: "Generating voiceover", status: "waiting" },
  { id: "rendering", label: "Rendering video", status: "waiting" },
  { id: "finalizing", label: "Finalizing your video", status: "waiting" },
];


const API = "https://vidora-backend-app-production-2235.up.railway.app";
const GOOGLE_CLIENT_ID = "561900479161-bqs4r2lo7qflfcr1v03arli1t8ppico8.apps.googleusercontent.com";

const PLAN_DISPLAY: Record<string, { name: string; price: string; features: string[] }> = {
  free: {
    name: "Free",
    price: "₹0",
    features: ["1 video per month", "3 minute videos", "No narration or voice", "Basic support"],
  },
  basic: {
    name: "Basic",
    price: "₹199",
    features: ["5 videos per month", "1, 3, 5 or 7 minute videos", "5 voices • Hindi & English", "Email support"],
  },
  premium: {
    name: "Premium",
    price: "₹499",
    features: ["22 videos per month", "1 to 20 minute videos", "All voices • All languages", "Priority support"],
  },
};

const VOICE_LABELS: Record<string, string> = {
  "en-US-AriaNeural": "Aria (US English)",
  "en-US-GuyNeural": "Guy (US English)",
  "en-IN-NeerjaNeural": "Neerja (Indian English)",
  "hi-IN-SwaraNeural": "Swara (Hindi)",
  "hi-IN-MadhurNeural": "Madhur (Hindi)",
  "es-ES-ElviraNeural": "Elvira (Spanish)",
  "es-ES-AlvaroNeural": "Alvaro (Spanish)",
  "fr-FR-DeniseNeural": "Denise (French)",
  "fr-FR-HenriNeural": "Henri (French)",
  "de-DE-KatjaNeural": "Katja (German)",
  "de-DE-ConradNeural": "Conrad (German)",
  "ta-IN-PallaviNeural": "Pallavi (Tamil)",
  "ta-IN-ValluvarNeural": "Valluvar (Tamil)",
  "te-IN-ShrutiNeural": "Shruti (Telugu)",
  "te-IN-MohanNeural": "Mohan (Telugu)",
  "ja-JP-NanamiNeural": "Nanami (Japanese)",
  "ja-JP-KeitaNeural": "Keita (Japanese)",
};

function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<Tab>("text");
  const [textInput, setTextInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [steps, setSteps] = useState<ProgressStep[]>(INITIAL_STEPS);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [videoSize, setVideoSize] = useState<string | null>(null);
  const [generatingDuration, setGeneratingDuration] = useState<number | null>(null);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupLoading, setSignupLoading] = useState(false);

  const [myVideos, setMyVideos] = useState<VideoRecord[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);

  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>("english");
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [selectedDuration, setSelectedDuration] = useState<number>(3);
  const [subscribeLoading, setSubscribeLoading] = useState<string | null>(null);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
  const savedToken = localStorage.getItem("vidora_token");
  const savedUser = localStorage.getItem("vidora_user");

  if (savedToken && savedUser) {
    setToken(savedToken);
    setUser(JSON.parse(savedUser));

    (async () => {
      try {
        const res = await fetch(API + "/billing/status", {
          headers: {
            Authorization: "Bearer " + savedToken,
          },
        });

        if (!res.ok) return;

        const data: BillingStatus = await res.json();
        setBillingStatus(data);
      } catch {}
    })();
  }
}, []);

  const saveAuth = (tok: string, usr: User) => {
    setToken(tok);
    setUser(usr);
    localStorage.setItem("vidora_token", tok);
    localStorage.setItem("vidora_user", JSON.stringify(usr));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setBillingStatus(null);
    localStorage.removeItem("vidora_token");
    localStorage.removeItem("vidora_user");
    setScreen("home");
  };

  const loadMyVideos = async (tok?: string) => {
    const useToken = tok || token;
    if (!useToken) return;
    setVideosLoading(true);
    try {
      const res = await fetch(API + "/my-videos", {
        headers: { Authorization: "Bearer " + useToken },
      });
      const data = await res.json();
      setMyVideos(data.videos || []);
    } catch {
      setMyVideos([]);
    } finally {
      setVideosLoading(false);
    }
  };

  const loadBillingStatus = useCallback(async (tok?: string) => {
  const useToken = tok || token;
  if (!useToken) return;

  try {
    const res = await fetch(API + "/billing/status", {
      headers: { Authorization: "Bearer " + useToken },
    });

    if (!res.ok) {
      setBillingStatus(null);
      return;
    }

    const data: BillingStatus = await res.json();
    setBillingStatus(data);

    if (data.languages && data.languages.length > 0) {
      setSelectedLanguage((prevLang) => {
        const lang = data.languages.includes(prevLang)
          ? prevLang
          : data.languages[0];

        const voices = data.voices_by_language?.[lang] || [];

        setSelectedVoice((prevVoice) =>
          voices.includes(prevVoice) ? prevVoice : voices[0] || ""
        );

        return lang;
      });
    }

    if (data.durations && data.durations.length > 0) {
      setSelectedDuration((prev) =>
        data.durations.includes(prev) ? prev : data.durations[0]
      );
    }
  } catch {
    setBillingStatus(null);
  }
}, [token]);

  const handleLanguageChange = (lang: string) => {
    setSelectedLanguage(lang);
    const voices = billingStatus?.voices_by_language?.[lang] || [];
    setSelectedVoice(voices[0] || "");
  };

  const handleLogin = async () => {
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await fetch(API + "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Login failed");
      saveAuth(data.token, data.user);
      setLoginEmail("");
      setLoginPassword("");
      setScreen("dashboard");
      loadMyVideos(data.token);
      loadBillingStatus(data.token);
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSignup = async () => {
    setSignupLoading(true);
    setSignupError(null);
    try {
      const res = await fetch(API + "/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: signupName,
          email: signupEmail,
          password: signupPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Signup failed");
      saveAuth(data.token, data.user);
      setSignupName("");
      setSignupEmail("");
      setSignupPassword("");
      setScreen("dashboard");
      loadMyVideos(data.token);
      loadBillingStatus(data.token);
    } catch (err: any) {
      setSignupError(err.message);
    } finally {
      setSignupLoading(false);
    }
  };

  const handleGoogleLogin = async (credential: string) => {
    try {
      const res = await fetch(API + "/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Google login failed");
      saveAuth(data.token, data.user);
      setScreen("dashboard");
      loadMyVideos(data.token);
      loadBillingStatus(data.token);
    } catch (err: any) {
      setLoginError(err.message);
      setSignupError(err.message);
    }
  };

  const handleSubscribe = async (planKey: "basic" | "premium") => {
    if (!token) {
      setScreen("login");
      return;
    }
    setSubscribeLoading(planKey);
    setSubscribeError(null);
    try {
      console.log("Token:", token);
      const res = await fetch(API + "/billing/create-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ plan: planKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not start subscription");

      const win = window as any;
      if (!win.Razorpay) {
        throw new Error("Payment system is still loading. Please try again in a moment.");
      }

      const rzp = new win.Razorpay({
        key: data.razorpay_key_id,
        subscription_id: data.subscription_id,
        name: "Vidora",
        description:
          planKey === "basic" ? "Vidora Basic Plan - Monthly" : "Vidora Premium Plan - Monthly",
        theme: { color: "#6366f1" },
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
        },
        handler: async (response: any) => {
          try {
            const verifyRes = await fetch(API + "/billing/verify-subscription", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + token,
              },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_subscription_id: response.razorpay_subscription_id,
                razorpay_signature: response.razorpay_signature,
                plan: planKey,
              }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.detail || "Verification failed");
            await loadBillingStatus();
            setScreen("dashboard");
          } catch (err: any) {
            setSubscribeError(err.message || "Payment verification failed.");
          }
        },
        modal: {
          ondismiss: () => {
            setSubscribeLoading(null);
          },
        },
      });

      rzp.on("payment.failed", () => {
        setSubscribeError("Payment failed. Please try again.");
        setSubscribeLoading(null);
      });

      rzp.open();
      setSubscribeLoading(null);
    } catch (err: any) {
      setSubscribeError(err.message || "Something went wrong.");
      setSubscribeLoading(null);
    }
  };

  const isReady =
  activeTab === "text"
    ? (console.log("Text length:", textInput.length), textInput.trim().length > 20)
    : (console.log("Selected file:", selectedFile), selectedFile !== null);
  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const handleFileSelect = (file: File) => {
    if (file.type === "application/pdf") {
      setSelectedFile(file);
    } else {
      alert("Please upload a PDF file only.");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const updateStep = (index: number, status: ProgressStep["status"]) => {
    setSteps((prev) =>
      prev.map((step, i) => (i === index ? { ...step, status } : step))
    );
  };

  const handleDownload = () => {
    if (!videoUrl) return;
    const link = document.createElement("a");
    link.href = videoUrl;
    link.download = "vidora-video.mp4";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerate = async () => {
    if (!isReady) return;
    setIsGenerating(true);
    setError(null);
    setVideoUrl(null);
    setVideoDuration(null);
    setVideoSize(null);
    setGeneratingDuration(null);
    setSteps(INITIAL_STEPS);

    try {
      const formData = new FormData();
      if (activeTab === "text") {
        formData.append("raw_text", textInput);
      } else if (selectedFile) {
        formData.append("file", selectedFile);
      }
      if (billingStatus?.has_audio) {
        formData.append("language", selectedLanguage);
        formData.append("voice", selectedVoice);
      }
      formData.append("duration_minutes", String(selectedDuration));

      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = "Bearer " + token;

      let startData;
      try {
        const startRes = await fetch(API + "/start-render", {
          method: "POST",
          headers,
          body: formData,
        });
        startData = await startRes.json();
      } catch {
        throw new Error("Cannot reach backend. Make sure FastAPI is running.");
      }

      if (startData.error) {
        if (startData.error.toLowerCase().includes("log in")) {
          logout();
          throw new Error("Your session expired. Please log in again to continue.");
        }
        throw new Error(startData.error);
      }

      setGeneratingDuration(startData.duration_minutes ?? selectedDuration);
      updateStep(0, "done");
      updateStep(1, "active");

      const jobId = startData.job_id;
      const stepIndexFromBackend = (stepName: string): number => {
        if (stepName.includes("Finalizing")) return 4;
        if (stepName.includes("Rendering")) return 3;
        if (stepName.includes("voiceover")) return 2;
        if (stepName.includes("Writing")) return 1;
        return 0;
      };

      while (true) {
        await delay(5000);
        const statusRes = await fetch(API + "/job-status/" + jobId);
        const statusData = await statusRes.json();

        if (statusData.error === "Job not found") {
          throw new Error("Job not found. Please try again.");
        }

        const stepName = statusData.step || "";
        const currentIdx = stepIndexFromBackend(stepName);
        setSteps((prev) =>
          prev.map((step, i) => {
            if (i < currentIdx) return { ...step, status: "done" };
            if (i === currentIdx) return { ...step, status: "active" };
            return step;
          })
        );

        if (statusData.status === "done") {
          updateStep(3, "done");
          updateStep(4, "active");
          await delay(500);
          updateStep(4, "done");

          const finalVideoUrl = statusData.video_url;
          const finalDuration = statusData.total_duration_seconds;

          setVideoUrl(finalVideoUrl);
          setVideoDuration(finalDuration);
          setIsGenerating(false);

          loadBillingStatus();

          try {
            const headRes = await fetch(finalVideoUrl, { method: "HEAD" });
            const sizeBytes = headRes.headers.get("content-length");
            if (sizeBytes) {
              const sizeMB = (parseInt(sizeBytes) / (1024 * 1024)).toFixed(1);
              setVideoSize(sizeMB + " MB");
            }
          } catch {
            setVideoSize(null);
          }

          return;
        }

        if (statusData.status === "error") {
          throw new Error(statusData.error || "Render failed.");
        }
      }
    } catch (err: any) {
      setSteps((prev) =>
        prev.map((step) =>
          step.status === "active" ? { ...step, status: "error" } : step
        )
      );
      setError(err.message || "Something went wrong. Please try again.");
    }
  };

  const handleReset = () => {
    setVideoUrl(null);
    setError(null);
    setSteps(INITIAL_STEPS);
    setTextInput("");
    setSelectedFile(null);
    setIsGenerating(false);
    setVideoSize(null);
    setVideoDuration(null);
    setGeneratingDuration(null);
  };

  const GoogleButton = ({ buttonText }: { buttonText: string }) => {
    useEffect(() => {
      const win = window as any;
      const tryRender = () => {
        if (win.google && win.google.accounts) {
          win.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: (response: any) => {
              handleGoogleLogin(response.credential);
            },
          });
          const el = document.getElementById("google-btn-" + buttonText);
          if (el) {
            win.google.accounts.id.renderButton(el, {
              theme: "filled_black",
              size: "large",
              width: 340,
              text: buttonText === "login" ? "signin_with" : "signup_with",
              shape: "rectangular",
            });
          }
        } else {
          setTimeout(tryRender, 500);
        }
      };
      tryRender();
    }, [buttonText]);

    return (
      <div
        id={"google-btn-" + buttonText}
        style={{ marginBottom: 20, display: "flex", justifyContent: "center" }}
      />
    );
  };

  const Navbar = () => {
    const isPureHome = screen === "home" && !videoUrl && !isGenerating;

    return (
      <nav className="navbar">
        <div
          className="logo"
          onClick={() => setScreen("home")}
          style={{ cursor: "pointer" }}
        >
          <div className="logo-icon">V</div>
          <span className="logo-text">Vidora</span>
        </div>
        <div className="nav-right">
          {!isPureHome && (
            <button
              className="nav-btn outline"
              onClick={() => setScreen("home")}
              style={{ marginRight: 10 }}
            >
              Home
            </button>
          )}
          {screen !== "pricing" && (
            <button
              className="nav-btn outline"
              onClick={() => setScreen("pricing")}
              style={{ marginRight: 10 }}
            >
              Pricing
            </button>
          )}
          {user ? (
            <div className="nav-user">
              {billingStatus && (
                <span className="plan-badge">{PLAN_DISPLAY[billingStatus.plan]?.name || billingStatus.plan}</span>
              )}
              <span className="nav-username">Hi, {user.name.split(" ")[0]}</span>
              <button
                className="nav-btn outline"
                onClick={() => {
                  setScreen("dashboard");
                  loadMyVideos();
                  loadBillingStatus();
                }}
              >
                My Videos
              </button>
              <button className="nav-btn outline" onClick={logout}>
                Logout
              </button>
            </div>
          ) : (
            <div className="nav-auth">
              <button
                className="nav-btn outline"
                onClick={() => setScreen("login")}
              >
                Login
              </button>
              <button
                className="nav-btn"
                onClick={() => setScreen("signup")}
              >
                Sign Up Free
              </button>
            </div>
          )}
        </div>
      </nav>
    );
  };

  if (screen === "pricing") {
    return (
      <div className="app">
        <Navbar />
        <div className="pricing-screen">
          <h2 className="pricing-title">Choose Your Plan</h2>
          <p className="pricing-subtitle">
            {billingStatus
              ? `You're currently on the ${PLAN_DISPLAY[billingStatus.plan]?.name || billingStatus.plan} plan (${billingStatus.videos_used}/${billingStatus.videos_limit} videos used this month)`
              : "Pick a plan that fits how often you create videos"}
          </p>

          {subscribeError && <div className="auth-error" style={{ maxWidth: 500, margin: "0 auto 24px" }}>{subscribeError}</div>}

          <div className="pricing-grid">
            {(["free", "basic", "premium"] as const).map((planKey) => {
              const plan = PLAN_DISPLAY[planKey];
              const isCurrent = billingStatus?.plan === planKey;
              return (
                <div
                  key={planKey}
                  className={"pricing-card " + (planKey === "premium" ? "pricing-card-featured" : "")}
                >
                  {planKey === "premium" && <div className="pricing-badge">Most Popular</div>}
                  <div className="pricing-card-name">{plan.name}</div>
                  <div className="pricing-card-price">
                    {plan.price}
                    <span className="pricing-card-period">/month</span>
                  </div>
                  <ul className="pricing-card-features">
                    {plan.features.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                  {planKey === "free" ? (
                    <button className="nav-btn outline" style={{ width: "100%" }} disabled>
                      {isCurrent ? "Current Plan" : "Default Plan"}
                    </button>
                  ) : (
                    <button
                      className="generate-btn"
                      style={{ marginTop: 0 }}
                      disabled={isCurrent || subscribeLoading === planKey}
                      onClick={() => handleSubscribe(planKey)}
                    >
                      {isCurrent
                        ? "Current Plan"
                        : subscribeLoading === planKey
                        ? "Opening checkout..."
                        : "Subscribe"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <footer className="footer">2026 Vidora - Learn Visually</footer>
      </div>
    );
  }

  if (screen === "login") {
    return (
      <div className="app">
        <Navbar />
        <div className="auth-screen">
          <div className="auth-card">
            <h2 className="auth-title">Welcome Back</h2>
            <p className="auth-subtitle">Login to your Vidora account</p>

            <GoogleButton buttonText="login" />

            <div className="auth-divider">
              <span>or continue with email</span>
            </div>

            <div className="auth-field">
              <label className="input-label">Email</label>
              <input
                className="auth-input"
                type="email"
                placeholder="you@example.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
              />
            </div>

            <div className="auth-field">
              <label className="input-label">Password</label>
              <input
                className="auth-input"
                type="password"
                placeholder="Your password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>

            {loginError && <div className="auth-error">{loginError}</div>}

            <button
              className="generate-btn"
              onClick={handleLogin}
              disabled={loginLoading || !loginEmail || !loginPassword}
            >
              {loginLoading ? "Logging in..." : "Login"}
            </button>

            <p className="auth-switch">
              Don't have an account?{" "}
              <span
                className="auth-link"
                onClick={() => setScreen("signup")}
              >
                Sign up free
              </span>
            </p>
          </div>
        </div>
        <footer className="footer">2026 Vidora - Learn Visually</footer>
      </div>
    );
  }

  if (screen === "signup") {
    return (
      <div className="app">
        <Navbar />
        <div className="auth-screen">
          <div className="auth-card">
            <h2 className="auth-title">Create Account</h2>
            <p className="auth-subtitle">
              Start generating educational videos for free
            </p>

            <GoogleButton buttonText="signup" />

            <div className="auth-divider">
              <span>or sign up with email</span>
            </div>

            <div className="auth-field">
              <label className="input-label">Full Name</label>
              <input
                className="auth-input"
                type="text"
                placeholder="Your name"
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
              />
            </div>

            <div className="auth-field">
              <label className="input-label">Email</label>
              <input
                className="auth-input"
                type="email"
                placeholder="you@example.com"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
              />
            </div>

            <div className="auth-field">
              <label className="input-label">Password</label>
              <input
                className="auth-input"
                type="password"
                placeholder="At least 6 characters"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSignup()}
              />
            </div>

            {signupError && <div className="auth-error">{signupError}</div>}

            <button
              className="generate-btn"
              onClick={handleSignup}
              disabled={
                signupLoading || !signupName || !signupEmail || !signupPassword
              }
            >
              {signupLoading ? "Creating account..." : "Create Account"}
            </button>

            <p className="auth-switch">
              Already have an account?{" "}
              <span
                className="auth-link"
                onClick={() => setScreen("login")}
              >
                Login
              </span>
            </p>
          </div>
        </div>
        <footer className="footer">2026 Vidora - Learn Visually</footer>
      </div>
    );
  }

  if (screen === "dashboard") {
    return (
      <div className="app">
        <Navbar />
        <div className="dashboard-screen">
          <div className="profile-card">
            <div className="profile-avatar">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="profile-info">
              <div className="profile-name">{user?.name}</div>
              <div className="profile-email">{user?.email}</div>
              <div className="profile-stats">
                {myVideos.length} video{myVideos.length !== 1 ? "s" : ""}{" "}
                generated
              </div>
              {billingStatus && (
                <div className="profile-plan-row">
                  <span className="plan-badge">
                    {PLAN_DISPLAY[billingStatus.plan]?.name || billingStatus.plan} plan
                  </span>
                  <span className="profile-plan-usage">
                    {billingStatus.videos_used}/{billingStatus.videos_limit} videos this month
                  </span>
                  <span
                    className="auth-link"
                    style={{ fontSize: 13 }}
                    onClick={() => setScreen("pricing")}
                  >
                    {billingStatus.plan === "premium" ? "Manage plan" : "Upgrade"}
                  </span>
                </div>
              )}
            </div>
            <button
              className="nav-btn"
              onClick={() => setScreen("home")}
            >
              Generate New Video
            </button>
          </div>

          <div className="dashboard-header">
            <h2 className="dashboard-title">My Videos</h2>
          </div>

          {videosLoading ? (
            <div className="dashboard-loading">Loading your videos...</div>
          ) : myVideos.length === 0 ? (
            <div className="dashboard-empty">
              <div className="empty-icon">🎬</div>
              <div className="empty-title">No videos yet</div>
              <div className="empty-desc">
                Generate your first video to see it here
              </div>
              <button
                className="generate-btn"
                style={{ marginTop: 24, width: "auto", padding: "14px 32px" }}
                onClick={() => setScreen("home")}
              >
                Generate Your First Video
              </button>
            </div>
          ) : (
            <div className="videos-grid">
              {myVideos.map((video) => (
                <div key={video.id} className="video-card">
                  <div className="video-card-icon">🎬</div>
                  <div className="video-card-topic">{video.topic}</div>
                  <div className="video-card-meta">
                    <span>
                      {Math.floor(video.duration_seconds / 60)}m{" "}
                      {video.duration_seconds % 60}s
                    </span>
                    <span>{video.scene_count} scenes</span>
                  </div>
                  <div className="video-card-date">
                    {new Date(video.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                  <button
                    className="nav-btn"
                    style={{ width: "100%", marginTop: 12 }}
                    onClick={() => {
                      setVideoUrl(video.video_url);
                      setScreen("home");
                    }}
                  >
                    Watch Video
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <footer className="footer">2026 Vidora - Learn Visually</footer>
      </div>
    );
  }

  if (videoUrl) {
    const mins = videoDuration ? Math.floor(videoDuration / 60) : 0;
    const secs = videoDuration ? Math.round(videoDuration % 60) : 0;

    return (
      <div className="app">
        <Navbar />
        <div className="result-screen">
          <div className="result-card">
            <div className="result-badge">Video Ready!</div>
            <h2 className="result-title">Your Educational Video is Ready</h2>
            <p className="result-subtitle">
              {videoDuration
                ? mins + "m " + secs + "s of narrated, animated content"
                : "Your video has been generated successfully"}
            </p>

            <div className="video-player-wrap">
              <video
                controls
                autoPlay
                className="video-player"
                src={videoUrl}
              >
                Your browser does not support the video tag.
              </video>
            </div>

            <div className="video-meta">
              {videoDuration && (
                <span className="meta-pill">{mins + "m " + secs + "s"}</span>
              )}
              {videoSize && <span className="meta-pill">{videoSize}</span>}
              <span className="meta-pill">MP4 - 1280x720</span>
            </div>

            <div className="result-actions">
              <button className="download-btn" onClick={handleDownload}>
                Download MP4
              </button>
              <button className="reset-btn" onClick={handleReset}>
                Generate Another Video
              </button>
            </div>

            <p className="result-note">
              Download your video now to keep a copy.
            </p>
          </div>
        </div>
        <footer className="footer">2026 Vidora - Learn Visually</footer>
      </div>
    );
  }

  if (isGenerating) {
    const doneCount = steps.filter((s) => s.status === "done").length;
    const progressPercent = (doneCount / steps.length) * 100;

    return (
      <div className="app">
        <Navbar />
        <div className="loading-screen">
          <div className="loading-card">
            <div className="loading-spinner">
              <div className="spinner-ring" />
            </div>
            <h2 className="loading-title">Creating Your Video</h2>
            {generatingDuration !== null && (
              <p style={{ color: "#818cf8", fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                Target length: {generatingDuration} minute{generatingDuration !== 1 ? "s" : ""}
              </p>
            )}
            <p className="loading-subtitle">
              This takes a few minutes for shorter videos, longer for extended
              durations. Please keep this tab open.
            </p>
            <div className="progress-bar-wrap">
              <div
                className="progress-bar-fill"
                style={{ width: progressPercent + "%" }}
              />
            </div>
            <div className="progress-percent">
              {Math.round(progressPercent)}% complete
            </div>
            <div className="steps-list">
              {steps.map((step) => (
                <div key={step.id} className={"step-item " + step.status}>
                  <div className="step-icon">
                    {step.status === "done" && <span>done</span>}
                    {step.status === "active" && (
                      <span className="pulse-dot" />
                    )}
                    {step.status === "waiting" && (
                      <span className="waiting-dot" />
                    )}
                    {step.status === "error" && <span>error</span>}
                  </div>
                  <div className="step-label">{step.label}</div>
                  {step.status === "active" && (
                    <div className="step-status-text">In progress...</div>
                  )}
                  {step.status === "done" && (
                    <div className="step-status-text done">Done</div>
                  )}
                </div>
              ))}
            </div>
            {error && (
              <div className="error-box">
                <div className="error-title">Something went wrong</div>
                <div className="error-msg">{error}</div>
                {error.toLowerCase().includes("limit") && (
                  <button
                    className="nav-btn"
                    style={{ marginRight: 10 }}
                    onClick={() => setScreen("pricing")}
                  >
                    View Plans
                  </button>
                )}
                <button className="reset-btn" onClick={handleReset}>
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>
        <footer className="footer">2026 Vidora - Learn Visually</footer>
      </div>
    );
  }

  return (
    <div className="app">
      <Navbar />
      <section className="hero">
        <div className="hero-badge">Powered by AI</div>
        <h1 className="hero-title">
          Turn Any Topic Into an
          <br />
          <span>Educational Video</span>
        </h1>
        <p className="hero-subtitle">
          Type a topic, paste your notes, or upload a PDF. Vidora generates a
          fully narrated, animated educational video in minutes.
        </p>

        {!user && (
          <div className="hero-cta">
            <button
              className="nav-btn"
              style={{ padding: "14px 32px", fontSize: 16 }}
              onClick={() => setScreen("signup")}
            >
              Get Started Free
            </button>
            <button
              className="nav-btn outline"
              style={{ padding: "14px 32px", fontSize: 16 }}
              onClick={() => setScreen("login")}
            >
              Login
            </button>
          </div>
        )}

        <div className="main-card" style={{ marginTop: user ? 0 : 32 }}>
          <div className="tabs">
            <button
              className={"tab " + (activeTab === "text" ? "active" : "")}
              onClick={() => setActiveTab("text")}
            >
              Type Topic or Paste Notes
            </button>
            <button
              className={"tab " + (activeTab === "pdf" ? "active" : "")}
              onClick={() => setActiveTab("pdf")}
            >
              Upload PDF
            </button>
          </div>

          {activeTab === "text" && (
            <div>
              <label className="input-label">Your Topic or Notes</label>
              <textarea
                className="text-input"
                placeholder="e.g. Explain how the human brain works..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
              />
              <div
                style={{
                  fontSize: 12,
                  color: "#334155",
                  marginTop: 8,
                  textAlign: "right",
                }}
              >
                {textInput.length} characters
              </div>
            </div>
          )}

          {activeTab === "pdf" && (
            <div>
              <label className="input-label">Upload PDF</label>
              <div
                className={"upload-zone " + (isDragOver ? "dragover" : "")}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
              >
                <div className="upload-icon">PDF</div>
                <div className="upload-text">
                  Drop your PDF here or click to browse
                </div>
                <div className="upload-subtext">
                  Research papers, textbook chapters, notes
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                />
              </div>
              {selectedFile && (
                <div className="file-selected">
                  <span className="file-name">{selectedFile.name}</span>
                  <span style={{ fontSize: 12, color: "#475569" }}>
                    {(selectedFile.size / 1024).toFixed(0)} KB
                  </span>
                  <button
                    className="file-remove"
                    onClick={() => setSelectedFile(null)}
                  >
                    X
                  </button>
                </div>
              )}
            </div>
          )}

          {user && billingStatus && (
            billingStatus.has_audio ? (
              <>
                <div style={{ marginTop: 20, marginBottom: 4 }}>
                  <label className="input-label">Narration Language</label>
                  <select
                    className="auth-input"
                    value={selectedLanguage}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    style={{ marginTop: 8 }}
                  >
                    {billingStatus.languages.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang.charAt(0).toUpperCase() + lang.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginTop: 16, marginBottom: 4 }}>
                  <label className="input-label">Narrator Voice</label>
                  <select
                    className="auth-input"
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    style={{ marginTop: 8 }}
                  >
                    {(billingStatus.voices_by_language[selectedLanguage] || []).map((v) => (
                      <option key={v} value={v}>
                        {VOICE_LABELS[v] || v}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 20, fontFamily: "sans-serif" }}>
                Your Free plan generates silent videos with no narration.{" "}
                <span className="auth-link" onClick={() => setScreen("pricing")}>
                  Upgrade for voice narration
                </span>
              </div>
            )
          )}

          {user && billingStatus && billingStatus.durations.length > 0 && (
            <div style={{ marginTop: 16, marginBottom: 4 }}>
              <label className="input-label">Video Length</label>
              <select
                className="auth-input"
                value={selectedDuration}
                onChange={(e) => setSelectedDuration(Number(e.target.value))}
                style={{ marginTop: 8 }}
              >
                {billingStatus.durations.map((mins) => (
                  <option key={mins} value={mins}>
                    {mins} minute{mins !== 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            className="generate-btn"
            onClick={handleGenerate}
            disabled={!isReady}
            style={{ marginTop: 20 }}
          >
            Generate Video
          </button>
        </div>
      </section>

      <section className="how-it-works">
        <h2 className="section-title">How It Works</h2>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">1</div>
            <div className="step-title">Input Your Content</div>
            <div className="step-desc">
              Type a topic, paste your notes, or upload a PDF.
            </div>
          </div>
          <div className="step-card">
            <div className="step-number">2</div>
            <div className="step-title">AI Generates Script</div>
            <div className="step-desc">
              Our AI creates scenes, narration, and visuals automatically.
            </div>
          </div>
          <div className="step-card">
            <div className="step-number">3</div>
            <div className="step-title">Download Your Video</div>
            <div className="step-desc">
              Get a fully animated, narrated educational video ready to share.
            </div>
          </div>
        </div>
      </section>

      <footer className="footer">2026 Vidora - Learn Visually</footer>
    </div>
  );
}

export default App;
