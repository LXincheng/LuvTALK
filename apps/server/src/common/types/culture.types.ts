import { LanguageCode } from "../enums/language-code.enum";

export interface CulturePopup {
  id: string;
  title: string;
  scenario: string;
  expression: string;
  explanation: string;
  tip: string;
  language: LanguageCode;
}
