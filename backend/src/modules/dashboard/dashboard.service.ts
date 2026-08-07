import { DashboardRepository } from "./dashboard.repository.js";

export class DashboardService {
  constructor(private readonly repository: DashboardRepository) {}

  adminDashboard() {
    return this.repository.adminDashboard();
  }

  companyDashboard(companyId: string) {
    return this.repository.companyDashboard(companyId);
  }

  studentDashboard(studentProfileId: string) {
    return this.repository.studentDashboard(studentProfileId);
  }
}
