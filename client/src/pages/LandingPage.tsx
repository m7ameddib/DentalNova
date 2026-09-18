import { ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Menu, X } from 'lucide-react';
import { BrandLogo } from '@/components/common/BrandLogo';
import { installationApi } from '@/api/installation.api';
import { useUiStore } from '@/store/ui.store';

const CAPABILITIES = [
  'landing.cap.patients',
  'landing.cap.treatments',
  'landing.cap.chart',
  'landing.cap.appointments',
  'landing.cap.emergency',
  'landing.cap.accounts',
  'landing.cap.prescriptions',
  'landing.cap.followups',
  'landing.cap.lab',
  'landing.cap.notes',
  'landing.cap.files',
  'landing.cap.reports',
  'landing.cap.whatsapp',
  'landing.cap.ai',
  'landing.cap.staff',
  'landing.cap.modes',
  'landing.cap.backup',
] as const;

const CHART_TEETH = 16;

export function LandingPage() {
  const { t } = useTranslation();
  const { language, setLanguage } = useUiStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: installStatus } = useQuery({
    queryKey: ['installation-status'],
    queryFn: installationApi.status,
    staleTime: 60_000,
  });
  const canCreateClinic = installStatus?.canCreateClinic !== false;

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <div className="dn-landing">
      <header className="dn-landing__nav">
        <Link to="/" className="dn-landing__brand" aria-label="Dental Nova">
          <BrandLogo variant="nav" />
        </Link>
        <nav
          id="dn-landing-nav"
          className={menuOpen ? 'dn-landing__nav-links is-open' : 'dn-landing__nav-links'}
        >
          <a href="#product" onClick={closeMenu}>{t('landing.nav.product')}</a>
          <a href="#mobile" onClick={closeMenu}>{t('landing.nav.mobile')}</a>
          <a href="#editions" onClick={closeMenu}>{t('landing.nav.editions')}</a>
          <a href="#pricing" onClick={closeMenu}>{t('landing.nav.pricing')}</a>
        </nav>
        <div className="dn-landing__nav-actions">
          <div className="dn-landing__lang" role="group" aria-label={t('common.language')}>
            <button
              type="button"
              className={language === 'en' ? 'lang-btn lang-btn--active' : 'lang-btn'}
              onClick={() => setLanguage('en')}
            >
              EN
            </button>
            <button
              type="button"
              className={language === 'ar' ? 'lang-btn lang-btn--active' : 'lang-btn'}
              onClick={() => setLanguage('ar')}
            >
              عربي
            </button>
          </div>
          <Link to="/login" className="dn-landing__login">
            {t('auth.signIn')}
          </Link>
          {canCreateClinic && (
            <Link to="/setup" className="btn btn--primary dn-landing__cta">
              {t('landing.cta.trial')}
            </Link>
          )}
        </div>
        <button
          type="button"
          className="dn-landing__menu"
          aria-expanded={menuOpen}
          aria-controls="dn-landing-nav"
          aria-label={menuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      <section className="dn-hero">
        <div className="dn-hero__copy">
          <p className="dn-kicker">{t('landing.hero.kicker')}</p>
          <h1>{t('landing.hero.title')}</h1>
          <p className="dn-hero__lead">{t('landing.hero.lead')}</p>
          <ul className="dn-hero__points">
            <li>{t('landing.cap.patients')}</li>
            <li>{t('landing.cap.appointments')}</li>
            <li>{t('landing.cap.modes')}</li>
          </ul>
          <div className="dn-hero__actions">
            {canCreateClinic && (
              <Link to="/setup" className="btn btn--primary dn-landing__cta dn-landing__cta--lg">
                {t('landing.cta.trial')}
              </Link>
            )}
            <Link to="/login" className="btn btn--ghost dn-landing__ghost">
              {t('landing.cta.login')}
            </Link>
          </div>
        </div>
        <figure className="dn-hero__visual">
          <img src="/assets/login-clinic.jpg" alt={t('landing.hero.caption')} />
          <figcaption>{t('landing.hero.caption')}</figcaption>
        </figure>
      </section>

      <section className="dn-value" id="product">
        <h2>{t('landing.value.title')}</h2>
        <p>{t('landing.value.text')}</p>
      </section>

      <div className="dn-cap" aria-label={t('landing.cap.label')}>
        {CAPABILITIES.map((key) => (
          <span key={key}>{t(key)}</span>
        ))}
      </div>

      <section className="dn-stage">
        <div className="dn-stage__copy">
          <p className="dn-kicker">{t('landing.clinical.kicker')}</p>
          <h2>{t('landing.clinical.title')}</h2>
          <p>{t('landing.clinical.text')}</p>
        </div>
        <div className="dn-window">
          <div className="dn-window__bar">
            <span />
            <span />
            <span />
            <em>{t('landing.clinical.window')}</em>
          </div>
          <div className="dn-file-mock" aria-hidden="true">
            <header className="dn-file-mock__head">
              <strong>{t('landing.demo.patientA')}</strong>
              <small>{t('landing.demo.fileNo')}</small>
            </header>
            <div className="dn-file-mock__chart">
              {Array.from({ length: CHART_TEETH }, (_, index) => (
                <i
                  key={index}
                  className={index === 5 || index === 11 ? 'is-active' : undefined}
                />
              ))}
            </div>
            <div className="dn-file-mock__rows">
              <i>{t('landing.agenda.slot2')}</i>
              <i>{t('landing.agenda.slot1')}</i>
              <i>{t('landing.clinical.window')}</i>
            </div>
          </div>
        </div>
      </section>

      <section className="dn-stage dn-stage--flip">
        <div className="dn-stage__copy">
          <p className="dn-kicker">{t('landing.agenda.kicker')}</p>
          <h2>{t('landing.agenda.title')}</h2>
          <p>{t('landing.agenda.text')}</p>
        </div>
        <div className="dn-window dn-window--agenda" aria-hidden="true">
          <div className="dn-window__bar">
            <span />
            <span />
            <span />
            <em>{t('landing.agenda.window')}</em>
          </div>
          <div className="dn-agenda-mock">
            <div className="dn-agenda-mock__day">{t('common.today')}</div>
            <div className="dn-agenda-mock__row">
              <b>09:00</b>
              <i className="dn-agenda-mock__apt">
                {t('landing.agenda.slot1')} · {t('landing.demo.patientB')}
              </i>
            </div>
            <div className="dn-agenda-mock__row">
              <b>10:00</b>
              <i className="dn-agenda-mock__apt dn-agenda-mock__apt--late">
                {t('landing.agenda.slot2')} · {t('landing.demo.patientA')}
              </i>
            </div>
            <div className="dn-agenda-mock__row">
              <b>11:00</b>
              <i className="dn-agenda-mock__apt dn-agenda-mock__apt--er">
                {t('landing.agenda.slot3')} · {t('landing.demo.patientC')}
              </i>
            </div>
            <div className="dn-agenda-mock__row dn-agenda-mock__row--empty">
              <b>12:00</b>
              <span />
            </div>
          </div>
        </div>
      </section>

      <section className="dn-duo">
        <article>
          <p className="dn-kicker">{t('landing.ai.kicker')}</p>
          <h2>{t('landing.ai.title')}</h2>
          <p>{t('landing.ai.text')}</p>
          <div className="dn-ai-mock" aria-hidden="true">
            <div className="dn-ai-mock__bubble dn-ai-mock__bubble--user">{t('landing.ai.q')}</div>
            <div className="dn-ai-mock__bubble">{t('landing.ai.a')}</div>
          </div>
        </article>
        <article>
          <p className="dn-kicker">{t('landing.wa.kicker')}</p>
          <h2>{t('landing.wa.title')}</h2>
          <p>{t('landing.wa.text')}</p>
          <div className="dn-wa-mock" aria-hidden="true">
            <strong>{t('landing.wa.previewTitle')}</strong>
            <span>{t('landing.wa.previewText')}</span>
          </div>
        </article>
      </section>

      <section className="dn-mobile" id="mobile">
        <div className="dn-mobile__copy">
          <p className="dn-kicker">{t('landing.mobile.kicker')}</p>
          <h2>{t('landing.mobile.title')}</h2>
          <p>{t('landing.mobile.text')}</p>
          <ul>
            <li>{t('landing.mobile.p1')}</li>
            <li>{t('landing.mobile.p2')}</li>
            <li>{t('landing.mobile.p3')}</li>
            <li>{t('landing.mobile.p4')}</li>
            <li>{t('landing.mobile.p5')}</li>
            <li>{t('landing.mobile.p6')}</li>
            <li>{t('landing.mobile.p7')}</li>
          </ul>
        </div>
        <div className="dn-phones" aria-hidden="true">
          <PhoneFrame title={t('landing.mobile.phoneAppts')}>
            <div className="dn-phone-ui dn-phone-ui--appts">
              <small>{t('common.today')}</small>
              <b>10:00 · {t('landing.demo.patientB')}</b>
              <b>10:30 · {t('landing.demo.patientC')}</b>
              <b className="dn-phone-ui--er">{t('landing.agenda.slot3')}</b>
            </div>
          </PhoneFrame>
          <PhoneFrame title={t('landing.mobile.phonePatient')} featured>
            <div className="dn-phone-ui dn-phone-ui--chart">
              <small>{t('landing.demo.patient')}</small>
              <strong>{t('landing.demo.patientA')}</strong>
              <div className="dn-phone-ui__chart">
                {Array.from({ length: 8 }, (_, index) => (
                  <i key={index} className={index === 2 ? 'is-active' : undefined} />
                ))}
              </div>
              <b>{t('landing.agenda.slot2')}</b>
              <b>{t('landing.agenda.slot1')}</b>
              <b>{t('landing.mobile.p3')}</b>
            </div>
          </PhoneFrame>
          <PhoneFrame title={t('landing.mobile.phoneAi')}>
            <div className="dn-phone-ui dn-phone-ui--ai">
              <small>{t('landing.cap.ai')}</small>
              <p>{t('landing.ai.q')}</p>
              <p>{t('landing.ai.a')}</p>
            </div>
          </PhoneFrame>
        </div>
      </section>

      <section className="dn-editions" id="editions">
        <header className="dn-section-head">
          <p className="dn-kicker">{t('landing.editions.kicker')}</p>
          <h2>{t('landing.editions.title')}</h2>
        </header>
        <div className="dn-editions__grid">
          <article>
            <h3>{t('landing.editions.offlineTitle')}</h3>
            <p>{t('landing.editions.offlineText')}</p>
            <p className="dn-price-row">
              <s>{t('landing.pricing.offlineWas')}</s>
              <strong>{t('landing.pricing.offlineNow')}</strong>
              <span>{t('landing.pricing.offlineTerm')}</span>
            </p>
          </article>
          <article>
            <h3>{t('landing.editions.onlineTitle')}</h3>
            <p>{t('landing.editions.onlineText')}</p>
            <p className="dn-price-row">
              <s>{t('landing.price.onlineWas')}</s>
              <strong>{t('landing.price.onlineNow')}</strong>
              <span>{t('landing.price.onlineMonth')}</span>
            </p>
            <em>{t('landing.editions.trialNote')}</em>
          </article>
        </div>
      </section>

      <section className="dn-pricing" id="pricing">
        <header className="dn-section-head">
          <h2>{t('landing.pricing.title')}</h2>
        </header>
        <div className="dn-pricing__row">
          <article>
            <span>{t('landing.pricing.offlineLabel')}</span>
            <p className="dn-price-row">
              <s>{t('landing.pricing.offlineWas')}</s>
              <strong>{t('landing.pricing.offlineNow')}</strong>
            </p>
            <b>{t('landing.pricing.offlineTerm')}</b>
          </article>
          <article>
            <span>{t('landing.pricing.onlineLabel')}</span>
            <p className="dn-price-row">
              <s>{t('landing.pricing.onlineWas')}</s>
              <strong>{t('landing.pricing.onlineNow')}</strong>
            </p>
            <b>{t('landing.pricing.onlineTerm')}</b>
          </article>
          <article className="dn-price-card--combo">
            <span>{t('landing.pricing.comboLabel')}</span>
            <p className="dn-price-row">
              <s>{t('landing.pricing.comboWas')}</s>
              <strong>{t('landing.pricing.comboNow')}</strong>
            </p>
            <b>{t('landing.pricing.comboTerm')}</b>
          </article>
        </div>
      </section>

      <section className="dn-final">
        <h2>{t('landing.final.title')}</h2>
        <p>{t('landing.final.text')}</p>
        <div className="dn-hero__actions">
          {canCreateClinic && (
            <Link to="/setup" className="btn btn--primary dn-landing__cta dn-landing__cta--lg">
              {t('landing.cta.trial')}
            </Link>
          )}
          <Link to="/login" className="btn btn--ghost dn-landing__ghost dn-landing__ghost--light">
            {t('landing.cta.login')}
          </Link>
        </div>
      </section>

      <footer className="dn-landing__footer">{t('app.poweredBy')}</footer>
    </div>
  );
}

function PhoneFrame({
  title,
  featured,
  children,
}: {
  title: string;
  featured?: boolean;
  children: ReactNode;
}) {
  return (
    <figure className={featured ? 'dn-phone dn-phone--featured' : 'dn-phone'}>
      <div className="dn-phone__bezel">
        <i className="dn-phone__notch" />
        {children}
      </div>
      <figcaption>{title}</figcaption>
    </figure>
  );
}
