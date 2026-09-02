import { instance } from "file:///C:/Users/Windows/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@viz-js/viz/dist/viz.js";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const outDir = path.resolve(".codex/proposal-doc/diagrams");
await mkdir(outDir, { recursive: true });

const viz = await instance();

const common = String.raw`
  graph [bgcolor="white", pad="0.18", nodesep="0.35", ranksep="0.55", fontname="Arial", fontsize=15, color="#333333"];
  node [shape=box, style="rounded,filled", fillcolor="white", color="#222222", penwidth=1.4, fontname="Arial", fontsize=13, margin="0.14,0.10"];
  edge [color="#222222", penwidth=1.3, arrowsize=0.75, fontname="Arial", fontsize=11];
`;

const diagrams = {
  architecture: String.raw`
digraph G {
  ${common}
  rankdir=TB;
  label="KIẾN TRÚC TỔNG THỂ UIT CAREER HUB";
  labelloc="t"; fontsize=20; fontname="Arial Bold";

  subgraph cluster_users {
    label="Người sử dụng"; color="#777777"; style="rounded,dashed";
    student [label="Sinh viên UIT"];
    uit [label="Bộ phận phụ trách UIT"];
    company [label="Doanh nghiệp đối tác"];
    {rank=same; student; uit; company;}
  }

  frontend [label="Web Frontend\nReact 19 + Vite 6\nBa portal theo vai trò", width=3.0, fillcolor="#f5f5f5"];
  gateway [label="REST API / HTTPS\nJWT access token + HttpOnly refresh cookie", shape=box, style="rounded,filled", fillcolor="#eeeeee", width=4.1];

  subgraph cluster_backend {
    label="Backend modular monolith - Java 21 / Spring Boot 3.5"; color="#555555"; penwidth=1.5; style="rounded";
    auth [label="Auth & RBAC"];
    jobs [label="Doanh nghiệp &\nTin tuyển dụng"];
    apps [label="Hồ sơ, ứng tuyển,\nphỏng vấn & offer"];
    placement [label="Placement &\nđánh giá thực tập"];
    admin [label="Taxonomy, dashboard,\nbáo cáo & thông báo"];
    {rank=same; auth; jobs; apps; placement; admin;}
  }

  db [label="PostgreSQL / Neon\nDữ liệu nghiệp vụ, history, audit", shape=cylinder, fillcolor="#f5f5f5"];
  r2 [label="Cloudflare R2 private\nCV, bảng điểm, PDF offer\nPresigned URL ngắn hạn", shape=folder, fillcolor="#f5f5f5"];
  email [label="Resend / Email outbox\nThông báo sự kiện quan trọng", shape=box, fillcolor="#f5f5f5"];
  {rank=same; db; r2; email;}

  student -> frontend; uit -> frontend; company -> frontend;
  frontend -> gateway;
  gateway -> auth; gateway -> jobs; gateway -> apps; gateway -> placement; gateway -> admin;
  auth -> db; jobs -> db; apps -> db; placement -> db; admin -> db;
  apps -> r2 [label="ký URL / kiểm tra file"];
  admin -> email [label="outbox / retry"];
}
`,

  job_state: String.raw`
digraph G {
  ${common}
  rankdir=LR;
  label="VÒNG ĐỜI TIN TUYỂN DỤNG"; labelloc="t"; fontsize=20; fontname="Arial Bold";
  start [shape=circle, label="", width=0.25, height=0.25, fixedsize=true, fillcolor="#222222"];
  end1 [shape=doublecircle, label="", width=0.28, height=0.28, fixedsize=true];
  end2 [shape=doublecircle, label="", width=0.28, height=0.28, fixedsize=true];
  DRAFT [label="DRAFT\nBản nháp"];
  PENDING [label="PENDING_UIT_REVIEW\nChờ UIT duyệt", fillcolor="#eeeeee"];
  REVISION [label="REVISION_REQUIRED\nYêu cầu chỉnh sửa"];
  RECRUITING [label="RECRUITING\nĐang tuyển", fillcolor="#eeeeee"];
  PAUSED [label="PAUSED\nTạm dừng"];
  EXPIRED [label="EXPIRED\nHết hạn"];
  REJECTED [label="REJECTED\nTừ chối"];
  CLOSED [label="CLOSED\nĐã đóng"];
  start -> DRAFT;
  DRAFT -> PENDING [label="Doanh nghiệp gửi duyệt"];
  DRAFT -> CLOSED [label="đóng nháp"];
  PENDING -> RECRUITING [label="UIT duyệt"];
  PENDING -> REVISION [label="UIT yêu cầu sửa"];
  PENDING -> REJECTED [label="UIT từ chối"];
  REVISION -> PENDING [label="sửa và gửi lại"];
  REVISION -> CLOSED [label="đóng"];
  RECRUITING -> PAUSED [label="tạm dừng"];
  PAUSED -> RECRUITING [label="mở lại"];
  RECRUITING -> EXPIRED [label="hết hạn", style=dashed];
  EXPIRED -> PENDING [label="xin gia hạn"];
  RECRUITING -> CLOSED [label="đóng"];
  PAUSED -> CLOSED [label="đóng"];
  EXPIRED -> CLOSED [label="đóng"];
  REJECTED -> end1; CLOSED -> end2;
}
`,

  application_state: String.raw`
digraph G {
  ${common}
  rankdir=TB;
  label="VÒNG ĐỜI ĐƠN ỨNG TUYỂN"; labelloc="t"; fontsize=20; fontname="Arial Bold";
  start [shape=circle, label="", width=0.24, height=0.24, fixedsize=true, fillcolor="#222222"];
  terminal [shape=doublecircle, label="Kết thúc", width=0.8, height=0.8, fixedsize=true, fontsize=10];
  review [label="UIT_REVIEWING\nUIT kiểm tra hồ sơ", fillcolor="#eeeeee"];
  supplement [label="NEEDS_SUPPLEMENT\nCần bổ sung"];
  forwarded [label="FORWARDED_TO_COMPANY\nĐã chuyển doanh nghiệp"];
  companyReview [label="COMPANY_REVIEWING\nDoanh nghiệp sàng lọc", fillcolor="#eeeeee"];
  interview [label="INTERVIEW_INVITED\nMời phỏng vấn"];
  offer [label="OFFER_PENDING_STUDENT\nChờ sinh viên phản hồi offer"];
  accepted [label="ACCEPTED_PENDING_UIT_CONFIRMATION\nChờ UIT xác nhận nơi thực tập", fillcolor="#eeeeee"];
  hired [label="HIRED\nĐã xác nhận nhận việc", peripheries=2];
  rejected [label="UIT_REJECTED\nUIT từ chối"];
  unsuitable [label="NOT_SUITABLE\nKhông phù hợp"];
  failed [label="INTERVIEW_FAILED\nKhông đạt phỏng vấn"];
  declined [label="OFFER_DECLINED\nTừ chối offer"];
  withdrawn [label="WITHDRAWN\nĐã rút / tự đóng"];

  start -> review [label="Sinh viên gửi đơn"];
  review -> supplement [label="yêu cầu bổ sung"];
  supplement -> review [label="nộp lại"];
  review -> forwarded [label="UIT chuyển hồ sơ"];
  review -> rejected [label="UIT từ chối"];
  forwarded -> companyReview [label="bắt đầu xem"];
  companyReview -> interview [label="mời phỏng vấn"];
  companyReview -> unsuitable [label="không phù hợp"];
  interview -> offer [label="PASS + offer"];
  interview -> failed [label="FAIL"];
  offer -> accepted [label="Sinh viên nhận"];
  offer -> declined [label="Sinh viên từ chối"];
  accepted -> hired [label="UIT xác nhận"];
  review -> withdrawn [label="rút đơn", style=dashed];
  supplement -> withdrawn [label="rút đơn", style=dashed];
  forwarded -> withdrawn [label="rút đơn", style=dashed];
  companyReview -> withdrawn [label="rút đơn", style=dashed];
  interview -> withdrawn [label="hủy tham gia", style=dashed];
  rejected -> terminal; unsuitable -> terminal; failed -> terminal; declined -> terminal; withdrawn -> terminal; hired -> terminal;
}
`,

  erd: String.raw`
digraph G {
  ${common}
  rankdir=TB;
  label="MÔ HÌNH DỮ LIỆU MỨC KHÁI QUÁT"; labelloc="t"; fontsize=20; fontname="Arial Bold";
  node [shape=record, style="filled", fillcolor="white", fontsize=11, margin="0.08,0.05"];
  users [label="{USERS|id (PK)\lemail\lrole, status\l}"];
  students [label="{STUDENT_PROFILES|id (PK)\luser_id (FK)\lstudent_code, faculty, major\l}"];
  companyUsers [label="{COMPANY_USERS|id (PK)\luser_id (FK)\lcompany_id (FK)\l}"];
  companies [label="{COMPANIES|id (PK)\lpartner_code\lstatus, public_profile\l}"];
  jobs [label="{JOB_POSTS|id (PK)\lcompany_id (FK)\lstatus, version, deadline\l}"];
  documents [label="{STUDENT_DOCUMENTS|id (PK)\lstudent_profile_id (FK)\ltype, verification_status\l}"];
  applications [label="{APPLICATIONS|id (PK)\lstudent_profile_id (FK)\ljob_post_id (FK)\lstatus, version\l}", fillcolor="#eeeeee"];
  appDocs [label="{APPLICATION_DOCUMENTS|application_id (FK)\ldocument_id (FK)\lsnapshot metadata\l}"];
  interviews [label="{INTERVIEWS|id (PK)\lapplication_id (FK)\lscheduled_at, status\l}"];
  results [label="{RECRUITMENT_RESULTS|application_id (FK)\lresult, offer object\l}"];
  placements [label="{INTERNSHIP_PLACEMENTS|id (PK)\lapplication_id (FK)\lstatus, dates, version\l}"];
  evaluations [label="{INTERNSHIP_EVALUATIONS|placement_id (FK)\lrespondent_role\lscores, comments\l}"];
  histories [label="{HISTORY / AUDIT / NOTIFICATIONS|state transitions\lactor, reason, command_id\ldedupe_key\l}"];

  {rank=same; users; companies;}
  {rank=same; students; companyUsers; jobs;}
  {rank=same; documents; applications;}
  {rank=same; appDocs; interviews; results; placements;}
  {rank=same; evaluations; histories;}

  users -> students [label="1 - 0..1"];
  users -> companyUsers [label="1 - 0..1"];
  companies -> companyUsers [label="1 - n"];
  companies -> jobs [label="1 - n"];
  students -> documents [label="1 - n"];
  students -> applications [label="1 - n"];
  jobs -> applications [label="1 - n"];
  applications -> appDocs [label="1 - n"];
  documents -> appDocs [label="1 - n"];
  applications -> interviews [label="1 - n"];
  applications -> results [label="1 - 0..1"];
  applications -> placements [label="1 - 0..1"];
  placements -> evaluations [label="1 - 0..2"];
  jobs -> histories [style=dashed];
  applications -> histories [style=dashed];
  placements -> histories [style=dashed];
}
`,
};

function htmlForSvg(svg) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#fff}
  body{display:flex;align-items:center;justify-content:center}
  svg{width:98vw!important;height:96vh!important;max-width:98vw;max-height:96vh}
  </style></head><body>${svg}</body></html>`;
}

for (const [name, dot] of Object.entries(diagrams)) {
  const svg = viz.renderString(dot, { format: "svg", engine: "dot" });
  await writeFile(path.join(outDir, `${name}.svg`), svg, "utf8");
  await writeFile(path.join(outDir, `${name}.html`), htmlForSvg(svg), "utf8");
}

const bpmnSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1320" viewBox="0 0 2400 1320">
<defs>
  <marker id="arrow" markerWidth="12" markerHeight="8" refX="11" refY="4" orient="auto"><path d="M0,0 L12,4 L0,8 Z" fill="#222"/></marker>
  <style>
    .title{font:700 34px Arial;fill:#111}.lane{fill:#fafafa;stroke:#333;stroke-width:2}.lane2{fill:#f1f1f1;stroke:#333;stroke-width:2}
    .laneLabel{font:700 24px Arial;fill:#111}.task{fill:#fff;stroke:#222;stroke-width:2.5;rx:16}.gateway{fill:#fff;stroke:#222;stroke-width:2.5}
    .taskText{font:600 19px Arial;line-height:1.25;color:#111;text-align:center}.small{font:16px Arial;color:#222;text-align:center}
    .flow{fill:none;stroke:#222;stroke-width:3;marker-end:url(#arrow)}.dash{stroke-dasharray:10 7}.label{font:16px Arial;fill:#111}
    .event{fill:#fff;stroke:#222;stroke-width:4}.end{fill:#fff;stroke:#222;stroke-width:8}
  </style>
</defs>
<rect width="2400" height="1320" fill="white"/>
<text x="1200" y="52" text-anchor="middle" class="title">BPMN - LUỒNG TUYỂN DỤNG VÀ XÁC NHẬN THỰC TẬP</text>

<rect class="lane" x="50" y="80" width="2300" height="285"/><rect class="lane2" x="50" y="365" width="2300" height="285"/>
<rect class="lane" x="50" y="650" width="2300" height="285"/><rect class="lane2" x="50" y="935" width="2300" height="285"/>
<line x1="235" y1="80" x2="235" y2="1220" stroke="#333" stroke-width="2"/>
<text transform="translate(120 235) rotate(-90)" text-anchor="middle" class="laneLabel">DOANH NGHIỆP</text>
<text transform="translate(120 520) rotate(-90)" text-anchor="middle" class="laneLabel">UIT</text>
<text transform="translate(120 805) rotate(-90)" text-anchor="middle" class="laneLabel">SINH VIÊN</text>
<text transform="translate(120 1090) rotate(-90)" text-anchor="middle" class="laneLabel">HỆ THỐNG</text>

<circle class="event" cx="285" cy="220" r="25"/>
<rect class="task" x="350" y="155" width="235" height="130"/>
<foreignObject x="365" y="175" width="205" height="90"><div xmlns="http://www.w3.org/1999/xhtml" class="taskText">Tạo và gửi tin tuyển dụng</div></foreignObject>
<path class="flow" d="M310 220 H350"/>

<rect class="task" x="650" y="440" width="235" height="130"/>
<foreignObject x="665" y="458" width="205" height="100"><div xmlns="http://www.w3.org/1999/xhtml" class="taskText">Kiểm duyệt tin và doanh nghiệp</div></foreignObject>
<path class="flow" d="M585 220 H615 V505 H650"/>

<rect class="task" x="950" y="725" width="235" height="130"/>
<foreignObject x="965" y="743" width="205" height="100"><div xmlns="http://www.w3.org/1999/xhtml" class="taskText">Tìm việc, chọn CV và gửi đơn</div></foreignObject>
<path class="flow" d="M885 505 H920 V790 H950"/>

<rect class="task" x="1250" y="440" width="235" height="130"/>
<foreignObject x="1265" y="458" width="205" height="100"><div xmlns="http://www.w3.org/1999/xhtml" class="taskText">Kiểm tra hồ sơ và tài liệu</div></foreignObject>
<path class="flow" d="M1185 790 H1215 V505 H1250"/>

<polygon class="gateway" points="1545,505 1605,445 1665,505 1605,565"/>
<foreignObject x="1555" y="475" width="100" height="65"><div xmlns="http://www.w3.org/1999/xhtml" class="small">Hồ sơ<br/>đạt?</div></foreignObject>
<path class="flow" d="M1485 505 H1545"/>

<rect class="task" x="1505" y="725" width="200" height="130"/>
<foreignObject x="1520" y="743" width="170" height="100"><div xmlns="http://www.w3.org/1999/xhtml" class="taskText">Bổ sung tài liệu theo yêu cầu</div></foreignObject>
<path class="flow dash" d="M1605 565 V725"/><text x="1620" y="650" class="label">Chưa đạt</text>
<path class="flow dash" d="M1505 790 H1215 V570"/>

<rect class="task" x="1735" y="155" width="235" height="130"/>
<foreignObject x="1750" y="171" width="205" height="105"><div xmlns="http://www.w3.org/1999/xhtml" class="taskText">Sàng lọc, phỏng vấn và gửi offer</div></foreignObject>
<path class="flow" d="M1665 505 H1700 V220 H1735"/><text x="1680" y="485" class="label">Đạt</text>

<rect class="task" x="1770" y="725" width="200" height="130"/>
<foreignObject x="1785" y="744" width="170" height="100"><div xmlns="http://www.w3.org/1999/xhtml" class="taskText">Xem PDF offer và phản hồi</div></foreignObject>
<path class="flow" d="M1850 285 V725"/>

<rect class="task" x="2040" y="440" width="220" height="130"/>
<foreignObject x="2055" y="458" width="190" height="100"><div xmlns="http://www.w3.org/1999/xhtml" class="taskText">Xác nhận nơi thực tập</div></foreignObject>
<path class="flow" d="M1970 790 H2005 V505 H2040"/>

<rect class="task" x="2010" y="1005" width="250" height="140"/>
<foreignObject x="2025" y="1024" width="220" height="110"><div xmlns="http://www.w3.org/1999/xhtml" class="taskText">Chốt HIRED, đóng đơn khác, tạo placement và thông báo</div></foreignObject>
<path class="flow" d="M2150 570 V1005"/>
<circle class="end" cx="2300" cy="1075" r="27"/>
<path class="flow" d="M2260 1075 H2273"/>

<text x="300" y="1275" class="label">Mọi quyết định quan trọng ghi state history, audit log, idempotency key và notification trong cùng luồng nghiệp vụ.</text>
</svg>`;

await writeFile(path.join(outDir, "bpmn_main.svg"), bpmnSvg, "utf8");
await writeFile(path.join(outDir, "bpmn_main.html"), htmlForSvg(bpmnSvg), "utf8");

console.log(`Generated ${Object.keys(diagrams).length + 1} SVG diagrams in ${outDir}`);
