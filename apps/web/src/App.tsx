import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { CollectionPage } from "./features/collection/CollectionPage.js";
import { MainMenu } from "./features/menu/MainMenu.js";
import { analytics } from "./shared/observability.js";

export function App() {
  const location = useLocation();

  useEffect(() => {
    analytics.track(location.pathname === "/" ? "main_menu_viewed" : "collection_viewed", {
      route: location.pathname
    });
  }, [location.pathname]);

  return (
    <Routes>
      <Route path="/" element={<MainMenu />} />
      <Route path="/collection" element={<CollectionPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
