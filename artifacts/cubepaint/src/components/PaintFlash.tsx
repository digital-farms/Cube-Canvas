import { useEffect, useRef } from "react";
import { registerFlashEl } from "../utils/paintEvents";

export default function PaintFlash() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    registerFlashEl(ref.current);
    return () => registerFlashEl(null);
  }, []);
  return <div ref={ref} className="paint-flash" />;
}
