import { useState } from "react";
import { Alert, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { trpc } from "../api/trpc";
import { uploadFile } from "../api/upload";
import { Button, Muted } from "./ui";

export function DocumentUploader({
  caseId,
  onUploaded,
}: {
  caseId: number;
  onUploaded?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const register = trpc.documents.register.useMutation();

  const finish = async (uri: string, name: string, mimeType: string, size = 0) => {
    setBusy(true);
    try {
      const uploaded = await uploadFile({ uri, name, mimeType, size });
      await register.mutateAsync({
        caseId,
        name,
        originalName: name,
        mimeType,
        size: size || 1,
        fileKey: uploaded.key,
        fileUrl: uploaded.url,
        visibility: "shared",
      });
      onUploaded?.();
      Alert.alert("Uploaded", `${name} was added to the case.`);
    } catch (e) {
      Alert.alert("Upload failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  const scanWithCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Camera permission needed", "Enable camera access to scan documents.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.85,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const name = asset.fileName || `scan-${Date.now()}.jpg`;
    await finish(asset.uri, name, asset.mimeType || "image/jpeg", asset.fileSize ?? 0);
  };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Photos permission needed", "Enable photo library access to attach images.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.85,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const name = asset.fileName || `photo-${Date.now()}.jpg`;
    await finish(asset.uri, name, asset.mimeType || "image/jpeg", asset.fileSize ?? 0);
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await finish(
      asset.uri,
      asset.name,
      asset.mimeType || "application/octet-stream",
      asset.size ?? 0
    );
  };

  return (
    <View style={{ gap: 8 }}>
      <Muted>Upload a PDF or scan a page with the camera.</Muted>
      <Button title="Scan with camera" onPress={() => void scanWithCamera()} loading={busy} />
      <Button title="Choose photo" variant="secondary" onPress={() => void pickPhoto()} disabled={busy} />
      <Button title="Choose file" variant="secondary" onPress={() => void pickFile()} disabled={busy} />
    </View>
  );
}
