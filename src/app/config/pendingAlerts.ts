export interface PendingAlert {
  id: string;
  shortLabel: string;
  description: string;
  resolved?: boolean;
}

export const reportErrorsContact = {
  label: "Report other errors",
  mailto: "your@email.com", // or href for a form
};

export const pendingAlerts: PendingAlert[] = [
  {
    id: "ia-tx-nw-quadrant",
    shortLabel: "Data gap: IA & TX NW quadrants",
    description:
      "After improving church attendance data accuracy we didn't complete the NW quadrant of Iowa and Texas. We'll fill these in soon.",
    resolved: false,
  },
];
