import { Link } from "react-router-dom";
import { History, LogOut, Settings, Shield, Trophy, Users } from "lucide-react";
import { analytics } from "../../shared/observability.js";

const options = [
  { label: "Play Solo", icon: Trophy, disabled: true },
  { label: "Play Online Ranked", icon: Users, disabled: true },
  { label: "Collection", icon: Shield, to: "/collection" },
  { label: "History", icon: History, disabled: true },
  { label: "Settings", icon: Settings, disabled: true },
  { label: "Quit", icon: LogOut, disabled: true }
];

export function MainMenu() {
  return (
    <main className="menu-screen">
      <section className="menu-panel" aria-labelledby="main-menu-title">
        <div className="brand-block">
          <p className="eyebrow">Autoxi</p>
          <h1 id="main-menu-title">Squad Vault</h1>
        </div>
        <nav className="menu-options" aria-label="Main menu">
          {options.map((option) => {
            const Icon = option.icon;
            if (option.to) {
              return (
                <Link
                  className="menu-option"
                  key={option.label}
                  to={option.to}
                  onClick={() => analytics.track("main_menu_option_clicked", { option: option.label })}
                >
                  <Icon aria-hidden="true" />
                  <span>{option.label}</span>
                </Link>
              );
            }
            return (
              <button className="menu-option is-disabled" key={option.label} type="button" disabled>
                <Icon aria-hidden="true" />
                <span>{option.label}</span>
              </button>
            );
          })}
        </nav>
      </section>
    </main>
  );
}
