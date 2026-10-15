// ============================================================================
// lib/shrinkImage.js - make photos small before uploading
// ============================================================================
// PLAIN ENGLISH: phone cameras take huge photos (often 4-10 MB). The AI only
// looks at a 224 x 224 picture, and the server refuses files over 5 MB, so we
// shrink the photo to at most 1024 px on its longest side first. That keeps
// uploads to a few hundred KB: faster, cheaper on mobile data, never rejected.
// If shrinking fails for any reason we just use the original photo.
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

const MAX_SIDE = 1024;

export async function shrinkImage(asset) {
  const fallback = { uri: asset.uri, mediaType: asset.mimeType || "image/jpeg" };
  try {
    const { width = 0, height = 0 } = asset;
    const ctx = ImageManipulator.manipulate(asset.uri);
    if (Math.max(width, height) > MAX_SIDE || !width || !height) {
      ctx.resize(width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE });
    }
    const ref = await ctx.renderAsync();
    const out = await ref.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
    return { uri: out.uri, mediaType: "image/jpeg" };
  } catch (e) {
    console.warn("shrinkImage failed, using the original photo:", e?.message);
    return fallback;
  }
}
