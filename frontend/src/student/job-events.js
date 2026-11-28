// Fire-and-forget behaviour logging for the ranking model; a failure never bothers the student.
export function logJobEvent(authorizedRequest, event) {
  authorizedRequest("/students/me/job-events", { method: "POST", body: JSON.stringify(event) }).catch(() => {});
}
