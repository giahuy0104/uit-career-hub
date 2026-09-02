# Artifact contract: UIT Career Hub detailed proposal

## Reference

- Retained DOCX: `C:\Users\Windows\Downloads\23520286_23520434_Detailed_Project_Proposal_DA2.docx`
- SHA-256: `86E3E201AEAC9E7B5505368A2F5AB9A975E7A18F32FE2BF2A26075E580D679BF`
- Source size: 86,461 bytes.
- Rendered page count: 23 pages (Microsoft Word 16 `ExportAsFixedFormat`).
- Section count: 1.
- Reference render: `C:\Users\Windows\Documents\UIT\ĐỒ ÁN TỐT NGHIỆP\uit-career-hub\.codex\proposal-doc\template-reference-render`.
- Style evidence: `C:\Users\Windows\Documents\UIT\ĐỒ ÁN TỐT NGHIỆP\uit-career-hub\.codex\proposal-doc\template-style-evidence.json`.

## Page system

- Letter portrait, 8.5 x 11 inches.
- Margins: 1 inch on all sides.
- Header distance: 0.5 inch; footer distance: 0.5 inch.
- One section, no different-first-page or odd/even header behavior.
- Footer is independent and contains one centered `PAGE` field.
- Source uses a two-column institutional heading table, a centered `ĐỀ CƯƠNG CHI TIẾT` title, and a large bordered proposal table that flows across pages.

## Typography

- Typeface: Times New Roman throughout; body size 13 pt.
- Institutional heading: 13 pt, centered, 1.5 line spacing; school and national heading emphasized in bold.
- Main document title: centered, bold, source `Heading 2` pattern.
- Proposal metadata: 13 pt, 6 pt before/after on title and identity rows.
- Body: 13 pt, justified, approximately 1.5 line spacing, 0.5 pt before/after.
- Main section heading role: bold 13 pt, real Word heading style, compact spacing and keep-with-next.
- Subsection role: bold 13 pt, real Word heading style or source-derived bold paragraph pattern.
- Figure captions: centered, italic 11 pt, keep-with-next/keep-with-previous as appropriate.
- Explicit user deviation: all text and diagrams are black/white; the source's red emphasis is removed.

## Lists and tables

- Source contains `word/numbering.xml` (60,255 bytes) and uses Word numbering definitions.
- New bullets and numbered steps must use real Word list styles/numbering; no Unicode bullet or hyphen-prefixed fake lists.
- Top institutional table: 1 row x 2 columns, grid widths 5104/5670 DXA, fixed layout, no visible borders.
- Main proposal table: 9 rows x 3 columns, grid widths 3235/3330/3420 DXA; rows 0-5 are horizontally merged across all three columns, row 6 is a two-area signature block, and rows 7-8 provide signature space.
- The source plan is a nested 8 x 4 table with grid widths 1765/1620/3780/2610 DXA. It is preserved and rewritten in place with a repeated header row, no fixed row heights, and centered short-value columns.
- Cell padding and border system stay source-derived. Descriptive table cells remain left-aligned; short labels/dates are centered.

## Components and content flow

1. Institutional two-column heading.
2. Centered `ĐỀ CƯƠNG CHI TIẾT`.
3. Vietnamese and English project names.
4. Advisor, implementation period, and student identity rows.
5. `Nội dung đề tài` long-form section with sections 1-7.
6. Black/white figures inside the long-form section: system context/architecture, BPMN-style end-to-end workflow, job/application state models, and high-level data model.
7. `Kế hoạch thực hiện` with workstream note and 7-phase schedule table.
8. `Hướng phát triển đề tài`.
9. Advisor/student signature block.
10. Centered page numbers in the existing footer.

## Slot map

- `word/document.xml / body / tbl[1]`: preserve institutional heading text and formatting; no content edit required.
- `word/document.xml / body / p[Heading 2]`: preserve `ĐỀ CƯƠNG CHI TIẾT`.
- `word/document.xml / body / tbl[2]/tr[1]/tc[1]`: rewrite Vietnamese and English names.
- `.../tbl[2]/tr[2]/tc[1]`: preserve advisor from the supplied reference.
- `.../tbl[2]/tr[3]/tc[1]`: preserve implementation period from the supplied reference.
- `.../tbl[2]/tr[4]/tc[1]`: preserve the supplied student names and IDs.
- `.../tbl[2]/tr[5]/tc[1]`: completely rewrite the example BrainBattle content with UIT Career Hub content; add figures here.
- `.../tbl[2]/tr[6]/tc[1]`: rewrite workstream labels, fill the existing nested plan table, and rewrite future directions.
- `.../tbl[2]/tr[7..9]`: preserve the source signature pattern and blank signing capacity.
- `word/footer1.xml`: preserve page-number field and positioning.

## Text coverage

- Reference text exists primarily inside table cells rather than `Document.paragraphs`.
- Audited: body paragraphs, both top-level tables, the nested schedule table, footer field, styles, numbering, relationships, and all package parts.
- No inline/anchored drawings, footnotes, or endnotes in the reference.
- One content control exists in `word/footer1.xml` and carries the PAGE display text; preserve it.

## Stable package preservation

- Preserve unchanged: `[Content_Types].xml`, package relationships, document properties, `word/styles.xml` (SHA-256 `4bb54ab094e0646ae1ae31803b0fa932f7731259551c54a82681cde031a7412b`), `word/numbering.xml` (SHA-256 `9c4f08d9a2d8da8e305e4dd158e9fb00069e540d375f59e085b87b7cf965c890`), `word/theme/theme1.xml`, and footer page-number structure.
- Editable by design: `word/document.xml`, document relationships, and new `word/media/*` parts required by the inserted figures.
- New image relationships are permitted; no source relationship may disappear without explanation.

## Fidelity and quality gates

- Retained source must still match the recorded SHA-256 before and after authoring.
- Output must remain one Letter portrait section with 1-inch margins.
- Institutional heading, title, border system, footer/page number, and signature block must remain recognizably source-derived.
- No BrainBattle, Ontology/RAG/LLM, battle, token, blockchain, Flutter, or smart-contract example content may remain.
- Document content must reflect the current UIT Career Hub repository: React/Vite frontend, Java 21/Spring Boot backend, PostgreSQL/Neon, private Cloudflare R2, three roles, state-driven recruitment/placement workflows, reporting, audit, notifications, and tests.
- All pages must be exported through Microsoft Word and inspected at 100%; no clipping, overlap, broken tables, missing Vietnamese glyphs, or unexplained pagination.
- Final package audit must preserve the source page setup and footer field, with new media as the only intended relationship expansion.
