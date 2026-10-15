/* ══════════════════════════════════════════════════════════════════
   MediElves_Claims.jsx  —  Main Application
   Dynamic data is handled by zohoapi.jsx
══════════════════════════════════════════════════════════════════ */
import { useState, useRef, useEffect, useCallback } from "react";
import {
  isZohoAvailable,
  loadDoctors,
  loadHospitalsForDoctor,
  loadClaims,
  loadClaimLines,
  loadClaimLinesRaw,
  loadPatients,
  loadPatientById,
  processPayment,
  createPaymentRecord,
  createClaimRecord,
  createPatientRecord,
  updatePatientRecord,
  updateRecord,
  updateClaimLineAmounts,
  loadStaffByLoginUser,
  loadHealthFunds,
  loadItems,
  searchItems,
  loadItemsPreview, // ← NEW
  loadPatientPayers,
  loadPatientPayerLookup,
  loadReferringDoctors, // NEW
  createReferringDoctorRecord, // NEW
  loadAssistantSurgeons, // ← NEW
  createAssistantSurgeonRecord, // ← NEW
  
  // generateNextClaimId
} from "./zohoapi";

/* ══════════════════════════════════════
   STATIC FALLBACK DATA
══════════════════════════════════════ */
const STATUS_CFG = {
  Draft: { bg: "#f8fafc", border: "#cbd5e1", text: "#475569", dot: "#64748b" },
  Lodged: { bg: "#f5f3ff", border: "#c4b5fd", text: "#5b21b6", dot: "#7c3aed" },
  "Partially Paid": {
    bg: "#fff7ed",
    border: "#fed7aa",
    text: "#9a3412",
    dot: "#f97316",
  },
  "Fully Paid": {
    bg: "#f0fdf4",
    border: "#86efac",
    text: "#166534",
    dot: "#22c55e",
  },
  Resubmitted: {
    bg: "#f0fdf4",
    border: "#86efac",
    text: "#166534",
    dot: "#22c55e",
  },
  Rejected: {
    bg: "#fff1f2",
    border: "#fecdd3",
    text: "#9f1239",
    dot: "#f43f5e",
  },
};

const normalizeStatus = (s) =>
  String(s || "")
    .trim()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();

const INR = (n) =>
  "A$" +
  Number(n).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
function formatDateZoho(d) {
  return `${String(d.getDate()).padStart(2, "0")}-${
    MONTHS_SHORT[d.getMonth()]
  }-${d.getFullYear()}`;
}
function parseDate(s) {
  if (!s) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const dmy = /^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec(s);
  if (dmy) {
    const mi = MONTHS_SHORT.findIndex(
      (m) => m.toLowerCase() === dmy[2].toLowerCase()
    );
    if (mi >= 0) return new Date(Number(dmy[3]), mi, Number(dmy[1]));
  }
  // NEW — numeric DD-MM-YYYY (e.g. 04-08-2026), same as DD-MMM-YYYY but with
  // a numeric month instead of a 3-letter name. Lets a typed DOB in this
  // format still resolve to a valid Date (so age auto-calculates, and the
  // field auto-normalizes to DD-MMM-YYYY on blur).
  const dmyNum = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
  if (dmyNum) {
    const day = Number(dmyNum[1]);
    const month = Number(dmyNum[2]);
    const year = Number(dmyNum[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(year, month - 1, day);
    }
  }
  return null;
}
/* ══════════════════════════════════════════════════════════════════
   CSS
══════════════════════════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --p:#0f4c81;--p2:#1565c0;--acc:#1976d2;--acc2:#42a5f5;
  --grn:#16a34a;--grn2:#22c55e;
  --bg:#f5f7fa;--s1:#f8fafc;--s2:#f1f5f9;
  --b1:#e2e8f0;--b2:#cbd5e1;
  --ink:#0f172a;--ink2:#334155;--ink3:#64748b;--ink4:#94a3b8;
  --fn:'Poppins',sans-serif;--r:10px;
  --sh:0 4px 24px rgba(0,0,0,.09);
}
html,body{background:var(--bg);color:var(--ink);font-family:var(--fn);min-height:100vh;-webkit-font-smoothing:antialiased;overflow-x:hidden}
.hdr{height:60px;background:var(--p);display:flex;align-items:center;justify-content:space-between;padding:0 28px;position:sticky;top:0;z-index:100;box-shadow:0 2px 16px rgba(0,0,0,.22)}
.hdr::after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--acc2),#7dd3fc,var(--acc2),transparent)}
.hdr-l{display:flex;align-items:center;gap:11px}
.hdr-logo{width:36px;height:36px;border-radius:9px;overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:transparent}
.hdr-logo img{width:100%;height:100%;object-fit:contain;border-radius:9px}
.hdr-name{font-size:15px;font-weight:700;color:#fff;letter-spacing:-.2px}
.hdr-sub{font-size:9px;color:rgba(255,255,255,.45);text-transform:uppercase;letter-spacing:1.4px;margin-top:-1px}
.hdr-r{display:flex;align-items:center;gap:8px}
.hdr-badge{display:flex;align-items:center;gap:6px;padding:5px 12px 5px 8px;border-radius:20px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);cursor:pointer;transition:all .15s;max-width:min(220px,40vw)}
.hdr-badge:hover{background:rgba(255,255,255,.16)}
.hdr-dot{width:6px;height:6px;border-radius:50%;background:var(--grn2);flex-shrink:0;box-shadow:0 0 6px var(--grn2)}
.hdr-badge-txt{font-size:11px;font-weight:600;color:rgba(255,255,255,.85);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hdr-badge-x{color:rgba(255,255,255,.35);font-size:12px;margin-left:2px}
.hdr-av{width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,var(--grn),var(--grn2));display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;cursor:pointer;flex-shrink:0}
.page{max-width:1200px;margin:0 auto;padding:5px 7px;width:100%;min-width:0}

/* ── Provider popup ── */
.pop-bg{position:fixed;inset:0;z-index:400;display:flex;align-items:flex-start;justify-content:center;background:rgba(8,15,35,.6);padding:80px 16px 16px;animation:bgFade .15s ease}
@keyframes bgFade{from{opacity:0}to{opacity:1}}
.pop-box{width:100%;max-width:660px;background:#fff;border-radius:20px;box-shadow:0 30px 80px rgba(0,0,0,.25),0 0 0 1px rgba(25,118,210,.12);overflow:visible;animation:boxIn .4s cubic-bezier(.175,.885,.32,1.275)}
@keyframes boxIn{0%{opacity:0;transform:scale(.80) translateY(32px)}65%{transform:scale(1.02) translateY(-3px)}100%{opacity:1;transform:scale(1) translateY(0)}}
.pop-top{background:linear-gradient(135deg,var(--p) 0%,var(--p2) 55%,#1e88e5 100%);padding:24px 28px 20px;position:relative;overflow:hidden;border-radius:20px 20px 0 0}
.pop-top::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,var(--grn),var(--grn2),var(--acc2),var(--grn),transparent)}
.pop-top-orb1{position:absolute;top:-60px;right:-40px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(66,165,245,.15) 0%,transparent 65%);pointer-events:none}
.pop-top-orb2{position:absolute;bottom:-60px;left:10%;width:150px;height:150px;border-radius:50%;background:radial-gradient(circle,rgba(34,197,94,.08) 0%,transparent 65%);pointer-events:none}
.pop-top-row{display:flex;align-items:flex-start;justify-content:space-between;position:relative;z-index:1}
.pop-tag{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:20px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);font-size:10px;font-weight:600;color:rgba(255,255,255,.85);text-transform:uppercase;letter-spacing:1.2px;margin-bottom:12px}
.pop-title{font-size:20px;font-weight:700;color:#fff;letter-spacing:-.3px;line-height:1.2;position:relative;z-index:1}
.pop-desc{font-size:12px;color:rgba(255,255,255,.5);margin-top:5px;line-height:1.5;position:relative;z-index:1}
.pop-body{padding:clamp(16px,4vw,28px) clamp(16px,4vw,28px) 4px}
.pop-fields-row{display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start}
.pop-field{display:flex;flex-direction:column;gap:8px;position:relative}
.pop-field-label{font-size:12px;font-weight:600;color:var(--ink2);display:flex;align-items:center;gap:7px}
.pop-field-label-dot{width:7px;height:7px;border-radius:50%;background:var(--grn);flex-shrink:0}
.pop-select-wrap{position:relative}
.pop-select-btn{width:100%;padding:11px 42px 11px 14px;border:2px solid var(--b1);border-radius:var(--r);background:#fff;font-family:var(--fn);font-size:13.5px;color:var(--ink4);font-weight:400;display:flex;align-items:center;cursor:pointer;transition:all .2s;outline:none;user-select:none;position:relative;z-index:1}
.pop-select-btn:hover{border-color:var(--b2)}
.pop-select-btn.open{border-color:var(--grn);box-shadow:0 0 0 3px rgba(22,163,74,.12)}
.pop-select-btn.has-val{color:var(--ink);font-weight:600}
.pop-select-btn.disabled-btn{opacity:.5;cursor:not-allowed;background:var(--s1)}
.pop-select-btn .val-txt{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pop-chevron{position:absolute;right:13px;top:50%;transform:translateY(-50%);font-size:11px;color:var(--ink3);pointer-events:none;transition:transform .22s;z-index:2}
.pop-chevron.up{transform:translateY(-50%) rotate(180deg)}
.pop-dd-portal{position:fixed;z-index:9999;background:#fff;border:1.5px solid var(--b1);border-radius:12px;box-shadow:0 16px 48px rgba(0,0,0,.16),0 2px 8px rgba(0,0,0,.08);overflow:hidden;opacity:0;animation:ddSlide .16s ease forwards}
@keyframes ddSlide{0%{opacity:0;transform:translateY(-4px)}100%{opacity:1;transform:translateY(0)}}
.pop-dd-search{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--b1);background:var(--s1)}
.pop-dd-search input{flex:1;border:1.5px solid var(--b1);background:#fff;border-radius:7px;padding:6px 10px;font-family:var(--fn);font-size:13px;color:var(--ink);outline:none;transition:border-color .15s}
.pop-dd-search input:focus{border-color:var(--grn)}
.pop-dd-search input::placeholder{color:var(--ink4)}
.pop-dd-search-ic{font-size:13px;color:var(--ink3);flex-shrink:0}
.pop-dd-list{max-height:220px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:var(--b2) transparent}
.pop-dd-list::-webkit-scrollbar{width:5px}
.pop-dd-list::-webkit-scrollbar-track{background:var(--s1)}
.pop-dd-list::-webkit-scrollbar-thumb{background:var(--b2);border-radius:4px}
.pop-dd-list::-webkit-scrollbar-thumb:hover{background:var(--ink4)}
.pop-dd-item{display:flex;align-items:center;gap:10px;padding:11px 13px;cursor:pointer;border-bottom:1px solid var(--b1);transition:background .1s;font-size:13px}
.pop-dd-item:last-child{border-bottom:none}
.pop-dd-item:hover{background:var(--s1)}
.pop-dd-item.dd-active{background:#f0fdf4}
.pop-dd-empty{padding:18px;text-align:center;color:var(--ink4);font-size:13px}
.pop-dd-loading{padding:18px;text-align:center;color:var(--ink3);font-size:13px;display:flex;align-items:center;justify-content:center;gap:8px}
.dd-av{width:32px;height:32px;border-radius:8px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;border:1px solid}
.dd-main{font-weight:600;color:var(--ink)}.dd-sub{font-size:11px;color:var(--ink3);margin-top:1px}
.dd-right{margin-left:auto;flex-shrink:0;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700}
.dd-tick{margin-left:auto;color:var(--grn);font-size:14px;font-weight:700;flex-shrink:0}
.pop-footer{padding:16px 28px 20px;display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--b1);background:var(--s1);gap:12px;flex-wrap:wrap;border-radius:0 0 20px 20px;margin-top:28px}
.pop-footer-txt{font-size:12px;color:var(--ink3)}.pop-footer-txt b{color:var(--grn);font-weight:700}
.btn{display:inline-flex;align-items:center;gap:7px;border:none;font-family:var(--fn);font-weight:600;cursor:pointer;transition:all .17s;white-space:nowrap;border-radius:var(--r)}
.cpm-btn-cancel{background:#fff;color:var(--ink2);border:1.5px solid var(--b1);padding:9px 18px;font-size:13px;font-weight:700;border-radius:9px;display:inline-flex;align-items:center;gap:6px;cursor:pointer;transition:all .15s}
.cpm-btn-cancel:hover{background:var(--s2);border-color:var(--b2)}
.cpm-btn-save{background:#2563eb;color:#fff;border:none;padding:9px 20px;font-size:13px;font-weight:700;border-radius:9px;display:inline-flex;align-items:center;gap:7px;cursor:pointer;transition:all .15s;box-shadow:0 2px 8px rgba(37,99,235,.25)}
.cpm-btn-save:hover{background:#1d4ed8;box-shadow:0 4px 14px rgba(37,99,235,.35)}
.cpm-btn-save:disabled,.cpm-btn-cancel:disabled{opacity:.55;cursor:not-allowed;transform:none;box-shadow:none}
.b-green{background:linear-gradient(135deg,var(--grn),#15803d);color:#fff;padding:11px 26px;font-size:13.5px;box-shadow:0 4px 14px rgba(22,163,74,.3)}
.b-green:hover{box-shadow:0 6px 22px rgba(22,163,74,.45);transform:translateY(-1px)}
.b-blue{background:linear-gradient(135deg,var(--acc),#1565c0);color:#fff;padding:11px 22px;font-size:13.5px;box-shadow:0 4px 14px rgba(25,118,210,.3)}
.b-blue:hover{box-shadow:0 6px 22px rgba(25,118,210,.45);transform:translateY(-1px)}
.b-outline{background:#fff;color:var(--ink2);border:1.5px solid var(--b1);padding:10px 18px;font-size:13.5px}
.b-outline:hover{background:var(--s2);border-color:var(--b2)}
.b-ghost{background:transparent;color:var(--ink3);padding:8px 12px;font-size:13px}
.b-ghost:hover{background:var(--s2);color:var(--ink2)}
.b-sm{padding:7px 14px!important;font-size:12px!important;border-radius:8px!important}
.btn:disabled{opacity:.35;cursor:not-allowed;transform:none!important;box-shadow:none!important}

/* SweetAlert */
.sa-bg{position:fixed;inset:0;z-index:900;display:flex;align-items:center;justify-content:center;background:rgba(8,15,35,.55);animation:bgFade .15s ease;padding:16px}
.sa-box{background:#fff;border-radius:20px;padding:36px 30px 28px;text-align:center;width:360px;max-width:92vw;box-shadow:0 40px 80px rgba(0,0,0,.22);animation:boxIn .35s cubic-bezier(.175,.885,.32,1.275)}
.sa-ic{width:66px;height:66px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;animation:icBounce .45s cubic-bezier(.2,1.4,.4,1)}
@keyframes icBounce{from{transform:scale(.25);opacity:0}70%{transform:scale(1.15)}to{transform:scale(1);opacity:1}}
.sa-ic.suc{background:#f0fdf4;border:2px solid #86efac}.sa-ic.wrn{background:#fefce8;border:2px solid #fde047}.sa-ic.err{background:#fff1f2;border:2px solid #fecdd3}
.sa-title{font-size:18px;font-weight:700;color:var(--ink);margin-bottom:8px}.sa-msg{font-size:13.5px;color:var(--ink3);line-height:1.6;margin-bottom:20px;white-space:pre-line}
.sa-amt{font-size:28px;font-weight:800;color:var(--grn);margin:4px 0 12px}
.sa-ref{font-size:11px;color:var(--ink4);font-family:monospace;background:var(--s2);padding:5px 12px;border-radius:6px;display:inline-block;margin-bottom:18px}
.sa-btns{display:flex;gap:10px;justify-content:center}

/* View header */
.view-hdr{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;gap:14px;flex-wrap:wrap}
.view-ey{font-size:10px;font-weight:700;color:var(--acc);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:5px;display:flex;align-items:center;gap:7px}
.view-ey::before{content:'';width:14px;height:2px;background:var(--acc);border-radius:2px}
.view-title{font-size:clamp(17px,3vw,21px);font-weight:700;color:var(--ink);letter-spacing:-.4px}
.view-sub{font-size:12.5px;color:var(--ink3);margin-top:4px}
.view-acts{display:flex;gap:8px;flex-wrap:wrap;flex-shrink:0}

/* Stats pills */
.stat-pills{display:flex;align-items:center;gap:10px;margin-bottom:9px;flex-wrap:wrap}
.stat-pill{display:inline-flex;align-items:center;gap:8px;padding:7px 16px 7px 10px;border-radius:999px;border:1.5px solid;font-family:var(--fn);cursor:default;transition:box-shadow .15s}
.stat-pill:hover{box-shadow:0 3px 12px rgba(0,0,0,.1)}
.stat-pill-bl{background:#eff6ff;border-color:#bfdbfe}
.stat-pill-gr{background:#f0fdf4;border-color:#86efac}
.stat-pill-or{background:#fff7ed;border-color:#fed7aa}
.stat-pill-ic{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0}
.stat-pill-bl .stat-pill-ic{background:#1976d2;color:#fff}
.stat-pill-gr .stat-pill-ic{background:#16a34a;color:#fff}
.stat-pill-or .stat-pill-ic{background:#ea580c;color:#fff;font-size:11px}
.stat-pill-body{display:flex;flex-direction:column;line-height:1.2}
.stat-pill-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.8px}
.stat-pill-bl .stat-pill-lbl{color:#1d4ed8}
.stat-pill-gr .stat-pill-lbl{color:#166534}
.stat-pill-or .stat-pill-lbl{color:#9a3412}
.stat-pill-val{font-size:14px;font-weight:800;letter-spacing:-.3px;color:#0f172a}
.stat-pill-div{width:1px;height:28px;background:var(--b1);flex-shrink:0}

/* Toolbar */
.tb{display:flex;align-items:center;gap:9px;margin-bottom:14px;flex-wrap:wrap}
.tb-s{position:relative;flex:1;min-width:180px;max-width:320px}
.tb-s input{width:100%;padding:10px 12px 10px 34px;background:#fff;border:1.5px solid var(--b1);border-radius:9px;font-family:var(--fn);font-size:13px;color:var(--ink);outline:none;transition:all .15s}
.tb-s input:focus{border-color:var(--acc);box-shadow:0 0 0 3px rgba(25,118,210,.1)}
.tb-s input::placeholder{color:var(--ink4)}.tb-s .si{position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:13px;color:var(--ink3)}
.tb-sel{padding:10px 12px;background:#fff;border:1.5px solid var(--b1);border-radius:9px;font-family:var(--fn);font-size:12.5px;color:var(--ink);outline:none;cursor:pointer;font-weight:500}



.sp{flex:1}

/* Table */
.tbl-wrap{background:#fff;border:1px solid var(--b1);border-radius:16px;overflow:hidden;box-shadow:var(--sh)}
.tbl-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
.tbl-top{display:flex;align-items:center;justify-content:space-between;padding:15px 20px;border-bottom:1px solid var(--b1);background:linear-gradient(90deg,#f0f9ff,#fff)}
.tbl-title{font-size:14px;font-weight:700;color:var(--ink)}.tbl-sub{font-size:11px;color:var(--ink3);margin-top:1px}
table{width:100%;border-collapse:collapse}
thead tr{background:var(--s1)}
thead th{padding:10px 16px;text-align:center;font-size:10px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.8px;border-bottom:1px solid var(--b1);white-space:nowrap;vertical-align:middle}
thead th:first-child{padding-left:20px;width:44px;text-align:center}
thead th:nth-child(2){width:100px}
thead th:nth-child(3){width:140px}
thead th:nth-child(4){min-width:160px}
thead th:nth-child(5){min-width:160px}
thead th:nth-child(6){width:110px}
thead th:nth-child(7){width:100px}
thead th:nth-child(8){width:100px}
thead th:nth-child(9){width:90px;text-align:center}
tbody tr{border-bottom:1px solid var(--b1);transition:background .1s;cursor:pointer}
tbody tr:last-child{border-bottom:none}
tbody tr:hover{background:#f8faff}
tbody tr.rsel{background:#eff6ff;border-left:3px solid var(--acc)}
tbody tr.rsel td:first-child{padding-left:17px}
tbody td{padding:12px 16px;font-size:13px;vertical-align:middle}
tbody td:first-child{padding-left:20px;width:44px}
.chk-cell{width:44px;padding-left:20px!important;cursor:default!important}
.chk-cell input[type="checkbox"]{cursor:pointer!important}
input[type="checkbox"]{width:15px;height:15px;accent-color:var(--acc);cursor:pointer}
.c-id{font-family:monospace;font-size:11.5px;color:var(--acc);font-weight:700}
.c-pn{font-size:13px;font-weight:600;color:var(--ink)}.c-dx{font-size:11px;color:var(--ink3);margin-top:2px}
.c-dn{font-size:12.5px;font-weight:600;color:var(--ink)}.c-ds{font-size:10.5px;color:var(--ink3)}
.c-amt{font-family:monospace;font-size:13px;font-weight:700;color:var(--ink)}.c-dt{font-size:11.5px;color:var(--ink3)}
.c-bal{font-family:monospace;font-size:12.5px;font-weight:700;color:#b45309}
.c-paid{font-family:monospace;font-size:12.5px;font-weight:700;color:#16a34a}
.badge{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;border:1.5px solid}
.bdot{width:5px;height:5px;border-radius:50%;flex-shrink:0}
.abar{display:flex;align-items:center;gap:10px;padding:11px 20px;background:linear-gradient(90deg,#eff6ff,#fff);border-top:1px solid #bfdbfe;animation:slideUp .18s ease;flex-wrap:wrap}
.abar-ct{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:700;color:var(--acc)}
.abar-n{width:22px;height:22px;border-radius:50%;background:var(--acc);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800}
.empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;text-align:center}
.empty-ic{font-size:44px;margin-bottom:12px;opacity:.2}.empty-t{font-size:15px;font-weight:700;color:var(--ink2);margin-bottom:5px}
.empty-tx{font-size:12.5px;color:var(--ink3);max-width:280px;line-height:1.6}
.tbl-pagination{display:flex;align-items:center;justify-content:space-between;padding:12px 20px;border-top:1px solid var(--b1);background:#fff;flex-wrap:wrap;gap:10px}
.tbl-pg-info{font-size:12.5px;color:var(--ink3)}
.tbl-pg-ctrls{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.tbl-pg-size-label{font-size:12px;color:var(--ink3);margin-right:4px}
.tbl-pg-size-sel{padding:6px 8px;border:1.5px solid var(--b1);border-radius:7px;font-family:var(--fn);font-size:12.5px;color:var(--ink);outline:none;cursor:pointer;background:#fff}
.tbl-pg-btn{width:30px;height:30px;border-radius:7px;border:1.5px solid var(--b1);background:#fff;color:var(--ink3);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;transition:all .14s}
.tbl-pg-btn:hover:not(:disabled){background:var(--s2);border-color:var(--b2);color:var(--ink)}
.tbl-pg-btn:disabled{opacity:.35;cursor:not-allowed}
.tbl-pg-num{width:30px;height:30px;border-radius:7px;border:1.5px solid var(--acc);background:var(--acc);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:700}
@media(max-width:560px){.tbl-pagination{justify-content:center;text-align:center}}

/* ══ PAYMENT CONFIRM POPUP ══ */
.pcp-ov{position:fixed;inset:0;z-index:800;display:flex;align-items:center;justify-content:center;background:rgba(8,15,35,.6);padding:16px;animation:bgFade .15s ease}
.pcp{width:520px;max-width:96vw;background:#fff;border-radius:20px;box-shadow:0 40px 100px rgba(0,0,0,.28);display:flex;flex-direction:column;overflow:hidden;animation:boxIn .32s cubic-bezier(.175,.885,.32,1.275)}
.pcp-hdr{padding:20px 24px 0px;background:linear-gradient(135deg,var(--p),var(--p2));border-radius:20px 20px 0 0;position:relative;overflow:hidden}
.pcp-hdr::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,var(--grn2),var(--acc2),transparent)}
.pcp-hdr-row{display:flex;align-items:center;justify-content:space-between;position:relative;z-index:1}
.pcp-title{font-size:17px;font-weight:700;color:#fff}
.pcp-sub{font-size:11.5px;color:rgba(255,255,255,.5);margin-top:3px}
.pcp-x{width:28px;height:28px;border-radius:7px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-size:13px;color:rgba(255,255,255,.5);cursor:pointer;transition:all .14s;flex-shrink:0}
.pcp-x:hover{background:rgba(220,53,69,.25);color:#ff8080}
.pcp-body{padding:24px}
.pcp-field{display:flex;flex-direction:column;gap:5px;margin-bottom:14px}
.pcp-label{font-size:11px;font-weight:700;color:var(--ink2);text-transform:uppercase;letter-spacing:.7px}
.pcp-input{padding:10px 13px;background:var(--s1);border:1.5px solid var(--b1);border-radius:9px;font-family:var(--fn);font-size:13.5px;color:var(--ink);outline:none;transition:all .15s;width:100%}
.pcp-input:focus{border-color:var(--grn);background:#fff;box-shadow:0 0 0 3px rgba(22,163,74,.1)}
.pcp-input::placeholder{color:var(--ink4)}
.pcp-input.readonly{background:var(--s2);color:var(--ink3);cursor:default;opacity:.8}
/* Amount display */
.pcp-amt-box{background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:2px solid #86efac;border-radius:12px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.pcp-amt-label{font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:.8px}
.pcp-amt-value{font-size:24px;font-weight:800;color:#15803d;font-family:monospace}
/* Claims summary inside popup */
.pcp-claims-list{border:1.5px solid var(--b1);border-radius:10px;overflow:hidden;margin-bottom:16px}
.pcp-claims-hdr{padding:8px 13px;background:var(--s1);border-bottom:1px solid var(--b1);font-size:10px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.7px;display:grid;grid-template-columns:1fr auto auto;gap:8px}
.pcp-claim-row{padding:9px 13px;border-bottom:1px solid var(--b1);display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center}
.pcp-claim-row:last-child{border-bottom:none}
.pcp-claim-id{font-family:monospace;font-size:11.5px;font-weight:700;color:var(--acc)}
.pcp-claim-bal{font-family:monospace;font-size:12px;font-weight:700;color:#b45309}
/* Payment method */
.pcp-pm-opts{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:16px}
.pcp-pm-opt{padding:9px 4px;border:1.5px solid var(--b1);border-radius:9px;text-align:center;cursor:pointer;transition:all .18s;font-size:11px;font-weight:600;color:var(--ink3);background:var(--s1)}
.pcp-pm-opt:hover{border-color:var(--b2);color:var(--ink);background:#fff}
.pcp-pm-opt.sel{border-color:var(--grn);color:var(--grn);background:#f0fdf4;font-weight:700}
.pcp-pm-opt-ic{font-size:17px;display:block;margin-bottom:3px}
.pcp-foot{padding:14px 24px 18px;border-top:1px solid var(--b1);display:flex;justify-content:flex-end;gap:9px;background:var(--s1)}
.pcp-err{font-size:11px;color:#ef4444;margin-top:2px}

/* Payment */
.pay-wrap{animation:slideInUp .28s ease}
.pay-hero{background:linear-gradient(135deg,var(--p) 0%,var(--p2) 60%,#1565c0 100%);border-radius:16px;margin-bottom:22px;padding:20px 24px;position:relative;overflow:hidden;box-shadow:0 8px 28px rgba(15,76,129,.25)}
.pay-hero-line{position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--grn),var(--acc2),var(--grn),transparent)}
.pay-hero-glow{position:absolute;top:-50px;right:-50px;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(66,165,245,.1) 0%,transparent 70%)}
.pb-back{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;color:rgba(255,255,255,.4);cursor:pointer;margin-bottom:12px;background:none;border:none;padding:0;font-family:var(--fn);transition:color .13s}
.pb-back:hover{color:rgba(255,255,255,.8)}
.pb-ey{font-size:9.5px;font-weight:700;color:#7dd3fc;text-transform:uppercase;letter-spacing:2px;margin-bottom:5px}
.pay-layout{display:grid;grid-template-columns:1fr 325px;gap:18px;align-items:start;height:calc(100vh - 220px)}
.pay-layout-left{overflow-y:auto;height:100%;padding-right:6px;scrollbar-width:thin;scrollbar-color:var(--b2) transparent}
.pay-layout-left::-webkit-scrollbar{width:5px}
.pay-layout-left::-webkit-scrollbar-track{background:transparent}
.pay-layout-left::-webkit-scrollbar-thumb{background:var(--b2);border-radius:4px}
.pay-page-wrap{padding-bottom:40px}
.cb{background:#fff;border:1.5px solid var(--b1);border-radius:13px;overflow:hidden;margin-bottom:10px;box-shadow:0 1px 4px rgba(0,0,0,.05);transition:all .15s}
.cb.cb-on{border-color:var(--acc);background:#f8fbff}
.cbh{display:flex;align-items:center;padding:13px 15px;gap:10px}
.cb-chk{width:18px;height:18px;border-radius:4px;border:2px solid var(--b2);background:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;transition:all .15s}
.cb-chk.on{border-color:var(--acc);background:var(--acc)}.cb-chk-tick{color:#fff;font-size:10px;font-weight:800}
.cb-info{flex:1;min-width:0}.cb-id{font-family:monospace;font-size:11.5px;font-weight:700;color:var(--acc)}
.cb-meta{font-size:10.5px;color:var(--ink3);margin-top:2px;word-break:break-word}
.cb-right{display:flex;align-items:center;gap:9px;flex-shrink:0}
.cb-amt{font-family:monospace;font-size:13.5px;font-weight:700;color:var(--ink)}
.cb-exp{width:24px;height:24px;border-radius:6px;background:var(--s2);border:1px solid var(--b1);display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--ink3);cursor:pointer;transition:all .2s}
.cb-exp.open{transform:rotate(180deg);background:#eff6ff;border-color:#bfdbfe;color:var(--acc)}
.lt{width:100%;border-collapse:collapse;min-width:400px}
.cb-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
.lt th{padding:8px 13px;font-size:9.5px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.7px;text-align:left;background:var(--s1);border-bottom:1px solid var(--b1)}
.lt td{padding:10px 13px;font-size:12.5px;border-bottom:1px solid var(--b1);transition:background .1s}
.lt tr:last-child td{border-bottom:none}.lt tr.lt-on td{background:#eff6ff}
.lt tfoot td{padding:9px 13px;font-weight:700;background:#f0f9ff;border-top:1px solid #bfdbfe;font-size:12.5px}
.lt-code{font-family:monospace;font-size:10px;font-weight:700;border-radius:4px;background:#eff6ff;color:var(--acc);border:1px solid #bfdbfe}
.lt-amt{font-family:monospace;font-weight:700;text-align:right}
.lt-chk-cell{width:36px;text-align:center}
.lt-chk{width:15px;height:15px;border-radius:3px;border:1.5px solid var(--b2);background:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:all .14s}
.lt-chk.on{border-color:var(--acc);background:var(--acc)}.lt-chk-tick{color:#fff;font-size:9px;font-weight:800}
.sum{background:#fff;border:1.5px solid var(--b1);border-radius:16px;overflow:visible;box-shadow:var(--sh);display:flex;flex-direction:column}
.sum-body{padding:15px 17px;flex:1}
.sum-hdr{padding:14px 17px;background:linear-gradient(135deg,#f0f9ff,#fff);border-bottom:1px solid var(--b1)}
.sum-hdr-t{font-size:14px;font-weight:700;color:var(--ink)}.sum-hdr-s{font-size:11px;color:var(--ink3);margin-top:1px}

.sum-div{height:1px;background:var(--b1);margin:11px 0}
.sum-grand{display:flex;justify-content:space-between;align-items:center;padding:11px 0 0;border-top:2px solid var(--grn);margin-top:3px}
.sum-grand-l{font-size:14px;font-weight:700;color:var(--ink)}.sum-grand-v{font-size:20px;font-weight:800;color:var(--grn);font-family:monospace}

/* ── NEW CLAIM MODAL ── */
.ncm-ov{position:fixed;inset:0;z-index:800;display:flex;align-items:center;justify-content:center;background:rgba(8,15,35,.6);padding:16px;animation:bgFade .15s ease}
.ncm{width:700px;max-width:96vw;max-height:94vh;background:#fff;border-radius:20px;box-shadow:0 40px 100px rgba(0,0,0,.25);display:flex;flex-direction:column;overflow:hidden;animation:boxIn .32s cubic-bezier(.175,.885,.32,1.275)}
.ncm-hdr{padding:12px 19px 2px;background:linear-gradient(135deg,var(--p),var(--p2));border-radius:20px 20px 0 0;flex-shrink:0;position:relative;overflow:hidden}
.ncm-hdr::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,var(--grn2),var(--acc2),transparent)}
.ncm-hdr-row{display:flex;align-items:center;justify-content:space-between;position:relative;z-index:1}
.ncm-title{font-size:17px;font-weight:700;color:#fff}
.ncm-sub{font-size:11.5px;color:rgba(255,255,255,.5);margin-top:3px}
.ncm-x{width:28px;height:28px;border-radius:7px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-size:13px;color:rgba(255,255,255,.5);cursor:pointer;transition:all .14s;flex-shrink:0}
.ncm-x:hover{background:rgba(220,53,69,.25);color:#ff8080}
.ncm-body{padding:0px 11px;overflow-y:auto;flex:1;scrollbar-width:thin;scrollbar-color:var(--b2) transparent}
.ncm-body::-webkit-scrollbar{width:5px}
.ncm-body::-webkit-scrollbar-track{background:transparent}
.ncm-body::-webkit-scrollbar-thumb{background:var(--b2);border-radius:4px}
.ncm-foot{padding:12px 24px;border-top:1px solid var(--b1);display:flex;justify-content:flex-end;gap:9px;flex-shrink:0;background:var(--s1)}
.ncm-sec{margin-bottom:6px}
.ncm-sec-label{font-size:10px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.8px;padding-bottom:7px;border-bottom:1px solid var(--b1);margin-bottom:12px}
.ncm-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.ncm-field{display:flex;flex-direction:column;gap:4px}
.ncm-field.full{grid-column:1/-1}
.ncm-label{font-size:11px;font-weight:600;color:var(--ink2)}
.ncm-input,.ncm-select{padding:9px 11px;background:var(--s1);border:1.5px solid var(--b1);border-radius:8px;font-family:var(--fn);font-size:13px;color:var(--ink);outline:none;transition:all .15s;width:100%}
.ncm-input:focus,.ncm-select:focus{border-color:var(--grn);background:#fff;box-shadow:0 0 0 3px rgba(22,163,74,.1)}
.ncm-input::placeholder{color:var(--ink4)}

/* Patient select row */
.pat-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;position:relative;width:100%;min-width:0}
.pat-dd-wrap{min-width:0;width:100%;position:relative;display:flex;align-items:center;gap:8px}
.pat-dd-trigger{flex:1;min-width:0;min-height:42px}
.btn-edit-pat,.btn-new-pat{flex-shrink:0;height:42px;padding:0 14px;display:flex;align-items:center;justify-content:center}
.btn-edit-pat{background:linear-gradient(135deg,var(--grn),#15803d);border:none;border-radius:999px;color:#fff;font-family:var(--fn);font-size:14px;font-weight:700;cursor:pointer;width:42px;min-width:42px;transition:all .17s;white-space:nowrap}
.btn-edit-pat:hover{box-shadow:0 4px 12px rgba(22,163,74,.35);transform:translateY(-1px)}
.btn-edit-pat:disabled{opacity:.45;cursor:not-allowed;box-shadow:none;}
.btn-new-pat{background:linear-gradient(135deg,var(--grn),#15803d);border:none;border-radius:8px;color:#fff;font-family:var(--fn);font-size:12px;font-weight:700;cursor:pointer;gap:5px;transition:all .17s;white-space:nowrap}
.btn-new-pat:hover{box-shadow:0 4px 12px rgba(22,163,74,.35);transform:translateY(-1px)}
.cl-date-wrap{border:1.5px solid transparent;border-radius:6px;padding:2px;background:#fff;transition:border-color .15s}
.cl-date-wrap.err{border-color:#ef4444}
.pat-dd-trigger{flex:1;width:auto;padding:10px 42px 10px 12px;background:var(--s1);border:1.5px solid var(--b1);border-radius:8px;font-family:var(--fn);font-size:13px;color:var(--ink4);text-align:left;cursor:pointer;transition:all .15s;display:flex;align-items:center;outline:none;min-height:42px;position:relative}
.pat-dd-trigger.open{border-color:var(--grn);background:#fff;box-shadow:0 0 0 3px rgba(22,163,74,.1)}
.pat-dd-trigger.has-val{color:var(--ink);font-weight:600}
.pat-dd-trigger-txt{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;align-items:center}
.pat-dd-chev{position:absolute;right:14px;top:50%;transform:translateY(-50%);font-size:11px;color:var(--ink3);pointer-events:none;transition:transform .2s}
.pat-dd-chev.up{transform:translateY(-50%) rotate(180deg)}
.pat-dd-clear{position:absolute;right:40px;top:50%;transform:translateY(-50%);width:18px;height:18px;border-radius:50%;background:var(--ink4);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#fff;cursor:pointer;border:none;padding:0;line-height:1;transition:background .14s;z-index:2}
.pat-dd-clear:hover{background:#ef4444}
.pat-dd-edit{position:relative;flex-shrink:0;}
.pat-dd-panel{position:absolute;top:calc(100% + 4px);left:0;min-width:100%;width:max-content;max-width:340px;z-index:9999;background:#fff;border:1.5px solid var(--b1);border-radius:12px;box-shadow:0 16px 48px rgba(0,0,0,.16);overflow:hidden;animation:ddSlide .14s ease forwards}
.pat-dd-search-row{display:flex;align-items:center;gap:7px;padding:9px 12px;border-bottom:1px solid var(--b1);background:var(--s1)}
.pat-dd-search-row input{flex:1;border:1.5px solid var(--b1);background:#fff;border-radius:7px;padding:5px 9px;font-family:var(--fn);font-size:13px;color:var(--ink);outline:none;transition:border-color .15s}
.pat-dd-search-row input:focus{border-color:var(--grn)}
.pat-dd-search-row input::placeholder{color:var(--ink4)}
.pat-dd-list{max-height:200px;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:var(--b2) transparent}
.pat-dd-list::-webkit-scrollbar{width:5px}
.pat-dd-list::-webkit-scrollbar-track{background:var(--s1)}
.pat-dd-list::-webkit-scrollbar-thumb{background:var(--b2);border-radius:4px}
.pat-dd-item{padding:9px 12px;cursor:pointer;font-size:13px;font-weight:500;color:var(--ink);border-bottom:1px solid var(--b1);transition:background .1s;display:flex;align-items:center;gap:8px}
.pat-dd-item:last-child{border-bottom:none}
.pat-dd-item:hover{background:#f0fdf4}
.pat-dd-item.active{background:#eff6ff;font-weight:700;color:var(--acc)}
.pat-dd-item-ic{width:26px;height:26px;border-radius:50%;background:var(--s2);border:1px solid var(--b1);display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;font-weight:700;color:var(--ink3)}
.pat-dd-empty{padding:16px;text-align:center;color:var(--ink4);font-size:13px}

/* Claim lines */
.cl-grid-hdr{display:grid;grid-template-columns:160px 1fr 110px 24px;gap:8px;padding:4px 8px;margin-bottom:4px}
.cl-grid-row{display:grid;grid-template-columns:160px 1fr 110px 24px;gap:8px;align-items:center;padding:6px 8px;background:var(--s1);border:1.5px solid var(--b1);border-radius:8px;margin-bottom:5px;transition:border-color .15s}
.cl-grid-row:hover{border-color:var(--b2)}
.cl-col-hdr{font-size:9px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.5px;white-space:nowrap;overflow:;text-overflow:ellipsis}
.cl-input{padding:5px 7px;background:#fff;border:1.5px solid var(--b1);border-radius:6px;font-family:monospace;font-size:12px;color:var(--ink);outline:none;width:100%;min-width:0;transition:border-color .15s}
.cl-input:focus{border-color:var(--grn);box-shadow:0 0 0 2px rgba(22,163,74,.08)}
.cl-input::placeholder{color:var(--ink4)}
.cl-input.err{border-color:#ef4444}
.cl-select{padding:5px 7px;background:#fff;border:1.5px solid var(--b1);border-radius:6px;font-family:var(--fn);font-size:12px;color:var(--ink);outline:none;width:100%;min-width:0;transition:border-color .15s;max-height:32px;overflow-y:auto}
.cl-select:focus{border-color:var(--grn)}
.cl-del-btn{width:22px;height:22px;border-radius:5px;background:none;border:1.5px solid var(--b1);color:var(--ink4);cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center;transition:all .13s;flex-shrink:0;padding:0}
.cl-del-btn:hover:not(:disabled){background:#fff1f2;border-color:#fecdd3;color:#9f1239}
.cl-del-btn:disabled{opacity:.25;cursor:not-allowed}
.cl-add-btn{width:100%;padding:7px;background:none;border:2px dashed var(--b2);border-radius:8px;color:var(--ink3);font-family:var(--fn);font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;margin-bottom:10px;display:flex;align-items:center;justify-content:center;gap:6px}
.cl-add-btn:hover{border-color:var(--grn);color:var(--grn);background:#f0fdf4}
.cl-total-row{display:flex;justify-content:flex-end;align-items:center;gap:10px;padding-top:8px;border-top:1px solid var(--b1)}

/* Date picker */
.date-pick-wrap{position:relative}
.date-pick-btn{width:100%;padding:5px 28px 5px 7px;background:#fff;border:1.5px solid var(--b1);border-radius:6px;font-family:monospace;font-size:12px;color:var(--ink);outline:none;cursor:pointer;text-align:left;transition:all .15s;display:flex;align-items:center;min-height:30px;min-width:0}
.date-pick-btn:hover{border-color:var(--b2)}
.date-pick-btn.open{border-color:var(--grn);box-shadow:0 0 0 2px rgba(22,163,74,.08)}
.date-pick-btn.no-val{color:var(--ink4)}
.date-pick-ic{position:absolute;right:6px;top:50%;transform:translateY(-50%);font-size:12px;pointer-events:none;color:var(--ink3)}
.date-cal{position:absolute;top:calc(100% + 4px);left:0;z-index:9999;background:#fff;border:1.5px solid var(--b1);border-radius:12px;box-shadow:0 16px 48px rgba(0,0,0,.16);width:240px;padding:10px;animation:ddSlide .14s ease forwards}
.cal-nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.cal-nav-btn{background:var(--s1);border:1.5px solid var(--b1);border-radius:7px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;color:var(--ink2);transition:all .14s}
.cal-nav-btn:hover{background:var(--s2);border-color:var(--b2)}
.cal-month-lbl{font-size:12px;font-weight:700;color:var(--ink)}
.cal-days-hdr{display:grid;grid-template-columns:repeat(7,1fr);gap:1px;margin-bottom:3px}
.cal-dh{font-size:8px;font-weight:700;color:var(--ink4);text-align:center;padding:2px 0;text-transform:uppercase}
.cal-days{display:grid;grid-template-columns:repeat(7,1fr);gap:1px}
.cal-day{height:28px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:500;border-radius:5px;cursor:pointer;color:var(--ink2);transition:all .12s;user-select:none}
.cal-day:hover:not(.cal-day-empty){background:var(--s2)}
.cal-day.cal-day-today{color:var(--grn);font-weight:700}
.cal-day.cal-day-sel{background:var(--grn);color:#fff;font-weight:700}
.cal-day.cal-day-sel:hover{background:#15803d}
.cal-day.cal-day-empty{cursor:default}

/* ── CREATE PATIENT POPUP ── */
.cpm-ov{position:fixed;inset:0;z-index:1100;display:flex;align-items:center;justify-content:center;background:rgba(8,15,35,.7);padding:16px;animation:bgFade .15s ease}
.cpm{width:980px;max-width:120vw;max-height:94vh;background:#fff;border-radius:20px;box-shadow:0 40px 100px rgba(0,0,0,.3);display:flex;flex-direction:column;overflow:hidden;animation:boxIn .32s cubic-bezier(.175,.885,.32,1.275)}
.cpm-hdr{padding:16px 24px;background:#fff;border-bottom:1.5px solid var(--b1);border-radius:20px 20px 0 0;flex-shrink:0}
.cpm-hdr-row{display:flex;align-items:center;justify-content:space-between;gap:16px}
.cpm-hdr-l{display:flex;align-items:center;gap:12px;min-width:0}
.cpm-hdr-ic{width:36px;height:36px;border-radius:9px;background:#dbeafe;color:#2563eb;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.cpm-hdr-text{display:flex;flex-direction:column;align-items:flex-start;text-align:left;min-width:0}
.cpm-title{font-size:16px;font-weight:800;color:var(--ink);letter-spacing:-.2px;line-height:1.2;text-align:left;white-space:nowrap}
.cpm-sub{font-size:11px;color:var(--ink3);margin-top:2px;line-height:1.4;text-align:left;white-space:nowrap}
.cpm-x{width:30px;height:30px;border-radius:8px;background:var(--s1);border:1.5px solid var(--b1);display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--ink3);cursor:pointer;transition:all .14s;flex-shrink:0}
.cpm-x:hover{background:#fff1f2;border-color:#fecdd3;color:#e11d48}
.cpm-body{padding:20px 24px;overflow-y:auto;flex:1;scrollbar-width:thin;scrollbar-color:var(--b2) transparent}
.cpm-body::-webkit-scrollbar{width:5px}
.cpm-body::-webkit-scrollbar-thumb{background:var(--b2);border-radius:4px}
.cpm-foot{padding:12px 24px;border-top:1px solid var(--b1);display:flex;justify-content:flex-end;gap:9px;flex-shrink:0;background:var(--s1)}
.cpm-sec{margin-bottom:16px}
.cpm-sec-label{font-size:10px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.8px;padding-bottom:7px;border-bottom:1px solid var(--b1);margin-bottom:12px;display:flex;align-items:center;gap:7px}
.cpm-sec-label::before{content:'';width:10px;height:2px;background:var(--grn);border-radius:2px}
.cpm-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.cpm-field{display:flex;flex-direction:column;gap:4px}
.cpm-field.full{grid-column:1/-1}
.cpm-label{font-size:11px;font-weight:600;color:var(--ink2)}
.cpm-label .req{color:#ef4444;margin-left:2px}
.cpm-label .opt{font-size:10px;font-weight:400;color:var(--ink4);margin-left:4px}
.cpm-input,.cpm-select{padding:9px 11px;background:var(--s1);border:1.5px solid var(--b1);border-radius:8px;font-family:var(--fn);font-size:13px;color:var(--ink);outline:none;transition:all .15s;width:100%}
.cpm-input:focus,.cpm-select:focus{border-color:var(--grn);background:#fff;box-shadow:0 0 0 3px rgba(22,163,74,.1)}
.cpm-input::placeholder{color:var(--ink4)}
.cpm-input.err,.cpm-select.err{border-color:#ef4444;box-shadow:0 0 0 3px rgba(239,68,68,.1)}
.cpm-err-tip{font-size:10px;color:#ef4444;margin-top:2px}
.cpm-phone-wrap{display:flex;align-items:stretch;gap:0}
.cpm-phone-prefix{padding:9px 10px;background:var(--s2);border:1.5px solid var(--b1);border-right:none;border-radius:8px 0 0 8px;font-family:var(--fn);font-size:13px;color:var(--ink2);font-weight:600;white-space:nowrap;display:flex;align-items:center}
.cpm-phone-input{flex:1;padding:9px 11px;background:var(--s1);border:1.5px solid var(--b1);border-radius:0 8px 8px 0;font-family:var(--fn);font-size:13px;color:var(--ink);outline:none;transition:all .15s;min-width:0}
.cpm-phone-input:focus{border-color:var(--grn);background:#fff;box-shadow:0 0 0 3px rgba(22,163,74,.1)}
.cpm-phone-input::placeholder{color:var(--ink4)}
.cpm-phone-input.err{border-color:#ef4444}
.cpm .date-pick-btn{padding:9px 36px 9px 11px;font-size:13px;border-radius:8px;min-height:40px;font-family:var(--fn)}
.cpm .date-pick-ic{right:10px;font-size:14px}
.cpm .date-cal{width:260px}

.spin{display:inline-block;animation:spin 1s linear infinite}
@keyframes slideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideInUp{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
html{scrollbar-width:thin;scrollbar-color:var(--b2) var(--bg)}
html::-webkit-scrollbar{width:6px}
html::-webkit-scrollbar-track{background:var(--bg)}
html::-webkit-scrollbar-thumb{background:var(--b2);border-radius:6px}

@media(max-width:768px){
  .hdr{padding:0 16px;height:56px}.hdr-badge{display:none}.hdr-name{font-size:13px}
  .page{padding:14px 12px}
  .pop-fields-row{grid-template-columns:1fr;gap:14px}
  .pop-box{border-radius:16px;margin:8px}
  .pop-top{border-radius:16px 16px 0 0;padding:18px 20px 16px}
  .pop-body{padding:18px 16px 4px}
  .pop-footer{padding:12px 16px 16px;border-radius:0 0 16px 16px;flex-direction:column;align-items:stretch}
  .pop-footer .btn{width:100%;justify-content:center}
  .stat-pills{gap:7px}
  .view-hdr{flex-direction:column;gap:10px}
  .view-acts{flex-wrap:wrap;gap:6px}
  .tb{flex-wrap:wrap;gap:8px}.tb-s{max-width:100%;flex-basis:100%}
  .pay-layout{grid-template-columns:1fr}
  .sum{position:relative;top:0}
  .ncm{width:100%;max-height:96vh;border-radius:16px}
  .ncm-grid{grid-template-columns:1fr}.ncm-field.full{grid-column:1}
  .cpm{width:100%;border-radius:16px}
  .cpm-grid{grid-template-columns:1fr}.cpm-field.full{grid-column:1}
  table thead th:nth-child(5),table tbody td:nth-child(5){display:none}
  table thead th:nth-child(4),table tbody td:nth-child(4){display:none}
  .pcp-pm-opts{grid-template-columns:repeat(2,1fr)}
}
@media(max-width:480px){
  .hdr{padding:0 12px;height:52px}.hdr-sub{display:none}.hdr-name{font-size:13px}
  .hdr-av{width:28px;height:28px;font-size:10px}
  .page{padding:10px}
  .view-title{font-size:18px}
  .view-acts .btn{font-size:11px!important;padding:6px 10px!important}
  .tbl-wrap{border-radius:12px}
  table thead th:nth-child(3),table tbody td:nth-child(3),
  table thead th:nth-child(4),table tbody td:nth-child(4),
  table thead th:nth-child(5),table tbody td:nth-child(5){display:none}
  .c-dx{display:none}.badge{font-size:10px;padding:3px 8px}
  .pop-box{margin:4px}
  .pop-body{padding:16px 14px 4px}
}
@media(max-width:360px){
  .hdr-name{font-size:12px}.view-acts{gap:4px}.stat-pill-div{display:none}
}
  .status-ms-btn{padding:10px 32px 10px 12px;background:#fff;border:1.5px solid var(--b1);border-radius:9px;font-family:var(--fn);font-size:12.5px;color:var(--ink);outline:none;cursor:pointer;font-weight:500;display:flex;align-items:center;gap:6px;min-width:150px;position:relative;transition:all .15s}
.status-ms-btn:hover{border-color:var(--b2)}
.status-ms-btn.open{border-color:var(--acc);box-shadow:0 0 0 3px rgba(25,118,210,.1)}
.status-ms-chev{position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:10px;color:var(--ink3);transition:transform .2s}
.status-ms-chev.up{transform:translateY(-50%) rotate(180deg)}
.status-ms-panel{position:absolute;top:calc(100% + 4px);left:0;min-width:190px;z-index:60;background:#fff;border:1.5px solid var(--b1);border-radius:12px;box-shadow:0 16px 48px rgba(0,0,0,.16);overflow:hidden;animation:ddSlide .14s ease forwards}
.status-ms-all{padding:10px 14px;cursor:pointer;font-size:13px;font-weight:700;border-bottom:1px solid var(--b1);transition:background .1s}
.status-ms-list{max-height:240px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--b2) transparent}
.status-ms-item{display:flex;align-items:center;gap:9px;padding:10px 14px;cursor:pointer;font-size:13px;color:var(--ink);border-bottom:1px solid var(--b1);transition:background .1s}
.status-ms-item:last-child{border-bottom:none}
.status-ms-chk{width:15px;height:15px;border-radius:4px;flex-shrink:0;border:2px solid var(--b2);background:#fff;display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;font-weight:800;transition:all .15s}
`;

/* ─────────────────────────────────────────────────────────────────
   SWEET ALERT
───────────────────────────────────────────────────────────────── */
function SweetAlert({
  type = "success",
  title,
  message,
  amount,
  txn,
  onClose,
  onConfirm,
  confirmText = "OK",
  cancelText,
  autoClose = false,
  autoCloseSeconds = 10,
}) {
  const [countdown, setCountdown] = useState(
    autoClose ? autoCloseSeconds : null
  );
  const icons = { success: "✓", warning: "⚠", error: "✕" };
  const clrs = { success: "#16a34a", warning: "#d97706", error: "#be123c" };

  useEffect(() => {
    if (!autoClose) return;
    if (countdown <= 0) {
      onClose();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [autoClose, countdown]);

  const pct = autoClose ? (countdown / autoCloseSeconds) * 100 : 100;

  return (
    <div className="sa-bg" onClick={onClose}>
      <div
        className="sa-box"
        onClick={(e) => e.stopPropagation()}
        style={{ position: "relative", overflow: "hidden" }}
      >
        {autoClose && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              height: 4,
              width: `${pct}%`,
              background: "#d97706",
              transition: "width 1s linear",
              borderRadius: "0 0 0 20px",
            }}
          />
        )}
        <div
          className={`sa-ic ${
            type === "success" ? "suc" : type === "warning" ? "wrn" : "err"
          }`}
        >
          <span style={{ fontSize: 28, fontWeight: 800, color: clrs[type] }}>
            {icons[type]}
          </span>
        </div>
        <div className="sa-title">{title}</div>
        {message && <div className="sa-msg">{message}</div>}
        {amount && <div className="sa-amt">{amount}</div>}
        {txn && <div className="sa-ref">{txn}</div>}
        {autoClose && (
          <div style={{ fontSize: 12, color: "var(--ink4)", marginBottom: 12 }}>
            Closing in{" "}
            <strong style={{ color: "#d97706" }}>{countdown}s</strong>
          </div>
        )}
        <div className="sa-btns">
          {cancelText && (
            <button className="btn b-outline b-sm" onClick={onClose}>
              {cancelText}
            </button>
          )}
          {!autoClose && (
            <button className="btn b-green" onClick={onConfirm || onClose}>
              {confirmText}
            </button>
          )}
          {autoClose && (
            <button className="btn b-outline b-sm" onClick={onClose}>
              Close Now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   BADGE
───────────────────────────────────────────────────────────────── */
function Badge({ status }) {
  const m = STATUS_CFG[status] || {
    bg: "#f1f5f9",
    border: "#cbd5e1",
    text: "#475569",
    dot: "#94a3b8",
  };
  return (
    <span
      className="badge"
      style={{ background: m.bg, borderColor: m.border, color: m.text }}
    >
      <span className="bdot" style={{ background: m.dot }} />
      {status}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────
   DATE PICKER
───────────────────────────────────────────────────────────────── */
function DatePicker({
  value,
  onChange,
  placeholder = "Pick date",
  maxDate = null,
  editable = false,
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("day");
  const wrapRef = useRef(null);
  const parsed = parseDate(value);
  const today = new Date();
  const [viewYear, setViewYear] = useState((parsed || today).getFullYear());
  const [viewMonth, setViewMonth] = useState((parsed || today).getMonth());
  const yearListRef = useRef(null);
  const [typedValue, setTypedValue] = useState(value || "");

  useEffect(() => {
    setTypedValue(value || "");
  }, [value]);

  useEffect(() => {
    const d = parseDate(value);
    if (d) {
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [value]);

  useEffect(() => {
    const h = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setMode("day");
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (mode === "year" && yearListRef.current) {
      const sel = yearListRef.current.querySelector("[data-selected='true']");
      if (sel) sel.scrollIntoView({ block: "center" });
    }
  }, [mode]);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  };

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isSelected = (d) => {
    if (!d || !parsed) return false;
    return (
      parsed.getFullYear() === viewYear &&
      parsed.getMonth() === viewMonth &&
      parsed.getDate() === d
    );
  };
  const isToday = (d) => {
    if (!d) return false;
    return (
      today.getFullYear() === viewYear &&
      today.getMonth() === viewMonth &&
      today.getDate() === d
    );
  };

  const pick = (d) => {
    if (!d) return;
    const chosen = new Date(viewYear, viewMonth, d);
    if (maxDate && chosen > maxDate) return;
    onChange(formatDateZoho(chosen));
    setOpen(false);
    setMode("day");
  };

  const currentYear = today.getFullYear();
  const years = [];
  for (let y = currentYear; y >= 1920; y--) years.push(y);

  const handleTypedChange = (e) => {
    setTypedValue(e.target.value);
    onChange(e.target.value);
  };

  const handleTypedBlur = () => {
    const d = parseDate(typedValue);
    if (d) {
      const formatted = formatDateZoho(d);
      setTypedValue(formatted);
      onChange(formatted);
    }
  };

  return (
    <div className="date-pick-wrap" ref={wrapRef}>
      {editable ? (
        <input
          type="text"
          className={`date-pick-btn ${value ? "" : "no-val"}`}
          style={{ cursor: "text" }}
          placeholder={placeholder}
          value={typedValue}
          onChange={handleTypedChange}
          onBlur={handleTypedBlur}
        />
      ) : (
        <button
          type="button"
          className={`date-pick-btn ${open ? "open" : ""} ${
            value ? "" : "no-val"
          }`}
          onClick={() => {
            setOpen((o) => !o);
            setMode("day");
          }}
        >
          <span
            style={{
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {value || placeholder}
          </span>
        </button>
      )}
      <span
        className="date-pick-ic"
        style={editable ? { cursor: "pointer", pointerEvents: "auto" } : {}}
        onClick={
          editable
            ? () => {
                setOpen((o) => !o);
                setMode("day");
              }
            : undefined
        }
      >
        📅
      </span>

      {open && (
        <div className="date-cal">
          {mode === "year" ? (
            <>
              <div className="cal-nav">
                <button
                  type="button"
                  className="cal-nav-btn"
                  style={{
                    fontSize: 10,
                    width: "auto",
                    padding: "0 8px",
                    minWidth: 44,
                  }}
                  onClick={() => setMode("day")}
                >
                  ← Back
                </button>
                <span className="cal-month-lbl">Select Year</span>
                <span style={{ width: 24 }} />
              </div>
              <div
                ref={yearListRef}
                style={{
                  maxHeight: 192,
                  overflowY: "auto",
                  scrollbarWidth: "thin",
                  display: "grid",
                  gridTemplateColumns: "repeat(3,1fr)",
                  gap: 3,
                  padding: "4px 2px",
                }}
              >
                {years.map((y) => (
                  <div
                    key={y}
                    data-selected={y === viewYear ? "true" : "false"}
                    onClick={() => {
                      setViewYear(y);
                      setMode("day");
                    }}
                    style={{
                      padding: "6px 4px",
                      textAlign: "center",
                      fontSize: 12,
                      fontWeight: y === viewYear ? 700 : 400,
                      borderRadius: 6,
                      cursor: "pointer",
                      background: y === viewYear ? "var(--grn)" : "transparent",
                      color: y === viewYear ? "#fff" : "var(--ink2)",
                      border: y === viewYear ? "none" : "1px solid transparent",
                      transition: "background .1s, color .1s",
                    }}
                    onMouseEnter={(e) => {
                      if (y !== viewYear) {
                        e.currentTarget.style.background = "var(--s2)";
                        e.currentTarget.style.border = "1px solid var(--b1)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (y !== viewYear) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.border = "1px solid transparent";
                      }
                    }}
                  >
                    {y}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="cal-nav">
                <button
                  type="button"
                  className="cal-nav-btn"
                  onClick={prevMonth}
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => setMode("year")}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "var(--fn)",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--ink)",
                    padding: "3px 8px",
                    borderRadius: 6,
                    transition: "background .12s",
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--s2)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "none")
                  }
                >
                  {MONTHS_SHORT[viewMonth]} {viewYear}
                  <span style={{ fontSize: 9, color: "var(--ink3)" }}>▾</span>
                </button>
                <button
                  type="button"
                  className="cal-nav-btn"
                  onClick={nextMonth}
                >
                  ›
                </button>
              </div>
              <div className="cal-days-hdr">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                  <div key={d} className="cal-dh">
                    {d}
                  </div>
                ))}
              </div>
              <div className="cal-days">
                {cells.map((d, i) => {
                  const isFuture =
                    maxDate && d && new Date(viewYear, viewMonth, d) > maxDate;
                  return (
                    <div
                      key={i}
                      className={`cal-day ${!d ? "cal-day-empty" : ""} ${
                        isSelected(d) ? "cal-day-sel" : ""
                      } ${
                        isToday(d) && !isSelected(d) ? "cal-day-today" : ""
                      } ${isFuture ? "cal-day-empty" : ""}`}
                      onClick={() => !isFuture && pick(d)}
                      style={
                        isFuture
                          ? {
                              color: "var(--b2)",
                              cursor: "not-allowed",
                              opacity: 0.4,
                            }
                          : {}
                      }
                    >
                      {d || ""}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   PROVIDER POPUP DROPDOWNS
───────────────────────────────────────────────────────────────── */
function DropdownPortal({ triggerRef, open, children }) {
  const [style, setStyle] = useState({});
  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    setStyle(
      spaceBelow >= 200
        ? { top: r.bottom + 4, left: r.left, width: r.width }
        : {
            bottom: window.innerHeight - r.top + 4,
            left: r.left,
            width: r.width,
          }
    );
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="pop-dd-portal"
      style={{ ...style, position: "fixed" }}
      onWheel={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

function SelectField({
  label,
  placeholder,
  options,
  value,
  onChange,
  renderOption,
  renderSelected,
  disabled,
  loading,
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    const h = (e) => {
      if (
        wrapRef.current &&
        !wrapRef.current.contains(e.target) &&
        !e.target.closest(".pop-dd-portal")
      ) {
        setOpen(false);
        setQ("");
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (!open) return;
    const h1 = (e) => {
      const p = document.querySelector(".pop-dd-portal");
      if (p && p.contains(e.target)) return;
      setOpen(false);
      setQ("");
    };
    const h2 = () => {
      setOpen(false);
      setQ("");
    };
    window.addEventListener("scroll", h1, true);
    window.addEventListener("resize", h2);
    return () => {
      window.removeEventListener("scroll", h1, true);
      window.removeEventListener("resize", h2);
    };
  }, [open]);

  const filtered = options.filter((o) =>
    Object.values(o).join(" ").toLowerCase().includes(q.toLowerCase())
  );
  const pick = (opt) => {
    onChange(opt);
    setOpen(false);
    setQ("");
  };

  return (
    <div className="pop-field" ref={wrapRef}>
      <div className="pop-field-label">
        <span
          className="pop-field-label-dot"
          style={disabled ? { background: "var(--b2)" } : {}}
        />
        {label}
      </div>
      <div className="pop-select-wrap">
        <div
          ref={triggerRef}
          className={`pop-select-btn ${open ? "open" : ""} ${
            value ? "has-val" : ""
          } ${disabled ? "disabled-btn" : ""}`}
          onClick={() => {
            if (!disabled) setOpen((o) => !o);
          }}
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !disabled) setOpen((o) => !o);
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <span className="val-txt">
            {loading ? (
              <span style={{ color: "var(--ink4)", fontWeight: 400 }}>
                Loading…
              </span>
            ) : value ? (
              renderSelected ? (
                renderSelected(value)
              ) : (
                value.name
              )
            ) : (
              <span style={{ color: "var(--ink4)", fontWeight: 400 }}>
                {placeholder}
              </span>
            )}
          </span>
        </div>
        <span className={`pop-chevron ${open ? "up" : ""}`}>▾</span>
        <DropdownPortal triggerRef={triggerRef} open={open && !disabled}>
          <div className="pop-dd-search">
            <span className="pop-dd-search-ic">🔍</span>
            <input
              autoFocus
              placeholder="Search..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
          <div className="pop-dd-list">
            {loading ? (
              <div className="pop-dd-loading">
                <span className="spin">⟳</span> Loading…
              </div>
            ) : filtered.length === 0 ? (
              <div className="pop-dd-empty">No results found</div>
            ) : (
              filtered.map((opt) =>
                renderOption(opt, pick, value?.id === opt.id)
              )
            )}
          </div>
        </DropdownPortal>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   PATIENT CUSTOM DROPDOWN
───────────────────────────────────────────────────────────────── */
function PatientDropdown({
  patients,
  value,
  onChange,
  error,
  onNewPatient,
  onViewPatient,
  showActions = true,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    const h = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus();
  }, [open]);

  const filtered = patients.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase())
  );
  const selected = patients.find((p) => String(p.id) === String(value));

  const pick = (p) => {
    onChange(p.id);
    setOpen(false);
    setQuery("");
  };
  const clear = (e) => {
    e.stopPropagation();
    onChange("");
  };

  return (
    <div className="pat-row">
      <div className="pat-dd-wrap" ref={wrapRef}>
        <button
          type="button"
          className={`pat-dd-trigger ${open ? "open" : ""} ${
            value ? "has-val" : ""
          }`}
          style={
            error
              ? {
                  borderColor: "#ef4444",
                  boxShadow: "0 0 0 3px rgba(239,68,68,.1)",
                }
              : {}
          }
          onClick={() => setOpen((o) => !o)}
        >
          <span className="pat-dd-trigger-txt">
            {selected ? (
              selected.name
            ) : (
              <span style={{ color: "var(--ink4)", fontWeight: 400 }}>
                Select Patient…
              </span>
            )}
          </span>
        </button>
        {value && (
          <button
            type="button"
            className="pat-dd-clear"
            onClick={clear}
            title="Clear"
          >
            ✕
          </button>
        )}
        <span className={`pat-dd-chev ${open ? "up" : ""}`}>▾</span>
        {open && (
          <div className="pat-dd-panel">
            <div className="pat-dd-search-row">
              <span style={{ fontSize: 13, color: "var(--ink3)" }}>🔍</span>
              <input
                ref={searchRef}
                placeholder="Search patient…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
            <div className="pat-dd-list">
              {filtered.length === 0 ? (
                <div className="pat-dd-empty">No patients found</div>
              ) : (
                filtered.map((p) => {
                  const details = [p.dob, p.phone]
                    .filter(Boolean)
                    .join("  ·  ");
                  return (
                    <div
                      key={p.id}
                      className={`pat-dd-item ${
                        p.id === value ? "active" : ""
                      }`}
                      onClick={() => pick(p)}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 2,
                          minWidth: 0,
                          flex: 1,
                          overflow: "hidden",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: "var(--ink)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: "100%",
                          }}
                        >
                          {p.name}
                        </span>
                        {details && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 400,
                              color: "var(--ink4)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: "100%",
                            }}
                          >
                            {details}
                          </span>
                        )}
                      </div>
                      {p.id === value && (
                        <span
                          style={{
                            marginLeft: "auto",
                            color: "var(--grn)",
                            fontSize: 13,
                            flexShrink: 0,
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
        {showActions && (
          <button
            type="button"
            className="btn-edit-pat pat-dd-edit"
            onClick={() => selected && onViewPatient?.(selected)}
            disabled={!selected || !onViewPatient}
            title={selected ? "Edit patient details" : "Select a patient first"}
          >
            ✎
          </button>
        )}
      </div>
      {showActions && (
        <button
          type="button"
          className="btn-new-pat"
          onClick={onNewPatient}
          title="Create a new patient"
        >
          ＋ New
        </button>
      )}
    </div>
  );
}
function HealthFundDropdown({
  funds,
  value,
  onChange,
  error,
  disabled,
  placeholder = "Select Payer…",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    const h = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus();
  }, [open]);

  const filtered = funds.filter((f) =>
    f.name.toLowerCase().includes(query.toLowerCase())
  );
  const selected = funds.find((f) => f.id === value);

  const pick = (f) => {
    onChange(f.id);
    setOpen(false);
    setQuery("");
  };
  const clear = (e) => {
    e.stopPropagation();
    onChange("");
  };

  return (
    <div className="pat-dd-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`pat-dd-trigger ${open ? "open" : ""} ${
          value ? "has-val" : ""
        }`}
        style={
          error
            ? {
                borderColor: "#ef4444",
                boxShadow: "0 0 0 3px rgba(239,68,68,.1)",
              }
            : {}
        }
        onClick={() => {
          if (!disabled) setOpen((o) => !o);
        }}
        disabled={disabled}
      >
        <span className="pat-dd-trigger-txt">
          {selected ? (
            selected.name
          ) : (
            <span style={{ color: "var(--ink4)", fontWeight: 400 }}>
              {disabled ? "Select patient first…" : placeholder}
            </span>
          )}
        </span>
      </button>
      {value && !disabled && (
        <button
          type="button"
          className="pat-dd-clear"
          onClick={clear}
          title="Clear"
        >
          ✕
        </button>
      )}
      <span className={`pat-dd-chev ${open ? "up" : ""}`}>▾</span>
      {open && !disabled && (
        <div className="pat-dd-panel">
          <div className="pat-dd-search-row">
            <span style={{ fontSize: 13, color: "var(--ink3)" }}>🔍</span>
            <input
              ref={searchRef}
              placeholder="Search payer…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
          <div className="pat-dd-list">
            {filtered.length === 0 ? (
              <div className="pat-dd-empty">No payers found</div>
            ) : (
              filtered.map((f) => (
                <div
                  key={f.id}
                  className={`pat-dd-item ${f.id === value ? "active" : ""}`}
                  onClick={() => pick(f)}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      color: "var(--ink)",
                      fontSize: 12.5,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {f.name}
                  </span>
                  {f.id === value && (
                    <span
                      style={{
                        marginLeft: "auto",
                        color: "var(--grn)",
                        fontSize: 13,
                        flexShrink: 0,
                      }}
                    >
                      ✓
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
/* ─────────────────────────────────────────────────────────────────
   ITEM SEARCH DROPDOWN — async, debounced, server-side search.
   Does NOT preload any item list. Only fetches matches once the
   user has typed at least 2 characters, via searchItems().
───────────────────────────────────────────────────────────────── */
function ItemSearchDropdown({
  value,
  label,
  onChange,
  error,
  placeholder = "Search item number…",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewItems, setPreviewItems] = useState([]); // ← NEW
  const [previewLoading, setPreviewLoading] = useState(false); // ← NEW
  const previewLoadedRef = useRef(false); // ← NEW — fetch only once per dropdown instance
  const wrapRef = useRef(null);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    const h = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus();
  }, [open]);

  // NEW — load first 200 items once, the first time the dropdown is opened
  useEffect(() => {
    if (!open || previewLoadedRef.current) return;
    previewLoadedRef.current = true;
    setPreviewLoading(true);
    (async () => {
      try {
        const items = isZohoAvailable() ? await loadItemsPreview(200) : [];
        setPreviewItems(items);
      } catch (err) {
        console.warn("[ItemSearchDropdown] preview load failed", err);
        setPreviewItems([]);
      } finally {
        setPreviewLoading(false);
      }
    })();
  }, [open]);

  // Debounced search — waits 300ms after typing stops, ignores stale responses.
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const myReqId = ++reqIdRef.current;
    debounceRef.current = setTimeout(async () => {
      try {
        const items = isZohoAvailable()
          ? await searchItems(query.trim(), 50)
          : [];
        if (reqIdRef.current === myReqId) setResults(items);
      } catch (err) {
        console.warn("[ItemSearchDropdown] search failed", err);
        if (reqIdRef.current === myReqId) setResults([]);
      } finally {
        if (reqIdRef.current === myReqId) setLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query, open]);

  const pick = (item) => {
    onChange(item);
    setOpen(false);
    setQuery("");
    setResults([]);
  };
  const clear = (e) => {
    e.stopPropagation();
    onChange(null);
  };

  // NEW — decide what list to render: search results once typing starts, else the preview list
  const isSearching = query.trim().length >= 2;
  const listToShow = isSearching ? results : previewItems;
  const listLoading = isSearching ? loading : previewLoading;

  return (
    <div className="pat-dd-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`pat-dd-trigger ${open ? "open" : ""} ${
          value ? "has-val" : ""
        }`}
        style={
          error
            ? {
                borderColor: "#ef4444",
                boxShadow: "0 0 0 3px rgba(239,68,68,.1)",
              }
            : {}
        }
        onClick={() => setOpen((o) => !o)}
      >
        <span className="pat-dd-trigger-txt">
          {value ? (
            label || value
          ) : (
            <span style={{ color: "var(--ink4)", fontWeight: 400 }}>
              {placeholder}
            </span>
          )}
        </span>
      </button>
      {value && (
        <button
          type="button"
          className="pat-dd-clear"
          onClick={clear}
          title="Clear"
        >
          ✕
        </button>
      )}
      <span className={`pat-dd-chev ${open ? "up" : ""}`}>▾</span>
      {open && (
        <div className="pat-dd-panel">
          <div className="pat-dd-search-row">
            <span style={{ fontSize: 13, color: "var(--ink3)" }}>🔍</span>
            <input
              ref={searchRef}
              placeholder="Type to search item numbers…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
          <div className="pat-dd-list">
            {listLoading ? (
              <div
                className="pat-dd-empty"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <span className="spin">⟳</span>{" "}
                {isSearching ? "Searching…" : "Loading items…"}
              </div>
            ) : listToShow.length === 0 ? (
              <div className="pat-dd-empty">No items found</div>
            ) : (
              listToShow.map((item) => (
                <div
                  key={item.id}
                  className={`pat-dd-item ${item.id === value ? "active" : ""}`}
                  onClick={() => pick(item)}
                  style={{ alignItems: "flex-start" }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      minWidth: 0,
                      flex: 1,
                      overflow: "hidden",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        color: "var(--ink)",
                        fontSize: 13,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.name}
                    </span>
                    {item.description && (
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 400,
                          color: "var(--ink3)",
                          lineHeight: 1.4,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {item.description}
                      </span>
                    )}
                  </div>
                  {item.id === value && (
                    <span
                      style={{
                        marginLeft: "auto",
                        color: "var(--grn)",
                        fontSize: 13,
                        flexShrink: 0,
                        paddingTop: 2,
                      }}
                    >
                      ✓
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
function ItemDropdown(props) {
  return (
    <HealthFundDropdown
      {...props}
      placeholder={props.placeholder || "Select item…"}
    />
  );
}
// Add once, near the top of CreatePatientPopup (or module scope)
const extractLookupId = (src) => {
  if (!src) return "";
  const s = Array.isArray(src) ? src[0] : src;
  if (s == null) return "";
  return typeof s === "object"
    ? String(s.ID ?? s.id ?? s.Payer_Insurer ?? s.Name ?? "").trim()
    : String(s).trim();
};
/* Payer names that must NEVER appear in the Health Fund / Work Cover
   table — these are handled by their own dedicated cards/sections. */
const EXCLUDED_HF_PAYER_NAMES = ["medicare", "department of veterans affairs", "patient"];

function isHealthFundPayer(payerId, funds) {
  if (!payerId) return true; // no payer yet — allow, will get filtered once selected
  const fund = funds.find(pf => String(pf.id) === String(payerId));
  if (!fund) return true; // funds not loaded yet — don't drop rows prematurely
  return !EXCLUDED_HF_PAYER_NAMES.includes(fund.name.trim().toLowerCase());
}
/* ══════════════════════════════════════════════════════════════════
   DROP-IN REPLACEMENT — CreatePatientPopup  (v2 — matches the target
   screenshot: numbered sections, Medicare / DVA / Health Fund cards,
   Health Fund table with Add/Edit/Delete, "Who Is Paying" radio row)
   ---------------------------------------------------------
   HOW TO APPLY
   1. In MediElves_Claims.jsx, delete your entire current
      `function CreatePatientPopup(...) {...}` block (the one that
      starts with the big "DROP-IN REPLACEMENT — CreatePatientPopup"
      comment) and paste this whole file in its place.
   2. Nothing else in the app needs to change. This still uses the
      same helpers already defined earlier in your file:
      isZohoAvailable, loadHealthFunds, createPatientRecord,
      updatePatientRecord, parseDate, formatDateZoho, DatePicker,
      HealthFundDropdown.

   WHAT'S THE SAME (functionality preserved)
   - Same props: { patient, onClose, onCreated, onSaved }
   - Same required fields: First Name, Last Name, Phone
   - Same payload shape sent to createPatientRecord/updatePatientRecord
     (firstName, lastName, dateOfBirth, gender, age, email,
     addressLine1/2, city, state, postalCode, country, phone,
     emergencyContactName/Phone, medicareEnabled/medicare/medicareIRN,
     healthFundEnabled/payerId/healthFundIds/membershipNumber,
     dvaEnabled/dvaNumber, patientStatus)
   - Same edit-mode detection (isEditMode = !!patient) and the same
     mapPatientToForm() reverse-mapping for editing an existing patient

   WHAT CHANGED (visual only, plus one small additive field)
   - Layout now matches the screenshot: 3 numbered sections
     (Patient Details / Payer Information / Who Is Paying The Invoice)
   - Medicare & DVA are now simple inline-field cards (no separate
     enable checkbox) — they're treated as "enabled" automatically
     when their number field has a value, so behavior is unchanged,
     just the UI is simpler and matches the screenshot.
   - Health Fund / Work Cover is now a small table (Payer/Insurer,
     Type, Membership No., Actions) with a "+ Add New" button that
     opens an inline mini-form. The data model still only tracks one
     fund (payerType / healthFundId / membershipNumber), so the
     table shows at most one row — Edit/Delete act on that one entry.
   - Added a "Who Is Paying The Invoice?" radio row (Medicare / DVA /
     Health Fund / Work Cover / Patient Self Pay), purely additive —
     stored as `whoIsPaying` and now included in the save payload.
     Nothing existing reads or requires it, so it can't break anything
     already wired up server-side; drop the line in handleSave's
     payload if you'd rather not send it yet.
══════════════════════════════════════════════════════════════════ */

function CreatePatientPopup({ patient, onClose, onCreated, onSaved,  forClaim = false, 
  onClaimPayerSelected,}) {
  const isEditMode = !!patient;

  const initialFormState = {
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    age: "",
    email: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "Australia",
    phone: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    // ── Payer Information ──
    medicareEnabled: false,
    medicareNumber: "",
    medicareIRN: "",
    healthFundEnabled: false,
    healthFundId: "", // holds the SELECTED ROW ID from healthFundRows, not a payer lookup ID
    dvaEnabled: false,
    dvaNumber: "",
  };

  const mapPatientToForm = (raw) => {
    if (!raw) return { ...initialFormState };
    const rawName =
      raw.firstName ??
      raw.first_name ??
      raw.name ??
      raw.Patient_Name ??
      raw.Name ??
      "";
    let firstName = "";
    let lastName = "";
    if (typeof rawName === "object") {
      firstName = String(
        rawName.first_name ?? rawName.firstName ?? rawName.First_Name ?? ""
      ).trim();
      lastName = String(
        rawName.last_name ?? rawName.lastName ?? rawName.Last_Name ?? ""
      ).trim();
    } else {
      const parts = String(rawName).trim().split(/\s+/).filter(Boolean);
      firstName = parts.shift() || "";
      lastName = parts.join(" ");
    }
    const address = raw.address ?? raw.Address ?? raw["Address"] ?? {};

    const healthFundId = (() => {
      const src =
        raw.healthFundId ??
        raw.healthFund_id ??
        raw.Health_Fund_Id ??
        raw.Health_Fund_Work_cover_Name ??
        raw.Health_Fund_Work_Cover_Name ??
        raw.Health_Fund_Name ??
        raw.Health_Fund;
      if (!src) return "";
      const s = Array.isArray(src) ? src[0] : src;
      return typeof s === "object"
        ? String(s.ID ?? s.id ?? "").trim()
        : String(s).trim();
    })();

    const payerTypeId = (() => {
      const src =
        raw.payerType ??
        raw.Payer_Type ??
        raw.payerId ??
        raw.Payer ??
        raw.payer;
      if (!src) return "";
      const s = Array.isArray(src) ? src[0] : src;
      return typeof s === "object"
        ? String(s.ID ?? s.id ?? "").trim()
        : String(s).trim();
    })();

    return {
      ...initialFormState,
      firstName,
      lastName,
      dateOfBirth: String(
        raw.dateOfBirth ??
          raw.date_of_birth ??
          raw.Date_of_Birth ??
          raw.DOB ??
          raw.dob ??
          ""
      ),
      gender: String(raw.gender ?? raw.Gender ?? ""),
      age: String(raw.age ?? raw.Patient_Age ?? raw.Patient_Age__c ?? ""),
      email: String(raw.email ?? raw.Email ?? ""),
      addressLine1: String(
        address.address_line_1 ??
          address.address_line1 ??
          address.Address_Line_1 ??
          address.line1 ??
          ""
      ),
      addressLine2: String(
        address.address_line_2 ??
          address.address_line2 ??
          address.Address_Line_2 ??
          address.line2 ??
          ""
      ),
      city: String(
        address.district_city ?? address.city ?? address.District_City ?? ""
      ),
      state: String(
        address.state_province ?? address.state ?? address.State_Province ?? ""
      ),
      postalCode: String(
        address.postal_code ?? address.postalCode ?? address.Postal_Code ?? ""
      ),
      country: String(address.country ?? address.Country ?? "Australia"),
      phone: String(raw.phone ?? raw.Mobile ?? raw.mobile ?? raw.Phone ?? ""),
      emergencyContactName: String(
        raw.emergencyContactName ??
          raw.emergency_contact_name ??
          raw.Emergency_Contact_Name ??
          ""
      ),
      emergencyContactPhone: String(
        raw.emergencyContactPhone ??
          raw.emergency_contact_phone ??
          raw.Emergency_Contact_Phone ??
          ""
      ),

      medicareEnabled: Boolean(
        raw.medicareEnabled ??
          raw.Medicare_Enabled ??
          (raw.medicare || raw.Medicare)
      ),
      medicareNumber: String(
        raw.medicare ?? raw.Medicare ?? raw.Medicare_Number ?? ""
      ),
      medicareIRN: String(
        raw.medicareIRN ??
          raw.Medicare_IRN ??
          raw.IRN ??
          raw.Individual_Reference_Number ??
          ""
      ),
      healthFundEnabled: Boolean(
        raw.healthFundEnabled ??
          raw.Health_Fund_Enabled ??
          healthFundId ??
          payerTypeId
      ),
      healthFundId: "", // resolved separately once healthFundRows/patientFunds have loaded — see the "re-derive" effect below
      dvaEnabled: Boolean(
        raw.dvaEnabled ??
          raw.DVA_Enabled ??
          raw.dvaNumber ??
          raw.DVA_Number ??
          raw.Veteran_Affairs ??
          raw.veteran_affairs
      ),
      dvaNumber: String(
        raw.dvaNumber ??
          raw.DVA_Number ??
          raw.Veteran_Affairs ??
          raw.veteran_affairs ??
          ""
      ),
    };
  };

  const [f, setF] = useState(mapPatientToForm(patient));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [patientFunds, setPatientFunds] = useState([]);

  // NEW — purely additive: who pays the invoice for this patient
  const [whoIsPaying, setWhoIsPaying] = useState(
    String(patient?.whoIsPaying ?? patient?.Who_Is_Paying ?? "") || ""
  );

  // NEW — Health Fund / Work Cover is now a LIST of records, not a single one.
  const buildInitialHFRows = (raw) => {
    if (!raw) return [];
    const multi = raw.healthFundRecords ?? raw.Health_Fund_Records ?? null;
    if (Array.isArray(multi) && multi.length) {
      return multi
        .map((r, i) => ({
          rowId: `hf-${i}-${Date.now()}`,
          payerId: extractLookupId(r.payerId ?? r.Payer_Insurer ?? r.payerType),
          type: String(r.type ?? r.Type ?? "Health Fund"),
          membershipNumber: String(
            r.membershipNumber ?? r.Membership_Number ?? ""
          ),
          additionalDetails: String(
            r.additionalDetails ?? r.Additional_Details ?? ""
          ),
        }))
        // Medicare / DVA / Patient (Self Pay) belong to their own cards,
        // not the Health Fund / Work Cover table.
        .filter((row) => isHealthFundPayer(row.payerId, patientFunds));
    }
    // Backward-compat — old patients only ever had one fund on the old single fields
    const legacyPayerId = extractLookupId(
      raw.payerType ?? raw.Payer_Type ?? raw.payerId ?? raw.Payer ?? raw.payer
    );
    const legacyMembership = String(
      raw.membershipNumber ??
        raw.Membership_Number ??
        raw.membership_number ??
        ""
    ).trim();
    if (
      (legacyPayerId || legacyMembership) &&
      isHealthFundPayer(legacyPayerId, patientFunds)
    ) {
      return [
        {
          rowId: `hf-legacy-${Date.now()}`,
          payerId: legacyPayerId,
          type: String(raw.hfType ?? raw.Type ?? "Health Fund"),
          membershipNumber: legacyMembership,
          additionalDetails: String(
            raw.hfAdditionalDetails ?? raw.Additional_Details ?? ""
          ),
        },
      ];
    }
    return [];
  };

  const [healthFundRows, setHealthFundRows] = useState(() =>
    buildInitialHFRows(patient)
  );
  const [editingRowId, setEditingRowId] = useState(null); // rowId currently being edited inline, or null
  const [rowBackup, setRowBackup] = useState(null); // snapshot of a row before editing, for Cancel

  useEffect(() => {
    if (patient)
      console.log(
        "[CreatePatientPopup] raw patient record keys:",
        Object.keys(patient),
        JSON.stringify(patient)
      );
    setF(mapPatientToForm(patient));
    setWhoIsPaying(
      String(patient?.whoIsPaying ?? patient?.Who_Is_Paying ?? "") || ""
    );
    setHealthFundRows(buildInitialHFRows(patient));
    setEditingRowId(null);
    setRowBackup(null);
    setErrors({});
  }, [patient]);

  useEffect(() => {
    let cancelled = false;
    if (isZohoAvailable()) {
      loadHealthFunds()
        .then((funds) => {
          if (!cancelled) setPatientFunds(funds);
        }) // ❌ setPatientFunds doesn't exist here
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, []);
    /* Once patientFunds finishes loading, re-check every Health Fund /
     Work Cover row: if a row's payer turns out to be Medicare, DVA,
     or Patient (Self Pay) — e.g. legacy data saved under the generic
     Payer field — drop it from this table. */
  useEffect(() => {
    if (!patientFunds.length) return;
    setHealthFundRows((rows) =>
      rows.filter((row) => isHealthFundPayer(row.payerId, patientFunds))
    );
  }, [patientFunds]);

  // NEW — re-derive "Who Is Paying" on edit, once patientFunds + healthFundRows have loaded,
  // by matching the FIRST row's payer back to a fund name.
  useEffect(() => {
    if (!patient || patientFunds.length === 0 || healthFundRows.length === 0)
      return;
    if (whoIsPaying) return; // don't override an explicit selection made this session

    const firstRow = healthFundRows[0];
    const matchedFund = patientFunds.find(
      (pf) => String(pf.id) === String(firstRow.payerId)
    );
    if (!matchedFund) return;

    const name = matchedFund.name.trim().toLowerCase();
    if (name === "medicare") {
      setWhoIsPaying("Medicare");
    } else if (name === "department of veterans affairs") {
      setWhoIsPaying("DVA");
    } else if (name === "patient") {
      setWhoIsPaying("SelfPay");
    } else {
      setWhoIsPaying("HealthFund");
      setF((x) => ({ ...x, healthFundId: firstRow.rowId }));
    }
  }, [patient, patientFunds, healthFundRows]);

  const upd = (k, v) => {
    if (k === "dateOfBirth") {
      const d = parseDate(v);
      let ageVal = "";
      if (d instanceof Date && !isNaN(d)) {
        const today = new Date();
        let years = today.getFullYear() - d.getFullYear();
        const m = today.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < d.getDate())) years--;
        ageVal = String(Math.max(0, years));
      }
      setF((x) => ({ ...x, dateOfBirth: v, age: ageVal }));
      if (errors.dateOfBirth || errors.age)
        setErrors((x) => ({ ...x, dateOfBirth: "", age: "" }));
    } else {
      setF((x) => ({ ...x, [k]: v }));
    }
    if (errors[k]) setErrors((x) => ({ ...x, [k]: "" }));
  };

  // ... rest of the component (validate, handleSave, render, etc.) stays exactly as you already have it

  const validate = () => {
    const e = {};
    if (!f.firstName.trim()) e.firstName = "Required";
    if (!f.lastName.trim()) e.lastName = "Required";
    // if (!f.phone.trim())     e.phone     = "Required";
    // if (!f.dateOfBirth.trim()) e.dateOfBirth = "Required";
    if (!f.addressLine1.trim()) e.addressLine1 = "Required";
    if (!f.city.trim()) e.city = "Required";
    if (!f.state.trim()) e.state = "Required";
    if (!f.postalCode.trim()) e.postalCode = "Required";
    if (!f.country.trim()) e.country = "Required";

    if (f.medicareNumber.trim() && !/^\d{10}$/.test(f.medicareNumber.trim())) {
      e.medicareNumber = "Medicare Number must be exactly 10 digits";
    }

    if (!whoIsPaying) {
      e.whoIsPaying = "Please select who is paying the invoice";
    } else if (whoIsPaying === "Medicare") {
      if (!f.medicareNumber.trim())
        e.medicareNumber = "Medicare Number is required";
    } else if (whoIsPaying === "DVA") {
      if (!f.dvaNumber.trim()) e.dvaNumber = "DVA Number is required";
    } else if (whoIsPaying === "HealthFund") {
      if (healthFundRows.length === 0)
        e.healthFundId = "Add a Health Fund / Work Cover record first";
      else if (!f.healthFundId)
        e.healthFundId = "Select a Health Fund / Work Cover record below";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };
const handleSave = async () => {
  if (!validate()) return;

  // NEW — claim-only payer mode: don't persist Who Is Paying to the patient.
  if (forClaim) {
    const selectedHFRow =
      healthFundRows.find((r) => r.rowId === f.healthFundId) || null;

    const findFundIdByName = (name) => {
      const match = patientFunds.find(
        (pf) => (pf.name || "").trim().toLowerCase() === name.toLowerCase()
      );
      return match ? match.id : "";
    };

    let payerId = "";
    let payerName = "";
    let membershipNumber = "";
    let isMedicare = false;

    if (whoIsPaying === "Medicare") {
      payerId = findFundIdByName("Medicare");
      payerName = "Medicare";
      membershipNumber = f.medicareNumber.trim();
      isMedicare = true;
    } else if (whoIsPaying === "DVA") {
      payerId = findFundIdByName("Department of Veterans Affairs");
      payerName = "Department of Veterans Affairs";
      membershipNumber = f.dvaNumber.trim();
    } else if (whoIsPaying === "SelfPay") {
      payerId = findFundIdByName("Patient");
      payerName = "Patient";
    } else if (whoIsPaying === "HealthFund" && selectedHFRow) {
      payerId = selectedHFRow.payerId;
      payerName = fundName(selectedHFRow.payerId);
      membershipNumber = selectedHFRow.membershipNumber.trim();
    }

    onClaimPayerSelected?.({
      payerId,
      payerName,
      membershipNumber,
      isMedicare,
    });
    onClose(); // close popup — nothing written to the patient record
    return;
  }

    setSaving(true);
    const rawPhone = f.phone.trim().replace(/\s+/g, "");
    const auPhone = rawPhone.startsWith("+")
      ? rawPhone
      : rawPhone.startsWith("0")
      ? "+61" + rawPhone.slice(1)
      : "+61" + rawPhone;

    // Auto-derive the "enabled" flags from whether the fields actually have data —
    // same effect as the old explicit checkboxes, just no checkbox in the UI now.
    const medicareOn = Boolean(f.medicareNumber.trim());
    const dvaOn = Boolean(f.dvaNumber.trim());
    const selectedHFRow =
      healthFundRows.find((r) => r.rowId === f.healthFundId) || null;
    const hfOn = Boolean(selectedHFRow);

    try {
      const payload = {
        firstName: f.firstName.trim(),
        lastName: f.lastName.trim(),
        dateOfBirth: f.dateOfBirth,
        gender: f.gender,
        age: (() => {
          const n = Number(String(f.age || "").trim());
          return isNaN(n) ? 0 : n;
        })(),
        email: f.email.trim() || undefined,
        addressLine1: f.addressLine1.trim(),
        addressLine2: f.addressLine2.trim(),
        city: f.city.trim(),
        state: f.state.trim(),
        postalCode: f.postalCode.trim(),
        country: f.country.trim(),
        phone: auPhone,
        emergencyContactName: f.emergencyContactName.trim() || undefined,
        emergencyContactPhone: f.emergencyContactPhone.trim() || undefined,
        patientStatus: "Active",

        // Payer Information
        medicareEnabled: medicareOn,
        medicare: medicareOn ? f.medicareNumber.trim() : "",
        medicareIRN: medicareOn ? f.medicareIRN.trim() : "",

        healthFundEnabled: hfOn,
        payerId: (() => {
          const findFundIdByName = (name) => {
            const match = patientFunds.find(
              (f) => (f.name || "").trim().toLowerCase() === name.toLowerCase() // guard added
            );
            return match ? match.id : "";
          };

          if (whoIsPaying === "Medicare") return findFundIdByName("Medicare");
          if (whoIsPaying === "DVA")
            return findFundIdByName("Department of Veterans Affairs");
          if (whoIsPaying === "SelfPay") return findFundIdByName("Patient");
          if (whoIsPaying === "HealthFund") return selectedHFRow?.payerId || "";
          return "";
        })(),
        healthFundIds: selectedHFRow?.payerId || "",
        membershipNumber: selectedHFRow?.membershipNumber.trim() || "",
        hfType: selectedHFRow?.type.trim() || "",
        hfAdditionalDetails: selectedHFRow?.additionalDetails.trim() || "",
        // Every row, so nothing is lost even though only one is "selected" as payer.
        // Drop this line if there's no matching field on the Zoho form.
        healthFundRecords: JSON.stringify(
          healthFundRows.map(({ rowId, ...rest }) => rest)
        ),

        dvaEnabled: dvaOn,
        dvaNumber: dvaOn ? f.dvaNumber.trim() : "",

        whoIsPaying, // additive — safe to ignore server-side if not wired up yet
      };

      if (isZohoAvailable()) {
        if (isEditMode) {
          console.log("[CreatePatientPopup] update payload:", payload);
          const result = await updatePatientRecord({
            id: patient.id,
            ...payload,
          });
          if (result.success) {
            onSaved?.({
              id: String(patient.id || result.recordId || ""),
              name: `${f.firstName.trim()} ${f.lastName.trim()}`,
              dob: f.dateOfBirth,
              phone: auPhone,
              // FIX: was f.membershipNumber (doesn't exist on `f`) — use the selected row's value
              Membership_Number: hfOn
                ? (selectedHFRow?.membershipNumber || "").trim()
                : "",
              membershipNumber: hfOn
                ? (selectedHFRow?.membershipNumber || "").trim()
                : "",
            });
            onClose();
          } else {
            setErrors({ api: "Failed to save patient in Zoho." });
          }
        } else {
          const result = await createPatientRecord(payload);
          if (result.success) {
            onCreated?.({
              id: String(result.recordId || Date.now()),
              name: `${f.firstName.trim()} ${f.lastName.trim()}`,
            });
            onClose();
          } else {
            setErrors({ api: "Failed to create patient in Zoho." });
          }
        }
      } else {
        const fallbackPayload = {
          name: `${f.firstName.trim()} ${f.lastName.trim()}`,
          dob: f.dateOfBirth,
          phone: auPhone,
          // FIX: same corrected source
          Membership_Number: hfOn
            ? (selectedHFRow?.membershipNumber || "").trim()
            : "",
          membershipNumber: hfOn
            ? (selectedHFRow?.membershipNumber || "").trim()
            : "",
        };
        if (isEditMode) {
          onSaved?.({ id: String(patient.id || ""), ...fallbackPayload });
        } else {
          onCreated?.({
            id: `PAT-${Date.now().toString().slice(-5)}`,
            ...fallbackPayload,
          });
        }
        onClose();
      }
    } catch (err) {
      console.error(err);
      setErrors({ api: "Unexpected error." });
    } finally {
      setSaving(false);
    }
  };

  const errTip = (k) =>
    errors[k] ? <span className="ptd-err-tip">{errors[k]}</span> : null;
  const fi = (k, cls = "ptd-input", props = {}) => (
    <input
      className={`${cls}${errors[k] ? " err" : ""}`}
      value={f[k]}
      onChange={(e) => upd(k, e.target.value)}
      {...props}
    />
  );

  const fundName = (id) =>
    patientFunds.find((x) => String(x.id) === String(id))?.name || id || "";
    // Only real health-fund / work-cover payers can be picked here —
  // Medicare, DVA, and Patient (Self Pay) each have their own card.
  const healthFundOnlyFunds = patientFunds.filter(
    (f) => !EXCLUDED_HF_PAYER_NAMES.includes((f.name || "").trim().toLowerCase())
  );

  const isWhoIsPayingEnabled = (id) => {
    if (id === "SelfPay") return true; // Patient — always selectable
    if (id === "Medicare") return f.medicareNumber.trim().length > 0;
    if (id === "DVA") return f.dvaNumber.trim().length > 0;
    if (id === "HealthFund")
      return healthFundRows.some((r) => r.payerId && r.membershipNumber.trim());
    return true;
  };

  // Show the Health Fund / Work Cover table whenever the patient has
  // records, regardless of which payer is selected in "Who Is Paying
  // The Invoice?" — Medicare / DVA / Patient (Self Pay) no longer hide it.
  const showHealthFundTable = healthFundRows.length > 0;

  // Auto-deselect if the underlying data is cleared after selection
  useEffect(() => {
    if (whoIsPaying === "Medicare" && !f.medicareNumber.trim())
      setWhoIsPaying("");
    if (whoIsPaying === "DVA" && !f.dvaNumber.trim()) setWhoIsPaying("");
    if (
      whoIsPaying === "HealthFund" &&
      !healthFundRows.some((r) => r.payerId && r.membershipNumber.trim())
    ) {
      setWhoIsPaying("");
    }
  }, [f.medicareNumber, f.dvaNumber, healthFundRows]);

  // Every completed row, as "Fund Name – Membership No. X", for the
  // "Select Health Fund / Work Cover" dropdown in Section 3.
  const hfSelectFunds = healthFundRows
    .filter((r) => r.payerId && r.membershipNumber.trim())
    .map((r) => ({
      id: r.rowId,
      name: `${fundName(r.payerId)}${
        r.membershipNumber ? ` – Membership No. ${r.membershipNumber}` : ""
      }`,
    }));

  // ── Row management for the Health Fund / Work Cover table ──
  const addHFRow = () => {
    const rowId = `hf-new-${Date.now()}`;
    setHealthFundRows((rows) => [
      ...rows,
      {
        rowId,
        payerId: "",
        type: "Health Fund",
        membershipNumber: "",
        additionalDetails: "",
      },
    ]);
    setRowBackup(null);
    setEditingRowId(rowId);
    // Blank out "Who Is Paying" while a new Health Fund / Work Cover
    // row is being created, so no stale selection (e.g. Medicare)
    // stays visibly highlighted during creation.
    setWhoIsPaying("");
  };

  const editHFRow = (rowId) => {
    const row = healthFundRows.find((r) => r.rowId === rowId);
    setRowBackup(row ? { ...row } : null);
    setEditingRowId(rowId);
  };

  const updateHFRow = (rowId, key, val) =>
    setHealthFundRows((rows) =>
      rows.map((r) => (r.rowId === rowId ? { ...r, [key]: val } : r))
    );

  const cancelHFRow = (rowId) => {
    if (rowBackup && rowBackup.rowId === rowId) {
      // was editing an existing row — restore it
      setHealthFundRows((rows) =>
        rows.map((r) => (r.rowId === rowId ? rowBackup : r))
      );
    } else {
      // was adding a brand-new row — remove it
      setHealthFundRows((rows) => rows.filter((r) => r.rowId !== rowId));
    }
    setRowBackup(null);
    setEditingRowId(null);
  };

  const saveHFRow = (rowId) => {
    const row = healthFundRows.find((r) => r.rowId === rowId);
    if (!row || !row.payerId || !row.membershipNumber.trim()) return;
    setRowBackup(null);
    setEditingRowId(null);
  };

  const deleteHFRow = (rowId) => {
    setHealthFundRows((rows) => rows.filter((r) => r.rowId !== rowId));
    if (editingRowId === rowId) setEditingRowId(null);
    if (f.healthFundId === rowId) {
      setF((x) => ({ ...x, healthFundId: "" }));
      if (whoIsPaying === "HealthFund") setWhoIsPaying("");
    }
  };

  const WHO_IS_PAYING_OPTIONS = [
    {
      id: "Medicare",
      label: "Medicare",
      sub: "Claims paid by Medicare",
      icon: "medicare",
      clr: "#16a34a",
    },
    {
      id: "DVA",
      label: "Veteran Affairs (DVA)",
      sub: "Claims paid by DVA",
      icon: "dva",
      clr: "#7c3aed",
    },
    {
      id: "HealthFund",
      label: "Health Fund / Work Cover",
      sub: "Claims paid by private health fund\nor Work Cover insurer",
      icon: "hf",
      clr: "#ea580c",
    },
    {
      id: "SelfPay",
      label: "Patient (Self Pay)",
      sub: "Patient will pay the invoice",
      icon: "user",
      clr: "#2563eb",
    },
  ];

  // Small inline icon set matching the screenshot's line-icon style
  const PIcon = ({ name, size = 18, color = "currentColor" }) => {
    const paths = {
      medicare: (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="M3 9h18" />
          <path d="M7 14h4" />
        </>
      ),
      dva: (
        <>
          <path d="M12 3l7 3v6c0 4.6-3 7.6-7 9-4-1.4-7-4.4-7-9V6l7-3Z" />
          <path d="M9.5 12l1.8 1.8L14.5 10" />
        </>
      ),
      hf: (
        <>
          <path d="M12 20s-7-4.4-9.3-8.8C1.3 8 3 5 6.1 5c1.9 0 3.3 1 4.4 2.4C11.6 6 13 5 14.9 5 18 5 19.7 8 18.3 11.2 16 15.6 12 20 12 20Z" />
        </>
      ),
      user: (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
        </>
      ),
      edit: (
        <>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </>
      ),
      trash: (
        <>
          <path d="M3 6h18" />
          <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
          <path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
          <path d="M10 11v6M14 11v6" />
        </>
      ),
      plus: <path d="M12 5v14M5 12h14" />,
      shield: (
        <>
          <path d="M12 3l7 3v6c0 4.6-3 7.6-7 9-4-1.4-7-4.4-7-9V6l7-3Z" />
          <path d="M9 12l2 2 4-4" />
        </>
      ),
      info: (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8h.01M11 12h1v5h1" />
        </>
      ),
    };
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ display: "block", flexShrink: 0 }}
      >
        {paths[name]}
      </svg>
    );
  };

  return (
    <div className="cpm-ov" onClick={onClose}>
      <style>{`
        /* ── Numbered section shell ── */
        .ptd-sec{margin-bottom:22px}
        .ptd-sec-hdr{display:flex;align-items:center;gap:10px;margin-bottom:2px}
        .ptd-badge{width:24px;height:24px;border-radius:50%;background:var(--acc);color:#fff;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .ptd-sec-title{font-size:14px;font-weight:800;letter-spacing:.4px;color:var(--ink);text-transform:uppercase}
        .ptd-sec-sub{font-size:11.5px;color:var(--ink3);margin:2px 0 14px 34px}

        /* ── Patient details panel ── */
        .ptd-panel{border:1.5px solid var(--b1);border-radius:14px;padding:22px 24px;background:#fff}
        .ptd-grid3{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:18px;margin-bottom:18px}
        .ptd-grid3:last-child{margin-bottom:0}
        .ptd-grid-3col{display:grid;grid-template-columns:1fr 1fr 1fr;gap:18px;margin-bottom:18px}
        .ptd-grid-5col{display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr;gap:18px;margin-bottom:18px}
        .ptd-grid-4col{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:18px;margin-bottom:18px}
        .ptd-field{display:flex;flex-direction:column;gap:7px;min-width:0}
.ptd-label{font-size:11.5px;font-weight:500;color:var(--ink);white-space:nowrap}        .ptd-label .req{color:#ef4444;margin-left:2px}
        .ptd-label .opt{font-size:10px;font-weight:400;color:var(--ink4);margin-left:4px}
        .ptd-input,.ptd-select{height:40px;padding:0 12px;background:#fff;border:1.5px solid var(--b1);border-radius:9px;font-family:var(--fn);font-size:13px;color:var(--ink);outline:none;transition:all .15s;width:100%;box-sizing:border-box}
        .ptd-input:focus,.ptd-select:focus{border-color:var(--acc);box-shadow:0 0 0 3px rgba(25,118,210,.1)}
        .ptd-input::placeholder{color:var(--ink4)}
        .ptd-input.err,.ptd-select.err{border-color:#ef4444;box-shadow:0 0 0 3px rgba(239,68,68,.1)}
        .ptd-err-tip{font-size:10px;color:#ef4444}
        .ptd-input[readonly]{background:#eef1f6;color:var(--ink3);cursor:not-allowed;border-color:var(--b1)}
        .ptd-panel .date-pick-wrap{width:100%}
        .ptd-panel .date-pick-btn{height:40px;box-sizing:border-box;padding:0 34px 0 12px;font-size:13px;border-radius:9px;font-family:var(--fn);display:flex;align-items:center}
        .ptd-panel .date-pick-ic{right:11px}
        .ptd-phone-wrap{display:flex;align-items:stretch;gap:0;height:40px}
        .ptd-phone-prefix{padding:0 11px;background:var(--s2);border:1.5px solid var(--b1);border-right:none;border-radius:9px 0 0 9px;font-family:var(--fn);font-size:12.5px;color:var(--ink2);font-weight:700;white-space:nowrap;display:flex;align-items:center;gap:4px;flex-shrink:0}
        .ptd-phone-input{flex:1;min-width:0;padding:0 11px;background:#fff;border:1.5px solid var(--b1);border-radius:0 9px 9px 0;font-family:var(--fn);font-size:13px;color:var(--ink);outline:none;transition:all .15s;box-sizing:border-box}
        .ptd-phone-input:focus{border-color:var(--acc);box-shadow:0 0 0 3px rgba(25,118,210,.1)}
        .ptd-phone-input.err{border-color:#ef4444}
        .ptd-panel .date-pick-btn{padding:10px 34px 10px 12px;font-size:13px;border-radius:9px;min-height:38px;font-family:var(--fn)}
        .ptd-panel .date-cal{width:260px}
/* ── Payer information cards ── */
.ptd-payer-grid{display:grid;grid-template-columns:0.62fr 0.62fr 1.76fr;gap:16px;align-items:start}
.ptd-card{border:1.5px solid var(--b1);border-radius:14px;padding:18px;background:#fff;height:100%;text-align:left}
.ptd-card-hf{background:linear-gradient(135deg,#fff8f1,#fef5f2);border-color:#fed7aa}
.ptd-card-hdr{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:4px;flex-wrap:wrap;text-align:left}
.ptd-card-hdr-l{display:flex;align-items:flex-start;gap:10px;text-align:left;flex:1;min-width:0}
.ptd-card-ic{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.ptd-card-title{font-size:13.5px;font-weight:800;text-align:left;line-height:1.3}
.ptd-card-sub{font-size:11px;color:var(--ink3);margin:2px 0 16px 0;text-align:left}
.ptd-mini-field{margin-bottom:12px;text-align:left}
.ptd-mini-field:last-child{margin-bottom:0}
.ptd-mini-label{display:block;font-size:11px;font-weight:700;color:var(--ink2);margin-bottom:5px;text-align:left}
.ptd-mini-input{width:100%;padding:9px 11px;background:#fff;border:1.5px solid var(--b1);border-radius:8px;font-family:var(--fn);font-size:12.5px;color:var(--ink);outline:none;transition:all .15s;text-align:left}
.ptd-mini-input:focus{border-color:var(--acc)}
.ptd-mini-input::placeholder{color:var(--ink4)}

.ptd-add-hf-btn{padding:8px 16px;border-radius:8px;border:1.5px solid #f97316;background:#fff;color:#ea580c;font-family:var(--fn);font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;flex-shrink:0;align-self:flex-start;margin-left:auto;transition:all .15s}
.ptd-add-hf-btn:hover{background:#fff7ed}

.ptd-hf-table{width:100%;border-collapse:collapse;margin-top:14px;table-layout:fixed}
.ptd-hf-table th{font-size:9.5px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.5px;text-align:left;padding:0 10px 8px;border-bottom:1.5px solid var(--b1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ptd-hf-table td{background:#fff;border-bottom:1px solid var(--b1);padding:8px 10px;font-size:12.5px;vertical-align:middle;overflow:visible}
.ptd-hf-table tr:last-child td{border-bottom:none}
.ptd-hf-fund{font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}
.ptd-hf-type{color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}
.ptd-hf-actions{display:flex;gap:6px}
.ptd-icon-btn{width:28px;height:28px;border-radius:8px;border:1.5px solid var(--b1);background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--ink3);transition:all .13s}
.ptd-icon-btn:hover{background:var(--s2)}
.ptd-icon-btn.edit:hover{border-color:#bfdbfe;color:var(--acc)}
.ptd-icon-btn.del:hover{border-color:#fecdd3;color:#e11d48;background:#fff1f2}
.ptd-hf-empty{text-align:center;color:var(--ink4);font-size:12px;padding:18px 8px;background:#fff;border:1.5px dashed var(--b2);border-radius:10px;margin-top:14px}
.ptd-hf-row-input{width:100%;padding:7px 9px;background:#fff;border:1.5px solid var(--b1);border-radius:7px;font-family:var(--fn);font-size:12px;color:var(--ink);outline:none;transition:all .15s;box-sizing:border-box}
.ptd-hf-row-input:focus{border-color:var(--acc)}
.ptd-hf-row-input::placeholder{color:var(--ink4)}
.ptd-hf-row-select{width:100%;padding:7px 8px;background:#fff;border:1.5px solid var(--b1);border-radius:7px;font-family:var(--fn);font-size:12px;color:var(--ink);outline:none;cursor:pointer;box-sizing:border-box;appearance:auto}
.ptd-hf-row-actions{display:flex;gap:6px;align-items:center}
.ptd-hf-row-save{width:28px;height:28px;border-radius:7px;border:none;background:var(--grn);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}
.ptd-hf-row-save:hover{background:#15803d}
.ptd-hf-row-cancel{width:28px;height:28px;border-radius:7px;border:1.5px solid var(--b1);background:#fff;color:var(--ink3);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}
.ptd-hf-row-cancel:hover{background:var(--s2)}

/* ── FIXED: Payer/Insurer dropdown inside the HF table row ── */
.ptd-hf-row-dd{position:relative;z-index:6}
.ptd-hf-row-dd .pat-dd-trigger{min-height:34px;padding:7px 34px 7px 9px;font-size:12px;}
.ptd-hf-row-dd .pat-dd-clear{width:16px;height:16px}
.ptd-hf-row-dd .pat-dd-chev{right:10px}
.ptd-hf-row-dd .pat-dd-panel{
  z-index:60;
  left:0;
  right:auto;
  min-width:260px;
  width:max-content;
  max-width:320px;
}

.ptd-note{display:flex;align-items:flex-start;gap:7px;font-size:11px;color:var(--ink3);line-height:1.5;background:#eff6ff;border:1px solid #bfdbfe;border-radius:9px;padding:9px 12px}
.ptd-note svg{color:var(--acc);margin-top:1px}

        /* ── Who is paying ── */
        .ptd-radio-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}
        .ptd-radio-card{border:1.5px solid var(--b1);border-radius:12px;padding:13px;display:flex;align-items:flex-start;gap:10px;cursor:pointer;transition:all .15s;background:#fff}
        .ptd-radio-card:hover{border-color:var(--b2)}
        .ptd-radio-card.on{border-width:2px;box-shadow:0 0 0 2px rgba(0,0,0,.02)}
        .ptd-radio-dot{width:16px;height:16px;border-radius:50%;border:2px solid var(--b2);flex-shrink:0;margin-top:2px;display:flex;align-items:center;justify-content:center;transition:all .15s}
        .ptd-radio-dot-fill{width:8px;height:8px;border-radius:50%}
        .ptd-radio-ic{width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .ptd-radio-label{font-size:12.5px;font-weight:700;color:var(--ink)}
        .ptd-radio-sub{font-size:10px;color:var(--ink3);margin-top:2px;line-height:1.4;white-space:pre-line}
        .ptd-hf-select-wrap{margin-top:2px}

        /* ── Footer security strip ── */
        .ptd-security{display:flex;align-items:center;gap:10px;background:var(--s1);border:1px solid var(--b1);border-radius:10px;padding:10px 14px;flex:1;text-align:left}
        .ptd-security-ic{width:30px;height:30px;border-radius:8px;background:#2563eb;color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .ptd-security-text{display:flex;flex-direction:column;align-items:flex-start;text-align:left;gap:2px;min-width:0}
        .ptd-security-title{font-size:12px;font-weight:700;color:var(--ink);line-height:1.3}
        .ptd-security-desc{font-size:11px;color:var(--ink3);line-height:1.4}

        @media (max-width:1080px){
          .ptd-grid-5col{grid-template-columns:1fr 1fr 1fr}
        }
        @media (max-width:900px){
          .ptd-grid3{grid-template-columns:1fr 1fr}
          .ptd-grid-3col{grid-template-columns:1fr 1fr}
          .ptd-grid-5col{grid-template-columns:1fr 1fr}
          .ptd-payer-grid{grid-template-columns:1fr}
          .ptd-radio-grid{grid-template-columns:1fr 1fr}
        }
        @media (max-width:560px){
          .ptd-grid3{grid-template-columns:1fr}
          .ptd-grid-3col{grid-template-columns:1fr}
          .ptd-grid-5col{grid-template-columns:1fr}
          .ptd-radio-grid{grid-template-columns:1fr}
          .ptd-hf-table{table-layout:auto}
        }
      `}</style>

      <div
        className="cpm"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 1420, width: "96vw" }}
      >
        {" "}
        <div className="cpm-hdr">
          <div className="cpm-hdr-row">
            <div className="cpm-hdr-l">
              <div className="cpm-hdr-ic">
                <PIcon name="user" size={17} />
              </div>
              <div className="cpm-hdr-text">
                <div className="cpm-title">
                  {isEditMode ? "Edit Patient" : "Create New Patient"}
                </div>
                <div className="cpm-sub">
                  Enter patient details and payer information. All mandatory
                  fields must be completed.
                </div>
              </div>
            </div>
            <button className="cpm-x" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>
        <div className="cpm-body">
          {/* ══ 1 · PATIENT DETAILS ══ */}
          <div className="ptd-sec">
            <div className="ptd-sec-hdr">
              <div className="ptd-badge">1</div>
              <div className="ptd-sec-title">Patient Details</div>
            </div>
            <div className="ptd-panel">
              <div className="ptd-grid3">
                <div className="ptd-field">
                  <label className="ptd-label">
                    First Name <span className="req">*</span>
                  </label>
                  {fi("firstName", "ptd-input", {
                    placeholder: "Enter first name",
                  })}
                  {errTip("firstName")}
                </div>
                <div className="ptd-field">
                  <label className="ptd-label">
                    Last Name <span className="req">*</span>
                  </label>
                  {fi("lastName", "ptd-input", {
                    placeholder: "Enter last name",
                  })}
                  {errTip("lastName")}
                </div>
                <div className="ptd-field">
                  <label className="ptd-label">
                    Date of Birth <span className="req"></span>
                  </label>
                  <div className={errors.dateOfBirth ? "cl-date-wrap err" : ""}>
                    <DatePicker
                      value={f.dateOfBirth}
                      onChange={(v) => upd("dateOfBirth", v)}
                      placeholder="DD-MMM-YYYY"
                      editable
                    />
                  </div>
                  {errTip("dateOfBirth")}
                </div>
                <div className="ptd-field">
                  <label className="ptd-label">Age</label>
                  <input
                    className="ptd-input"
                    value={f.age}
                    placeholder="Auto"
                    readOnly
                  />
                </div>
              </div>

              <div className="ptd-grid3">
                <div className="ptd-field">
                  <label className="ptd-label">Gender</label>
                  <select
                    className="ptd-select"
                    value={f.gender}
                    onChange={(e) => upd("gender", e.target.value)}
                  >
                    <option value="">Select…</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="ptd-field">
                  <label className="ptd-label">
                    Phone Number <span className="req"></span>
                  </label>
                  <div className="ptd-phone-wrap">
                    <span className="ptd-phone-prefix">
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: "var(--ink4)",
                          letterSpacing: ".4px",
                        }}
                      ></span>{" "}
                      AU +61
                    </span>
                    <input
                      className={`ptd-phone-input${errors.phone ? " err" : ""}`}
                      placeholder="Enter mobile number"
                      value={f.phone}
                      onChange={(e) => upd("phone", e.target.value)}
                    />
                  </div>
                  {errTip("phone")}
                </div>
                <div className="ptd-field">
                  <label className="ptd-label">
                    Email Address <span className="opt">(optional)</span>
                  </label>
                  {fi("email", "ptd-input", {
                    type: "email",
                    placeholder: "Enter email address",
                  })}
                </div>
                <div className="ptd-field">
                  <label className="ptd-label">
                    Address Line 1 <span className="req">*</span>
                  </label>
                  {fi("addressLine1", "ptd-input", {
                    placeholder: "Enter address line 1",
                  })}
                  {errTip("addressLine1")}
                </div>
              </div>

              <div className="ptd-grid-4col">
                <div className="ptd-field">
                  <label className="ptd-label">Address Line 2</label>
                  {fi("addressLine2", "ptd-input", {
                    placeholder: "Apartment, unit, suite, etc. (optional)",
                  })}
                </div>
                <div className="ptd-field">
                  <label className="ptd-label">
                    Suburb / City <span className="req">*</span>
                  </label>
                  {fi("city", "ptd-input", {
                    placeholder: "Enter suburb or city",
                  })}
                  {errTip("city")}
                </div>
                <div className="ptd-field">
                  <label className="ptd-label">
                    State / Territory <span className="req">*</span>
                  </label>
                  <select
                    className={`ptd-select${errors.state ? " err" : ""}`}
                    value={f.state}
                    onChange={(e) => upd("state", e.target.value)}
                  >
                    <option value="">Select state</option>
                    {[
                      "New South Wales",
                      "Queensland",
                      "South Australia",
                      "Tasmania",
                      "Victoria",
                      "Western Australia",
                      "Australian Capital Territory",
                      "Northern Territory",
                    ].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {errTip("state")}
                </div>
                <div className="ptd-field">
                  <label className="ptd-label">
                    Postcode <span className="req">*</span>
                  </label>
                  {fi("postalCode", "ptd-input", {
                    placeholder: "Enter postcode",
                  })}
                  {errTip("postalCode")}
                </div>
              </div>

              <div className="ptd-grid-4col">
                <div className="ptd-field">
                  <label className="ptd-label">
                    Country <span className="req">*</span>
                  </label>
                  {fi("country", "ptd-input", { placeholder: "Country" })}
                  {errTip("country")}
                </div>
              </div>
            </div>
          </div>
          {/* ══ 2 · PAYER INFORMATION ══ */}
          <div className="ptd-sec">
            <div className="ptd-sec-hdr">
              <div className="ptd-badge">2</div>
              <div className="ptd-sec-title">Payer Information</div>
            </div>
            <div className="ptd-sec-sub">
              Add or manage payer details available for this patient.
            </div>

            <div className="ptd-payer-grid">
              {/* Medicare */}
              <div className="ptd-card">
                <div className="ptd-card-hdr" style={{ marginBottom: 16 }}>
                  <div className="ptd-card-hdr-l">
                    <div
                      className="ptd-card-ic"
                      style={{ background: "#dbeafe", color: "#2563eb" }}
                    >
                      <PIcon name="medicare" />
                    </div>
                    <span
                      className="ptd-card-title"
                      style={{ color: "#2563eb" }}
                    >
                      Medicare Details
                    </span>
                  </div>
                </div>
                <div className="ptd-mini-field">
                  <label className="ptd-mini-label">Medicare Number</label>
                  <input
                    className="ptd-mini-input"
                    placeholder="Enter 10-digit Medicare number"
                    value={f.medicareNumber}
                    maxLength={10}
                    onChange={(e) =>
                      upd(
                        "medicareNumber",
                        e.target.value.replace(/\D/g, "").slice(0, 10)
                      )
                    }
                    style={
                      errors.medicareNumber
                        ? {
                            borderColor: "#ef4444",
                            boxShadow: "0 0 0 3px rgba(239,68,68,.1)",
                          }
                        : {}
                    }
                  />
                  {errors.medicareNumber && (
                    <span className="ptd-err-tip">{errors.medicareNumber}</span>
                  )}
                </div>
                <div className="ptd-mini-field">
                  <label className="ptd-mini-label">
                    IRN (Individual Reference Number) (optional)
                  </label>
                  <input
                    className="ptd-mini-input"
                    placeholder="Enter IRN"
                    value={f.medicareIRN}
                    maxLength={1}
                    onChange={(e) =>
                      upd(
                        "medicareIRN",
                        e.target.value.replace(/\D/g, "").slice(0, 1)
                      )
                    }
                  />
                </div>
              </div>

              {/* DVA */}
              <div className="ptd-card">
                <div className="ptd-card-hdr" style={{ marginBottom: 16 }}>
                  <div className="ptd-card-hdr-l">
                    <div
                      className="ptd-card-ic"
                      style={{ background: "#ede9fe", color: "#7c3aed" }}
                    >
                      <PIcon name="dva" />
                    </div>
                    <span
                      className="ptd-card-title"
                      style={{ color: "#7c3aed" }}
                    >
                      Veteran Affairs (DVA) Details
                    </span>
                  </div>
                </div>
                <div className="ptd-mini-field">
                  <label className="ptd-mini-label">DVA Number</label>
                  <input
                    className="ptd-mini-input"
                    placeholder="Enter DVA number"
                    value={f.dvaNumber}
                    maxLength={10}
                    onChange={(e) =>
                      upd("dvaNumber", e.target.value.slice(0, 10))
                    }
                    style={
                      errors.dvaNumber
                        ? {
                            borderColor: "#ef4444",
                            boxShadow: "0 0 0 3px rgba(239,68,68,.1)",
                          }
                        : {}
                    }
                  />
                  {errors.dvaNumber && (
                    <span className="ptd-err-tip">{errors.dvaNumber}</span>
                  )}
                </div>
              </div>

              {/* Health Fund / Work Cover */}
              <div className="ptd-card ptd-card-hf">
                <div className="ptd-card-hdr">
                  <div className="ptd-card-hdr-l">
                    <div
                      className="ptd-card-ic"
                      style={{ background: "#ffedd5", color: "#ea580c" }}
                    >
                      <PIcon name="hf" />
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <div
                        className="ptd-card-title"
                        style={{ color: "#c2410c" }}
                      >
                        Health Fund / Work Cover Details
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="ptd-add-hf-btn"
                    onClick={addHFRow}
                    disabled={!!editingRowId}
                    style={
                      editingRowId
                        ? { opacity: 0.5, cursor: "not-allowed" }
                        : {}
                    }
                    title={
                      editingRowId
                        ? "Finish or cancel the current row first"
                        : "Add another Health Fund / Work Cover record"
                    }
                  >
                    <PIcon name="plus" size={13} color="#ea580c" /> Add New
                    Health Fund / Work Cover
                  </button>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--ink3)",
                    marginTop: 2,
                    textAlign: "left",
                  }}
                >
                  Manage Health Fund or Work Cover records for this patient.
                </div>

                {(showHealthFundTable || editingRowId) &&
                  healthFundRows.length > 0 && (
                  <table className="ptd-hf-table">
                    <colgroup>
                      <col style={{ width: "30%" }} />
                      <col style={{ width: "14%" }} />
                      <col style={{ width: "22%" }} />
                      <col style={{ width: "22%" }} />
                      <col style={{ width: "12%" }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Payer / Insurer Name</th>
                        <th>Type</th>
                        <th>Membership / Claim Number</th>
                        <th>Additional Details</th>
                        <th style={{ textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {healthFundRows.map((row) =>
                        editingRowId === row.rowId ? (
                          <tr key={row.rowId}>
                            <td>
                              <div className="ptd-hf-row-dd">
                                <HealthFundDropdown
                                  funds={healthFundOnlyFunds}
                                  value={row.payerId}
                                  onChange={(v) =>
                                    updateHFRow(row.rowId, "payerId", v)
                                  }
                                  placeholder="-Select Payer / Insurer-"
                                />
                              </div>
                            </td>
                            <td>
                              <select
                                className="ptd-hf-row-select"
                                value={row.type || "Health Fund"}
                                onChange={(e) =>
                                  updateHFRow(row.rowId, "type", e.target.value)
                                }
                              >
                                <option>Health Fund</option>
                                <option>Work Cover</option>
                              </select>
                            </td>
                            <td>
                              <input
                                className="ptd-hf-row-input"
                                placeholder="Enter membership / claim number"
                                value={row.membershipNumber}
                                onChange={(e) =>
                                  updateHFRow(
                                    row.rowId,
                                    "membershipNumber",
                                    e.target.value
                                  )
                                }
                              />
                            </td>
                            <td>
                              <input
                                className="ptd-hf-row-input"
                                placeholder="e.g. Hospital & Extras"
                                value={row.additionalDetails}
                                onChange={(e) =>
                                  updateHFRow(
                                    row.rowId,
                                    "additionalDetails",
                                    e.target.value
                                  )
                                }
                              />
                            </td>
                            <td>
                              <div
                                className="ptd-hf-row-actions"
                                style={{ justifyContent: "flex-end" }}
                              >
                                <button
                                  type="button"
                                  className="ptd-hf-row-save"
                                  title={
                                    row.payerId && row.membershipNumber.trim()
                                      ? "Save"
                                      : "Select a payer and enter a membership number first"
                                  }
                                  disabled={
                                    !row.payerId || !row.membershipNumber.trim()
                                  }
                                  style={
                                    !row.payerId || !row.membershipNumber.trim()
                                      ? {
                                          opacity: 0.4,
                                          cursor: "not-allowed",
                                          background: "var(--b2)",
                                        }
                                      : {}
                                  }
                                  onClick={() => saveHFRow(row.rowId)}
                                >
                                  <PIcon name="edit" size={12} color="#fff" />
                                </button>
                                <button
                                  type="button"
                                  className="ptd-hf-row-cancel"
                                  title="Cancel"
                                  onClick={() => cancelHFRow(row.rowId)}
                                >
                                  <PIcon name="trash" size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <tr key={row.rowId}>
                            <td>
                              <span
                                className="ptd-hf-fund"
                                title={fundName(row.payerId) || ""}
                              >
                                {fundName(row.payerId) || "—"}
                              </span>
                            </td>
                            <td>
                              <span
                                className="ptd-hf-type"
                                title={row.type || "Health Fund"}
                              >
                                {row.type || "Health Fund"}
                              </span>
                            </td>
                            <td>
                              <span
                                className="ptd-hf-cell"
                                title={row.membershipNumber || ""}
                              >
                                {row.membershipNumber || "—"}
                              </span>
                            </td>
                            <td>
                              <span
                                className="ptd-hf-cell"
                                title={row.additionalDetails || ""}
                              >
                                {row.additionalDetails || "—"}
                              </span>
                            </td>
                            <td>
                              <div
                                className="ptd-hf-actions"
                                style={{ justifyContent: "flex-end" }}
                              >
                                <button
                                  type="button"
                                  className="ptd-icon-btn edit"
                                  title="Edit"
                                  onClick={() => editHFRow(row.rowId)}
                                >
                                  <PIcon name="edit" size={13} />
                                </button>
                                <button
                                  type="button"
                                  className="ptd-icon-btn del"
                                  title="Delete"
                                  onClick={() => deleteHFRow(row.rowId)}
                                >
                                  <PIcon name="trash" size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                )}

                {!((showHealthFundTable || editingRowId) && healthFundRows.length > 0) && (
                  <div className="ptd-hf-empty">
                    {showHealthFundTable || editingRowId
                      ? "No Health Fund or Work Cover added yet"
                      : "Select \"Health Fund / Work Cover\" below to view or add records"}
                  </div>
                )}
                <div className="ptd-note" style={{ marginTop: 14 }}>
                  <PIcon name="info" size={13} />
                  <span>
                    You can add multiple Health Funds or Work Cover records.
                    These will be available to choose when selecting who is
                    paying the invoice.
                  </span>
                </div>
                {errors.healthFundId && (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#ef4444",
                    }}
                  >
                    {errors.healthFundId}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ══ 3 · WHO IS PAYING THE INVOICE ══ */}
          <div className="ptd-sec">
            <div className="ptd-sec-hdr">
              <div className="ptd-badge">3</div>
              <div className="ptd-sec-title">
                Who Is Paying The Invoice?{" "}
                <span style={{ color: "#ef4444" }}>*</span>
              </div>
            </div>
            <div className="ptd-sec-sub">
              Select who will pay the invoice for this patient.
            </div>
            {errors.whoIsPaying && (
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#ef4444",
                  marginTop: -8,
                  marginBottom: 12,
                }}
              >
                {errors.whoIsPaying}
              </div>
            )}

            <div className="ptd-radio-grid">
              {WHO_IS_PAYING_OPTIONS.map((opt) => {
                const on = whoIsPaying === opt.id;
                const enabled = isWhoIsPayingEnabled(opt.id);
                const disabledHint =
                  opt.id === "Medicare"
                    ? "Enter Medicare Number above first"
                    : opt.id === "DVA"
                    ? "Enter DVA Number above first"
                    : opt.id === "HealthFund"
                    ? "Add a Health Fund / Work Cover record above first"
                    : "";
                return (
                  <div
                    key={opt.id}
                    className={`ptd-radio-card${on ? " on" : ""}${
                      !enabled ? " disabled" : ""
                    }`}
                    style={
                      !enabled
                        ? {
                            opacity: 0.45,
                            cursor: "not-allowed",
                            background: "var(--s1)",
                          }
                        : on
                        ? { borderColor: opt.clr, background: `${opt.clr}0c` }
                        : errors.whoIsPaying
                        ? { borderColor: "#fecaca" }
                        : {}
                    }
                    title={!enabled ? disabledHint : ""}
                    onClick={() => {
                      if (!enabled) return;
                      setWhoIsPaying(opt.id);
                      if (errors.whoIsPaying)
                        setErrors((x) => ({ ...x, whoIsPaying: "" }));
                    }}
                  >
                    <div
                      className="ptd-radio-dot"
                      style={on ? { borderColor: opt.clr } : {}}
                    >
                      {on && (
                        <div
                          className="ptd-radio-dot-fill"
                          style={{ background: opt.clr }}
                        />
                      )}
                    </div>
                    <div
                      className="ptd-radio-ic"
                      style={{
                        background: enabled ? `${opt.clr}1a` : "var(--s2)",
                        color: enabled ? opt.clr : "var(--ink4)",
                      }}
                    >
                      <PIcon name={opt.icon} size={16} />
                    </div>
                    <div>
                      <div
                        className="ptd-radio-label"
                        style={!enabled ? { color: "var(--ink4)" } : {}}
                      >
                        {opt.label}
                      </div>
                      <div className="ptd-radio-sub">
                        {!enabled ? disabledHint : opt.sub}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {whoIsPaying === "HealthFund" && (
              <div className="ptd-hf-select-wrap">
                <label className="ptd-mini-label">
                  Select Health Fund / Work Cover{" "}
                  <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <HealthFundDropdown
                  funds={hfSelectFunds}
                  value={f.healthFundId}
                  onChange={(v) => upd("healthFundId", v)}
                  error={!!errors.healthFundId}
                  disabled={healthFundRows.length === 0}
                  placeholder={
                    healthFundRows.length > 0
                      ? "Select Health Fund / Work Cover…"
                      : "Add a Health Fund record above first"
                  }
                />
                {errors.healthFundId && (
                  <span
                    className="ptd-err-tip"
                    style={{ display: "block", marginTop: 4 }}
                  >
                    {errors.healthFundId}
                  </span>
                )}
                <div className="ptd-note" style={{ marginTop: 8 }}>
                  <PIcon name="info" size={13} />
                  <span>
                    The selected payer will be used for all invoices and claims
                    for this patient.
                  </span>
                </div>
              </div>
            )}
          </div>

          {errors.api && (
            <div
              style={{
                padding: "10px 12px",
                background: "#fff1f2",
                border: "1px solid #fecdd3",
                borderRadius: 8,
                fontSize: 13,
                color: "#9f1239",
              }}
            >
              ⚠ {errors.api}
            </div>
          )}
        </div>
        <div className="cpm-foot" style={{ justifyContent: "space-between" }}>
          <div className="ptd-security">
            <div className="ptd-security-ic">
              <PIcon name="shield" size={15} color="#fff" />
            </div>
            <div className="ptd-security-text">
              <span className="ptd-security-title">Your data is secure</span>
              <span className="ptd-security-desc">
                All patient information is stored securely and managed in
                accordance with Australian Privacy Principles and relevant
                privacy legislation.
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 9, flexShrink: 0 }}>
            <button
              className="cpm-btn-cancel"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className="cpm-btn-save"
              onClick={handleSave}
              disabled={saving}
              style={{ minWidth: 140, justifyContent: "center" }}
            >
              {saving ? (
                <>
                  <span className="spin">⟳</span> Saving…
                </>
              ) : (
                <>
                  <PIcon name="edit" size={14} color="#fff" />{" "}
                  {isEditMode ? "Save Changes" : "Save Patient"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   PROVIDER POPUP
───────────────────────────────────────────────────────────────── */
function ProviderPopup({
  onConfirm,
  initialDoctor = null,
  initialHospital = null,
}) {
  const [doctors, setDoctors] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [doctor, setDoctor] = useState(initialDoctor);
  const [hospital, setHospital] = useState(initialHospital);
  const [docLoad, setDocLoad] = useState(true);
  const [hospLoad, setHospLoad] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      setDocLoad(true);
      try {
        const docs = isZohoAvailable() ? await loadDoctors() : [];
        setDoctors(docs);
        if (initialDoctor) {
          setHospLoad(true);
          try {
            const hosps = isZohoAvailable()
              ? await loadHospitalsForDoctor(initialDoctor.id)
              : [];
            setHospitals(hosps);
          } catch {
            setHospitals([]);
          } finally {
            setHospLoad(false);
          }
        }
      } catch {
        setDoctors([]);
      } finally {
        setDocLoad(false);
      }
    })();
  }, []);

  const handleDoctorChange = async (d) => {
    setDoctor(d);
    setHospital(null);
    setHospitals([]);
    setHospLoad(true);
    try {
      const hosps = isZohoAvailable() ? await loadHospitalsForDoctor(d.id) : [];
      setHospitals(hosps);
    } catch {
      setHospitals([]);
    } finally {
      setHospLoad(false);
    }
  };

  const go = () => {
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      onConfirm({ doctor, hospital });
    }, 800);
  };

  return (
    <div className="pop-bg">
      <div className="pop-box">
        <div className="pop-top">
          <div className="pop-top-orb1" />
          <div className="pop-top-orb2" />
          <div className="pop-top-row">
            <div className="pop-tag">🏥 Medi Elves</div>
          </div>
          <div className="pop-title">Search Claims by Provider</div>
          <div className="pop-desc">
            Select a doctor and hospital name to load their claim records.
          </div>
        </div>
        <div className="pop-body">
          <div className="pop-fields-row">
            <SelectField
              label="Doctor"
              placeholder="-Select-"
              options={doctors}
              value={doctor}
              loading={docLoad}
              onChange={handleDoctorChange}
              renderSelected={(d) => d.name}
              renderOption={(d, pick, active) => (
                <div
                  key={d.id}
                  className={`pop-dd-item ${active ? "dd-active" : ""}`}
                  onClick={() => pick(d)}
                >
                  <div
                    className="dd-av"
                    style={{
                      background: `${d.color}12`,
                      borderColor: `${d.color}25`,
                      color: d.color,
                    }}
                  >
                    {d.av}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="dd-main">{d.name}</div>
                    <div className="dd-sub">{d.spec}</div>
                  </div>
                  {active ? (
                    <span className="dd-tick">✓</span>
                  ) : (
                    <span
                      className="dd-right"
                      style={{
                        background: `${d.color}10`,
                        color: d.color,
                        border: `1px solid ${d.color}20`,
                      }}
                    >
                      {d.spec?.slice(0, 5)}
                    </span>
                  )}
                </div>
              )}
            />
            <SelectField
              label="Hospital Name"
              placeholder={
                doctor
                  ? hospLoad
                    ? "Loading…"
                    : "-Select-"
                  : "Select doctor first"
              }
              options={hospitals}
              value={hospital}
              loading={hospLoad}
              onChange={setHospital}
              disabled={!doctor || hospLoad}
              renderSelected={(h) => h.name}
              renderOption={(h, pick, active) => (
                <div
                  key={h.id}
                  className={`pop-dd-item ${active ? "dd-active" : ""}`}
                  onClick={() => pick(h)}
                >
                  <div
                    className="dd-av"
                    style={{
                      background: "#f0f9ff",
                      borderColor: "#bfdbfe",
                      fontSize: 16,
                    }}
                  >
                    🏥
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="dd-main">{h.name}</div>
                    <div className="dd-sub">
                      {h.city} · {h.type}
                    </div>
                  </div>
                  {active ? (
                    <span className="dd-tick">✓</span>
                  ) : (
                    <span
                      className="dd-right"
                      style={{
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        border: "1px solid #bfdbfe",
                      }}
                    >
                      {h.acc}
                    </span>
                  )}
                </div>
              )}
            />
          </div>
        </div>
        <div className="pop-footer">
          <div className="pop-footer-txt">
            {!doctor && !hospital && "Select Doctor and Hospital to continue"}
            {doctor && !hospital && !hospLoad && (
              <>
                Doctor: <b>{doctor.name}</b> — now select a hospital
              </>
            )}
            {doctor && hospLoad && (
              <>
                Loading hospitals for <b>{doctor.name}</b>…
              </>
            )}
            {doctor && hospital && (
              <>
                <b>{doctor.name}</b> + <b>{hospital.name}</b> ready
              </>
            )}
          </div>
          <button
            className="btn b-green"
            disabled={!doctor || !hospital || busy || hospLoad}
            onClick={go}
            style={{ minWidth: 130 }}
          >
            {busy ? (
              <>
                <span className="spin">⟳</span> Loading…
              </>
            ) : (
              "Search →"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   NEW CLAIM MODAL
───────────────────────────────────────────────────────────────── */
function NewClaimModal({ dDoc, dHosp, onClose, onSave }) {
  const [f, setF] = useState({
    doctorId: dDoc?.id || "",
    hospitalId: dHosp?.id || "",
    patientId: "",
    assistantSurgeons: "No",
    primarySurgeon: "",
    primarySurgeonItemNumbers: "",
    gap: false,
    gapAmount: "",
    payerId: "",
    claimPayerName: "",
    claimMembershipNo: "",
    claimIsMedicare: false,
    referringDoctorId: "",
    providerNumber: "",
    claimType: "",
    notes: "",   // ← NEW
  });
  const [referringDoctors, setReferringDoctors] = useState([]);
  const [showAddRefDoc, setShowAddRefDoc] = useState(false);
  const [newRefDocName, setNewRefDocName] = useState("");
  const [newRefDocProvider, setNewRefDocProvider] = useState("");
  const [addingRefDoc, setAddingRefDoc] = useState(false);
  const [staff, setStaff] = useState(null);
  const [staffLoad, setStaffLoad] = useState(false);
  const [assistantSurgeonOptions, setAssistantSurgeonOptions] = useState([]);
  const [showAddPrimarySurgeon, setShowAddPrimarySurgeon] = useState(false);
const [newPrimarySurgeonName, setNewPrimarySurgeonName] = useState("");
const [newPrimarySurgeonItemNumber, setNewPrimarySurgeonItemNumber] = useState("");
const [addingPrimarySurgeon, setAddingPrimarySurgeon] = useState(false);
  // const [items, setItems] = useState([]);
  const [healthFunds, setHealthFunds] = useState([]);
  const [payers, setPayers] = useState([]); // filtered by selected patient
  const [payerLoad, setPayerLoad] = useState(false);
  const [lines, setLines] = useState([
    { itemId: "", itemNo: "", amountCharged: "", dateOfService: "" },
  ]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [showCreatePat, setShowCreatePat] = useState(false);
  const [showEditPat, setShowEditPat] = useState(false);
  const [editPatient, setEditPatient] = useState(null);
  const patientReqRef = useRef(null); // ADD THIS — tracks latest selected patient to prevent stale async overwrites
  // const [refDoctors, setRefDoctors] = useState([]);       // locally-added referring doctors this session
  // const [showAddRefDoc, setShowAddRefDoc] = useState(false);
  // const [newRefDocName, setNewRefDocName] = useState("");

useEffect(() => {
  (async () => {
    setLoading(true);
    try {
      const [pts, docs, funds, refDocs, asstSurgeons] = await Promise.all([
        isZohoAvailable() ? loadPatients() : [],
        isZohoAvailable() ? loadDoctors() : [],
        isZohoAvailable() ? loadHealthFunds() : [],
        isZohoAvailable() ? loadReferringDoctors() : [],
        isZohoAvailable() ? loadAssistantSurgeons() : [], // ← NEW
      ]);
      setPatients(pts);
      setDoctors(docs);
      setHealthFunds(funds);
      setReferringDoctors(refDocs);
      setAssistantSurgeonOptions(asstSurgeons); // ← NEW
    } catch {
      setDoctors(STATIC_DOCTORS);
    } finally {
      setLoading(false);
    }
  })();
    // Auto-load staff from login user
    if (isZohoAvailable()) {
      setStaffLoad(true);
      loadStaffByLoginUser()
        .then((s) => {
          if (s) setStaff(s);
        })
        .catch((e) => console.warn("[NewClaimModal] staff load failed", e))
        .finally(() => setStaffLoad(false));
    }
  }, []);

  /*
  FIX: race condition in NewClaimModal's upd("patientId", ...) handler.

  BUG: when you select patient A, then quickly select patient B, there are
  two in-flight async calls (loadPatientPayers + loadPatientPayerLookup) for
  A running at the same time as B's. If A's requests resolve AFTER B's, they
  overwrite B's payerId/claimPayerId/payers with A's data — so the dropdown
  ends up showing a stale patient's payer/health-fund even though a
  different patient is currently selected. This is why every patient you
  picked kept showing "Edwin" data.

  FIX: track the most-recently-requested patientId in a ref. Before each
  setState call inside the async block, check that the ref still matches
  the patientId this specific async call was fetching for. If a newer
  patientId has since been requested, discard the stale response instead
  of applying it.

  HOW TO APPLY:
  1. Add this line once near your other useRef() declarations inside
     NewClaimModal (right above your `const upd = (k,v) => {` line):

       const patientReqRef = useRef(null);

  2. Replace your entire existing `upd` function with the one below.
*/

  // const patientReqRef = useRef(null); // put this once, above upd()

  const upd = (k, v) => {
    if (k === "patientId") {
      patientReqRef.current = v; // mark this patient as the latest request

      setF((x) => ({ ...x, patientId: v, payerId: "", claimPayerId: "" }));

      (async () => {
        setPayerLoad(true);
        try {
          if (isZohoAvailable()) {
            const p = await loadPatientPayers(v);

            // If a newer patient was selected while this await was in flight, bail out.
            if (patientReqRef.current !== v) return;

            if (Array.isArray(p) && p.length > 0) {
              setPayers(p);
              setF((x) => ({ ...x, payerId: p[0].id || "" }));
            } else {
              setPayers(healthFunds);
              setF((x) => ({ ...x, payerId: "" }));
            }

            // NEW — auto-fill "Payer" + Membership Number straight from the patient
            // record in Zoho, instead of relying on the local `patients` array (which
            // can get overwritten with a partial object after editing a patient).
            const [patientPayer, freshPatient] = await Promise.all([
              loadPatientPayerLookup(v),
              loadPatientById(v),
            ]);

            // Guard — this await could go stale independently of the first.
            if (patientReqRef.current !== v) return;

            const payerNameLower = (patientPayer?.name || "").trim().toLowerCase();
            const isMedicarePayer = payerNameLower === "medicare";

            // Medicare shows its own Medicare Number field, not the generic
            // Membership_Number (which belongs to Health Fund / Work Cover).
            const membershipNo = isMedicarePayer
              ? String(freshPatient?.Medicare ?? freshPatient?.medicare ?? "").trim()
              : String(
                  freshPatient?.Membership_Number ??
                    freshPatient?.membership_number ??
                    ""
                ).trim();

            setF((x) => ({
              ...x,
              claimPayerId: patientPayer?.id || "",
              claimPayerName: patientPayer?.name || "",
              claimMembershipNo: membershipNo,
              claimIsMedicare: isMedicarePayer,
            }));
          } else {
            setPayers(healthFunds);
          }
        } catch (err) {
          console.warn("[NewClaimModal] loadPatientPayers failed", err);
          if (patientReqRef.current === v) setPayers(healthFunds);
        } finally {
          if (patientReqRef.current === v) setPayerLoad(false);
        }
      })();

      if (errors.payerId) setErrors((x) => ({ ...x, payerId: "" }));
      if (errors.claimPayerId) setErrors((x) => ({ ...x, claimPayerId: "" }));
    } else {
      setF((x) => ({ ...x, [k]: v }));
    }
    if (k !== "patientId" && errors[k]) setErrors((x) => ({ ...x, [k]: "" }));
  };
  const updLn = (i, k, v) =>
    setLines((ls) => {
      const n = [...ls];
      n[i] = { ...n[i], [k]: v };
      return n;
    });
  const setLineItem = (i, item) =>
    setLines((ls) => {
      const n = [...ls];
      n[i] = { ...n[i], itemId: item?.id || "", itemNo: item?.name || "" };
      return n;
    });
  const sanitizeItemNumber = (value) => value.replace(/[^A-Za-z0-9]/g, "");
const addLn = () =>
    setLines((ls) => {

      const lastDate = ls.length > 0 ? ls[ls.length - 1]?.dateOfService || "" : "";
      return [
        ...ls,
        {
          itemId: "",
          itemNo: "",
          amountCharged: "",
          dateOfService: lastDate,
          primarySurgeonId: "",
        },
      ];
    });
  const delLn = (i) => setLines((ls) => ls.filter((_, j) => j !== i));
  const handleViewPatient = async (patient) => {
    if (!patient?.id) return;
    try {
      const detail = isZohoAvailable()
        ? await loadPatientById(patient.id)
        : patient;
      if (detail) {
        setEditPatient(detail);
        setShowEditPat(true);
      }
    } catch (err) {
      console.error("[NewClaimModal] loadPatientById failed:", err);
      setEditPatient(patient);
      setShowEditPat(true);
    }
  };
  const selectedPatient =
    patients.find((p) => String(p.id) === String(f.patientId)) || null;
  const autoTotal =
    lines.reduce((t, ln) => t + (parseFloat(ln.amountCharged) || 0), 0) +
    (f.gap ? parseFloat(f.gapAmount) || 0 : 0);
  console.log(
    "Membership_Number value:",
    JSON.stringify(selectedPatient?.Membership_Number)
  );
const validate = () => {
    const e = {};
    if (!f.patientId) e.patientId = "Required";
    if (
      lines.every((ln) => !ln.amountCharged && !ln.itemId && !ln.dateOfService)
    )
      e.lines = "Add at least one line with an amount";
    const anyInvalidLine = lines.some((ln) => {
      const hasLineData = Boolean(
        ln.itemId ||
          String(ln.amountCharged || "").trim() ||
          String(ln.dateOfService || "").trim()
      );
      const requireValidation = hasLineData || lines.length > 1;
      const amountInvalid =
        !String(ln.amountCharged || "").trim() || Number(ln.amountCharged) <= 0;
      return (
        requireValidation &&
        (!ln.itemId || !String(ln.dateOfService || "").trim() || amountInvalid)
      );
    });
    if (anyInvalidLine) {
      e.lineItemNo =
        "Item Number, Date of Service and Amount are required for all lines";
      e.lineDate = e.lineItemNo;
      e.lineAmount = e.lineItemNo;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const claimLines = lines
        .filter((ln) => ln.amountCharged || ln.itemId)
        .map((ln) => ({
          itemId: ln.itemId,
          itemNo: ln.itemNo || "", // set directly by ItemSearchDropdown, no lookup needed
          amountCharged: parseFloat(ln.amountCharged) || 0,
          description: "",
          primarySurgeonId: ln.primarySurgeonId,
          dateOfService: ln.dateOfService,
        }));

      // NEW — resolve referring doctor display name
      // NEW — resolve referring doctor display name
      const refDocMatch = [...doctors, ...referringDoctors].find(
        (d) => d.id === f.referringDoctorId
      );
      const referringDoctorName = refDocMatch ? refDocMatch.name : "";
      const isLocalRefDoc = String(f.referringDoctorId || "").startsWith(
        "local-"
      );

      const patName = patients.find((p) => p.id === f.patientId)?.name || "";
      const newClaim = {
        id: "",
        recordId: "",
        pat: patName,
        did: f.doctorId,
        hid: f.hospitalId,
        dName: dDoc?.name || "",
        hName: dHosp?.name || "",
        date: formatDateZoho(new Date()),
        st: "Draft",
        dx: "",
        svc: claimLines,
        amt: autoTotal,
        balanceDue: autoTotal,
        allocatedAmount: 0,
      };
      if (isZohoAvailable()) {
const result = await createClaimRecord({
  doctorId: f.doctorId,
  hospitalId: f.hospitalId,
  patientId: f.patientId,
  claimDate: formatDateZoho(new Date()),
  assistantSurgeons: f.assistantSurgeons,
primarySurgeon: f.assistantSurgeons === "Yes" ? f.primarySurgeon : "",   // ← the record ID, for the Primary_Surgeon1 lookup  // ← CHANGED
  primarySurgeonItemNumbers:
    f.assistantSurgeons === "Yes" ? f.primarySurgeonItemNumbers : "",
  totalClaimAmount: autoTotal,
  claimLines,
  staffId: staff?.id || "",
  enableGap: f.gap,
  gapAmount: f.gap ? parseFloat(f.gapAmount) || 0 : 0,
  healthFundId: f.payerId || "",
  payerId: f.claimPayerId || "",
  referringDoctorId: f.referringDoctorId || "",
  providerNumber: f.providerNumber || "",
  claimType: f.claimType || "",
  notes: f.notes || "",   // ← NEW
});

        if (result.success) {
          // createClaimRecord already generates, verifies, and (if needed)
          // force-writes the sequential Claim_ID — no need to re-fetch loadClaims
          // just to resolve the display ID anymore.
          newClaim.id = result.claimNo || result.recordId || "";
          newClaim.recordId = String(result.recordId || "");
          onSave(newClaim);
        } else {
          setErrors({ api: "Failed to create claim in Zoho." });
          setSaving(false);
          return;
        }
      } else {
        newClaim.id = `CLM-${Date.now().toString().slice(-5)}`;
        onSave(newClaim);
      }
      onClose();
    } catch (e) {
      console.error(e);
      setErrors({ api: "Unexpected error." });
    } finally {
      setSaving(false);
    }
  };

  const disabledInput = {
    background: "var(--s2)",
    color: "var(--ink3)",
    cursor: "not-allowed",
    border: "1.5px solid var(--b1)",
    opacity: 0.7,
  };
  const showAsstCol = f.assistantSurgeons === "Yes";
  const col = "240px 1fr 170px 24px";

  /*
  DROP-IN REPLACEMENT — v3 (icons + spacing/layout fixes + claim-lines header alignment fix)
  ---------------------------------------------------------
  Changes vs v2, to match the target "Claim Lines" screenshot exactly:

  1. Claim Lines badge is now a rounded SQUARE (border-radius: 8px)
     instead of a circle — matches target image.
  2. Column headers (Date of Service / Item No. / Amount) are now
     sentence-case, normal letter-spacing, font-weight 600, dark navy
     color (#0f172a) — matches target font exactly instead of the
     uppercase/letter-spaced style that was causing misalignment.
  3. Removed the 2px horizontal padding offset on .icm-line-hdrs so
     header labels sit flush and aligned directly above their inputs.

  Everything else (grid columns, inputs, delete button, total row)
  is unchanged from v2.
*/

  // ---- put this block once, above your component (module scope) ----
  const ICONS = {
    doc: (
      <>
        <path d="M8 2h8a1 1 0 0 1 1 1v2H7V3a1 1 0 0 1 1-1Z" />
        <rect x="4" y="4" width="16" height="18" rx="2" />
        <path d="M8 11h8M8 15h5" />
      </>
    ),
    x: <path d="M18 6 6 18M6 6l12 12" />,
    lock: (
      <>
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
      </>
    ),
    edit: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </>
    ),
    wallet: (
      <>
        <rect x="3" y="6" width="18" height="13" rx="2" />
        <path d="M3 10h18" />
        <circle cx="17" cy="14.5" r="1" />
      </>
    ),
    card: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
      </>
    ),
    dollar: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v10M15 9.6c0-1.4-1.3-2.6-3-2.6s-3 1-3 2.3c0 1.1.9 1.7 2 2l2 .6c1.1.3 2 .9 2 2 0 1.3-1.3 2.3-3 2.3s-3-1.1-3-2.6" />
      </>
    ),
    list: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 3v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3" />
        <path d="M8 12h8M8 16h5" />
      </>
    ),
  };
  const Icon = ({ name, size = 15, style, ...rest }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block", flexShrink: 0, ...style }}
      {...rest}
    >
      {ICONS[name]}
    </svg>
  );
  // ---------------------------------------------------------------------

  return (
    <>
      <style>{`
      .icm-ov{position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;z-index:1000;padding:20px;}
.icm{width:100%;max-width:1360px;max-height:92vh;background:#fff;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.35);}
.icm-hdr{background:linear-gradient(135deg,#0f4c81 0%,#1565c0 55%,#1e88e5 100%);padding:20px 24px;flex-shrink:0;position:relative;z-index:2;}
.icm-hdr-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;}
      .icm-title{color:#fff;font-size:19px;font-weight:800;display:flex;align-items:center;gap:9px;}
      .icm-sub{color:#bcd0f0;font-size:12.5px;margin-top:7px;display:flex;align-items:center;gap:7px;}
      .icm-status-pill{background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.35);color:#fff;font-weight:700;font-size:11px;padding:2px 11px;border-radius:20px;}
      .icm-x{width:32px;height:32px;border-radius:9px;border:1.5px solid rgba(255,255,255,.35);background:rgba(255,255,255,.08);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
      .icm-x:hover{background:rgba(255,255,255,.18);}
      .icm-body{overflow-y:auto;padding:20px;background:#f8fafc;display:flex;flex-direction:column;gap:18px;}
      .icm-card{background:#fff;border:1px solid #e5e9f0;border-radius:12px;padding:20px;text-align:left;}
      .icm-card-tinted{background:#eef4ff;border:1px solid #bfd6fb;}
      .icm-sec-hdr{display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:nowrap;text-align:left;}
      .icm-sec-hdr .icm-sec-label{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left;}
      .icm-badge{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
      /* NEW: rounded-square badge variant used for Claim Lines to match target image */
      .icm-badge-square{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
      .icm-sec-label{font-size:13px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;line-height:1;text-align:left;}
      .icm-sec-desc{font-size:12px;color:#64748b;margin:-8px 0 14px 38px;}
      .icm-grid{display:grid;gap:14px;}
      .icm-field label{display:block;font-size:12px;font-weight:700;color:#334155;margin-bottom:6px;}
      .icm-input,.icm-select{width:100%;height:40px;box-sizing:border-box;border:1.5px solid #d7dee7;border-radius:8px;padding:0 11px;font-size:13px;color:#1e293b;background:#fff;font-family:inherit;}
      .icm-input:focus,.icm-select:focus{outline:none;border-color:#2563eb;}
      .icm-input[readonly]{background:#f1f5f9;color:#7c8794;border-color:#e5e9f0;cursor:default;}
      .icm-input.err,.icm-select.err{border-color:#ef4444;}
      .icm-err{font-size:10.5px;color:#ef4444;margin-top:5px;display:block;}
      .icm-hint{font-size:10.5px;color:#94a3b8;margin-top:5px;display:block;}
      .icm-edit-btn{width:40px;height:40px;border-radius:50%;border:1.5px solid #86efac;background:#fff;color:#16a34a;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-sizing:border-box;}
      .icm-edit-btn:disabled{opacity:.4;cursor:not-allowed;}
      .icm-new-btn{padding:0 18px;height:40px;border-radius:8px;border:none;background:#16a34a;color:#fff;font-weight:700;font-size:12.5px;cursor:pointer;white-space:nowrap;flex-shrink:0;box-sizing:border-box;}
      .icm-new-btn:hover{background:#15803d;}
      .icm-payer-stack{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
      @media (max-width:560px){
        .icm-payer-stack{grid-template-columns:1fr;}
      }
      .icm-membership{margin-top:14px;display:flex;flex-direction:row;align-items:center;gap:12px;background:#eef4ff;border:1px solid #bfd6fb;border-radius:9px;padding:12px 14px;text-align:left;}
      .icm-membership-icon{width:32px;height:32px;border-radius:8px;background:#dbeafe;color:#2563eb;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
      .icm-membership-text{display:flex;flex-direction:column;text-align:left;}
      .icm-membership-label{font-size:11px;color:#2563eb;font-weight:700;margin-bottom:2px;text-align:left;}
      .icm-membership-value{font-size:14px;color:#1e293b;font-weight:700;text-align:left;}
.icm-payer-card{background:#fff;display:flex;flex-direction:column;flex:1;}
      .icm-payer-card .icm-sec-label{font-size:12.5px;font-weight:700;letter-spacing:.2px;}
      .icm-payer-card .icm-badge{width:24px;height:24px;border-radius:7px;}
     .icm-payer-empty{font-size:12.5px;color:#94a3b8;padding:14px 16px;background:#f8fafc;border:1.5px dashed #cbd5e1;border-radius:10px;text-align:center;display:flex;align-items:center;justify-content:center;gap:8px;min-height:44px;flex:1;}
      .icm-payer-box{position:relative;background:#f8fafc;border:1px solid #eef1f6;border-radius:12px;padding:14px 18px;display:grid;grid-template-columns:1fr 1fr;}
      .icm-payer-box::before{content:'';position:absolute;left:50%;top:14px;bottom:14px;width:1px;background:#e2e8f0;}
      .icm-payer-box.single{grid-template-columns:1fr;}
      .icm-payer-box.single::before{display:none;}
      .icm-payer-item{display:flex;flex-direction:column;gap:6px;text-align:left;padding-right:18px;}
      .icm-payer-item + .icm-payer-item{padding-left:20px;padding-right:0;}
      .icm-payer-item-label{font-size:12px;font-weight:600;color:#334155;}
      .icm-payer-item-value{font-size:13.5px;font-weight:700;color:#0f172a;}
      .icm-payer-info{margin-top:4px;background:#fff;border:1.5px solid #bfd6fb;border-radius:10px;padding:13px 16px;display:grid;grid-template-columns:1fr 1fr;gap:18px;}
      .icm-payer-info-item{display:flex;flex-direction:column;gap:4px;}
      .icm-payer-info-label{font-size:11px;font-weight:700;color:#64748b;}
      .icm-payer-info-value{font-size:14px;font-weight:700;color:#0f172a;}
     .icm-settings-gap{display:grid;grid-template-columns:0.85fr 1px 0.75fr 1px 1.3fr;padding:0!important;}
.icm-sg-col{padding:20px;}
.icm-sg-divider{background:#e5e9f0;}

.icm-claimtype-opts{display:flex;gap:10px;margin-top:8px;}
.icm-claimtype-btn{
  flex:1;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:7px;
  padding:11px 10px;
  border-radius:10px;
  border:1.5px solid #e5e9f0;
  background:#fff;
  color:#64748b;
  font-family:inherit;
  font-size:12.5px;
  font-weight:600;
  cursor:pointer;
  transition:all .15s;
  white-space:nowrap;
}
.icm-claimtype-btn:hover{border-color:#c4b5fd;}
.icm-claimtype-btn.sel{
  border-color:#a78bfa;
  background:#f5f3ff;
  color:#5b21b6;
  font-weight:700;
  box-shadow:0 0 0 1px #a78bfa inset;
}
.icm-claimtype-info{
  margin-left:auto;
  width:15px;
  height:15px;
  border-radius:50%;
  border:1.5px solid #c4b5fd;
  color:#7c3aed;
  font-size:9.5px;
  font-weight:700;
  display:flex;
  align-items:center;
  justify-content:center;
  flex-shrink:0;
  cursor:default;
}
      .icm-sg-divider{background:#e5e9f0;}
      .icm-checkbox-row{display:flex;align-items:center;gap:9px;cursor:pointer;user-select:none;}
      .icm-checkbox{width:18px;height:18px;border-radius:5px;border:1.5px solid #cbd5e1;accent-color:#2563eb;cursor:pointer;}
      .icm-checkbox-label{font-size:13px;font-weight:600;color:#334155;}
      .icm-gap-amt{margin-top:14px;display:flex;align-items:center;gap:8px;}
      .icm-gap-amt label{font-size:11.5px;font-weight:700;color:#334155;white-space:nowrap;}
      .icm-lines-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:12px;flex-wrap:wrap;}
      .icm-add-line-top{border:1.5px dashed #93b4f5;background:#fff;color:#2563eb;font-size:11.5px;font-weight:700;padding:6px 13px;border-radius:7px;cursor:pointer;flex-shrink:0;}
      .icm-add-line-top:hover{background:#eef4ff;}
      /* UPDATED: sentence-case, no letter-spacing, matches target font exactly */
      .icm-col-hdr{font-size:13px;font-weight:600;color:#0f172a;text-transform:none;letter-spacing:normal;}
      /* UPDATED: removed 2px side padding so headers align flush with inputs below */
      .icm-line-hdrs,.icm-line-row{display:grid;gap:12px;align-items:center;}
      .icm-line-hdrs{padding:0 0 10px 0;}
      .icm-line-row{padding:10px 0;border-top:1px solid #f0f2f5;}
      /* FIXED: DatePicker renders a <button class="date-pick-btn"> inside <div class="date-pick-wrap">,
         not an <input> — target those exact classes to match the 40px height of .icm-input. */
      .icm-date-wrap{width:100%;}
      .icm-date-wrap .date-pick-wrap{position:relative;width:100%;height:40px;}
      .icm-date-wrap .date-pick-btn{
        width:100%;
        height:40px;
        box-sizing:border-box;
        display:flex;
        align-items:center;
        padding:0 34px 0 11px;
        border:1.5px solid #d7dee7;
        border-radius:8px;
        background:#fff;
        font-family:inherit;
        font-size:13px;
        color:#1e293b;
        cursor:pointer;
        text-align:left;
      }
      .icm-date-wrap .date-pick-btn.no-val{color:#94a3b8;}
      .icm-date-wrap .date-pick-btn:hover{border-color:#b7c3d6;}
      .icm-date-wrap .date-pick-btn.open{border-color:#2563eb;}
      .icm-date-wrap.err .date-pick-btn{border-color:#ef4444;}
      .icm-date-wrap .date-pick-ic{
        position:absolute;
        right:11px;
        top:50%;
        transform:translateY(-50%);
        pointer-events:none;
        font-size:14px;
        line-height:1;
      }
      .icm-del-btn{width:30px;height:30px;border-radius:8px;border:1.5px solid #fecaca;background:#fff;color:#ef4444;cursor:pointer;display:flex;align-items:center;justify-content:center;}
      .icm-del-btn:disabled{opacity:.35;cursor:not-allowed;}
      .icm-add-line-bottom{width:100%;margin-top:10px;padding:10px;border:1.5px dashed #cbd5e1;border-radius:9px;background:#fff;color:#2563eb;font-weight:700;font-size:12.5px;cursor:pointer;}
      .icm-add-line-bottom:hover{background:#f8fafc;}
      .icm-total-row{display:flex;align-items:center;justify-content:space-between;margin-top:14px;padding-top:14px;border-top:1.5px solid #e5e9f0;}
      .icm-api-err{padding:10px 12px;background:#fff1f2;border:1px solid #fecdd3;border-radius:8px;font-size:13px;color:#9f1239;}
      .icm-foot{flex-shrink:0;display:flex;justify-content:flex-end;gap:10px;padding:16px 20px;background:#f9fafb;border-top:1px solid #e5e9f0;}
      .icm-btn{padding:9px 18px;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;border:1.5px solid transparent;}
      .icm-btn-outline{background:#fff;border-color:#d7dee7;color:#334155;}
      .icm-btn-outline:hover{background:#f1f5f9;}
      .icm-btn-blue{background:#2563eb;color:#fff;}
      .icm-btn-blue:hover{background:#1d4ed8;}
      .icm-btn-blue:disabled,.icm-btn-outline:disabled{opacity:.6;cursor:not-allowed;}
      .icm-spin{display:inline-block;animation:icm-spin 0.8s linear infinite;}
      @keyframes icm-spin{to{transform:rotate(360deg);}}
@media (max-width:560px){
  .icm-settings-gap{grid-template-columns:1fr;}
  .icm-sg-divider{display:none;}
}
  .icm-payer-refdoc-row{display:grid;grid-template-columns:0.8fr 1.2fr;gap:14px;align-items:stretch;}
  .icm-payer-refdoc-row > .icm-card{display:flex;flex-direction:column;height:100%;}
@media (max-width:900px){
  .icm-payer-refdoc-row{grid-template-columns:1fr;}
  .icm-payer-refdoc-row > .icm-card{height:auto;}
}
}
    `}</style>

      <div className="icm-ov" onClick={onClose}>
        <div className="icm" onClick={(e) => e.stopPropagation()}>
          {/* HEADER */}
          <div className="icm-hdr">
            <div className="icm-hdr-row">
              <div>
                <div className="icm-title">
                  <Icon name="doc" size={18} style={{ color: "#fff" }} />
                  New Insurance Claim
                </div>
                <div className="icm-sub">
                  Status → <span className="icm-status-pill">Draft</span>
                </div>
              </div>
              <button className="icm-x" onClick={onClose}>
                <Icon name="x" size={15} />
              </button>
            </div>
          </div>

          <div className="icm-body">
            {loading ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "32px",
                  color: "var(--ink3)",
                  fontSize: 13,
                }}
              >
                <span
                  className="icm-spin"
                  style={{ fontSize: 22, display: "block", marginBottom: 8 }}
                >
                  ⟳
                </span>
                Loading…
              </div>
            ) : (
              <>
                {/* PROVIDER */}
                <div className="icm-card">
                  <div className="icm-sec-hdr">
                    <span
                      className="icm-badge"
                      style={{ background: "#dbeafe", color: "#2563eb" }}
                    >
                      <Icon name="lock" size={14} />
                    </span>
                    <span
                      className="icm-sec-label"
                      style={{ color: "#2563eb" }}
                    >
                      Provider — pre-filled
                    </span>
                  </div>
                  <div
                    className="icm-grid"
                    style={{ gridTemplateColumns: "1fr 1fr 1fr" }}
                  >
                    <div className="icm-field">
                      <label>Doctor</label>
                      <input
                        className="icm-input"
                        value={dDoc?.name || "—"}
                        readOnly
                      />
                    </div>
                    <div className="icm-field">
                      <label>Hospital</label>
                      <input
                        className="icm-input"
                        value={dHosp?.name || "—"}
                        readOnly
                      />
                    </div>
                    <div className="icm-field">
                      <label>Staff</label>
                      <input
                        className="icm-input"
                        value={staffLoad ? "Loading…" : staff?.name || "—"}
                        readOnly
                        title={
                          staff
                            ? `Staff ID: ${staff.id}`
                            : "No staff matched to login user"
                        }
                      />
                      {!staffLoad && !staff && (
                        <span className="icm-hint">
                          No staff matched to your login — check All_Staffs
                          Email field
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* PATIENT */}
                <div className="icm-card">
                  <div className="icm-sec-hdr">
                    <span
                      className="icm-badge"
                      style={{ background: "#dcfce7", color: "#16a34a" }}
                    >
                      <Icon name="user" size={14} />
                    </span>
                    <span
                      className="icm-sec-label"
                      style={{ color: "#16a34a" }}
                    >
                      Patient
                    </span>
                  </div>
                  <div
                    className="icm-field"
                    style={{ flex: "1 1 auto", minWidth: 0 }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "nowrap",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                        <label
                          style={{ display: "block", textAlign: "center" }}
                        >
                          Patient <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <PatientDropdown
                          patients={patients}
                          value={f.patientId}
                          onChange={(v) => upd("patientId", v)}
                          error={!!errors.patientId}
                          onNewPatient={() => setShowCreatePat(true)}
                          onViewPatient={handleViewPatient}
                          showActions={false}
                        />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexShrink: 0,
                          alignSelf: "flex-end",
                        }}
                      >
                        <button
                          type="button"
                          className="icm-edit-btn"
                          onClick={() =>
                            selectedPatient &&
                            handleViewPatient(selectedPatient)
                          }
                          disabled={!selectedPatient}
                          title={
                            selectedPatient
                              ? "Edit patient details"
                              : "Select a patient first"
                          }
                        >
                          <Icon name="edit" size={14} />
                        </button>
                        <button
                          type="button"
                          className="icm-new-btn"
                          onClick={() => setShowCreatePat(true)}
                          title="Create a new patient"
                        >
                          ＋ New
                        </button>
                      </div>
                    </div>
                    {patients.length === 0 && (
                      <span className="icm-hint">
                        No patients loaded — check Add_Patient_Report
                      </span>
                    )}
                    {errors.patientId && (
                      <span className="icm-err">{errors.patientId}</span>
                    )}
                  </div>
                </div>

                <div className="icm-payer-refdoc-row">
                  {/* PAYER — both fields kept, merged into one styled card */}
                  <div
                    className="icm-card icm-payer-card"
                    style={{ marginBottom: 0 }}
                  >
                    <div className="icm-sec-hdr" style={{ marginBottom: 12 }}>
                      <span
                        className="icm-badge"
                        style={{ background: "#dbeafe", color: "#2563eb" }}
                      >
                        <Icon name="wallet" size={14} />
                      </span>
                      <span
                        className="icm-sec-label"
                        style={{ color: "#2563eb" }}
                      >
                        Payer Information
                      </span>
                    </div>

                    {(() => {
                      if (!f.patientId) {
                        return (
                          <div className="icm-payer-empty">
                            Select a patient to load payer details
                          </div>
                        );
                      }
                      if (payerLoad) {
                        return (
                          <div className="icm-payer-empty">
                            <span className="spin">⟳</span> Loading payer
                            details…
                          </div>
                        );
                      }
                      const payerName = f.claimPayerName || "";
                      const membershipNo = f.claimMembershipNo || "";
                      const numberLabel = f.claimIsMedicare
                        ? "Medicare Number"
                        : "Membership Number";
                      if (!payerName && !membershipNo) {
                        return (
                          <div className="icm-payer-empty">
                            No payer set on this patient — use ✎ to add one
                          </div>
                        );
                      }
                      return (
                        <div
                          className={`icm-payer-box${
                            membershipNo ? "" : " single"
                          }`}
                        >
                          <div className="icm-payer-item">
                            <span className="icm-payer-item-label">Payer</span>
                            <span className="icm-payer-item-value">
                              {payerName || "—"}
                            </span>
                          </div>
                          {membershipNo && (
                            <div className="icm-payer-item">
                              <span className="icm-payer-item-label">
                                {numberLabel}
                              </span>
                              <span className="icm-payer-item-value">
                                {membershipNo}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {errors.claimPayerId && (
                      <div className="icm-err" style={{ marginTop: 8 }}>
                        {errors.claimPayerId}
                      </div>
                    )}
                  </div>

                  {/* REFERRING DOCTOR */}
                  <div className="icm-card" style={{ marginBottom: 0 }}>
                    <div className="icm-sec-hdr">
                      <span
                        className="icm-badge"
                        style={{ background: "#ede9fe", color: "#7c3aed" }}
                      >
                        <Icon name="user" size={14} />
                      </span>
                      <span
                        className="icm-sec-label"
                        style={{ color: "#7c3aed" }}
                      >
                        Referring Doctor Details
                        <span
                          style={{
                            color: "var(--ink3)",
                            fontWeight: 500,
                            fontSize: 11,
                            textTransform: "none",
                            marginLeft: 6,
                          }}
                        >
                          (optional)
                        </span>
                      </span>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.3fr 1fr auto",
                        gap: 12,
                        alignItems: "flex-end",
                      }}
                    >
                      <div className="icm-field" style={{ minWidth: 0 }}>
                        <label>Referring Doctor</label>
                        <HealthFundDropdown
                          funds={referringDoctors}
                          value={f.referringDoctorId}
                          onChange={(id) => {
                            const match = referringDoctors.find(
                              (d) => d.id === id
                            );
                            setF((x) => ({
                              ...x,
                              referringDoctorId: id,
                              providerNumber:
                                x.providerNumber || match?.providerNumber || "",
                            }));
                          }}
                          placeholder="-Select Referring Doctor-"
                        />
                      </div>
                      <div className="icm-field" style={{ minWidth: 0 }}>
                        <label>Referring Doctor Provider Number</label>
                        <input
                          className="icm-input"
                          value={
                            referringDoctors.find(
                              (d) => d.id === f.referringDoctorId
                            )?.providerNumber || ""
                          }
                          readOnly
                          placeholder="Auto-filled"
                        />
                      </div>

                      <button
                        type="button"
                        className="icm-new-btn"
                        style={{
                          background: "#fff",
                          color: "#7c3aed",
                          border: "1.5px solid #c4b5fd",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                        onClick={() => setShowAddRefDoc(true)}
                      >
                        ＋ Add New Referring Doctor
                      </button>
                    </div>

                    {showAddRefDoc && (
                      <div
                        style={{
                          marginTop: 12,
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <input
                          className="icm-input"
                          style={{ flex: "1 1 200px" }}
                          placeholder="New referring doctor name"
                          value={newRefDocName}
                          onChange={(e) => setNewRefDocName(e.target.value)}
                          disabled={addingRefDoc}
                        />
                        <input
                          className="icm-input"
                          style={{ flex: "1 1 160px" }}
                          placeholder="Provider number"
                          value={newRefDocProvider}
                          onChange={(e) => setNewRefDocProvider(e.target.value)}
                          disabled={addingRefDoc}
                        />
                        <button
                          type="button"
                          className="icm-btn icm-btn-blue"
                          disabled={addingRefDoc || !newRefDocName.trim()}
                          onClick={async () => {
                            if (!newRefDocName.trim()) return;
                            setAddingRefDoc(true);
                            try {
                              if (isZohoAvailable()) {
                                const result =
                                  await createReferringDoctorRecord({
                                    name: newRefDocName.trim(),
                                    providerNumber: newRefDocProvider.trim(),
                                  });
                                if (result.success && result.recordId) {
                                  const newDoc = {
                                    id: String(result.recordId),
                                    name: newRefDocName.trim(),
                                    providerNumber: newRefDocProvider.trim(),
                                  };
                                  setReferringDoctors((prev) => [
                                    newDoc,
                                    ...prev,
                                  ]);
                                  setF((x) => ({
                                    ...x,
                                    referringDoctorId: newDoc.id,
                                    providerNumber:
                                      x.providerNumber || newDoc.providerNumber,
                                  }));
                                } else {
                                  console.error(
                                    "[NewClaimModal] Failed to create referring doctor:",
                                    result.error
                                  );
                                }
                              } else {
                                const newDoc = {
                                  id: `local-${Date.now()}`,
                                  name: newRefDocName.trim(),
                                  providerNumber: newRefDocProvider.trim(),
                                };
                                setReferringDoctors((prev) => [
                                  newDoc,
                                  ...prev,
                                ]);
                                setF((x) => ({
                                  ...x,
                                  referringDoctorId: newDoc.id,
                                  providerNumber:
                                    x.providerNumber || newDoc.providerNumber,
                                }));
                              }
                            } finally {
                              setAddingRefDoc(false);
                              setNewRefDocName("");
                              setNewRefDocProvider("");
                              setShowAddRefDoc(false);
                            }
                          }}
                        >
                          {addingRefDoc ? (
                            <>
                              <span className="icm-spin">⟳</span> Adding…
                            </>
                          ) : (
                            "Add"
                          )}
                        </button>
                        <button
                          type="button"
                          className="icm-btn icm-btn-outline"
                          disabled={addingRefDoc}
                          onClick={() => {
                            setShowAddRefDoc(false);
                            setNewRefDocName("");
                            setNewRefDocProvider("");
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    <div
                      style={{
                        fontSize: 10.5,
                        color: "var(--ink4)",
                        marginTop: 8,
                      }}
                    >
                      Referring doctor details are used for record purposes only
                      and will not be billed.
                    </div>
                  </div>
                </div>
                {/* NOTES */}
<div className="icm-card">
  <div className="icm-sec-hdr">
    <span
      className="icm-badge"
      style={{ background: "#f1f5f9", color: "#475569" }}
    >
      <Icon name="edit" size={14} />
    </span>
    <span className="icm-sec-label" style={{ color: "#475569" }}>
      Notes
      <span
        style={{
          color: "var(--ink3)",
          fontWeight: 500,
          fontSize: 11,
          textTransform: "none",
          marginLeft: 6,
        }}
      >
        (optional)
      </span>
    </span>
  </div>
  <textarea
    className="icm-input"
    style={{
      height: "auto",
      minHeight: 70,
      padding: "9px 11px",
      resize: "vertical",
      fontFamily: "inherit",
    }}
    placeholder="Add any notes or comments about this claim…"
    value={f.notes}
    onChange={(e) => upd("notes", e.target.value)}
  />
</div>
                {/* CLAIM SETTINGS + GAP + CLAIM TYPE — one card, three columns, two shared dividers */}
                <div className="icm-card icm-settings-gap">
                  <div className="icm-sg-col">
                    <div className="icm-sec-hdr">
                      <span
                        className="icm-badge"
                        style={{ background: "#ede9fe", color: "#7c3aed" }}
                      >
                        <Icon name="settings" size={14} />
                      </span>
                      <span
                        className="icm-sec-label"
                        style={{ color: "#7c3aed" }}
                      >
                        Claim Settings
                      </span>
                    </div>
                    <div className="icm-field">
                      <label>Assistant Surgeon</label>
                      <select
                        className="icm-select"
                        value={f.assistantSurgeons}
                        onChange={(e) =>
                          upd("assistantSurgeons", e.target.value)
                        }
                      >
                        <option value="No">No</option>
                        <option value="Yes">Yes</option>
                      </select>
                    </div>
{showAsstCol && (
  <div className="icm-field" style={{ marginTop: 14 }}>
    <label>Primary Surgeon</label>
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <HealthFundDropdown
          funds={assistantSurgeonOptions}
          value={f.primarySurgeon}
          onChange={(id) => {
            const match = assistantSurgeonOptions.find((s) => s.id === id);
            setF((x) => ({
              ...x,
              primarySurgeon: id,
              primarySurgeonName: match?.name || "",       // ← NEW: text sent to Zoho
              primarySurgeonItemNumbers: match?.itemNumber || "",
            }));
          }}
          placeholder="-Select Primary Surgeon-"
        />
      </div>
      <button
        type="button"
        className="icm-new-btn"
        style={{
          background: "#fff",
          color: "#16a34a",
          border: "1.5px solid #86efac",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
        onClick={() => setShowAddPrimarySurgeon(true)}
      >
        ＋ New
      </button>
    </div>

    {showAddPrimarySurgeon && (
      <div
        style={{
          marginTop: 12,
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <input
          className="icm-input"
          style={{ flex: "1 1 200px" }}
          placeholder="New primary surgeon name"
          value={newPrimarySurgeonName}
          onChange={(e) => setNewPrimarySurgeonName(e.target.value)}
          disabled={addingPrimarySurgeon}
        />
        <input
          className="icm-input"
          style={{ flex: "1 1 160px" }}
          placeholder="Item number"
          value={newPrimarySurgeonItemNumber}
          onChange={(e) => setNewPrimarySurgeonItemNumber(e.target.value)}
          disabled={addingPrimarySurgeon}
        />
        <button
          type="button"
          className="icm-btn icm-btn-blue"
          disabled={addingPrimarySurgeon || !newPrimarySurgeonName.trim()}
          onClick={async () => {
            if (!newPrimarySurgeonName.trim()) return;
            setAddingPrimarySurgeon(true);
            try {
              if (isZohoAvailable()) {
                const result = await createAssistantSurgeonRecord({
                  name: newPrimarySurgeonName.trim(),
                  itemNumber: newPrimarySurgeonItemNumber.trim(),
                });
                if (result.success && result.recordId) {
                  const newSurgeon = {
                    id: String(result.recordId),
                    name: newPrimarySurgeonName.trim(),
                    itemNumber: newPrimarySurgeonItemNumber.trim(),
                  };
                  setAssistantSurgeonOptions((prev) => [newSurgeon, ...prev]);
                  setF((x) => ({
                    ...x,
                    primarySurgeon: newSurgeon.id,
                    primarySurgeonName: newSurgeon.name,
                    primarySurgeonItemNumbers: newSurgeon.itemNumber,
                  }));
                } else {
                  console.error(
                    "[NewClaimModal] Failed to create primary surgeon:",
                    result.error
                  );
                }
              } else {
                const newSurgeon = {
                  id: `local-${Date.now()}`,
                  name: newPrimarySurgeonName.trim(),
                  itemNumber: newPrimarySurgeonItemNumber.trim(),
                };
                setAssistantSurgeonOptions((prev) => [newSurgeon, ...prev]);
                setF((x) => ({
                  ...x,
                  primarySurgeon: newSurgeon.id,
                  primarySurgeonName: newSurgeon.name,
                  primarySurgeonItemNumbers: newSurgeon.itemNumber,
                }));
              }
            } finally {
              setAddingPrimarySurgeon(false);
              setNewPrimarySurgeonName("");
              setNewPrimarySurgeonItemNumber("");
              setShowAddPrimarySurgeon(false);
            }
          }}
        >
          {addingPrimarySurgeon ? (
            <>
              <span className="icm-spin">⟳</span> Adding…
            </>
          ) : (
            "Add"
          )}
        </button>
        <button
          type="button"
          className="icm-btn icm-btn-outline"
          disabled={addingPrimarySurgeon}
          onClick={() => {
            setShowAddPrimarySurgeon(false);
            setNewPrimarySurgeonName("");
            setNewPrimarySurgeonItemNumber("");
          }}
        >
          Cancel
        </button>
      </div>
    )}
  </div>
)}
{showAsstCol && (
  <div className="icm-field" style={{ marginTop: 14 }}>
    <label>Primary Surgeon Item Numbers</label>
    <input
      className="icm-input"
      value={f.primarySurgeonItemNumbers}
      readOnly
      placeholder="Auto-filled from Primary Surgeon"
    />
  </div>
)}
                  </div>

                  <div className="icm-sg-divider" />

                  <div className="icm-sg-col">
                    <div className="icm-sec-hdr">
                      <span
                        className="icm-badge"
                        style={{ background: "#fef3c7", color: "#d97706" }}
                      >
                        <Icon name="dollar" size={14} />
                      </span>
                      <span
                        className="icm-sec-label"
                        style={{ color: "#d97706" }}
                      >
                        Gap
                      </span>
                    </div>
                    <label className="icm-checkbox-row">
                      <input
                        type="checkbox"
                        className="icm-checkbox"
                        checked={f.gap}
                        onChange={() => upd("gap", !f.gap)}
                      />
                      <span className="icm-checkbox-label">Enable Gap</span>
                    </label>
                    {f.gap && (
                      <div className="icm-gap-amt">
                        <label>Gap Amount</label>
                        <input
                          className="icm-input"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={f.gapAmount}
                          onChange={(e) => upd("gapAmount", e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  <div className="icm-sg-divider" />

                  <div className="icm-sg-col">
                    <div className="icm-sec-hdr">
                      <span
                        className="icm-badge"
                        style={{
                          background: "#ede9fe",
                          color: "#7c3aed",
                          flexShrink: 0,
                        }}
                      >
                        <Icon name="doc" size={14} />
                      </span>
                      <span
                        className="icm-sec-label"
                        style={{ color: "#7c3aed" }}
                        title="Claim Type (Admission Type)"
                      >
                        Claim Type (Admission Type)
                      </span>
                      {/* <span className="icm-claimtype-info" style={{ flexShrink: 0 }} title="Select whether this claim is for an inpatient or outpatient admission">i</span> */}
                    </div>
                    <div className="icm-claimtype-opts">
                      {["Inpatient", "Outpatient"].map((opt) => (
                        <button
                          type="button"
                          key={opt}
                          className={`icm-claimtype-btn ${
                            f.claimType === opt ? "sel" : ""
                          }`}
                          onClick={() => upd("claimType", opt)}
                        >
                          {opt === "Inpatient"
                            ? "🛏 Inpatient"
                            : "🧍 Outpatient"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* CLAIM LINES */}
                <div className="icm-card">
                  <div className="icm-lines-hdr">
<div className="icm-sec-hdr" style={{ marginBottom: 0 }}>
  <span
    className="icm-badge-square"
    style={{ background: "#dbeafe", color: "#2563eb" }}
  >
    <Icon name="list" size={14} />
  </span>
  <span
    className="icm-sec-label"
    style={{
      color: "#1e3a70",
      display: "flex",
      alignItems: "center",
      gap: 9,
    }}
  >
    Claim Lines
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        fontWeight: 700,
        color: "#1d4ed8",
        background: "linear-gradient(135deg,#eff6ff,#dbeafe)",
        border: "1px solid #bfdbfe",
        borderRadius: 20,
        padding: "3px 12px 3px 10px",
        textTransform: "none",
        letterSpacing: 0,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: "#2563eb",
          flexShrink: 0,
        }}
      />
      {lines.length} line{lines.length !== 1 ? "s" : ""}
    </span>
    {(errors.lines || errors.lineItemNo) && (
      <span
        style={{
          color: "#ef4444",
          fontWeight: 500,
          fontSize: 10.5,
          textTransform: "none",
          letterSpacing: 0,
        }}
      >
        {errors.lines || errors.lineItemNo}
      </span>
    )}
  </span>
</div>
                    <button className="icm-add-line-top" onClick={addLn}>
                      ＋ Add Line Item
                    </button>
                  </div>

                  {/* CHANGED: header labels now sentence-case via updated .icm-col-hdr rule, aligned flush with inputs below */}
                  <div
                    className="icm-line-hdrs"
                    style={{
                      gridTemplateColumns: col || "1.3fr 1.15fr 0.85fr 40px",
                    }}
                  >
                    <span className="icm-col-hdr">
                      Date of Service{" "}
                      <span style={{ color: "#ef4444" }}>*</span>
                    </span>
                    <span className="icm-col-hdr">
                      Item No. <span style={{ color: "#ef4444" }}>*</span>
                    </span>
                    <span className="icm-col-hdr">
                      Amount <span style={{ color: "#ef4444" }}>*</span>
                    </span>
                    <span />
                  </div>

                  {lines.map((ln, i) => {
                    const showDateError =
                      !!errors.lineDate &&
                      !String(ln.dateOfService || "").trim();
                    const showAmountError =
                      !!errors.lineAmount &&
                      (!String(ln.amountCharged || "").trim() ||
                        Number(ln.amountCharged) <= 0);
                    return (
                      <div
                        key={i}
                        className="icm-line-row"
                        style={{
                          gridTemplateColumns:
                            col || "1.3fr 1.15fr 0.85fr 40px",
                        }}
                      >
                        <div
                          className={`icm-date-wrap${
                            showDateError ? " err" : ""
                          }`}
                        >
                          <DatePicker
                            value={ln.dateOfService}
                            onChange={(v) => updLn(i, "dateOfService", v)}
                            placeholder="DD-MMM-YYYY"
                            maxDate={new Date()}
                            editable
                          />
                        </div>
                        {/* ── REPLACED: Item No. text input → Item lookup dropdown ── */}
                        {/* was: <ItemDropdown funds={items} value={ln.itemId} onChange={...} /> */}
                        <div
                          className={
                            errors.lineItemNo && !ln.itemId
                              ? "icm-input err"
                              : ""
                          }
                          style={{
                            padding: 0,
                            border: "none",
                            background: "none",
                          }}
                        >
                          <ItemSearchDropdown
                            value={ln.itemId}
                            label={ln.itemNo}
                            error={!!(errors.lineItemNo && !ln.itemId)}
                            onChange={(item) => setLineItem(i, item)}
                          />
                        </div>
                        <input
                          className={`icm-input${
                            showAmountError ? " err" : ""
                          }`}
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={ln.amountCharged}
                          onChange={(e) =>
                            updLn(i, "amountCharged", e.target.value)
                          }
                        />
                        <button
                          className="icm-del-btn"
                          onClick={() => delLn(i)}
                          disabled={lines.length === 1}
                          title="Remove line"
                        >
                          <Icon name="x" size={12} />
                        </button>
                      </div>
                    );
                  })}
                  <button className="icm-add-line-bottom" onClick={addLn}>
                    ＋ Add Another Line Item
                  </button>

                  {(errors.lines || errors.lineItemNo || errors.lineDate) && (
                    <div
                      style={{
                        padding: "8px 10px",
                        marginTop: 8,
                        color: "#ef4444",
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      {errors.lines || errors.lineDate || errors.lineItemNo}
                    </div>
                  )}

<div className="icm-total-row">
  <span
    style={{
      fontSize: 12.5,
      fontWeight: 700,
      color: "#334155",
      display: "flex",
      alignItems: "center",
      gap: 8,
    }}
  >
    Total
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 800,
        color: "#2563eb",
        background: "#dbeafe",
        border: "1px solid #bfdbfe",
        borderRadius: 20,
        padding: "1px 9px",
      }}
    >
      {lines.length} line{lines.length !== 1 ? "s" : ""}
    </span>
  </span>
  <span
    style={{
      fontFamily: "monospace",
      fontSize: 18,
      fontWeight: 800,
      color: "#16a34a",
    }}
  >
    {INR(autoTotal)}
  </span>
</div>
                </div>

                {errors.api && (
                  <div className="icm-api-err">⚠ {errors.api}</div>
                )}
              </>
            )}
          </div>

          {/* FOOTER */}
          <div className="icm-foot">
            <button
              className="icm-btn icm-btn-outline"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className="icm-btn icm-btn-blue"
              onClick={handleSave}
              disabled={saving || loading}
            >
              {saving ? (
                <>
                  <span className="icm-spin">⟳</span> Saving…
                </>
              ) : (
                "Submit for Approval"
              )}
            </button>
          </div>
        </div>
      </div>

      {showCreatePat && (
        <CreatePatientPopup
          onClose={() => setShowCreatePat(false)}
          onCreated={(p) => {
            setPatients((prev) => [
              { ...p, id: String(p.id) },
              ...prev.filter((q) => String(q.id) !== String(p.id)),
            ]);
            upd("patientId", String(p.id));
          }}
        />
      )}
{showEditPat && editPatient && (
  <CreatePatientPopup
    patient={editPatient}
    forClaim={true}                         // NEW
    onClaimPayerSelected={(payer) => {       // NEW
      setF((x) => ({
        ...x,
        claimPayerId: payer.payerId,
        claimPayerName: payer.payerName,
        claimMembershipNo: payer.membershipNumber,
        claimIsMedicare: payer.isMedicare,
      }));
      setShowEditPat(false);
      setEditPatient(null);
    }}
    onClose={() => {
      setShowEditPat(false);
      setEditPatient(null);
    }}
    onSaved={() => {}} // unused in this mode
  />
)}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────
   PAYMENT CONFIRM POPUP  (NEW)
   Opens when user clicks Payment — collects payer name + method,
   shows patient (auto), allocate amount = sum of selected claims'
   Balance_Due, then submits.
───────────────────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────────────────────
   PAYMENT CONFIRM POPUP  (FIXED — adds "Full Amount" quick-fill,
   step="0.01", and rounds every comparison through roundCents so
   the field can never land 1 cent off from what's being validated)
───────────────────────────────────────────────────────────────── */

function PaymentConfirmPopup({
  selectedClaims,
  onClose,
  onConfirm,
  processing,
}) {
  const [allocateAmount, setAllocateAmount] = useState("");
  const [errors, setErrors] = useState({});

  const totalBalanceDue = roundCents(
    selectedClaims.reduce((t, c) => t + (Number(c.balanceDue) || 0), 0)
  );
  const enteredAmt = roundCents(Number(allocateAmount) || 0);

  const validate = () => {
    const e = {};
    if (!allocateAmount || enteredAmt <= 0)
      e.allocateAmount = "Enter a valid amount";
    else if (exceeds(enteredAmt, totalBalanceDue))
      e.allocateAmount = `Cannot be higher than total balance due ${INR(
        totalBalanceDue
      )}`;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // NEW — fills the field with the exact rounded total balance due.
  // This is the safe path: it can never trigger the "exceeds" check
  // because it IS totalBalanceDue, rounded the same way validate() rounds it.
  const fillFullAmount = () => {
    setAllocateAmount(String(totalBalanceDue));
    setErrors({});
  };

  const handleAmountChange = (e) => {
    const val = e.target.value;
    setAllocateAmount(val);

    if (val === "") {
      setErrors({});
      return;
    }

    const num = roundCents(Number(val) || 0);
    if (num <= 0) {
      setErrors({});
      return;
    }
    if (exceeds(num, totalBalanceDue)) {
      setErrors({
        allocateAmount: `Cannot be higher than total balance due ${INR(
          totalBalanceDue
        )}`,
      });
    } else {
      setErrors({});
    }
  };

  const remaining = roundCents(Math.max(0, totalBalanceDue - enteredAmt));
  const isValidEntry =
    enteredAmt > 0 && !exceeds(enteredAmt, totalBalanceDue);

  return (
    <div className="pcp-ov" onClick={onClose}>
<div
  className="pcp"
  onClick={(e) => e.stopPropagation()}
  style={{ maxWidth: 420 }}
>
        <div className="pcp-hdr">
          <div className="pcp-hdr-row">
            <div>
              <div className="pcp-title">💳 Payment</div>
              <div className="pcp-sub">
                {selectedClaims.length} claim
                {selectedClaims.length !== 1 ? "s" : ""} selected ·{" "}
                {
                  [...new Set(selectedClaims.map((c) => c.pat).filter(Boolean))]
                    .length
                }{" "}
                patient
                {[...new Set(selectedClaims.map((c) => c.pat).filter(Boolean))]
                  .length !== 1
                  ? "s"
                  : ""}
              </div>
            </div>
            <button className="pcp-x" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        <div className="pcp-body">
          <div className="pcp-amt-box" style={{ marginBottom: 18 }}>
            <div>
              <div className="pcp-amt-label">Total Balance Due</div>
              <div style={{ fontSize: 11, color: "#166534", marginTop: 2 }}>
                Sum of balance due across selected claims
              </div>
            </div>
            <div className="pcp-amt-value">{INR(totalBalanceDue)}</div>
          </div>

          <div className="pcp-field">
            <label className="pcp-label">
              Allocate Amount <span style={{ color: "#ef4444" }}>*</span>
            </label>

            <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
              <input
                className="pcp-input"
                type="number"
                min="0"
                step="0.01"
                placeholder="Enter amount to allocate…"
                value={allocateAmount}
                onChange={handleAmountChange}
                style={{ flex: 1 }}
              />
              {/* NEW — one-click exact fill, avoids manual-typing cent mismatches */}
              <button
                type="button"
                className="btn b-outline b-sm"
                onClick={fillFullAmount}
                title={`Fill exact total balance due (${INR(totalBalanceDue)})`}
                style={{ whiteSpace: "nowrap", flexShrink: 0 }}
              >
                Full Amount
              </button>
            </div>

            {errors.allocateAmount && (
              <span className="pcp-err">{errors.allocateAmount}</span>
            )}

            {isValidEntry && (
              <span
                style={{
                  fontSize: 11,
                  color: "var(--grn)",
                  marginTop: 3,
                  display: "block",
                }}
              >
                ✓ Allocated: {INR(enteredAmt)} of {INR(totalBalanceDue)} balance
                due
                {remaining > 0 && (
                  <>
                    {" "}
                    · Remaining after this: <strong>{INR(remaining)}</strong>
                  </>
                )}
              </span>
            )}

            {enteredAmt > totalBalanceDue && (
              <span
                style={{
                  fontSize: 11,
                  color: "#ef4444",
                  marginTop: 3,
                  display: "block",
                }}
              >
                ✗ Entered {INR(enteredAmt)} exceeds total balance due{" "}
                {INR(totalBalanceDue)} —{" "}
                <span
                  style={{
                    textDecoration: "underline",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                  onClick={fillFullAmount}
                >
                  click here to fix
                </span>
              </span>
            )}
          </div>
        </div>

        <div className="pcp-foot">
          <button
            className="btn b-outline b-sm"
            onClick={onClose}
            disabled={processing}
          >
            Cancel
          </button>
          <button
            className="btn b-green"
            onClick={() => {
              if (validate())
                onConfirm({
                  allocateAmount: enteredAmt,
                  totalBalanceDue,
                });
            }}
            disabled={processing || !isValidEntry}
            style={{ minWidth: 120, justifyContent: "center" }}
          >
            {processing ? (
              <>
                <span className="spin">⟳</span> Processing…
              </>
            ) : (
              "Next →"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function PayerDropdown({ value, onChange, error }) {
  const [funds, setFunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    if (isZohoAvailable()) {
      loadHealthFunds()
        .then((funds) => {
          if (!cancelled) setPatientFunds(funds);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    if (isZohoAvailable()) {
      loadHealthFunds()
        .then((fetchedFunds) => {
          if (!cancelled) {
            setFunds(fetchedFunds);
            setLoading(false);
          }
        })
        .catch((err) => {
          console.error("[PayerDropdown] loadHealthFunds failed:", err);
          if (!cancelled) setLoading(false);
        });
    } else {
      setLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    const h = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus();
  }, [open]);

  const filtered = funds.filter((f) =>
    f.name.toLowerCase().includes(query.toLowerCase())
  );
  const selected = funds.find((f) => f.name === value);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          padding: "9px 32px 9px 11px",
          background: open ? "#fff" : "var(--s1)",
          border: `1.5px solid ${
            error ? "#ef4444" : open ? "var(--grn)" : "var(--b1)"
          }`,
          borderRadius: 8,
          fontFamily: "var(--fn)",
          fontSize: 12.5,
          color: value ? "var(--ink)" : "var(--ink4)",
          fontWeight: value ? 600 : 400,
          textAlign: "left",
          cursor: "pointer",
          outline: "none",
          boxShadow: open
            ? "0 0 0 3px rgba(22,163,74,.1)"
            : error
            ? "0 0 0 3px rgba(239,68,68,.1)"
            : "none",
          transition: "all .15s",
          display: "flex",
          alignItems: "center",
        }}
      >
        <span
          style={{
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {loading ? "Loading…" : value || "Select payer…"}
        </span>
        {value && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            style={{
              position: "absolute",
              right: 28,
              top: "50%",
              transform: "translateY(-50%)",
              width: 15,
              height: 15,
              borderRadius: "50%",
              background: "var(--ink4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 8,
              fontWeight: 800,
              color: "#fff",
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ✕
          </span>
        )}
      </button>
      <span
        style={{
          position: "absolute",
          right: 9,
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: 10,
          color: "var(--ink3)",
          pointerEvents: "none",
          transition: "transform .2s",
          display: "inline-block",
          rotate: open ? "180deg" : "0deg",
        }}
      >
        ▾
      </span>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 9999,
            background: "#fff",
            border: "1.5px solid var(--b1)",
            borderRadius: 10,
            boxShadow: "0 16px 48px rgba(0,0,0,.16)",
            overflow: "hidden",
            animation: "ddSlide .14s ease forwards",
          }}
        >
          {/* Search */}
          <div
            style={{
              padding: "8px 10px",
              borderBottom: "1px solid var(--b1)",
              background: "var(--s1)",
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            <span style={{ fontSize: 12, color: "var(--ink3)" }}>🔍</span>
            <input
              ref={searchRef}
              placeholder="Search payer…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{
                flex: 1,
                border: "1.5px solid var(--b1)",
                borderRadius: 6,
                padding: "5px 8px",
                fontFamily: "var(--fn)",
                fontSize: 12,
                color: "var(--ink)",
                outline: "none",
                background: "#fff",
                transition: "border-color .15s",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "var(--grn)";
                e.target.style.background = "#fff";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "var(--b1)";
                e.target.style.background = "#fff";
              }}
            />
          </div>
          {/* List */}
          <div
            style={{
              maxHeight: 200,
              overflowY: "auto",
              scrollbarWidth: "thin",
              scrollbarColor: "var(--b2) transparent",
            }}
          >
            {loading ? (
              <div
                style={{
                  padding: 14,
                  textAlign: "center",
                  fontSize: 12,
                  color: "var(--ink3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <span className="spin">⟳</span> Loading…
              </div>
            ) : filtered.length === 0 ? (
              <div
                style={{
                  padding: 14,
                  textAlign: "center",
                  fontSize: 12,
                  color: "var(--ink4)",
                }}
              >
                No payers found
              </div>
            ) : (
              filtered.map((f) => {
                const isActive = f.name === value;
                return (
                  <div
                    key={f.id}
                    onClick={() => {
                      onChange(f.name);
                      setOpen(false);
                      setQuery("");
                    }}
                    style={{
                      padding: "9px 12px",
                      cursor: "pointer",
                      fontSize: 12.5,
                      fontWeight: isActive ? 700 : 400,
                      color: isActive ? "var(--grn)" : "var(--ink)",
                      background: isActive ? "#f0fdf4" : "#fff",
                      borderBottom: "1px solid var(--b1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      transition: "background .1s",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive)
                        e.currentTarget.style.background = "var(--s1)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = "#fff";
                    }}
                  >
                    <span>{f.name}</span>
                    {isActive && (
                      <span
                        style={{
                          color: "var(--grn)",
                          fontWeight: 800,
                          fontSize: 13,
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Rounds to cents and compares with a tiny tolerance so exact-cent entries
// (e.g. entering 343.40 against a balance of 343.40) never get rejected
// due to floating-point drift.
const roundCents = (n) => Math.round((Number(n) || 0) * 100) / 100;
const exceeds = (a, b) => roundCents(a) > roundCents(b) + 0.005; // a > b, tolerant
function PaymentProcessView({
  selectedClaims,
  doctor,
  hospital,
  totalAllocateAmount,
  onBack,
  onConfirmPayment,
  processing,
}) {
  const uniquePatientNames = [
    ...new Set(selectedClaims.map((c) => c.pat).filter(Boolean)),
  ];
  const patientName =
    uniquePatientNames.length === 0
      ? "Unknown"
      : uniquePatientNames.length === 1
      ? uniquePatientNames[0]
      : uniquePatientNames.join(", ");

  const [claimLines, setClaimLines] = useState(() => {
    const init = {};
    selectedClaims.forEach((c) => {
      init[c.id] = c.svc && c.svc.length > 0 ? c.svc : null;
    });
    return init;
  });
  const [linesLoading, setLinesLoading] = useState({});

  useEffect(() => {
    selectedClaims.forEach(async (cl) => {
      const recordId = cl.recordId || cl.id;
      if (!recordId) return;
      setLinesLoading((prev) => ({ ...prev, [cl.id]: true }));
      try {
        const lines = isZohoAvailable() ? await loadClaimLines(recordId) : [];
        const resolved = lines.length > 0 ? lines : cl.svc || [];
        setClaimLines((prev) => ({ ...prev, [cl.id]: resolved }));
        const initBals = {};
        resolved.forEach((ln, i) => {
          const key = getLineAllocKey(cl.id, i);
          initBals[key] = Number(ln.balanceDue ?? ln.a ?? ln.r ?? 0);
        });
        setLineBalances((prev) => ({ ...prev, ...initBals }));
      } catch (err) {
        const fallback = cl.svc || [];
        setClaimLines((prev) => ({ ...prev, [cl.id]: fallback }));
        const initBals = {};
        fallback.forEach((ln, i) => {
          initBals[getLineAllocKey(cl.id, i)] = Number(
            ln.balanceDue ?? ln.a ?? ln.r ?? 0
          );
        });
        setLineBalances((prev) => ({ ...prev, ...initBals }));
      } finally {
        setLinesLoading((prev) => ({ ...prev, [cl.id]: false }));
      }
    });
  }, []);

  const [claimAllocates, setClaimAllocates] = useState(() => {
    const init = {};
    selectedClaims.forEach((c) => {
      init[c.id] = "";
    });
    return init;
  });
  const [lineAllocates, setLineAllocates] = useState({});
  const [lineBalances, setLineBalances] = useState({});
  const [claimFullPay, setClaimFullPay] = useState(() => {
    const init = {};
    selectedClaims.forEach((c) => {
      init[c.id] = false;
    });
    return init;
  });
  const [lineAdjustments, setLineAdjustments] = useState({}); // { lineKey: adjustmentAmount }
  const [claimAllocErrors, setClaimAllocErrors] = useState({}); // { claimId: errorMessage }
  const [gapAllocates, setGapAllocates] = useState(() => {
    // NEW: { claimId: gap amount being paid now }
    const init = {};
    selectedClaims.forEach((c) => {
      init[c.id] = "";
    });
    return init;
  });

  const getLineAllocKey = (claimId, lineIdx) => `${claimId}__${lineIdx}`;

  // FIX: floating-point drift — summing amounts like 113.90 + 175.40 + ... with
  // plain JS addition can produce 1680.7400000000001 instead of 1680.74.
  // Round to cents after every summation.
  const roundCents = (n) => Math.round((Number(n) || 0) * 100) / 100;

  const computeClaimAllocFromLines = (claimId, lines) => {
    if (!lines || lines.length === 0) return 0;
    const total = lines.reduce((t, _, i) => {
      const v = Number(lineAllocates[getLineAllocKey(claimId, i)] || 0);
      return t + v;
    }, 0);
    return roundCents(total);
  };

  // inline alert state: { id, message } — shows SweetAlert and resets field on close
  const [inlineAlert, setInlineAlert] = useState(null);

  const [payerName, setPayerName] = useState("");
  const [paymentDate, setPaymentDate] = useState(formatDateZoho(new Date()));
  const [method, setMethod] = useState(null);
  const [sideErrors, setSideErrors] = useState({});

  const PAYMENT_METHODS = [
    { id: "Cash", ic: "💵" },
    { id: "Credit Card", ic: "💳" },
    { id: "Debit Card", ic: "🏧" },
    { id: "Bank Transfer", ic: "🏦" },
    { id: "Direct Deposit", ic: "📲" },
    { id: "Cheque", ic: "📄" },
  ];

  const sumOfClaimAllocates = selectedClaims.reduce(
    (t, c) => t + (Number(claimAllocates[c.id]) || 0),
    0
  );

  const setClaimAlloc = (id, val) => {
    const num = Number(val) || 0;
    const claim = selectedClaims.find((c) => c.id === id);
    const balDue = Number(claim?.balanceDue) || 0;

    const otherTotal = selectedClaims.reduce((t, c) => {
      return c.id === id ? t : t + (Number(claimAllocates[c.id]) || 0);
    }, 0);
    const remaining = totalAllocateAmount - otherTotal;
    const newTotal = otherTotal + num;

    if (exceeds(num, balDue)) { 
      setInlineAlert({
        claimId: id,
        title: "Amount Exceeds Balance Due",
        message: `The entered amount ${INR(
          num
        )} exceeds the balance due of ${INR(
          balDue
        )} for claim ${id}.\n\nAllocate amount has been reset to 0.`,
      });
      setClaimAllocates((prev) => ({ ...prev, [id]: "" }));
      setClaimAllocErrors((prev) => ({ ...prev, [id]: "" }));
      return;
    }

    if (exceeds(newTotal, totalAllocateAmount)) {
      setInlineAlert({
        claimId: id,
        title: "Available Balance Exceeded",
        message: `Remaining available balance is ${INR(
          remaining
        )}.\n\nEntered ${INR(
          num
        )} exceeds it. Allocate amount for claim ${id} has been reset to 0.`,
      });
      setClaimAllocates((prev) => ({ ...prev, [id]: "" }));
      setClaimAllocErrors((prev) => ({ ...prev, [id]: "" }));
      return;
    }

    setClaimAllocates((prev) => ({ ...prev, [id]: val }));
    setClaimAllocErrors((prev) => ({ ...prev, [id]: "" }));
  };

  const handleFullPayToggle = (claimId, checked) => {
    const claim = selectedClaims.find((c) => c.id === claimId);
    const balDue = Number(claim?.balanceDue) || 0;

    if (checked) {
      // Calculate how much of totalAllocateAmount is already used by OTHER claims
      const otherClaims = selectedClaims.filter((c) => c.id !== claimId);
      const otherUsed = otherClaims.reduce(
        (t, c) => t + (Number(claimAllocates[c.id]) || 0),
        0
      );
      const remainingAvailable = totalAllocateAmount - otherUsed;

      if (exceeds(balDue, remainingAvailable)) {
        setInlineAlert({
          claimId: `fullpay_${claimId}`,
          title: "Insufficient Available Balance",
          message: `Full pay for claim ${claimId} requires ${INR(
            balDue
          )}, but only ${INR(
            remainingAvailable
          )} is available after other claim allocations.\n\nAvailable: ${INR(
            totalAllocateAmount
          )}\nAlready used by other claims: ${INR(otherUsed)}\nRemaining: ${INR(
            remainingAvailable
          )}`,
        });
        return;
      }

      setClaimFullPay((prev) => ({ ...prev, [claimId]: true }));
      setClaimAllocates((prev) => ({ ...prev, [claimId]: String(balDue) }));
      setClaimAllocErrors((prev) => ({ ...prev, [claimId]: "" }));
      setGapAllocates((prev) => ({ ...prev, [claimId]: "" })); // NEW: lines now cover the full balance, clear gap
      const lines = claimLines[claimId];
      if (lines && lines.length > 0) {
        const newLineAllocs = {};
        const newLineBals = {};
        lines.forEach((ln, i) => {
          const key = getLineAllocKey(claimId, i);
          const lineBal = Number(ln.balanceDue ?? ln.a ?? ln.r ?? 0);
          newLineAllocs[key] = String(lineBal);
          newLineBals[key] = 0;
        });
        setLineAllocates((prev) => ({ ...prev, ...newLineAllocs }));
        setLineBalances((prev) => ({ ...prev, ...newLineBals }));
      }
    } else {
      setClaimFullPay((prev) => ({ ...prev, [claimId]: false }));
      const gapVal = Number(gapAllocates[claimId] || 0); // NEW
      setClaimAllocates((prev) => ({
        ...prev,
        [claimId]: gapVal > 0 ? String(gapVal) : "",
      })); // NEW: keep gap reflected
      const lines = claimLines[claimId];
      if (lines && lines.length > 0) {
        const cleared = {};
        const restoredBals = {};
        lines.forEach((ln, i) => {
          const key = getLineAllocKey(claimId, i);
          cleared[key] = "";
          restoredBals[key] = Number(ln.balanceDue ?? ln.a ?? ln.r ?? 0);
        });
        setLineAllocates((prev) => ({ ...prev, ...cleared }));
        setLineBalances((prev) => ({ ...prev, ...restoredBals }));
      }
    }
  };

  const handleLineAllocChange = (claimId, lineIdx, val) => {
    const key = getLineAllocKey(claimId, lineIdx);
    const lines = claimLines[claimId] || [];
    const ln = lines[lineIdx];
    const originalBal = Number(ln?.balanceDue ?? ln?.a ?? ln?.r ?? 0);
    const entered = Number(val) || 0;
    const gapVal = Number(gapAllocates[claimId] || 0); // NEW

    // Check 1: entered > this line's balance due
    if (exceeds(entered, originalBal)) {
      setInlineAlert({
        claimId: `line_${claimId}_${lineIdx}`,
        title: "Exceeds Line Balance Due",
        message: `Entered ${INR(
          entered
        )} exceeds this line's balance due of ${INR(
          originalBal
        )}.\n\nAllocate amount reset to 0.`,
      });
      setLineAllocates((prev) => ({ ...prev, [key]: "" }));
      setLineBalances((prev) => ({ ...prev, [key]: originalBal }));
      const newSum = lines.reduce((t, _, i) => {
        if (i === lineIdx) return t;
        return t + (Number(lineAllocates[getLineAllocKey(claimId, i)]) || 0);
      }, 0);
      setClaimAllocates((prev) => ({
        ...prev,
        [claimId]: String(newSum + gapVal),
      })); // NEW
      return;
    }

    // Check 2: new total across ALL claims would exceed totalAllocateAmount
    const otherClaimsUsed = selectedClaims.reduce((t, c) => {
      if (c.id === claimId) return t;
      return t + (Number(claimAllocates[c.id]) || 0);
    }, 0);
    const thisClaimOtherLines = lines.reduce((t, _, i) => {
      if (i === lineIdx) return t;
      return t + (Number(lineAllocates[getLineAllocKey(claimId, i)]) || 0);
    }, 0);
    const newGrandTotal =
      otherClaimsUsed + thisClaimOtherLines + gapVal + entered; // NEW
    const remaining =
      totalAllocateAmount - otherClaimsUsed - thisClaimOtherLines - gapVal; // NEW

    if (exceeds(newGrandTotal, totalAllocateAmount)) {
      setInlineAlert({
        claimId: `line_${claimId}_${lineIdx}`,
        title: "Exceeds Available Balance",
        message: `Entered ${INR(
          entered
        )} exceeds the remaining available balance of ${INR(
          Math.max(0, remaining)
        )}.\n\nAvailable: ${INR(
          totalAllocateAmount
        )}\nAlready allocated elsewhere: ${INR(
          otherClaimsUsed + thisClaimOtherLines + gapVal
        )}\nRemaining: ${INR(
          Math.max(0, remaining)
        )}\n\nAllocate amount reset to 0.`,
      });
      setLineAllocates((prev) => ({ ...prev, [key]: "" }));
      setLineBalances((prev) => ({ ...prev, [key]: originalBal }));
      const newSum = lines.reduce((t, _, i) => {
        if (i === lineIdx) return t;
        return t + (Number(lineAllocates[getLineAllocKey(claimId, i)]) || 0);
      }, 0);
      setClaimAllocates((prev) => ({
        ...prev,
        [claimId]: String(newSum + gapVal),
      })); // NEW
      return;
    }

    const newBal = Number(Math.max(0, originalBal - entered).toFixed(2));
    setLineAllocates((prev) => ({ ...prev, [key]: val }));
    setLineBalances((prev) => ({ ...prev, [key]: newBal }));

    const newSum = lines.reduce((t, _, i) => {
      const v =
        i === lineIdx
          ? entered
          : Number(lineAllocates[getLineAllocKey(claimId, i)]) || 0;
      return t + v;
    }, 0);
    setClaimAllocates((prev) => ({
      ...prev,
      [claimId]: String(roundCents(newSum + gapVal)),
    })); // NEW — rounded to avoid float drift
    setClaimAllocErrors((prev) => ({ ...prev, [claimId]: "" }));
  };

  // Separate "Gap Amount" payment entry, claim-wise (not tied to any single line item).
  // Caps against the REMAINING gap (configured Gap Amount minus what's already been
  // paid in Gap_Paid_Amount), and whatever is entered gets folded into claimAllocates
  // so it flows into Allocated_Amount / Balance_Due updates like a line allocation would.
  const handleGapAllocChange = (claimId, val) => {
    const claim = selectedClaims.find((c) => c.id === claimId);
    const balDue = Number(claim?.balanceDue) || 0;
    const configuredGap = Number(claim?.gapAmount) || 0;
    const gapPaidSoFar = Number(claim?.gapPaidAmount) || 0;
    const remainingGap = Math.max(0, configuredGap - gapPaidSoFar);
    const entered = Number(val) || 0;

    const lines = claimLines[claimId] || [];
    const lineSum = lines.reduce(
      (t, _, i) =>
        t + (Number(lineAllocates[getLineAllocKey(claimId, i)]) || 0),
      0
    );

    if (remainingGap > 0 && exceeds(entered, remainingGap)) {
      setInlineAlert({
        claimId: `gap_${claimId}`,
        title: "Exceeds Remaining Gap",
        message: `Entered ${INR(entered)} exceeds the remaining Gap of ${INR(
          remainingGap
        )} for claim ${claimId} (Gap Amount ${INR(
          configuredGap
        )} − already paid ${INR(gapPaidSoFar)}).\n\nGap amount reset to 0.`,
      });
      setGapAllocates((prev) => ({ ...prev, [claimId]: "" }));
      setClaimAllocates((prev) => ({ ...prev, [claimId]: String(lineSum) }));
      return;
    }

    if (exceeds(lineSum + entered, balDue)) {
      setInlineAlert({
        claimId: `gap_${claimId}`,
        title: "Amount Exceeds Balance Due",
        message: `Line allocations (${INR(lineSum)}) plus Gap (${INR(
          entered
        )}) exceed the balance due of ${INR(
          balDue
        )} for claim ${claimId}.\n\nGap amount reset to 0.`,
      });
      setGapAllocates((prev) => ({ ...prev, [claimId]: "" }));
      setClaimAllocates((prev) => ({ ...prev, [claimId]: String(lineSum) }));
      return;
    }

    const otherClaimsUsed = selectedClaims.reduce((t, c) => {
      if (c.id === claimId) return t;
      return t + (Number(claimAllocates[c.id]) || 0);
    }, 0);
    const newGrandTotal = otherClaimsUsed + lineSum + entered;
    const remainingAvail = totalAllocateAmount - otherClaimsUsed - lineSum;

    if (exceeds(newGrandTotal, totalAllocateAmount)) { 
      setInlineAlert({
        claimId: `gap_${claimId}`,
        title: "Exceeds Available Balance",
        message: `Gap amount ${INR(
          entered
        )} exceeds the remaining available balance of ${INR(
          Math.max(0, remainingAvail)
        )}.\n\nGap amount reset to 0.`,
      });
      setGapAllocates((prev) => ({ ...prev, [claimId]: "" }));
      setClaimAllocates((prev) => ({ ...prev, [claimId]: String(lineSum) }));
      return;
    }

    setGapAllocates((prev) => ({ ...prev, [claimId]: val }));
    setClaimAllocates((prev) => ({
      ...prev,
      [claimId]: String(roundCents(lineSum + entered)),
    }));
    setClaimAllocErrors((prev) => ({ ...prev, [claimId]: "" }));
  };

  const handleLineAdjustmentToggle = (claimId, lineIdx, ln, checked) => {
    const key = getLineAllocKey(claimId, lineIdx);
    const originalBal = Number(ln.balanceDue ?? ln.a ?? ln.r ?? 0);
    const currentLineAlloc = Number(lineAllocates[key] || 0);
    const remainingAfterAlloc = Number(
      Math.max(0, originalBal - currentLineAlloc).toFixed(2)
    );

    if (checked) {
      if (remainingAfterAlloc <= 0) return; // nothing to adjust
      // Set adjustment = remaining balance after allocation
      setLineAdjustments((prev) => ({ ...prev, [key]: remainingAfterAlloc }));
      // Force balance to zero visually
      setLineBalances((prev) => ({ ...prev, [key]: 0 }));
    } else {
      // Remove adjustment — restore balance
      setLineAdjustments((prev) => {
        const n = { ...prev };
        delete n[key];
        return n;
      });
      const restored = Number(
        Math.max(0, originalBal - currentLineAlloc).toFixed(2)
      );
      setLineBalances((prev) => ({ ...prev, [key]: restored }));
    }
  };

  const validate = () => {
    let valid = true;
    const ce = {};
    const se = {};

    selectedClaims.forEach((c) => {
      const entered = Number(claimAllocates[c.id]) || 0;
      const balDue = Number(c.balanceDue) || 0;
      if (entered < 0) {
        ce[c.id] = "Cannot be negative";
        valid = false;
      } else if (exceeds(entered, balDue)) { 
        ce[c.id] = `Cannot exceed balance due ${INR(balDue)}`;
        valid = false;
      }
    });

    if (exceeds(sumOfClaimAllocates, totalAllocateAmount)) {
      selectedClaims.forEach((c) => {
        if (!ce[c.id]) ce[c.id] = `Sum exceeds available balance`;
      });
      valid = false;
    }

    setClaimAllocErrors(ce);

    if (!payerName.trim()) {
      se.payerName = "Payer name is required";
      valid = false;
    }
    if (!paymentDate) {
      se.paymentDate = "Payment date is required";
      valid = false;
    }
    if (!method) {
      se.method = "Select a payment method";
      valid = false;
    }
    setSideErrors(se);
    return valid;
  };

const handleConfirm = () => {
  if (!validate()) return;

  const roundCents = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const balanceAfter = roundCents(totalAllocateAmount - sumOfClaimAllocates);

  if (balanceAfter > 0) {
    setInlineAlert({
      claimId: "__warn_remaining__",
      title: "Remaining Balance Not Zero",
      message: `You still have ${INR(
        balanceAfter
      )} remaining from the available ${INR(
        totalAllocateAmount
      )}.\n\nOnly ${INR(sumOfClaimAllocates)} will be allocated across ${
        selectedClaims.length
      } claim${selectedClaims.length !== 1 ? "s" : ""}`,
      isAutoClose: true,
    });
  } else {
    setInlineAlert({
      claimId: "__confirm__",
      title: "Confirm Payment",
      message: `Allocating ${INR(sumOfClaimAllocates)} across ${
        selectedClaims.length
      } claim${
        selectedClaims.length !== 1 ? "s" : ""
      }.\n\nPayer: ${payerName}\nMethod: ${method}\nDate: ${paymentDate}`,
      isConfirm: true,
    });
  }
};

  const doConfirm = () => {
    setInlineAlert(null);
    onConfirmPayment({
      payerName: payerName.trim(),
      patientName,
      allocateAmount: sumOfClaimAllocates,
      paymentMethod: method,
      paymentDate,
      claimAllocates,
      lineAllocates,
      lineAdjustments,
      gapAllocates, // NEW
      claimLineData: claimLines,
    });
  };
  return (
    <div className="pay-page-wrap">
      {/* Inline SweetAlert for validation / confirm */}
      {inlineAlert &&
        (inlineAlert.isAutoClose ? (
          <SweetAlert
            type="warning"
            title={inlineAlert.title}
            message={inlineAlert.message}
            autoClose={true}
            autoCloseSeconds={10}
            onClose={() => setInlineAlert(null)}
          />
        ) : inlineAlert.isConfirm ? (
          <SweetAlert
            type="warning"
            title={inlineAlert.title}
            message={inlineAlert.message}
            confirmText="Yes, Confirm"
            cancelText="Cancel"
            onClose={() => setInlineAlert(null)}
            onConfirm={doConfirm}
          />
        ) : (
          <SweetAlert
            type="warning"
            title={inlineAlert.title}
            message={inlineAlert.message}
            confirmText="OK"
            onClose={() => setInlineAlert(null)}
            onConfirm={() => setInlineAlert(null)}
          />
        ))}

      <div style={{ animation: "slideInUp .28s ease" }}>
        {/* Hero */}
        <div className="pay-hero" style={{ marginBottom: 10 }}>
          <div className="pay-hero-line" />
          <div className="pay-hero-glow" />
          <button className="pb-back" onClick={onBack}>
            ‹ Back
          </button>
          <div className="pb-ey">
            Process Payment - {doctor?.name} · {hospital?.name}
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: "#fff",
              letterSpacing: "-.4px",
            }}
          ></div>
          <div
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,.45)",
              marginTop: 4,
            }}
          >
            {selectedClaims.length} claim
            {selectedClaims.length !== 1 ? "s" : ""} · Patient: {patientName}
            &nbsp;·&nbsp;Available:{" "}
            <strong style={{ color: "#7dd3fc" }}>
              {INR(totalAllocateAmount)}
            </strong>
          </div>
        </div>

        <div className="pay-layout">
          {/* LEFT: Claims with line items */}
          <div className="pay-layout-left">
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--ink3)",
                textTransform: "uppercase",
                letterSpacing: ".8px",
                marginBottom: 10,
              }}
            >
              Claims &amp; Line Items
            </div>

            {selectedClaims.map((cl) => {
              const balanceDue = Number(cl.balanceDue) || 0;
              const paidAmt = Number(cl.allocatedAmount) || 0;
              const entered = Number(claimAllocates[cl.id]) || 0;
              const difference = balanceDue - entered;

              return (
                <div
                  key={cl.id}
                  className="cb cb-on"
                  style={{ marginBottom: 16 }}
                >
                  {/* Claim header */}
                  <div
                    className="cbh"
                    style={{ flexWrap: "wrap", gap: 8, position: "relative" }}
                  >
                    <div className="cb-info">
                      <div className="cb-id">{cl.id}</div>
                      <div className="cb-meta">
                        {cl.pat}
                        {cl.dx ? ` · ${cl.dx}` : ""}
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 14,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: "var(--ink3)",
                            textTransform: "uppercase",
                            letterSpacing: ".6px",
                          }}
                        >
                          Claim Amt
                        </div>
                        <div
                          style={{
                            fontFamily: "monospace",
                            fontSize: 13,
                            fontWeight: 700,
                          }}
                        >
                          {INR(cl.amt)}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: "#b45309",
                            textTransform: "uppercase",
                            letterSpacing: ".6px",
                          }}
                        >
                          Balance Due
                        </div>
                        <div
                          style={{
                            fontFamily: "monospace",
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#b45309",
                          }}
                        >
                          {INR(balanceDue)}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: "var(--grn)",
                            textTransform: "uppercase",
                            letterSpacing: ".6px",
                          }}
                        >
                          Paid
                        </div>
                        <div
                          style={{
                            fontFamily: "monospace",
                            fontSize: 13,
                            fontWeight: 700,
                            color: "var(--grn)",
                          }}
                        >
                          {INR(paidAmt)}
                        </div>
                      </div>
                      {/* Gap Amount — read-only info badge. The editable "Pay Gap" input lives in the table footer below */}
                      {Number(cl.gapAmount) > 0 && (
                        <div style={{ textAlign: "right" }}>
                          <div
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              color: "#7c3aed",
                              textTransform: "uppercase",
                              letterSpacing: ".6px",
                            }}
                          >
                            Gap Amount
                          </div>
                          <div
                            style={{
                              fontFamily: "monospace",
                              fontSize: 13,
                              fontWeight: 700,
                              color: "#7c3aed",
                            }}
                          >
                            {INR(cl.gapAmount)}
                          </div>
                          <div
                            style={{
                              fontSize: 9,
                              color: "var(--ink4)",
                              marginTop: 1,
                            }}
                          >
                            Paid {INR(Number(cl.gapPaidAmount) || 0)} · Left{" "}
                            {INR(
                              Math.max(
                                0,
                                Number(cl.gapAmount) -
                                  (Number(cl.gapPaidAmount) || 0)
                              )
                            )}
                          </div>
                        </div>
                      )}
                      {/* Full Pay checkbox — small corner pill */}
                      <div
                        onClick={() =>
                          handleFullPayToggle(cl.id, !claimFullPay[cl.id])
                        }
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "4px 10px 4px 6px",
                          borderRadius: 20,
                          border: `1.5px solid ${
                            claimFullPay[cl.id] ? "#86efac" : "var(--b2)"
                          }`,
                          background: claimFullPay[cl.id]
                            ? "#f0fdf4"
                            : "var(--s1)",
                          cursor: "pointer",
                          transition: "all .15s",
                          userSelect: "none",
                        }}
                      >
                        <div
                          style={{
                            width: 15,
                            height: 15,
                            borderRadius: 4,
                            flexShrink: 0,
                            border: `2px solid ${
                              claimFullPay[cl.id] ? "var(--grn)" : "var(--b2)"
                            }`,
                            background: claimFullPay[cl.id]
                              ? "var(--grn)"
                              : "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 9,
                            color: "#fff",
                            fontWeight: 800,
                            transition: "all .15s",
                          }}
                        >
                          {claimFullPay[cl.id] ? "✓" : ""}
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: claimFullPay[cl.id]
                              ? "var(--grn)"
                              : "var(--ink3)",
                          }}
                        >
                          Full Pay
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Line items */}

                  {/* Line items with per-line allocate */}
                  <div
                    className="cb-table-wrap"
                    style={{ borderTop: "1px solid var(--b1)" }}
                  >
                    {linesLoading[cl.id] ? (
                      <div
                        style={{
                          padding: "16px",
                          textAlign: "center",
                          color: "var(--ink3)",
                          fontSize: 12.5,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                        }}
                      >
                        <span className="spin">⟳</span> Loading line items…
                      </div>
                    ) : (
                      <table className="lt" style={{ minWidth: 440 }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: "left" }}>
                              Date of Service
                            </th>
                            <th style={{ textAlign: "left" }}>Item Number</th>
                            <th style={{ textAlign: "right" }}>Amount</th>
                            <th style={{ textAlign: "right", minWidth: 110 }}>
                              Allocate Amount
                            </th>
                            <th style={{ textAlign: "right", minWidth: 110 }}>
                              Balance Due
                            </th>
                            <th style={{ textAlign: "center", minWidth: 90 }}>
                              Adjustment
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(claimLines[cl.id] || []).length === 0 ? (
                            <tr>
                              <td
                                colSpan={6}
                                style={{
                                  textAlign: "center",
                                  color: "var(--ink4)",
                                  fontSize: 12,
                                  padding: "14px",
                                }}
                              >
                                No line items found
                              </td>
                            </tr>
                          ) : (
                            (claimLines[cl.id] || []).map((ln, i) => {
                              const lineKey = getLineAllocKey(cl.id, i);
                              const lineAllocVal = lineAllocates[lineKey] || "";
                              const lineAmt = Number(ln.a || ln.r || 0);
                              const lineAllocNum = Number(lineAllocVal) || 0;
                              const lineKey2 = getLineAllocKey(cl.id, i);
                              const lineBal =
                                lineBalances[lineKey2] !== undefined
                                  ? Number(lineBalances[lineKey2])
                                  : Number(
                                      Math.max(
                                        0,
                                        (ln.balanceDue ?? lineAmt) -
                                          lineAllocNum
                                      ).toFixed(2)
                                    );
                              const lineDiff = lineBal;
                              return (
                                <tr key={i}>
                                  <td style={{ fontSize: 12 }}>
                                    {ln.dos || "—"}
                                  </td>
                                  <td>
                                    <span className="lt-code">
                                      {ln.c || ln.itemNo || "—"}
                                    </span>
                                  </td>
                                  <td className="lt-amt">{INR(lineAmt)}</td>
                                  <td
                                    style={{
                                      textAlign: "right",
                                      padding: "6px 13px",
                                    }}
                                  >
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      placeholder="0.00"
                                      value={lineAllocVal}
                                      disabled={
                                        !!claimFullPay[cl.id] ||
                                        !!lineAdjustments[lineKey]
                                      }
                                      onChange={(e) =>
                                        handleLineAllocChange(
                                          cl.id,
                                          i,
                                          e.target.value
                                        )
                                      }
                                      style={{
                                        width: 100,
                                        padding: "5px 7px",
                                        fontSize: 12,
                                        fontFamily: "monospace",
                                        fontWeight: 600,
                                        border: "1.5px solid var(--b1)",
                                        borderRadius: 7,
                                        background:
                                          claimFullPay[cl.id] ||
                                          lineAdjustments[lineKey]
                                            ? "var(--s2)"
                                            : "#fff",
                                        color:
                                          claimFullPay[cl.id] ||
                                          lineAdjustments[lineKey]
                                            ? "var(--ink4)"
                                            : "var(--ink)",
                                        outline: "none",
                                        textAlign: "right",
                                        opacity:
                                          claimFullPay[cl.id] ||
                                          lineAdjustments[lineKey]
                                            ? 0.6
                                            : 1,
                                      }}
                                      onFocus={(e) => {
                                        if (
                                          !claimFullPay[cl.id] &&
                                          !lineAdjustments[lineKey]
                                        )
                                          e.target.style.borderColor =
                                            "var(--grn)";
                                      }}
                                      onBlur={(e) => {
                                        e.target.style.borderColor =
                                          "var(--b1)";
                                      }}
                                    />
                                  </td>
                                  {/* Line-level Balance Due */}
                                  <td
                                    style={{
                                      textAlign: "right",
                                      padding: "6px 13px",
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "flex-end",
                                        padding: "4px 8px",
                                        minWidth: 90,
                                        borderRadius: 6,
                                        fontFamily: "monospace",
                                        fontSize: 12,
                                        fontWeight: 700,
                                        background:
                                          lineAllocNum === 0
                                            ? "transparent"
                                            : lineDiff === 0
                                            ? "#f0fdf4"
                                            : lineDiff < 0
                                            ? "#fff1f2"
                                            : "#fff7ed",
                                        border:
                                          lineAllocNum === 0
                                            ? "1.5px solid var(--b1)"
                                            : lineDiff === 0
                                            ? "1.5px solid #86efac"
                                            : lineDiff < 0
                                            ? "1.5px solid #fecdd3"
                                            : "1.5px solid #fed7aa",
                                        color:
                                          lineAllocNum === 0
                                            ? "var(--ink4)"
                                            : lineDiff === 0
                                            ? "var(--grn)"
                                            : lineDiff < 0
                                            ? "#be123c"
                                            : "#b45309",
                                      }}
                                    >
                                      {INR(lineBal)}
                                    </div>
                                  </td>
                                  {/* Adjustment checkbox */}
                                  <td
                                    style={{
                                      textAlign: "center",
                                      padding: "6px 13px",
                                    }}
                                  >
                                    {(() => {
                                      const originalBal = Number(
                                        ln.balanceDue ?? ln.a ?? ln.r ?? 0
                                      );
                                      const currentLineAlloc =
                                        Number(lineAllocVal) || 0;
                                      const remainingAfterAlloc = Number(
                                        Math.max(
                                          0,
                                          originalBal - currentLineAlloc
                                        ).toFixed(2)
                                      );
                                      const isChecked =
                                        !!lineAdjustments[lineKey];
                                      const canAdjust =
                                        remainingAfterAlloc > 0 || isChecked;
                                      return (
                                        <div
                                          onClick={() =>
                                            canAdjust &&
                                            handleLineAdjustmentToggle(
                                              cl.id,
                                              i,
                                              ln,
                                              !isChecked
                                            )
                                          }
                                          title={
                                            isChecked
                                              ? `Adjustment: ${INR(
                                                  lineAdjustments[lineKey] || 0
                                                )}`
                                              : `Adjust remaining ${INR(
                                                  remainingAfterAlloc
                                                )} to zero`
                                          }
                                          style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 4,
                                            padding: "3px 8px 3px 5px",
                                            borderRadius: 16,
                                            border: `1.5px solid ${
                                              isChecked
                                                ? "#f59e0b"
                                                : "var(--b2)"
                                            }`,
                                            background: isChecked
                                              ? "#fefce8"
                                              : "var(--s1)",
                                            cursor: canAdjust
                                              ? "pointer"
                                              : "not-allowed",
                                            transition: "all .15s",
                                            userSelect: "none",
                                            opacity: canAdjust ? 1 : 0.4,
                                          }}
                                        >
                                          <div
                                            style={{
                                              width: 14,
                                              height: 14,
                                              borderRadius: 3,
                                              flexShrink: 0,
                                              border: `2px solid ${
                                                isChecked
                                                  ? "#f59e0b"
                                                  : "var(--b2)"
                                              }`,
                                              background: isChecked
                                                ? "#f59e0b"
                                                : "#fff",
                                              display: "flex",
                                              alignItems: "center",
                                              justifyContent: "center",
                                              fontSize: 8,
                                              color: "#fff",
                                              fontWeight: 800,
                                              transition: "all .15s",
                                            }}
                                          >
                                            {isChecked ? "✓" : ""}
                                          </div>
                                          <span
                                            style={{
                                              fontSize: 10,
                                              fontWeight: 700,
                                              color: isChecked
                                                ? "#b45309"
                                                : "var(--ink3)",
                                            }}
                                          >
                                            {isChecked
                                              ? INR(
                                                  lineAdjustments[lineKey] || 0
                                                )
                                              : "Adj"}
                                          </span>
                                        </div>
                                      );
                                    })()}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                        {(claimLines[cl.id] || []).length > 0 &&
                          (() => {
                            const lineTotal = (claimLines[cl.id] || []).reduce(
                              (t, ln) => t + Number(ln.a || ln.r || 0),
                              0
                            );
                            const claimAllocVal =
                              Number(claimAllocates[cl.id]) || 0;
                            const balAfter = Number(
                              Math.max(0, balanceDue - claimAllocVal).toFixed(2)
                            );
                            const diff0 = balanceDue - claimAllocVal;
                            return (
                              <tfoot>
                                <tr
                                  style={{ borderTop: "2px solid var(--b1)" }}
                                >
                                  {/* Line Total label + value */}
                                  <td
                                    colSpan={2}
                                    style={{
                                      padding: "8px 13px",
                                      fontSize: 11,
                                      fontWeight: 700,
                                      color: "var(--ink2)",
                                      textAlign: "right",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    Line Total
                                  </td>
                                  <td
                                    style={{
                                      padding: "8px 13px",
                                      fontFamily: "monospace",
                                      fontSize: 13,
                                      fontWeight: 800,
                                      color: "var(--ink)",
                                      textAlign: "right",
                                    }}
                                  >
                                    {INR(lineTotal)}
                                  </td>
                                  {/* Pay Gap (stacked above) + Allocate Amt (read-only) — same cell, table stays at 6 columns */}
                                  <td
                                    style={{
                                      padding: "6px 13px",
                                      textAlign: "right",
                                    }}
                                  >
                                    {Number(cl.gapAmount) > 0 &&
                                      (() => {
                                        const gapPaidSoFar =
                                          Number(cl.gapPaidAmount) || 0;
                                        const remainingGap = Math.max(
                                          0,
                                          Number(cl.gapAmount) - gapPaidSoFar
                                        );
                                        return (
                                          <div style={{ marginBottom: 8 }}>
                                            <div
                                              style={{
                                                fontSize: 9,
                                                fontWeight: 700,
                                                color: "#7c3aed",
                                                textTransform: "uppercase",
                                                letterSpacing: ".5px",
                                                marginBottom: 3,
                                                textAlign: "right",
                                              }}
                                            >
                                              Pay Gap{" "}
                                              <span
                                                style={{
                                                  color: "var(--ink4)",
                                                  fontWeight: 600,
                                                }}
                                              >
                                                (left {INR(remainingGap)})
                                              </span>
                                            </div>
                                            <input
                                              type="number"
                                              min="0"
                                              step="0.01"
                                              placeholder="0.00"
                                              value={gapAllocates[cl.id] || ""}
                                              disabled={
                                                !!claimFullPay[cl.id] ||
                                                remainingGap <= 0
                                              }
                                              onChange={(e) =>
                                                handleGapAllocChange(
                                                  cl.id,
                                                  e.target.value
                                                )
                                              }
                                              style={{
                                                width: 110,
                                                padding: "5px 8px",
                                                fontSize: 12,
                                                fontFamily: "monospace",
                                                fontWeight: 600,
                                                border: "1.5px solid #c4b5fd",
                                                borderRadius: 7,
                                                background:
                                                  claimFullPay[cl.id] ||
                                                  remainingGap <= 0
                                                    ? "var(--s2)"
                                                    : "#fff",
                                                color: "var(--ink)",
                                                outline: "none",
                                                textAlign: "right",
                                                display: "block",
                                                marginLeft: "auto",
                                              }}
                                            />
                                          </div>
                                        );
                                      })()}
                                    <div
                                      style={{
                                        fontSize: 9,
                                        fontWeight: 700,
                                        color: "var(--ink3)",
                                        textTransform: "uppercase",
                                        letterSpacing: ".5px",
                                        marginBottom: 3,
                                        textAlign: "right",
                                      }}
                                    >
                                      Allocate Amt
                                    </div>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      placeholder="0.00"
                                      value={claimAllocates[cl.id]}
                                      readOnly
                                      disabled
                                      style={{
                                        width: 110,
                                        padding: "5px 8px",
                                        fontSize: 13,
                                        fontFamily: "monospace",
                                        fontWeight: 700,
                                        border: "1.5px solid var(--b1)",
                                        borderRadius: 7,
                                        outline: "none",
                                        textAlign: "right",
                                        background: "var(--s2)",
                                        color: "var(--ink3)",
                                        opacity: 0.8,
                                        cursor: "not-allowed",
                                        display: "block",
                                        marginLeft: "auto",
                                      }}
                                    />
                                    {claimAllocErrors[cl.id] && (
                                      <div
                                        style={{
                                          fontSize: 10,
                                          color: "#ef4444",
                                          marginTop: 2,
                                        }}
                                      >
                                        {claimAllocErrors[cl.id]}
                                      </div>
                                    )}
                                  </td>
                                  {/* Balance Due After Payment */}
                                  <td
                                    style={{
                                      padding: "6px 13px",
                                      textAlign: "right",
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: 9,
                                        fontWeight: 700,
                                        color: "var(--ink3)",
                                        textTransform: "uppercase",
                                        letterSpacing: ".5px",
                                        marginBottom: 3,
                                        textAlign: "right",
                                      }}
                                    >
                                      Bal Due After
                                    </div>
                                    <div
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "flex-end",
                                        padding: "5px 8px",
                                        minWidth: 100,
                                        borderRadius: 7,
                                        fontFamily: "monospace",
                                        fontSize: 13,
                                        fontWeight: 800,
                                        background:
                                          diff0 < 0
                                            ? "#fff1f2"
                                            : diff0 === 0
                                            ? "#f0fdf4"
                                            : "#fff7ed",
                                        border: `1.5px solid ${
                                          diff0 < 0
                                            ? "#fecdd3"
                                            : diff0 === 0
                                            ? "#86efac"
                                            : "#fed7aa"
                                        }`,
                                        color:
                                          diff0 < 0
                                            ? "#be123c"
                                            : diff0 === 0
                                            ? "var(--grn)"
                                            : "#b45309",
                                      }}
                                    >
                                      {claimAllocVal > 0 ? INR(balAfter) : "—"}
                                    </div>
                                  </td>
                                  {/* Adjustment Amount total for this claim */}
                                  <td
                                    style={{
                                      padding: "6px 13px",
                                      textAlign: "center",
                                    }}
                                  >
                                    {(() => {
                                      const lines = claimLines[cl.id] || [];
                                      const totalAdj = lines.reduce(
                                        (t, _, i) => {
                                          const key = getLineAllocKey(cl.id, i);
                                          return (
                                            t +
                                            Number(lineAdjustments[key] || 0)
                                          );
                                        },
                                        0
                                      );
                                      return totalAdj > 0 ? (
                                        <div
                                          style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            padding: "5px 8px",
                                            minWidth: 80,
                                            borderRadius: 7,
                                            fontFamily: "monospace",
                                            fontSize: 13,
                                            fontWeight: 800,
                                            background: "#fefce8",
                                            border: "1.5px solid #f59e0b",
                                            color: "#b45309",
                                          }}
                                        >
                                          <div
                                            style={{
                                              fontSize: 9,
                                              fontWeight: 700,
                                              color: "var(--ink3)",
                                              textTransform: "uppercase",
                                              letterSpacing: ".5px",
                                              marginBottom: 3,
                                              textAlign: "right",
                                            }}
                                          >
                                            Adjustment
                                          </div>
                                          {INR(totalAdj)}
                                        </div>
                                      ) : (
                                        <span
                                          style={{
                                            color: "var(--ink4)",
                                            fontSize: 12,
                                          }}
                                        >
                                          —
                                        </span>
                                      );
                                    })()}
                                  </td>
                                </tr>
                              </tfoot>
                            );
                          })()}
                      </table>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Total allocate summary */}
            <div
              style={{
                background: "#f0fdf4",
                border: "1.5px solid #86efac",
                borderRadius: 10,
                padding: "10px 14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: "#166534" }}>
                Total Allocated (all claims)
              </span>
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 16,
                  fontWeight: 800,
                  color: "var(--grn)",
                }}
              >
                {INR(sumOfClaimAllocates)}
              </span>
            </div>
            <div
              style={{
                background: "#eff6ff",
                border: "1.5px solid #bfdbfe",
                borderRadius: 10,
                padding: "10px 14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8" }}>
                Remaining Balance
              </span>
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 16,
                  fontWeight: 800,
                  color:
                    sumOfClaimAllocates > totalAllocateAmount
                      ? "#ef4444"
                      : "#1d4ed8",
                }}
              >
                {INR(Math.max(0, totalAllocateAmount - sumOfClaimAllocates))}
              </span>
            </div>
          </div>

          {/* RIGHT: Payment sidebar */}
          <div className="sum">
            <div className="sum-hdr">
              <div className="sum-hdr-t">Payment Details</div>
            </div>
            <div className="sum-body">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 5,
                  fontSize: 12.5,
                }}
              >
                <span style={{ color: "var(--ink3)" }}>Available</span>
                <span style={{ fontFamily: "monospace", fontWeight: 700 }}>
                  {INR(totalAllocateAmount)}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 5,
                  fontSize: 12.5,
                }}
              >
                <span style={{ color: "var(--ink3)" }}>Allocated</span>
                <span
                  style={{
                    fontFamily: "monospace",
                    fontWeight: 700,
                    color: "var(--grn)",
                  }}
                >
                  {INR(sumOfClaimAllocates)}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 12,
                  fontSize: 12.5,
                }}
              >
                <span style={{ color: "var(--ink3)" }}>Remaining</span>
                <span
                  style={{
                    fontFamily: "monospace",
                    fontWeight: 700,
                    color:
                      sumOfClaimAllocates > totalAllocateAmount
                        ? "#ef4444"
                        : "#1d4ed8",
                  }}
                >
                  {INR(Math.max(0, totalAllocateAmount - sumOfClaimAllocates))}
                </span>
              </div>
              <div className="sum-div" />

              {/* Patient */}

              {/* Payer */}
              <div style={{ marginBottom: 10 }}>
                <div className="pcp-label" style={{ marginBottom: 4 }}>
                  Payer Name <span style={{ color: "#ef4444" }}>*</span>
                </div>
                <PayerDropdown
                  value={payerName}
                  onChange={(v) => {
                    setPayerName(v);
                    if (sideErrors.payerName)
                      setSideErrors((x) => ({ ...x, payerName: "" }));
                  }}
                  error={!!sideErrors.payerName}
                />
                {sideErrors.payerName && (
                  <span className="pcp-err">{sideErrors.payerName}</span>
                )}
                {/* Date */}
                <div style={{ marginBottom: 10 }}>
                  <div className="pcp-label" style={{ marginBottom: 4 }}>
                    Payment Date <span style={{ color: "#ef4444" }}>*</span>
                  </div>
                  <DatePicker
                    value={paymentDate}
                    onChange={(v) => {
                      setPaymentDate(v);
                      if (sideErrors.paymentDate)
                        setSideErrors((x) => ({ ...x, paymentDate: "" }));
                    }}
                    placeholder="Pick date"
                    maxDate={new Date()}
                  />
                  {sideErrors.paymentDate && (
                    <span className="pcp-err">{sideErrors.paymentDate}</span>
                  )}
                </div>
              </div>

              {/* Method */}
              <div style={{ marginBottom: 12 }}>
                <div className="pcp-label" style={{ marginBottom: 7 }}>
                  Payment Method <span style={{ color: "#ef4444" }}>*</span>
                </div>
                <div className="pcp-pm-opts">
                  {PAYMENT_METHODS.map((m) => (
                    <div
                      key={m.id}
                      className={`pcp-pm-opt ${method === m.id ? "sel" : ""}`}
                      onClick={() => {
                        setMethod(m.id);
                        if (sideErrors.method)
                          setSideErrors((x) => ({ ...x, method: "" }));
                      }}
                    >
                      <span className="pcp-pm-opt-ic">{m.ic}</span>
                      {m.id}
                    </div>
                  ))}
                </div>
                {sideErrors.method && (
                  <span className="pcp-err">{sideErrors.method}</span>
                )}
              </div>

              <div className="sum-div" />
              {(() => {
                const totalAdj = Object.values(lineAdjustments).reduce(
                  (t, v) => t + Number(v || 0),
                  0
                );
                const grandTotal = Number(
                  (sumOfClaimAllocates + totalAdj).toFixed(2)
                );
                return (
                  <>
                    <div className="sum-grand">
                      <span className="sum-grand-l">Confirming</span>
                      <span className="sum-grand-v">
                        {INR(sumOfClaimAllocates)}
                      </span>
                    </div>
                    {totalAdj > 0 && (
                      <>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginTop: 6,
                            fontSize: 12.5,
                          }}
                        >
                          <span style={{ color: "#b45309", fontWeight: 600 }}>
                            Adjustment
                          </span>
                          <span
                            style={{
                              fontFamily: "monospace",
                              fontWeight: 700,
                              color: "#b45309",
                            }}
                          >
                            + {INR(totalAdj)}
                          </span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginTop: 8,
                            paddingTop: 8,
                            borderTop: "2px solid #f59e0b",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: "var(--ink)",
                            }}
                          >
                            Total
                          </span>
                          <span
                            style={{
                              fontFamily: "monospace",
                              fontSize: 20,
                              fontWeight: 800,
                              color: "#b45309",
                            }}
                          >
                            {INR(grandTotal)}
                          </span>
                        </div>
                      </>
                    )}
                    <button
                      className="btn b-green"
                      onClick={handleConfirm}
                      disabled={processing}
                      style={{
                        width: "100%",
                        justifyContent: "center",
                        marginTop: 14,
                      }}
                    >
                      {processing ? (
                        <>
                          <span className="spin">⟳</span> Processing…
                        </>
                      ) : totalAdj > 0 ? (
                        `✓ Confirm · ${INR(grandTotal)}`
                      ) : (
                        `✓ Confirm · ${INR(sumOfClaimAllocates)}`
                      )}
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
function AdjustmentPopup({ claim, onClose, onSave }) {
  const ADJUSTMENT_TYPES = [
    "BAD DEBT",
    "BANK CHARGE",
    "BOUNCED CHQ",
    "DECEASED",
    "DISCOUNT",
    "ELDERLY PATIENT",
    "INCORRECT BILLING",
    "OVERPAYMENT",
    "REFUND",
    "OTHER",
  ];

  const [adjType, setAdjType] = useState("");
  const [adjAmount, setAdjAmount] = useState(
    String(Number(claim.balanceDue) || 0)
  );
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [refundAmount, setRefundAmount] = useState("");

  const validate = () => {
    const e = {};
    if (!adjType) e.adjType = "Select an adjustment type";
    if (!adjAmount || Number(adjAmount) <= 0)
      e.adjAmount = "Enter a valid amount";
    if (exceeds(Number(adjAmount), Number(claim.balanceDue)))
      e.adjAmount = `Cannot exceed balance due ${INR(claim.balanceDue)}`;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const amt = Number(Number(adjAmount).toFixed(2));
      const currentBal = Number(Number(claim.balanceDue).toFixed(2)) || 0;
      const currentAlloc =
        Number(Number(claim.allocatedAmount).toFixed(2)) || 0;
      const newBal = Number(Math.max(0, currentBal - amt).toFixed(2));
      const newAlloc = Number((currentAlloc + amt).toFixed(2));

      // Status logic: zero balance → Fully Paid, else keep existing status
      const newStatus = newBal === 0 ? "Fully Paid" : claim.st;

      console.log(
        `[Adjustment] claim=${claim.id} amt=${amt} currentBal=${currentBal} newBal=${newBal} newAlloc=${newAlloc} newStatus=${newStatus}`
      );

      if (isZohoAvailable()) {
        const refundAmt = Number(refundAmount) || 0;
        const ok = await updateRecord(
          "Add_Claim_Report",
          claim.recordId || claim.id,
          {
            Adjustment_Types: adjType,
            Adjustment_Amount: amt,
            Comments: reason,
            Balance_Due: newBal,
            Allocated_Amount: newAlloc,
            Status: newStatus,
            ...(refundAmt > 0 ? { Refund_Amount: refundAmt } : {}),
          }
        );
        if (!ok) {
          setErrors({
            api: "Failed to update claim in Zoho. Please try again.",
          });
          setSaving(false);
          return;
        }
      } else {
        // Static fallback — update local state only
        console.log("[Adjustment] Zoho not available — local update only");
      }

      onSave({
        adjType,
        adjAmount: amt,
        reason,
        newBal,
        newAlloc,
        newStatus,
        refundAmount: Number(refundAmount) || 0,
      });
      onClose();
    } catch (err) {
      console.error("[Adjustment] handleSave error:", err);
      setErrors({ api: `Unexpected error: ${err?.message || err}` });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pcp-ov" onClick={onClose}>
      <div
        className="pcp"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 460 }}
      >
        {/* Header */}
        <div className="pcp-hdr">
          <div className="pcp-hdr-row">
            <div>
              <div className="pcp-title">⚖️ Claim Adjustment</div>
              <div className="pcp-sub">
                {claim.id} · {claim.pat}
              </div>
            </div>
            <button className="pcp-x" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="pcp-body">
          {/* Adjustment Type */}
          <div className="pcp-field">
            <label className="pcp-label">
              Adjustment Type <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <select
              className="pcp-input"
              value={adjType}
              onChange={(e) => {
                setAdjType(e.target.value);
                setErrors((x) => ({ ...x, adjType: "" }));
              }}
              style={{ cursor: "pointer" }}
            >
              <option value="">Select type…</option>
              {ADJUSTMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {errors.adjType && (
              <span className="pcp-err">{errors.adjType}</span>
            )}
          </div>

          {/* Adjustment Amount */}
          <div className="pcp-field">
            <label className="pcp-label">
              Adjustment Amount <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              className="pcp-input"
              type="number"
              min="0"
              step="0.01"
              value={adjAmount}
              onChange={(e) => {
                const val = e.target.value;
                const num = Number(val);
                const balDue = Number(claim.balanceDue) || 0;
                if (val !== "" && num > balDue) {
                  setErrors((x) => ({
                    ...x,
                    adjAmount: `Amount cannot exceed balance due ${INR(
                      balDue
                    )}`,
                  }));
                } else if (val !== "" && num <= 0) {
                  setErrors((x) => ({
                    ...x,
                    adjAmount: "Amount must be greater than 0",
                  }));
                } else {
                  setErrors((x) => ({ ...x, adjAmount: "" }));
                }
                setAdjAmount(val);
              }}
              onBlur={(e) => {
                const num = Number(e.target.value);
                const balDue = Number(claim.balanceDue) || 0;
                if (!e.target.value) {
                  setErrors((x) => ({ ...x, adjAmount: "Amount is required" }));
                } else if (num <= 0) {
                  setErrors((x) => ({
                    ...x,
                    adjAmount: "Amount must be greater than 0",
                  }));
                } else if (num > balDue) {
                  setErrors((x) => ({
                    ...x,
                    adjAmount: `Amount cannot exceed balance due ${INR(
                      balDue
                    )}`,
                  }));
                }
              }}
              placeholder="0.00"
              style={{
                borderColor: errors.adjAmount ? "#ef4444" : "",
                boxShadow: errors.adjAmount
                  ? "0 0 0 3px rgba(239,68,68,.1)"
                  : "",
              }}
            />
            {errors.adjAmount && (
              <span className="pcp-err">{errors.adjAmount}</span>
            )}
            {Number(adjAmount) > 0 &&
              Number(adjAmount) <= Number(claim.balanceDue) &&
              !errors.adjAmount && (
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--grn)",
                    marginTop: 3,
                    display: "block",
                  }}
                >
                  ✓ Balance after adjustment:{" "}
                  {INR(
                    Math.max(0, Number(claim.balanceDue) - Number(adjAmount))
                  )}
                </span>
              )}
            {Number(adjAmount) > Number(claim.balanceDue) && (
              <span
                style={{
                  fontSize: 11,
                  color: "#ef4444",
                  marginTop: 3,
                  display: "block",
                }}
              >
                ✗ Entered {INR(Number(adjAmount))} exceeds balance due{" "}
                {INR(Number(claim.balanceDue))}
              </span>
            )}
          </div>

          {/* Reason / Comments */}
          <div className="pcp-field">
            <label className="pcp-label">Reason / Comments</label>
            <textarea
              className="pcp-input"
              rows={3}
              placeholder="Enter reason for adjustment…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{
                resize: "vertical",
                minHeight: 72,
                fontFamily: "var(--fn)",
                fontSize: 13,
              }}
            />
          </div>

          {/* Refund Amount */}
          <div className="pcp-field">
            <label className="pcp-label">
              Refund Amount{" "}
              <span
                style={{ fontSize: 10, color: "var(--ink4)", fontWeight: 400 }}
              >
                (optional)
              </span>
            </label>
            <input
              className="pcp-input"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
            />
            {Number(refundAmount) > 0 && (
              <span
                style={{
                  fontSize: 11,
                  color: "#7c3aed",
                  marginTop: 3,
                  display: "block",
                }}
              >
                Refund of {INR(Number(refundAmount))} will be recorded
              </span>
            )}
          </div>

          {errors.api && (
            <div
              style={{
                padding: "10px 12px",
                background: "#fff1f2",
                border: "1px solid #fecdd3",
                borderRadius: 8,
                fontSize: 13,
                color: "#9f1239",
              }}
            >
              ⚠ {errors.api}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pcp-foot">
          <button
            className="btn b-outline b-sm"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className="btn b-blue b-sm"
            onClick={handleSave}
            disabled={saving || !adjType || !adjAmount}
            style={{ minWidth: 130, justifyContent: "center" }}
          >
            {saving ? (
              <>
                <span className="spin">⟳</span> Saving…
              </>
            ) : (
              "✓ Apply Adjustment"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
/* ─────────────────────────────────────────────────────────────────
   CLAIM DETAIL POPUP
───────────────────────────────────────────────────────────────── */
function ClaimDetailPopup({ claim, onClose }) {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("details");

  useEffect(() => {
    const id = claim.recordId || claim.id;
    if (!id) {
      setLoading(false);
      return;
    }
    (isZohoAvailable() ? loadClaimLinesRaw(id) : Promise.resolve([]))
      .then((ls) => setLines(ls))
      .catch(() => setLines([]))
      .finally(() => setLoading(false));
  }, [claim]);

  const Field = ({ label, value, mono = false, highlight = null }) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
        padding: "10px 14px",
        background: "#fff",
        border: "1.5px solid var(--b1)",
        borderRadius: 10,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "var(--ink3)",
          textTransform: "uppercase",
          letterSpacing: ".6px",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 13.5,
          fontFamily: mono ? "monospace" : "inherit",
          fontWeight: mono ? 700 : 500,
          color:
            highlight === "green"
              ? "var(--grn)"
              : highlight === "orange"
              ? "#b45309"
              : highlight === "purple"
              ? "#7c3aed"
              : highlight === "blue"
              ? "var(--acc)"
              : "var(--ink)",
          wordBreak: "break-all",
        }}
      >
        {value === "" || value === null || value === undefined ? (
          <span
            style={{
              color: "var(--ink4)",
              fontStyle: "italic",
              fontWeight: 400,
            }}
          >
            —
          </span>
        ) : (
          String(value)
        )}
      </span>
    </div>
  );

  const SectionLabel = ({ children, icon }) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        fontSize: 10,
        fontWeight: 700,
        color: "var(--ink3)",
        textTransform: "uppercase",
        letterSpacing: ".8px",
        padding: "18px 0 10px",
      }}
    >
      {icon && <span style={{ fontSize: 13 }}>{icon}</span>}
      <span>{children}</span>
      <div
        style={{ flex: 1, height: 1, background: "var(--b1)", marginLeft: 6 }}
      />
    </div>
  );

  const statusColors = {
    Lodged: { bg: "#f5f3ff", color: "#5b21b6", border: "#c4b5fd" },
    "Partially Paid": { bg: "#fff7ed", color: "#9a3412", border: "#fed7aa" },
    Rejected: { bg: "#fff1f2", color: "#9f1239", border: "#fecdd3" },
    Resubmitted: { bg: "#f0fdf4", color: "#166534", border: "#86efac" },
    "Fully Paid": { bg: "#f0fdf4", color: "#166534", border: "#86efac" },
    Draft: { bg: "#f8fafc", color: "#475569", border: "#cbd5e1" },
  };
  const stColor = statusColors[claim.st] || {
    bg: "#f8fafc",
    color: "#475569",
    border: "#cbd5e1",
  };

  const totalLineAmt = lines.reduce(
    (t, ln) => t + Number(ln.a || ln.r || 0),
    0
  );
  const totalLineBal = lines.reduce(
    (t, ln) => t + Number(ln.balanceDue || 0),
    0
  );
  const totalLinePaid = lines.reduce(
    (t, ln) => t + Number(ln.allocatedAmount || 0),
    0
  );

  return (
    <div className="pcp-ov" onClick={onClose}>
      <div
        className="pcp"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 900,
          width: "96vw",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div className="pcp-hdr" style={{ padding: "18px 24px 14px" }}>
          <div className="pcp-hdr-row">
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 30,
                }}
              >
                <div className="pcp-title">📋 Claim Details</div>
                <span
                  style={{
                    padding: "3px 10px",
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 700,
                    background: stColor.bg,
                    color: stColor.color,
                    border: `1px solid ${stColor.border}`,
                  }}
                >
                  {claim.st || "Unknown"}{" "}
                </span>
                <div
                  className="pcp-sub"
                  style={{
                    marginTop: 4,
                    marginBottom: -2,
                    fontSize: 13,
                    color: "var(--ink3)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "monospace",
                      color: "#7dd3fc",
                      fontWeight: 700,
                    }}
                  >
                    {claim.id}
                  </span>
                  {claim.date && (
                    <span
                      style={{ color: "rgba(255,255,255,.5)", marginLeft: 8 }}
                    >
                      · {claim.date}
                    </span>
                  )}
                </div>
              </div>
              {/* <div className="pcp-sub" style={{ marginTop: 4, marginBottom: -2, fontSize: 13, color: "var(--ink3)" }}>
  <span style={{ fontFamily: "monospace", color: "#7dd3fc", fontWeight: 700 }}>{claim.id}</span>
  {claim.date && <span style={{ color: "rgba(255,255,255,.5)", marginLeft: 8 }}>· {claim.date}</span>}
</div> */}
            </div>
            <button className="pcp-x" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            overflowY: "auto",
            flex: 1,
            scrollbarWidth: "thin",
            scrollbarColor: "var(--b2) transparent",
          }}
        >
          {/* ══ DETAILS TAB ══ */}
          {activeTab === "details" && (
            <div style={{ padding: "4px 24px 28px" }}>
              {/* Summary cards row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3,1fr)",
                  gap: 10,
                  padding: "14px 0 4px",
                }}
              >
                {[
                  {
                    label: "Claim Amount",
                    value: INR(claim.amt),
                    bg: "#eff6ff",
                    border: "#bfdbfe",
                    color: "var(--acc)",
                  },
                  {
                    label: "Balance Due",
                    value: INR(claim.balanceDue),
                    bg: "#fff7ed",
                    border: "#fed7aa",
                    color: "#b45309",
                  },
                  {
                    label: "Paid Amount",
                    value: INR(claim.allocatedAmount),
                    bg: "#f0fdf4",
                    border: "#86efac",
                    color: "var(--grn)",
                  },
                ].map((card) => (
                  <div
                    key={card.label}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 12,
                      background: card.bg,
                      border: `1.5px solid ${card.border}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: card.color,
                        textTransform: "uppercase",
                        letterSpacing: ".6px",
                        marginBottom: 4,
                      }}
                    >
                      {card.label}
                    </div>
                    <div
                      style={{
                        fontFamily: "monospace",
                        fontSize: 18,
                        fontWeight: 800,
                        color: card.color,
                      }}
                    >
                      {card.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Gap card */}
              {claim.enableGap && Number(claim.gapAmount) > 0 && (
                <div
                  style={{
                    padding: "10px 16px",
                    borderRadius: 12,
                    marginBottom: 2,
                    background: "#faf5ff",
                    border: "1.5px solid #c4b5fd",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#7c3aed",
                      textTransform: "uppercase",
                      letterSpacing: ".6px",
                    }}
                  >
                    ⚡ Gap
                  </span>
                  <div style={{ display: "flex", gap: 24 }}>
                    {[
                      { label: "Total", value: INR(claim.gapAmount) },
                      { label: "Paid", value: INR(claim.gapPaidAmount || 0) },
                      {
                        label: "Remaining",
                        value: INR(
                          Math.max(
                            0,
                            Number(claim.gapAmount) -
                              Number(claim.gapPaidAmount || 0)
                          )
                        ),
                      },
                    ].map((g) => (
                      <div key={g.label} style={{ textAlign: "center" }}>
                        <div
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: "#9333ea",
                            textTransform: "uppercase",
                            letterSpacing: ".5px",
                          }}
                        >
                          {g.label}
                        </div>
                        <div
                          style={{
                            fontFamily: "monospace",
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#7c3aed",
                          }}
                        >
                          {g.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Claim Info */}
              <SectionLabel icon="🏥">Claim Information</SectionLabel>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <Field
                  label="Assistant Surgeon"
                  value={claim.assistantSurgeons || "—"}
                />
                <Field label="Payer" value={claim.payerName || "—"} />
                <Field
                  label="Health Fund / Work Cover"
                  value={claim.healthFundName || "—"}
                />
                <Field
                  label="Referring Doctor"
                  value={claim.referringDoctorName || "—"}
                />
                <Field
                  label="Referring Doctor Provider No."
                  value={claim.providerNumber || "—"}
                />
              </div>

              {/* Patient & Provider */}
              <SectionLabel icon="👤">Patient &amp; Provider</SectionLabel>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 10,
                }}
              >
                <Field label="Patient" value={claim.pat} />
                <Field label="Doctor" value={claim.dName} />
                <Field label="Hospital" value={claim.hName} />
              </div>

              {/* Line Items */}
              <SectionLabel icon="📝">
                Claim Lines
                {!loading && (
                  <span
                    style={{
                      padding: "1px 8px",
                      borderRadius: 20,
                      background: "#eff6ff",
                      color: "var(--acc)",
                      border: "1px solid #bfdbfe",
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    {lines.length}
                  </span>
                )}
              </SectionLabel>

              {loading ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "28px 0",
                    color: "var(--ink3)",
                    fontSize: 13,
                  }}
                >
                  <span className="spin" style={{ fontSize: 18 }}>
                    ⟳
                  </span>{" "}
                  Loading line items…
                </div>
              ) : lines.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "24px 0",
                    color: "var(--ink4)",
                    fontSize: 13,
                    background: "var(--s1)",
                    borderRadius: 10,
                    border: "1.5px dashed var(--b2)",
                  }}
                >
                  No line items found
                </div>
              ) : (
                <div
                  style={{
                    border: "1.5px solid var(--b1)",
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                >
                  <div style={{ overflowX: "auto" }}>
                    <div style={{ minWidth: 760 }}>
                     {/* Table header */}
<div
  style={{
    display: "grid",
    gridTemplateColumns:
      "28px 84px 128px 128px 78px 1fr 84px 84px 84px",   // ← added 128px for Payment Date
    background: "var(--s1)",
    borderBottom: "1px solid var(--b1)",
    padding: "8px 14px",
    gap: 6,
  }}
>
  {[
    { label: "#", align: "center" },
    { label: "Item No.", align: "left" },
    { label: "Date of Service", align: "left" },
    { label: "Payment Date", align: "left" },   // ← NEW
    { label: "Status", align: "left" },
    { label: "", align: "left" },
    { label: "Amount", align: "right" },
    { label: "Balance", align: "right" },
    { label: "Paid", align: "right" },
  ].map((h, hi) => (
    <div
      key={hi}
      style={{
        fontSize: 9,
        fontWeight: 700,
        color: "var(--ink3)",
        textTransform: "uppercase",
        letterSpacing: ".6px",
        textAlign: h.align,
      }}
    >
      {h.label}
    </div>
  ))}
</div>

                      {/* Line rows */}
{lines.map((ln, i) => {
  const lineAmt = Number(ln.a || ln.r || 0);
  const lineBal = Number(ln.balanceDue || 0);
  const linePaid = Number(ln.allocatedAmount || 0);
  const isPaid = String(ln.st || "").toLowerCase() === "paid";
  return (
    <div
      key={i}
      style={{
        display: "grid",
        gridTemplateColumns:
          "28px 84px 128px 128px 78px 1fr 84px 84px 84px",   // ← match header
        padding: "10px 14px",
        gap: 6,
        borderBottom:
          i < lines.length - 1 ? "1px solid var(--b1)" : "none",
        background: isPaid ? "#f0fdf4" : i % 2 === 0 ? "#fff" : "var(--s1)",
        alignItems: "center",
      }}
    >
      {/* # */}
      <div style={{ /* unchanged */ width: 20, height: 20, borderRadius: "50%", background: "var(--s2)", border: "1px solid var(--b1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "var(--ink3)" }}>
        {i + 1}
      </div>

      {/* Item No */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start" }}>
        <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: "#eff6ff", color: "var(--acc)", border: "1px solid #bfdbfe", display: "inline-block" }}>
          {ln.c || ln.itemNo || "—"}
        </span>
      </div>

      {/* Date of Service */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start" }}>
        {ln.dos ? (
          <span style={{ fontSize: 12, color: "var(--ink)", fontWeight: 500, display: "flex", alignItems: "center", gap: 5 }}>
            <span>📅</span>
            <span>{ln.dos}</span>
          </span>
        ) : (
          <span style={{ fontSize: 12, color: "var(--ink4)" }}>—</span>
        )}
      </div>

      {/* NEW — Payment Date */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start" }}>
        {ln.paymentDate ? (
          <span style={{ fontSize: 12, color: "var(--grn)", fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
            <span>💳</span>
            <span>{ln.paymentDate}</span>
          </span>
        ) : (
          <span style={{ fontSize: 12, color: "var(--ink4)" }}>—</span>
        )}
      </div>

      {/* Status */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start" }}>
        {ln.st && (
          <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 10, display: "inline-block", width: "fit-content", background: isPaid ? "#f0fdf4" : "#fff7ed", color: isPaid ? "var(--grn)" : "#b45309", border: `1px solid ${isPaid ? "#86efac" : "#fed7aa"}`, textTransform: "uppercase", letterSpacing: ".4px" }}>
            {ln.st}
          </span>
        )}
      </div>

      {/* spacer */}
      <div />

      {/* Amount */}
      <div style={{ textAlign: "right", fontFamily: "monospace", fontSize: 13, fontWeight: 700 }}>
        {INR(lineAmt)}
      </div>

      {/* Balance */}
      <div style={{ textAlign: "right", fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: lineBal === 0 ? "var(--grn)" : "#b45309" }}>
        {INR(lineBal)}
      </div>

      {/* Paid */}
      <div style={{ textAlign: "right", fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: linePaid > 0 ? "var(--grn)" : "var(--ink4)" }}>
        {INR(linePaid)}
      </div>
    </div>
  );
})}
                     {/* Totals footer */}
<div
  style={{
    display: "grid",
    gridTemplateColumns:
      "28px 84px 128px 128px 78px 1fr 84px 84px 84px",   // ← match header/rows
    padding: "10px 14px",
    gap: 6,
    background: "linear-gradient(90deg,#f0f9ff,#fff)",
    borderTop: "2px solid var(--b1)",
    alignItems: "center",
  }}
>
  <div />
  <div />
  <div
    style={{
      gridColumn: "3 / span 3",   // ← now spans Date of Service + Payment Date + Status
      fontSize: 11,
      fontWeight: 700,
      color: "var(--ink2)",
    }}
  >
    Totals
  </div>
  <div />
  <div style={{ textAlign: "right", fontFamily: "monospace", fontSize: 13, fontWeight: 800, color: "var(--ink)" }}>
    {INR(totalLineAmt)}
  </div>
  <div style={{ textAlign: "right", fontFamily: "monospace", fontSize: 13, fontWeight: 800, color: "#b45309" }}>
    {INR(totalLineBal)}
  </div>
  <div style={{ textAlign: "right", fontFamily: "monospace", fontSize: 13, fontWeight: 800, color: "var(--grn)" }}>
    {INR(totalLinePaid)}
  </div>
</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pcp-foot">
          <div style={{ fontSize: 11, color: "var(--ink4)", flex: 1 }}>
            {lines.length > 0 && !loading && (
              <span>
                {lines.length} line item{lines.length !== 1 ? "s" : ""} · Total{" "}
                {INR(totalLineAmt)}
              </span>
            )}
          </div>
          <button className="btn b-outline b-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
/* ─────────────────────────────────────────────────────────────────
   CLAIMS VIEW
───────────────────────────────────────────────────────────────── */
function ClaimsView({
  doctor,
  hospital,
  allDoctors,
  allHospitals,
  allClaims,
  setAllClaims,
  onChangeProvider,
}) {
  const [sel, setSel] = useState([]);
  const [q, setQ] = useState("");
  const [statF, setStatF] = useState([]);
  const [filterTouched, setFilterTouched] = useState(false);
  const [claimDosMap, setClaimDosMap] = useState({}); // { claimId: "23-Aug-2026, 24-Aug-2026" }
  const [page, setPage] = useState(1);
const [pageSize, setPageSize] = useState(10);
const [claimLineCounts, setClaimLineCounts] = useState({}); // { claimId: number of line items }
  // NEW: patient filter for payment

  const [showNew, setShowNew] = useState(false);
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [detailClaim, setDetailClaim] = useState(null);
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  // NEW: payment confirm popup
  const [showPayPopup, setShowPayPopup] = useState(false);
  const [payProcessing, setPayProcessing] = useState(false);
  const [paymentStage, setPaymentStage] = useState(null); // null | { allocateAmount, totalClaimAmount }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (isZohoAvailable()) {
          const data = await loadClaims(doctor.id, hospital.id);
          if (!cancelled && data.length)
            setAllClaims((p) => [
              ...data,
              ...p.filter(
                (c) => !(c.did === doctor.id && c.hid === hospital.id)
              ),
            ]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doctor.id, hospital.id]);

  // Close patient filter dropdown on outside click

  const rows = allClaims.filter((c) => {
    const didMatch =
      String(c.did || "").trim() === String(doctor.id || "").trim();
    const hidMatch =
      String(c.hid || "").trim() === String(hospital.id || "").trim();
    const didFallback =
      (!c.did || c.did === "") &&
      (c.dName || "").toLowerCase() === (doctor.name || "").toLowerCase();
    const hidFallback =
      (!c.hid || c.hid === "") &&
      (c.hName || "").toLowerCase() === (hospital.name || "").toLowerCase();
    if (!(didMatch || didFallback) || !(hidMatch || hidFallback)) return false;
    const sq = q.toLowerCase();
    if (
      sq &&
      !(c.pat || "").toLowerCase().includes(sq) &&
      !(c.id || "").toLowerCase().includes(sq) &&
      !(c.dx || "").toLowerCase().includes(sq)
    )
      return false;
if (statF.length === 0) {
  // Default view (no explicit filter selected) — always hide Fully Paid.
  if (normalizeStatus(c.st) === normalizeStatus("Fully Paid")) return false;
} else if (!statF.some((s) => normalizeStatus(c.st) === normalizeStatus(s))) {
  // Explicit filter applied — only show the selected statuses.
  return false;
}
return true;
  });

  const visibleRows = rows;
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
const clampedPage = Math.min(page, totalPages);
const startIdx = (clampedPage - 1) * pageSize;
const paginatedRows = visibleRows.slice(startIdx, startIdx + pageSize);
const totalLineItems = visibleRows.reduce(
  (t, c) => t + (claimLineCounts[c.id] || 0),
  0
);
const allPageSelected =
  paginatedRows.length > 0 && paginatedRows.every((c) => sel.includes(c.id));

  const tog1 = (id) =>
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
const togAll = () =>
  setSel((prev) =>
    allPageSelected
      ? prev.filter((id) => !paginatedRows.some((c) => c.id === id))
      : [...new Set([...prev, ...paginatedRows.map((c) => c.id)])]
  );
  const selClaims = allClaims.filter((c) => sel.includes(c.id));

  // Stats
  const totalBalanceDue = visibleRows.reduce(
    (a, c) => a + (Number(c.balanceDue) || 0),
    0
  );
  const totalAllocated = visibleRows.reduce(
    (a, c) => a + (Number(c.allocatedAmount) || 0),
    0
  );
  const stats = {
    total: visibleRows.length,
    amount: visibleRows.reduce((a, c) => a + c.amt, 0),
    balanceDue: totalBalanceDue,
    allocated: totalAllocated,
  };

  const gD = (id) =>
    allDoctors.find((d) => String(d.id) === String(id)) || {
      name: String(id),
      av: "?",
      color: "#64748b",
      spec: "",
    };
  const gH = (id) =>
    allHospitals.find((h) => String(h.id) === String(id)) || {
      name: String(id),
      city: "",
    };

  // SAME-PATIENT check — payment only allowed when all selected claims share same patient

useEffect(() => {
  if (!isZohoAvailable()) return;
  const toFetch = visibleRows.filter((c) => !(c.id in claimDosMap));
  if (toFetch.length === 0) return;

  let cancelled = false;
  (async () => {
    const results = await Promise.all(
      toFetch.map(async (cl) => {
        try {
          const lines = await loadClaimLinesRaw(cl.recordId || cl.id);
          const dates = [...new Set(lines.map((ln) => ln.dos).filter(Boolean))];
          return [cl.id, dates.join(", ") || "—", lines.length];
        } catch (err) {
          console.warn("[ClaimsView] failed to load lines for DOS column:", cl.id, err);
          return [cl.id, "—", 0];
        }
      })
    );
    if (!cancelled) {
      setClaimDosMap((prev) => {
        const next = { ...prev };
        for (const [id, val] of results) next[id] = val;
        return next;
      });
      setClaimLineCounts((prev) => {
        const next = { ...prev };
        for (const [id, , count] of results) next[id] = count;
        return next;
      });
    }
  })();

  return () => { cancelled = true; };
}, [visibleRows]);

// Reset to page 1 whenever filters/search/provider change
useEffect(() => {
  setPage(1);
}, [q, statF, doctor.id, hospital.id]);

  const handlePayClick = () => {
    if (sel.length === 0) {
      setAlert({
        type: "warning",
        title: "No Claim Selected",
        message: "Select at least one claim before proceeding to payment.",
        confirmText: "OK",
      });
      return;
    }
    setShowPayPopup(true);
  };

  const handlePayConfirm = async ({
    allocateAmount,
    paymentMethod,
    paymentDate,
    payerName,
    patientName,
    claimAllocates,
    lineAllocates,
    lineAdjustments,
    gapAllocates,
    claimLineData,
  }) => {
    setPayProcessing(true);
    try {
      if (!selClaims || selClaims.length === 0) {
        setPayProcessing(false);
        setAlert({
          type: "error",
          title: "No Claims",
          message: "No claims selected.",
          confirmText: "OK",
          onConfirm: () => setAlert(null),
        });
        return;
      }
      try {
        // Pre-build patientId map — some claims may have it, some may not
        // Use claimLineData to also check if line items carry patientId
        // Build patientId map from selClaims AND from loaded line data
        // claimLineData comes from PaymentProcessView's claimLines state (loaded from Zoho)
        // The lines themselves don't carry patientId, but we can re-check selClaims
        // The REAL fix: re-fetch claims to get fresh patientId values
        const resolvedPatientIds = {};

        // Pass 1: from selClaims directly
        selClaims.forEach((c) => {
          const pid = String(c.patientId || "").trim();
          if (pid && pid !== "0") {
            resolvedPatientIds[c.id] = pid;
            resolvedPatientIds[c.recordId] = pid;
          }
        });

        // Pass 2: for claims still missing patientId, try fetching fresh from Zoho
        const missingPatientClaims = selClaims.filter(
          (c) => !resolvedPatientIds[c.id] && !resolvedPatientIds[c.recordId]
        );
        if (isZohoAvailable() && missingPatientClaims.length > 0) {
          try {
            const freshClaims = await loadClaims(doctor?.id, hospital?.id);
            freshClaims.forEach((fc) => {
              const pid = String(fc.patientId || "").trim();
              if (pid && pid !== "0") {
                resolvedPatientIds[fc.id] = pid;
                resolvedPatientIds[fc.recordId] = pid;
              }
            });
          } catch (e) {
            console.warn(
              "[PayConfirm] Could not fetch fresh claims for patientId resolution:",
              e
            );
          }
        }

        const paymentItems = selClaims.map((cl) => {
          const claimAlloc = Number(claimAllocates?.[cl.id] || 0);
          const toN = (v) => {
            const n = Number(String(v ?? "0").replace(/[^0-9.\-]/g, ""));
            return isNaN(n) ? 0 : n;
          };
          const resolvedPatientId =
            String(cl.patientId || "").trim() ||
            resolvedPatientIds[cl.id] ||
            resolvedPatientIds[cl.recordId] ||
            "";
          console.log(
            `[PayConfirm] Claim ${cl.id} patientId=${cl.patientId} resolved=${resolvedPatientId}`
          );
          return {
            claimRecordId: cl.recordId || cl.id,
            displayId: cl.id,
            patientId: resolvedPatientId,
            claimTotalAmount: toN(cl.amt),
            allocateAmount: claimAlloc,
            currentBalanceDue: toN(cl.balanceDue),
            currentAllocatedAmount: toN(cl.allocatedAmount),
            gapAllocateAmount: toN(gapAllocates?.[cl.id]), // gap paid in this transaction
            currentGapPaidAmount: toN(cl.gapPaidAmount), // gap paid previously
            gapTotalAmount: toN(cl.gapAmount), // NEW — total configured Gap Amount on the claim
            lineItems: cl.svc || [],
            lineAllocates: lineAllocates || {},
            lineAdjustments: lineAdjustments || {},
            itemCodes: (claimLineData?.[cl.id] || cl.svc || []).map((ln) => ({
              itemNumber: ln.c || ln.itemNo || ln.itemNumber || "",
              itemId: ln.itemId || "", // ← NEW
              lineAmount: Number(ln.a || ln.r || ln.amountCharged || 0),
              lineBalanceDue: Number(ln.balanceDue ?? ln.a ?? ln.r ?? 0),
              linePaidAmount: Number(ln.allocatedAmount ?? 0),
            })),
          };
        });

        const meta = {
          doctorId: doctor?.id,
          hospitalId: hospital?.id,
          paymentMethod,
          paymentDate,
          payerName,
          patientName,
          totalAmount: allocateAmount,
        };
        let result = {
          lineSuccess: 0,
          lineFailed: 0,
          fullyPaidClaims: [],
          partialClaims: [],
          paymentRecordId: null,
          paymentError: false,
        };
        if (isZohoAvailable() && paymentItems.length > 0) {
          result = await processPayment(paymentItems, meta);

          // Update each claim line: Allocated_Amount, Balance_Due, Status
          if (result && !result.paymentError) {
           for (const item of paymentItems) {
  if (!item.allocateAmount || item.allocateAmount <= 0) continue;
  try {
    // FIX: must match the exact same filtering/ordering that PaymentProcessView
    // used when it built lineAllocates keys (via loadClaimLines, which drops
    // already-Paid lines). Using the raw/unfiltered list here shifts indexes
    // whenever a Paid line exists earlier in the report, causing allocation,
    // adjustment, and Payment_Date to land on the wrong line.
    const allFreshLines = await loadClaimLinesRaw(item.claimRecordId);
    const freshLines = allFreshLines.filter((ln) => {
      const st = String(ln.st || "").toLowerCase().trim();
      return st !== "paid" && st !== "fully paid" && st !== "fully_paid";
    });

    const lineAllocsMap = item.lineAllocates || {};

    for (let i = 0; i < freshLines.length; i++) {
      const ln = freshLines[i];
      if (!ln.id) continue;
      const lineKey = `${item.displayId || item.claimRecordId}__${i}`;
      const lineAllocAmt = Number(lineAllocsMap[lineKey] || 0);
      const currentLineBal = Number(ln.balanceDue ?? ln.a ?? ln.r ?? 0);
      const currentLineAlloc = Number(ln.allocatedAmount ?? 0);

      console.log(
        `[PayConfirm] Line[${i}] id=${ln.id} allocAmt=${lineAllocAmt} currentBal=${currentLineBal} currentAlloc=${currentLineAlloc}`
      );

      if (!ln.id || ln.id === "" || ln.id === "undefined") {
        console.warn(`[PayConfirm] Line[${i}] has no record ID — skipping update`);
        continue;
      }

      const lineAdjAmt = Number(lineAdjustments?.[lineKey] || 0);

      if (lineAllocAmt <= 0 && lineAdjAmt <= 0) continue;

      const newLineAlloc = Number((currentLineAlloc + lineAllocAmt).toFixed(2));
      const newLineBal = Number(
        Math.max(0, currentLineBal - lineAllocAmt - lineAdjAmt).toFixed(2)
      );
      const newLineStatus = newLineBal === 0 ? "Paid" : "Partially Paid";

      await updateClaimLineAmounts(ln.id, {
        allocatedAmount: newLineAlloc,
        balanceDue: newLineBal,
        status: newLineStatus,
        adjustmentAmount: lineAdjAmt > 0 ? lineAdjAmt : undefined,
        paymentDate: paymentDate,
      });
    }
  } catch (e) {
    console.warn("[PayConfirm] line update error:", e);
  }
}
          }

          // If payment record creation failed — show error and stop
          // If payment record creation failed — show error and stop
          if (result.paymentError) {
            setPayProcessing(false);
            setPaymentStage(null);
            setAlert({
              type: "error",
              title: "Payment Creation Failed",
              message:
                result.errorMessage ||
                "Could not create payment record in Zoho.\n\nClaims have NOT been modified.",
              confirmText: "OK",
              onConfirm: () => setAlert(null),
            });
            return;
          }
        } else {
          // Static fallback — simulate updates locally
          paymentItems.forEach((p) => {
            if (p.allocateAmount <= 0) return;
            const newBal = Number(
              Math.max(0, p.currentBalanceDue - p.allocateAmount).toFixed(2)
            );
            if (newBal === 0) result.fullyPaidClaims.push(p.claimRecordId);
            else result.partialClaims.push(p.claimRecordId);
            result.lineSuccess++;
          });
          // Update local claims state immediately
          setAllClaims((prev) =>
            prev.map((c) => {
              const item = paymentItems.find(
                (p) => p.claimRecordId === (c.recordId || c.id)
              );
              if (!item || item.allocateAmount <= 0) return c;
              const newBal = Number(
                Math.max(
                  0,
                  item.currentBalanceDue - item.allocateAmount
                ).toFixed(2)
              );
              const newAlloc = Number(
                (item.currentAllocatedAmount + item.allocateAmount).toFixed(2)
              );
              const newGapPaid =
                item.gapAllocateAmount > 0
                  ? Number(
                      (
                        item.currentGapPaidAmount + item.gapAllocateAmount
                      ).toFixed(2)
                    )
                  : c.gapPaidAmount;
              return {
                ...c,
                balanceDue: newBal,
                allocatedAmount: newAlloc,
                gapPaidAmount: newGapPaid, // NEW
                st: newBal === 0 ? "Fully Paid" : "Partially Paid",
              };
            })
          );
        }
        setPayProcessing(false);
        setShowPayPopup(false);
        const fc = result.fullyPaidClaims.length;
        const pc = result.partialClaims.length;
        let msg = `Payment of ${INR(allocateAmount)} processed.`;
        if (fc > 0) msg += `\n${fc} claim${fc !== 1 ? "s" : ""} fully paid.`;
        if (pc > 0)
          msg += `\n${pc} claim${pc !== 1 ? "s" : ""} partially paid.`;
        if (result.lineFailed > 0)
          msg += `\n⚠ ${result.lineFailed} update${
            result.lineFailed !== 1 ? "s" : ""
          } failed.`;
        setAlert({
          type: result.lineFailed > 0 ? "warning" : "success",
          title: "Payment Processed! 🎉",
          message: msg,
          amount: INR(allocateAmount),
          txn: `TXN · ${Date.now()
            .toString()
            .slice(-10)} · ${new Date().toLocaleDateString("en-AU")}`,
          confirmText: "Done",
          onConfirm: () => {
            setAlert(null);
            setPaymentStage(null);
            setSel([]);
            setLoading(true);
            if (isZohoAvailable()) {
              loadClaims(doctor.id, hospital.id)
                .then((data) => {
                  if (data.length)
                    setAllClaims((p) => [
                      ...data,
                      ...p.filter(
                        (c) =>
                          !(
                            String(c.did) === String(doctor.id) &&
                            String(c.hid) === String(hospital.id)
                          )
                      ),
                    ]);
                })
                .finally(() => setLoading(false));
            } else {
              setLoading(false);
            }
          },
        });
      } catch (err) {
        console.error("[PayConfirm] inner error:", err);
        setPayProcessing(false);

        setAlert({
          type: "error",
          title: "Payment Failed",
          message: `An error occurred: ${err?.message || err}`,
          confirmText: "OK",
          onConfirm: () => setAlert(null),
        });
      }
    } catch (outerErr) {
      console.error("[PayConfirm] outer error:", outerErr);
      setPayProcessing(false);

      setAlert({
        type: "error",
        title: "Payment Failed",
        message: `Unexpected error: ${outerErr?.message || outerErr}`,
        confirmText: "OK",
        onConfirm: () => setAlert(null),
      });
    }
  };

  return (
    <>
      {alert && <SweetAlert {...alert} onClose={() => setAlert(null)} />}
      {showPayPopup && (
        <PaymentConfirmPopup
          selectedClaims={selClaims}
          onClose={() => {
            if (!payProcessing) setShowPayPopup(false);
          }}
          onConfirm={({ allocateAmount, totalBalanceDue }) => {
            setShowPayPopup(false);
            setPaymentStage({ allocateAmount, totalBalanceDue });
          }}
          processing={payProcessing}
        />
      )}

      {paymentStage && (
        <PaymentProcessView
          selectedClaims={selClaims}
          doctor={doctor}
          hospital={hospital}
          totalAllocateAmount={paymentStage.allocateAmount}
          onBack={() => setPaymentStage(null)}
          onConfirmPayment={handlePayConfirm}
          processing={payProcessing}
        />
      )}
      {!paymentStage && (
        <>
          <div className="view-hdr">
            <div>
              <div className="view-ey">Claims</div>
              <div className="view-title">{doctor.name}</div>
              <div className="view-sub">
                🏥 {hospital.name} · {doctor.spec}
              </div>
            </div>
            <div className="view-acts">
              <button className="btn b-outline b-sm" onClick={onChangeProvider}>
                🔄 Change
              </button>
              <button
                className="btn b-outline b-sm"
                onClick={() => setShowNew(true)}
              >
                ＋ New
              </button>
              {sel.length === 1 && (
                <button
                  className="btn b-outline b-sm"
                  onClick={() => setShowAdjustment(true)}
                  style={{ borderColor: "#f59e0b", color: "#b45309" }}
                >
                  ⚖️ Adjustment
                </button>
              )}
              <button className="btn b-blue b-sm" onClick={handlePayClick}>
                💳 Payment
              </button>
            </div>
          </div>

          {/* Stats pills */}
          <div className="stat-pills">
            <div className="stat-pill stat-pill-bl">
              <div className="stat-pill-ic">📋</div>
              <div className="stat-pill-body">
                <span className="stat-pill-lbl">Total Claims</span>
                <span className="stat-pill-val">
                  {String(stats.total).padStart(2, "0")}
                </span>
              </div>
            </div>
            <div className="stat-pill-div" />
            <div className="stat-pill stat-pill-gr">
              <div
                className="stat-pill-ic"
                style={{
                  fontFamily: "monospace",
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                A$
              </div>
              <div className="stat-pill-body">
                <span className="stat-pill-lbl">Total Value</span>
                <span className="stat-pill-val">{INR(stats.amount)}</span>
              </div>
            </div>
            <div className="stat-pill-div" />
            <div className="stat-pill stat-pill-or">
              <div
                className="stat-pill-ic"
                style={{ fontSize: 11, fontWeight: 800 }}
              >
                BD
              </div>
              <div className="stat-pill-body">
                <span className="stat-pill-lbl">Balance Due</span>
                <span className="stat-pill-val">{INR(stats.balanceDue)}</span>
              </div>
            </div>
            <div className="stat-pill-div" />
            <div className="stat-pill stat-pill-gr">
              <div
                className="stat-pill-ic"
                style={{ fontSize: 11, fontWeight: 800 }}
              >
                PA
              </div>
              <div className="stat-pill-body">
                <span className="stat-pill-lbl">Paid Amount</span>
                <span className="stat-pill-val">{INR(stats.allocated)}</span>
              </div>
            </div>
          </div>

          {/* Patient filter bar */}

          {/* Toolbar */}
          <div className="tb">
            <div className="tb-s">
              <span className="si">🔍</span>
              <input
                placeholder="Search patient, ID, diagnosis…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
<StatusMultiSelect
  options={Object.keys(STATUS_CFG).filter((s) => s !== "Rejected")}
  value={statF}
  onChange={(v) => setStatF(v)}
/>
            <div className="sp" />
          </div>

          <div className="tbl-wrap">
            <div className="tbl-top">
              <div>
                <div className="tbl-title">
                  {doctor.name} — {hospital.name}
                </div>
                <div className="tbl-sub">
                  {loading
                    ? "Loading records…"
                    : `${visibleRows.length} record${
                        visibleRows.length !== 1 ? "s" : ""
                      } · ${statF}`}
                </div>
              </div>
              {sel.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--acc)",
                      background: "#eff6ff",
                      padding: "3px 10px",
                      borderRadius: 20,
                      border: "1px solid #bfdbfe",
                    }}
                  >
                    ✓ {sel.length} selected
                  </span>
                </div>
              )}
            </div>
            {loading ? (
              <div className="empty-state">
                <div className="empty-ic">
                  <span className="spin" style={{ fontSize: 36, opacity: 0.4 }}>
                    ⟳
                  </span>
                </div>
                <div className="empty-t">Loading Claims…</div>
                <div className="empty-tx">
                  Fetching records from Zoho Creator.
                </div>
              </div>
            ) : visibleRows.length === 0 ? (
              <div className="empty-state">
                <div className="empty-ic">🗂️</div>
                <div className="empty-t">No Claims Found</div>
                <div className="empty-tx">
                  {loading
                    ? "Fetching records from Zoho Creator."
                    : "No records found for this provider."}
                </div>
              </div>
            ) : (
              <>
                <div className="tbl-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th
                          className="chk-cell"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
          checked={allPageSelected}
onChange={togAll}
                          />
                        </th>
                        <th>Claim ID</th>
                        <th>Patient</th>
                        <th>Hospital</th>
                        <th>Date of Service</th>
                        <th>Date Lodged</th>
                        
                        <th>Claim Amt</th>
                        <th>Balance Due</th>
                        <th>Paid Amt</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRows.map((cl) => {
                        const hop = gH(cl.hid);
                        const isSel = sel.includes(cl.id);
                        const balanceDue = Number(cl.balanceDue) ?? cl.amt;
                        const allocatedAmt = Number(cl.allocatedAmount) ?? 0;
                        return (
                          <tr
                            key={cl.id}
                            className={isSel ? "rsel" : ""}
                            onClick={() => setDetailClaim(cl)}
                          >
                            <td
                              className="chk-cell"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={isSel}
                                onChange={() => tog1(cl.id)}
                              />
                            </td>
                            <td>
                              <span className="c-id">{cl.id}</span>
                            </td>
                            <td>
                              <div className="c-pn">{cl.pat}</div>
                              <div className="c-dx">{cl.dx}</div>
                            </td>
                            <td>
                              <div className="c-dn">{cl.hName || hop.name}</div>
                              <div className="c-ds">{hop.city}</div>
                            </td>

                            <td>
                              <span
                                className="c-dt"
                                style={{
                                  display: "block",
                                  maxWidth: 160,
                                  whiteSpace: "normal",
                                  lineHeight: 1.4,
                                }}
                              >
                                {claimDosMap[cl.id] ?? (
                                  <span
                                    className="spin"
                                    style={{ fontSize: 11 }}
                                  >
                                    ⟳
                                  </span>
                                )}
                              </span>
                            </td>
<td>
  <span className="c-dt" style={{ whiteSpace: "nowrap" }}>{cl.date}</span>
</td>
                            <td>
                              <span className="c-amt">{INR(cl.amt)}</span>
                            </td>
                            <td>
                              <span className="c-bal">{INR(balanceDue)}</span>
                            </td>
                            <td>
                              <span className="c-paid">
                                {INR(allocatedAmt)}
                              </span>
                            </td>
                            <td>
                              <Badge status={cl.st} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {sel.length > 0 && (
                  <div className="abar">
                    <div className="abar-ct">
                      <span className="abar-n">{sel.length}</span>selected
                    </div>
                    <span style={{ fontSize: 12, color: "var(--ink3)" }}>
                      Balance Due:{" "}
                      <strong style={{ color: "#b45309" }}>
                        {INR(
                          selClaims.reduce(
                            (t, c) => t + (Number(c.balanceDue) || 0),
                            0
                          )
                        )}
                      </strong>
                    </span>

                    <button
                      className="btn b-blue b-sm"
                      onClick={handlePayClick}
                    >
                      💳 Pay Selected
                    </button>
                    <button
                      className="btn b-ghost b-sm"
                      onClick={() => setSel([])}
                    >
                      ✕ Clear
                    </button>
                  </div>
                )}
                <div className="tbl-pagination">
  <div className="tbl-pg-info">
    {visibleRows.length === 0
      ? "No claims"
      : `Showing ${startIdx + 1}–${Math.min(
          startIdx + pageSize,
          visibleRows.length
        )} of ${visibleRows.length} claim${
          visibleRows.length !== 1 ? "s" : ""
        } (${totalLineItems} line item${totalLineItems !== 1 ? "s" : ""})`}
  </div>
  <div className="tbl-pg-ctrls">
    <span className="tbl-pg-size-label">Claims per page:</span>
    <select
      className="tbl-pg-size-sel"
      value={pageSize}
      onChange={(e) => {
        setPageSize(Number(e.target.value));
        setPage(1);
      }}
    >
      {[10, 25, 50, 100].map((n) => (
        <option key={n} value={n}>{n}</option>
      ))}
    </select>
    <button
      className="tbl-pg-btn"
      onClick={() => setPage(1)}
      disabled={clampedPage === 1}
      title="First page"
    >«</button>
    <button
      className="tbl-pg-btn"
      onClick={() => setPage((p) => Math.max(1, p - 1))}
      disabled={clampedPage === 1}
      title="Previous page"
    >‹</button>
    <div className="tbl-pg-num">{clampedPage}</div>
    <button
      className="tbl-pg-btn"
      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
      disabled={clampedPage === totalPages}
      title="Next page"
    >›</button>
    <button
      className="tbl-pg-btn"
      onClick={() => setPage(totalPages)}
      disabled={clampedPage === totalPages}
      title="Last page"
    >»</button>
  </div>
</div>
              </>
            )}
          </div>

          {showAdjustment && sel.length === 1 && (
            <AdjustmentPopup
              claim={selClaims[0]}
              onClose={() => setShowAdjustment(false)}
              onSave={({
                adjType,
                adjAmount,
                reason,
                newBal,
                newAlloc,
                newStatus,
              }) => {
                setAllClaims((prev) =>
                  prev.map((c) =>
                    c.id === selClaims[0].id
                      ? {
                          ...c,
                          balanceDue: newBal,
                          allocatedAmount: newAlloc,
                          st: newStatus,
                        }
                      : c
                  )
                );
                setSel([]);
                setShowAdjustment(false);
                setAlert({
                  type: "success",
                  title: "Adjustment Applied ✓",
                  message: `${adjType} adjustment of ${INR(
                    adjAmount
                  )} applied to claim ${
                    selClaims[0].id
                  }.\n\nNew Balance Due: ${INR(newBal)}`,
                  confirmText: "Done",
                });
              }}
            />
          )}
        </>
      )}

      {/* ── CLAIM DETAIL POPUP ── */}
      {detailClaim && (
        <ClaimDetailPopup
          claim={detailClaim}
          onClose={() => setDetailClaim(null)}
        />
      )}

      {/* ── NEW CLAIM MODAL ── */}
      {showNew && (
        <NewClaimModal
          dDoc={doctor}
          dHosp={hospital}
          onClose={() => setShowNew(false)}
          onSave={(newClaim) => {
            setAllClaims((prev) => [newClaim, ...prev]);
            setShowNew(false);
            setAlert({
              type: "success",
              title: "Claim Created ✓",
              message: `New claim created successfully.`,
              confirmText: "Done",
            });
          }}
        />
      )}
    </>
  );
}

function StatusMultiSelect({ options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const h = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const isAll = value.length === 0;
  const toggle = (opt) =>
    onChange(
      value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]
    );
  const label = isAll
    ? "All"
    : value.length === 1
    ? value[0]
    : `${value.length} statuses`;

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        className={`status-ms-btn ${open ? "open" : ""}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span
          style={{
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textAlign: "left",
          }}
        >
          {label}
        </span>
        <span className={`status-ms-chev ${open ? "up" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="status-ms-panel">
          <div
            className="status-ms-all"
            onClick={() => onChange([])}
            style={{
              background: isAll ? "var(--acc)" : "#fff",
              color: isAll ? "#fff" : "var(--ink)",
            }}
          >
            All
          </div>
          <div className="status-ms-list">
            {options.map((opt) => {
              const checked = value.includes(opt);
              const cfg = STATUS_CFG[opt];
              return (
                <div
                  key={opt}
                  className="status-ms-item"
                  onClick={() => toggle(opt)}
                  style={{ background: checked ? "#eff6ff" : "#fff" }}
                >
                  <div
                    className="status-ms-chk"
                    style={{
                      borderColor: checked ? "var(--acc)" : "var(--b2)",
                      background: checked ? "var(--acc)" : "#fff",
                    }}
                  >
                    {checked ? "✓" : ""}
                  </div>
                  {cfg && (
                    <span
                      className="bdot"
                      style={{ background: cfg.dot, width: 6, height: 6 }}
                    />
                  )}
                  <span>{opt}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
/* ─────────────────────────────────────────────────────────────────
   ROOT
───────────────────────────────────────────────────────────────── */
export default function App() {
  const [filter, setFilter] = useState(null);
  const [changingProvider, setChangingProvider] = useState(false);
  const [claims, setClaims] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [hospitals, setHospitals] = useState([]);

  return (
    <>
      <style>{CSS}</style>
      <header className="hdr">
        <div className="hdr-l">
          <div className="hdr-logo">
            <img
              src="https://creatorapp.zohopublic.com.au/file/medielveservices455/claims-management/All_Images/31559000000025010/Logo/image-download/rtkGyjp5y9p61VaD2WmyV0Y25a2YmmkN7OnvhCx8VFDxzsapwSJ4FgXOD5dYkXwHTFUw0aqeqT2CZZu8e9ZMMaTjSVwJn0tpZT54?filepath=1774006310068766_logo.png"
              alt="MediElves"
              onError={(e) => {
                e.target.style.display = "none";
                e.target.parentNode.style.background =
                  "linear-gradient(135deg,var(--acc),var(--acc2))";
                e.target.parentNode.innerHTML = "🏥";
              }}
            />
          </div>
          <div>
            <div className="hdr-name">Medi Elves</div>
            <div className="hdr-sub">Claims Management</div>
          </div>
        </div>
        <div className="hdr-r">
          {filter && (
            <div className="hdr-badge" onClick={() => setFilter(null)}>
              <span className="hdr-dot" />
              <span className="hdr-badge-txt">
                {filter.doctor.name} · {filter.hospital.name}
              </span>
              <span className="hdr-badge-x">✕</span>
            </div>
          )}
          <div className="hdr-av">AD</div>
        </div>
      </header>
      <div className="page">
        {filter && (
          <ClaimsView
            doctor={filter.doctor}
            hospital={filter.hospital}
            allDoctors={doctors}
            allHospitals={hospitals}
            allClaims={claims}
            setAllClaims={setClaims}
            onChangeProvider={() => setChangingProvider(true)}
          />
        )}
      </div>
      {!filter && (
        <ProviderPopup
          onConfirm={(f) => {
            if (f.doctor)
              setDoctors((p) =>
                p.find((d) => d.id === f.doctor.id) ? p : [...p, f.doctor]
              );
            if (f.hospital)
              setHospitals((p) =>
                p.find((h) => h.id === f.hospital.id) ? p : [...p, f.hospital]
              );
            setFilter(f);
          }}
        />
      )}
      {changingProvider && (
        <ProviderPopup
          initialDoctor={filter?.doctor || null}
          initialHospital={filter?.hospital || null}
          onConfirm={(f) => {
            if (f.doctor)
              setDoctors((p) =>
                p.find((d) => d.id === f.doctor.id) ? p : [...p, f.doctor]
              );
            if (f.hospital)
              setHospitals((p) =>
                p.find((h) => h.id === f.hospital.id) ? p : [...p, f.hospital]
              );
            setFilter(f);
            setChangingProvider(false);
          }}
        />
      )}
    </>
  );  const getLineAllocKey = (claimId, lineIdx) => `${claimId}__${lineIdx}`;

  const computeClaimAllocFromLines = (claimId, lines) => {
    if (!lines || lines.length === 0) return 0;
    return lines.reduce((t, _, i) => {
      const v = Number(lineAllocates[getLineAllocKey(claimId, i)] || 0);
      return t + v;
    }, 0);
  };
}
