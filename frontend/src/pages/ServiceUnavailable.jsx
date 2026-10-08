import { useNavigate } from "react-router-dom";
import { UnavailablePanel } from "@/features/system";

export default function ServiceUnavailable() {
  const navigate = useNavigate();
  return <UnavailablePanel onRecovered={() => navigate("/plan")} />;
}
