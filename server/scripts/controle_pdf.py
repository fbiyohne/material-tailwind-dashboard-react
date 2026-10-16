"""Lecture d'un PDF pour le contrôle de gabarits : pages (pt), texte, QR décodés. Usage : python -I controle_pdf.py fichier.pdf"""
import json, sys
import cv2, numpy as np, pymupdf

doc = pymupdf.open(sys.argv[1])
pages, qr = [], []
det = cv2.QRCodeDetector()
for p in doc:
    pages.append({"w": p.rect.width, "h": p.rect.height, "texte": p.get_text()})
    pix = p.get_pixmap(dpi=200)
    img = np.frombuffer(pix.samples, np.uint8).reshape(pix.h, pix.w, pix.n)
    img = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY if pix.n == 3 else cv2.COLOR_RGBA2GRAY)
    texte, _, _ = det.detectAndDecode(img)
    if texte: qr.append(texte)
print(json.dumps({"pages": pages, "qr": qr}))
