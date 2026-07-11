import narrativeRu from './narrative.json';
import narrativeEn from './narrative.en.json';
import uiRu from './ui.json';
import uiEn from './ui.en.json';

export type Language = 'ru' | 'en';

class LanguageManager {
  private current: Language = 'ru';
  private narratives: Record<Language, typeof narrativeRu>;
  private uis: Record<Language, typeof uiRu>;

  constructor() {
    this.narratives = { ru: narrativeRu, en: narrativeEn };
    this.uis = { ru: uiRu, en: uiEn };
    const saved = localStorage.getItem('colonySim_lang') as Language | null;
    if (saved && (saved === 'ru' || saved === 'en')) {
      this.current = saved;
    }
  }

  get lang(): Language { return this.current; }

  set lang(l: Language) {
    this.current = l;
    localStorage.setItem('colonySim_lang', l);
  }

  get narrative() { return this.narratives[this.current]; }
  get ui() { return this.uis[this.current]; }

  toggle(): Language {
    this.lang = this.current === 'ru' ? 'en' : 'ru';
    return this.lang;
  }
}

export const languageManager = new LanguageManager();
