import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle,
  Flower,
  SealCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import { choosePackage } from "../plan-client.js";
import { EVENTS, eventDetails } from "../events.js";
import VendorContactLinks from "./VendorContactLinks.jsx";

const money = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);

export default function Packages({
  data,
  edit,
  navigate,
  save,
  saving,
  eventType,
}) {
  const [catalog, setCatalog] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [category, setCategory] = useState(EVENTS[eventType].catalogCategory);
  const [previewId, setPreviewId] = useState("");
  const [variantId, setVariantId] = useState("standard");

  async function loadCatalog() {
    setLoadError("");
    try {
      const response = await fetch("/api/packages", { cache: "no-store" });
      const body = await response.json();
      if (
        !response.ok ||
        !Array.isArray(body.packages) ||
        !body.packages.length
      )
        throw new Error(body.error || "Katalog belum dapat dibaca.");
      setCatalog(body);
      const current = body.packages.find(
        (p) => p.id === data.package.catalogId || p.name === data.package.name,
      );
      const preferredCategory = EVENTS[eventType].catalogCategory;
      const initialCategory = body.packages.some(
        (p) => p.category === preferredCategory,
      )
        ? preferredCategory
        : "Semua";
      setCategory(
        current && initialCategory !== "Semua"
          ? current.category
          : initialCategory,
      );
      setPreviewId(
        current?.id ||
          body.packages
            .filter((p) => p.category === initialCategory)
            .sort((a, b) => a.price - b.price)[0]?.id ||
          body.packages[0].id,
      );
      setVariantId(current ? data.package.variantId || "standard" : "standard");
    } catch (e) {
      setLoadError(e.message);
    }
  }
  useEffect(() => {
    loadCatalog();
  }, []);

  if (loadError)
    return (
      <div className="panel catalog-loading" role="alert">
        <WarningCircle size={28} />
        <p>{loadError}</p>
        <button className="button secondary" onClick={loadCatalog}>
          Coba lagi
        </button>
      </div>
    );
  if (!catalog)
    return (
      <div className="panel catalog-loading">
        <Flower size={28} weight="light" />
        <p>Membuka pilihan paket…</p>
      </div>
    );
  const preview =
    catalog.packages.find((p) => p.id === previewId) || catalog.packages[0];
  const variant = preview.variants.find((v) => v.id === variantId);
  const price = variant?.price ?? preview.price;
  const active =
    (data.package.catalogId === preview.id ||
      data.package.name === preview.name) &&
    (data.package.variantId || "standard") === variantId;
  const categories = [
    "Semua",
    ...new Set(catalog.packages.map((p) => p.category)),
  ];
  const choices = catalog.packages
    .filter((p) => category === "Semua" || p.category === category)
    .sort((a, b) => a.price - b.price);
  const variants = [
    { id: "standard", label: "Paket standar", price: preview.price },
    ...preview.variants,
  ].sort((a, b) => a.price - b.price);
  const notes = [...preview.notes, ...(variant?.note ? [variant.note] : [])];
  const source = preview.source || catalog.source;
  const cateringCosts = data.expenses.filter((e) =>
    /katering|catering/i.test(`${e.name} ${e.category}`),
  );

  function selectCategory(value) {
    setCategory(value);
    if (value !== "Semua" && preview.category !== value) {
      setPreviewId(
        catalog.packages
          .filter((p) => p.category === value)
          .sort((a, b) => a.price - b.price)[0].id,
      );
      setVariantId("standard");
    }
    setError("");
  }
  async function apply() {
    setError("");
    try {
      const next = choosePackage(data, preview, variantId);
      if (!(await save(next, "Paket pilihan dan anggaran diperbarui")))
        setError("Paket belum tersimpan. Periksa notifikasi dan coba lagi.");
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <>
      <div className="current-package-strip">
        <span className="current-package-icon">
          <SealCheck size={23} />
        </span>
        <div>
          <span>Paket dalam rencana kita</span>
          <strong>{data.package.name}</strong>
        </div>
        <div className="current-package-price">
          <strong>{money(data.package.price)}</strong>
          <button
            type="button"
            className="text-link"
            onClick={() => edit("packagePayment")}
          >
            Catat pembayaran <ArrowUpRight size={13} />
          </button>
        </div>
      </div>
      <section className="panel catalog-selector">
        <div className="catalog-selector-heading">
          <div>
            <h2>Temukan paket yang pas</h2>
            <p>Lihat fasilitasnya, lalu pilih untuk rencana kalian.</p>
          </div>
          <span>{catalog.packages.length} pilihan paket</span>
        </div>
        <div className="filter-tabs catalog-tabs" aria-label="Kategori paket">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              className={category === c ? "selected" : ""}
              aria-pressed={category === c}
              onClick={() => selectCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="catalog-select-fields">
          <label className="field">
            <span>Pilih paket</span>
            <select
              value={preview.id}
              onChange={(e) => {
                setPreviewId(e.target.value);
                setVariantId("standard");
                setError("");
              }}
            >
              {choices.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {money(p.price)}
                </option>
              ))}
            </select>
          </label>
          {preview.variants.length > 0 && (
            <label className="field">
              <span>Opsi paket</span>
              <select
                value={variantId}
                onChange={(e) => {
                  setVariantId(e.target.value);
                  setError("");
                }}
              >
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label} — {money(v.price)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </section>
      <section className="package-feature catalog-feature">
        <div>
          <span className="soft-badge">
            {active ? <CheckCircle size={14} /> : <Flower size={14} />}
            {active ? "Paket yang kalian gunakan" : "Pratinjau pilihan"}
          </span>
          <h2>{preview.name}</h2>
          <p>{active ? data.package.vendor : preview.vendor}</p>
          <VendorContactLinks
            offer={
              active
                ? {
                    ...preview,
                    ...data.package,
                    contacts: data.package.contacts ?? preview.contacts,
                  }
                : preview
            }
          />
          {active && data.package.note && (
            <p className="vendor-description">{data.package.note}</p>
          )}
          <div className="catalog-facts">
            <span>{preview.category}</span>
            {preview.capacity && (
              <span>
                {preview.capacity.toLocaleString("id-ID")} pax di brosur
              </span>
            )}
            {preview.includesCatering && (
              <span>
                Katering {preview.cateringPax.toLocaleString("id-ID")} pax
              </span>
            )}
            {variant && <span>{variant.label}</span>}
          </div>
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="text-link"
          >
            {source.kind === "image"
              ? "Lihat flyer vendor"
              : `Brosur asli · halaman ${preview.sourcePage}`}{" "}
            <ArrowUpRight size={15} />
          </a>
        </div>
        <div className="feature-price">
          {preview.originalPrice && !variant && (
            <del>{money(preview.originalPrice)}</del>
          )}
          <strong>{money(price)}</strong>
          <span>
            {source.kind === "image"
              ? "Harga dalam flyer vendor"
              : "Harga yang tercantum di brosur"}
          </span>
          <button
            type="button"
            className={`button ${active ? "secondary" : "primary"}`}
            onClick={apply}
            disabled={saving || active}
          >
            {active ? <Check size={16} /> : <CheckCircle size={16} />}
            {saving
              ? "Menyimpan…"
              : active
                ? "Paket digunakan"
                : "Gunakan paket ini"}
          </button>
        </div>
      </section>
      {source.kind === "image" && (
        <a
          className="vendor-flyer-reference"
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src={source.url} alt={source.title} loading="lazy" />
          <div>
            <strong>{source.title}</strong>
            <span>
              Buka gambar untuk melihat contoh dekorasi dan rincian penawaran.
            </span>
          </div>
          <ArrowUpRight size={19} />
        </a>
      )}
      {error && (
        <div className="form-error catalog-error" role="alert">
          <WarningCircle size={20} />
          <span>{error}</span>
        </div>
      )}
      {notes.map((note, i) => (
        <div className="info-callout catalog-notice" key={i}>
          <WarningCircle size={20} />
          <p>{note}</p>
        </div>
      ))}
      {preview.includesCatering && cateringCosts.length > 0 && (
        <div className="info-callout catalog-notice">
          <WarningCircle size={20} />
          <p>
            Paket ini mencakup katering. Anggaran kalian juga mencatat{" "}
            {cateringCosts.map((e) => e.name).join(", ")} sebagai biaya
            tambahan. Tinjau kebutuhan tersebut agar konsumsi tidak dihitung dua
            kali.
          </p>
        </div>
      )}
      <div className="catalog-facilities-heading">
        <div>
          <h2>
            {variant?.id === "without-akad"
              ? "Fasilitas paket dasar dalam brosur"
              : "Fasilitas yang termasuk"}
          </h2>
          <p>
            {preview.groups.length} kelompok fasilitas untuk {preview.name}
            {variant ? ` · ${variant.label}` : ""}.
          </p>
        </div>
        <span>
          Target kalian:{" "}
          {eventDetails(data).guestTarget
            ? `${eventDetails(data).guestTarget} tamu`
            : "belum ditentukan"}
        </span>
      </div>
      <div className="package-groups catalog-facilities">
        {preview.groups.map((g, i) => (
          <section className="panel package-group" key={g.title}>
            <span className="group-number">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h2>{g.title}</h2>
            <ul>
              {g.items.map((item) => (
                <li key={item}>
                  <Check size={15} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <details className="catalog-source-notes">
        <summary>Catatan harga dan penyesuaian paket</summary>
        {source.notes.map((note) => (
          <p key={note}>{note}</p>
        ))}
      </details>
      <div className="section-end">
        <p>Sesuaikan kebutuhan tambahan dengan pilihan paket.</p>
        <button
          type="button"
          className="button secondary"
          onClick={() => navigate("budget")}
        >
          Buka anggaran <ArrowRight size={16} />
        </button>
      </div>
    </>
  );
}
