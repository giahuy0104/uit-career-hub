import { describe, expect, it } from "vitest";

import { studentDocumentUploadSchema } from "./application.schemas.js";

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
