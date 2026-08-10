import { provisionE2eDatabase } from "./support/database.mjs";

export default function globalSetup() {
  provisionE2eDatabase();
}
