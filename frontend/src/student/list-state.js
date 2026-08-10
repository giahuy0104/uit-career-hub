export function filterStudentJobs(items, query, internOnly) {
  const normalizedQuery = query.trim().toLocaleLowerCase("vi-VN");

  return items.filter((job) => {
    const haystack = [
      job.title,
      job.company?.name,
      ...(job.skills || []).map((skill) => skill.name),
    ].filter(Boolean).join(" ").toLocaleLowerCase("vi-VN");

    return haystack.includes(normalizedQuery)
      && (!internOnly || job.opportunityType === "INTERNSHIP");
  });
}

export function filterStudentApplications(items, query, status) {
  const normalizedQuery = query.trim().toLocaleLowerCase("vi-VN");

  return items.filter((application) => {
    const haystack = [
      application.job?.title,
      application.job?.company?.name,
    ].filter(Boolean).join(" ").toLocaleLowerCase("vi-VN");

    return haystack.includes(normalizedQuery)
      && (!status || application.status === status);
  });
}

export function resolveVisibleSelection(items, selectedId) {
  return items.find((item) => item.id === selectedId) || items[0] || null;
}
