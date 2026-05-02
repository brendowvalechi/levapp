import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { documentService } from "@/services/documentService";
import { useUpdateDocuments } from "@/hooks/useDocuments";

export default function UploadSelfieScreen() {
  const router = useRouter();
  const updateDocs = useUpdateDocuments();
  const [photo, setPhoto] = useState<{ uri: string; mimeType: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão necessária", "Precisamos acessar sua câmera.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.9,
      allowsEditing: true,
      aspect: [3, 4],
      cameraType: ImagePicker.CameraType.front,
    });
    if (!result.canceled && result.assets[0]) {
      setPhoto({ uri: result.assets[0].uri, mimeType: result.assets[0].mimeType ?? "image/jpeg" });
    }
  }

  async function pickFromGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão necessária", "Precisamos acessar sua galeria.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsEditing: true,
      aspect: [3, 4],
    });
    if (!result.canceled && result.assets[0]) {
      setPhoto({ uri: result.assets[0].uri, mimeType: result.assets[0].mimeType ?? "image/jpeg" });
    }
  }

  async function handleSave() {
    if (!photo) {
      Alert.alert("Atenção", "Tire uma selfie com seu documento.");
      return;
    }
    setUploading(true);
    try {
      const url = await documentService.uploadFile(photo.uri, photo.mimeType, "selfie.jpg", "selfie");
      await updateDocs.mutateAsync({ selfie_url: url });
      Alert.alert("Enviado!", "Selfie enviada com sucesso.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Erro", "Não foi possível enviar a selfie. Tente novamente.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
        {/* Instructions */}
        <View className="bg-blue-50 rounded-2xl p-4 gap-2">
          <Text className="font-semibold text-blue-800">Como tirar a selfie</Text>
          {[
            "Segure seu documento (CNH) ao lado do rosto",
            "Certifique-se que seu rosto e o documento estejam visíveis",
            "Use um local bem iluminado",
            "Não use óculos escuros ou chapéu",
          ].map((tip) => (
            <View key={tip} className="flex-row items-start gap-2">
              <Ionicons name="checkmark-circle" size={16} color="#1d4ed8" style={{ marginTop: 2 }} />
              <Text className="text-blue-700 text-sm flex-1">{tip}</Text>
            </View>
          ))}
        </View>

        {/* Preview */}
        {photo ? (
          <View className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <Image source={{ uri: photo.uri }} className="w-full h-72" resizeMode="cover" />
            <View className="flex-row items-center gap-2 px-4 py-3">
              <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
              <Text className="text-green-700 font-medium text-sm flex-1">Selfie adicionada</Text>
            </View>
          </View>
        ) : (
          <View className="bg-white rounded-2xl shadow-sm border border-gray-100 h-64 items-center justify-center gap-3">
            <View className="bg-blue-50 rounded-full p-5">
              <Ionicons name="person-outline" size={40} color="#1d4ed8" />
            </View>
            <Text className="text-gray-500 text-sm">Nenhuma foto adicionada</Text>
          </View>
        )}

        {/* Buttons */}
        <View className="gap-3">
          <TouchableOpacity
            className="flex-row items-center justify-center gap-2 bg-blue-700 rounded-2xl py-4"
            onPress={takePhoto}
            disabled={uploading}
          >
            <Ionicons name="camera-outline" size={20} color="white" />
            <Text className="text-white font-bold text-base">Usar câmera</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-row items-center justify-center gap-2 bg-white rounded-2xl py-4 border border-gray-200"
            onPress={pickFromGallery}
            disabled={uploading}
          >
            <Ionicons name="images-outline" size={20} color="#1d4ed8" />
            <Text className="text-blue-700 font-bold text-base">Escolher da galeria</Text>
          </TouchableOpacity>

          {photo && (
            <TouchableOpacity
              className={`rounded-2xl py-4 items-center ${uploading ? "bg-green-400" : "bg-green-600"}`}
              onPress={handleSave}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-base">Salvar selfie</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
