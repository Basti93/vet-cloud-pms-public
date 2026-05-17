import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppointmentTable } from "@/components/appointments/AppointmentTable";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("AppointmentTable", () => {
  afterEach(() => {
    cleanup();
  });

  const vets = [{ id: "vet-1", firstName: "Max", lastName: "Mueller" }];

  it("renders booking request rows and invokes confirm/reject actions", () => {
    const onConfirm = vi.fn();
    const onReject = vi.fn();

    render(
      <AppointmentTable
        items={[
          {
            id: "booking-1",
            startTime: "2026-01-15T09:00:00.000Z",
            endTime: "2026-01-15T09:30:00.000Z",
            vetId: "vet-1",
            status: "pending-confirmation",
            patient: { name: "Bella", species: "Hund" },
            owner: {
              firstName: "Erika",
              lastName: "Schneider",
              email: "erika@example.de",
            },
            reason: "Kontrolle",
          },
        ]}
        vets={vets}
        showActions
        onConfirm={onConfirm}
        onReject={onReject}
        confirmingId={null}
        rejectingId={null}
      />
    );

    const row = screen.getByTestId("booking-request-row");
    fireEvent.click(within(row).getByTestId("booking-request-confirm"));
    fireEvent.click(within(row).getByTestId("booking-request-reject"));

    expect(onConfirm).toHaveBeenCalledWith("booking-1");
    expect(onReject).toHaveBeenCalledWith("booking-1");
  });

  it("renders appointment rows and invokes the row click handler", () => {
    const onAppointmentClick = vi.fn();

    render(
      <AppointmentTable
        items={[
          {
            id: "appointment-1",
            startTime: "2026-01-15T09:00:00.000Z",
            endTime: "2026-01-15T09:30:00.000Z",
            title: "Impfung",
            status: "scheduled",
            vetId: "vet-1",
            patientName: "Milo",
            patientSpecies: "Katze",
            ownerFirstName: "Max",
            ownerLastName: "Keller",
          },
        ]}
        vets={vets}
        onAppointmentClick={onAppointmentClick}
      />
    );

    fireEvent.click(screen.getByTestId("appointment-row"));

    expect(onAppointmentClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: "appointment-1" })
    );
  });
});
