import { useLocation, Link } from "wouter";
import { Home, Scale, Users, Receipt, Bell } from "lucide-react";

const tabs = [
  { path: "/",          label: "الرئيسية",  icon: Home    },
  { path: "/cases",     label: "القضايا",   icon: Scale   },
  { path: "/clients",   label: "العملاء",   icon: Users   },
  { path: "/invoices",  label: "الفواتير",  icon: Receipt },
  { path: "/reminders", label: "التذكيرات", icon: Bell    },
];

export default function BottomNav() {
  const [location] = useLocation();

  return (
    <nav className="bottom-nav fixed bottom-0 inset-x-0 bg-card z-50 safe-bottom">
      <div className="flex items-stretch h-16">
        {tabs.map(({ path, label, icon: Icon }) => {
          const active = path === "/" ? location === "/" : location.startsWith(path);
          return (
            <Link
              key={path}
              href={path}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 tap-effect"
            >
              <Icon
                size={22}
                className={active ? "text-primary" : "text-muted-foreground"}
                strokeWidth={active ? 2.5 : 1.8}
              />
              <span
                className={`text-[10px] font-semibold leading-none ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
              {active && (
                <span className="absolute top-0 h-0.5 w-10 bg-primary rounded-b-full -translate-y-0" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
