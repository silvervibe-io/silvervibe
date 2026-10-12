import type { Translation } from '@jsverse/transloco';
import deAuth from '../../assets/i18n/de/auth.json';
import deCommon from '../../assets/i18n/de/common.json';
import deLanding from '../../assets/i18n/de/landing.json';
import dePrivacy from '../../assets/i18n/de/privacy.json';
import deShell from '../../assets/i18n/de/shell.json';
import deStandup from '../../assets/i18n/de/standup.json';
import elAuth from '../../assets/i18n/el/auth.json';
import elCommon from '../../assets/i18n/el/common.json';
import elLanding from '../../assets/i18n/el/landing.json';
import elPrivacy from '../../assets/i18n/el/privacy.json';
import elShell from '../../assets/i18n/el/shell.json';
import elStandup from '../../assets/i18n/el/standup.json';
import enAuth from '../../assets/i18n/en/auth.json';
import enCommon from '../../assets/i18n/en/common.json';
import enLanding from '../../assets/i18n/en/landing.json';
import enPrivacy from '../../assets/i18n/en/privacy.json';
import enShell from '../../assets/i18n/en/shell.json';
import enStandup from '../../assets/i18n/en/standup.json';
import esAuth from '../../assets/i18n/es/auth.json';
import esCommon from '../../assets/i18n/es/common.json';
import esLanding from '../../assets/i18n/es/landing.json';
import esPrivacy from '../../assets/i18n/es/privacy.json';
import esShell from '../../assets/i18n/es/shell.json';
import esStandup from '../../assets/i18n/es/standup.json';
import frAuth from '../../assets/i18n/fr/auth.json';
import frCommon from '../../assets/i18n/fr/common.json';
import frLanding from '../../assets/i18n/fr/landing.json';
import frPrivacy from '../../assets/i18n/fr/privacy.json';
import frShell from '../../assets/i18n/fr/shell.json';
import frStandup from '../../assets/i18n/fr/standup.json';
import nlAuth from '../../assets/i18n/nl/auth.json';
import nlCommon from '../../assets/i18n/nl/common.json';
import nlLanding from '../../assets/i18n/nl/landing.json';
import nlPrivacy from '../../assets/i18n/nl/privacy.json';
import nlShell from '../../assets/i18n/nl/shell.json';
import nlStandup from '../../assets/i18n/nl/standup.json';
import type { SilvervibeLang } from './langs';

/** Bundled scope catalogs — avoids runtime `/i18n/*.json` fetches (SPA hosts often HTML-fallback those URLs). */
const CATALOGS: Record<SilvervibeLang, Translation> = {
  en: {
    common: enCommon,
    shell: enShell,
    auth: enAuth,
    landing: enLanding,
    privacy: enPrivacy,
    standup: enStandup,
  },
  nl: {
    common: nlCommon,
    shell: nlShell,
    auth: nlAuth,
    landing: nlLanding,
    privacy: nlPrivacy,
    standup: nlStandup,
  },
  de: {
    common: deCommon,
    shell: deShell,
    auth: deAuth,
    landing: deLanding,
    privacy: dePrivacy,
    standup: deStandup,
  },
  fr: {
    common: frCommon,
    shell: frShell,
    auth: frAuth,
    landing: frLanding,
    privacy: frPrivacy,
    standup: frStandup,
  },
  el: {
    common: elCommon,
    shell: elShell,
    auth: elAuth,
    landing: elLanding,
    privacy: elPrivacy,
    standup: elStandup,
  },
  es: {
    common: esCommon,
    shell: esShell,
    auth: esAuth,
    landing: esLanding,
    privacy: esPrivacy,
    standup: esStandup,
  },
};

export function catalogForLang(lang: string): Translation {
  return CATALOGS[lang as SilvervibeLang] ?? CATALOGS['en'];
}
