import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  DownloadSimple,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ArrowUpRight,
  CalendarBlank,
  CaretRight,
  Check,
  CheckCircle,
  Checks,
  Clock,
  Code,
  Flower,
  GearSix,
  Heart,
  House,
  List,
  MagnifyingGlass,
  NotePencil,
  PencilSimple,
  Plus,
  Tray,
  Trash,
  UploadSimple,
  User,
  Users,
  Wallet,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import "@fontsource-variable/manrope";
import {
  summarize,
  createId,
  reorderTasks,
  budgetEntries,
  paymentState,
} from "../plan-client.js";
import { EVENTS, eventDetails, parseRoute, planHref } from "../events.js";
import "./styles.css";
import "./budget.css";
import Packages from "./Packages.jsx";
import BudgetDetails from "./BudgetDetails.jsx";
import { BudgetList, BudgetItemDetail } from "./BudgetItems.jsx";
import BudgetEditorFields from "./BudgetEditorFields.jsx";
import MoneyInput from "./MoneyInput.jsx";
import { TaskBudgetLinks, TaskConclusion } from "./TaskConnections.jsx";
import AttachmentEditor, { createLinkAttachment } from "./Attachments.jsx";

const money = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
const shortMoney = (n) =>
  `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n / 1e6)} jt`;
const dateLabel = (date) =>
  date
    ? new Date(`${date}T12:00:00`).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Tanggal belum ditentukan";
const pages = [
  { key: "overview", label: "Ringkasan", icon: House },
  { key: "tasks", label: "Checklist", icon: Checks },
  { key: "budget", label: "Anggaran", icon: Wallet },
  { key: "guests", label: "Daftar tamu", icon: Users },
  { key: "timeline", label: "Rundown", icon: Clock },
  { key: "package", label: "Paket & vendor", icon: Flower },
  { key: "notes", label: "Catatan bersama", icon: NotePencil },
];
const descriptions = {
  tasks: "Satu per satu, kita siapkan bersama.",
  budget: "Setiap rencana punya angkanya. Catat dengan tenang.",
  guests: "Orang-orang tersayang yang akan merayakan bersama kita.",
  timeline: "Susun alur hari bahagia, dari persiapan sampai selesai.",
  package: "Semua yang termasuk, dan yang perlu kita pastikan.",
  notes: "Tempat menyimpan ide, keputusan, dan hal-hal kecil.",
  data: "Detail pernikahan dan satu sumber data untuk kalian berdua.",
};

function Button({
  children,
  icon: Icon,
  variant = "primary",
  className = "",
  ...props
}) {
  return (
    <button className={`button ${variant} ${className}`} {...props}>
      {Icon && <Icon size={17} />}
      {children}
    </button>
  );
}
function IconButton({ icon: Icon, label, ...props }) {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon size={18} />
    </button>
  );
}
function Empty({ icon: Icon = Tray, title, description, children }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={29} weight="light" />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Stat({
  icon: Icon,
  label,
  value,
  compactValue,
  children,
  suffix,
  onClick,
}) {
  return (
    <button className="stat" onClick={onClick}>
      <span className="stat-top">
        {label}
        <Icon size={19} />
      </span>
      <span className="stat-value">
        <span className={compactValue ? "desktop-number" : ""}>{value}</span>
        {compactValue && <span className="mobile-number">{compactValue}</span>}
        {suffix && <small>{suffix}</small>}
      </span>
      <span className="stat-foot">
        {children}
        <ArrowUpRight size={16} />
      </span>
    </button>
  );
}

function App() {
  const [eventType, setEventType] = useState(
    () => parseRoute(location.hash).eventType,
  );
  useEffect(() => {
    const change = () => setEventType(parseRoute(location.hash).eventType);
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  return <Planner key={eventType} eventType={eventType} />;
}

function Planner({ eventType }) {
  const context = EVENTS[eventType];
  useEffect(() => {
    document.title = `Ruang Kita — Rencana ${context.label}`;
  }, [context.label]);
  const [state, setState] = useState(null);
  const [catalog, setCatalog] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/packages", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Katalog belum tersedia");
        return response.json();
      })
      .then((body) => {
        if (!cancelled) setCatalog(body);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const [loadingError, setLoadingError] = useState("");
  const [page, setPage] = useState(() => parseRoute(location.hash).page);
  const [mobileNav, setMobileNav] = useState(false);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [toast, setToast] = useState(null);
  const [conflict, setConflict] = useState(false);
  const stateRef = useRef(state);
  const saveLock = useRef(false);
  const modalRef = useRef(modal);
  const toastTimer = useRef(null);
  stateRef.current = state;
  modalRef.current = modal;

  const notify = useCallback((message, error = false) => {
    clearTimeout(toastTimer.current);
    setToast({ message, error });
    toastTimer.current = setTimeout(() => setToast(null), error ? 8500 : 3500);
  }, []);
  const load = useCallback(
    async (quiet = false) => {
      try {
        const response = await fetch(context.api, { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        if (saveLock.current || (quiet && modalRef.current)) return;
        setState((old) => (old?.revision === body.revision ? old : body));
        setLoadingError("");
      } catch (error) {
        if (!quiet)
          setLoadingError(error.message || "Server belum bisa dihubungi.");
      }
    },
    [context.api],
  );
  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (!document.hidden) load(true);
    }, 10000);
    const refresh = () => {
      if (!document.hidden) load(true);
    };
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      clearTimeout(toastTimer.current);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);
  useEffect(() => {
    const handler = () => setPage(parseRoute(location.hash).page);
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  function navigate(key) {
    setPage(key);
    location.hash = planHref(eventType, key);
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function save(next, successMessage = "Perubahan tersimpan") {
    if (saveLock.current) return false;
    saveLock.current = true;
    setSaving(true);
    setSaveError("");
    try {
      const response = await fetch(context.api, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: next,
          revision: stateRef.current.revision,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        if (response.status === 409) setConflict(true);
        throw new Error(body.error || "Perubahan belum tersimpan.");
      }
      setState(body);
      setConflict(false);
      notify(successMessage);
      return true;
    } catch (error) {
      const message =
        error.message || "Koneksi terputus. Perubahan belum tersimpan.";
      setSaveError(message);
      notify(message, true);
      return false;
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }
  function edit(type, item = null) {
    setSaveError("");
    if (type === "packagePayment") {
      const selected = stateRef.current.data.package;
      const offer = catalog?.packages?.find(
        (p) => p.id === selected.catalogId || p.name === selected.name,
      );
      item = {
        ...selected,
        contacts: selected.contacts ?? offer?.contacts ?? {},
      };
    }
    setModal({ type, item });
  }
  async function remove(collection, item) {
    setModal({ type: "delete", collection, item });
  }
  function exportData() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(stateRef.current.data, null, 2) + "\n"], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `ruang-kita-${context.exportName}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify("Salinan JSON diunduh");
  }
  if (!state)
    return (
      <div className="loading-screen">
        <div className="brand">
          <span className="brand-mark">
            <Heart size={23} />
          </span>
          ruang kita<span className="brand-period">.</span>
        </div>
        {loadingError ? (
          <>
            <p role="alert">{loadingError}</p>
            <Button onClick={() => load()}>Coba lagi</Button>
          </>
        ) : (
          <p>Menyiapkan ruang untuk kalian…</p>
        )}
      </div>
    );

  const data = state.data;
  const stats = summarize(data);
  const names = [eventDetails(data).partnerOne, eventDetails(data).partnerTwo];
  const title =
    page === "data"
      ? "Pengaturan & data"
      : pages.find((p) => p.key === page)?.label || "Ringkasan";
  const owners = ["Bersama", ...new Set(names.filter(Boolean))];
  const progress = stats.tasksTotal
    ? Math.round((stats.tasksDone / stats.tasksTotal) * 100)
    : 0;
  const taskAction = (task) =>
    save(
      {
        ...stateRef.current.data,
        tasks: stateRef.current.data.tasks.map((t) =>
          t.id === task.id ? { ...t, done: !t.done } : t,
        ),
      },
      task.done ? "Tugas dibuka kembali" : "Satu langkah selesai!",
    );
  function reorderTask(taskId, targetId) {
    const current = stateRef.current.data;
    const tasks = reorderTasks(current.tasks, taskId, targetId);
    if (tasks !== current.tasks)
      return save({ ...current, tasks }, "Urutan checklist diperbarui");
  }
  const common = {
    data,
    packageDetails: {
      ...data.package,
      contacts:
        data.package.contacts ??
        catalog?.packages?.find(
          (p) =>
            p.id === data.package.catalogId || p.name === data.package.name,
        )?.contacts,
    },
    stats,
    edit,
    save,
    remove,
    saving,
    owners,
    navigate,
    eventType,
  };

  return (
    <div className="app-shell">
      {mobileNav && (
        <div className="nav-backdrop" onClick={() => setMobileNav(false)} />
      )}
      <aside className={`sidebar ${mobileNav ? "is-open" : ""}`}>
        <a
          href={planHref(eventType, "overview")}
          className="brand"
          onClick={() => navigate("overview")}
        >
          <span className="brand-mark">
            <Heart size={23} weight="light" />
          </span>
          ruang kita<span className="brand-period">.</span>
        </a>
        <div className="workspace-switch">
          <span className="couple-mark">
            {names[0]?.[0] || "K"}
            <span>&</span>
            {names[1]?.[0] || "P"}
          </span>
          <span className="workspace-picker">
            <label className="visually-hidden" htmlFor="plan-picker">
              Pilih rencana
            </label>
            <select
              id="plan-picker"
              value={eventType}
              disabled={saving}
              onChange={(e) => {
                location.hash = planHref(e.target.value);
              }}
            >
              {Object.entries(EVENTS).map(([key, plan]) => (
                <option key={key} value={key}>
                  {plan.label}
                </option>
              ))}
            </select>
            <small>Ruang pribadi kalian</small>
          </span>
        </div>
        <div className="nav-caption">Rencana kita</div>
        <nav aria-label="Navigasi utama">
          {pages.map(({ key, label, icon: Icon }) => (
            <a
              key={key}
              href={planHref(eventType, key)}
              onClick={(e) => {
                e.preventDefault();
                navigate(key);
              }}
              className={`nav-item ${page === key ? "active" : ""}`}
              aria-current={page === key ? "page" : undefined}
            >
              <Icon size={20} weight={page === key ? "fill" : "regular"} />
              <span>{label}</span>
              {key === "tasks" && (
                <span className="nav-count">
                  {stats.tasksTotal - stats.tasksDone}
                </span>
              )}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Flower size={27} weight="light" />
            <p>
              Satu hari istimewa.
              <br />
              <strong>Banyak langkah bersama.</strong>
            </p>
          </div>
          <a
            className={`nav-item ${page === "data" ? "active" : ""}`}
            href={planHref(eventType, "data")}
            onClick={(e) => {
              e.preventDefault();
              navigate("data");
            }}
          >
            <GearSix size={20} />
            <span>Pengaturan & data</span>
          </a>
          <div className="sidebar-footer">
            <span className="connection-dot" />
            Tersimpan di JSON bersama
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="mobile-menu icon-button"
              aria-label="Buka menu"
              onClick={() => setMobileNav(!mobileNav)}
            >
              <List size={23} />
            </button>
            <span>
              Rencana {context.noun}
              {context.scenarioLabel ? ` · ${context.scenarioLabel}` : ""}
            </span>
            <CaretRight size={13} />
            <strong>{title}</strong>
          </div>
          <div className="top-actions">
            <span className="save-status" aria-live="polite">
              {saving ? <Clock size={15} /> : <CheckCircle size={15} />}
              {saving ? "Menyimpan…" : "Tersimpan"}
            </span>
            <div className="avatars" title={names.join(" & ")}>
              {names.map((n, i) => (
                <span key={i}>{n?.[0]?.toUpperCase() || "?"}</span>
              ))}
            </div>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {context.scenarioLabel && (
            <div className="scenario-switcher">
              <span>Skenario pernikahan</span>
              <div role="group" aria-label="Skenario pernikahan">
                <button
                  type="button"
                  aria-label="Skenario di rumah"
                  aria-pressed={eventType === "wedding"}
                  className={eventType === "wedding" ? "selected" : ""}
                  onClick={() => {
                    location.hash = planHref("wedding", page);
                  }}
                  disabled={saving}
                >
                  <House size={16} />
                  Di rumah
                </button>
                <button
                  type="button"
                  aria-label="Skenario di gedung"
                  aria-pressed={eventType === "weddingHall"}
                  className={eventType === "weddingHall" ? "selected" : ""}
                  onClick={() => {
                    location.hash = planHref("weddingHall", page);
                  }}
                  disabled={saving}
                >
                  <CalendarBlank size={16} />
                  Di gedung
                </button>
              </div>
            </div>
          )}
          {conflict && (
            <div className="conflict-banner" role="alert">
              <WarningCircle size={22} />
              <span>
                Ada edit yang lebih baru. Edit terakhir belum tersimpan. Catat
                perubahanmu sebelum memuat data terbaru.
              </span>
              <Button
                variant="secondary"
                onClick={async () => {
                  setModal(null);
                  await load();
                  setConflict(false);
                }}
              >
                Muat terbaru
              </Button>
            </div>
          )}
          {page === "overview" ||
          ![...pages.map((p) => p.key), "data"].includes(page) ? (
            <>
              <div className="page-heading overview-heading">
                <div>
                  <div className="eyebrow">
                    <span className="little-line" />
                    {eventType === "engagement"
                      ? "RENCANA LAMARAN PRIBADI"
                      : "WEDDING PLANNER PRIBADI"}
                  </div>
                  <h1>
                    {eventType === "engagement" ? (
                      <>
                        Rencana lamaran, <span>kita siapkan bersama.</span>
                      </>
                    ) : (
                      <>
                        Rencana kita, <span>hari bahagia kita.</span>
                      </>
                    )}
                  </h1>
                  <p>
                    Semua persiapan, di satu tempat. Kita jalani satu per satu.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  icon={CalendarBlank}
                  onClick={() => edit("wedding")}
                >
                  Atur hari kita
                </Button>
              </div>
              <section className="welcome-banner">
                <div className="welcome-copy">
                  <span className="banner-label">
                    <Heart size={15} />
                    {eventType === "engagement"
                      ? "MENUJU HARI LAMARAN"
                      : "MENUJU HARI BAHAGIA"}
                  </span>
                  <h2>
                    {names[0]} <span>&</span> {names[1]}
                  </h2>
                  <div className="event-details">
                    <span>
                      <CalendarBlank size={17} />
                      {dateLabel(eventDetails(data).date)}
                    </span>
                    <span>
                      <House size={17} />
                      {eventDetails(data).location || "Lokasi belum diisi"}
                    </span>
                  </div>
                  <button className="text-link" onClick={() => edit("wedding")}>
                    Lengkapi detail {context.noun} <ArrowRight size={17} />
                  </button>
                </div>
                <div className="date-tile">
                  <Flower size={27} weight="light" />
                  {eventDetails(data).date ? (
                    <>
                      <strong>
                        {Math.max(
                          0,
                          Math.ceil(
                            (new Date(`${eventDetails(data).date}T00:00:00`) -
                              new Date(new Date().setHours(0, 0, 0, 0))) /
                              86400000,
                          ),
                        )}
                      </strong>
                      <span>hari menuju hari kita</span>
                    </>
                  ) : (
                    <>
                      <strong>Hari kita</strong>
                      <span>Dimulai dari sebuah rencana.</span>
                    </>
                  )}
                  <span className="date-tile-bottom">
                    {eventDetails(data).guestTarget
                      ? `${eventDetails(data).guestTarget} tamu`
                      : "Target tamu belum diatur"}{" "}
                    · {eventDetails(data).location || "Lokasi menyusul"}
                  </span>
                </div>
              </section>
              <div className="stats-grid">
                <Stat
                  icon={Wallet}
                  label="Estimasi anggaran"
                  value={money(stats.estimated)}
                  compactValue={
                    stats.estimated
                      ? `Rp${shortMoney(stats.estimated)}`
                      : money(0)
                  }
                  onClick={() => navigate("budget")}
                >
                  Paket + kebutuhan tambahan
                </Stat>
                <Stat
                  icon={Checks}
                  label="Persiapan selesai"
                  value={stats.tasksDone}
                  suffix={`/ ${stats.tasksTotal} tugas`}
                  onClick={() => navigate("tasks")}
                >
                  {stats.tasksTotal - stats.tasksDone} langkah lagi kita siapkan
                </Stat>
                <Stat
                  icon={Users}
                  label="Target tamu"
                  value={eventDetails(data).guestTarget || "—"}
                  suffix={
                    eventDetails(data).guestTarget ? "orang" : "belum diatur"
                  }
                  onClick={() => edit("wedding")}
                >
                  {eventDetails(data).guestTarget
                    ? `${stats.invited} orang sudah masuk daftar`
                    : "Klik untuk mengisi target tamu"}
                </Stat>
              </div>
              <div className="overview-grid">
                <section className="panel task-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Langkah berikutnya</h2>
                      <p>Mengikuti urutan checklist yang belum selesai.</p>
                    </div>
                    <button
                      className="text-link"
                      onClick={() => navigate("tasks")}
                    >
                      Semua tugas <ArrowUpRight size={16} />
                    </button>
                  </div>
                  <div className="task-preview">
                    {data.tasks
                      .filter((t) => !t.done)
                      .slice(0, 5)
                      .map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          onToggle={taskAction}
                          onEdit={() => edit("task", task)}
                          saving={saving}
                        />
                      ))}
                    {!data.tasks.some((t) => !t.done) && (
                      <Empty
                        icon={CheckCircle}
                        title="Semua tugas selesai"
                        description="Nikmati langkah yang sudah kalian capai."
                      />
                    )}
                  </div>
                  <button className="add-row" onClick={() => edit("task")}>
                    <Plus size={17} />
                    Tambah tugas baru
                  </button>
                </section>
                <div className="overview-right">
                  <section className="package-summary">
                    <div className="package-top">
                      <span className="package-icon">
                        <Flower size={25} weight="light" />
                      </span>
                      <span className="soft-badge">Paket pilihan kita</span>
                    </div>
                    <h2>{data.package.name}</h2>
                    <p>{data.package.vendor}</p>
                    <strong className="package-price">
                      {data.package.groups.length
                        ? money(data.package.price)
                        : "Belum dianggarkan"}
                    </strong>
                    <div className="package-mini-list">
                      {data.package.groups.slice(0, 4).map((group) => (
                        <span key={group.title}>
                          <Check size={15} />
                          {group.title}
                        </span>
                      ))}
                    </div>
                    <button
                      className="text-link"
                      onClick={() => navigate("package")}
                    >
                      {data.package.groups.length
                        ? "Lihat rincian paket"
                        : `Pilih paket ${context.noun}`}{" "}
                      <ArrowRight size={17} />
                    </button>
                  </section>
                  <section className="progress-panel">
                    <div
                      className="progress-ring"
                      style={{ "--progress": `${progress * 3.6}deg` }}
                    >
                      <span>
                        {progress}
                        <small>%</small>
                      </span>
                    </div>
                    <div>
                      <h3>Sudah mulai melangkah.</h3>
                      <p>
                        {stats.tasksDone} dari {stats.tasksTotal} persiapan
                        selesai.
                        <br />
                        Sedikit demi sedikit, bersama.
                      </p>
                    </div>
                  </section>
                </div>
              </div>
              <section className="overview-bottom">
                <div className="note-strip">
                  <span>
                    <NotePencil size={22} />
                  </span>
                  <div>
                    <h3>Periksa kebutuhan di luar paket.</h3>
                    <p>
                      {data.package.includesCatering
                        ? "Paket sudah mencakup katering. Tinjau perlengkapan dan kebutuhan tambahan."
                        : "Pastikan konsumsi, perlengkapan tamu, dan kebutuhan lain sudah dianggarkan."}
                    </p>
                  </div>
                  <button
                    aria-label="Lihat anggaran tambahan"
                    onClick={() => navigate("budget")}
                  >
                    <ArrowUpRight size={22} />
                  </button>
                </div>
                <button className="next-note" onClick={() => navigate("notes")}>
                  Ada ide baru untuk hari kita?
                  <span>
                    Tulis di catatan bersama <ArrowRight size={16} />
                  </span>
                </button>
              </section>
            </>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">RUANG KITA</div>
                  <h1>{title}</h1>
                  <p>
                    {page === "data"
                      ? `Detail ${context.noun} dan data rencana untuk kalian berdua.`
                      : descriptions[page]}
                  </p>
                </div>
                {["tasks", "budget", "guests", "timeline", "notes"].includes(
                  page,
                ) && (
                  <Button
                    icon={Plus}
                    onClick={() =>
                      edit(
                        {
                          tasks: "task",
                          budget: "expense",
                          guests: "guest",
                          timeline: "timeline",
                          notes: "note",
                        }[page],
                      )
                    }
                  >
                    {
                      {
                        tasks: "Tambah tugas",
                        budget: "Tambah biaya",
                        guests: "Tambah tamu",
                        timeline: "Tambah kegiatan",
                        notes: "Tulis catatan",
                      }[page]
                    }
                  </Button>
                )}
              </div>
              {page === "tasks" && (
                <Tasks
                  {...common}
                  onToggle={taskAction}
                  onReorder={reorderTask}
                />
              )}
              {page === "budget" && (
                <Budget {...common} onToggle={taskAction} />
              )}
              {page === "guests" && <Guests {...common} />}
              {page === "timeline" && <Timeline {...common} />}
              {page === "package" && <Packages {...common} />}
              {page === "notes" && <Notes {...common} />}
              {page === "data" && (
                <DataSettings
                  {...common}
                  exportData={exportData}
                  notify={notify}
                />
              )}
            </>
          )}
          <footer className="page-footer">
            <span>Direncanakan dengan hati, oleh kita berdua.</span>
            <Heart size={15} weight="light" />
            <span>Ruang Kita</span>
          </footer>
        </main>
      </div>
      {modal && (
        <Editor
          key={`${modal.type}-${modal.item?.id || "new"}`}
          modal={modal}
          data={data}
          owners={owners}
          saving={saving}
          close={() => {
            if (!saving) setModal(null);
          }}
          save={save}
          notify={notify}
          saveError={saveError}
          eventType={eventType}
          edit={edit}
          packageDetails={common.packageDetails}
          onToggle={taskAction}
        />
      )}
      {toast && (
        <div
          className={`toast ${toast.error ? "error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? (
            <WarningCircle size={20} />
          ) : (
            <CheckCircle size={20} />
          )}
          <span>{toast.message}</span>
          <IconButton
            label="Tutup notifikasi"
            icon={X}
            onClick={() => setToast(null)}
          />
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
  onEdit,
  saving,
  full = false,
  onDelete,
  budgetLinks = [],
  edit,
  onMoveUp,
  onMoveDown,
}) {
  return (
    <div
      className={`task-row ${task.done ? "completed" : ""} ${budgetLinks.length ? "has-budget-links" : ""}`}
    >
      <button
        className="check-button"
        aria-label={`${task.done ? "Buka kembali" : "Selesaikan"}: ${task.title}`}
        aria-pressed={task.done}
        disabled={saving}
        onClick={() => onToggle(task)}
      >
        {task.done && <Check size={14} weight="bold" />}
      </button>
      <button className="task-name" onClick={onEdit}>
        <strong>{task.title}</strong>
        <span>
          {task.category}
          <span className="meta-dot">·</span>
          {task.owner}
          {task.dueDate && (
            <>
              <span className="meta-dot">·</span>
              {dateLabel(task.dueDate)}
            </>
          )}
        </span>
        <TaskConclusion task={task} />
      </button>
      {task.priority === "high" && !task.done && (
        <span className="priority-label">Prioritas</span>
      )}
      <div className="row-actions">
        {full && (
          <div className="task-move-actions">
            <IconButton
              label={`Naikkan tugas ${task.title}`}
              icon={ArrowUp}
              onClick={onMoveUp}
              disabled={saving || !onMoveUp}
            />
            <IconButton
              label={`Turunkan tugas ${task.title}`}
              icon={ArrowDown}
              onClick={onMoveDown}
              disabled={saving || !onMoveDown}
            />
          </div>
        )}
        <IconButton
          label={`Edit tugas ${task.title}`}
          icon={PencilSimple}
          onClick={onEdit}
        />
        {full && (
          <IconButton
            label={`Hapus tugas ${task.title}`}
            icon={Trash}
            onClick={onDelete}
          />
        )}
      </div>
      <TaskBudgetLinks links={budgetLinks} edit={edit} />
    </div>
  );
}
function Search({ value, onChange, placeholder }) {
  return (
    <label className="search">
      <MagnifyingGlass size={18} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </label>
  );
}
function Tabs({ options, value, onChange }) {
  return (
    <div className="filter-tabs">
      {options.map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={value === key ? "selected" : ""}
          aria-pressed={value === key}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
function Tasks({ data, stats, edit, remove, saving, onToggle, onReorder }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const budgets = [
    { kind: "package", item: data.package, total: data.package.price },
    ...data.expenses.map((item) => ({
      kind: "expense",
      item,
      total: item.quantity * item.unitPrice,
    })),
  ];
  const tasks = data.tasks.filter(
    (t) =>
      (filter === "all" || (filter === "done" ? t.done : !t.done)) &&
      `${t.title} ${t.owner} ${t.category}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <section className="panel">
      <div className="list-toolbar">
        <Tabs
          options={[
            ["all", `Semua (${stats.tasksTotal})`],
            ["active", "Belum selesai"],
            ["done", `Selesai (${stats.tasksDone})`],
          ]}
          value={filter}
          onChange={setFilter}
        />
        <Search
          value={search}
          onChange={setSearch}
          placeholder="Cari tugas atau penanggung jawab…"
        />
      </div>
      <p className="task-order-hint">
        Gunakan panah naik/turun untuk mengatur urutan. Ringkasan mengikuti
        urutan ini.
      </p>
      <div className="full-task-list">
        {tasks.map((task, index) => (
          <TaskRow
            full
            key={task.id}
            task={task}
            budgetLinks={budgets.filter(({ item }) =>
              item.taskIds?.includes(task.id),
            )}
            edit={edit}
            onToggle={onToggle}
            onEdit={() => edit("task", task)}
            onDelete={() => remove("tasks", task)}
            saving={saving}
            onMoveUp={
              index > 0
                ? () => onReorder(task.id, tasks[index - 1].id)
                : undefined
            }
            onMoveDown={
              index < tasks.length - 1
                ? () => onReorder(task.id, tasks[index + 1].id)
                : undefined
            }
          />
        ))}
      </div>
      {!tasks.length && (
        <Empty
          icon={Checks}
          title="Tidak ada tugas di sini"
          description="Tambah langkah baru atau ubah pencarianmu."
        />
      )}
    </section>
  );
}
function Budget({
  data,
  packageDetails,
  stats,
  edit,
  remove,
  onToggle,
  saving,
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [payment, setPayment] = useState("all");
  const entries = budgetEntries(data);
  const visible = entries.filter(
    (entry) =>
      (!category || entry.category === category) &&
      (payment === "all" ||
        paymentState(entry.total, entry.paid) === payment) &&
      `${entry.item.name} ${entry.item.vendor || ""} ${entry.category} ${entry.item.note || ""}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  const filtered = Boolean(search.trim() || category || payment !== "all");
  const resetFilters = () => {
    setSearch("");
    setCategory("");
    setPayment("all");
  };
  const target = eventDetails(data).budgetTarget;
  const categories = [
    { label: data.package.name, amount: data.package.price },
    ...Object.entries(
      data.expenses.reduce(
        (all, e) => ({
          ...all,
          [e.category]: (all[e.category] || 0) + e.quantity * e.unitPrice,
        }),
        {},
      ),
    ).map(([label, amount]) => ({ label, amount })),
  ];
  return (
    <>
      <div className="stats-grid">
        <Stat
          icon={Wallet}
          label="Total estimasi"
          value={money(stats.estimated)}
          compactValue={
            stats.estimated ? `Rp${shortMoney(stats.estimated)}` : money(0)
          }
          onClick={() => edit("wedding")}
        >
          {target
            ? `Batas anggaran ${money(target)}`
            : "Batas anggaran belum diatur"}
        </Stat>
        <Stat
          icon={CheckCircle}
          label="Pembayaran tercatat"
          value={money(stats.paid)}
          compactValue={stats.paid ? `Rp${shortMoney(stats.paid)}` : money(0)}
          onClick={() => edit("budgetSummary", { id: "paid" })}
        >
          Perbarui sesuai pembayaran nyata
        </Stat>
        <Stat
          icon={Clock}
          label="Sisa estimasi pembayaran"
          value={money(stats.remaining)}
          compactValue={
            stats.remaining ? `Rp${shortMoney(stats.remaining)}` : money(0)
          }
          onClick={() => edit("budgetSummary", { id: "remaining" })}
        >
          Dari seluruh kebutuhan tercatat
        </Stat>
      </div>
      <div className="budget-layout">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Rincian kebutuhan</h2>
              <p>Harga estimasi bisa berubah setelah konfirmasi.</p>
            </div>
            <span className="count-label">
              {data.expenses.length + 1} kebutuhan
            </span>
          </div>
          <div className="budget-list-controls">
            <Search
              value={search}
              onChange={setSearch}
              placeholder="Cari kebutuhan atau vendor"
            />
            <select
              aria-label="Filter kategori"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="">Semua kategori</option>
              {[...new Set(entries.map((entry) => entry.category))]
                .sort((a, b) => a.localeCompare(b, "id"))
                .map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
            </select>
            <select
              aria-label="Filter pembayaran"
              value={payment}
              onChange={(event) => setPayment(event.target.value)}
            >
              <option value="all">Semua pembayaran</option>
              <option value="unpaid">Belum dibayar</option>
              <option value="partial">Sebagian dibayar</option>
              <option value="paid">Lunas</option>
              <option value="unset">Belum dianggarkan</option>
            </select>
          </div>
          <div className="budget-filter-caption">
            <span>
              {visible.length} dari {entries.length} kebutuhan
              {filtered
                ? " · Ringkasan di atas tetap seluruh anggaran"
                : " · Klik nama untuk melihat detail"}
            </span>
            {filtered && !!visible.length && (
              <button type="button" onClick={resetFilters}>
                Reset filter
              </button>
            )}
          </div>
          <BudgetList
            entries={visible}
            data={data}
            packageDetails={packageDetails}
            edit={edit}
            remove={remove}
            onToggle={onToggle}
            saving={saving}
            filtered={filtered}
            onReset={resetFilters}
          />
          <button className="add-row" onClick={() => edit("expense")}>
            <Plus size={17} />
            Tambah kebutuhan lain
          </button>
        </section>
        <section className="panel budget-breakdown">
          <h2>Alokasi anggaran</h2>
          <p>Dari kebutuhan yang sudah dicatat.</p>
          <div className="budget-total">
            <Wallet size={28} weight="light" />
            <strong>{shortMoney(stats.estimated)}</strong>
            <span>estimasi keseluruhan</span>
          </div>
          {categories.map((c, i) => (
            <div className="category-row" key={c.label}>
              <div>
                <span>{c.label}</span>
                <strong>
                  {stats.estimated
                    ? Math.round((c.amount / stats.estimated) * 100)
                    : 0}
                  %
                </strong>
              </div>
              <div className="allocation-track">
                <span
                  style={{
                    width: `${stats.estimated ? (c.amount / stats.estimated) * 100 : 0}%`,
                    opacity: Math.max(0.35, 1 - i * 0.17),
                  }}
                />
              </div>
              <small>{money(c.amount)}</small>
            </div>
          ))}
        </section>
      </div>
      <div className="info-callout">
        <WarningCircle size={22} />
        <p>
          <strong>Lengkapi kebutuhan di luar paket.</strong> Cocokkan rincian
          paket dengan kebutuhan undangan, souvenir, mahar, seserahan, dan
          perlengkapan lain sebelum menambahkan biaya.
        </p>
      </div>
    </>
  );
}
function guestSideNames(data) {
  const p1 = eventDetails(data)?.partnerOne;
  const p2 = eventDetails(data)?.partnerTwo;
  const isGeneric = (!p1 || p1 === "Kamu") && (!p2 || p2 === "Pasanganmu");
  const name1 = isGeneric ? "Fadel" : p1 || "Fadel";
  const name2 = isGeneric ? "Diah" : p2 || "Diah";
  return { name1, name2 };
}

function isSideMatch(side = "", targetName = "") {
  if (!side || !targetName) return false;
  const s = String(side).toLowerCase().trim();
  const t = String(targetName).toLowerCase().trim();
  if (s === t) return true;
  if (t === "fadel" && (s === "kamu" || s.includes("fadel"))) return true;
  if (t === "diah" && (s === "pasanganmu" || s.includes("diah"))) return true;
  return s.includes(t);
}

function Guests({ data, stats, edit, remove }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const { name1, name2 } = guestSideNames(data);

  const fadelGuests = data.guests.filter((g) => isSideMatch(g.side, name1));
  const fadelCount = fadelGuests.reduce((sum, g) => sum + g.count, 0);

  const diahGuests = data.guests.filter((g) => isSideMatch(g.side, name2));
  const diahCount = diahGuests.reduce((sum, g) => sum + g.count, 0);

  const bersamaGuests = data.guests.filter(
    (g) => !isSideMatch(g.side, name1) && !isSideMatch(g.side, name2),
  );
  const bersamaCount = bersamaGuests.reduce((sum, g) => sum + g.count, 0);

  const guests = data.guests.filter((g) => {
    const matchSearch = `${g.name} ${g.side || ""}`
      .toLowerCase()
      .includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filter === "all") return true;
    if (filter === "fadel") return isSideMatch(g.side, name1);
    if (filter === "diah") return isSideMatch(g.side, name2);
    if (filter === "bersama")
      return !isSideMatch(g.side, name1) && !isSideMatch(g.side, name2);
    return true;
  });

  return (
    <>
      <div className="guest-summary">
        <div>
          <Users size={22} />
          <strong>
            {stats.invited}
            <small>
              {eventDetails(data).guestTarget
                ? ` / ${eventDetails(data).guestTarget} orang`
                : " / target belum diatur"}
            </small>
          </strong>
          <span>
            total {data.guests.length} undangan masuk
            {bersamaCount > 0 ? ` (${bersamaCount} orang bersama)` : ""}
          </span>
        </div>
        <div>
          <User size={22} />
          <strong>
            {fadelCount}
            <small> orang</small>
          </strong>
          <span>
            tamu dari {name1} ({fadelGuests.length} undangan)
          </span>
        </div>
        <div>
          <User size={22} />
          <strong>
            {diahCount}
            <small> orang</small>
          </strong>
          <span>
            tamu dari {name2} ({diahGuests.length} undangan)
          </span>
        </div>
      </div>
      <section className="panel">
        <div className="list-toolbar">
          <Tabs
            options={[
              ["all", "Semua tamu"],
              ["fadel", `Tamu ${name1}`],
              ["diah", `Tamu ${name2}`],
              ...(bersamaGuests.length > 0 ? [["bersama", "Bersama"]] : []),
            ]}
            value={filter}
            onChange={setFilter}
          />
          <Search
            value={search}
            onChange={setSearch}
            placeholder="Cari nama atau pihak tamu…"
          />
        </div>
        {guests.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Nama tamu</th>
                  <th>Pihak / Tamu dari</th>
                  <th>Jumlah orang</th>
                  <th aria-label="Aksi" />
                </tr>
              </thead>
              <tbody>
                {guests.map((g) => {
                  const isF = isSideMatch(g.side, name1);
                  const isD = isSideMatch(g.side, name2);
                  const badgeClass = isF ? "fadel" : isD ? "diah" : "bersama";
                  const sideText = isF
                    ? `Tamu ${name1}`
                    : isD
                      ? `Tamu ${name2}`
                      : g.side || "Bersama";
                  return (
                    <tr key={g.id}>
                      <td>
                        <strong>{g.name}</strong>
                        <small>{g.phone || g.note || "—"}</small>
                      </td>
                      <td>
                        <span className={`side-badge ${badgeClass}`}>
                          {sideText}
                        </span>
                      </td>
                      <td>
                        <strong>
                          {g.count}{" "}
                          <small style={{ display: "inline", fontWeight: 400 }}>
                            orang
                          </small>
                        </strong>
                      </td>
                      <td>
                        <div className="row-actions">
                          <IconButton
                            icon={PencilSimple}
                            label={`Edit tamu ${g.name}`}
                            onClick={() => edit("guest", g)}
                          />
                          <IconButton
                            icon={Trash}
                            label={`Hapus tamu ${g.name}`}
                            onClick={() => remove("guests", g)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={Users}
            title={
              search || filter !== "all"
                ? "Tamu tidak ditemukan"
                : "Mulai dari orang-orang terdekat"
            }
            description="Satu undangan bisa untuk beberapa orang. Catat jumlahnya agar kebutuhan konsumsi tetap terhitung."
          >
            <Button
              variant="secondary"
              icon={Plus}
              onClick={() => edit("guest")}
            >
              Tambahkan tamu
            </Button>
          </Empty>
        )}
      </section>
    </>
  );
}
function Timeline({ data, edit, remove, eventType }) {
  return (
    <>
      <div className="info-callout">
        <CalendarBlank size={22} />
        <p>
          <strong>{dateLabel(eventDetails(data).date)}</strong> · Rundown ini
          adalah rencana internal. Cocokkan kembali dengan keluarga dan vendor.
        </p>
      </div>
      <section className="panel timeline-panel">
        {data.timeline.length ? (
          [...data.timeline]
            .sort((a, b) => a.time.localeCompare(b.time))
            .map((t, i) => (
              <div className="timeline-event" key={t.id}>
                <span className="timeline-time">{t.time}</span>
                <span className="timeline-marker">
                  <span />
                </span>
                <div>
                  <span className="timeline-order">KEGIATAN {i + 1}</span>
                  <h3>{t.title}</h3>
                  <p>{t.note || "Detail kegiatan belum ditambahkan."}</p>
                  <span className="owner-tag">
                    <Users size={13} />
                    {t.owner || "Belum ditentukan"}
                  </span>
                </div>
                <div className="row-actions">
                  <IconButton
                    label={`Edit kegiatan ${t.title}`}
                    icon={PencilSimple}
                    onClick={() => edit("timeline", t)}
                  />
                  <IconButton
                    label={`Hapus kegiatan ${t.title}`}
                    icon={Trash}
                    onClick={() => remove("timeline", t)}
                  />
                </div>
              </div>
            ))
        ) : (
          <Empty
            icon={Clock}
            title="Hari yang rapi dimulai dari sini"
            description={
              eventType === "engagement"
                ? "Susun jam kedatangan keluarga, sambutan, prosesi lamaran, foto, dan makan bersama."
                : "Tambahkan jam persiapan, akad, panggih, resepsi, dan agenda lain sesuai acara kalian."
            }
          >
            <Button
              variant="secondary"
              icon={Plus}
              onClick={() => edit("timeline")}
            >
              Susun kegiatan pertama
            </Button>
          </Empty>
        )}
      </section>
    </>
  );
}
function Notes({ data, edit, remove }) {
  return (
    <div className="notes-grid">
      {data.notes.map((n, i) => (
        <article className={`note-card note-${i % 3}`} key={n.id}>
          <div className="note-top">
            <NotePencil size={22} weight="light" />
            <div className="row-actions">
              <IconButton
                label={`Edit catatan ${n.title}`}
                icon={PencilSimple}
                onClick={() => edit("note", n)}
              />
              <IconButton
                label={`Hapus catatan ${n.title}`}
                icon={Trash}
                onClick={() => remove("notes", n)}
              />
            </div>
          </div>
          <h2>{n.title}</h2>
          <p>{n.body}</p>
          <span className="note-author">
            <Users size={14} />
            {n.author || "Bersama"}
          </span>
        </article>
      ))}
      <button className="new-note" onClick={() => edit("note")}>
        <Plus size={25} />
        <strong>Simpan ide berikutnya</strong>
        <span>
          Ide dekorasi, pertanyaan vendor,
          <br />
          atau keputusan bersama.
        </span>
      </button>
    </div>
  );
}
function DataSettings({ data, edit, exportData, notify, eventType }) {
  const context = EVENTS[eventType];
  const inputRef = useRef(null);
  async function importFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error("File maksimal 8 MB.");
      const parsed = JSON.parse((await file.text()).replace(/^\uFEFF/, ""));
      edit("json", { source: JSON.stringify(parsed, null, 2) });
    } catch (error) {
      notify(`JSON belum bisa dibaca: ${error.message}`, true);
    }
    e.target.value = "";
  }
  return (
    <div className="settings-grid">
      <section className="panel detail-settings">
        <div className="panel-heading">
          <div>
            <h2>Tentang hari kita</h2>
            <p>Detail yang tampil di seluruh planner.</p>
          </div>
          <IconButton
            icon={PencilSimple}
            label={`Edit detail ${context.noun}`}
            onClick={() => edit("wedding")}
          />
        </div>
        <dl>
          {[
            [
              "Pasangan",
              `${eventDetails(data).partnerOne} & ${eventDetails(data).partnerTwo}`,
            ],
            ["Tanggal", dateLabel(eventDetails(data).date)],
            ["Lokasi", eventDetails(data).location || "Belum diisi"],
            [
              "Target tamu",
              eventDetails(data).guestTarget
                ? `${eventDetails(data).guestTarget} orang`
                : "Belum ditentukan",
            ],
            [
              "Batas anggaran",
              eventDetails(data).budgetTarget
                ? money(eventDetails(data).budgetTarget)
                : "Belum ditentukan",
            ],
          ].map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <Button
          variant="secondary"
          icon={PencilSimple}
          onClick={() => edit("wedding")}
        >
          Edit detail
        </Button>
      </section>
      <section className="panel json-panel">
        <span className="json-symbol">
          <Code size={29} />
        </span>
        <h2>Satu rencana. Satu file.</h2>
        <p>
          Data rencana ada di <code>data/{context.file}</code>. Edit lewat
          website atau file JSON; perubahan website tersimpan ke file yang sama.
        </p>
        <div className="json-actions">
          <Button
            variant="secondary"
            icon={DownloadSimple}
            onClick={exportData}
          >
            Unduh JSON
          </Button>
          <Button
            variant="secondary"
            icon={UploadSimple}
            onClick={() => inputRef.current.click()}
          >
            Impor JSON
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={importFile}
        />
        <button
          className="text-link"
          onClick={() =>
            edit("json", { source: JSON.stringify(data, null, 2) })
          }
        >
          Buka editor JSON <ArrowRight size={16} />
        </button>
        <div className="json-notice">
          <CheckCircle size={18} />
          <span>
            Validasi sebelum disimpan. 20 versi sebelumnya dicadangkan otomatis
            di server.
          </span>
        </div>
      </section>
      <div className="info-callout settings-note">
        <Users size={23} />
        <p>
          <strong>Untuk dipakai berdua</strong>
          <br />
          Buka alamat server yang sama dari perangkat kalian. Perubahan
          diperiksa setiap 10 detik. JSON yang diunduh adalah salinan; impor
          kembali jika ingin menerapkan hasil editnya.
        </p>
      </div>
    </div>
  );
}

const defaults = {
  task: {
    title: "",
    category: "Acara",
    owner: "Bersama",
    dueDate: "",
    done: false,
    priority: "normal",
    conclusion: "",
  },
  expense: {
    name: "",
    category: "Lainnya",
    quantity: 1,
    unitPrice: 0,
    paid: 0,
    status: "estimate",
    note: "",
    vendor: "",
    taskIds: [],
  },
  guest: {
    name: "",
    side: "Fadel",
    count: 1,
    status: "pending",
    phone: "",
    note: "",
  },
  timeline: { time: "08:00", title: "", owner: "Bersama", note: "" },
  note: { title: "", body: "", author: "Bersama" },
};
function Editor({
  modal,
  data,
  owners,
  saving,
  close,
  save,
  notify,
  saveError,
  eventType,
  edit,
  packageDetails,
  onToggle,
}) {
  const context = EVENTS[eventType];
  const { type, item } = modal;
  const budgetEdit = ["expense", "packagePayment"].includes(type);
  const readOnly = ["budgetSummary", "budgetItem"].includes(type);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState(() =>
    type === "wedding"
      ? { ...eventDetails(data) }
      : type === "packagePayment"
        ? {
            price: data.package.price,
            packagePaid: data.packagePaid,
            vendor: data.package.vendor,
            note: data.package.note || "",
            contacts: { ...item.contacts },
            taskIds: [...(data.package.taskIds || [])],
          }
        : type === "json"
          ? { source: item.source }
          : type === "attachments"
            ? { attachments: [...item.attachments], linkName: "", linkUrl: "" }
            : {
                ...defaults[type],
                ...item,
                ...(type === "expense"
                  ? { contacts: { ...item?.contacts } }
                  : {}),
              },
  );
  const [localError, setLocalError] = useState("");
  const [taskMode, setTaskMode] = useState("select");
  const [newTask, setNewTask] = useState(() => ({
    ...defaults.task,
    category: form.category || "Vendor",
  }));
  const dialogRef = useRef(null);
  const savingRef = useRef(saving);
  savingRef.current = saving || uploading;
  const requestClose = () => {
    if (!savingRef.current) close();
  };
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    const cancel = (e) => {
      e.preventDefault();
      if (!savingRef.current) close();
    };
    dialog.addEventListener("cancel", cancel);
    return () => {
      dialog.removeEventListener("cancel", cancel);
      dialog.close();
    };
  }, []);
  const change = (key) => (e) =>
    setForm({
      ...form,
      [key]:
        e.target.type === "number" ? Number(e.target.value) : e.target.value,
    });
  const input = (key, props = {}) => (
    <input
      value={form[key]}
      onChange={change(key)}
      maxLength={300}
      {...props}
    />
  );
  const amount = (key, props = {}) => (
    <MoneyInput
      value={form[key]}
      onChange={(value) =>
        setForm((previous) => ({ ...previous, [key]: value }))
      }
      {...props}
    />
  );
  const select = (key, options) => (
    <select value={form[key]} onChange={change(key)}>
      {options.map((o) => (
        <option
          key={Array.isArray(o) ? o[0] : o}
          value={Array.isArray(o) ? o[0] : o}
        >
          {Array.isArray(o) ? o[1] : o}
        </option>
      ))}
    </select>
  );
  const title = {
    task: item ? "Edit tugas" : "Langkah baru",
    expense: item ? "Edit kebutuhan" : "Kebutuhan baru",
    guest: item ? "Edit tamu" : "Tambah orang tersayang",
    timeline: item ? "Edit kegiatan" : "Kegiatan hari kita",
    note: item ? "Edit catatan" : "Catatan untuk kita",
    wedding: "Detail hari kita",
    packagePayment: "Detail & pembayaran paket",
    budgetSummary:
      item?.id === "remaining"
        ? "Rincian sisa pembayaran"
        : "Rincian pembayaran",
    budgetItem: "Detail anggaran",
    attachments: `Lampiran ${item?.name || "anggaran"}`,
    json: "Editor data JSON",
    delete: "Hapus dari rencana?",
  }[type];
  async function submit(e) {
    e.preventDefault();
    if (saving || uploading || readOnly) return;
    setLocalError("");
    let next = structuredClone(data);
    try {
      let budgetForm = form;
      if (
        ["expense", "packagePayment"].includes(type) &&
        taskMode === "create"
      ) {
        const task = { ...newTask, id: createId(), done: false };
        next.tasks.push(task);
        budgetForm = { ...form, taskIds: [task.id] };
      }
      if (type === "wedding") {
        if (next.event) next.event = form;
        else next.wedding = form;
      } else if (type === "packagePayment") {
        next.package.price = form.price;
        next.packagePaid = form.packagePaid;
        next.package.vendor = form.vendor;
        next.package.note = form.note;
        next.package.contacts = form.contacts;
        next.package.taskIds = budgetForm.taskIds;
      } else if (type === "attachments") {
        let attachments = [...form.attachments];
        if (form.linkUrl.trim())
          attachments.push(createLinkAttachment(form.linkName, form.linkUrl));
        else if (form.linkName.trim())
          throw new Error("Lengkapi alamat tautan sebelum menyimpan.");
        if (item.target === "package") next.package.attachments = attachments;
        else
          next.expenses = next.expenses.map((expense) =>
            expense.id === item.id ? { ...expense, attachments } : expense,
          );
      } else if (type === "json") next = JSON.parse(form.source);
      else if (type === "delete") {
        next[modal.collection] = next[modal.collection].filter(
          (r) => r.id !== item.id,
        );
        if (modal.collection === "tasks") {
          if (next.package.taskIds)
            next.package.taskIds = next.package.taskIds.filter(
              (id) => id !== item.id,
            );
          next.expenses = next.expenses.map((expense) =>
            expense.taskIds
              ? {
                  ...expense,
                  taskIds: expense.taskIds.filter((id) => id !== item.id),
                }
              : expense,
          );
        }
      } else {
        const collection = {
          task: "tasks",
          expense: "expenses",
          guest: "guests",
          timeline: "timeline",
          note: "notes",
        }[type];
        const record = { ...budgetForm, id: item?.id || createId() };
        if (item)
          next[collection] = next[collection].map((r) =>
            r.id === item.id ? record : r,
          );
        else next[collection].push(record);
      }
      if (
        await save(
          next,
          type === "delete"
            ? "Data dihapus dari rencana"
            : "Rencana kita diperbarui",
        )
      )
        close();
    } catch (error) {
      setLocalError(`Periksa data: ${error.message}`);
    }
  }
  return (
    <dialog
      ref={dialogRef}
      className={`editor-dialog ${["json", "budgetSummary", "budgetItem"].includes(type) ? "wide" : ""} ${budgetEdit ? "budget-editor" : ""} ${type === "budgetItem" ? "budget-item-dialog" : ""} ${type === "budgetSummary" ? "budget-summary-dialog" : ""}`}
      aria-labelledby="editor-title"
      onClick={(e) => {
        if (e.target === dialogRef.current) requestClose();
      }}
    >
      <form onSubmit={submit}>
        <div className="dialog-heading">
          <div>
            <span className="dialog-caption">RENCANA KITA</span>
            <h2 id="editor-title">{title}</h2>
          </div>
          <IconButton
            icon={X}
            label="Tutup dialog"
            onClick={requestClose}
            disabled={saving || uploading}
          />
        </div>
        <div className="dialog-body">
          {type === "budgetSummary" && (
            <BudgetDetails data={data} mode={item.id} edit={edit} />
          )}
          {type === "budgetItem" && (
            <BudgetItemDetail
              data={data}
              selection={item}
              packageDetails={packageDetails}
              edit={edit}
              onToggle={onToggle}
              saving={saving}
            />
          )}
          {type === "attachments" && (
            <AttachmentEditor
              attachments={form.attachments}
              onChange={(update) =>
                setForm((previous) => ({
                  ...previous,
                  attachments: update(previous.attachments),
                }))
              }
              onBusyChange={setUploading}
              linkName={form.linkName}
              linkUrl={form.linkUrl}
              onLinkDraft={(linkName, linkUrl) =>
                setForm((previous) => ({ ...previous, linkName, linkUrl }))
              }
              disabled={saving}
            />
          )}
          {type === "task" && (
            <>
              <Field label="Apa yang perlu disiapkan?">
                {input("title", {
                  required: true,
                  placeholder: "Contoh: Jadwalkan fitting busana",
                })}
              </Field>
              <div className="form-grid">
                <Field label="Kategori">
                  {input("category", { required: true })}
                </Field>
                <Field label="Penanggung jawab">
                  {select("owner", [...new Set([...owners, form.owner])])}
                </Field>
                <Field label="Target tanggal">
                  {input("dueDate", { type: "date" })}
                </Field>
                <Field label="Prioritas">
                  {select("priority", [
                    ["high", "Prioritas"],
                    ["normal", "Normal"],
                    ["low", "Nanti"],
                  ])}
                </Field>
              </div>
              <Field
                label="Jawaban / kesimpulan"
                hint="Opsional. Catat hasil diskusi, pilihan akhir, atau hal yang sudah dipastikan."
              >
                <textarea
                  rows={4}
                  aria-label="Jawaban / kesimpulan"
                  value={form.conclusion}
                  onChange={change("conclusion")}
                  maxLength={2000}
                  placeholder="Contoh: Batas anggaran disepakati Rp8.000.000, termasuk dana cadangan Rp500.000."
                />
              </Field>
            </>
          )}
          {type === "guest" &&
            (() => {
              const { name1, name2 } = guestSideNames(data);
              const sideOptions = [
                [name1, `Tamu ${name1}`],
                [name2, `Tamu ${name2}`],
                ["Bersama", "Keluarga Bersama"],
              ];
              if (
                form.side &&
                !sideOptions.some(([val]) => val === form.side)
              ) {
                sideOptions.push([form.side, form.side]);
              }
              return (
                <>
                  <Field label="Nama tamu / keluarga">
                    {input("name", {
                      required: true,
                      placeholder: "Contoh: Keluarga Bapak Budi",
                    })}
                  </Field>
                  <div className="form-grid">
                    <Field label="Pihak keluarga">
                      {select("side", sideOptions)}
                    </Field>
                    <Field label="Jumlah orang">
                      {input("count", {
                        type: "number",
                        min: 1,
                        max: 10000,
                        required: true,
                      })}
                    </Field>
                  </div>
                  <Field label="Konfirmasi kehadiran">
                    {select("status", [
                      ["pending", "Belum konfirmasi"],
                      ["confirmed", "Hadir"],
                      ["declined", "Tidak hadir"],
                    ])}
                  </Field>
                  <Field label="Nomor telepon (opsional)">
                    {input("phone", { type: "tel", maxLength: 100 })}
                  </Field>
                  <Field label="Catatan">
                    <textarea
                      rows={2}
                      value={form.note}
                      onChange={change("note")}
                      maxLength={2000}
                    />
                  </Field>
                </>
              );
            })()}
          {type === "timeline" && (
            <>
              <Field label="Nama kegiatan">
                {input("title", {
                  required: true,
                  placeholder:
                    eventType === "engagement"
                      ? "Contoh: Sambutan keluarga"
                      : "Contoh: Akad nikah",
                })}
              </Field>
              <div className="form-grid">
                <Field label="Waktu">
                  {input("time", { type: "time", required: true })}
                </Field>
                <Field label="Penanggung jawab">
                  {input("owner", { required: true })}
                </Field>
              </div>
              <Field label="Detail kegiatan">
                <textarea
                  rows={4}
                  value={form.note}
                  onChange={change("note")}
                  maxLength={2000}
                />
              </Field>
            </>
          )}
          {type === "note" && (
            <>
              <Field label="Judul catatan">
                {input("title", {
                  required: true,
                  placeholder: "Ide atau keputusan apa hari ini?",
                })}
              </Field>
              <Field label="Isi catatan">
                <textarea
                  rows={7}
                  value={form.body}
                  onChange={change("body")}
                  maxLength={10000}
                  required
                />
              </Field>
              <Field label="Dari">
                {select("author", [...new Set([...owners, form.author])])}
              </Field>
            </>
          )}
          {type === "wedding" && (
            <>
              <div className="form-grid">
                <Field label="Nama kamu">
                  {input("partnerOne", { required: true })}
                </Field>
                <Field label="Nama pasangan">
                  {input("partnerTwo", { required: true })}
                </Field>
              </div>
              <Field
                label={`Tanggal ${context.noun}`}
                hint="Boleh dikosongkan jika belum ditentukan."
              >
                {input("date", { type: "date" })}
              </Field>
              <Field label="Lokasi">
                {input("location", { required: eventType !== "engagement" })}
              </Field>
              <div className="form-grid">
                <Field
                  label="Target tamu (orang)"
                  hint="Isi 0 jika belum ditentukan."
                >
                  {input("guestTarget", {
                    type: "number",
                    min: 0,
                    max: 100000,
                    required: true,
                  })}
                </Field>
                <Field
                  label="Batas anggaran (Rp)"
                  hint="Isi 0 jika belum ditentukan."
                >
                  {amount("budgetTarget", {
                    min: 0,
                    max: 1e12,
                    required: true,
                  })}
                </Field>
              </div>
            </>
          )}
          {["expense", "packagePayment"].includes(type) && (
            <BudgetEditorFields
              type={type}
              form={form}
              setForm={setForm}
              data={data}
              input={input}
              amount={amount}
              select={select}
              taskMode={taskMode}
              onTaskModeChange={(mode) => {
                setTaskMode(mode);
                const name =
                  type === "packagePayment" ? data.package.name : form.name;
                if (mode === "create" && !newTask.title && name)
                  setNewTask((previous) => ({
                    ...previous,
                    title: `Siapkan ${name}`.slice(0, 300),
                    category: form.category || "Vendor",
                  }));
              }}
              newTask={newTask}
              setNewTask={setNewTask}
              owners={owners}
            />
          )}
          {type === "json" && (
            <>
              <p className="form-intro">
                Menyimpan akan mengganti seluruh data planner dengan JSON ini.
                Struktur dan nilai diperiksa sebelum diterapkan.
              </p>
              <Field label="Data JSON">
                <textarea
                  className="code-editor"
                  spellCheck={false}
                  rows={18}
                  value={form.source}
                  onChange={change("source")}
                  required
                />
              </Field>
            </>
          )}
          {type === "delete" && (
            <p className="delete-message">
              “{item.title || item.name}” akan dihapus. Salinan versi sebelumnya
              tetap tersedia di folder backup server.
            </p>
          )}
          {(saveError || localError) && (
            <div className="form-error" role="alert">
              <WarningCircle size={19} />
              <span>{localError || saveError}</span>
            </div>
          )}
        </div>
        <div className="dialog-footer">
          <Button
            type="button"
            variant="secondary"
            onClick={requestClose}
            disabled={saving || uploading}
          >
            {readOnly ? "Tutup" : "Batal"}
          </Button>
          {type === "budgetItem" && (
            <Button
              type="button"
              icon={PencilSimple}
              onClick={() =>
                item.kind === "package"
                  ? edit("packagePayment")
                  : edit(
                      "expense",
                      data.expenses.find((expense) => expense.id === item.id),
                    )
              }
              disabled={saving}
            >
              Edit anggaran
            </Button>
          )}
          {!readOnly && (
            <Button
              type="submit"
              variant={type === "delete" ? "danger" : "primary"}
              icon={type === "delete" ? Trash : Check}
              disabled={saving || uploading}
            >
              {saving
                ? "Menyimpan…"
                : type === "delete"
                  ? "Ya, hapus"
                  : type === "json"
                    ? "Terapkan JSON"
                    : "Simpan perubahan"}
            </Button>
          )}
        </div>
      </form>
    </dialog>
  );
}

createRoot(document.getElementById("root")).render(<App />);
