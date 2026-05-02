import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  documentService,
  VehicleCreatePayload,
} from "@/services/documentService";
import { useAuthStore } from "@/store/auth";

export function useVerificationStatus() {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ["verificationStatus"],
    queryFn: documentService.getVerificationStatus,
    enabled: !!token,
    staleTime: 1000 * 30,
  });
}

export function useVehicles() {
  const { token } = useAuthStore();
  return useQuery({
    queryKey: ["vehicles"],
    queryFn: documentService.listVehicles,
    enabled: !!token,
    staleTime: 1000 * 60 * 5,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      uri,
      mimeType,
      filename,
      folder,
      documentField,
      cnhNumber,
    }: {
      uri: string;
      mimeType: string;
      filename: string;
      folder: "cnh" | "selfie" | "crlv" | "profile";
      documentField: "cnh_front_url" | "cnh_back_url" | "selfie_url";
      cnhNumber?: string;
    }) => {
      const url = await documentService.uploadFile(uri, mimeType, filename, folder);
      return documentService.updateDocuments({
        [documentField]: url,
        ...(cnhNumber ? { cnh_number: cnhNumber } : {}),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["verificationStatus"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useUpdateDocuments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: documentService.updateDocuments,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["verificationStatus"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useAddVehicle() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (payload: VehicleCreatePayload) =>
      documentService.addVehicle(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      router.back();
    },
  });
}

export function useUploadCrlv() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      vehicleId,
      uri,
      mimeType,
      filename,
    }: {
      vehicleId: string;
      uri: string;
      mimeType: string;
      filename: string;
    }) => {
      const url = await documentService.uploadFile(uri, mimeType, filename, "crlv");
      return documentService.updateCrlv(vehicleId, url);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    },
  });
}
