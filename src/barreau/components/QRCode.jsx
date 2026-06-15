import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import QRCodeLib from "qrcode";

/**
 * QR code rendu en image (data URL) — robuste pour la capture html2canvas /
 * l'impression et l'export PDF. Teinte marine pour rester dans la charte.
 */
export function QRCode({ value, size = 92, className = "" }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let actif = true;
    QRCodeLib.toDataURL(value, { margin: 1, width: size * 3, color: { dark: "#1A3A6B", light: "#ffffff" } })
      .then((url) => actif && setSrc(url))
      .catch(() => actif && setSrc(null));
    return () => { actif = false; };
  }, [value, size]);

  return src ? (
    <img src={src} width={size} height={size} alt="QR code de vérification" className={className} />
  ) : (
    <div style={{ width: size, height: size }} className={`bg-grisL ${className}`} />
  );
}

QRCode.propTypes = {
  value: PropTypes.string.isRequired,
  size: PropTypes.number,
  className: PropTypes.string,
};

export default QRCode;
