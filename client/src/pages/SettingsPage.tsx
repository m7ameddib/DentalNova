import { ReactNode, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Archive, Building2, Clock, CreditCard, FlaskConical, HardDrive, History, MapPin, MessageCircle, Settings as SettingsIcon, Stethoscope, Users, HeartPulse, Shield, Receipt, Download } from 'lucide-react';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/constants/permissions';
import { useUiStore } from '@/store/ui.store';
import { TreatmentCatalogSection } from '@/components/settings/TreatmentCatalogSection';
import { ClinicInfoSection } from '@/components/settings/ClinicInfoSection';
import { PaymentMethodsSection } from '@/components/settings/PaymentMethodsSection';
import { WorkingHoursSection } from '@/components/settings/WorkingHoursSection';
import { WhatsAppMessagesSection } from '@/components/settings/WhatsAppMessagesSection';
import { UsersSection } from '@/components/settings/UsersSection';
import { BackupSection } from '@/components/settings/BackupSection';
import { ActivityHistorySection } from '@/components/settings/ActivityHistorySection';
import { AreasSection } from '@/components/settings/AreasSection';
import { DiseaseCatalogSection } from '@/components/settings/DiseaseCatalogSection';
import { PatientArchiveSection } from '@/components/settings/PatientArchiveSection';
import { GuarantorsSection } from '@/components/settings/GuarantorsSection';
import { ExpenseCategoriesSection } from '@/components/settings/ExpenseCategoriesSection';
import { LaboratoriesSection } from '@/components/settings/LaboratoriesSection';
import { UpdatesSection } from '@/components/settings/UpdatesSection';
import { installationApi } from '@/api/installation.api';

interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
  content: ReactNode;
}

export function SettingsPage() {
  const { t } = useTranslation();
  const { language, setLanguage } = useUiStore();
  const canManageUsers = usePermission(PERMISSIONS.USERS_MANAGE);
  const canManageTreatments = usePermission(PERMISSIONS.TREATMENTS_MANAGE);
  const canManageSettings = usePermission(PERMISSIONS.SETTINGS_MANAGE);
  const canViewAudit = usePermission(PERMISSIONS.AUDIT_VIEW);
  const canManageArchive = usePermission(PERMISSIONS.PATIENTS_DELETE);
  const canManageLab = usePermission(PERMISSIONS.LAB_CASES_MANAGE);

  const { data: installStatus } = useQuery({
    queryKey: ['installation-status'],
    queryFn: installationApi.status,
  });
  const isOfflineMode = installStatus?.deploymentMode !== 'online';

  const generalContent = (
    <section className="settings-section">
      <h2>{t('settings.generalTitle')}</h2>
      <div className="lang-switch-group">
        <button className={language === 'en' ? 'lang-btn lang-btn--active' : 'lang-btn'} onClick={() => setLanguage('en')}>
          English
        </button>
        <button className={language === 'ar' ? 'lang-btn lang-btn--active' : 'lang-btn'} onClick={() => setLanguage('ar')}>
          العربية
        </button>
      </div>
      <h2 className="settings-section__sub-title">{t('settings.aboutTitle')}</h2>
      <p className="muted">{t('settings.aboutText')}</p>
    </section>
  );

  const items: NavItem[] = useMemo(() => {
    const list: NavItem[] = [{ id: 'general', label: t('settings.generalTitle'), icon: <SettingsIcon size={15} />, content: generalContent }];
    if (canManageSettings) {
      list.push({ id: 'clinicInfo', label: t('settings.clinicInfo.title'), icon: <Building2 size={15} />, content: <ClinicInfoSection /> });
    }
    if (canManageTreatments) {
      list.push({
        id: 'treatmentCatalog',
        label: t('settings.treatmentCatalog.title'),
        icon: <Stethoscope size={15} />,
        content: <TreatmentCatalogSection />,
      });
    }
    if (canManageSettings) {
      list.push({
        id: 'paymentMethods',
        label: t('settings.paymentMethods.title'),
        icon: <CreditCard size={15} />,
        content: <PaymentMethodsSection />,
      });
      list.push({
        id: 'areas',
        label: t('settings.areas.title'),
        icon: <MapPin size={15} />,
        content: <AreasSection />,
      });
      list.push({
        id: 'diseases',
        label: t('settings.diseases.title'),
        icon: <HeartPulse size={15} />,
        content: <DiseaseCatalogSection />,
      });
      list.push({
        id: 'guarantors',
        label: t('settings.guarantors.title'),
        icon: <Shield size={15} />,
        content: <GuarantorsSection />,
      });
      list.push({
        id: 'expenseCategories',
        label: t('settings.expenseCategories.title'),
        icon: <Receipt size={15} />,
        content: <ExpenseCategoriesSection />,
      });
    }
    if (canManageLab) {
      list.push({
        id: 'laboratories',
        label: t('settings.laboratories.title'),
        icon: <FlaskConical size={15} />,
        content: <LaboratoriesSection />,
      });
    }
    if (canManageUsers) {
      list.push({ id: 'usersRoles', label: t('settings.usersRolesTitle'), icon: <Users size={15} />, content: <UsersSection /> });
    }
    if (canManageSettings) {
      list.push({
        id: 'backup',
        label: t('settings.backup.title'),
        icon: <HardDrive size={15} />,
        content: <BackupSection />,
      });
      if (isOfflineMode) {
        list.push({
          id: 'updates',
          label: t('settings.updates.title'),
          icon: <Download size={15} />,
          content: <UpdatesSection />,
        });
      }
      list.push({
        id: 'workingHours',
        label: t('settings.workingHours.title'),
        icon: <Clock size={15} />,
        content: <WorkingHoursSection />,
      });
      list.push({
        id: 'whatsappMessages',
        label: t('settings.whatsappMessages.title'),
        icon: <MessageCircle size={15} />,
        content: <WhatsAppMessagesSection />,
      });
    }
    if (canManageArchive) {
      list.push({
        id: 'archive',
        label: t('settings.archive.title'),
        icon: <Archive size={15} />,
        content: <PatientArchiveSection />,
      });
    }
    if (canViewAudit) {
      list.push({
        id: 'activityHistory',
        label: t('settings.activityHistory.title'),
        icon: <History size={15} />,
        content: <ActivityHistorySection />,
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageSettings, canManageTreatments, canManageUsers, canViewAudit, canManageArchive, canManageLab, isOfflineMode, language, t]);

  const [activeId, setActiveId] = useState('general');
  const active = items.find((i) => i.id === activeId) ?? items[0];

  return (
    <div className="settings-page">
      <h1>{t('settings.title')}</h1>
      <div className="settings-layout">
        <nav className="settings-nav">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === active.id ? 'settings-nav__item settings-nav__item--active' : 'settings-nav__item'}
              onClick={() => setActiveId(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="settings-main">{active.content}</div>
      </div>
    </div>
  );
}
