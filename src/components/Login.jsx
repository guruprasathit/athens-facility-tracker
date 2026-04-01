import { useState } from "react";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!username.trim()) {
      setError("Please enter your username.");
      return;
    }
    if (!password.trim()) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim().toLowerCase(),
          password: password.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        onLogin(data.user);
      } else {
        setError(data.error || "Invalid username or password.");
      }
    } catch (err) {
      setError("Unable to connect. Please check your internet and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=Rajdhani:wght@400;500;600&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .login-root {
          min-height: 100vh;
          background: #0a0f1e;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Rajdhani', sans-serif;
          position: relative;
          overflow: hidden;
        }

        /* Ambient background rings */
        .login-root::before {
          content: '';
          position: absolute;
          width: 600px;
          height: 600px;
          border-radius: 50%;
          border: 1px solid rgba(212,175,55,0.08);
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation: pulse 6s ease-in-out infinite;
        }
        .login-root::after {
          content: '';
          position: absolute;
          width: 900px;
          height: 900px;
          border-radius: 50%;
          border: 1px solid rgba(212,175,55,0.04);
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation: pulse 6s ease-in-out infinite 1.5s;
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1.03); }
        }

        .login-card {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 420px;
          margin: 20px;
          background: linear-gradient(160deg, #0d1630 0%, #111827 100%);
          border: 1px solid rgba(212,175,55,0.25);
          border-radius: 4px;
          padding: 48px 40px 40px;
          box-shadow:
            0 0 0 1px rgba(212,175,55,0.05),
            0 25px 60px rgba(0,0,0,0.6),
            inset 0 1px 0 rgba(212,175,55,0.1);
          animation: slideUp 0.5s cubic-bezier(0.16,1,0.3,1) both;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Gold top accent bar */
        .login-card::before {
          content: '';
          position: absolute;
          top: 0; left: 10%; right: 10%;
          height: 2px;
          background: linear-gradient(90deg, transparent, #d4af37, #f0c93a, #d4af37, transparent);
          border-radius: 0 0 2px 2px;
        }

        .login-logo {
          text-align: center;
          margin-bottom: 32px;
        }

        .login-logo-icon {
          width: 52px;
          height: 52px;
          margin: 0 auto 14px;
          background: linear-gradient(135deg, #d4af37, #f0c93a);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          box-shadow: 0 4px 20px rgba(212,175,55,0.3);
        }

        .login-title {
          font-family: 'Playfair Display', serif;
          font-size: 22px;
          font-weight: 700;
          color: #f0c93a;
          letter-spacing: 0.5px;
          line-height: 1.2;
        }

        .login-subtitle {
          font-size: 13px;
          color: rgba(255,255,255,0.4);
          margin-top: 4px;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          font-weight: 500;
        }

        .login-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 28px;
        }
        .login-divider span {
          flex: 1;
          height: 1px;
          background: rgba(212,175,55,0.15);
        }
        .login-divider p {
          font-size: 11px;
          color: rgba(255,255,255,0.25);
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .field {
          margin-bottom: 18px;
        }

        .field label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 1.8px;
          text-transform: uppercase;
          color: rgba(212,175,55,0.7);
          margin-bottom: 8px;
        }

        .field-wrap {
          position: relative;
        }

        .field input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(212,175,55,0.2);
          border-radius: 3px;
          padding: 12px 16px;
          font-family: 'Rajdhani', sans-serif;
          font-size: 15px;
          font-weight: 500;
          color: #fff;
          outline: none;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
          letter-spacing: 0.3px;
        }

        .field input::placeholder {
          color: rgba(255,255,255,0.2);
          font-weight: 400;
        }

        .field input:focus {
          border-color: rgba(212,175,55,0.6);
          background: rgba(212,175,55,0.05);
          box-shadow: 0 0 0 3px rgba(212,175,55,0.08);
        }

        .field input.has-toggle {
          padding-right: 44px;
        }

        .toggle-btn {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: rgba(255,255,255,0.3);
          font-size: 16px;
          padding: 4px;
          line-height: 1;
          transition: color 0.2s;
        }
        .toggle-btn:hover { color: rgba(212,175,55,0.7); }

        .error-box {
          background: rgba(220,38,38,0.1);
          border: 1px solid rgba(220,38,38,0.3);
          border-radius: 3px;
          padding: 10px 14px;
          margin-bottom: 18px;
          font-size: 13px;
          color: #fca5a5;
          letter-spacing: 0.3px;
          animation: shake 0.3s ease;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }

        .submit-btn {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #c9a227, #f0c93a, #c9a227);
          background-size: 200% 100%;
          background-position: 100% 0;
          border: none;
          border-radius: 3px;
          font-family: 'Rajdhani', sans-serif;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 2.5px;
          text-transform: uppercase;
          color: #0a0f1e;
          cursor: pointer;
          transition: background-position 0.4s, transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 4px 20px rgba(212,175,55,0.25);
          margin-top: 8px;
        }

        .submit-btn:hover:not(:disabled) {
          background-position: 0 0;
          box-shadow: 0 6px 28px rgba(212,175,55,0.4);
          transform: translateY(-1px);
        }

        .submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .spinner {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid rgba(10,15,30,0.3);
          border-top-color: #0a0f1e;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          vertical-align: middle;
          margin-right: 8px;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .login-footer {
          text-align: center;
          margin-top: 28px;
          font-size: 11px;
          color: rgba(255,255,255,0.2);
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .login-footer strong {
          color: rgba(212,175,55,0.4);
        }
      `}</style>

      <div className="login-root">
        <div className="login-card">

          {/* Logo / Branding */}
          <div className="login-logo">
            <div className="login-logo-icon">🏛️</div>
            <div className="login-title">Athens Community</div>
            <div className="login-subtitle">Facility Tracker</div>
          </div>

          <div className="login-divider">
            <span /><p>Sign In</p><span />
          </div>

          {/* Error */}
          {error && <div className="error-box">⚠ {error}</div>}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate>

            <div className="field">
              <label>Username</label>
              <div className="field-wrap">
                <input
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError(""); }}
                  autoComplete="username"
                  autoFocus
                  disabled={loading}
                />
              </div>
            </div>

            <div className="field">
              <label>Password</label>
              <div className="field-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  className="has-toggle"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(""); }}
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="toggle-btn"
                  onClick={() => setShowPassword(v => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="submit-btn"
              disabled={loading}
            >
              {loading
                ? <><span className="spinner" />Signing In...</>
                : "Sign In"
              }
            </button>
          </form>

          <div className="login-footer">
            <strong>CAAOA</strong> · Casagrand Athens
          </div>

        </div>
      </div>
    </>
  );
}
