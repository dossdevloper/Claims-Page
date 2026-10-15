/* ── REPORT NAMES ────────────────────────────────────────────────
   Change only these strings if report names change in Zoho.
─────────────────────────────────────────────────────────────────*/
export const REPORTS = {
  DOCTORS:      "All_Doctors",
  HOSPITALS:    "All_Hospitals",
  MAPPING:      "All_Doctor_Hospital_Mappings1",
  CLAIMS:       "Add_Claim_Report",
  CLAIM_LINES:  "Claim_Lines_Report",
  PATIENTS:     "Add_Patient_Report",
  HEALTH_FUNDS: "Add_Health_Fund_Report",
  ITEMS:        "Add_Item_Report",           // ← NEW — confirm actual report name
  REFERRING_DOCTORS:  "Referring_Doctor_Report",
  ASSISTANT_SURGEONS: "All_Assistant_Surgeons",   // ← NEW   
};
/* ══════════════════════════════════════════════════════════════════
   LOAD ITEMS PREVIEW — first N items only (single page, no full
   pagination). Used to pre-populate the Item dropdown before the
   user types anything, without pulling the whole 14k+ report.
══════════════════════════════════════════════════════════════════ */
export async function loadItemsPreview(limit = 200) {
  try {
    await initZoho();
    const res = await ZOHO.CREATOR.API.getAllRecords({
      reportName: REPORTS.ITEMS,
      page: 1,
      pageSize: limit,
    });
    if (!res || res.code !== 3000) return [];
    const rows = res.data ?? [];
    return rows
      .map(r => {
        const id = String(r.ID ?? r.id ?? "");
        const name = String(
          r.Item ?? r.Item_Number ?? r.Item_Name ?? r.Name ?? r.name ?? ""
        );
        const description = String(
          r.Description ?? r.description ?? ""
        );
        return { id, name, description };
      })
      .filter(i => i.id && i.name);
  } catch (err) {
    console.error("[ZohoAPI] loadItemsPreview:", err);
    return [];
  }
}
/* ══════════════════════════════════════════════════════════════════
   GENERATE NEXT SEQUENTIAL CLAIM ID — CLM_001, CLM_002, CLM_003…
══════════════════════════════════════════════════════════════════ */
// async function generateNextClaimId() {
//   const PREFIX = "CLM_";
//   const PAD    = 3; // CLM_001 — bump to 4 if you'll pass 999 claims

//   try {
//     const all = await fetchAllRecords(REPORTS.CLAIMS);
//     let maxNum = 0;

//     for (const r of all) {
//       const raw = r[ADD_CLAIM_F.claimId] ?? r["Claim_ID"] ?? "";
//       const val = typeof raw === "object"
//         ? String(raw.display_value ?? raw.value ?? "")
//         : String(raw ?? "");
//       const m = val.match(/^CLM_(\d+)$/i);
//       if (m) {
//         const n = parseInt(m[1], 10);
//         if (!isNaN(n) && n > maxNum) maxNum = n;
//       }
//     }

//     const next = maxNum + 1;
//     return `${PREFIX}${String(next).padStart(PAD, "0")}`;
//   } catch (err) {
//     console.error("[ZohoAPI] generateNextClaimId error:", err);
//     // Fallback — still sequential-looking, just less safe under collisions
//     return `${PREFIX}${String(Date.now()).slice(-PAD)}`;
//   }
// }

export const FORMS = {
  CLAIMS:        "Add_Claim_Report",
  CLAIM_LINES:   "Claim_Lines_Report",
  ADD_PAYMENT:   "Add_Payment",
  ADD_CLAIM:     "Add_Claim",
  ADD_PATIENT:   "Add_Patient",
  CLAIM_LINES_FORM: "Claim_Lines",   // ← actual subform name in Zoho (try this too)
  ADD_REFERRING_DOCTOR:  "Referring_Doctor", 
  ADD_ASSISTANT_SURGEON: "Assistant_Surgeons",   // ← NEW — form link name
};
// ── Staff field in Add_Claim ──────────────────────────────────────
const ADD_CLAIM_STAFF_F = "Staff"; // Lookup field name in Add_Claim form
const ALL_STAFFS_REPORT  = "All_Staffs";
const STAFF_EMAIL_F      = "Email";
const STAFF_NAME1_F      = "Name1"; // first_name / last_name object

// Referring Doctor report/form — field API names
const REFERRING_DOCTOR_F = {
  id:             "ID",
  name:           "Name",   // ← VERIFY exact field name in Zoho
  providerNumber: "Provider_Number",          // ← VERIFY exact field name in Zoho
};

// Assistant/Primary Surgeon report/form — field API names
const ASSISTANT_SURGEON_F = {
  id:         "ID",
  name:       "Name",          // ← link name in Zoho
  itemNumber: "Item_Number",   // ← link name in Zoho
};
/* ══════════════════════════════════════════════════════════════════
   REFERRING DOCTOR REPORT
══════════════════════════════════════════════════════════════════ */
export async function loadReferringDoctors() {
  try {
    await initZoho();
    const raw = await fetchAllRecords(REPORTS.REFERRING_DOCTORS);
    return raw.map(r => {
      const id = String(r.ID ?? r.id ?? "");

      const rawName = r[REFERRING_DOCTOR_F.name] ?? r.Name ?? "";
      let name = "";
      if (rawName && typeof rawName === "object") {
        name = String(
          rawName.display_value ||
          `${rawName.first_name ?? rawName.First_Name ?? ""} ${rawName.last_name ?? rawName.Last_Name ?? ""}`.trim() ||
          ""
        );
      } else {
        name = String(rawName ?? "").trim();
      }

      const providerNumber = String(
        r[REFERRING_DOCTOR_F.providerNumber] ?? r.Provider_Number ?? ""
      );
      return { id, name, providerNumber };
    }).filter(d => d.id && d.name);
  } catch (err) {
    console.error("[ZohoAPI] loadReferringDoctors:", err);
    return [];
  }
}
/* ══════════════════════════════════════════════════════════════════
   CREATE ASSISTANT / PRIMARY SURGEON — stores Name + Item_Number
   only, on the "Assistant_Surgeons" form.
══════════════════════════════════════════════════════════════════ */
export async function createAssistantSurgeonRecord({ name, itemNumber }) {
  await initZoho();

  const formData = {
    [ASSISTANT_SURGEON_F.name]:       String(name || "").trim(),
    [ASSISTANT_SURGEON_F.itemNumber]: String(itemNumber || "").trim(),
  };

  console.log("[ZohoAPI] createAssistantSurgeonRecord formData:", JSON.stringify(formData));
  try {
    const r = await ZOHO.CREATOR.API.addRecord({
      formName: FORMS.ADD_ASSISTANT_SURGEON,
      data:     { data: formData },
    });
    console.log("[ZohoAPI] createAssistantSurgeonRecord raw response:", JSON.stringify(r));

    if (r?.code === 3002) {
      console.error("[ZohoAPI] createAssistantSurgeonRecord validation errors:", JSON.stringify(r.error));
      return { success: false, recordId: null, error: r.error };
    }
    const ok    = r?.code === 3000;
    const newId = r?.data?.ID ?? r?.result?.ID ?? null;
    return {
      success: ok,
      recordId: newId,
      name: String(name || "").trim(),
      itemNumber: String(itemNumber || "").trim(),
    };
  } catch (err) {
    console.error("[ZohoAPI] createAssistantSurgeonRecord error:", err);
    return { success: false, recordId: null, error: String(err) };
  }
}
/* ══════════════════════════════════════════════════════════════════
   ASSISTANT / PRIMARY SURGEON REPORT
══════════════════════════════════════════════════════════════════ */
export async function loadAssistantSurgeons() {
  try {
    await initZoho();
    // NEW — detail_view forces lookup/name fields to return as
    // {display_value, ...} objects instead of flat IDs
    const raw = await fetchAllRecords(REPORTS.ASSISTANT_SURGEONS, {
      field_config: "detail_view",
    });

    if (raw.length > 0) {
      console.log("[ZohoAPI] RAW AssistantSurgeon keys:", Object.keys(raw[0]));
      console.log("[ZohoAPI] RAW AssistantSurgeon[0]:", JSON.stringify(raw[0]));
    }

    return raw
      .map((r) => {
        const id = String(r.ID ?? r.id ?? "");

        const rawName = r[ASSISTANT_SURGEON_F.name] ?? r.Name ?? "";
        let name = "";
        if (rawName && typeof rawName === "object") {
          name = String(
            rawName.display_value ||
              `${rawName.first_name ?? rawName.First_Name ?? ""} ${
                rawName.last_name ?? rawName.Last_Name ?? ""
              }`.trim() ||
              ""
          );
        } else {
          name = String(rawName ?? "").trim();
        }

        // NEW — guard: if what we got LOOKS like a raw Zoho record ID
        // (long digit string) rather than a real name, try other
        // possible name fields before giving up.
        const looksLikeRawId = /^\d{10,}$/.test(name);
        if (!name || looksLikeRawId) {
          const altRaw =
            r["Surgeon_Name"] ??
            r["Doctor_Name"] ??
            r["Full_Name"] ??
            r["surgeon_name"] ??
            null;
          if (altRaw) {
            name =
              typeof altRaw === "object"
                ? String(
                    altRaw.display_value ||
                      `${altRaw.first_name ?? ""} ${altRaw.last_name ?? ""}`.trim()
                  )
                : String(altRaw).trim();
          }
        }

        const itemNumber = String(
          r[ASSISTANT_SURGEON_F.itemNumber] ?? r.Item_Number ?? ""
        );

        return { id, name, itemNumber };
      })
      .filter((s) => s.id && s.name);
  } catch (err) {
    console.error("[ZohoAPI] loadAssistantSurgeons:", err);
    return [];
  }
}
export async function createReferringDoctorRecord({ name, providerNumber }) {
  await initZoho();

  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  const firstName = parts.shift() || "";
  const lastName  = parts.join(" ");

  const formData = {
    [REFERRING_DOCTOR_F.name]: {
      first_name: firstName,
      last_name:  lastName,
    },
    [REFERRING_DOCTOR_F.providerNumber]: String(providerNumber || ""),
  };

  console.log("[ZohoAPI] createReferringDoctorRecord formData:", JSON.stringify(formData));
  try {
    const r = await ZOHO.CREATOR.API.addRecord({
      formName: FORMS.ADD_REFERRING_DOCTOR,
      data:     { data: formData },
    });
    console.log("[ZohoAPI] createReferringDoctorRecord raw response:", JSON.stringify(r));

    if (r?.code === 3002) {
      console.error("[ZohoAPI] createReferringDoctorRecord validation errors:", JSON.stringify(r.error));
      return { success: false, recordId: null, error: r.error };
    }
    const ok    = r?.code === 3000;
    const newId = r?.data?.ID ?? r?.result?.ID ?? null;
    return { success: ok, recordId: newId, name: `${firstName} ${lastName}`.trim(), providerNumber };
  } catch (err) {
    console.error("[ZohoAPI] createReferringDoctorRecord error:", err);
    return { success: false, recordId: null, error: String(err) };
  }
}
// ── Add_Claim form — field API names ─────────────────────────────
const ADD_CLAIM_F = {
  doctor:                  "Doctor",
  hospital:                "Hospital",
  patient:                 "Patient",
  claimType:               "Claim_Type",
  status:                  "Status",
  dateOfService:           "Date_of_Service",
  claimDate:               "Claim_Date",
  claimId:                 "Claim_ID", 
  autoNumber:              "Auto_Number",  // ← NEW
  assistantSurgeons:       "Assistant_Surgeons",
  totalClaimAmount:        "Total_Claim_Amount",
  claimLines:              "Claim_Lines",
  staff:                   "Staff",
  primarySurgeon:          "Primary_Surgeon",
    primarySurgeon1:         "Primary_Surgeon1",    // ← NEW — real lookup field, linked to Assistant_Surgeons

  primarySurgeonItemNumber:"Primary_Surgeon_Item_Number",
  enableGap:               "Enable_Gap",
  gap:                     "Gap",
  payer:                   "Payer",
  healthFund:               "Health_Fund_Work_Cover",
  referringDoctor: "Referring_Doctor",
  providerNumber:  "Provider_Number",
  claimType: "Claim_Type",
  comments: "Notes",   // ← NEW
};
const _MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function formatClaimDate(d) {
  return `${String(d.getDate()).padStart(2,"0")}-${_MONTHS_SHORT[d.getMonth()]}-${d.getFullYear()}`;
}
// ── Claim_Lines subform — field API names ────────────────────────
const ADD_CLAIM_LINE_F = {
  claim:            "Claim",
  item:             "Item",            // lookup field → Item record ID
  amountCharged:    "Amount_Charged",
  primarySurgeon:   "Primary_Surgeon",
  description:      "Description",
  dateOfService:    "Date_of_Service",
  status:           "Status",
  balanceDue:       "Balance_Due",
  allocatedAmount:  "Allocated_Amount",
  paymentDate:      "Payment_Date",   // ← NEW
};

// Add_Payment form — field API names
const PAYMENT_F = {
  hospital:      "Hospital",
  doctor:        "Doctor",

  paymentMethod: "Payment_Method",
  paymentDate:   "payment_date",
  amount:        "Amount",
  payerName:     "Payer_Name",
  paymentItems:  "Payment_Items",
};

// Payment_Subform (line items) — field API names
const PAYMENT_SUBFORM_F = {
 patient:          "Patient",
  claimId:          "Claim_ID",
  amount:           "Amount",
  allocatedAmount:  "Allocated_Amount",
  balanceDue:       "Balance_Due",
  addPayment:       "Add_Payment",
  payerName:        "Payer_Name",
  itemCode:         "Item_Code",
  item:             "Item", 
  paidAmount:       "Paid_Amount",
};

/* ── FIELD NAMES ─────────────────────────────────────────────────*/

// All_Doctors — Specialization is a lookup field
const DOCTOR_F = {
  id:             "ID",
  name:           "Doctor_Name",
  specialization: "Specialization",
};

// All_Hospitals
const HOSPITAL_F = {
  id:   "ID",
  name: "Hospital_Name",
  city: "City",
  type: "Hospital_Type",
  acc:  "Accreditation",
};

// All_Doctor_Hospital_Mappings1
const MAPPING_F = {
  id:       "ID",
  doctor:   "Doctor",
  hospital: "Hospital",
};

// Add_Claim_Report
const CLAIM_F = {
  id:              "ID",
  claimNo:         "Claim_ID",
  patientName:     "Patient",
  doctor:          "Doctor",
  hospital:        "Hospital",
  claimDate:       "Claim_Date",
  status:          "Status",
  diagnosis:       "Diagnosis",
  totalAmount:     "Total_Claim_Amount",
  balanceDue:      "Balance_Due",
  allocatedAmount: "Allocated_Amount",
};

// Claim_Lines_Report
const CLAIM_LINE_F = {
  id:              "ID",
  claim:           "Claim",
   item:            "Item",
  itemNumber:      "Item_Number",          // ← CHANGED (was "Item_Number") — now a lookup field
  description:     "Description",
  amtCharged:      "Amount_Charged",
  status:          "Status",
  dateOfService:   "Date_of_Service",
  allocatedAmount: "Allocated_Amount",
  balanceDue:      "Balance_Due",
};

// Add_Patient form — field API names
const ADD_PATIENT_F = {
  patientName:      "Patient_Name",
  dateOfBirth:      "date_of_birth",
  gender:           "gender",
  age:              "Patient_Age",
  email:            "email",
  address:          "address",
  phone:            "Mobile",
  medicare:         "Medicare",
  healthFundName:   "Health_Fund_Name",
  membershipNumber: "Membership_Number",
  emergencyContactName:  "emergency_contact_name",
  emergencyContactPhone: "emergency_contact_phone",
  payer:            "Payer",   // ← NEW — verify exact API name in Zoho's Add_Patient form
  veteranAffairs:   "Veteran_Affairs",
  medicareIRN:      "Individual_Reference_Number",
  typeField:         "Type_field",          // ← NEW
  additionalDetails: "Additional_Details",  // ← NEW
};

/* ── SPEC → COLOUR MAP ───────────────────────────────────────────*/
const SPEC_COLORS = {
  "Cardiology":      "#0f766e",
  "Neurology":       "#7c3aed",
  "Orthopaedics":    "#1d4ed8",
  "Dermatology":     "#b45309",
  "Oncology":        "#15803d",
  "Paediatrics":     "#be185d",
  "Anaesthesiology": "#0369a1",
  "General Surgery": "#b91c1c",
  "Radiology":       "#0891b2",
  "Psychiatry":      "#6d28d9",
  "ENT":             "#065f46",
  "Gynaecology":     "#9d174d",
};
const DEFAULT_COLOR = "#64748b";

/* ══════════════════════════════════════════════════════════════════
   UTILITY HELPERS
══════════════════════════════════════════════════════════════════ */

function readLookup(raw) {
  if (!raw) return { id: null, displayValue: "" };
  if (typeof raw === "object") {
    return {
      id:           String(raw.ID ?? raw.id ?? ""),
      idNum:        raw.ID ?? raw.id ?? null,
      // Added zc_display_value — Zoho sometimes uses this key instead of display_value
      displayValue: String(
        raw.display_value ?? raw.Display_Value ?? raw.zc_display_value ??
        raw.Item ?? raw.item ?? raw.name ?? ""
      ),
    };
  }
  return { id: null, idNum: null, displayValue: String(raw) };
}
function lookupCriteria(fieldName, id) {
  const numeric = Number(id);
  if (!isNaN(numeric) && id !== "" && id !== null) {
    return `${fieldName}.ID == ${numeric}`;
  }
  return `${fieldName}.ID == "${id}"`;
}

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .map(w => w[0].toUpperCase())
    .slice(0, 2)
    .join("");
}

export function isZohoAvailable() {
  try { return typeof ZOHO !== "undefined" && !!ZOHO?.CREATOR?.API; }
  catch (_) { return false; }
}

let _inited = false;
export async function initZoho() {
  if (_inited) return;
  await ZOHO.CREATOR.init();
  _inited = true;
  console.log("[ZohoAPI] SDK ready");
}

/* ══════════════════════════════════════════════════════════════════
   PAGINATED RECORD FETCHER
══════════════════════════════════════════════════════════════════ */
const PAGE_SIZE = 200;

export async function fetchAllRecords(reportName, extra = {}) {
  const all = [];
  let page  = 1;

  while (true) {
    const cfg = { reportName, page, pageSize: PAGE_SIZE, ...extra };
    console.log(`[ZohoAPI] ${reportName} page ${page}`, cfg.criteria ?? "");

    let res;
    try {
      res = await ZOHO.CREATOR.API.getAllRecords(cfg);
    } catch (httpErr) {
      const code = httpErr?.code ?? httpErr?.status ?? 0;
      const msg  = httpErr?.message ?? httpErr?.responseText ?? String(httpErr);
      if (code === 3100 || String(msg).includes("3100") || String(msg).includes("No records")) {
        console.log(`[ZohoAPI] ${reportName}: no records (caught 3100/404)`);
      } else {
        console.error(`[ZohoAPI] ${reportName} HTTP error:`, httpErr);
      }
      break;
    }

    if (!res || res.code === 3100) {
      console.log(`[ZohoAPI] ${reportName}: no records found (3100)`);
      break;
    }

    if (res.code !== 3000) {
      console.error(`[ZohoAPI] Failed — ${reportName} (code ${res.code}): ${res.message}`);
      break;
    }

    const rows = res.data ?? [];
    all.push(...rows);
    console.log(`[ZohoAPI] Page ${page}: ${rows.length} rows (total ${all.length})`);

    if (rows.length < PAGE_SIZE) break;
    page++;
  }

  return all;
}

export function transformDoctor(raw) {
  const name = String(
    raw["Doctor_Name"]   ??
    raw["Doctor_Name1"]  ??
    raw["DoctorName"]    ??
    raw["doctor_name"]   ??
    raw["Name"]          ??
    raw["name"]          ??
    raw[DOCTOR_F.name]   ??
    ""
  );

  const specRaw = raw["Specialization"] ?? raw["specialization"] ?? raw["Specialty"] ?? raw[DOCTOR_F.specialization] ?? "";
  let spec = "";
  if (specRaw && typeof specRaw === "object") {
    spec = String(specRaw.display_value ?? specRaw.Display_Value ?? specRaw.name ?? specRaw.ID ?? "");
  } else {
    spec = String(specRaw ?? "");
  }

  const rawId   = raw["ID"] ?? raw["id"] ?? raw[DOCTOR_F.id] ?? "";
  const id      = String(rawId);
  const numId   = Number(rawId);
  const recordId = !isNaN(numId) && rawId !== "" ? numId : id;

  return { id, recordId, name, spec, av: initials(name), color: SPEC_COLORS[spec] ?? DEFAULT_COLOR };
}

export function transformHospital(raw) {
  const name  = String(raw[HOSPITAL_F.name] ?? raw.Hospital_Name ?? raw.Name ?? "");
  const rawId = raw[HOSPITAL_F.id] ?? raw.ID ?? "";
  const id    = String(rawId);
  const numId = Number(rawId);
  const recordId = !isNaN(numId) && rawId !== "" ? numId : id;

  return {
    id,
    recordId,
    name,
    city: String(raw[HOSPITAL_F.city] ?? raw.City ?? ""),
    type: String(raw[HOSPITAL_F.type] ?? raw.Hospital_Type ?? ""),
    acc:  String(raw[HOSPITAL_F.acc]  ?? raw.Accreditation  ?? ""),
  };
}

export function transformMapping(raw) {
  const doc  = readLookup(raw[MAPPING_F.doctor]  ?? raw.Doctor);
  const hosp = readLookup(raw[MAPPING_F.hospital] ?? raw.Hospital);
  return {
    id:           String(raw[MAPPING_F.id] ?? raw.ID ?? ""),
    doctorId:     doc.id,
    doctorName:   doc.displayValue,
    hospitalId:   hosp.id,
    hospitalName: hosp.displayValue,
  };
}



export async function loadDoctors() {
  try {
    await initZoho();
    const raw = await fetchAllRecords(REPORTS.DOCTORS);

    if (raw.length > 0) {
      console.log("[ZohoAPI] RAW Doctor keys:", Object.keys(raw[0]));
      console.log("[ZohoAPI] RAW Doctor[0]:", JSON.stringify(raw[0]));
    }

    const mapped = raw.map(r => {
      const transformed = transformDoctor(r);
      console.log("[ZohoAPI] Doctor raw->name:", JSON.stringify(r), "=>", transformed.name, "spec:", transformed.spec);
      return transformed;
    });

    const docs = mapped.filter(d => d.name);
    console.log("[DEBUG] All loaded doctors:", docs.map(d => `${d.name} | id:${d.id} | recordId:${d.recordId}`));
    return docs;
  } catch (err) {
    console.error("[ZohoAPI] loadDoctors:", err);
    return [];
  }
}

export async function loadHospitalsForDoctor(doctorId) {
  try {
    await initZoho();

    console.log(`[ZohoAPI] Fetching ALL mapping records to detect field names...`);
    const allMappings = await fetchAllRecords(REPORTS.MAPPING);

    if (allMappings.length === 0) {
      console.warn("[ZohoAPI] Mapping report has 0 records");
      return [];
    }

    const firstMap = allMappings[0];
    console.log("[ZohoAPI] RAW Mapping keys:", Object.keys(firstMap));

    const possibleDoctorKeys   = ["Doctor","doctor","Doctor_Name","DoctorName","Doctor_ID","Doctor1","Doctors","Provider","Physician"];
    const possibleHospitalKeys = ["Hospital","hospital","Hospital_Name","HospitalName","Hospital_ID","Hospital1","Hospitals","Clinic","Centre"];

    const doctorKey   = possibleDoctorKeys.find(k => k in firstMap);
    const hospitalKey = possibleHospitalKeys.find(k => k in firstMap);

    if (!doctorKey) {
      console.error("[ZohoAPI] Cannot detect doctor field in mapping.");
      return [];
    }

    const matched = allMappings.filter(m => {
      const docLookup = readLookup(m[doctorKey]);
      return String(docLookup.id) === String(doctorId);
    });

    if (!matched.length) return [];

    const hospitalIds = new Set(
      matched
        .map(m => {
          const hRaw   = hospitalKey ? m[hospitalKey] : null;
          const looked = readLookup(hRaw);
          return looked.id;
        })
        .filter(Boolean)
    );

    if (!hospitalIds.size) return [];

    const allHospitals = await fetchAllRecords(REPORTS.HOSPITALS);
    const filtered = allHospitals
      .map(transformHospital)
      .filter(h => hospitalIds.has(h.id));

    return filtered;

  } catch (err) {
    console.error("[ZohoAPI] loadHospitalsForDoctor:", err);
    return [];
  }
}

function transformClaimDynamic(raw, doctorField, hospitalField) {
  const doc  = readLookup(raw[doctorField]  ?? raw[CLAIM_F.doctor]  ?? raw.Doctor);
  const hosp = readLookup(raw[hospitalField] ?? raw[CLAIM_F.hospital] ?? raw.Hospital);

  // ── Referring Doctor / Provider Number ──
  const rawReferringDoc = raw["Referring_Doctor"] ?? "";
  const referringDocLookup = readLookup(rawReferringDoc);
  const referringDoctorId = referringDocLookup.id || "";
  let referringDoctorName = referringDocLookup.displayValue || "";
  if (referringDoctorName && typeof referringDoctorName === "object") {
    referringDoctorName = String(
      referringDoctorName.display_value ||
      `${referringDoctorName.first_name ?? ""} ${referringDoctorName.last_name ?? ""}`.trim() ||
      ""
    );
  }
  if (!referringDoctorName && typeof rawReferringDoc === "string") {
    referringDoctorName = rawReferringDoc;
  }
  const providerNumber = String(raw["Provider_Number"] ?? raw["provider_number"] ?? "");

  const rawPat = raw[CLAIM_F.patientName] ?? raw.Patient_Name ?? "";
  let pat = "";
  if (rawPat && typeof rawPat === "object") {
    pat = String(
      rawPat.display_value ||
      `${rawPat.first_name || ""} ${rawPat.last_name || ""}`.trim() ||
      rawPat.ID || ""
    );
  } else {
    pat = String(rawPat);
  }

  const recordId = String(raw[CLAIM_F.id] ?? raw.ID ?? "");
  // console.log("[DEBUG] RAW claim all fields:", JSON.stringify(raw));

  const isZohoAutoName = (s) => !s || /^\d{15,}$/.test(s) || /^[A-Za-z]+ \d{10,}$/.test(s);

  // Try every possible field name Zoho might use for the custom claim number
  const rawClaimId =
    raw["Claim_ID"]     ??
    raw["claim_id"]     ??
    raw["Claim_No"]     ??
    raw["Claim_Number"] ??
    raw["ClaimID"]      ??
    raw["Claim_Ref"]    ??
    raw["Reference_No"] ??
    raw[CLAIM_F.claimNo]??
    null;

  let customClaimNo = "";
  if (rawClaimId !== null && rawClaimId !== undefined) {
    if (typeof rawClaimId === "object") {
      customClaimNo = String(
        rawClaimId.display_value ??
        rawClaimId.Display_Value ??
        rawClaimId.value         ??
        rawClaimId.ID            ??
        ""
      );
    } else {
      customClaimNo = String(rawClaimId);
    }
  }

  const nameField = String(raw["Name"] ?? raw["name"] ?? "");

  // FIXED: only use nameField if it looks like a real claim number (e.g. "CLM-123")
  // Never fall back to recordId — show the recordId only as last resort
  const claimNo = (!isZohoAutoName(customClaimNo))
    ? customClaimNo
    : (!isZohoAutoName(nameField) ? nameField : recordId);

  const displayId = claimNo;
  if (typeof window !== "undefined" && !window.__claimIdDebugDone) {
    console.log("[ZohoAPI] RAW Claim_ID field:", JSON.stringify(rawClaimId), "→ displayId:", displayId);
    console.log("[ZohoAPI] All raw keys:", Object.keys(raw).join(", "));
    window.__claimIdDebugDone = true;
  }
  const amt = Number(raw[CLAIM_F.totalAmount] ?? raw.Total_Amount ?? 0);

  const parseNum = v => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
    return isNaN(n) ? null : n;
  };

  const balanceDue = parseNum(raw[CLAIM_F.balanceDue] ?? raw["Balance_Due"]) ?? amt;
  const allocatedAmount = parseNum(raw[CLAIM_F.allocatedAmount] ?? raw["Allocated_Amount"]) ?? 0;
  // Gap fields — configured/paid so far
  const gapAmount = parseNum(raw["Gap"] ?? raw["gap"]) ?? 0;
  const enableGapRaw = raw["Enable_Gap"] ?? raw["enable_gap"] ?? "";
  const enableGap = String(enableGapRaw).toLowerCase() === "true" || enableGapRaw === true;
  const gapPaidAmount = parseNum(raw["Gap_Paid_Amount"] ?? raw["gap_paid_amount"]) ?? 0;

  if (typeof window !== "undefined" && !window.__claimDebugDone) {
    console.log("[ZohoAPI] RAW Claim record keys:", Object.keys(raw));
    console.log("[ZohoAPI] RAW Claim record sample:", JSON.stringify(raw));
    console.log("[ZohoAPI] Balance_Due:", balanceDue, "| Allocated_Amount:", allocatedAmount);
    window.__claimDebugDone = true;
  }

  const rawPat2 = raw[CLAIM_F.patientName] ?? raw.Patient_Name ?? raw.Patient ?? "";
  let patientId = "";
  if (rawPat2 && typeof rawPat2 === "object") {
    patientId = String(rawPat2.ID ?? rawPat2.id ?? rawPat2.idNum ?? "");
  }
  // Also check dedicated patient ID fields Zoho sometimes exposes separately
  if (!patientId) {
    const altId = raw["Patient_ID"] ?? raw["patient_id"] ?? raw["PatientID"] ?? null;
    if (altId) patientId = String(altId);
  }

  // ── Extract Payer (strictly from the "Payer" lookup field) ──
  const rawPayer = raw["Payer"] ?? "";
  const payerName = rawPayer && typeof rawPayer === "object"
    ? String(rawPayer.display_value ?? rawPayer.Display_Value ?? rawPayer.name ?? "")
    : String(rawPayer ?? "");
  const payerId = rawPayer && typeof rawPayer === "object"
    ? String(rawPayer.ID ?? rawPayer.id ?? "")
    : "";

  // ── Extract Health Fund / Work Cover (strictly from "Health_Fund_Work_Cover") ──
  const rawHealthFund = raw["Health_Fund_Work_Cover"] ?? "";
  const healthFundName = rawHealthFund && typeof rawHealthFund === "object"
    ? String(rawHealthFund.display_value ?? rawHealthFund.Display_Value ?? rawHealthFund.name ?? "")
    : String(rawHealthFund ?? "");
  const healthFundId = rawHealthFund && typeof rawHealthFund === "object"
    ? String(rawHealthFund.ID ?? rawHealthFund.id ?? "")
    : "";

  if (typeof window !== "undefined" && !window.__claimPayerDebugDone) {
    console.log("[ZohoAPI] RAW Payer field:", JSON.stringify(rawPayer), "→ payerId:", payerId, "payerName:", payerName);
    console.log("[ZohoAPI] RAW Health_Fund_Work_Cover field:", JSON.stringify(rawHealthFund), "→ healthFundId:", healthFundId, "healthFundName:", healthFundName);
    window.__claimPayerDebugDone = true;
  }

  // Extract assistant surgeons
  const rawAsst = raw["Assistant_Surgeons"] ?? raw["assistant_surgeons"] ?? raw["AssistantSurgeons"] ?? raw["Assistant_Surgeon"] ?? raw["assistant_surgeon"] ?? "";
  const assistantSurgeons = rawAsst && typeof rawAsst === "object"
    ? String(rawAsst.display_value ?? rawAsst.Display_Value ?? rawAsst.name ?? "")
    : String(rawAsst ?? "");

  return {
    id:              displayId,
    recordId:        recordId,
    pat,
    patientId,
    payerName,        // Payer field only
    payerId,          // Payer field only
    healthFundName,   // Health Fund / Work Cover field only
    healthFundId,     // Health Fund / Work Cover field only
    referringDoctorId,     // NEW
    referringDoctorName,   // NEW
    providerNumber,        // NEW
    assistantSurgeons,
    did:             doc.id,
    dName:           doc.displayValue,
    hid:             hosp.id,
    hName:           hosp.displayValue,
    date:            String(
      raw[CLAIM_F.claimDate] ??
      raw.Claim_Date         ??
      raw.Date_of_Service    ??
      raw.Claim_date         ??
      raw.date               ??
      ""
    ),
    st:              String(raw[CLAIM_F.status]    ?? raw.Status     ?? "Pending"),
    dx:              String(raw[CLAIM_F.diagnosis] ?? raw.Diagnosis  ?? ""),
    svc:             [],
    amt,
    balanceDue,
    allocatedAmount,
    gapAmount,
    enableGap,
    gapPaidAmount,
  };
}
/* ══════════════════════════════════════════════════════════════════
   ITEMS CACHE — used to resolve an Item lookup's ID back to its
   display name, since Zoho sometimes returns just the plain ID
   string for this field instead of a {ID, display_value} object.
══════════════════════════════════════════════════════════════════ */
let _itemsMapCache = null;

async function _getItemsMap() {
  if (_itemsMapCache) return _itemsMapCache;
  const items = await loadItems();
  _itemsMapCache = new Map(items.map(i => [String(i.id), i.name]));
  return _itemsMapCache;
}

/* ══════════════════════════════════════════════════════════════════
   CLAIM LINES — BULK CACHE
   Previously _fetchClaimLines() hit Zoho once PER CLAIM (a criteria
   fetch, plus a full-table fallback fetch if criteria matched
   nothing, plus one getRecordById per line if "Item" was missing
   from the bulk response). That's why the Date of Service column
   took ~20s and why item numbers were slow to appear on the
   Payment page — every claim was a fresh round trip.

   Fix: pull Claim_Lines_Report ONCE, cache it, and group rows by
   claim in memory. Every subsequent call for any claim is then a
   free Map lookup instead of a network call. Concurrent callers
   (e.g. Promise.all across many claims) share the same in-flight
   promise, so they don't trigger duplicate downloads either.
══════════════════════════════════════════════════════════════════ */
let _claimLinesBulkCache = null;      // Promise<{ grouped, itemsMap, bulkHasItemField, claimKey }>
let _claimLinesBulkCacheAt = 0;
let _claimLinesClaimKey = null;
const CLAIM_LINES_CACHE_TTL = 45_000; // 45s — covers a normal page visit

export function invalidateClaimLinesCache() {
  _claimLinesBulkCache = null;
  _claimLinesBulkCacheAt = 0;
}

async function _loadAllClaimLinesGrouped() {
  const now = Date.now();
  if (_claimLinesBulkCache && (now - _claimLinesBulkCacheAt) < CLAIM_LINES_CACHE_TTL) {
    return _claimLinesBulkCache;
  }

  const promise = (async () => {
    const all = await fetchAllRecords(REPORTS.CLAIM_LINES, { field_config: "detail_view" });

    if (!_claimLinesClaimKey) {
      const sampleRec = all[0] ?? {};
      const possibleClaimKeys = [
        "Claim", "claim", "Claim_ID", "ClaimID", "Claim_No",
        "Claim1", "Parent_Claim", "Claim_Number", "Insurance_Claim"
      ];
      _claimLinesClaimKey = possibleClaimKeys.find(k => k in sampleRec) ?? "Claim";
    }
    const claimKey = _claimLinesClaimKey;

    const bulkHasItemField = all.some(r => "Item" in r);
    const itemsMap = await _getItemsMap();

    // NOTE: per-line "Item" resolution for lines missing the field is now
    // done lazily inside _fetchClaimLines (only for the requested claim's
    // lines), not here for the whole report — see _fetchClaimLines below.

    const grouped = new Map(); // claim record ID (string) -> raw rows[]
    for (const r of all) {
      const rawField = r[claimKey];
      const lookup = readLookup(rawField);
      let key = lookup.id ? String(lookup.id).trim() : "";
      if (!key && rawField && typeof rawField !== "object") {
        key = String(rawField).trim();
      }
      if (!key) continue;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(r);
    }

    return { grouped, itemsMap, bulkHasItemField, claimKey };
  })();

  _claimLinesBulkCache = promise;
  _claimLinesBulkCacheAt = now;
  try {
    return await promise;
  } catch (err) {
    _claimLinesBulkCache = null;
    _claimLinesBulkCacheAt = 0;
    throw err;
  }
}

/* ══════════════════════════════════════════════════════════════════
   SHARED CLAIM LINE FETCHER (internal helper — no Paid filter)
══════════════════════════════════════════════════════════════════ */
async function _fetchClaimLines(claimRecordId) {
  await initZoho();
  const key = String(claimRecordId ?? "").trim();
  const { grouped, itemsMap, bulkHasItemField, claimKey } = await _loadAllClaimLinesGrouped();

  let raw = grouped.get(key) || [];

  // Rare case: claim was created after the cache was warmed. Do ONE
  // targeted fetch for just this claim instead of re-downloading everything.
  if (raw.length === 0) {
    const numericId = Number(claimRecordId);
    const criteria = !isNaN(numericId) && claimRecordId !== ""
      ? `${claimKey}.ID == ${numericId}`
      : `${claimKey}.ID == "${claimRecordId}"`;
    raw = await fetchAllRecords(REPORTS.CLAIM_LINES, { criteria, field_config: "detail_view" });
  }

  // Resolve "Item" only for THIS claim's lines (a handful of rows), not
  // the whole report — avoids the 429 rate-limit storm on every load.
  if (!bulkHasItemField) {
    await _runWithConcurrency(raw, 3, async (r) => {
      if ("Item" in r) return;
      const lineId = r["ID"] ?? r["id"] ?? r[CLAIM_LINE_F.id];
      if (lineId) r.__resolvedItem = await _fetchItemFieldForLine(lineId);
    });
  }

return raw.map((r) => {
    const rawItemVal = "Item" in r ? r["Item"] : r.__resolvedItem;

    const itemLookup = readLookup(rawItemVal);
    let itemId = itemLookup.id || "";
    let itemNo = itemLookup.displayValue || "";
    if (!itemId && rawItemVal) {
      itemId = String(rawItemVal);
    }
    if (itemId && (!itemNo || itemNo === itemId)) {
      itemNo = itemsMap.get(String(itemId)) || itemNo || String(itemId);
    }

    const desc = String(r[CLAIM_LINE_F.description] ?? r.Description ?? "");
    const amt  = Number(r[CLAIM_LINE_F.amtCharged]  ?? r.Amount_Charged ?? 0);
    const st   = String(r[CLAIM_LINE_F.status]       ?? r.Status ?? "");
    const dos  = String(r[CLAIM_LINE_F.dateOfService] ?? r.Date_of_Service ?? "");
    // NEW — the date this line was actually paid (written by updateClaimLineAmounts)
    const paymentDate = String(r[ADD_CLAIM_LINE_F.paymentDate] ?? r.Payment_Date ?? "");

    const balDue = (() => {
      const v = r[CLAIM_LINE_F.balanceDue] ?? r["Balance_Due"] ?? r["balance_due"] ?? null;
      if (v === null || v === undefined || v === "") return amt;
      const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
      return isNaN(n) ? amt : n;
    })();

    const allocatedAmount = (() => {
      const v = r[CLAIM_LINE_F.allocatedAmount] ?? r["Allocated_Amount"] ?? r["allocated_amount"] ?? null;
      if (v === null || v === undefined || v === "") return 0;
      const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
      return isNaN(n) ? 0 : n;
    })();

    const asstRaw = r["Assistant_Surgeon"] ?? r["assistant_surgeon"] ?? r["Asst_Surgeon"] ?? null;
    let assistantSurgeon = "";
    if (asstRaw) {
      assistantSurgeon = typeof asstRaw === "object"
        ? String(asstRaw.display_value ?? asstRaw.Display_Value ?? asstRaw.Doctor_Name ?? asstRaw.name ?? "")
        : String(asstRaw);
    }

    return {
      id: String(r["ID"] ?? r["id"] ?? r[CLAIM_LINE_F.id] ?? ""),
      itemNo, itemId,
      d: desc || itemNo, c: itemNo, q: 1, r: amt, a: amt,
      balanceDue: balDue, allocatedAmount, st, dos, paymentDate, assistantSurgeon,   // ← ADD paymentDate here
    };
  });
}

/* ══════════════════════════════════════════════════════════════════
   FALLBACK: fetch a single Claim_Lines record's "Item" lookup value
   directly via getRecordById. Used when the bulk getAllRecords call
   for Claim_Lines_Report doesn't return the Item field (this happens
   for lookup fields that aren't on the report's column layout, even
   with field_config:"detail_view").
══════════════════════════════════════════════════════════════════ */
const _itemFieldCache = new Map(); // lineRecordId -> raw Item value

// Runs async tasks with at most `limit` in flight at once — prevents
// Zoho's 429 "Too Many Requests" rate limit from silently blanking
// out Item Numbers when many claim lines are missing the Item field.
async function _runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let idx = 0;
  async function runner() {
    while (idx < items.length) {
      const cur = idx++;
      results[cur] = await worker(items[cur], cur);
    }
  }
  const runners = Array.from({ length: Math.min(limit, items.length) }, runner);
  await Promise.all(runners);
  return results;
}

async function _fetchItemFieldForLine(lineRecordId, retries = 3) {
  const key = String(lineRecordId);
  if (_itemFieldCache.has(key)) return _itemFieldCache.get(key);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = await ZOHO.CREATOR.API.getRecordById({
        reportName: REPORTS.CLAIM_LINES,
        id: key,
      });
      const val = (r?.code === 3000 && r?.data) ? (r.data["Item"] ?? null) : null;
      _itemFieldCache.set(key, val);
      return val;
    } catch (err) {
      const status = err?.code ?? err?.status ?? 0;
      const msg = String(err?.message ?? err?.responseText ?? err ?? "");
      const isRateLimited = status === 429 || msg.includes("429") || msg.includes("2955");
      if (isRateLimited && attempt < retries) {
        // Exponential backoff: 500ms, 1000ms, 2000ms…
        const wait = 500 * Math.pow(2, attempt);
        console.warn(`[ZohoAPI] _fetchItemFieldForLine(${key}) rate-limited, retrying in ${wait}ms (attempt ${attempt + 1}/${retries})`);
        await new Promise((res) => setTimeout(res, wait));
        continue;
      }
      console.warn(`[ZohoAPI] _fetchItemFieldForLine(${key}) error:`, err);
      _itemFieldCache.set(key, null);
      return null;
    }
  }
  _itemFieldCache.set(key, null);
  return null;
}
/* ══════════════════════════════════════════════════════════════════
   UPDATE CLAIM LINE — Allocated_Amount + Balance_Due + Status
   
   FIX: Zoho subform line records can ONLY be updated via their own
   standalone report (Claim_Lines_Report) or form (Claim_Lines).
   The parent report (Add_Claim_Report) does NOT work for individual
   subform row record IDs.
══════════════════════════════════════════════════════════════════ */
export async function updateClaimLineAmounts(lineRecordId, { allocatedAmount, balanceDue, status, adjustmentAmount, paymentDate }) {
  await initZoho();
  const toNum = v => {
    if (v === null || v === undefined || v === "") return 0;
    const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
    return isNaN(n) ? 0 : n;
  };

  const newAlloc  = toNum(allocatedAmount);
  const newBal    = toNum(balanceDue);
  const newStatus = status ?? (newBal === 0 ? "Paid" : "Partially Paid");

  const fieldData = {
    [ADD_CLAIM_LINE_F.allocatedAmount]: newAlloc,
    [ADD_CLAIM_LINE_F.balanceDue]:      newBal,
    [ADD_CLAIM_LINE_F.status]:          newStatus,
  };
  if (adjustmentAmount && adjustmentAmount > 0) {
    fieldData["Adjustment_Amount"] = Number(adjustmentAmount.toFixed(2));
  }
  // NEW — record the date this line was actually paid
  if (paymentDate) {
    fieldData[ADD_CLAIM_LINE_F.paymentDate] = String(paymentDate);
  }

  console.log(`[ZohoAPI] updateClaimLineAmounts id=${lineRecordId}`, JSON.stringify(fieldData));

  // ── FIX: Only try the subform's own report and form name.
  // The parent report (Add_Claim_Report / Add_Claim) does NOT work
  // for updating individual subform row records by their ID.
  const reportNames = [
    REPORTS.CLAIM_LINES,      // "Claim_Lines_Report" — primary: subform's own report
    FORMS.CLAIM_LINES_FORM,   // "Claim_Lines"        — fallback: actual Zoho form name
  ];

  for (const reportName of reportNames) {
    try {
      const r = await ZOHO.CREATOR.API.updateRecord({
        reportName,
        id:   String(lineRecordId),
        data: { data: fieldData },
      });
      console.log(`[ZohoAPI] updateClaimLineAmounts [${reportName}] code=${r?.code} msg=${r?.message}`);
      if (r?.code === 3000) {
        console.log(`[ZohoAPI] updateClaimLineAmounts SUCCESS via [${reportName}]`);
        invalidateClaimLinesCache();   // ← ADD THIS
        return true;
      }
      console.warn(`[ZohoAPI] updateClaimLineAmounts [${reportName}] failed (${r?.code}): ${r?.message}, trying next…`);
    } catch (err) {
      console.warn(`[ZohoAPI] updateClaimLineAmounts [${reportName}] threw:`, err);
    }
  }
  console.error(`[ZohoAPI] updateClaimLineAmounts — ALL attempts failed for line id=${lineRecordId}`);
  return false;
}

/* ══════════════════════════════════════════════════════════════════
   LOAD CLAIM LINES RAW — all lines including Paid (for updates)
══════════════════════════════════════════════════════════════════ */
export async function loadClaimLinesRaw(claimRecordId) {
  try {
    console.log(`[ZohoAPI] loadClaimLinesRaw for recordId: ${claimRecordId}`);
    const lines = await _fetchClaimLines(claimRecordId);
    console.log(`[ZohoAPI] loadClaimLinesRaw returning ${lines.length} lines (no filter)`);
    return lines;
  } catch (err) {
    console.error("[ZohoAPI] loadClaimLinesRaw error:", err);
    return [];
  }
}

export async function loadClaimLines(claimRecordId) {
  try {
    await initZoho();
    console.log(`[ZohoAPI] loadClaimLines for recordId: ${claimRecordId}`);
    const allLines = await _fetchClaimLines(claimRecordId);
    const activeLines = allLines.filter(ln => {
      const st = String(ln.st || "").toLowerCase().trim();
      return st !== "paid" && st !== "fully paid" && st !== "fully_paid";
    });
    console.log(`[ZohoAPI] loadClaimLines returning ${activeLines.length} active (${allLines.length} total)`);
    return activeLines;
  } catch (err) {
    console.error("[ZohoAPI] loadClaimLines error:", err);
    return [];
  }
}

export async function loadClaims(doctorId, hospitalId) {
  try {
    await initZoho();

    const sample = await fetchAllRecords(REPORTS.CLAIMS, { pageSize: 1 });
    const sampleRec = sample[0] ?? {};

    if (sample.length > 0) {
      console.log("[ZohoAPI] RAW Claim keys:", Object.keys(sampleRec));
    }

    const possibleDoctorKeys   = ["Doctor","doctor","Doctor_Name","DoctorName","Doctor_ID","Doctor1","Provider","Physician"];
    const possibleHospitalKeys = ["Hospital","hospital","Hospital_Name","HospitalName","Hospital_ID","Hospital1","Clinic","Centre"];
    const claimDoctorField   = possibleDoctorKeys.find(k => k in sampleRec)   ?? CLAIM_F.doctor;
    const claimHospitalField = possibleHospitalKeys.find(k => k in sampleRec) ?? CLAIM_F.hospital;

    let raw = [];
    const criteria = `${lookupCriteria(claimDoctorField, doctorId)} && ${lookupCriteria(claimHospitalField, hospitalId)}`;
    raw = await fetchAllRecords(REPORTS.CLAIMS, { criteria });

    if (raw.length === 0) {
      const allClaims = await fetchAllRecords(REPORTS.CLAIMS);
      raw = allClaims.filter(r => {
        const doc  = readLookup(r[claimDoctorField]);
        const hosp = readLookup(r[claimHospitalField]);
        return String(doc.id  || "").trim() === String(doctorId   || "").trim() &&
               String(hosp.id || "").trim() === String(hospitalId || "").trim();
      });
    }

    const claims = raw.map(r => transformClaimDynamic(r, claimDoctorField, claimHospitalField));
    
    return claims;

  } catch (err) {
    console.error("[ZohoAPI] loadClaims:", err);
    return [];
  }
}

export async function updateRecord(reportName, id, fieldData) {
  await initZoho();
  try {
    console.log(`[ZohoAPI] updateRecord reportName=${reportName} id=${id} data=`, JSON.stringify(fieldData));
    const r = await ZOHO.CREATOR.API.updateRecord({
      reportName,
      id:   String(id),
      data: { data: fieldData },
    });
    console.log(`[ZohoAPI] updateRecord response code=${r?.code} msg=${r?.message}`);
    const ok = r?.code === 3000;
    if (!ok) console.error(`[ZohoAPI] updateRecord failed (code ${r?.code}): ${r?.message}`, JSON.stringify(r));
    return ok;
  } catch (err) {
    console.error(`[ZohoAPI] updateRecord error:`, err);
    return false;
  }
}

export async function processPayment(paymentItems, paymentMeta = {}) {
  let lineSuccess       = 0;
  let lineFailed        = 0;
  const fullyPaidClaims = [];
  const partialClaims   = [];

  const toNum = v => {
    if (v === null || v === undefined || v === "") return 0;
    const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
    return isNaN(n) ? 0 : n;
  };

  // ── Step 1: Create Add_Payment record FIRST ──────────────────
  let paymentRecordId = null;
  let paymentSuccess  = false;
  try {
const claimDetails = paymentItems.map(item => ({
      claimRecordId:          item.claimRecordId,
      displayId:              item.displayId || item.claimRecordId,
      patientId:              item.patientId || "",
      claimTotalAmount:       toNum(item.claimTotalAmount || item.currentBalanceDue),
      allocateAmount:         toNum(item.allocateAmount),
      currentBalanceDue:      toNum(item.currentBalanceDue),
      currentAllocatedAmount: toNum(item.currentAllocatedAmount),
      gapAllocateAmount:      toNum(item.gapAllocateAmount),      // exact "Pay Gap" amount entered now
      currentGapPaidAmount:   toNum(item.currentGapPaidAmount),   // gap paid in earlier payments
      gapTotalAmount:         toNum(item.gapTotalAmount),         // NEW — total configured Gap Amount
      itemCodes:              item.itemCodes || [],
      lineAllocates:          item.lineAllocates || {},
      lineAdjustments:        item.lineAdjustments || {},
    }));

    const payResult = await createPaymentRecord({
      doctorId:      paymentMeta.doctorId,
      hospitalId:    paymentMeta.hospitalId,
      paymentMethod: paymentMeta.paymentMethod,
      paymentDate:   paymentMeta.paymentDate,
      payerName:     paymentMeta.payerName,
      patientName:   paymentMeta.patientName,
      totalAmount:   paymentMeta.totalAmount,
      claimDetails,
    });

    paymentSuccess  = payResult.success;
    paymentRecordId = payResult.recordId;

    console.log(`[ZohoAPI] Add_Payment created: success=${paymentSuccess} id=${paymentRecordId}`);

    if (!paymentSuccess) {
      return {
        lineSuccess: 0,
        lineFailed:  paymentItems.length,
        fullyPaidClaims: [],
        partialClaims:   [],
        paymentRecordId: null,
        paymentError: true,
        errorMessage: "Payment record could not be created in Zoho. Claims have NOT been updated.",
      };
    }
  } catch (err) {
    console.error("[ZohoAPI] processPayment — createPaymentRecord error:", err);
    return {
      lineSuccess: 0,
      lineFailed:  paymentItems.length,
      fullyPaidClaims: [],
      partialClaims:   [],
      paymentRecordId: null,
      paymentError: true,
      errorMessage: `Payment creation failed: ${String(err)}`,
    };
  }

  // ── Step 2: Payment created — now update each claim ──────────
  for (const item of paymentItems) {
    const allocateAmt  = toNum(item.allocateAmount);
    const currentBal   = toNum(item.currentBalanceDue);
    const currentAlloc = toNum(item.currentAllocatedAmount);

    if (allocateAmt <= 0) {
      console.log(`[ZohoAPI] Skipping claim ${item.claimRecordId} — allocateAmt is 0`);
      partialClaims.push(item.claimRecordId);
      continue;
    }

  // Sum all line-level adjustments for this claim
    const claimTotalAdj = (() => {
      const lines = item.itemCodes || [];
      let total = 0;
      for (let i = 0; i < lines.length; i++) {
        const key = `${item.displayId || item.claimRecordId}__${i}`;
        total += Number(item.lineAdjustments?.[key] || 0);
      }
      return Number(total.toFixed(2));
    })();

    const newBalanceDue = Number(Math.max(0, currentBal - allocateAmt - claimTotalAdj).toFixed(2));
    const newAllocated  = Number((currentAlloc + allocateAmt).toFixed(2));
    const newStatus     = newBalanceDue === 0 ? "Fully Paid" : "Partially Paid";

    const claimUpdateData = {
      [CLAIM_F.balanceDue]:      newBalanceDue,
      [CLAIM_F.allocatedAmount]: newAllocated,
      [CLAIM_F.status]:          newStatus,
    };
    if (claimTotalAdj > 0) {
      claimUpdateData["Adjustment_Amount"] = claimTotalAdj;
    }

    // NEW: accumulate Gap_Paid_Amount whenever gap money was paid in this transaction
    const gapAllocAmt = toNum(item.gapAllocateAmount);
    if (gapAllocAmt > 0) {
      const newGapPaid = Number((toNum(item.currentGapPaidAmount) + gapAllocAmt).toFixed(2));
      claimUpdateData["Gap_Paid_Amount"] = newGapPaid;
      console.log(`[ZohoAPI] Claim ${item.claimRecordId} Gap_Paid_Amount → ${newGapPaid}`);
    }

    const ok = await updateRecord(REPORTS.CLAIMS, item.claimRecordId, claimUpdateData);

    console.log(`[ZohoAPI] updateRecord result for ${item.claimRecordId}: ${ok}`);

    if (ok) {
      lineSuccess++;
      if (newStatus === "Fully Paid") fullyPaidClaims.push(item.claimRecordId);
      else                            partialClaims.push(item.claimRecordId);
    } else {
      lineFailed++;
    }
  }

  return { lineSuccess, lineFailed, fullyPaidClaims, partialClaims, paymentRecordId, paymentError: false };
}

/* ══════════════════════════════════════════════════════════════════
   LOAD PATIENTS
══════════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════
   FIX: loadPatients() was dropping Membership_Number and the health
   fund name when it mapped each raw Zoho record into a patient object.

   BEFORE (the bug):
     return { id: String(r.ID ?? r.id ?? ""), name, dob, phone };

   The raw record `r` DOES contain Membership_Number (confirmed via
   your devtools console log), but it was thrown away right here —
   only id/name/dob/phone survived. That's why every place reading
   selectedPatient.Membership_Number got `undefined`, no matter what
   patient was selected.

   HOW TO APPLY:
   In your zohoapi.jsx, find the existing loadPatients() function and
   replace it entirely with the version below.
══════════════════════════════════════════════════════════════════ */

export async function loadPatients() {
  try {
    await initZoho();
    const raw = await fetchAllRecords(REPORTS.PATIENTS);
    if (raw.length > 0) {
      console.log("[ZohoAPI] RAW Patient keys:", Object.keys(raw[0]));
    }
    const patients = raw.map(r => {
      const rawName = r.Patient_Name ?? r.Name ?? r.name ?? "";
      let name = "";
      if (rawName && typeof rawName === "object") {
        name = String(
          rawName.display_value ||
          `${rawName.first_name || ""} ${rawName.last_name || ""}`.trim() ||
          ""
        );
} else {
  name = String(rawName ?? "").trim();   // ← rawName is just the raw ID here
}

      const rawDob = r[ADD_PATIENT_F.dateOfBirth] ?? r.date_of_birth ?? r.Date_of_Birth ?? r.DOB ?? r.dob ?? "";
      const dob = String(rawDob || "").trim();

      const rawPhone = r[ADD_PATIENT_F.phone] ?? r.Mobile ?? r.mobile ?? r.Phone ?? r.phone ?? "";
      const phone = String(rawPhone || "").trim();

      // ── FIX: pull Membership_Number through instead of dropping it ──
      const membershipNumber = String(
        r[ADD_PATIENT_F.membershipNumber] ?? r.Membership_Number ?? r.membership_number ?? ""
      ).trim();

      // ── FIX: also pull the patient's Health Fund / Work Cover name through ──
      let healthFundRaw =
        r["Health_Fund_Work_cover_Name"] ??
        r["Health_Fund_Work_Cover_Name"] ??
        r["Health_fund_Work_Cover_Name"] ??
        null;
      if (Array.isArray(healthFundRaw)) healthFundRaw = healthFundRaw[0];
      const healthFundName =
        healthFundRaw && typeof healthFundRaw === "object"
          ? String(healthFundRaw.display_value ?? healthFundRaw.Display_Value ?? healthFundRaw.name ?? "")
          : String(healthFundRaw ?? "");

      return {
        id: String(r.ID ?? r.id ?? ""),
        name,
        dob,
        phone,
        // Both key styles included so any existing UI code (which we've seen check
        // Membership_Number, membershipNumber, and membership_number) will find it.
        Membership_Number: membershipNumber,
        membershipNumber,
        Health_Fund_Work_cover_Name: healthFundRaw,
        healthFundName,
      };
    }).filter(p => p.name);
    return patients;
  } catch (err) {
    console.error("[ZohoAPI] loadPatients:", err);
    return [];
  }
}

function buildPatientFormData({
  firstName,
  lastName,
  dateOfBirth,
  gender,
  age,
  email,
  addressLine1,
  addressLine2,
  city,
  state,
  postalCode,
  country,
  phone,
  medicare,
  healthFundIds,
  payerId,
  membershipNumber,
  emergencyContactName,
  emergencyContactPhone,
  patientStatus,
  dvaNumber,
  medicareIRN, 
  hfType,               // ← NEW
  hfAdditionalDetails,
}) {
  const formData = {
    [ADD_PATIENT_F.patientName]: {
      first_name: String(firstName || ""),
      last_name:  String(lastName  || ""),
    },
    [ADD_PATIENT_F.dateOfBirth]: String(dateOfBirth || ""),
    [ADD_PATIENT_F.gender]:      String(gender      || ""),
    [ADD_PATIENT_F.age]: (() => {
      const n = Number(String(age ?? "").trim());
      return isNaN(n) ? 0 : n;
    })(),
    [ADD_PATIENT_F.email]:       String(email       || ""),
    [ADD_PATIENT_F.phone]:       String(phone       || ""),
  };

  const hasAddress = addressLine1 || addressLine2 || city || state || postalCode;
  if (hasAddress) {
    formData[ADD_PATIENT_F.address] = {
      address_line_1: String(addressLine1 || ""),
      address_line_2: String(addressLine2 || ""),
      district_city:  String(city        || ""),
      state_province: String(state       || ""),
      postal_code:    String(postalCode  || ""),
      country:        String(country     || ""),
    };
  }

 if (medicare !== undefined) formData[ADD_PATIENT_F.medicare] = String(medicare || "");
  if (membershipNumber !== undefined) formData[ADD_PATIENT_F.membershipNumber] = String(membershipNumber || "");
  if (hfType !== undefined) formData[ADD_PATIENT_F.typeField] = String(hfType || "");
  if (hfAdditionalDetails !== undefined) formData[ADD_PATIENT_F.additionalDetails] = String(hfAdditionalDetails || "");
  if (medicareIRN !== undefined) formData[ADD_PATIENT_F.medicareIRN] = String(medicareIRN || "");   // ← NEW

  if (healthFundIds !== undefined) {
    const value = healthFundIds === "" ? "" : healthFundIds;
    if (Array.isArray(value)) {
      formData["Health_Fund_Work_cover_Name"] = value.map(id => String(id));
    } else {
      formData["Health_Fund_Work_cover_Name"] = String(value);
    }
  }

  if (payerId !== undefined) {
    formData[ADD_PATIENT_F.payer] = payerId === "" ? "" : String(payerId);
  }

  // ── NEW: DVA / Veteran Affairs — was completely missing before ──
  if (dvaNumber !== undefined) {
    formData[ADD_PATIENT_F.veteranAffairs] = dvaNumber === "" ? "" : String(dvaNumber);
  }

  return formData;
}
function readNameLike(raw) {
  if (!raw) return "";
  if (typeof raw === "object") {
    const display = raw.display_value ?? raw.Display_Value ?? "";
    if (display) return String(display).trim();
    return `${raw.first_name ?? raw.First_Name ?? ""} ${raw.last_name ?? raw.Last_Name ?? ""}`.trim();
  }
  return String(raw).trim();
}
export async function loadPatientById(patientId) {
  try {
    await initZoho();
    if (!patientId) return null;
    const all = await fetchAllRecords(REPORTS.PATIENTS, { field_config: "detail_view" });
    let rec = all.find(r => String(r.ID ?? r.id ?? "").trim() === String(patientId).trim());
    if (!rec) {
      console.warn("[ZohoAPI] loadPatientById: patient not found for id:", patientId);
      return null;
    }

    // Some fields (e.g. Type_field, Additional_Details) can be missing from the
    // bulk report response even with detail_view — fall back to a direct
    // per-record fetch to fill in whatever the bulk call dropped.
    const hasType = "Type_field" in rec || "Type_Field" in rec;
    const hasAdd  = "Additional_Details" in rec || "Additional_details" in rec;
    if (!hasType || !hasAdd) {
      try {
        const single = await ZOHO.CREATOR.API.getRecordById({
          reportName: REPORTS.PATIENTS,
          id: String(rec.ID ?? rec.id ?? patientId),
        });
        if (single?.code === 3000 && single?.data) {
          console.log("[ZohoAPI] loadPatientById detail-fetch keys:", Object.keys(single.data));
          rec = { ...rec, ...single.data };
        }
      } catch (detailErr) {
        console.warn("[ZohoAPI] loadPatientById getRecordById fallback failed:", detailErr);
      }
    }

    // Zoho "Name"-type fields come back as {first_name, last_name} objects —
    // convert to plain strings so the edit form doesn't render "[object Object]".
    const emergencyContactName = readNameLike(
      rec[ADD_PATIENT_F.emergencyContactName] ?? rec["emergency_contact_name"] ?? ""
    );

    return {
      ...rec,
      id: String(rec.ID ?? rec.id ?? ""),
      emergency_contact_name: emergencyContactName,
    };
  } catch (err) {
    console.error("[ZohoAPI] loadPatientById:", err);
    return null;
  }
}
/* ══════════════════════════════════════════════════════════════════
   CREATE PATIENT
══════════════════════════════════════════════════════════════════ */
export async function createPatientRecord({
  firstName,
  lastName,
  dateOfBirth,
  gender,
  age,
  email,
  addressLine1,
  addressLine2,
  city,
  state,
  postalCode,
  country,
  phone,
  medicare,
  medicareIRN,           // ← FIX — was missing, caused "medicareIRN is not defined"
  healthFundIds,
  payerId,
  membershipNumber,
  emergencyContactName,
  emergencyContactPhone,
  patientStatus,
  dvaNumber, 
  hfType,
  hfAdditionalDetails,
}) {
  await initZoho();

  const formData = buildPatientFormData({
    firstName,
    lastName,
    dateOfBirth,
    gender,
    age,
    email,
    addressLine1,
    addressLine2,
    city,
    state,
    postalCode,
    country,
    phone,
    medicare,
    healthFundIds,
    medicareIRN,       // ← NEW
    payerId,
    membershipNumber,
    emergencyContactName,
    emergencyContactPhone,
    patientStatus,
    dvaNumber,
    hfType,               // ← NEW
    hfAdditionalDetails,  // ← NEW
  });

  console.log("[ZohoAPI] createPatientRecord formData:", JSON.stringify(formData, null, 2));

  try {
    const r = await ZOHO.CREATOR.API.addRecord({
      formName: FORMS.ADD_PATIENT,
      data:     { data: formData },
    });

    console.log("[ZohoAPI] createPatientRecord raw response:", JSON.stringify(r));

    if (r?.code === 3002) {
      console.error("[ZohoAPI] createPatientRecord validation errors:", JSON.stringify(r.error));
      return { success: false, recordId: null, error: r.error };
    }

    const ok    = r?.code === 3000;
    const newId = r?.data?.ID ?? r?.result?.ID ?? null;

    return { success: ok, recordId: newId };
  } catch (err) {
    console.error("[ZohoAPI] createPatientRecord error:", err);
    return { success: false, recordId: null, error: String(err) };
  }
}

export async function updatePatientRecord({ id, ...patientData }) {
  await initZoho();
  if (!id) {
    console.error("[ZohoAPI] updatePatientRecord missing id");
    return { success: false, recordId: null, error: "Missing id" };
  }

  const formData = buildPatientFormData(patientData);

  try {
    const r = await ZOHO.CREATOR.API.updateRecord({
      reportName: REPORTS.PATIENTS,
      id:         String(id),
      data:       { data: formData },
    });

    console.log("[ZohoAPI] updatePatientRecord raw response:", JSON.stringify(r));

    if (r?.code === 3000) {
      console.log(`[ZohoAPI] updatePatientRecord success — ID: ${id}`);
      return { success: true, recordId: id };
    }

    console.error(`[ZohoAPI] updatePatientRecord failed (code ${r?.code}):`, r);
    return { success: false, recordId: id, error: r?.message || "Update failed" };
  } catch (err) {
    console.error("[ZohoAPI] updatePatientRecord error:", err);
    return { success: false, recordId: id, error: String(err) };
  }
}

export async function createClaimRecord({
  doctorId,
  hospitalId,
  patientId,
  claimType,
  dateOfService,
  claimDate,
  assistantSurgeons,
  primarySurgeon,
  primarySurgeonItemNumbers,
  totalClaimAmount,
  claimLines = [],
  staffId,
  enableGap,
  gapAmount,
  payerId,
  healthFundId,
  referringDoctorId,
  providerNumber,
  notes,   // ← NEW
}) {
  await initZoho();

  const claimLineRows = claimLines.map((ln, idx) => ({
    [ADD_CLAIM_LINE_F.item]:             String(ln.itemId || ""),
    [ADD_CLAIM_F.claimDate]:         String(claimDate || formatClaimDate(new Date())),
    [ADD_CLAIM_LINE_F.amountCharged]:    Number(ln.amountCharged || ln.amount || 0),
    [ADD_CLAIM_LINE_F.description]:      String(ln.description  || ""),
    [ADD_CLAIM_LINE_F.primarySurgeon]:   String(ln.primarySurgeonId || ""),
    [ADD_CLAIM_LINE_F.dateOfService]:    String(ln.dateOfService || ""),
    [ADD_CLAIM_LINE_F.status]:           "Pending",
    [ADD_CLAIM_LINE_F.balanceDue]:       Number(ln.amountCharged || ln.amount || 0),
    [ADD_CLAIM_LINE_F.allocatedAmount]:  0,
  }));

  const round2 = (val) => Number(Number(val || 0).toFixed(4));

  const formData = {
    [ADD_CLAIM_F.doctor]:            String(doctorId           || ""),
    [ADD_CLAIM_F.hospital]:          String(hospitalId         || ""),
    [ADD_CLAIM_F.patient]:           String(patientId          || ""),
    [ADD_CLAIM_F.status]:            "Draft",
    [ADD_CLAIM_F.claimDate]:         String(claimDate || formatClaimDate(new Date())),
    [ADD_CLAIM_F.assistantSurgeons]: String(assistantSurgeons  || "No"),
    [ADD_CLAIM_F.totalClaimAmount]:  round2(totalClaimAmount   || 0),
    [ADD_CLAIM_F.claimLines]:        claimLineRows,
    [ADD_CLAIM_F.enableGap]:         enableGap ? "true" : "false",
    [ADD_CLAIM_F.gap]:               round2(gapAmount          || 0),
  };
  // NOTE: Claim_ID is intentionally NOT set here — it's derived after
  // creation from Zoho's own Auto_Number field (see below).

// Primary_Surgeon1 is a real Zoho lookup field pointing at the
// Assistant_Surgeons form — it needs the linked record's ID, not
// its name or item number. Zoho resolves and displays the "Name"
// field of the linked record automatically once the ID is stored.
if (primarySurgeon)            formData[ADD_CLAIM_F.primarySurgeon1]          = String(primarySurgeon);
if (primarySurgeonItemNumbers) formData[ADD_CLAIM_F.primarySurgeonItemNumber] = String(primarySurgeonItemNumbers);
  if (payerId) formData[ADD_CLAIM_F.payer] = String(payerId);

  if (healthFundId) {
    formData[ADD_CLAIM_F.healthFund] = String(healthFundId);
  }
  if (referringDoctorId) {
    formData[ADD_CLAIM_F.referringDoctor] = String(referringDoctorId);
  }
  if (providerNumber) {
    formData[ADD_CLAIM_F.providerNumber] = String(providerNumber);
  }

  if (staffId) {
    formData[ADD_CLAIM_F.staff] = String(staffId);
  }

  if (claimType) formData[ADD_CLAIM_F.claimType] = String(claimType);

  if (notes) formData[ADD_CLAIM_F.comments] = String(notes);   // ← NEW

  console.log("[ZohoAPI] createClaimRecord formData:", JSON.stringify(formData, null, 2));

  try {
    const r = await ZOHO.CREATOR.API.addRecord({
      formName: FORMS.ADD_CLAIM,
      data:     { data: formData },
    });
    console.log("[ZohoAPI] createClaimRecord RAW response:", JSON.stringify(r));

if (r?.code === 3002) {
  console.error("[ZohoAPI] createClaimRecord validation errors:", JSON.stringify(r.error));
  return { success: false, recordId: null };
}
    if (r?.code === 3001) {
      console.error("[ZohoAPI] createClaimRecord workflow error:", JSON.stringify(r.error));
      return { success: false, recordId: null };
    }

    const ok    = r?.code === 3000;
    const newId = r?.data?.ID ?? r?.result?.ID ?? null;

    if (!ok || !newId) {
      return { success: false, recordId: null };
    }

    // ── Read back the Auto_Number Zoho just assigned, then build & write Claim_ID = CLM_<n> ──
    let confirmedClaimId = String(newId); // fallback if everything below fails
    try {
      const check = await ZOHO.CREATOR.API.getRecordById({
        reportName: REPORTS.CLAIMS,
        id: String(newId),
      });

      if (check?.code === 3000 && check?.data) {
        const autoNumRaw = check.data[ADD_CLAIM_F.autoNumber];
        const autoNum = typeof autoNumRaw === "object"
          ? (autoNumRaw.value ?? autoNumRaw.display_value ?? "")
          : autoNumRaw;

        console.log("[ZohoAPI] createClaimRecord — Auto_Number read back:", autoNum);

        if (autoNum !== undefined && autoNum !== null && String(autoNum).trim() !== "") {
          const generatedClaimId = `CLM_${String(autoNum).trim()}`;

          const forced = await ZOHO.CREATOR.API.updateRecord({
            reportName: REPORTS.CLAIMS,
            id: String(newId),
            data: { data: { [ADD_CLAIM_F.claimId]: generatedClaimId } },
          });
          console.log("[ZohoAPI] createClaimRecord — write Claim_ID response:", JSON.stringify(forced));

          if (forced?.code === 3000) {
            confirmedClaimId = generatedClaimId;
          } else {
            console.warn(
              `[ZohoAPI] createClaimRecord: could not write "${generatedClaimId}" into ` +
              `"${ADD_CLAIM_F.claimId}" (code ${forced?.code}: ${forced?.message}). ` +
              `Falling back to record ID "${newId}".`
            );
          }
        } else {
          console.warn(
            `[ZohoAPI] createClaimRecord: "${ADD_CLAIM_F.autoNumber}" was empty on readback — ` +
            `check the field's exact API name in Zoho Creator (Auto Number field type).`
          );
        }
      }
    } catch (verifyErr) {
      console.warn("[ZohoAPI] createClaimRecord Auto_Number readback/write step failed:", verifyErr);
    }

    invalidateClaimLinesCache();   // ← ADD THIS
    return { success: true, recordId: newId, claimNo: confirmedClaimId };
  } catch (err) {
    console.error("[ZohoAPI] createClaimRecord error:", err);
    return { success: false, recordId: null };
  }
}
export async function createPaymentRecord({
  doctorId,
  hospitalId,
  paymentMethod,
  paymentDate,
  payerName,
  patientName,
  totalAmount,
  lineItems = [],
  claimDetails = [],
}) {
  await initZoho();

  const today  = new Date();
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const finalPaymentDate = paymentDate ||
    `${String(today.getDate()).padStart(2,"0")}-${months[today.getMonth()]}-${today.getFullYear()}`;

  // ── FIX: Zoho currency fields reject values with too many decimal
  // digits. Plain JS arithmetic (e.g. 113.9 - 0 + 0.00000001 drift) can
  // produce values like 343.09999999999997, which Zoho rejects with
  // code 3001 "Amount has exceeded its maximum digits." Round EVERY
  // monetary value to exactly 2 decimals right before it goes into
  // formData or a subform row.
  const round2 = (v) => Number((Math.round((Number(v) || 0) * 100) / 100).toFixed(2));

  // One subform row per LINE ITEM (not per claim)
  const paymentItemRows = [];
  for (const cd of claimDetails) {
    const prevPaidAmt = round2(cd.currentAllocatedAmount || 0);
    const lineItems   = cd.itemCodes || [];

    // Resolve patientId — use whatever is available, never leave it blank
    const resolvedPatId = String(cd.patientId || "").trim();

    if (lineItems.length === 0) {
      // Fallback: no line data — create one row for the whole claim
      const allocAmt  = round2(cd.allocateAmount || 0);
      const balBefore = round2(cd.currentBalanceDue || 0);
      const newBal    = round2(Math.max(0, balBefore - allocAmt));
      const claimAmt  = round2(cd.claimTotalAmount || balBefore); // ← FIX: was unrounded
      const newPaidAmt = round2(prevPaidAmt + allocAmt);
      const claimAdjAmt = (() => {
        const lines = cd.itemCodes || [];
        let total = 0;
        for (let i = 0; i < lines.length; i++) {
          const key = `${cd.displayId || cd.claimRecordId}__${i}`;
          total += Number(cd.lineAdjustments?.[key] || 0);
        }
        return round2(total);
      })();

      const row = {
        [PAYMENT_SUBFORM_F.claimId]:        String(cd.claimRecordId || ""),
        [PAYMENT_SUBFORM_F.amount]:          claimAmt,
        [PAYMENT_SUBFORM_F.allocatedAmount]: allocAmt,
        [PAYMENT_SUBFORM_F.balanceDue]:      newBal,
        [PAYMENT_SUBFORM_F.payerName]:       String(payerName || ""),
        [PAYMENT_SUBFORM_F.itemCode]:        "",
        [PAYMENT_SUBFORM_F.paidAmount]:      newPaidAmt,
      };
      if (claimAdjAmt > 0) {
        row["Adjustment_Amount"] = claimAdjAmt;
      }
      if (resolvedPatId) {
        row[PAYMENT_SUBFORM_F.patient] = resolvedPatId;
      }
      paymentItemRows.push(row);
      continue;
    }

    // One row per line item
    for (let i = 0; i < lineItems.length; i++) {
      const lineKeyByDisplay  = `${cd.displayId}__${i}`;
      const lineKeyByRecordId = `${cd.claimRecordId}__${i}`;
      const lineAllocAmt = round2(
        cd.lineAllocates?.[lineKeyByDisplay] ||
        cd.lineAllocates?.[lineKeyByRecordId] ||
        0
      );
      const lineAdjKey = lineKeyByDisplay;   // adjustments also keyed by displayId
      const lineAdjAmt = round2(cd.lineAdjustments?.[lineAdjKey] || 0);
      if (lineAllocAmt <= 0 && lineAdjAmt <= 0) continue;

      const lineData     = lineItems[i] || {};
      const lineItemNo   = lineData.itemNumber  || "";
      const lineItemId   = lineData.itemId      || "";
      const lineAmt      = round2(lineData.lineAmount || 0);   // ← FIX: was unrounded
      const linePrevBal  = round2(lineData.lineBalanceDue !== undefined ? lineData.lineBalanceDue : lineAmt);
      const linePrevPaid = round2(lineData.linePaidAmount || 0);   // previously paid on this line

      const newLinePaid  = round2(linePrevPaid + lineAllocAmt);
      const newLineBal   = round2(Math.max(0, linePrevBal - lineAllocAmt - lineAdjAmt));

      const row = {
        [PAYMENT_SUBFORM_F.claimId]:        String(cd.claimRecordId || ""),
        [PAYMENT_SUBFORM_F.amount]:          lineAmt,
        [PAYMENT_SUBFORM_F.allocatedAmount]: lineAllocAmt,
        [PAYMENT_SUBFORM_F.balanceDue]:      newLineBal,
        [PAYMENT_SUBFORM_F.payerName]:       String(payerName || ""),
        [PAYMENT_SUBFORM_F.itemCode]:        lineItemNo,
        [PAYMENT_SUBFORM_F.item]:            lineItemId ? String(lineItemId) : "",
        [PAYMENT_SUBFORM_F.paidAmount]:      newLinePaid,
      };
      if (lineAdjAmt > 0) {
        row["Adjustment_Amount"] = lineAdjAmt;
      }
      const linePatId = String(cd.patientId || "").trim();
      if (linePatId) {
        row[PAYMENT_SUBFORM_F.patient] = linePatId;
      }
      paymentItemRows.push(row);
    }

    // Gap-only payment row:
    //  - Amount        = the TOTAL configured Gap Amount on the claim (e.g. 300), not the portion paid now
    //  - Allocated_Amt  = the exact "Pay Gap" amount entered in this transaction
    //  - Balance_Due    = Gap total − (gap already paid before + gap paid now)  → remaining gap
    //  - Paid_Amount    = cumulative gap paid so far (before + now)
    const gapPortion = round2(cd.gapAllocateAmount || 0);
    if (gapPortion > 0) {
      const gapTotal      = round2(cd.gapTotalAmount || 0); // ← FIX: was unrounded
      const gapPaidBefore = round2(cd.currentGapPaidAmount || 0);
      const newGapPaid    = round2(gapPaidBefore + gapPortion);
      const gapBalDue     = round2(Math.max(0, gapTotal - newGapPaid));
      const gapRow = {
        [PAYMENT_SUBFORM_F.claimId]:        String(cd.claimRecordId || ""),
        [PAYMENT_SUBFORM_F.amount]:          gapTotal,
        [PAYMENT_SUBFORM_F.allocatedAmount]: gapPortion,
        [PAYMENT_SUBFORM_F.balanceDue]:      gapBalDue,
        [PAYMENT_SUBFORM_F.payerName]:       String(payerName || ""),
        [PAYMENT_SUBFORM_F.itemCode]:        "GAP",
        [PAYMENT_SUBFORM_F.paidAmount]:      newGapPaid,
      };
      if (resolvedPatId) gapRow[PAYMENT_SUBFORM_F.patient] = resolvedPatId;
      paymentItemRows.push(gapRow);
    }
  }

  const firstPatientId = claimDetails[0]?.patientId || "";
  const numPatient     = Number(firstPatientId);
  const patientVal     = (!isNaN(numPatient) && firstPatientId !== "") ? numPatient : null;

  const toLookupId = id => {
    if (!id && id !== 0) return null;
    const n = Number(id);
    return !isNaN(n) ? n : null;
  };

  const hospitalVal = toLookupId(hospitalId);
  const doctorVal   = toLookupId(doctorId);

  console.log(`[ZohoAPI] Raw doctorId received: "${doctorId}" type=${typeof doctorId}`);
  console.log(`[ZohoAPI] Raw hospitalId received: "${hospitalId}" type=${typeof hospitalId}`);
  console.log(`[ZohoAPI] Raw patientId received: "${firstPatientId}" type=${typeof firstPatientId}`);

  // Compute total adjustment across all claim details
  const totalAdjustmentAmount = round2(
    claimDetails.reduce((sum, cd) => {
      const lineItems = cd.itemCodes || [];
      let claimAdj = 0;
      for (let i = 0; i < lineItems.length; i++) {
        const lineKey = `${cd.displayId || cd.claimRecordId}__${i}`;
        claimAdj += Number(cd.lineAdjustments?.[lineKey] || 0);
      }
      return sum + claimAdj;
    }, 0)
  );

  const formData = {
    [PAYMENT_F.paymentMethod]: String(paymentMethod || ""),
    [PAYMENT_F.paymentDate]:   finalPaymentDate,
    [PAYMENT_F.amount]:        round2(totalAmount || 0),   // ← FIX: was Number(totalAmount || 0)
    [PAYMENT_F.payerName]:     String(payerName     || ""),
  };

  if (totalAdjustmentAmount > 0) {
    formData["Adjustment_Amount"] = totalAdjustmentAmount;
  }

  // Only add doctor/hospital lookups if we have valid numeric IDs
  if (hospitalId) formData[PAYMENT_F.hospital] = String(hospitalId);
  if (doctorId)   formData[PAYMENT_F.doctor]   = String(doctorId);

  // Patient intentionally NOT sent on the main Add_Payment form — only in subform rows

  if (paymentItemRows.length > 0) {
    formData[PAYMENT_F.paymentItems] = paymentItemRows;
  }

  console.log("[ZohoAPI] createPaymentRecord FINAL formData:", JSON.stringify(formData, null, 2));

  try {
    const r = await ZOHO.CREATOR.API.addRecord({
      formName: FORMS.ADD_PAYMENT,
      data:     { data: formData },
    });

    console.log("[ZohoAPI] createPaymentRecord response:", JSON.stringify(r));

    if (r?.code === 3002 || r?.code === 3001) {
      console.error("[ZohoAPI] Validation errors:", JSON.stringify(r.error || r));
      return { success: false, recordId: null };
    }

    const ok    = r?.code === 3000;
    const newId = r?.data?.ID ?? r?.result?.ID ?? null;

    return { success: ok, recordId: newId };
  } catch (err) {
    console.error("[ZohoAPI] createPaymentRecord threw:", err);
    return { success: false, recordId: null };
  }
}

export async function fetchLoginUser() {
  try {
    await initZoho();
    const p = await ZOHO.CREATOR.UTIL.getInitParams();
    console.log("[ZohoAPI] fetchLoginUser getInitParams full response:", JSON.stringify(p));
    return {
      name:  p.loginUser  ?? p.loginuser  ?? p.login_user  ?? "",
      email: p.loginUser  ?? p.loginuser  ?? p.login_user  ?? "",
    };
  } catch (err) {
    console.warn("[ZohoAPI] fetchLoginUser error:", err);
    return { name: "", email: "" };
  }
}
export async function loadStaffByLoginUser() {
  try {
    await initZoho();

    // Step 1: get loginUser from getInitParams (key is "loginUser")
    const p = await ZOHO.CREATOR.UTIL.getInitParams();
    console.log("[ZohoAPI] loadStaffByLoginUser getInitParams:", JSON.stringify(p));

    const loginUser = String(p.loginUser ?? p.loginuser ?? p.login_user ?? "").trim().toLowerCase();
    if (!loginUser) {
      console.warn("[ZohoAPI] loadStaffByLoginUser: no loginUser found in getInitParams");
      return null;
    }
    console.log("[ZohoAPI] loadStaffByLoginUser: loginUser =", loginUser);

    // Step 2: fetch All_Staffs report
    const allStaffs = await fetchAllRecords(ALL_STAFFS_REPORT);
    if (allStaffs.length > 0) {
      console.log("[ZohoAPI] All_Staffs sample keys:", Object.keys(allStaffs[0]));
      console.log("[ZohoAPI] All_Staffs first record:", JSON.stringify(allStaffs[0]));
    } else {
      console.warn("[ZohoAPI] All_Staffs: 0 records returned");
      return null;
    }

    // Step 3: match Email field against loginUser
    const matched = allStaffs.find(r => {
      const emailVal = String(r[STAFF_EMAIL_F] ?? r["email"] ?? r["Email"] ?? "").trim().toLowerCase();
      console.log("[ZohoAPI] Comparing staff email:", emailVal, "vs loginUser:", loginUser);
      return emailVal === loginUser;
    });

    if (!matched) {
      console.warn("[ZohoAPI] loadStaffByLoginUser: no staff record matched loginUser:", loginUser);
      return null;
    }

    console.log("[ZohoAPI] loadStaffByLoginUser: matched record:", JSON.stringify(matched));

    // Step 4: extract Name1 — handles object {first_name, last_name} or plain string
    const rawName = matched[STAFF_NAME1_F] ?? matched["Name1"] ?? matched["name1"] ?? "";
    let firstName = "", lastName = "";
    if (rawName && typeof rawName === "object") {
      firstName = String(rawName.first_name ?? rawName.First_Name ?? rawName.firstname ?? "");
      lastName  = String(rawName.last_name  ?? rawName.Last_Name  ?? rawName.lastname  ?? "");
    } else {
      const parts = String(rawName).trim().split(/\s+/);
      firstName = parts[0] ?? "";
      lastName  = parts.slice(1).join(" ");
    }

    const recordId = String(matched["ID"] ?? matched["id"] ?? "");
    console.log("[ZohoAPI] loadStaffByLoginUser raw ID from record:", matched["ID"], "| typeof:", typeof matched["ID"]);
    const fullName = `${firstName} ${lastName}`.trim();

    console.log(`[ZohoAPI] loadStaffByLoginUser SUCCESS — id=${recordId} name="${fullName}"`);
    return { id: recordId, firstName, lastName, name: fullName };

  } catch (err) {
    console.error("[ZohoAPI] loadStaffByLoginUser error:", err);
    return null;
  }
} 
/* ══════════════════════════════════════════════════════════════════
   LOAD HEALTH FUNDS (Payer)
══════════════════════════════════════════════════════════════════ */
export async function loadHealthFunds() {
  try {
    await initZoho();
    const raw = await fetchAllRecords(REPORTS.HEALTH_FUNDS);
    if (raw.length > 0) {
      console.log("[ZohoAPI] RAW HealthFund keys:", Object.keys(raw[0]));
      console.log("[ZohoAPI] RAW HealthFund first 3 records:", JSON.stringify(raw.slice(0,3)));
    }
    return raw.map(r => {
      const id   = String(r.ID ?? r.id ?? "");
      const name = String(
        r.Health_Fund_Name ??
        r.Fund_Name        ??
        r.Name             ??
        r.name             ??
        r.Health_Fund      ??
        ""
      );
      console.log("[ZohoAPI] HealthFund record — ID:", id, "| name:", name, "| all keys:", JSON.stringify(r));
      return { id, name };
    }).filter(h => h.name && h.id);
  } catch (err) {
    console.error("[ZohoAPI] loadHealthFunds:", err);
    return [];
  }
}
/* ══════════════════════════════════════════════════════════════════
   LOAD ITEMS (for the "Item" lookup field in Claim_Lines)
══════════════════════════════════════════════════════════════════ */
export async function loadItems() {
  try {
    await initZoho();
    const raw = await fetchAllRecords(REPORTS.ITEMS);
    if (raw.length > 0) {
      console.log("[ZohoAPI] RAW Item keys:", Object.keys(raw[0]));
    }
    return raw.map(r => {
      const id = String(r.ID ?? r.id ?? "");
      const name = String(
        r.Item ??
        r.Item_Number ??
        r.Item_Name   ??
        r.Name         ??
        r.name         ??
        ""
      );
      const description = String(r.Description ?? r.description ?? "");
      return { id, name, description };
    }).filter(i => i.id && i.name);
  } catch (err) {
    console.error("[ZohoAPI] loadItems:", err);
    return [];
  }
}
/* ══════════════════════════════════════════════════════════════════
   SEARCH ITEMS — server-side search for the Item lookup dropdown.
   loadItems() pulls the WHOLE Items report via fetchAllRecords(),
   paginating 200 at a time — with 14k+ records that's ~70 round
   trips before the dropdown is even usable.

   searchItems() instead asks Zoho to filter and return only matches
   for what's typed, in a single request capped at `limit` rows.
══════════════════════════════════════════════════════════════════ */
export async function searchItems(query, limit = 50) {
  try {
    await initZoho();
    const q = String(query || "").trim();
    if (!q) return [];

    const esc = q.replace(/"/g, '\\"');

    const wideCriteria =
      `(Item.contains("${esc}")) || (Item_Number.contains("${esc}")) || ` +
      `(Item_Name.contains("${esc}")) || (Name.contains("${esc}"))`;

    let res;
    try {
      res = await ZOHO.CREATOR.API.getAllRecords({
        reportName: REPORTS.ITEMS,
        page: 1,
        pageSize: limit,
        criteria: wideCriteria,
      });
    } catch (httpErr) {
      console.warn("[ZohoAPI] searchItems wide criteria failed, retrying narrow:", httpErr);
      res = await ZOHO.CREATOR.API.getAllRecords({
        reportName: REPORTS.ITEMS,
        page: 1,
        pageSize: limit,
        criteria: `Item.contains("${esc}")`,
      });
    }

    if (!res || res.code === 3100) return [];
    if (res.code !== 3000) {
      console.warn(`[ZohoAPI] searchItems failed (code ${res.code}): ${res.message}`);
      return [];
    }

    const rows = res.data ?? [];
    const items = rows
      .map(r => {
        const id = String(r.ID ?? r.id ?? "");
        const name = String(
          r.Item ?? r.Item_Number ?? r.Item_Name ?? r.Name ?? r.name ?? ""
        );
        const description = String(
          r.Description ?? r.description ?? ""
        );
        return { id, name, description };
      })
      .filter(i => i.id && i.name);

    return rankItemsByRelevance(items, q);
  } catch (err) {
    console.error("[ZohoAPI] searchItems:", err);
    return [];
  }
}

/* ══════════════════════════════════════════════════════════════════
   RANK ITEMS BY RELEVANCE — sorts search results so the closest
   match to what the user typed appears first, instead of whatever
   order Zoho's "contains" criteria happens to return.

   Priority (lower score = higher up the list):
     0 — item number is an EXACT match (e.g. typed "88417", name is "88417")
     1 — item number STARTS WITH the query (e.g. typed "884", name is "88417...")
     2 — query matches the start of a WORD within the item number/name
     3 — item number contains the query anywhere else
     4 — only the description contains the query (weakest match)
   Ties within the same priority are broken alphabetically by name.
══════════════════════════════════════════════════════════════════ */
function rankItemsByRelevance(items, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return items;

  const scored = items.map(item => {
    const name = String(item.name || "").toLowerCase();
    const desc = String(item.description || "").toLowerCase();

    let score = 5; // fallback — shouldn't normally hit this since items were filtered by "contains"

    if (name === q) {
      score = 0;
    } else if (name.startsWith(q)) {
      score = 1;
    } else if (new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(name)) {
      score = 2;
    } else if (name.includes(q)) {
      score = 3;
    } else if (desc.includes(q)) {
      score = 4;
    }

    return { item, score };
  });

  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return String(a.item.name).localeCompare(String(b.item.name));
  });

  return scored.map(s => s.item);
}
export async function loadPatientPayerLookup(patientId) {
  try {
    await initZoho();
    if (!patientId) return null;
    const all = await fetchAllRecords(REPORTS.PATIENTS);
    const rec = all.find(r => String(r.ID ?? r.id ?? "").trim() === String(patientId).trim());
    if (!rec) return null;

    const rawPayer = rec["Payer"] ?? rec["payer"] ?? null;
    if (!rawPayer) return null;

    if (typeof rawPayer === "object") {
      const id   = String(rawPayer.ID ?? rawPayer.id ?? "").trim();
      const name = String(rawPayer.display_value ?? rawPayer.Display_Value ?? rawPayer.name ?? "").trim();
      return id ? { id, name: name || id } : null;
    }
    const s = String(rawPayer).trim();
    return s ? { id: s, name: s } : null;
  } catch (err) {
    console.error("[ZohoAPI] loadPatientPayerLookup:", err);
    return null;
  }
}

export async function loadPatientPayers(patientId) {
  try {
    await initZoho();
    if (!patientId) return [];

    // Fetch ALL patients and find by ID — avoids criteria issues with multi-select fields
    const all = await fetchAllRecords(REPORTS.PATIENTS);
    const rec = all.find(r => String(r.ID ?? r.id ?? "").trim() === String(patientId).trim());
    if (!rec) {
      console.warn("[ZohoAPI] loadPatientPayers: patient not found for id:", patientId);
      return [];
    }

    console.log("[ZohoAPI] loadPatientPayers patient record keys:", Object.keys(rec));
    console.log("[ZohoAPI] loadPatientPayers Health_Fund_Work_cover_Name raw:", JSON.stringify(rec["Health_Fund_Work_cover_Name"] ?? rec["Health_Fund_Work_Cover_Name"] ?? null));

    // Try both capitalisation variants
    const rawField =
      rec["Health_Fund_Work_cover_Name"] ??
      rec["Health_Fund_Work_Cover_Name"] ??
      rec["Health_fund_Work_Cover_Name"] ??
      null;

    if (!rawField) {
      console.warn("[ZohoAPI] loadPatientPayers: Health_Fund_Work_cover_Name field is empty or missing");
      return [];
    }

    // Multi-select lookup: Zoho returns array of {ID, display_value} objects
    const items = Array.isArray(rawField) ? rawField : [rawField];
    const result = items
      .map(item => {
        if (!item) return null;
        if (typeof item === "object") {
          const id   = String(item.ID ?? item.id ?? "").trim();
          const name = String(item.display_value ?? item.Display_Value ?? item.name ?? item.Health_Fund_Name ?? "").trim();
          return id || name ? { id, name: name || id } : null;
        }
        const s = String(item).trim();
        return s ? { id: s, name: s } : null;
      })
      .filter(Boolean)
      .filter(p => p.name);

    console.log("[ZohoAPI] loadPatientPayers resolved payers:", JSON.stringify(result));
    return result;
  } catch (err) {
    console.error("[ZohoAPI] loadPatientPayers:", err);
    return [];
  }
}