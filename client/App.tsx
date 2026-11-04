import { FormEvent, useEffect, useState } from "react";
import RecipeApp from "./recipes/RecipeApp.js";

type User = { id: number; displayName: string };
type Mode = "login" | "signup";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "Something went wrong. Please try again.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    request<{ user: User }>("/api/auth/me")
      .then(({ user: currentUser }) => setUser(currentUser))
      .catch((error: Error) => {
        if (error.message !== "Please log in to continue.") {
          setLoadError("We couldn’t connect to Back Bar. Refresh to try again.");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <main className="loading" aria-live="polite">Opening Back Bar…</main>;
  }

  if (loadError) {
    return <main className="loading error-page" role="alert">{loadError}</main>;
  }

  if (user) {
    return (
      <RecipeApp
        displayName={user.displayName}
        onLogout={async () => {
          await request("/api/auth/logout", { method: "POST" });
          window.history.replaceState({}, "", "/");
          setUser(null);
          setMode("login");
        }}
      />
    );
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <a className="brand auth-brand" href="/" aria-label="Back Bar home">back bar<span>.</span></a>
        <p className="eyebrow">YOUR PERSONAL RECIPE BOX</p>
        <h1>{mode === "login" ? "Welcome back." : "Make yourself at home."}</h1>
        <p className="intro">
          {mode === "login"
            ? "Log in to find your recipes and see what’s in your bar."
            : "Create an account for your own recipes and home bar."}
        </p>

        <AuthForm
          mode={mode}
          onSuccess={setUser}
          onModeChange={(nextMode) => setMode(nextMode)}
        />
        <div className="mode-switch">
          {mode === "login" ? (
            <>New to Back Bar? <button onClick={() => setMode("signup")}>Create an account</button></>
          ) : (
            <>Already have an account? <button onClick={() => setMode("login")}>Log in</button></>
          )}
        </div>
      </section>
      <footer className="auth-footer">A quiet place for the drinks you love.</footer>
    </main>
  );
}

function AuthForm({
  mode,
  onSuccess,
}: {
  mode: Mode;
  onSuccess: (user: User) => void;
  onModeChange: (mode: Mode) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isSignup = mode === "signup";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await request<{ user: User }>(
        isSignup ? "/api/auth/signup" : "/api/auth/login",
        {
          method: "POST",
          body: JSON.stringify(
            isSignup ? { displayName, username, password } : { username, password },
          ),
        },
      );
      onSuccess(result.user);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      {isSignup && (
        <label>
          Display name
          <input
            autoComplete="name"
            maxLength={80}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            value={displayName}
          />
        </label>
      )}
      <label>
        Username
        <input
          autoComplete="username"
          maxLength={64}
          minLength={3}
          onChange={(event) => setUsername(event.target.value)}
          required
          value={username}
        />
      </label>
      <label>
        Password
        <input
          autoComplete={isSignup ? "new-password" : "current-password"}
          minLength={isSignup ? 8 : undefined}
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
        {isSignup && <span className="field-hint">At least 8 characters</span>}
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" disabled={submitting} type="submit">
        {submitting
          ? "Please wait…"
          : isSignup
            ? "Create account"
            : "Log in"}
      </button>
    </form>
  );
}
