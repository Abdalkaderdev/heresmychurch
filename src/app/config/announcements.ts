export interface Announcement {
  id: string;
  title: string;
  body: string;
  /** Optional: e.g. "Mar 12, 2025" — shown below the body. */
  date?: string;
}

export const announcements: Announcement[] = [
  {
    id: "multi-campus",
    title: "Multi-campus support",
    body: "You can now link churches to a main campus and therefore multi-campus support. To do this, visit Update Church Info. Have fun linking!",
    date: "Mar 12, 2025",
  },
];
