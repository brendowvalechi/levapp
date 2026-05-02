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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useUploadCrlv } from "@/hooks/useDocuments";

export default function UploadCrlvScreen() {
  const router = useRouter();
  const { vehicleId, plate } = useLocalSearchParams<{ vehicleId: string; plate: string }>();
  const uploadCrlv = useUploadCrlv();
  const [photo, setPhoto] = useState<{ uri: string; mimeType: string } | null>(null);

  async function showOptions() {
    Alert.alert("Adicionar CRLV", "Como deseja adicionar o documento?", [
      { text: "Câmera", onPress: takePicture },
      { text: "Galeria", onPress: pickFromGallery },
      { text: "Cancelar", style: "cancel" },
    ]);
  }

  async function takePicture() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão necessária", "Precisamos acessar sua câmera.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.9,
      allowsEditing: true,
      aspect: [3, 4],
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
    });
    if (!result.canceled && result.assets[0]) {
      setPhoto({ uri: result.assets[0].uri, mimeType: result.assets[0].mimeType ?? "image/jpeg" });
    }
  }

  async function handleSave() {
    if (!photo || !vehicleId) return;
    try {
      await uploadCrlv.mutateAsync({
        vehicleId,
        uri: photo.uri,
        mimeType: photo.mimeType,
        filename: `crlv_${plate}.jpg`,
      });
      Alert.alert("Enviado!", "CRLV enviado com sucesso.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Erro", "Não foi possível enviar o CRLV. Tente novamente.");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
        <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex-row items-center gap-3">
          <Ionicons name="car-outline" size={24} color="#1d4ed8" />
          <View>
            <Text className="text-gray-500 text-xs">Veículo</Text>
            <Text className="font-semibold text-gray-800">{plate}</Text>
          </View>
        </View>

        <Text className="text-gray-500 text-sm">
          Tire uma foto nítida do CRLV do veículo. O documento deve estar legível.
        </Text>

        {/* Preview */}
        <TouchableOpacity
          className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
          onPress={showOptions}
          activeOpacity={0.8}
        >
          {photo ? (
            <View>
              <Image source={{ uri: photo.uri }} className="w-full h-64" resizeMode="cover" />
              <View className="flex-row items-center gap-2 px-4 py-3">
                <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
                <Text className="text-green-700 font-medium text-sm flex-1">CRLV adicionado</Text>
                <Text className="text-blue-600 text-sm">Trocar</Text>
              </View>
            </View>
          ) : (
            <View className="h-56 items-center justify-center gap-3">
              <View className="bg-blue-50 rounded-full p-4">
                <Ionicons name="document-outline" size={32} color="#1d4ed8" />
              </View>
              <Text className="text-gray-600 font-medium">Adicionar CRLV</Text>
              <Text className="text-gray-400 text-xs">Toque para tirar foto ou escolher</Text>
            </View>
          )}
        </TouchableOpacity>

        {photo && (
          <TouchableOpacity
            className={`rounded-2xl py-4 items-center ${uploadCrlv.isPending ? "bg-blue-400" : "bg-blue-700"}`}
            onPress={handleSave}
            disabled={uploadCrlv.isPending}
          >
            {uploadCrlv.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-base">Salvar CRLV</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
