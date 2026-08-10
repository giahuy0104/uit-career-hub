import assert from "node:assert/strict";
import test from "node:test";

import {
  filterStudentApplications,
  filterStudentJobs,
  resolveVisibleSelection,
} from "../src/student/list-state.js";

const jobs = [
  {
    id: "job-1",
    title: "Thực tập sinh Backend",
    opportunityType: "INTERNSHIP",
    company: { name: "VNG Corporation" },
    skills: [{ name: "Java" }],
  },
  {
    id: "job-2",
    title: "Kỹ sư dữ liệu",
    opportunityType: "FULL_TIME",
    company: { name: "FPT Software" },
    skills: [{ name: "PostgreSQL" }],
  },
];

const applications = [
  {
    id: "application-1",
    status: "UIT_REVIEWING",
    job: { title: "Thực tập sinh Backend", company: { name: "VNG Corporation" } },
  },
  {
    id: "application-2",
    status: "COMPANY_REVIEWING",
    job: { title: "Kỹ sư dữ liệu", company: { name: "FPT Software" } },
  },
];

test("lọc việc làm theo từ khóa kỹ năng và loại thực tập", () => {
  assert.deepEqual(filterStudentJobs(jobs, "java", true).map((job) => job.id), ["job-1"]);
  assert.deepEqual(filterStudentJobs(jobs, "fpt", true), []);
});

test("lọc đơn theo từ khóa và đúng trạng thái kỹ thuật", () => {
  assert.deepEqual(
    filterStudentApplications(applications, "fpt", "COMPANY_REVIEWING").map((application) => application.id),
    ["application-2"],
  );
  assert.deepEqual(filterStudentApplications(applications, "vng", "COMPANY_REVIEWING"), []);
});

test("không giữ mục đã chọn khi mục đó nằm ngoài kết quả lọc", () => {
  const filtered = filterStudentApplications(applications, "fpt", "");

  assert.equal(resolveVisibleSelection(filtered, "application-1")?.id, "application-2");
  assert.equal(resolveVisibleSelection([], "application-1"), null);
});
