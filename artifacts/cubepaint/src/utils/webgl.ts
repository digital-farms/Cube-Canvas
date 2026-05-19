export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const ctx =
      canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!ctx) return false;
    const ext = (ctx as WebGLRenderingContext).getExtension(
      "WEBGL_lose_context"
    );
    ext?.loseContext();
    return true;
  } catch {
    return false;
  }
}
