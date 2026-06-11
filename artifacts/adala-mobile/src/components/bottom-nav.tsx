import { useLocation, Link } from "wouter";
import { Home, Scale, Users, FileText, Bell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const tabs = [
  { path: "/",          label: "الرئيسية",  icon: Home     },
  { path: "/cases",     label: "القضايا",   icon: Scale    },
  { path: "/clients",   label: "العملاء",   icon: Users    },
  { path: "/contracts", label: "العقود",    icon: FileText },
  { path: "/reminders", label: "التذكيرات", icon: Bell     },
];

const API = "/api";

export default function BottomNav() {
  const [location] = useLocation();

  const { data: remindersData } = useQuery({
    queryKey: ["reminders-count-mobile"],
    queryFn: () => fetch(`${API}/reminders/count`).then(r => r.json()),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const pendingCount: number = remindersData?.count ?? 0;

  return (
    <nav className="bottom-nav fixed bottom-0 inset-x-0 bg-card z-50 safe-bottom">
      <div className="flex items-stretch h-16">
        {tabs.map(({ path, label, icon: Icon }) => {
          const active = path === "/" ? location === "/" : location.startsWith(path);
          const showBadge = path === "/reminders" && pendingCount > 0;
          return (
            <Link
              key={path}
              href={path}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 tap-effect relative"
            >
              <div className="relative">
                <Icon
                  size={22}
                  className={active ? "text-primary" : "text-muted-foreground"}
                  strokeWidth={active ? 2.5 : 1.8}
                />
                {showBadge && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[8px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
                    {pendingCount > 9 ? "9+" : pendingCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-semibold leading-none ${active ? "text-primary" : "text-muted-foreground"}`}>
                {label}
              </span>
              {active && (
                <span className="absolute top-0 h-0.5 w-10 bg-primary rounded-b-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
