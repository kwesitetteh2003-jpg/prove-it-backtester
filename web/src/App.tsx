import { MotionConfig } from "framer-motion";
import { useEffect } from "react";
import { Lab } from "./components/Lab";
import { Landing } from "./components/Landing";
import { Nav } from "./components/Nav";
import { useHashRoute } from "./lib/hooks";

export default function App() {
  const r = useHashRoute();
  const route = r === "lab" ? "lab" : "home";
  useEffect(() => { if (route === "lab") window.scrollTo(0, 0); }, [route]);
  return (
    <MotionConfig reducedMotion="user">
      <Nav route={route} />
      {route === "lab" ? <Lab /> : <Landing />}
    </MotionConfig>
  );
}
