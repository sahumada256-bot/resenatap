"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useState } from "react";

type Business = {
  id: string;
  name: string;
  googleReviewUrl: string;
  createdAt: string;
};

const STORAGE_KEY = "nfc-review-businesses-v1";

function validGoogleUrl(value: string) {
  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      (
        url.hostname === "g.page" ||
        url.hostname.endsWith("google.com") ||
        url.hostname.endsWith("googleusercontent.com")
      )
    );
  } catch {
    return false;
  }
}

export default function Home() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [name, setName] = useState("");
  const [reviewUrl, setReviewUrl] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      try {
        setBusinesses(JSON.parse(saved));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(businesses));
  }, [businesses]);

  const selected = useMemo(
    () => businesses.find((b) => b.id === selectedId),
    [businesses, selectedId]
  );

  const landingUrl = selected
    ? `${
        typeof window !== "undefined"
          ? window.location.origin
          : ""
      }/?b=${encodeURIComponent(selected.id)}`
    : "";

  function addBusiness(e: React.FormEvent) {
    e.preventDefault();
    setNotice("");

    if (!name.trim()) {
      return setNotice("Ingresá el nombre del comercio.");
    }

    if (!validGoogleUrl(reviewUrl.trim())) {
      return setNotice(
        "Pegá un enlace HTTPS válido de reseñas de Google (por ejemplo, https://g.page/r/.../review)."
      );
    }

    const id =
      name
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") +
      "-" +
      Math.random().toString(36).slice(2, 7);

    const business: Business = {
      id,
      name: name.trim(),
      googleReviewUrl: reviewUrl.trim(),
      createdAt: new Date().toISOString(),
    };

    setBusinesses((prev) => [business, ...prev]);
    setSelectedId(id);
    setName("");
    setReviewUrl("");

    setNotice(
      "Comercio registrado en este navegador. El QR ya está listo."
    );
  }

  function copy(text: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => setNotice("Enlace copiado."))
      .catch(() =>
        setNotice(
          "No se pudo copiar automáticamente; seleccioná y copiá el enlace."
        )
      );
  }

  // Landing mode: ?b=business-id
  const [queryId, setQueryId] = useState("");

  useEffect(() => {
    setQueryId(
      new URLSearchParams(window.location.search).get("b") || ""
    );
  }, []);

  const landing = businesses.find((b) => b.id === queryId);

  if (queryId) {
    return (
      <main className="landing">
        {landing ? (
          <section className="reviewCard">
            <div className="mark">★</div>

            <p className="eyebrow">
              TU OPINIÓN NOS IMPORTA
            </p>

            <h1>{landing.name}</h1>

            <p className="sub">
              ¿Cómo fue tu experiencia? Compartí tu opinión
              en Google.
            </p>

            <a
              className="googleButton"
              href={landing.googleReviewUrl}
              target="_blank"
              rel="noreferrer"
            >
              ★ &nbsp; Dejar reseña en Google
            </a>

            <p className="fine">
              Se abrirá Google para que escribas y publiques
              tu reseña. Tu opinión la gestionás directamente
              con Google.
            </p>
          </section>
        ) : (
          <section className="reviewCard">
            <div className="mark">NFC</div>

            <h1>Comercio no encontrado</h1>

            <p className="sub">
              Este enlace no está registrado en este
              navegador. Para una versión pública, necesitás
              guardar los comercios en una base de datos
              online.
            </p>

            <a href="/" className="backLink">
              Volver al administrador
            </a>
          </section>
        )}
      </main>
    );
  }

  return (
    <main className="admin">
      <header className="top">
        <div className="brand">
          <span className="brandIcon">N</span>

          <span>
            ReseñaTap <small>MVP local</small>
          </span>
        </div>

        <span className="pill">NFC + QR</span>
      </header>

      <section className="intro">
        <p className="eyebrow">ADMINISTRACIÓN</p>

        <h1>
          Conectá un comercio
          <br />
          con sus reseñas de Google.
        </h1>

        <p className="sub">
          Registrá el negocio y generá un enlace único para
          grabar en la tarjeta NFC y convertir en QR.
        </p>
      </section>

      <div className="columns">
        <form className="panel" onSubmit={addBusiness}>
          <h2>Registrar comercio</h2>

          <label>Nombre del comercio</label>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Restaurante El Sol"
          />

          <label>
            Enlace directo de reseñas de Google
          </label>

          <textarea
            value={reviewUrl}
            onChange={(e) => setReviewUrl(e.target.value)}
            placeholder="https://g.page/r/…/review"
            rows={3}
          />

          <p className="hint">
            En Perfil de Empresa de Google, buscá la opción
            para pedir reseñas y copiá el enlace para
            compartir.
          </p>

          <button className="primary" type="submit">
            Registrar y generar QR
          </button>

          {notice && (
            <p className="notice">{notice}</p>
          )}
        </form>

        <section className="panel">
          <h2>
            Comercios registrados{" "}
            <span className="count">
              {businesses.length}
            </span>
          </h2>

          {businesses.length === 0 ? (
            <div className="empty">
              Todavía no registraste comercios.
              <br />
              Completá el formulario para empezar.
            </div>
          ) : (
            <div className="businessList">
              {businesses.map((b) => (
                <button
                  type="button"
                  key={b.id}
                  className={`business ${
                    selectedId === b.id ? "active" : ""
                  }`}
                  onClick={() => setSelectedId(b.id)}
                >
                  <strong>{b.name}</strong>

                  <span>{b.id}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {selected && (
        <section className="panel output">
          <div>
            <p className="eyebrow">
              ENLACE PARA ESTA TARJETA
            </p>

            <h2>{selected.name}</h2>

            <p className="hint">
              Este enlace es el que grabarías en el chip NFC
              y que utiliza el QR de ResenaTap.
            </p>
          </div>

          <div className="qrSection">
            <div className="qrBox">
              <QRCodeSVG
                value={landingUrl}
                size={220}
                level="H"
                includeMargin
              />
            </div>

            <div className="qrInfo">
              <h3>QR de ResenaTap</h3>

              <p>
                Este QR lleva directamente a la página de tu
                comercio en ResenaTap.
              </p>

              <div className="urlBox">
                {landingUrl}
              </div>

              <div className="actions">
                <button
                  className="primary"
                  onClick={() => copy(landingUrl)}
                >
                  Copiar enlace
                </button>

                <a
                  className="secondary"
                  href={`/?b=${encodeURIComponent(
                    selected.id
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Probar página
                </a>
              </div>
            </div>
          </div>

          <p className="warning">
            <strong>Importante:</strong> esta versión guarda
            datos solo en el navegador (localStorage). Para
            que los clientes abran el enlace desde sus
            propios teléfonos, después hay que desplegar la
            web y conectar una base de datos online, por
            ejemplo Supabase.
          </p>
        </section>
      )}

      <footer>
        Prototipo de desarrollo · No publica reseñas
        automáticamente en Google.
      </footer>
    </main>
  );
}