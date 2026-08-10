import { describe, expect, it } from "vitest";

import { offerDocumentUploadSchema, recruitmentResultSchema, studentDocumentUploadSchema } from "./application.schemas.js";

describe("studentDocumentUploadSchema", () => {
  const validUpload = {
    documentType: "CV",
    fileName: "cv-thuc-tap.PDF",
    mimeType: "application/pdf",
    fileSizeBytes: 10 * 1024 * 1024,
  };

  it("accepts a PDF up to 10 MB", () => {
    expect(studentDocumentUploadSchema.safeParse(validUpload).success).toBe(true);
  });

  it.each([
    [{ ...validUpload, fileName: "../cv.pdf" }, "unsafe path"],
    [{ ...validUpload, fileName: "cv.docx" }, "non-PDF extension"],
    [{ ...validUpload, mimeType: "text/plain" }, "non-PDF MIME"],
    [{ ...validUpload, fileSizeBytes: 10 * 1024 * 1024 + 1 }, "oversized file"],
  ])("rejects %s (%s)", (input) => {
    expect(studentDocumentUploadSchema.safeParse(input).success).toBe(false);
  });
});

describe("offer document schemas", () => {
  const validUpload = {
    fileName: "offer-thuc-tap.pdf",
    mimeType: "application/pdf",
    fileSizeBytes: 4096,
  };

  it("accepts safe PDF metadata and a completed upload id in a PASS result", () => {
    expect(offerDocumentUploadSchema.safeParse(validUpload).success).toBe(true);
    expect(recruitmentResultSchema.safeParse({
      outcome: "PASS",
      startDate: "2099-12-28",
      offerUploadId: "15c0d02c-5803-40ef-83c5-7c9e4585322d",
    }).success).toBe(true);
  });

  it.each([
    { ...validUpload, fileName: "../offer.pdf" },
    { ...validUpload, fileName: "offer.docx" },
    { ...validUpload, mimeType: "text/plain" },
    { ...validUpload, fileSizeBytes: 10 * 1024 * 1024 + 1 },
  ])("rejects invalid offer upload metadata", (input) => {
    expect(offerDocumentUploadSchema.safeParse(input).success).toBe(false);
  });

  it("rejects a raw internal storage key in a PASS result", () => {
    expect(recruitmentResultSchema.safeParse({
      outcome: "PASS",
      startDate: "2099-12-28",
      offerStorageKey: "offers/internal-key.pdf",
    }).success).toBe(false);
  });
});
