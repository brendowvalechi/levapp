import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRegister } from "@/hooks/useAuth";

const schema = z.object({
  name: z.string().min(3, "Nome muito curto"),
  email: z.string().email("E-mail inválido"),
  phone: z.string().min(10, "Telefone inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  role: z.enum(["client", "driver"]),
});

type FormData = z.infer<typeof schema>;

export default function RegisterScreen() {
  const router = useRouter();
  const register = useRegister();

  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: "client" },
  });

  const selectedRole = watch("role");

  const onSubmit = (data: FormData) => register.mutate(data);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
        <ScrollView className="flex-1 px-6 pt-8" keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => router.back()} className="mb-8">
            <Text className="text-primary-700 text-base">← Voltar</Text>
          </TouchableOpacity>

          <Text className="text-3xl font-bold text-gray-900 mb-2">Criar conta</Text>
          <Text className="text-gray-500 mb-6">Você é cliente ou transportador?</Text>

          <View className="flex-row mb-6 gap-3">
            {(["client", "driver"] as const).map((role) => (
              <TouchableOpacity
                key={role}
                className={`flex-1 py-3 rounded-xl border-2 items-center ${
                  selectedRole === role ? "border-primary-700 bg-blue-50" : "border-gray-200"
                }`}
                onPress={() => setValue("role", role)}
              >
                <Text className={selectedRole === role ? "text-primary-700 font-bold" : "text-gray-500"}>
                  {role === "client" ? "🛒 Cliente" : "🚚 Transportador"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {[
            { name: "name" as const, label: "Nome completo", placeholder: "João da Silva" },
            { name: "email" as const, label: "E-mail", placeholder: "seu@email.com", keyboardType: "email-address" as const },
            { name: "phone" as const, label: "Telefone (WhatsApp)", placeholder: "(34) 99999-9999", keyboardType: "phone-pad" as const },
            { name: "password" as const, label: "Senha", placeholder: "••••••••", secureTextEntry: true },
          ].map((field) => (
            <Controller
              key={field.name}
              control={control}
              name={field.name}
              render={({ field: { onChange, value } }) => (
                <View className="mb-4">
                  <Text className="text-gray-700 font-medium mb-1">{field.label}</Text>
                  <TextInput
                    className="border border-gray-300 rounded-xl px-4 py-3 text-base"
                    placeholder={field.placeholder}
                    keyboardType={field.keyboardType}
                    secureTextEntry={field.secureTextEntry}
                    autoCapitalize="none"
                    onChangeText={onChange}
                    value={value}
                  />
                  {errors[field.name] && (
                    <Text className="text-red-500 text-sm mt-1">{errors[field.name]?.message}</Text>
                  )}
                </View>
              )}
            />
          ))}

          {register.isError && (
            <View className="bg-red-50 rounded-xl px-4 py-3 mb-4">
              <Text className="text-red-600 text-sm">
                {(register.error as any)?.response?.data?.detail ?? "Erro ao criar conta. Tente novamente."}
              </Text>
            </View>
          )}

          <TouchableOpacity
            className={`rounded-2xl py-4 items-center mt-2 mb-8 ${register.isPending ? "bg-primary-400" : "bg-primary-700"}`}
            onPress={handleSubmit(onSubmit)}
            disabled={register.isPending}
          >
            {register.isPending
              ? <ActivityIndicator color="white" />
              : <Text className="text-white font-bold text-lg">Criar conta</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
