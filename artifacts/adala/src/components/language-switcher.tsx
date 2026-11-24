import { useTranslation } from "react-i18next";
import { Globe, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const LANGUAGES = [
  { code: "ar", label: "العربية", flag: "🇸🇦", dir: "rtl" },
  { code: "en", label: "English", flag: "🇬🇧", dir: "ltr" },
] as const;

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const current = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={isAr ? "ghost" : "outline"}
          size="sm"
          className={`gap-1.5 text-xs font-medium h-8 px-2 ${
            isAr
              ? "text-muted-foreground hover:text-foreground"
              : "border-amber-500/60 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
          }`}
        >
          {!isAr && <AlertTriangle className="h-3 w-3" />}
          <Globe className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{current.flag} {current.label}</span>
          <span className="sm:hidden">{current.flag}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {!isAr && (
          <>
            <DropdownMenuLabel className="text-xs text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3" /> الواجهة باللغة الإنجليزية
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => i18n.changeLanguage(lang.code)}
            className={`gap-2 cursor-pointer ${i18n.language === lang.code ? "font-bold text-primary" : ""}`}
          >
            <span>{lang.flag}</span>
            <span>{lang.label}</span>
            {i18n.language === lang.code && (
              <span className="mr-auto text-[10px] text-primary">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
