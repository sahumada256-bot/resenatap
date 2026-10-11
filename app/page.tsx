"use client";

import { QRCodeSVG } from "qrcode.react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";

// ======================================================
// ADMINISTRADOR AUTORIZADO EN SUPABASE AUTH
// ======================================================

const ADMIN_USER_IDS = [
  "58c729b8-1a34-4c2a-8e9a-4527d9fb332c", // Sebastián
  "329513cb-727b-48e8-ab87-34106c13503e", // Miguel
];

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
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

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
  const [copyMessage, setCopyMessage] = useState("");
  const [promoImageDataUrl, setPromoImageDataUrl] = useState("");
  const [promoError, setPromoError] = useState("");
  const [isDeletingBusiness, setIsDeletingBusiness] = useState(false);
  const [isEditingBusiness, setIsEditingBusiness] = useState(false);
  const [editBusinessName, setEditBusinessName] = useState("");
  const [editGoogleReviewUrl, setEditGoogleReviewUrl] = useState("");
  const [managementError, setManagementError] = useState("");
  const [managementSuccess, setManagementSuccess] = useState("");

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

    let isMounted = true;

    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      const user = data.session?.user;
      const isAdmin = !error && !!user?.id && ADMIN_USER_IDS.includes(user.id);

      if (isAdmin) {
        if (isMounted) {
          setIsLoggedIn(true);
          setIsCheckingLogin(false);
          void loadBusinesses();
        }
        return;
      }

      // Una sesión de otro usuario no debe abrir el panel de administración.
      if (user) {
        await supabase.auth.signOut();
      }

      if (isMounted) {
        setIsLoggedIn(false);
        setIsCheckingLogin(false);
        setIsLoading(false);
      }
    };

    void checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const user = session?.user;
        const isAdmin = !!user?.id && ADMIN_USER_IDS.includes(user.id);

        if (isAdmin) {
          setIsLoggedIn(true);
          void loadBusinesses();
        } else {
          setIsLoggedIn(false);
          setBusinesses([]);
          setIsLoading(false);
        }
        setIsCheckingLogin(false);
      }
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
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

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");
    setIsLoggingIn(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword,
    });

    if (error || !data.user) {
      setLoginError("Correo o contraseña incorrectos.");
      setIsLoggingIn(false);
      return;
    }

    if (!ADMIN_USER_IDS.includes(data.user.id)) {
      await supabase.auth.signOut();
      setLoginError("Esta cuenta no tiene permisos de administrador.");
      setIsLoggingIn(false);
      return;
    }

    setIsLoggedIn(true);
    setLoginEmail("");
    setLoginPassword("");
    setShowPassword(false);
    setIsLoggingIn(false);
  }

  // ====================================================
  // LOGOUT
  // ====================================================

  async function handleLogout() {
    await supabase.auth.signOut();
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
  // COPIAR ENLACE PÚBLICO
  // ====================================================

  async function copyLandingUrl() {
    if (!landingUrl) return;

    try {
      await navigator.clipboard.writeText(landingUrl);
      setCopyMessage("¡Enlace copiado!");
    } catch {
      setCopyMessage(
        "No se pudo copiar automáticamente. Seleccioná y copiá el enlace manualmente."
      );
    }
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
  // GENERAR IMAGEN PROMOCIONAL (SIN GUARDAR EN SUPABASE)
  // ====================================================

  async function createPromoImage(): Promise<string> {
    if (!selectedBusiness) {
      throw new Error("Seleccioná un comercio para generar su imagen.");
    }

    // Tomamos el SVG del QR que ya corresponde al comercio seleccionado.
    const qrSvg = document.getElementById("resenatap-qr");
    if (!(qrSvg instanceof SVGElement)) {
      throw new Error("No encontramos el QR de este comercio. Volvé a abrirlo e intentá nuevamente.");
    }

    const svgText = new XMLSerializer().serializeToString(qrSvg);
    const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);

    try {
      const qrImage = new Image();
      await new Promise<void>((resolve, reject) => {
        qrImage.onload = () => resolve();
        qrImage.onerror = () => reject(new Error("No se pudo preparar el QR para la imagen."));
        qrImage.src = svgUrl;
      });

      // Afiche vertical, inspirado en el modelo aprobado. No se guarda nada en Supabase.
      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 1448;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("El navegador no pudo crear la imagen.");

      const navy = "#092b52";
      const blue = "#087bea";
      const paleBlue = "#dff1ff";
      const white = "#ffffff";
      const center = 512;

      function roundedRect(x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string, lineWidth = 1) {
        ctx!.beginPath();
        ctx!.roundRect(x, y, w, h, r);
        ctx!.fillStyle = fill;
        ctx!.fill();
        if (stroke) {
          ctx!.lineWidth = lineWidth;
          ctx!.strokeStyle = stroke;
          ctx!.stroke();
        }
      }
      function drawStar(cx: number, cy: number, outer: number, inner: number, color: string) {
        ctx!.beginPath();
        for (let i = 0; i < 10; i++) {
          const radius = i % 2 === 0 ? outer : inner;
          const angle = -Math.PI / 2 + i * Math.PI / 5;
          const x = cx + Math.cos(angle) * radius;
          const y = cy + Math.sin(angle) * radius;
          if (i === 0) ctx!.moveTo(x, y); else ctx!.lineTo(x, y);
        }
        ctx!.closePath();
        ctx!.fillStyle = color;
        ctx!.fill();
      }
      function drawNfc(cx: number, cy: number, scale = 1) {
        ctx!.save();
        ctx!.strokeStyle = navy;
        ctx!.lineWidth = 10 * scale;
        ctx!.lineCap = "round";
        ctx!.lineJoin = "round";
        for (let i = 0; i < 3; i++) {
          ctx!.beginPath();
          ctx!.arc(cx - 14 * scale, cy, (20 + i * 18) * scale, -0.9, 0.9);
          ctx!.stroke();
        }
        ctx!.restore();
      }

      // Fondo blanco con borde suave y detalles celestes en las esquinas.
      ctx.fillStyle = white;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      roundedRect(2, 2, 1020, 1444, 38, white, "#d9e7f4", 3);
      ctx.fillStyle = paleBlue;
      ctx.beginPath(); ctx.moveTo(715, 3); ctx.lineTo(1020, 3); ctx.lineTo(1020, 180); ctx.quadraticCurveTo(950, 90, 800, 75); ctx.quadraticCurveTo(720, 60, 715, 3); ctx.fill();
      ctx.beginPath(); ctx.moveTo(3, 915); ctx.quadraticCurveTo(160, 965, 55, 1100); ctx.lineTo(3, 1160); ctx.fill();

      // Encabezado: teléfono con ondas NFC, sin mano para evitar el defecto anterior.
      ctx.save();
      ctx.translate(95, 62);
      ctx.rotate(-0.12);
      roundedRect(0, 0, 132, 190, 27, navy);
      roundedRect(10, 12, 112, 166, 19, white);
      ctx.fillStyle = navy;
      ctx.beginPath(); ctx.roundRect(44, 5, 44, 9, 5); ctx.fill();
      ctx.strokeStyle = blue; ctx.lineWidth = 8; ctx.lineCap = "round";
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.arc(66, 88, 17 + i * 15, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke();
      }
      ctx.restore();

      ctx.textAlign = "left";
      ctx.fillStyle = navy;
      ctx.font = "bold 83px Arial, Helvetica, sans-serif";
      ctx.fillText("Reseña", 265, 151);
      const logoWidth = ctx.measureText("Reseña").width;
      ctx.fillStyle = blue;
      ctx.fillText("Tap", 265 + logoWidth, 151);
      ctx.fillStyle = navy;
      ctx.font = "30px Arial, Helvetica, sans-serif";
      ctx.fillText("Tu opinión nos ayuda a crecer", 270, 194);

      // Cinco estrellas doradas, en lugar de una mano.
      for (let i = 0; i < 5; i++) drawStar(385 + i * 64, 226, 13, 6, "#fbbc04");

      ctx.textAlign = "center";
      ctx.fillStyle = navy;
      ctx.font = "bold 57px Arial, Helvetica, sans-serif";
      ctx.fillText("Dejá tu reseña en", center, 292);

      // Logotipo tipográfico Google multicolor.
      const googleParts = [
        { text: "G", color: "#4285f4" }, { text: "o", color: "#ea4335" },
        { text: "o", color: "#fbbc05" }, { text: "g", color: "#4285f4" },
        { text: "l", color: "#34a853" }, { text: "e", color: "#ea4335" },
      ];
      ctx.font = "bold 104px Arial, Helvetica, sans-serif";
      const totalGoogleWidth = googleParts.reduce((sum, part) => sum + ctx.measureText(part.text).width, 0);
      let gx = center - totalGoogleWidth / 2;
      for (const part of googleParts) {
        ctx.fillStyle = part.color;
        ctx.textAlign = "left";
        ctx.fillText(part.text, gx, 390);
        gx += ctx.measureText(part.text).width;
      }

      // Adornos azules laterales.
      ctx.strokeStyle = blue; ctx.lineWidth = 11; ctx.lineCap = "round";
      for (const side of [1, -1]) {
        const x = side === 1 ? 160 : 864;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          const y = 355 + i * 42;
          ctx.moveTo(x - (side === 1 ? 0 : 0), y);
          ctx.lineTo(x + (side === 1 ? 44 : -44), y + (i - 1) * 7);
          ctx.stroke();
        }
      }

      // Marco y QR real del comercio seleccionado.
      ctx.fillStyle = paleBlue;
      ctx.beginPath(); ctx.roundRect(315, 423, 394, 394, 42); ctx.fill();
      roundedRect(333, 440, 358, 358, 32, white, navy, 8);
      ctx.fillStyle = white;
      ctx.fillRect(354, 461, 316, 316);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(qrImage, 358, 465, 308, 308);
      ctx.imageSmoothingEnabled = true;

      // NFC queda centrado DEBAJO del marco, sin invadir el QR ni superponer textos.
      drawNfc(center, 853, 0.72);
      ctx.textAlign = "center";
      ctx.fillStyle = navy;
      ctx.font = "bold 34px Arial, Helvetica, sans-serif";
      ctx.fillText("NFC", center, 913);
      ctx.font = "bold 22px Arial, Helvetica, sans-serif";
      ctx.fillText("También podés", center, 943);
      ctx.fillText("tocar con tu celular", center, 970);

      // Tres pasos inferiores, con separadores.
      const stepY = 1030;
      const circles = [195, 512, 829];
      for (const x of circles) {
        ctx.fillStyle = paleBlue;
        ctx.beginPath(); ctx.arc(x, stepY + 28, 59, 0, Math.PI * 2); ctx.fill();
      }
      // Paso 1: teléfono con ondas.
      roundedRect(174, stepY - 9, 38, 74, 10, white, navy, 6);
      ctx.strokeStyle = blue; ctx.lineWidth = 6; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(210, stepY + 27, 17, -0.8, 0.8); ctx.stroke();
      ctx.beginPath(); ctx.arc(210, stepY + 27, 28, -0.8, 0.8); ctx.stroke();
      // Paso 2: G multicolor.
      ctx.font = "bold 76px Arial, Helvetica, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#4285f4"; ctx.fillText("G", 512, stepY + 54);
      // Paso 3: estrella dorada.
      drawStar(829, stepY + 28, 34, 15, "#fbbc04");

      ctx.strokeStyle = "#b9d7ee"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(353, 1020); ctx.lineTo(353, 1160); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(671, 1020); ctx.lineTo(671, 1160); ctx.stroke();
      ctx.fillStyle = navy; ctx.font = "bold 24px Arial, Helvetica, sans-serif";
      ctx.fillText("Escaneá", 195, 1122);
      ctx.fillText("o tocá el código", 195, 1151);
      ctx.fillText("Dejá tu", 512, 1122);
      ctx.fillText("reseña", 512, 1151);
      ctx.fillText("Ayudanos", 829, 1122);
      ctx.fillText("a mejorar", 829, 1151);

      // Pie azul oscuro con ondas celestes y agradecimiento.
      ctx.fillStyle = blue;
      ctx.beginPath(); ctx.moveTo(3, 1210); ctx.quadraticCurveTo(270, 1260, 512, 1228); ctx.quadraticCurveTo(760, 1205, 1021, 1210); ctx.lineTo(1021, 1250); ctx.lineTo(3, 1250); ctx.closePath(); ctx.fill();
      ctx.fillStyle = navy;
      ctx.beginPath(); ctx.moveTo(3, 1240); ctx.quadraticCurveTo(300, 1285, 512, 1260); ctx.quadraticCurveTo(780, 1235, 1021, 1240); ctx.lineTo(1021, 1445); ctx.lineTo(3, 1445); ctx.closePath(); ctx.fill();
      ctx.fillStyle = white;
      ctx.font = "italic bold 72px Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillText("¡Gracias!", center, 1367);
      ctx.strokeStyle = blue; ctx.lineWidth = 7; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(410, 1388); ctx.quadraticCurveTo(512, 1357, 614, 1388); ctx.stroke();
      ctx.strokeStyle = blue; ctx.lineWidth = 8;
      for (const x of [300, 724]) {
        for (let i = 0; i < 3; i++) {
          ctx.beginPath(); ctx.moveTo(x - 12, 1322 + i * 27); ctx.lineTo(x + 12, 1315 + i * 27); ctx.stroke();
        }
      }

      return canvas.toDataURL("image/png");
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  }

  async function handleGeneratePromoImage() {
    setPromoError("");
    setPromoImageDataUrl("");
    try {
      const imageDataUrl = await createPromoImage();
      setPromoImageDataUrl(imageDataUrl);
    } catch (error) {
      setPromoError(error instanceof Error ? error.message : "No se pudo generar la imagen.");
    }
  }

  function handleDownloadPromoImage() {
    if (!promoImageDataUrl || !selectedBusiness) return;
    const link = document.createElement("a");
    link.href = promoImageDataUrl;
    link.download = `resenatap-${selectedBusiness.id}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function handlePrintPromoImage() {
    if (!promoImageDataUrl || !selectedBusiness) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setPromoError("El navegador bloqueó la ventana de impresión. Permití las ventanas emergentes e intentá nuevamente.");
      return;
    }

    const safeName = selectedBusiness.name.replace(/[<>&"']/g, "");
    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Imprimir ReseñaTap - ${safeName}</title>
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            * { box-sizing: border-box; }
            html, body { margin: 0; padding: 0; background: #fff; }
            body { display: flex; align-items: center; justify-content: center; min-height: 100vh; }
            img { display: block; width: auto; height: auto; max-width: 100%; max-height: 275mm; object-fit: contain; }
            @media screen { body { padding: 16px; } img { max-height: calc(100vh - 32px); } }
          </style>
        </head>
        <body>
          <img src="${promoImageDataUrl}" alt="Imagen promocional de ${safeName}" onload="window.focus(); window.print();" />
        </body>
      </html>`);
    printWindow.document.close();
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
    const business = businesses.find((item) => item.id === businessId);
    if (!business) return;

    setSelectedId(businessId);
    setPromoImageDataUrl("");
    setPromoError("");
    setEditBusinessName(business.name);
    setEditGoogleReviewUrl(business.google_review_url);
    setIsEditingBusiness(false);
    setCopyMessage("");
    setManagementSuccess("");
    setManagementError("");
    setSuccessMessage("");
    setErrorMessage("");
  }

  // ====================================================
  // EDITAR COMERCIO
  // ====================================================

  async function handleSaveBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBusiness || isSaving) return;

    setManagementError("");
    setManagementSuccess("");

    const cleanName = editBusinessName.trim();
    const cleanUrl = editGoogleReviewUrl.trim();

    if (!cleanName) {
      setManagementError("Ingresá el nombre del comercio.");
      return;
    }

    if (!isValidGoogleReviewUrl(cleanUrl)) {
      setManagementError("Ingresá un enlace válido de Google para dejar reseñas.");
      return;
    }

    setIsSaving(true);
    const { data, error } = await supabase
      .from("businesses")
      .update({ name: cleanName, google_review_url: cleanUrl })
      .eq("id", selectedBusiness.id)
      .select("*")
      .single();

    if (error || !data) {
      setManagementError(
        "No pudimos guardar los cambios. Verificá tus permisos e intentá nuevamente."
      );
      setIsSaving(false);
      return;
    }

    const updatedBusiness = data as Business;
    setBusinesses((previous) =>
      previous.map((business) =>
        business.id === updatedBusiness.id ? updatedBusiness : business
      )
    );
    setEditBusinessName(updatedBusiness.name);
    setEditGoogleReviewUrl(updatedBusiness.google_review_url);
    setIsEditingBusiness(false);
    setManagementSuccess("Cambios guardados correctamente.");
    setIsSaving(false);
  }

  // ====================================================
  // ELIMINAR COMERCIO
  // ====================================================

  async function handleDeleteBusiness() {
    if (!selectedBusiness || isDeletingBusiness) return;

    const confirmed = window.confirm(
      `¿Seguro que querés eliminar a "${selectedBusiness.name}"? Esta acción no se puede deshacer y su enlace público dejará de funcionar.`
    );
    if (!confirmed) return;

    setIsDeletingBusiness(true);
    setManagementError("");
    setManagementSuccess("");

    const { data, error } = await supabase
      .from("businesses")
      .delete()
      .eq("id", selectedBusiness.id)
      .select("id");

    if (error || !data || data.length === 0) {
      setManagementError(
        error
          ? "No pudimos eliminar el comercio. Revisá los permisos e intentá nuevamente."
          : "Supabase no eliminó el comercio. Verificá los permisos de administrador e intentá nuevamente."
      );
      setIsDeletingBusiness(false);
      return;
    }

    setBusinesses((previous) =>
      previous.filter((business) => business.id !== selectedBusiness.id)
    );
    setSelectedId(null);
    setIsEditingBusiness(false);
    setCopyMessage("");
    setManagementSuccess("Comercio eliminado correctamente.");
    setCurrentPage((page) => Math.min(page, Math.max(1, Math.ceil((filteredBusinesses.length - 1) / BUSINESSES_PER_PAGE))));
    setIsDeletingBusiness(false);
  }

  // ====================================================
  // CERRAR PANEL
  // ====================================================

  function closeBusinessPanel() {
    setSelectedId(null);
    setIsEditingBusiness(false);
    setCopyMessage("");
    setManagementError("");
    setManagementSuccess("");
    setErrorMessage("");
  }

  // ====================================================
  // PÁGINA PÚBLICA
  // ====================================================

  if (isPublicPage) {
    return (
      <main className="public-page">
        <div className="public-card">
          <div className="brand public-brand">
            <div className="brand-icon">RT</div>
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
            <div className="brand-icon">RT</div>
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
            <label htmlFor="login-email">
              Correo electrónico
            </label>

            <input
              id="login-email"
              type="email"
              placeholder="Ingresá tu correo electrónico"
              value={loginEmail}
              onChange={(event) =>
                setLoginEmail(event.target.value)
              }
              autoComplete="email"
              required
            />

            <label htmlFor="login-password">
              Contraseña
            </label>

            <div className="password-field">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                placeholder="Ingresá tu contraseña"
                value={loginPassword}
                onChange={(event) =>
                  setLoginPassword(event.target.value)
                }
                autoComplete="current-password"
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowPassword((value) => !value)
                }
                aria-label={
                  showPassword
                    ? "Ocultar contraseña"
                    : "Mostrar contraseña"
                }
                title={
                  showPassword
                    ? "Ocultar contraseña"
                    : "Mostrar contraseña"
                }
              >
                {showPassword ? (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M3 3L21 21"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M10.58 10.58A2 2 0 0 0 13.42 13.42"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M9.88 4.24A10.94 10.94 0 0 1 12 4c5 0 8.5 4 9.5 6-.38.76-1.27 2.12-2.67 3.34M6.61 6.61C4.84 7.75 3.6 9.4 2.5 12c1 2 4.5 6 9.5 6 1.05 0 2.02-.18 2.9-.49"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="2.5"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  </svg>
                )}
              </button>
            </div>

            {loginError && (
              <p className="login-error">
                {loginError}
              </p>
            )}

            <button
              className="login-button"
              type="submit"
              disabled={isLoggingIn}
            >
              {isLoggingIn ? "Ingresando..." : "Ingresar"}
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

          .password-field {
            position: relative;
            width: 100%;
          }

          .password-field input {
            padding-right: 48px;
          }

          .password-toggle {
            position: absolute;
            top: 23px;
            right: 10px;
            display: grid;
            width: 30px;
            height: 30px;
            place-items: center;
            border: 0;
            border-radius: 7px;
            background: transparent;
            color: #728097;
            font-size: 17px;
            line-height: 1;
            transform: translateY(-50%);
            cursor: pointer;
          }

          .password-toggle:hover {
            background: #f4f7fb;
            color: #172033;
          }

          .password-toggle:focus-visible {
            outline: 2px solid #16804c;
            outline-offset: 1px;
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
            <div className="brand-icon">RT</div>
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

            {managementSuccess && !selectedBusiness && (
              <p className="form-message success-message" role="status">{managementSuccess}</p>
            )}
            {managementError && !selectedBusiness && (
              <p className="form-message error-message" role="alert">{managementError}</p>
            )}

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

            {isEditingBusiness && (
              <form className="business-edit-form" onSubmit={handleSaveBusiness}>
                <label htmlFor="edit-business-name">Nombre del comercio</label>
                <input
                  id="edit-business-name"
                  type="text"
                  value={editBusinessName}
                  onChange={(event) => setEditBusinessName(event.target.value)}
                  maxLength={100}
                  required
                />

                <label htmlFor="edit-google-review-url">Enlace directo de reseñas de Google</label>
                <textarea
                  id="edit-google-review-url"
                  value={editGoogleReviewUrl}
                  onChange={(event) => setEditGoogleReviewUrl(event.target.value)}
                  rows={3}
                  required
                />

                <div className="business-management-actions">
                  <button className="primary-button" type="submit" disabled={isSaving}>
                    {isSaving ? "Guardando..." : "Guardar cambios"}
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={isSaving}
                    onClick={() => {
                      setEditBusinessName(selectedBusiness.name);
                      setEditGoogleReviewUrl(selectedBusiness.google_review_url);
                      setIsEditingBusiness(false);
                      setManagementError("");
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {!isEditingBusiness && (
              <div className="business-management-actions business-management-top-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setEditBusinessName(selectedBusiness.name);
                    setEditGoogleReviewUrl(selectedBusiness.google_review_url);
                    setIsEditingBusiness(true);
                    setManagementError("");
                    setManagementSuccess("");
                  }}
                >
                  Editar comercio
                </button>
                <button
                  type="button"
                  className="danger-button"
                onClick={handleDeleteBusiness}
                disabled={isDeletingBusiness}
              >
                {isDeletingBusiness ? "Eliminando..." : "Eliminar comercio"}
              </button>
              </div>
            )}

            {managementError && (
              <p className="form-message error-message" role="alert">
                {managementError}
              </p>
            )}
            {managementSuccess && (
              <p className="form-message success-message" role="status">
                {managementSuccess}
              </p>
            )}

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

                <button
                  type="button"
                  className="copy-link-button"
                  onClick={copyLandingUrl}
                >
                  Copiar enlace
                </button>

                {copyMessage && (
                  <p
                    className={`copy-message ${
                      copyMessage.startsWith("¡")
                        ? "copy-message-success"
                        : "copy-message-error"
                    }`}
                    role="status"
                    aria-live="polite"
                  >
                    {copyMessage}
                  </p>
                )}

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

            <div className="promo-image-tools">
              <div className="promo-image-heading">
                <h3>Imagen promocional</h3>
                <p>Generá una imagen con el nombre del comercio y su QR único. Podés descargarla o imprimirla.</p>
              </div>

              <div className="material-actions promo-image-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleGeneratePromoImage}
                >
                  Generar imagen
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleDownloadPromoImage}
                  disabled={!promoImageDataUrl}
                >
                  Descargar imagen PNG
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handlePrintPromoImage}
                  disabled={!promoImageDataUrl}
                >
                  Imprimir imagen
                </button>
              </div>

              {promoError && <p className="form-message error-message" role="alert">{promoError}</p>}

              {promoImageDataUrl && (
                <div className="promo-image-preview">
                  <p className="promo-preview-label">Vista previa de la imagen generada</p>
                  <img src={promoImageDataUrl} alt={`Imagen promocional de ${selectedBusiness.name}`} />
                </div>
              )}
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

        .danger-button {
          display: inline-flex;
          min-height: 39px;
          align-items: center;
          justify-content: center;
          border: 1px solid #f0c8c5;
          border-radius: 8px;
          padding: 0 14px;
          background: #fff;
          color: #b42318;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .danger-button:hover {
          background: #fff5f4;
        }

        .danger-button:disabled {
          opacity: 0.65;
          cursor: wait;
        }

        .business-management-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
          margin: 14px 0;
        }

        .business-management-top-actions {
          margin-top: 0;
          margin-bottom: 18px;
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

        .copy-link-button {
          display: inline-flex;
          min-height: 36px;
          align-items: center;
          justify-content: center;
          margin-top: 9px;
          border: 1px solid #d8e1eb;
          border-radius: 8px;
          padding: 0 13px;
          background: #fff;
          color: #26364d;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s;
        }

        .copy-link-button:hover {
          background: #f6f8fb;
        }

        .copy-link-button:focus-visible {
          outline: 2px solid #16804c;
          outline-offset: 2px;
        }

        .copy-message {
          margin: 7px 0 0;
          font-size: 12px;
          line-height: 1.45;
        }

        .copy-message-success {
          color: #187847;
        }

        .copy-message-error {
          color: #b42318;
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

        .material-actions button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .promo-image-tools {
          margin-top: 28px;
          padding-top: 22px;
          border-top: 1px solid #e8edf3;
        }

        .promo-image-heading h3 {
          margin: 0;
          color: #172033;
          font-size: 15px;
        }

        .promo-image-heading p {
          margin: 8px 0 15px;
          color: #728097;
          font-size: 12px;
          line-height: 1.55;
        }

        .promo-image-actions {
          margin-bottom: 16px;
        }

        .promo-image-preview {
          max-width: 440px;
          margin-top: 18px;
          padding: 12px;
          border: 1px solid #e1e8f0;
          border-radius: 12px;
          background: #f8fafc;
        }

        .promo-preview-label {
          margin: 0 0 10px;
          color: #728097;
          font-size: 11px;
        }

        .promo-image-preview img {
          display: block;
          width: 100%;
          height: auto;
          border-radius: 6px;
          background: white;
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

          .business-edit-form {
            display: grid;
            gap: 10px;
            margin: 18px 0;
            padding: 18px;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            background: #f8fafc;
          }

          .business-edit-form label {
            color: #344054;
            font-size: 13px;
            font-weight: 700;
          }

          .business-edit-form input,
          .business-edit-form textarea {
            width: 100%;
            min-width: 0;
            padding: 11px 12px;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            background: #fff;
            color: #172033;
            font: inherit;
            font-size: 14px;
          }

          .business-edit-form input:focus,
          .business-edit-form textarea:focus {
            outline: 2px solid #bfdbfe;
            border-color: #1673e6;
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

          .promo-image-preview {
            max-width: 100%;
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