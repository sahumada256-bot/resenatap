"use client";

import { QRCodeSVG } from "qrcode.react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";

// ======================================================
// LOGIN - EDITÁ ESTOS DATOS
// ======================================================

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "RiverPlate10$";

const LOGIN_STORAGE_KEY = "resenatap_admin_logged_in";

// ======================================================
// CONFIGURACIÓN
// ======================================================

const BUSINESSES_PER_PAGE = 10;

// ======================================================
// TIPOS
// ======================================================

type Business = {
  id: string;
  name: string;
  google_review_url: string;
  created_at: string;
};

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

function createBusinessId(name: string) {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 35);

  const suffix = Math.random().toString(36).slice(2, 8);

  return `${slug || "comercio"}-${suffix}`;
}

function isValidGoogleReviewUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();

    const isGoogleHost =
      host === "google.com" ||
      host.endsWith(".google.com") ||
      host === "g.page" ||
      host.endsWith(".g.page") ||
      host === "maps.app.goo.gl";

    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      isGoogleHost
    );
  } catch {
    return false;
  }
}

// ======================================================
// COMPONENTE PRINCIPAL
// ======================================================

export default function HomePage() {
  // ====================================================
  // LOGIN
  // ====================================================

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingLogin, setIsCheckingLogin] = useState(true);

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // ====================================================
  // ADMIN
  // ====================================================

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // ====================================================
  // PÁGINA PÚBLICA
  // ====================================================

  const [publicBusinessId, setPublicBusinessId] = useState<string | null>(
    null
  );

  const [publicBusiness, setPublicBusiness] = useState<Business | null>(null);
  const [publicLoading, setPublicLoading] = useState(false);
  const [publicError, setPublicError] = useState("");

  const isPublicPage = publicBusinessId !== null;

  // ====================================================
  // COMERCIO SELECCIONADO
  // ====================================================

  const selectedBusiness =
    businesses.find((business) => business.id === selectedId) ?? null;

  // ====================================================
  // FILTRO DE COMERCIOS
  // ====================================================

  const filteredBusinesses = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return businesses;
    }

    return businesses.filter((business) =>
      business.name.toLowerCase().includes(normalizedSearch)
    );
  }, [businesses, searchTerm]);

  // ====================================================
  // PAGINACIÓN
  // ====================================================

  const totalPages = Math.max(
    1,
    Math.ceil(filteredBusinesses.length / BUSINESSES_PER_PAGE)
  );

  const paginatedBusinesses = filteredBusinesses.slice(
    (currentPage - 1) * BUSINESSES_PER_PAGE,
    currentPage * BUSINESSES_PER_PAGE
  );

  // ====================================================
  // URL PÚBLICA
  // ====================================================

  const landingUrl =
    selectedBusiness && typeof window !== "undefined"
      ? `${window.location.origin}/?b=${encodeURIComponent(
          selectedBusiness.id
        )}`
      : "";

  // ====================================================
  // CARGA INICIAL
  // ====================================================

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const businessId = params.get("b");

    // --------------------------------------------
    // PÁGINA PÚBLICA
    // --------------------------------------------

    if (businessId) {
      setPublicBusinessId(businessId);
      setPublicLoading(true);

      const loadPublicBusiness = async () => {
        const { data, error } = await supabase
          .from("businesses")
          .select("*")
          .eq("id", businessId)
          .single();

        if (error || !data) {
          setPublicError(
            "No encontramos este comercio o el enlace ya no está activo."
          );
          setPublicBusiness(null);
        } else {
          setPublicBusiness(data as Business);
        }

        setPublicLoading(false);
      };

      void loadPublicBusiness();

      return;
    }

    // --------------------------------------------
    // ADMIN
    // --------------------------------------------

    const loggedIn =
      sessionStorage.getItem(LOGIN_STORAGE_KEY) === "true";

    setIsLoggedIn(loggedIn);
    setIsCheckingLogin(false);

    if (loggedIn) {
      void loadBusinesses();
    } else {
      setIsLoading(false);
    }
  }, []);

  // ====================================================
  // CARGAR COMERCIOS
  // ====================================================

  async function loadBusinesses() {
    setIsLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("businesses")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMessage(
        "No pudimos cargar los comercios. Probá nuevamente."
      );

      setBusinesses([]);
    } else {
      setBusinesses((data ?? []) as Business[]);
    }

    setIsLoading(false);
  }

  // ====================================================
  // LOGIN
  // ====================================================

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoginError("");

    const username = loginUsername.trim();

    if (
      username === ADMIN_USERNAME &&
      loginPassword === ADMIN_PASSWORD
    ) {
      sessionStorage.setItem(LOGIN_STORAGE_KEY, "true");

      setIsLoggedIn(true);

      setLoginUsername("");
      setLoginPassword("");

      void loadBusinesses();

      return;
    }

    setLoginError("Usuario o contraseña incorrectos.");
  }

  // ====================================================
  // LOGOUT
  // ====================================================

  function handleLogout() {
    sessionStorage.removeItem(LOGIN_STORAGE_KEY);

    setIsLoggedIn(false);

    setSelectedId(null);
    setBusinesses([]);

    setBusinessName("");
    setGoogleReviewUrl("");

    setSearchTerm("");
    setCurrentPage(1);

    setErrorMessage("");
    setSuccessMessage("");
  }

  // ====================================================
  // REGISTRAR COMERCIO
  // ====================================================

  async function handleRegisterBusiness(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const cleanName = businessName.trim();
    const cleanUrl = googleReviewUrl.trim();

    if (!cleanName) {
      setErrorMessage("Ingresá el nombre del comercio.");
      return;
    }

    if (!isValidGoogleReviewUrl(cleanUrl)) {
      setErrorMessage(
        "Ingresá un enlace válido de Google para dejar reseñas."
      );
      return;
    }

    setIsSaving(true);

    const newBusiness = {
      id: createBusinessId(cleanName),
      name: cleanName,
      google_review_url: cleanUrl,
    };

    const { data, error } = await supabase
      .from("businesses")
      .insert(newBusiness)
      .select("*")
      .single();

    if (error || !data) {
      setErrorMessage(
        "No pudimos registrar el comercio. Revisá los datos e intentá otra vez."
      );

      setIsSaving(false);

      return;
    }

    const createdBusiness = data as Business;

    setBusinesses((previous) => [
      createdBusiness,
      ...previous,
    ]);

    setSelectedId(createdBusiness.id);

    setBusinessName("");
    setGoogleReviewUrl("");

    setSearchTerm("");
    setCurrentPage(1);

    setSuccessMessage(
      "¡Comercio registrado! Ya podés usar su QR y enlace."
    );

    setIsSaving(false);
  }

  // ====================================================
  // DESCARGAR QR
  // ====================================================

  function downloadQrCode() {
    const svg = document.getElementById("resenatap-qr");

    if (!svg || !selectedBusiness) {
      return;
    }

    const serializer = new XMLSerializer();
    const svgText = serializer.serializeToString(svg);

    const blob = new Blob([svgText], {
      type: "image/svg+xml;charset=utf-8",
    });

    const downloadUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download = `resenatap-${selectedBusiness.id}.svg`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(downloadUrl);
  }

  // ====================================================
  // BÚSQUEDA
  // ====================================================

  function changeSearch(value: string) {
    setSearchTerm(value);
    setCurrentPage(1);
  }

  // ====================================================
  // SELECCIONAR COMERCIO
  // ====================================================

  function openBusiness(businessId: string) {
    setSelectedId(businessId);
    setSuccessMessage("");
  }

  // ====================================================
  // CERRAR PANEL
  // ====================================================

  function closeBusinessPanel() {
    setSelectedId(null);
  }

  // ====================================================
  // PÁGINA PÚBLICA
  // ====================================================

  if (isPublicPage) {
    return (
      <main className="public-page">
        <div className="public-card">
          <div className="brand public-brand">
            <div className="brand-icon">N</div>

            <span>
              Reseña<span className="brand-blue">Tap</span>
            </span>
          </div>

          {publicLoading ? (
            <div className="public-message">
              <div className="spinner" />

              <p>Cargando comercio...</p>
            </div>
          ) : publicError || !publicBusiness ? (
            <div className="public-message">
              <h1>Enlace no disponible</h1>

              <p>
                {publicError ||
                  "No encontramos este comercio."}
              </p>
            </div>
          ) : (
            <div className="public-content">
              <span className="eyebrow">
                TU OPINIÓN CUENTA
              </span>

              <h1>¿Cómo fue tu experiencia?</h1>

              <p className="public-business-name">
                {publicBusiness.name}
              </p>

              <p className="public-description">
                Tu reseña ayuda a este comercio y a otras
                personas.
              </p>

              <a
                className="google-review-button"
                href={publicBusiness.google_review_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Dejar reseña en Google

                <span aria-hidden="true">↗</span>
              </a>

              <p className="public-footnote">
                Vas a continuar en Google para escribir y
                publicar tu reseña.
              </p>
            </div>
          )}

          <footer className="site-footer">
            © {new Date().getFullYear()} ReseñaTap. Creado
            por Sebastián Ahumada. Todos los derechos
            reservados.
          </footer>
        </div>

        <style jsx>{`
          :global(*) {
            box-sizing: border-box;
          }

          :global(body) {
            margin: 0;
            background: #f4f7fb;
            color: #172033;
            font-family: Arial, Helvetica, sans-serif;
          }

          .public-page {
            display: flex;
            min-height: 100vh;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: #f4f7fb;
          }

          .public-card {
            width: 100%;
            max-width: 440px;
            border: 1px solid #e2e8f0;
            border-radius: 18px;
            padding: 30px 26px;
            background: #fff;
            box-shadow: 0 12px 35px rgba(23, 32, 51, 0.06);
            text-align: center;
          }

          .brand {
            display: flex;
            align-items: center;
            gap: 10px;
            color: #172033;
            font-size: 19px;
            font-weight: 700;
            letter-spacing: -0.5px;
          }

          .brand-icon {
            display: grid;
            width: 34px;
            height: 34px;
            place-items: center;
            border-radius: 10px;
            background: #172033;
            color: white;
            font-size: 17px;
            font-weight: 700;
          }

          .brand-blue {
            color: #1673e6;
          }

          .public-brand {
            justify-content: center;
            margin-bottom: 32px;
          }

          .eyebrow {
            display: inline-block;
            margin-bottom: 10px;
            color: #18804c;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 1.6px;
          }

          .public-content h1,
          .public-message h1 {
            margin: 0;
            color: #172033;
            font-size: 26px;
            line-height: 1.2;
            letter-spacing: -0.7px;
          }

          .public-business-name {
            margin: 15px 0 0;
            color: #172033;
            font-size: 17px;
            font-weight: 700;
          }

          .public-description {
            margin: 9px 0 23px;
            color: #728097;
            font-size: 14px;
            line-height: 1.5;
          }

          .google-review-button {
            display: flex;
            min-height: 48px;
            align-items: center;
            justify-content: center;
            gap: 12px;
            border-radius: 9px;
            background: #16804c;
            color: #fff;
            font-size: 14px;
            font-weight: 700;
            text-decoration: none;
          }

          .google-review-button:hover {
            background: #116b3f;
          }

          .public-footnote {
            margin: 15px 0 0;
            color: #8793a5;
            font-size: 11px;
            line-height: 1.5;
          }

          .public-message {
            padding: 25px 0;
            color: #728097;
            font-size: 14px;
            line-height: 1.5;
          }

          .public-message h1 {
            margin-bottom: 10px;
          }

          .spinner {
            width: 24px;
            height: 24px;
            margin: 0 auto 12px;
            border: 3px solid #e2e8f0;
            border-top-color: #16804c;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          .site-footer {
            margin-top: 28px;
            padding: 16px 8px 0;
            border-top: 1px solid #e2e8f0;
            color: #8793a5;
            font-size: 11px;
            line-height: 1.5;
            text-align: center;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }

          @media (max-width: 420px) {
            .public-card {
              padding: 26px 19px;
            }
          }
        `}</style>
      </main>
    );
  }

  // ====================================================
  // VERIFICANDO LOGIN
  // ====================================================

  if (isCheckingLogin) {
    return (
      <main className="login-page">
        <div className="login-loading">
          <div className="spinner" />
          <p>Verificando acceso...</p>
        </div>

        <style jsx>{`
          :global(*) {
            box-sizing: border-box;
          }

          :global(body) {
            margin: 0;
            background: #f4f7fb;
            font-family: Arial, Helvetica, sans-serif;
          }

          .login-page {
            display: flex;
            min-height: 100vh;
            align-items: center;
            justify-content: center;
            background: #f4f7fb;
          }

          .login-loading {
            color: #728097;
            font-size: 13px;
            text-align: center;
          }

          .spinner {
            width: 25px;
            height: 25px;
            margin: 0 auto 12px;
            border: 3px solid #e2e8f0;
            border-top-color: #16804c;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </main>
    );
  }

  // ====================================================
  // LOGIN
  // ====================================================

  if (!isLoggedIn) {
    return (
      <main className="login-page">
        <div className="login-card">
          <div className="brand login-brand">
            <div className="brand-icon">N</div>

            <span>
              Reseña<span className="brand-blue">Tap</span>
            </span>
          </div>

          <div className="login-header">
            <p className="eyebrow">ADMINISTRACIÓN</p>

            <h1>Ingresá a ReseñaTap</h1>

            <p>
              Accedé al panel para administrar comercios,
              enlaces y códigos QR.
            </p>
          </div>

          <form
            className="login-form"
            onSubmit={handleLogin}
          >
            <label htmlFor="login-username">
              Usuario
            </label>

            <input
              id="login-username"
              type="text"
              placeholder="Ingresá tu usuario"
              value={loginUsername}
              onChange={(event) =>
                setLoginUsername(event.target.value)
              }
              autoComplete="username"
              required
            />

            <label htmlFor="login-password">
              Contraseña
            </label>

            <input
              id="login-password"
              type="password"
              placeholder="Ingresá tu contraseña"
              value={loginPassword}
              onChange={(event) =>
                setLoginPassword(event.target.value)
              }
              autoComplete="current-password"
              required
            />

            {loginError && (
              <p className="login-error">
                {loginError}
              </p>
            )}

            <button
              className="login-button"
              type="submit"
            >
              Ingresar
            </button>
          </form>

          <footer className="login-footer">
            © {new Date().getFullYear()} ReseñaTap
            <br />
            Creado por Sebastián Ahumada
          </footer>
        </div>

        <style jsx>{`
          :global(*) {
            box-sizing: border-box;
          }

          :global(body) {
            margin: 0;
            background: #f4f7fb;
            color: #172033;
            font-family: Arial, Helvetica, sans-serif;
          }

          .login-page {
            display: flex;
            min-height: 100vh;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: #f4f7fb;
          }

          .login-card {
            width: 100%;
            max-width: 420px;
            border: 1px solid #e1e8f0;
            border-radius: 18px;
            padding: 34px 30px 25px;
            background: #fff;
            box-shadow: 0 15px 45px rgba(23, 32, 51, 0.07);
          }

          .brand {
            display: flex;
            align-items: center;
            gap: 10px;
            color: #172033;
            font-size: 20px;
            font-weight: 700;
            letter-spacing: -0.5px;
          }

          .brand-icon {
            display: grid;
            width: 38px;
            height: 38px;
            place-items: center;
            border-radius: 11px;
            background: #172033;
            color: white;
            font-size: 18px;
            font-weight: 700;
          }

          .brand-blue {
            color: #1673e6;
          }

          .login-brand {
            justify-content: center;
            margin-bottom: 34px;
          }

          .login-header {
            text-align: center;
          }

          .eyebrow {
            margin: 0 0 10px;
            color: #18804c;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 1.6px;
          }

          .login-header h1 {
            margin: 0;
            color: #172033;
            font-size: 27px;
            line-height: 1.2;
            letter-spacing: -0.8px;
          }

          .login-header p:not(.eyebrow) {
            margin: 11px 0 0;
            color: #7a8799;
            font-size: 13px;
            line-height: 1.55;
          }

          .login-form {
            display: flex;
            flex-direction: column;
            margin-top: 27px;
          }

          .login-form label {
            margin: 0 0 8px;
            color: #172033;
            font-size: 12px;
            font-weight: 700;
          }

          .login-form input {
            width: 100%;
            height: 46px;
            margin-bottom: 17px;
            border: 1px solid #d9e2ed;
            border-radius: 9px;
            outline: none;
            padding: 0 13px;
            background: #fff;
            color: #172033;
            font: inherit;
            font-size: 13px;
            transition:
              border-color 0.15s,
              box-shadow 0.15s;
          }

          .login-form input:focus {
            border-color: #17814e;
            box-shadow: 0 0 0 3px rgba(23, 129, 78, 0.09);
          }

          .login-form input::placeholder {
            color: #9aa5b4;
          }

          .login-error {
            margin: -2px 0 13px;
            color: #b42318;
            font-size: 12px;
            line-height: 1.4;
          }

          .login-button {
            width: 100%;
            height: 46px;
            border: 0;
            border-radius: 9px;
            background: #16804c;
            color: #fff;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            transition: background 0.15s;
          }

          .login-button:hover {
            background: #116b3f;
          }

          .login-footer {
            margin-top: 27px;
            padding-top: 17px;
            border-top: 1px solid #e8edf3;
            color: #9aa5b4;
            font-size: 10px;
            line-height: 1.5;
            text-align: center;
          }

          @media (max-width: 420px) {
            .login-page {
              padding: 15px;
            }

            .login-card {
              padding: 29px 20px 22px;
            }
          }
        `}</style>
      </main>
    );
  }

  // ====================================================
  // PANEL ADMINISTRATIVO
  // ====================================================

  return (
    <main className="admin-page">
      <div className="page-container">
        <header className="topbar">
          <div className="brand">
            <div className="brand-icon">N</div>

            <span>
              Reseña<span className="brand-blue">Tap</span>
            </span>
          </div>

          <div className="topbar-right">
            <div className="topbar-tag">NFC + QR</div>

            <button
              type="button"
              className="logout-button"
              onClick={handleLogout}
            >
              Cerrar sesión
            </button>
          </div>
        </header>

        <section className="intro">
          <p className="eyebrow">ADMINISTRACIÓN</p>

          <h1>
            Conectá un comercio
            <br />
            con sus reseñas de Google.
          </h1>

          <p className="intro-description">
            Registrá el negocio y generá un enlace único para
            grabar en la tarjeta NFC y convertir en QR.
          </p>
        </section>

        <section className="admin-grid">
          <div className="panel register-panel">
            <h2>Registrar comercio</h2>

            <form onSubmit={handleRegisterBusiness}>
              <label htmlFor="business-name">
                Nombre del comercio
              </label>

              <input
                id="business-name"
                type="text"
                placeholder="Ej. Restaurante El Sol"
                value={businessName}
                onChange={(event) =>
                  setBusinessName(event.target.value)
                }
                maxLength={100}
                required
              />

              <label htmlFor="google-review-url">
                Enlace directo de reseñas de Google
              </label>

              <textarea
                id="google-review-url"
                placeholder="https://g.page/r/.../review"
                value={googleReviewUrl}
                onChange={(event) =>
                  setGoogleReviewUrl(event.target.value)
                }
                rows={3}
                required
              />

              <p className="form-help">
                En Perfil de Empresa de Google, buscá la
                opción para pedir reseñas y copiá el enlace
                para compartir.
              </p>

              {errorMessage && (
                <p className="form-message error-message">
                  {errorMessage}
                </p>
              )}

              {successMessage && (
                <p className="form-message success-message">
                  {successMessage}
                </p>
              )}

              <button
                className="primary-button"
                type="submit"
                disabled={isSaving}
              >
                {isSaving
                  ? "Registrando..."
                  : "Registrar y generar enlace"}
              </button>
            </form>
          </div>

          <div className="panel businesses-panel">
            <div className="businesses-heading">
              <div className="businesses-title">
                <h2>Comercios registrados</h2>

                <span className="count-badge">
                  {businesses.length}
                </span>
              </div>
            </div>

            <div className="search-wrap">
              <span
                className="search-icon"
                aria-hidden="true"
              >
                ⌕
              </span>

              <input
                type="search"
                aria-label="Buscar comercio por nombre"
                placeholder="Buscar por nombre..."
                value={searchTerm}
                onChange={(event) =>
                  changeSearch(event.target.value)
                }
              />

              {searchTerm && (
                <button
                  type="button"
                  className="clear-search"
                  aria-label="Limpiar búsqueda"
                  onClick={() => changeSearch("")}
                >
                  ×
                </button>
              )}
            </div>

            {isLoading ? (
              <div className="empty-state">
                Cargando comercios...
              </div>
            ) : errorMessage &&
              businesses.length === 0 ? (
              <div className="empty-state error-text">
                {errorMessage}
              </div>
            ) : filteredBusinesses.length === 0 ? (
              <div className="empty-state">
                {searchTerm
                  ? "No encontramos comercios con ese nombre."
                  : "Todavía no hay comercios registrados."}
              </div>
            ) : (
              <>
                <div className="business-list">
                  {paginatedBusinesses.map((business) => (
                    <button
                      type="button"
                      key={business.id}
                      className={`business-item ${
                        selectedId === business.id
                          ? "selected"
                          : ""
                      }`}
                      onClick={() =>
                        openBusiness(business.id)
                      }
                    >
                      <span className="business-item-name">
                        {business.name}
                      </span>

                      <span className="business-item-id">
                        {business.id}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="pagination">
                  <span className="pagination-info">
                    {filteredBusinesses.length === 0
                      ? "0 comercios"
                      : `${(currentPage - 1) *
                          BUSINESSES_PER_PAGE +
                          1}–${Math.min(
                          currentPage *
                            BUSINESSES_PER_PAGE,
                          filteredBusinesses.length
                        )} de ${
                          filteredBusinesses.length
                        }`}
                  </span>

                  <div className="pagination-controls">
                    <button
                      type="button"
                      className="page-button"
                      onClick={() =>
                        setCurrentPage((page) =>
                          Math.max(1, page - 1)
                        )
                      }
                      disabled={currentPage <= 1}
                      aria-label="Página anterior"
                    >
                      ‹
                    </button>

                    <span className="page-number">
                      {currentPage} / {totalPages}
                    </span>

                    <button
                      type="button"
                      className="page-button"
                      onClick={() =>
                        setCurrentPage((page) =>
                          Math.min(
                            totalPages,
                            page + 1
                          )
                        )
                      }
                      disabled={
                        currentPage >= totalPages
                      }
                      aria-label="Página siguiente"
                    >
                      ›
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        {selectedBusiness && (
          <section className="panel material-panel">
            <button
              type="button"
              className="close-panel-button"
              onClick={closeBusinessPanel}
              aria-label="Cerrar material del comercio"
              title="Cerrar"
            >
              ×
            </button>

            <p className="eyebrow">
              MATERIAL PARA EL COMERCIO
            </p>

            <h2>{selectedBusiness.name}</h2>

            <p className="material-description">
              Este enlace es el que podés grabar en el chip
              NFC y también el destino del QR.
            </p>

            <div className="material-content">
              <div className="qr-container">
                <QRCodeSVG
                  id="resenatap-qr"
                  value={landingUrl}
                  size={220}
                  level="H"
                  includeMargin
                />
              </div>

              <div className="link-details">
                <label htmlFor="business-landing-url">
                  Enlace único del comercio
                </label>

                <input
                  id="business-landing-url"
                  type="text"
                  value={landingUrl}
                  readOnly
                  onFocus={(event) =>
                    event.currentTarget.select()
                  }
                />

                <p className="material-hint">
                  Usá este mismo enlace para el QR y para
                  programar la etiqueta NFC.
                </p>

                <div className="material-actions">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={downloadQrCode}
                  >
                    Descargar QR (SVG)
                  </button>

                  <a
                    className="secondary-button"
                    href={landingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Probar página
                  </a>
                </div>
              </div>
            </div>
          </section>
        )}

        <footer className="site-footer">
          © {new Date().getFullYear()} ReseñaTap. Creado por
          Sebastián Ahumada. Todos los derechos reservados.
        </footer>
      </div>

      <style jsx>{`
        :global(*) {
          box-sizing: border-box;
        }

        :global(body) {
          margin: 0;
          background: #f4f7fb;
          color: #172033;
          font-family: Arial, Helvetica, sans-serif;
        }

        .admin-page {
          min-height: 100vh;
          padding: 28px 24px 40px;
          background: #f4f7fb;
        }

        .page-container {
          width: 100%;
          max-width: 960px;
          margin: 0 auto;
        }

        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 42px;
        }

        .topbar-right {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #172033;
          font-size: 19px;
          font-weight: 700;
          letter-spacing: -0.5px;
        }

        .brand-icon {
          display: grid;
          width: 34px;
          height: 34px;
          place-items: center;
          border-radius: 10px;
          background: #172033;
          color: white;
          font-size: 17px;
          font-weight: 700;
        }

        .brand-blue {
          color: #1673e6;
        }

        .topbar-tag {
          padding: 7px 13px;
          border-radius: 30px;
          background: #e8f6ed;
          color: #187847;
          font-size: 12px;
          font-weight: 700;
        }

        .logout-button {
          min-height: 32px;
          border: 1px solid #dce4ed;
          border-radius: 8px;
          padding: 0 11px;
          background: #fff;
          color: #5e6c80;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        .logout-button:hover {
          background: #f6f8fb;
          color: #172033;
        }

        .intro {
          margin-bottom: 28px;
        }

        .eyebrow {
          margin: 0 0 13px;
          color: #18804c;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1.6px;
        }

        .intro h1 {
          margin: 0;
          color: #172033;
          font-size: clamp(28px, 4vw, 38px);
          line-height: 1.13;
          letter-spacing: -1.3px;
        }

        .intro-description {
          max-width: 620px;
          margin: 14px 0 0;
          color: #728097;
          font-size: 15px;
          line-height: 1.65;
        }

        .admin-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          align-items: stretch;
        }

        .panel {
          position: relative;
          border: 1px solid #e1e8f0;
          border-radius: 15px;
          background: #fff;
          box-shadow: 0 5px 18px rgba(27, 46, 75, 0.025);
        }

        .register-panel,
        .businesses-panel {
          min-height: 360px;
          padding: 22px 20px;
        }

        .panel h2 {
          margin: 0;
          color: #172033;
          font-size: 17px;
          font-weight: 700;
        }

        form {
          display: flex;
          flex-direction: column;
          margin-top: 20px;
        }

        label {
          display: block;
          margin: 0 0 8px;
          color: #172033;
          font-size: 12px;
          font-weight: 700;
        }

        input,
        textarea {
          width: 100%;
          border: 1px solid #d9e2ed;
          border-radius: 9px;
          outline: none;
          background: #fff;
          color: #172033;
          font: inherit;
          font-size: 14px;
          transition:
            border-color 0.15s,
            box-shadow 0.15s;
        }

        input {
          height: 44px;
          padding: 0 12px;
        }

        textarea {
          min-height: 82px;
          padding: 11px 12px;
          resize: vertical;
        }

        input:focus,
        textarea:focus {
          border-color: #17814e;
          box-shadow: 0 0 0 3px rgba(23, 129, 78, 0.09);
        }

        input::placeholder,
        textarea::placeholder {
          color: #8b97a9;
        }

        form input + label,
        form textarea + .form-help {
          margin-top: 16px;
        }

        .form-help {
          margin: 0 0 15px;
          color: #8491a5;
          font-size: 11px;
          line-height: 1.55;
        }

        .primary-button,
        .secondary-button {
          display: inline-flex;
          min-height: 39px;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 8px;
          padding: 0 14px;
          font-size: 12px;
          font-weight: 700;
          text-decoration: none;
          cursor: pointer;
          transition:
            background 0.15s,
            transform 0.15s;
        }

        .primary-button {
          align-self: flex-start;
          background: #16804c;
          color: white;
        }

        .primary-button:hover {
          background: #116b3f;
        }

        .primary-button:disabled {
          opacity: 0.65;
          cursor: wait;
        }

        .secondary-button {
          border: 1px solid #d8e1eb;
          background: white;
          color: #26364d;
        }

        .secondary-button:hover {
          background: #f6f8fb;
        }

        .form-message {
          margin: 0 0 12px;
          font-size: 12px;
          line-height: 1.5;
        }

        .error-message,
        .error-text {
          color: #b42318;
        }

        .success-message {
          color: #187847;
        }

        .businesses-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }

        .businesses-title {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .count-badge {
          display: inline-flex;
          min-width: 23px;
          height: 23px;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #e8f6ed;
          color: #187847;
          font-size: 11px;
          font-weight: 700;
        }

        .search-wrap {
          position: relative;
          margin-bottom: 12px;
        }

        .search-wrap input {
          height: 39px;
          padding: 0 35px;
          font-size: 12px;
        }

        .search-icon {
          position: absolute;
          top: 50%;
          left: 12px;
          z-index: 1;
          color: #7c899b;
          font-size: 20px;
          line-height: 1;
          transform: translateY(-55%);
          pointer-events: none;
        }

        .clear-search {
          position: absolute;
          top: 50%;
          right: 9px;
          width: 24px;
          height: 24px;
          border: 0;
          border-radius: 50%;
          background: transparent;
          color: #64748b;
          font-size: 19px;
          line-height: 1;
          transform: translateY(-50%);
          cursor: pointer;
        }

        .business-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .business-item {
          display: flex;
          width: 100%;
          flex-direction: column;
          align-items: flex-start;
          gap: 5px;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
          padding: 12px;
          background: #fff;
          text-align: left;
          cursor: pointer;
          transition:
            border-color 0.15s,
            background 0.15s;
        }

        .business-item:hover {
          border-color: #9ac9ad;
          background: #f8fcf9;
        }

        .business-item.selected {
          border-color: #16804c;
          background: #f2faf5;
        }

        .business-item-name {
          color: #172033;
          font-size: 12px;
          font-weight: 700;
        }

        .business-item-id {
          color: #8793a5;
          font-size: 10px;
        }

        .empty-state {
          display: flex;
          min-height: 150px;
          align-items: center;
          justify-content: center;
          color: #7b8798;
          font-size: 13px;
          text-align: center;
        }

        .pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 15px;
          padding-top: 12px;
          border-top: 1px solid #edf1f5;
        }

        .pagination-info {
          color: #8793a5;
          font-size: 11px;
        }

        .pagination-controls {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .page-button {
          display: grid;
          width: 27px;
          height: 27px;
          place-items: center;
          border: 1px solid #dce4ed;
          border-radius: 7px;
          background: white;
          color: #26364d;
          font-size: 19px;
          line-height: 1;
          cursor: pointer;
        }

        .page-button:disabled {
          color: #b7c0cc;
          background: #f8fafc;
          cursor: not-allowed;
        }

        .page-number {
          color: #5e6c80;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }

        .material-panel {
          margin-top: 16px;
          padding: 22px 20px 25px;
        }

        .material-panel .eyebrow {
          margin-bottom: 10px;
        }

        .material-panel h2 {
          font-size: 17px;
          font-weight: 500;
        }

        .material-description {
          margin: 10px 0 22px;
          color: #8793a5;
          font-size: 12px;
          line-height: 1.5;
        }

        .close-panel-button {
          position: absolute;
          top: 16px;
          right: 16px;
          display: grid;
          width: 32px;
          height: 32px;
          place-items: center;
          border: 1px solid #dce4ed;
          border-radius: 8px;
          background: #fff;
          color: #526176;
          font-size: 23px;
          line-height: 1;
          cursor: pointer;
        }

        .close-panel-button:hover {
          background: #f4f7fb;
          color: #172033;
        }

        .material-content {
          display: flex;
          align-items: center;
          gap: 28px;
        }

        .qr-container {
          display: flex;
          flex: 0 0 230px;
          align-items: center;
          justify-content: center;
          min-height: 230px;
          border: 1px solid #edf1f5;
          border-radius: 10px;
          background: white;
        }

        .link-details {
          flex: 1;
          min-width: 0;
        }

        .link-details input {
          font-size: 12px;
        }

        .material-hint {
          margin: 9px 0 16px;
          color: #8793a5;
          font-size: 11px;
          line-height: 1.5;
        }

        .material-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
        }

        .site-footer {
          margin-top: 28px;
          padding: 16px 8px 0;
          border-top: 1px solid #e2e8f0;
          color: #8793a5;
          font-size: 11px;
          line-height: 1.5;
          text-align: center;
        }

        @media (max-width: 720px) {
          .admin-page {
            padding: 20px 15px 40px;
          }

          .topbar {
            margin-bottom: 32px;
          }

          .topbar-right {
            flex-wrap: wrap;
            justify-content: flex-end;
          }

          .admin-grid {
            grid-template-columns: 1fr;
          }

          .register-panel,
          .businesses-panel {
            min-height: auto;
          }

          .material-content {
            flex-direction: column;
            align-items: stretch;
            gap: 20px;
          }

          .qr-container {
            flex-basis: auto;
            min-height: 250px;
          }

          .material-actions {
            flex-direction: column;
          }

          .material-actions .primary-button,
          .material-actions .secondary-button {
            width: 100%;
          }
        }

        @media (max-width: 520px) {
          .topbar {
            align-items: flex-start;
          }

          .topbar-right {
            flex-direction: column;
            align-items: flex-end;
          }
        }

        @media (max-width: 420px) {
          .intro h1 {
            font-size: 29px;
          }

          .topbar {
            flex-direction: column;
            align-items: flex-start;
          }

          .topbar-right {
            width: 100%;
            flex-direction: row;
            justify-content: space-between;
          }
        }
      `}</style>
    </main>
  );
}