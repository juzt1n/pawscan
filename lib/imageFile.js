// ============================================================================
// lib/imageFile.js - turn a photo on the phone into something we can upload
// ============================================================================
// PLAIN ENGLISH: since Expo SDK 52 the app's fetch() is Expo's own version.
// It can't send the old React Native style { uri, name, type } attachment
// (that fails with "Unsupported FormDataPart implementation"). Instead we hand
// it a File from expo-file-system, which fetch knows how to read and send.
import { File } from "expo-file-system";

export const imageFile = (uri) => new File(uri);
