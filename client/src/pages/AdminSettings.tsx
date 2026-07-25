import { useEffect } from "react";
import { useLocation } from "wouter";

/** Legacy route — platform settings now live in the Superadmin console. */
export default function AdminSettings() {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate("/superadmin");
  }, [navigate]);
  return null;
}
