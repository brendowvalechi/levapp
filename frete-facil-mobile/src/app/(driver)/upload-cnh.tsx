import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  TextInput,
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

interface PickedImage {
  uri: string;
  mimeType: string;
  filename: string;
}

export default function UploadCnhScreen() {
  const router = useRouter();
  const updateDocs = useUpdateDocuments();

  const [cnhNumber, setCnhNumber] = useState("");
  const [front, setFront] = useState<PickedImage | null>(null);
  const [back, setBack] = useState<PickedImage | null>(null);
  const [uploading, setUploading] = useState(false);

  async function pickImage(side: "front" | "back") {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão necessária", "Precisamos acessar sua galeria para continuar.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const picked: PickedImage = {
        uri: asset.uri,
        mimeType: asset.mimeType ?? "image/jpeg",
        filename: asset.fileName ?? `cnh_${side}.jpg`,
      };
      side === "front" ? setFront(picked) : setBack(picked);
    }
  }

  async function takePhoto(side: "front" | "back") {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão necessária", "Precisamos acessar sua câmera para continuar.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.85,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const picked: PickedImage = {
        uri: asset.uri,
        mimeType: asset.mimeType ?? "image/jpeg",
        filename: `cnh_${side}.jpg`,
      };
      side === "front" ? setFront(picked) : setBack(picked);
    }
  }

  function showImageOptions(side: "front" | "back") {
    Alert.alert("Adicionar foto", "Como deseja adicionar a imagem?", [
      { text: "Câmera", onPress: () => takePhoto(side) },
      { text: "Galeria", onPress: () => pickImage(side) },
      { text: "Cancelar", style: "cancel" },
    ]);
  }

  async function handleSave() {
    if (!front || !back) {
      Alert.alert("Atenção", "Envie a foto da frente e do verso da CNH.");
      return;
    }
    if (cnhNumber.replace(/\D/g, "").length !== 11) {
      Alert.alert("Atenção", "O número da CNH deve ter 11 dígitos.");
      return;
    }
    setUploading(true);
    try {
      const [frontUrl, backUrl] = await Promise.all([
        documentService.uploadFile(front.uri, front.mimeType, front.filename, "cnh"),
        documentService.uploadFile(back.uri, back.mimeType, back.filename, "cnh"),
      ]);
      await updateDocs.mutateAsync({
        cnh_number: cnhNumber.replace(/\D/g, ""),
        cnh_front_url: frontUrl,
        cnh_back_url: backUrl,
      });
      Alert.alert("Enviado!", "CNH enviada com sucesso.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Erro", "Não foi possível enviar os documentos. Tente novamente.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
        <Text className="text-gray-500 text-sm">
          Tire fotos nítidas dos dois lados da sua CNH em um local bem iluminado.
        </Text>

        {/* CNH number */}
        <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <Text className="text-gray-700 font-medium mb-2">Número da CNH</Text>
          <TextInput
            className="bg-gray-50 rounded-xl px-4 py-3 text-gray-800 border border-gray-200"
            placeholder="00000000000"
            keyboardType="numeric"
            maxLength={11}
            value={cnhNumber}
            onChangeText={setCnhNumber}
          />
        </View>

        {/* Front */}
        <PhotoCard
          label="Frente da CNH"
          image={front}
          onPress={() => showImageOptions("front")}
        />

        {/* Back */}
        <PhotoCard
          label="Verso da CNH"
          image={back}
          onPress={() => showImageOptions("back")}
        />

        <TouchableOpacity
          className={`rounded-2xl py-4 items-center mt-2 ${uploading ? "bg-blue-400" : "bg-blue-700"}`}
          onPress={handleSave}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-bold text-base">Salvar CNH</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function PhotoCard({
  label,
  image,
  onPress,
}: {
  label: string;
  image: PickedImage | null;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
      onPress={onPress}
      activeOpacity={0.8}
    >
      {image ? (
        <View>
          <Image source={{ uri: image.uri }} className="w-full h-44" resizeMode="cover" />
          <View className="flex-row items-center gap-2 px-4 py-3">
            <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
            <Text className="text-green-700 font-medium text-sm flex-1">{label} adicionada</Text>
            <Text className="text-blue-600 text-sm">Trocar</Text>
          </View>
        </View>
      ) : (
        <View className="h-44 items-center justify-center gap-2">
          <View className="bg-blue-50 rounded-full p-4">
            <Ionicons name="camera-outline" size={28} color="#1d4ed8" />
          </View>
          <Text className="text-gray-600 font-medium">{label}</Text>
          <Text className="text-gray-400 text-xs">Toque para adicionar</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
