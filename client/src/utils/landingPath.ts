import { PERMISSIONS } from '../constants/permissions';

const LANDING_ROUTES: { permission: string; path: string }[] = [
  { permission: PERMISSIONS.PATIENTS_VIEW, path: '/' },
  { permission: PERMISSIONS.APPOINTMENTS_VIEW, path: '/appointments' },
  { permission: PERMISSIONS.FOLLOWUPS_MANAGE, path: '/follow-ups' },
  { permission: PERMISSIONS.LAB_CASES_MANAGE, path: '/lab-cases' },
  { permission: PERMISSIONS.REPORTS_VIEW, path: '/reports' },
  { permission: PERMISSIONS.SETTINGS_VIEW, path: '/settings' },
  { permission: PERMISSIONS.AI_ASSISTANT_USE, path: '/ai-assistant' },
];

/** First route the signed-in user is allowed to open. */
export function defaultLandingPath(permissions: string[] | null | undefined): string {
  if (!permissions?.length) return '/';
  return LANDING_ROUTES.find((route) => permissions.includes(route.permission))?.path ?? '/';
}
