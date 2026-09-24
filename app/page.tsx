"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";

type Business = {
  id: string;
  name: string;
  google_review_url: string;
  created_at: string;
};

function validGoogleUrl(value: string) {
  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      (url.hostname === "g.page" ||
        url.hostname.endsWith("google.com") ||
        url.hostname.endsWith("googleusercontent.com"))
    );
  } catch {
    return false;
  }
}

function createBusinessId(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return slug + "-" + Math.random().toString(36).slice(2, 8);
}

export default function Home() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [name, setName] = useState("");
  const [reviewUrl, setReviewUrl] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  const [queryId, setQueryId] = useState("");
  const [publicBusiness, setPublicBusiness] = useState<Business | null>(
    null
  );
  const [publicLoading, setPublicLoading] = useState(false);

  // Detectar si estamos entrando a la página pública de un comercio
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("b") || "";

    setQueryId(id);

    if (!id) {
      return;
    }

    async function loadPublicBusiness() {
      setPublicLoading(true);

      const { data, error } = await supabase
        .from("businesses")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error cargando comercio público:", error);
        setPublicBusiness(null);
      } else {
        setPublicBusiness(data);
      }

      setPublicLoading(false);
    }

    loadPublicBusiness();
  }, []);

  // Cargar comercios para el administrador
  useEffect(() => {
    async function loadBusinesses() {
      setLoading(true);

      const { data, error } = await supabase
        .from("businesses")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        setNotice("No se pudieron cargar los comercios.");
      } else {
        setBusinesses(data || []);
      }

      setLoading(false);
    }

    loadBusinesses();
  }, []);

  const selected = useMemo(
    () => businesses.find((business) => business.id === selectedId),
    [businesses, selectedId]
  );

  const landingUrl =
    selected && typeof window !== "undefined"
      ? `${window.location.origin}/?b=${encodeURIComponent(selected.id)}`
      : "";

  async function addBusiness(e: React.FormEvent) {
    e.preventDefault();

    setNotice("");

    if (!name.trim()) {
      setNotice("Ingresá el nombre del comercio.");
      return;
    }

    if (!validGoogleUrl(reviewUrl.trim())) {
      setNotice(
        "Pegá un enlace HTTPS válido de reseñas de Google. Por ejemplo: https://g.page/r/.../review"
      );
      return;
    }

    const id = createBusinessId(name);

    const newBusiness = {
      id,
      name: name.trim(),
      google_review_url: reviewUrl.trim(),
    };

    const { data, error } = await supabase
      .from("businesses")
      .insert(newBusiness)
      .select()
      .single();

    if (error) {
      console.error(error);
      setNotice(
        "No se pudo registrar el comercio. Revisá la conexión con Supabase."
      );
      return;
    }

    setBusinesses((previous) => [data, ...previous]);
    setSelectedId(data.id);

    setName("");
    setReviewUrl("");

    setNotice("Comercio registrado correctamente en Supabase.");
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("Enlace copiado.");
    } catch {
      setNotice(
        "No se pudo copiar automáticamente; seleccioná y copiá el enlace."
      );
    }
  }

  function downloadQR() {
    const svg = document.getElementById("resenatap-qr");

    if (!svg || !selected) {
      return;
    }

    const svgData = new XMLSerializer().serializeToString(svg);

    const blob = new Blob([svgData], {
      type: "image/svg+xml;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${selected.name}-qr.svg`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  // ---------------------------------------------------------
  // PÁGINA PÚBLICA
  // ---------------------------------------------------------

  if (queryId) {
    if (publicLoading) {
      return (
        <main className="landing">
          <section className="reviewCard">
            <div className="mark">NFC</div>

            <p className="eyebrow">RESEÑATAP</p>

            <h1>Cargando...</h1>

            <p className="sub">
              Estamos buscando el comercio.
            </p>
          </section>
        </main>
      );
    }

    if (!publicBusiness) {
      return (
        <main className="landing">
          <section className="reviewCard">
            <div className="mark">NFC</div>

            <p className="eyebrow">RESEÑATAP</p>

            <h1>Comercio no encontrado</h1>

            <p className="sub">
              No encontramos este comercio en ReseñaTap.
            </p>

            <a href="/" className="backLink">
              Volver al administrador
            </a>
          </section>
        </main>
      );
    }

    return (
      <main className="landing">
        <section className="reviewCard">
          <div className="mark">★</div>

          <p className="eyebrow">TU OPINIÓN NOS IMPORTA</p>

          <h1>{publicBusiness.name}</h1>

          <p className="sub">
            ¿Cómo fue tu experiencia? Compartí tu opinión en Google.
          </p>

          <a
            className="googleButton"
            href={publicBusiness.google_review_url}
            target="_blank"
            rel="noreferrer"
          >
            ★ &nbsp; Dejar reseña en Google
          </a>

          <p className="fine">
            Se abrirá Google para que escribas y publiques tu reseña. Tu
            opinión la gestionás directamente con Google.
          </p>
        </section>
      </main>
    );
  }

  // ---------------------------------------------------------
  // ADMINISTRADOR
  // ---------------------------------------------------------

  return (
    <main className="admin">
      <header className="top">
        <div className="brand">
          <span className="brandIcon">N</span>

          <span>
            ReseñaTap <small>MVP</small>
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
          Registrá el negocio y generá un enlace único para grabar en la
          tarjeta NFC y convertir en QR.
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

          <label>Enlace directo de reseñas de Google</label>

          <textarea
            value={reviewUrl}
            onChange={(e) => setReviewUrl(e.target.value)}
            placeholder="https://g.page/r/…/review"
            rows={3}
          />

          <p className="hint">
            En Perfil de Empresa de Google, buscá la opción para pedir
            reseñas y copiá el enlace para compartir.
          </p>

          <button className="primary" type="submit">
            Registrar y generar enlace
          </button>

          {notice && <p className="notice">{notice}</p>}
        </form>

        <section className="panel">
          <h2>
            Comercios registrados{" "}
            <span className="count">{businesses.length}</span>
          </h2>

          {loading ? (
            <div className="empty">Cargando comercios...</div>
          ) : businesses.length === 0 ? (
            <div className="empty">
              Todavía no registraste comercios.
              <br />
              Completá el formulario para empezar.
            </div>
          ) : (
            <div className="businessList">
              {businesses.map((business) => (
                <button
                  type="button"
                  key={business.id}
                  className={`business ${
                    selectedId === business.id ? "active" : ""
                  }`}
                  onClick={() => setSelectedId(business.id)}
                >
                  <strong>{business.name}</strong>
                  <span>{business.id}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {selected && (
        <section className="panel output">
          <div>
            <p className="eyebrow">MATERIAL PARA EL COMERCIO</p>

            <h2>{selected.name}</h2>

            <p className="hint">
              Este enlace es el que podés grabar en el chip NFC y también es
              el destino del QR.
            </p>
          </div>

          <div className="qrSection">
            <div className="qrBox">
              <QRCodeSVG
                id="resenatap-qr"
                value={landingUrl}
                size={240}
                level="H"
                includeMargin
              />
            </div>

            <div className="qrInfo">
              <h3>QR de ReseñaTap</h3>

              <p>
                Escaneando este QR, el cliente entra a la página de{" "}
                {selected.name} y desde ahí puede dejar su reseña en Google.
              </p>

              <div className="urlBox">{landingUrl}</div>

              <div className="actions">
                <button
                  className="primary"
                  onClick={() => copy(landingUrl)}
                >
                  Copiar enlace
                </button>

                <button className="secondary" onClick={downloadQR}>
                  Descargar QR
                </button>

                <a
                  className="secondary"
                  href={`/?b=${encodeURIComponent(selected.id)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Probar página
                </a>
              </div>
            </div>
          </div>

          <p className="warning">
            <strong>Importante:</strong> el QR apunta a ReseñaTap, no
            directamente a Google. Esto permite cambiar el destino de Google
            en el futuro sin tener que volver a imprimir el QR o reprogramar
            el NFC.
          </p>
        </section>
      )}

      <footer>
        Prototipo de desarrollo · No publica reseñas automáticamente en
        Google.
      </footer>
    </main>
  );
}