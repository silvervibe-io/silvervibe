import type { Translation } from '@jsverse/transloco';
import deAbout from '../../assets/i18n/de/about.json';
import deAuth from '../../assets/i18n/de/auth.json';
import deCommon from '../../assets/i18n/de/common.json';
import deLanding from '../../assets/i18n/de/landing.json';
import deNav from '../../assets/i18n/de/nav.json';
import dePortal from '../../assets/i18n/de/portal.json';
import dePrivacy from '../../assets/i18n/de/privacy.json';
import deShell from '../../assets/i18n/de/shell.json';
import deStandup from '../../assets/i18n/de/standup.json';
import deTools from '../../assets/i18n/de/tools.json';
import elAbout from '../../assets/i18n/el/about.json';
import elAuth from '../../assets/i18n/el/auth.json';
import elCommon from '../../assets/i18n/el/common.json';
import elLanding from '../../assets/i18n/el/landing.json';
import elNav from '../../assets/i18n/el/nav.json';
import elPortal from '../../assets/i18n/el/portal.json';
import elPrivacy from '../../assets/i18n/el/privacy.json';
import elShell from '../../assets/i18n/el/shell.json';
import elStandup from '../../assets/i18n/el/standup.json';
import elTools from '../../assets/i18n/el/tools.json';
import enAbout from '../../assets/i18n/en/about.json';
import enAuth from '../../assets/i18n/en/auth.json';
import enCommon from '../../assets/i18n/en/common.json';
import enLanding from '../../assets/i18n/en/landing.json';
import enNav from '../../assets/i18n/en/nav.json';
import enPortal from '../../assets/i18n/en/portal.json';
import enPrivacy from '../../assets/i18n/en/privacy.json';
import enShell from '../../assets/i18n/en/shell.json';
import enStandup from '../../assets/i18n/en/standup.json';
import enTools from '../../assets/i18n/en/tools.json';
import esAbout from '../../assets/i18n/es/about.json';
import esAuth from '../../assets/i18n/es/auth.json';
import esCommon from '../../assets/i18n/es/common.json';
import esLanding from '../../assets/i18n/es/landing.json';
import esNav from '../../assets/i18n/es/nav.json';
import esPortal from '../../assets/i18n/es/portal.json';
import esPrivacy from '../../assets/i18n/es/privacy.json';
import esShell from '../../assets/i18n/es/shell.json';
import esStandup from '../../assets/i18n/es/standup.json';
import esTools from '../../assets/i18n/es/tools.json';
import frAbout from '../../assets/i18n/fr/about.json';
import frAuth from '../../assets/i18n/fr/auth.json';
import frCommon from '../../assets/i18n/fr/common.json';
import frLanding from '../../assets/i18n/fr/landing.json';
import frNav from '../../assets/i18n/fr/nav.json';
import frPortal from '../../assets/i18n/fr/portal.json';
import frPrivacy from '../../assets/i18n/fr/privacy.json';
import frShell from '../../assets/i18n/fr/shell.json';
import frStandup from '../../assets/i18n/fr/standup.json';
import frTools from '../../assets/i18n/fr/tools.json';
import itAbout from '../../assets/i18n/it/about.json';
import itAuth from '../../assets/i18n/it/auth.json';
import itCommon from '../../assets/i18n/it/common.json';
import itLanding from '../../assets/i18n/it/landing.json';
import itNav from '../../assets/i18n/it/nav.json';
import itPortal from '../../assets/i18n/it/portal.json';
import itPrivacy from '../../assets/i18n/it/privacy.json';
import itShell from '../../assets/i18n/it/shell.json';
import itStandup from '../../assets/i18n/it/standup.json';
import itTools from '../../assets/i18n/it/tools.json';
import nlAbout from '../../assets/i18n/nl/about.json';
import nlAuth from '../../assets/i18n/nl/auth.json';
import nlCommon from '../../assets/i18n/nl/common.json';
import nlLanding from '../../assets/i18n/nl/landing.json';
import nlNav from '../../assets/i18n/nl/nav.json';
import nlPortal from '../../assets/i18n/nl/portal.json';
import nlPrivacy from '../../assets/i18n/nl/privacy.json';
import nlShell from '../../assets/i18n/nl/shell.json';
import nlStandup from '../../assets/i18n/nl/standup.json';
import nlTools from '../../assets/i18n/nl/tools.json';
import plAbout from '../../assets/i18n/pl/about.json';
import plAuth from '../../assets/i18n/pl/auth.json';
import plCommon from '../../assets/i18n/pl/common.json';
import plLanding from '../../assets/i18n/pl/landing.json';
import plNav from '../../assets/i18n/pl/nav.json';
import plPortal from '../../assets/i18n/pl/portal.json';
import plPrivacy from '../../assets/i18n/pl/privacy.json';
import plShell from '../../assets/i18n/pl/shell.json';
import plStandup from '../../assets/i18n/pl/standup.json';
import plTools from '../../assets/i18n/pl/tools.json';
import ptAbout from '../../assets/i18n/pt/about.json';
import ptAuth from '../../assets/i18n/pt/auth.json';
import ptCommon from '../../assets/i18n/pt/common.json';
import ptLanding from '../../assets/i18n/pt/landing.json';
import ptNav from '../../assets/i18n/pt/nav.json';
import ptPortal from '../../assets/i18n/pt/portal.json';
import ptPrivacy from '../../assets/i18n/pt/privacy.json';
import ptShell from '../../assets/i18n/pt/shell.json';
import ptStandup from '../../assets/i18n/pt/standup.json';
import ptTools from '../../assets/i18n/pt/tools.json';
import type { SilvervibeLang } from './langs';

function pack(
  common: Translation,
  shell: Translation,
  auth: Translation,
  landing: Translation,
  privacy: Translation,
  standup: Translation,
  nav: Translation,
  about: Translation,
  tools: Translation,
  portal: Translation,
): Translation {
  return {
    common,
    shell,
    auth,
    landing,
    privacy,
    standup,
    nav,
    about,
    tools,
    portal,
  };
}

/** Bundled scope catalogs — avoids runtime `/i18n/*.json` fetches (SPA hosts often HTML-fallback those URLs). */
const CATALOGS: Record<SilvervibeLang, Translation> = {
  en: pack(
    enCommon,
    enShell,
    enAuth,
    enLanding,
    enPrivacy,
    enStandup,
    enNav,
    enAbout,
    enTools,
    enPortal,
  ),
  nl: pack(
    nlCommon,
    nlShell,
    nlAuth,
    nlLanding,
    nlPrivacy,
    nlStandup,
    nlNav,
    nlAbout,
    nlTools,
    nlPortal,
  ),
  de: pack(
    deCommon,
    deShell,
    deAuth,
    deLanding,
    dePrivacy,
    deStandup,
    deNav,
    deAbout,
    deTools,
    dePortal,
  ),
  fr: pack(
    frCommon,
    frShell,
    frAuth,
    frLanding,
    frPrivacy,
    frStandup,
    frNav,
    frAbout,
    frTools,
    frPortal,
  ),
  el: pack(
    elCommon,
    elShell,
    elAuth,
    elLanding,
    elPrivacy,
    elStandup,
    elNav,
    elAbout,
    elTools,
    elPortal,
  ),
  es: pack(
    esCommon,
    esShell,
    esAuth,
    esLanding,
    esPrivacy,
    esStandup,
    esNav,
    esAbout,
    esTools,
    esPortal,
  ),
  pt: pack(
    ptCommon,
    ptShell,
    ptAuth,
    ptLanding,
    ptPrivacy,
    ptStandup,
    ptNav,
    ptAbout,
    ptTools,
    ptPortal,
  ),
  it: pack(
    itCommon,
    itShell,
    itAuth,
    itLanding,
    itPrivacy,
    itStandup,
    itNav,
    itAbout,
    itTools,
    itPortal,
  ),
  pl: pack(
    plCommon,
    plShell,
    plAuth,
    plLanding,
    plPrivacy,
    plStandup,
    plNav,
    plAbout,
    plTools,
    plPortal,
  ),
};

export function catalogForLang(lang: string): Translation {
  return CATALOGS[lang as SilvervibeLang] ?? CATALOGS['en'];
}
