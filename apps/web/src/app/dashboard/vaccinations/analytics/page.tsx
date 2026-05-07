import { redirect } from "next/navigation";

// Analytics merged into main /dashboard/vaccinations page
export default function VaccinationAnalyticsPage() {
  redirect("/dashboard/vaccinations");
}
