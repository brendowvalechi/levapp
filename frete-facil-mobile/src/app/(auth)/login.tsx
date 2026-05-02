import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLogin } from "@/hooks/useAuth";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

type FormData = z.infer<typeof schema>;

export default function LoginScreen() {
  const router = useRouter();
  const login = useLogin();

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = (data: FormData) => login.mutate(data);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 px-6 pt-8">
          <TouchableOpacity onPress={() => router.back()} className="mb-8">
            <Text className="text-primary-700 text-base">← Voltar</Text>
          </TouchableOpacity>

          <Text className="text-3xl font-bold text-gray-900 mb-2">Entrar</Text>
          <Text className="text-gray-500 mb-8">Bem-vindo de volta!</Text>

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, value } }) => (
              <View className="mb-4">
                <Text className="text-gray-700 font-medium mb-1">E-mail</Text>
                <TextInput
                  className="border border-gray-300 rounded-xl px-4 py-3 text-base"
                  placeholder="seu@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onChangeText={onChange}
                  value={value}
                />
                {errors.email && <Text className="text-red-500 text-sm mt-1">{errors.email.message}</Text>}
              </View>
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, value } }) => (
              <View className="mb-6">
                <Text className="text-gray-700 font-medium mb-1">Senha</Text>
                <TextInput
                  className="border border-gray-300 rounded-xl px-4 py-3 text-base"
                  placeholder="••••••••"
                  secureTextEntry
                  onChangeText={onChange}
                  value={value}
                />
                {errors.password && <Text className="text-red-500 text-sm mt-1">{errors.password.message}</Text>}
              </View>
            )}
          />

          {login.isError && (
            <View className="bg-red-50 rounded-xl px-4 py-3 mb-4">
              <Text className="text-red-600 text-sm">
                {(login.error as any)?.response?.data?.detail ?? "Erro ao entrar. Tente novamente."}
              </Text>
            </View>
          )}

          <TouchableOpacity
            className={`rounded-2xl py-4 items-center ${login.isPending ? "bg-primary-400" : "bg-primary-700"}`}
            onPress={handleSubmit(onSubmit)}
            disabled={login.isPending}
          >
            {login.isPending
              ? <ActivityIndicator color="white" />
              : <Text className="text-white font-bold text-lg">Entrar</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity className="mt-4 items-center">
            <Text className="text-primary-700">Esqueci minha senha</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
