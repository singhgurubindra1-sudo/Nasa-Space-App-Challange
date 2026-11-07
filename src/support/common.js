export const CATEGORIES = [
  { id: 'bug', label: '🐞 Bug or crash' },
  { id: 'gameplay', label: '🎮 Gameplay question' },
  { id: 'account', label: '👤 Account or sign-in' },
  { id: 'data', label: '🛰 NASA data looks wrong' },
  { id: 'other', label: '✉ Something else' },
];
export const PRIORITIES = [
  { id: 'low', label: 'Low: whenever you can' },
  { id: 'normal', label: 'Normal' },
  { id: 'high', label: 'High: I am stuck' },
  { id: 'urgent', label: 'Urgent: the site is broken' },
];
export const STATUS = {
  open: { label: 'Open', cls: 'st-open' },
  in_progress: { label: 'In progress', cls: 'st-progress' },
  resolved: { label: 'Resolved', cls: 'st-resolved' },
  closed: { label: 'Closed', cls: 'st-closed' },
};
export const FEEDBACK_CATS = [
  { id: 'general', label: 'General' },
  { id: 'fun', label: 'Fun' },
  { id: 'learning', label: 'What I learned' },
  { id: 'difficulty', label: 'Difficulty' },
  { id: 'graphics', label: 'Graphics & 3D' },
  { id: 'idea', label: 'Feature idea' },
];
export const fmtDate = (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
