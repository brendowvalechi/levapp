import { View, Text, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAddVehicle } from "@/hooks/useDocuments";
import type { VehicleType } from "@/services/documentService";

const VEHICLE_TYPES: { value: VehicleType; label: string }[] = [
  { value: "caminhonete", label: "Caminhonete" },
  { value: "furgao", label: "Furgão" },
  { value: "saveiro", label: "Saveiro" },
  { value: "strada", label: "Strada" },
  { value: "hr", label: "HR" },
  { value: "caminhao_pequeno", label: "Caminhão Pequeno" },
  { value: "outros", label: "Outros" },
];

const schema = z.object({
  type: z.enum(["furgao", "caminhonete", "saveiro", "strada", "hr", "caminhao_pequeno", "outros"] as const),
  plate: z
    .string()
    .min(7, "Placa inválida")
    .max(8, "Placa inválida")
    .regex(/^[A-Z0-9]+$/i, "Apenas letras e números"),
  brand: z.string().min(2, "Informe a marca"),
  model: z.string().min(1, "Informe o modelo"),
  year: z
    .string()
    .regex(/^\d{4}$/, "Ano inválido")
    .refine((v) => {
      const y = parseInt(v);
      return y >= 1990 && y <= new Date().getFullYear() + 1;
    }, "Ano fora do intervalo"),
  capacity_kg: z.string().optional(),
  color: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function AddVehicleScreen() {
  const addVehicle = useAddVehicle();

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: "caminhonete" },
  });

  const selectedType = watch("type");

  async function onSubmit(data: FormData) {
    try {
      await addVehicle.mutateAsync({
        type: data.type,
        plate: data.plate.toUpperCase().replace(/-/g, ""),
        brand: data.brand,
        model: data.model,
        year: parseInt(data.year),
        capacity_kg: data.capacity_kg ? parseInt(data.capacity_kg) : undefined,
        color: data.color || undefined,
      });
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail === "Plate already registered"
          ? "Essa placa já está cadastrada."
          : "Não foi possível cadastrar o veículo.";
      Alert.alert("Erro", msg);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        {/* Vehicle type */}
        <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <Text className="text-gray-700 font-semibold mb-3">Tipo de veículo *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {VEHICLE_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  className={`px-4 py-2 rounded-xl border ${
                    selectedType === t.value
                      ? "bg-blue-700 border-blue-700"
                      : "bg-white border-gray-200"
                  }`}
                  onPress={() => setValue("type", t.value)}
                >
                  <Text
                    className={`text-sm font-medium ${
                      selectedType === t.value ? "text-white" : "text-gray-600"
                    }`}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Fields */}
        <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 gap-4">
          <Field
            label="Placa *"
            placeholder="ABC1D23"
            control={control}
            name="plate"
            error={errors.plate?.message}
            autoCapitalize="characters"
            maxLength={8}
          />
          <Field
            label="Marca *"
            placeholder="Fiat, VW, Ford..."
            control={control}
            name="brand"
            error={errors.brand?.message}
            autoCapitalize="words"
          />
          <Field
            label="Modelo *"
            placeholder="Strada, Kombi..."
            control={control}
            name="model"
            error={errors.model?.message}
            autoCapitalize="words"
          />
          <Field
            label="Ano *"
            placeholder="2020"
            control={control}
            name="year"
            error={errors.year?.message}
            keyboardType="numeric"
            maxLength={4}
          />
          <Field
            label="Capacidade (kg)"
            placeholder="800"
            control={control}
            name="capacity_kg"
            error={errors.capacity_kg?.message}
            keyboardType="numeric"
          />
          <Field
            label="Cor"
            placeholder="Branco, Prata..."
            control={control}
            name="color"
            error={errors.color?.message}
            autoCapitalize="words"
          />
        </View>

        <TouchableOpacity
          className={`rounded-2xl py-4 items-center ${addVehicle.isPending ? "bg-blue-400" : "bg-blue-700"}`}
          onPress={handleSubmit(onSubmit)}
          disabled={addVehicle.isPending}
        >
          {addVehicle.isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-bold text-base">Cadastrar veículo</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  placeholder,
  control,
  name,
  error,
  ...inputProps
}: {
  label: string;
  placeholder: string;
  control: any;
  name: string;
  error?: string;
  [key: string]: any;
}) {
  return (
    <View>
      <Text className="text-gray-600 text-sm mb-1">{label}</Text>
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, value } }) => (
          <TextInput
            className={`bg-gray-50 rounded-xl px-4 py-3 text-gray-800 border ${
              error ? "border-red-400" : "border-gray-200"
            }`}
            placeholder={placeholder}
            onChangeText={onChange}
            value={value ?? ""}
            {...inputProps}
          />
        )}
      />
      {error && <Text className="text-red-500 text-xs mt-1">{error}</Text>}
    </View>
  );
}
