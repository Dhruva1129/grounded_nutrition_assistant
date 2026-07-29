import React, { useState, useEffect } from "react";
import { api } from "../api.js";

export default function DisclaimerBanner() {
  const [disclaimer, setDisclaimer] = useState("");

  useEffect(() => {
    api.getDisclaimer()
      .then((data) => setDisclaimer(data.disclaimer))
      .catch(() => setDisclaimer("This application does not provide medical advice. Consult a professional."));
  }, []);

  return (
    <div className="disclaimer-banner">
      <div>
        <strong>Disclaimer:</strong> {disclaimer}
      </div>
    </div>
  );
}
