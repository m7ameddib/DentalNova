import { settingsApi } from '@/api/settings.api';

export interface ClinicPrintInfo {
  clinicName: string | null;
  clinicPhone: string | null;
  address: string | null;
  logoUrl: string | null;
  doctorNameAr: string | null;
  doctorNameEn: string | null;
  doctorTitleAr: string | null;
  doctorTitleEn: string | null;
  doctorLicenseNo: string | null;
}

/**
 * Fetches clinic identity (+ logo, if any) for print output. Awaited by
 * every "Print" action so the clinic header is guaranteed to be ready
 * before the browser print dialog opens (avoids a blank-logo race).
 */
export async function loadClinicPrintInfo(): Promise<ClinicPrintInfo> {
  const settings = await settingsApi.getClinic();
  let logoUrl: string | null = null;
  if (settings.logoPath) {
    try {
      const blob = await settingsApi.fetchLogoBlob();
      logoUrl = URL.createObjectURL(blob);
    } catch {
      logoUrl = null;
    }
  }
  return {
    clinicName: settings.clinicName,
    clinicPhone: settings.clinicPhone,
    address: settings.address,
    logoUrl,
    doctorNameAr: settings.doctorNameAr ?? null,
    doctorNameEn: settings.doctorNameEn ?? null,
    doctorTitleAr: settings.doctorTitleAr ?? null,
    doctorTitleEn: settings.doctorTitleEn ?? null,
    doctorLicenseNo: settings.doctorLicenseNo ?? null,
  };
}
