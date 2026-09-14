/** Convert a SignaturePad PNG data URL into a File for rubric upload. Not for evidence photos. */
export function signatureDataUrlToPngFile(dataUrl: string): File {
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  const buffer = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  return new File([buffer], "signature.png", { type: "image/png" });
}
